import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mailDatabase} from './mail-database.ts';
import {setCredential,login,session,changePassword} from '../lib/warlike-auth.ts';
import {memberSessionRevocations,ownerSessionRevocations} from '../lib/session-security.ts';
import {assertUnambiguousPath,limitApiRequest,requestRateScope} from '../lib/request-security.ts';
import {guardRequest} from '../lib/request-guard.ts';
import {secureResponse} from '../lib/security.ts';
import {rateLimit,digest} from '../lib/security-store.ts';
const tables=['warlike_sessions','mailbox_sessions','studio_access_sessions','heart_pair_codes','studio_pair_codes'];
const oldPassword='ancien-mot-de-passe-valide',newPassword='nouveau-mot-de-passe-valide';
function linkedTables(sql:any){
 sql.exec(`CREATE TABLE IF NOT EXISTS studio_access_sessions(token_hash TEXT PRIMARY KEY,member_id TEXT,expires_at INTEGER,created_at INTEGER,revoked_at INTEGER);
 CREATE TABLE IF NOT EXISTS heart_pair_codes(code_hash TEXT PRIMARY KEY,member_id TEXT,challenge TEXT,expires_at INTEGER,created_at INTEGER,used_at INTEGER);
 CREATE TABLE IF NOT EXISTS studio_pair_codes(code_hash TEXT PRIMARY KEY,member_id TEXT,challenge TEXT,expires_at INTEGER,created_at INTEGER,used_at INTEGER);`);
}
function linked(sql:any,id:string){
 const now=Date.now();
 sql.prepare('INSERT INTO mailbox_sessions(token_hash,member_id,credential_version,expires_at) VALUES(?,?,1,?)').run(id+'-mail',id,now+60000);
 sql.prepare('INSERT INTO studio_access_sessions(token_hash,member_id,expires_at,created_at) VALUES(?,?,?,?)').run(id+'-studio',id,now+60000,now);
 for(const name of ['heart_pair_codes','studio_pair_codes'])sql.prepare(`INSERT INTO ${name}(code_hash,member_id,challenge,expires_at,created_at) VALUES(?,?,?,?,?)`).run(id+'-'+name,id,'challenge',now+60000,now);
}
const count=(sql:any,name:string,id:string)=>Number(sql.prepare(`SELECT COUNT(*) AS n FROM ${name} WHERE member_id=?`).get(id).n);

