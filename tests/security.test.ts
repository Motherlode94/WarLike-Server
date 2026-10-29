import {mailDatabase} from './mail-database.ts';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {readJsonObject,readLimitedBytes,secureResponse,HttpError,errorResponse} from '../lib/security.ts';
import {consumeNonce,rateLimit} from '../lib/security-store.ts';
import {guardRequest} from '../lib/request-guard.ts';
import {signIdentity} from '../lib/bridge.ts';
import {mailboxStem,generatedPassword,passwordRecord,verifyPassword} from '../lib/mailbox-policy.ts';
const json=(body:string,headers:Record<string,string>={})=>new Request('https://example.test/api/mail',{method:'POST',body,headers:{'Content-Type':'application/json',...headers}});
test('body limits measure UTF-8 bytes and stop a stream without Content-Length',async()=>{
 await assert.rejects(()=>readJsonObject(json('{"v":"ééé"}'),12),e=>e instanceof HttpError&&e.status===413);
 let cancelled=false;const stream=new ReadableStream({pull(c){c.enqueue(new Uint8Array(1024))},cancel(){cancelled=true}});
 const r=new Request('https://example.test/api/mail',{method:'POST',body:stream,duplex:'half'} as RequestInit);
 await assert.rejects(()=>readLimitedBytes(r,1600),e=>e instanceof HttpError&&e.status===413);assert.equal(cancelled,true);
});
test('invalid content types, malformed JSON and non-object payloads are rejected',async()=>{
 for(const body of ['null','[]','1','"text"','{'])await assert.rejects(()=>readJsonObject(json(body),100));
 await assert.rejects(()=>readJsonObject(json('{}',{'Content-Type':'text/plain'}),100),e=>e instanceof HttpError&&e.status===415);
 assert.deepEqual(await readJsonObject(json('{"action":"reply"}'),100),{action:'reply'});
});
test('private API responses disable caching and technical errors stay private',()=>{
 const r=secureResponse(new Response('{}',{headers:{'Content-Type':'application/json'}}),json('{}'));
 assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.ok(r.headers.get('content-security-policy')?.includes("object-src 'none'"));
 const safe=errorResponse(new HttpError(429,'Attends',42));assert.equal(safe.status,429);assert.equal(safe.headers.get('retry-after'),'42');
});
function memoryDB(){const nonces=new Set<string>(),counts=new Map<string,number>();return {prepare(sql:string){let args:any[]=[];const statement={bind(...a:any[]){args=a;return statement},async run(){if(sql.startsWith('INSERT OR IGNORE INTO security_nonces')){const exists=nonces.has(args[0]);nonces.add(args[0]);return {meta:{changes:exists?0:1}}}return {meta:{changes:0}}},async first(){if(sql.startsWith('INSERT INTO security_windows')){const count=(counts.get(args[0])||0)+1;counts.set(args[0],count);return {count}}return null}};return statement},async batch(){return []}} as unknown as D1Database;}
test('a signature nonce is single use and rate windows isolate identities',async()=>{
 const db=memoryDB();await consumeNonce(db,'test-nonce',Date.now()+30000);await assert.rejects(()=>consumeNonce(db,'test-nonce',Date.now()+30000),e=>e instanceof HttpError&&e.status===401);
 await rateLimit(db,'one','mail',1,60,1000);await assert.rejects(()=>rateLimit(db,'one','mail',1,60,1000),e=>e instanceof HttpError&&e.status===429);
 await rateLimit(db,'two','mail',1,60,1000);await rateLimit(db,'one','mail',1,60,61000);
});
test('request guard rejects anonymous and cross-site writes before dispatch',async()=>{
 const run=async()=>{throw Error('must not dispatch')};
 await assert.rejects(()=>guardRequest(new Request('https://example.test/api/mail'),{},run),e=>e instanceof HttpError&&e.status===401);
 await assert.rejects(()=>guardRequest(json('{}',{'Origin':'https://evil.test'}),{},run),e=>e instanceof HttpError&&e.status===403);
});
test('a valid signed request dispatches once; replay and changed bodies do not',async()=>{
 const user={userId:'mail-1',email:'one@example.test',fullName:'One',displayName:'One'},secret='s'.repeat(64),body='{"action":"reply"}';
 const auth=await signIdentity(user,secret,{method:'POST',path:'/api/mail',body});
 const f=mailDatabase();f.sql.prepare('UPDATE members SET email=? WHERE id=?').run(user.email,f.owner.id);const request=()=>json(body,{...auth,Origin:'https://example.test'}),env={DB:f.db,WARLIKE_BRIDGE_KEY:secret,WARLIKE_OWNER_EMAIL:user.email};
 assert.equal((await guardRequest(request(),env,async()=>new Response('ok'))).status,200);
 await assert.rejects(()=>guardRequest(request(),env,async()=>new Response('bad')),e=>e instanceof HttpError&&e.status===401);
 await assert.rejects(()=>guardRequest(json('{}',{...auth,Origin:'https://example.test'}),env,async()=>new Response('bad')),e=>e instanceof HttpError&&e.status===401);
});
test('mailbox names normalize accents; generated passwords and verifiers are account specific',async()=>{
 assert.equal(mailboxStem('Élodie','D’Ángelo'),'elodie.dangelo');assert.equal(mailboxStem('Jean Pierre','Le Roy'),'jean-pierre.le-roy');
 assert.throws(()=>mailboxStem('','Victor'));assert.throws(()=>mailboxStem('a'.repeat(23),'Victor'));
 const values=new Set(Array.from({length:1000},generatedPassword));assert.equal(values.size,1000);
 const password=generatedPassword(),record=await passwordRecord(password,'WL-ONE');
 assert.equal(await verifyPassword(password,'WL-ONE',record.salt,record.verifier),true);
 assert.equal(await verifyPassword(password,'WL-TWO',record.salt,record.verifier),false);
 assert.equal(await verifyPassword(generatedPassword(),'WL-ONE',record.salt,record.verifier),false);
 assert.equal(await verifyPassword('weak','WL-ONE',record.salt,record.verifier),false);
});
