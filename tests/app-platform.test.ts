import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mailDatabase} from './mail-database.ts';
import {sha256} from '../lib/heart-pairing.ts';
import {digest} from '../lib/security-store.ts';
import {suiteApplications,validAppReturn,type SuiteApp} from '../lib/app-contract.ts';
import {issueAppCode,exchangeAppCode,appPrincipal,setAppMembership,APP_CODE_TTL,APP_SESSION_TTL} from '../lib/app-sessions.ts';
import {guardRequest} from '../lib/request-guard.ts';
import {setCredential} from '../lib/warlike-auth.ts';
const origin='https://server.test',env=(db:D1Database)=>({DB:db,WARLIKE_AUTH_ENABLED:'true'});
function fixture(){
 const q=mailDatabase();for(const [index,user] of [q.owner,q.alice,q.bob,q.eve,q.referent].entries())q.sql.prepare('INSERT INTO warlike_credentials(member_id,login,salt,verifier,iterations,version,must_change,updated_at) VALUES(?,?,?,?,16384,1,0,?)').run(user.id,'native-'+index,'AA==','AA==',Date.now());return q;
}
async function grant(q:ReturnType<typeof fixture>,app:SuiteApp,user=q.alice,role=app==='academy'?'student':'member'){await setAppMembership(q.db,q.owner,app,user.id,role,true)}
async function appToken(q:ReturnType<typeof fixture>,app:SuiteApp,user=q.alice){const verifier='v'.repeat(43),code=await issueAppCode(q.db,app,user,await sha256(verifier)),issued=await exchangeAppCode(q.db,app,code,verifier);assert.ok(issued);return issued.token}
async function cookie(q:ReturnType<typeof fixture>,user=q.owner){const token=crypto.randomUUID().replaceAll('-','')+'01234567890';await q.db.prepare('INSERT INTO warlike_sessions(token_hash,member_id,credential_version,expires_at,created_at) VALUES(?,?,1,?,?)').bind(await digest(token),user.id,Date.now()+3600000,Date.now()).run();return '__Host-warlike_session='+token}
async function call(q:ReturnType<typeof fixture>,path:string,{method='GET',token,body,headers={}}:{method?:string;token?:string;body?:unknown;headers?:Record<string,string>}={}){
 const request=new Request(origin+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
 return guardRequest(request,env(q.db),()=>{throw Error('The app API must not fall through to framework identity headers')});
}

test('new migration is repeatable and preserves existing identities and Studio projects',()=>{
 const q=fixture();try{const id=crypto.randomUUID();q.sql.prepare('INSERT INTO studio_projects(id,owner_id,name,project_json,revision,created_at,updated_at) VALUES(?,?,?,?,3,1,2)').run(id,q.alice.id,'legacy','{"tracks":[],"unknown":{"kept":true}}');const before=q.sql.prepare('SELECT * FROM studio_projects WHERE id=?').get(id);const migration=readFileSync(new URL('../drizzle/0010_suite_app_access.sql',import.meta.url),'utf8');q.sql.exec(migration);q.sql.exec(migration);assert.deepEqual(q.sql.prepare('SELECT * FROM studio_projects WHERE id=?').get(id),before);assert.equal(q.sql.prepare('SELECT COUNT(*) AS n FROM members').get()?.n,5)}finally{q.sql.close()}
});
test('app access is denied by default and scoped PKCE codes are hashed, single-use and expiring',async()=>{
 const q=fixture();try{
  await assert.rejects(issueAppCode(q.db,'academy',q.alice,await sha256('v'.repeat(43))),{status:403});await grant(q,'academy');await grant(q,'business');
  const verifier='v'.repeat(43),now=Date.now(),code=await issueAppCode(q.db,'academy',q.alice,await sha256(verifier),now);
  assert.notEqual(q.sql.prepare('SELECT code_hash FROM app_pair_codes').get()?.code_hash,code);
  assert.equal(await exchangeAppCode(q.db,'business',code,verifier,now+1),null);assert.equal(await exchangeAppCode(q.db,'academy',code,'x'.repeat(43),now+1),null);
  const issued=await exchangeAppCode(q.db,'academy',code,verifier,now+2);assert.ok(issued);assert.equal(await exchangeAppCode(q.db,'academy',code,verifier,now+3),null);
  assert.equal(await appPrincipal(q.db,'business',issued.token,now+4),null);assert.equal((await appPrincipal(q.db,'academy',issued.token,now+4))?.id,q.alice.id);assert.equal(await appPrincipal(q.db,'academy',issued.token,now+APP_SESSION_TTL+3),null);
  const late=await issueAppCode(q.db,'academy',q.alice,await sha256(verifier),now);assert.equal(await exchangeAppCode(q.db,'academy',late,verifier,now+APP_CODE_TTL+1),null);
 }finally{q.sql.close()}
});
test('parallel exchanges issue exactly one session and failed insert rolls code consumption back',async()=>{
 const q=fixture();try{await grant(q,'academy');const verifier='v'.repeat(43),challenge=await sha256(verifier),code=await issueAppCode(q.db,'academy',q.alice,challenge);const result=await Promise.all([exchangeAppCode(q.db,'academy',code,verifier),exchangeAppCode(q.db,'academy',code,verifier)]);assert.equal(result.filter(Boolean).length,1);
 const retry=await issueAppCode(q.db,'academy',q.alice,challenge);q.sql.exec("CREATE TRIGGER deny_app_session BEFORE INSERT ON app_access_sessions BEGIN SELECT RAISE(ABORT,'test failure'); END");await assert.rejects(exchangeAppCode(q.db,'academy',retry,verifier));q.sql.exec('DROP TRIGGER deny_app_session');assert.ok(await exchangeAppCode(q.db,'academy',retry,verifier));
 }finally{q.sql.close()}
});
test('live account and app rights invalidate old sessions and pending codes without deleting drafts',async()=>{
 const q=fixture();try{await grant(q,'academy');await grant(q,'business');const academy=await appToken(q,'academy'),business=await appToken(q,'business'),verifier='v'.repeat(43),pending=await issueAppCode(q.db,'academy',q.alice,await sha256(verifier));
  await setAppMembership(q.db,q.owner,'academy',q.alice.id,'editor',true);assert.equal(await appPrincipal(q.db,'academy',academy),null);assert.equal(await exchangeAppCode(q.db,'academy',pending,verifier),null);assert.ok(await appPrincipal(q.db,'business',business));
  const updated=await appToken(q,'academy');q.sql.prepare("UPDATE hub_memberships SET status='declined' WHERE member_id=?").run(q.alice.id);assert.equal(await appPrincipal(q.db,'academy',updated),null);q.sql.prepare("UPDATE hub_memberships SET status='active' WHERE member_id=?").run(q.alice.id);
  q.sql.prepare("INSERT INTO member_controls(member_id,status,updated_at,updated_by) VALUES(?,'suspended',1,?)").run(q.alice.id,q.owner.id);assert.equal(await appPrincipal(q.db,'business',business),null);q.sql.prepare("UPDATE member_controls SET status='active' WHERE member_id=?").run(q.alice.id);
  q.sql.prepare('UPDATE warlike_credentials SET must_change=1 WHERE member_id=?').run(q.alice.id);assert.equal(await appPrincipal(q.db,'academy',updated),null);
 }finally{q.sql.close()}
});
test('credential reset revokes both app sessions and outstanding associations atomically',async()=>{
 const q=fixture();try{await grant(q,'academy');await grant(q,'business');const a=await appToken(q,'academy'),b=await appToken(q,'business');const verifier='v'.repeat(43),pending=await issueAppCode(q.db,'academy',q.alice,await sha256(verifier));await setCredential(q.db,q.owner,q.alice.id,'alice.native','new-password-long-enough');assert.equal(await appPrincipal(q.db,'academy',a),null);assert.equal(await appPrincipal(q.db,'business',b),null);assert.equal(await exchangeAppCode(q.db,'academy',pending,verifier),null)}finally{q.sql.close()}
});
test('HTTP requires explicit consent and bearer scope, exact origins and valid native credentials',async()=>{
 const q=fixture();try{await grant(q,'academy');const c=await cookie(q,q.alice),challenge=await sha256('v'.repeat(43)),body={challenge,state:'s'.repeat(32)};
  assert.equal((await call(q,'/api/academy/authorize',{method:'POST',body,headers:{Origin:origin}})).status,401);
  assert.equal((await call(q,'/api/academy/authorize',{method:'POST',body,headers:{Cookie:c,Origin:'https://evil.test'}})).status,403);
  const approved=await call(q,'/api/academy/authorize',{method:'POST',body:{...body,redirectUri:'https://evil.test'},headers:{Cookie:c,Origin:origin}});assert.equal(approved.status,200);const redirect=(await approved.json() as {redirect:string}).redirect;assert.ok(redirect.startsWith(suiteApplications.academy.origin+'/#warlike_app_code='));
  const code=new URLSearchParams(new URL(redirect).hash.slice(1)).get('warlike_app_code');const exchanged=await call(q,'/api/academy/exchange',{method:'POST',body:{code,verifier:'v'.repeat(43)},headers:{Origin:suiteApplications.academy.origin}});assert.equal(exchanged.status,200);const token=(await exchanged.json() as {token:string}).token;
  assert.equal((await call(q,'/api/academy/me',{headers:{Cookie:c}})).status,401);const me=await call(q,'/api/academy/me',{token,headers:{Origin:suiteApplications.academy.origin}});assert.equal(me.status,200);assert.equal(me.headers.get('Access-Control-Allow-Origin'),suiteApplications.academy.origin);assert.equal(me.headers.get('Access-Control-Allow-Credentials'),null);
  assert.equal((await call(q,'/api/academy/me',{token,headers:{Origin:'null'}})).status,403);assert.equal((await call(q,'/api/business/me',{token})).status,401);
  assert.equal((await call(q,'/api/academy/drafts',{method:'POST',body:'not-json',headers:{'oai-authenticated-user-id':q.owner.id,'oai-authenticated-user-email':q.owner.email}})).status,401);
  assert.equal((await call(q,'/api/academy/revoke',{method:'POST',token,body:{}})).status,200);assert.equal((await call(q,'/api/academy/me',{token})).status,401);
 }finally{q.sql.close()}
});
test('only the native owner can assign app roles; referents and body identity cannot escalate',async()=>{
 const q=fixture();try{const c=await cookie(q),referent=await cookie(q,q.referent),body={app:'academy',memberId:q.alice.id,role:'editor',enabled:true};
  assert.equal((await call(q,'/api/apps/access',{method:'POST',body,headers:{Cookie:referent,Origin:origin}})).status,403);
  assert.equal((await call(q,'/api/apps/access',{method:'POST',body:{...body,role:'owner'},headers:{Cookie:c,Origin:origin}})).status,400);
  assert.equal((await call(q,'/api/apps/access',{method:'POST',body,headers:{Cookie:c,Origin:origin}})).status,200);assert.equal(q.sql.prepare('SELECT role FROM members WHERE id=?').get(q.alice.id)?.role,'member');assert.equal((await appPrincipal(q.db,'academy',await appToken(q,'academy')))?.appRole,'editor');
 }finally{q.sql.close()}
});
test('personal drafts preserve unknown data, require revisions and cannot cross account or app boundaries',async()=>{
 const q=fixture();try{await grant(q,'academy');await grant(q,'academy',q.bob);const a=await appToken(q,'academy'),b=await appToken(q,'academy',q.bob);const payload={unknown:{kept:['legacy',1]},memberId:q.bob.id};
  const created=await call(q,'/api/academy/drafts',{method:'POST',token:a,body:{title:'Existing draft',payload,memberId:q.bob.id}});assert.equal(created.status,201);const {id}=await created.json() as {id:string};
  assert.equal((await call(q,'/api/academy/drafts/'+id,{token:b})).status,404);const read=await call(q,'/api/academy/drafts/'+id,{token:a});assert.deepEqual((await read.json() as {payload:unknown}).payload,payload);
  const update={title:'Edited',payload:{...payload,newField:true},expectedRevision:1};assert.equal((await call(q,'/api/academy/drafts/'+id,{method:'PUT',token:a,body:update})).status,200);assert.equal((await call(q,'/api/academy/drafts/'+id,{method:'PUT',token:a,body:update})).status,409);
  assert.equal((await call(q,'/api/academy/drafts/'+id,{method:'DELETE',token:a,body:{expectedRevision:2}})).status,200);assert.equal((await call(q,'/api/academy/drafts/'+id,{method:'PUT',token:a,body:{...update,expectedRevision:3}})).status,404);
 }finally{q.sql.close()}
});
test('Business tenant roles gate every draft path and never trust a posted organization or owner',async()=>{
 const q=fixture();try{for(const user of [q.alice,q.bob,q.owner])await grant(q,'business',user).catch(e=>{if(user!==q.owner)throw e});const a=await appToken(q,'business'),b=await appToken(q,'business',q.bob),owner=await appToken(q,'business',q.owner);
  const r1=await call(q,'/api/business/organizations',{method:'POST',token:a,body:{name:'Company A',ownerId:q.bob.id}}),org=(await r1.json() as {id:string}).id;assert.equal(r1.status,201);
  const r2=await call(q,'/api/business/organizations',{method:'POST',token:b,body:{name:'Company B'}}),other=(await r2.json() as {id:string}).id;
  const base='/api/business/organizations/'+org+'/drafts';const made=await call(q,base,{method:'POST',token:a,body:{title:'Private',payload:{customer:'protected'},organizationId:other}});assert.equal(made.status,201);const id=(await made.json() as {id:string}).id;
  for(const token of [b,owner])assert.equal((await call(q,base+'/'+id,{token})).status,404);assert.equal((await call(q,'/api/business/organizations/'+other+'/drafts/'+id,{token:b})).status,404);
  const memberPath='/api/business/organizations/'+org+'/members';assert.equal((await call(q,memberPath,{method:'POST',token:a,body:{memberId:q.bob.id,role:'viewer',expectedRevision:0}})).status,200);
  assert.equal((await call(q,base+'/'+id,{token:b})).status,200);assert.equal((await call(q,base,{method:'POST',token:b,body:'bad json'})).status,403);
  assert.equal((await call(q,memberPath,{method:'POST',token:b,body:{memberId:q.bob.id,role:'admin',expectedRevision:1}})).status,403);
  assert.equal((await call(q,memberPath,{method:'POST',token:a,body:{memberId:q.alice.id,role:'viewer',expectedRevision:1}})).status,403);
  await setAppMembership(q.db,q.owner,'business',q.bob.id,'member',false);assert.equal((await call(q,base+'/'+id,{token:b})).status,401);
 }finally{q.sql.close()}
});
test('maintenance, missing bindings, preflights and login return paths fail closed',async()=>{
 const q=fixture();try{await grant(q,'academy');const token=await appToken(q,'academy');q.sql.prepare("INSERT INTO service_settings(key,value,updated_at,updated_by) VALUES('maintenance',?,1,?)").run(JSON.stringify({enabled:true,message:'Maintenance'}),q.owner.id);assert.equal((await call(q,'/api/academy/me',{token})).status,503);
 const preflight=await call(q,'/api/academy/me',{method:'OPTIONS',headers:{Origin:suiteApplications.academy.origin}});assert.equal(preflight.status,204);assert.equal((await call(q,'/api/academy/me',{method:'OPTIONS',headers:{Origin:'https://evil.test'}})).status,403);
 assert.equal((await guardRequest(new Request(origin+'/api/academy/me'),{WARLIKE_AUTH_ENABLED:'true'},()=>new Response('bypass'))).status,503);
 for(const app of ['heart','studio','academy','business'])assert.equal(validAppReturn('/connect/'+app+'?state=abc'),true);for(const url of ['https://evil.test','//evil.test','/admin','/connect/academy\\?a','/connect/business?x\n//evil.test'])assert.equal(validAppReturn(url),false);
 }finally{q.sql.close()}
});
test('Business member removal keeps a monotonic revision and refuses stale reactivation',async()=>{
 const q=fixture();try{await grant(q,'business');await grant(q,'business',q.bob);const a=await appToken(q,'business'),b=await appToken(q,'business',q.bob);
 const org=(await (await call(q,'/api/business/organizations',{method:'POST',token:a,body:{name:'Revision test'}})).json() as {id:string}).id,path='/api/business/organizations/'+org+'/members';
 const input={memberId:q.bob.id,role:'viewer',expectedRevision:0};assert.equal((await call(q,path,{method:'POST',token:a,body:input})).status,200);
 assert.equal((await call(q,path,{method:'DELETE',token:a,body:{memberId:q.bob.id,expectedRevision:1}})).status,200);
 assert.equal((await call(q,'/api/business/organizations/'+org+'/drafts',{token:b})).status,404);
 for(const expectedRevision of [0,1])assert.equal((await call(q,path,{method:'POST',token:a,body:{...input,expectedRevision}})).status,409);
 assert.equal((await call(q,path,{method:'POST',token:a,body:{...input,expectedRevision:2}})).status,200);
 assert.equal((await call(q,'/api/business/organizations/'+org+'/drafts',{token:b})).status,200);
 assert.equal(q.sql.prepare("SELECT count(*) AS n FROM audit_events WHERE action LIKE 'apps.organization.member%'").get()?.n,3);
 }finally{q.sql.close()}
});
test('draft auditing is transactional, failed retries add no event and oversized or deep JSON is rejected',async()=>{
 const q=fixture();try{await grant(q,'academy');const token=await appToken(q,'academy');const made=await call(q,'/api/academy/drafts',{method:'POST',token,body:{title:'Draft',payload:{kept:1}}}),id=(await made.json() as {id:string}).id;
 const body={title:'Changed',payload:{},expectedRevision:1};assert.equal((await call(q,'/api/academy/drafts/'+id,{method:'PUT',token,body})).status,200);assert.equal((await call(q,'/api/academy/drafts/'+id,{method:'PUT',token,body})).status,409);
 assert.equal(q.sql.prepare("SELECT count(*) AS n FROM audit_events WHERE action LIKE 'apps.draft.%'").get()?.n,2);
 q.sql.exec("CREATE TRIGGER app_audit_failure BEFORE INSERT ON audit_events WHEN NEW.action LIKE 'apps.draft.%' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
 assert.equal((await call(q,'/api/academy/drafts/'+id,{method:'PUT',token,body:{...body,expectedRevision:2}})).status,500);assert.equal(q.sql.prepare('SELECT revision FROM app_drafts WHERE id=?').get(id)?.revision,2);
 q.sql.exec('DROP TRIGGER app_audit_failure');
 assert.equal((await call(q,'/api/academy/drafts',{method:'POST',token,body:{title:'Huge',payload:{text:'x'.repeat(120001)}}})).status,413);
 let payload:any={};for(let i=0;i<34;i++)payload={nested:payload};assert.equal((await call(q,'/api/academy/drafts',{method:'POST',token,body:{title:'Deep',payload}})).status,400);
 }finally{q.sql.close()}
});