test('owner global logout removes only target sessions and pending links',async()=>{
 const {db,sql,owner,alice,bob,referent}=mailDatabase();try{
  linkedTables(sql);await setCredential(db,owner,alice.id,'alice',oldPassword);await setCredential(db,owner,bob.id,'bob',oldPassword);
  const a=await login(db,'alice',oldPassword,'a'),b=await login(db,'bob',oldPassword,'b');linked(sql,alice.id);linked(sql,bob.id);
  await assert.rejects(ownerSessionRevocations(db,referent,alice),{status:403});
  await assert.rejects(ownerSessionRevocations(db,alice,bob),{status:403});
  await assert.rejects(ownerSessionRevocations(db,owner,owner),{status:403});
  await db.batch(await ownerSessionRevocations(db,owner,alice));
  for(const table of tables){assert.equal(count(sql,table,alice.id),0,table);assert.equal(count(sql,table,bob.id),1,table);}
  assert.equal(await session(db,a.token),null);assert.equal((await session(db,b.token))?.id,bob.id);
  assert.equal(Number(sql.prepare('SELECT COUNT(*) AS n FROM members').get()!.n),5);
 }finally{sql.close();}
});
test('password reset revokes all linked sessions and logs no credentials',async()=>{
 const {db,sql,owner,alice}=mailDatabase();try{
  linkedTables(sql);await setCredential(db,owner,alice.id,'alice',oldPassword);const first=await login(db,'alice',oldPassword,'a');linked(sql,alice.id);
  await setCredential(db,owner,alice.id,'alice',newPassword);
  for(const table of tables)assert.equal(count(sql,table,alice.id),0,table);
  assert.equal(await session(db,first.token),null);
  const audit=JSON.stringify(sql.prepare('SELECT * FROM audit_events').all());
  assert.match(audit,/security.credentials.reset/);for(const secret of [oldPassword,newPassword,first.token])assert.ok(!audit.includes(secret));
 }finally{sql.close();}
});
test('wrong current password leaves sessions intact, successful change revokes every service',async()=>{
 const {db,sql,owner,alice}=mailDatabase();try{
  linkedTables(sql);await setCredential(db,owner,alice.id,'alice',oldPassword);const first=await login(db,'alice',oldPassword,'a');linked(sql,alice.id);
  await assert.rejects(changePassword(db,first.token,'incorrect',newPassword,'newalice'),{status:401});
  for(const table of tables)assert.equal(count(sql,table,alice.id),1,table);
  await changePassword(db,first.token,oldPassword,newPassword,'newalice');
  for(const table of tables)assert.equal(count(sql,table,alice.id),0,table);
  assert.equal(await session(db,first.token),null);
  assert.ok(sql.prepare("SELECT id FROM audit_events WHERE action='security.password.change'").get());
 }finally{sql.close();}
});
test('credential transaction failure preserves the account and all sessions',async()=>{
 const {db,sql,owner,alice,bob}=mailDatabase();try{
  linkedTables(sql);await setCredential(db,owner,alice.id,'alice',oldPassword);await setCredential(db,owner,bob.id,'bob',oldPassword);
  const first=await login(db,'alice',oldPassword,'a');linked(sql,alice.id);
  await assert.rejects(setCredential(db,owner,alice.id,'bob',newPassword));
  assert.equal((await session(db,first.token))?.id,alice.id);
  for(const table of tables)assert.equal(count(sql,table,alice.id),1,table);
 }finally{sql.close();}
});
test('suspending then reactivating a member never revives revoked sessions',async()=>{
 const {db,sql,owner,alice}=mailDatabase();try{
  linkedTables(sql);await setCredential(db,owner,alice.id,'alice',oldPassword);const first=await login(db,'alice',oldPassword,'a');linked(sql,alice.id);
  await db.batch([db.prepare("INSERT INTO member_controls(member_id,status,updated_at,updated_by) VALUES(?,'suspended',?,?)").bind(alice.id,Date.now(),owner.id),...await memberSessionRevocations(db,alice.id)]);
  sql.prepare("UPDATE member_controls SET status='active' WHERE member_id=?").run(alice.id);
  assert.equal(await session(db,first.token),null);for(const table of tables)assert.equal(count(sql,table,alice.id),0,table);
 }finally{sql.close();}
});
test('session revocation also works before optional service migrations exist',async()=>{
 const {db,sql,alice}=mailDatabase();try{
  for(const name of ['studio_access_sessions','heart_pair_codes','studio_pair_codes'])sql.exec('DROP TABLE IF EXISTS '+name);
  await db.batch(await memberSessionRevocations(db,alice.id));
 }finally{sql.close();}
});
test('ambiguous and encoded protected routes are rejected before routing',async()=>{
 for(const path of ['/a%70i/admin','/%61dmin','/api%2fadmin','//api/admin','/api/%252fadmin','/api/%00','/api/%5cadmin','/api/%ZZ']){
  assert.throws(()=>assertUnambiguousPath(new URL('https://server.test'+path)),{status:400},path);
 }
 for(const path of ['/api/admin','/api/studio/projects/123?x=%2F','/assets/un%20fichier.png'])assert.doesNotThrow(()=>assertUnambiguousPath(new URL('https://server.test'+path)));
 await assert.rejects(guardRequest(new Request('https://server.test/a%70i/admin'),{},()=>{throw Error('dispatched')}),{status:400});
});
test('forged provider identities are rejected on public Workers and Pages hosts',async()=>{
 const {db,sql,owner}=mailDatabase();try{
  for(const origin of ['https://warlike-server-runtime.warlikeofficiel.workers.dev','https://warlike-server.pages.dev','https://warlike-server.vikktor7.chatgpt.site.attacker.test']){
   const request=new Request(origin+'/api/admin',{headers:{'oai-authenticated-user-id':'auth-'+owner.id,'oai-authenticated-user-email':owner.email}});
   await assert.rejects(guardRequest(request,{DB:db,WARLIKE_OWNER_EMAIL:owner.email},()=>{throw Error('dispatched')}),{status:401});
  }
 }finally{sql.close();}
});
test('varying UUIDs and endpoints cannot evade shared request budgets',async()=>{
 const {db,sql}=mailDatabase();try{
  const base='https://server.test/api/studio/projects/';
  for(let i=0;i<90;i++)await limitApiRequest(db,'alice',new Request(base+crypto.randomUUID(),{method:'POST'}));
  await assert.rejects(limitApiRequest(db,'alice',new Request(base+crypto.randomUUID(),{method:'PUT'})),{status:429});
  await limitApiRequest(db,'bob',new Request(base+crypto.randomUUID(),{method:'POST'}));
  assert.equal(requestRateScope('GET',base+crypto.randomUUID()),requestRateScope('GET',base+crypto.randomUUID()));
 }finally{sql.close();}
});
test('over-budget authenticated writes are refused before reading their body',async()=>{
 const {db,sql,owner,alice}=mailDatabase();try{
  await setCredential(db,owner,alice.id,'alice',oldPassword);sql.prepare('UPDATE warlike_credentials SET must_change=0 WHERE member_id=?').run(alice.id);
  const first=await login(db,'alice',oldPassword,'a');for(let i=0;i<90;i++)await rateLimit(db,alice.id,'api:all-writes',90);
  let pulls=0;const body=new ReadableStream({pull(c){pulls++;c.enqueue(new Uint8Array(1024));}},{highWaterMark:0});
  const request=new Request('https://server.test/api/hub',{method:'POST',body,duplex:'half',headers:{cookie:'__Host-warlike_session='+first.token,origin:'https://server.test','content-type':'application/json'}} as RequestInit);
  await assert.rejects(guardRequest(request,{DB:db,WARLIKE_AUTH_ENABLED:'true'},()=>{throw Error('dispatched')}),{status:429});assert.equal(pulls,0);
 }finally{sql.close();}
});
test('HTTP privacy headers prevent account caches and retain existing Vary values',()=>{
 const request=new Request('https://server.test/api/admin');
 const r=secureResponse(new Response('{}',{headers:{Vary:'Accept-Encoding','Content-Type':'application/json',ETag:'old'}}),request);
 assert.equal(r.headers.get('X-Permitted-Cross-Domain-Policies'),'none');assert.equal(r.headers.get('X-Robots-Tag'),'noindex, nofollow, noarchive');
 for(const value of ['Accept-Encoding','Cookie','Authorization'])assert.ok(r.headers.get('Vary')!.includes(value));assert.equal(r.headers.get('ETag'),null);assert.equal(r.headers.get('Cache-Control'),'private, no-store');
});


test('expired rate windows are cleaned in bounded batches without deleting active limits',async()=>{
 const {db,sql}=mailDatabase();const saved=Math.random;try{
  const now=Date.now();for(let i=0;i<600;i++)sql.prepare('INSERT INTO security_windows(bucket,count,expires_at) VALUES(?,1,?)').run('expired-'+i,now-1000);
  Math.random=()=>0;await rateLimit(db,'active-user','active-budget',10,60,now);
  assert.equal(Number(sql.prepare('SELECT COUNT(*) AS n FROM security_windows WHERE expires_at<?').get(now)!.n),100);
  assert.equal(Number(sql.prepare('SELECT COUNT(*) AS n FROM security_windows WHERE expires_at>=?').get(now)!.n),1);
 }finally{Math.random=saved;sql.close();}
});
