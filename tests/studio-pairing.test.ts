import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mailDatabase} from './mail-database.ts';
import {sha256} from '../lib/heart-pairing.ts';
import {issueStudioCode,redeemStudioCode,studioPrincipal,revokeStudioToken,STUDIO_CODE_TTL} from '../lib/studio-pairing.ts';

test('Studio pairing is one-use and tied to PKCE verifier',async()=>{
 const {db,sql,alice}=mailDatabase();
 try{
  const verifier='v'.repeat(43),challenge=await sha256(verifier),now=Date.now();
  const code=await issueStudioCode(db,alice.id,challenge,now);
  assert.equal(await redeemStudioCode(db,code,'x'.repeat(43),now+1),null);
  const issued=await redeemStudioCode(db,code,verifier,now+2);
  assert.ok(issued?.token);
  assert.equal(await redeemStudioCode(db,code,verifier,now+3),null);
  assert.equal((await studioPrincipal(db,issued.token,now+4))?.id,alice.id);
  await revokeStudioToken(db,issued.token,now+5);
  assert.equal(await studioPrincipal(db,issued.token,now+6),null);
  const late=await issueStudioCode(db,alice.id,challenge,now);
  assert.equal(await redeemStudioCode(db,late,verifier,now+STUDIO_CODE_TTL+1),null);
 }finally{sql.close();}
});
test('Studio session denies suspended or expired members',async()=>{
 const {db,sql,alice}=mailDatabase();
 try{
  const verifier='z'.repeat(43),code=await issueStudioCode(db,alice.id,await sha256(verifier));
  const session=await redeemStudioCode(db,code,verifier);
  assert.ok(session?.token);
  await db.prepare("INSERT INTO member_controls(member_id,status,updated_at,updated_by) VALUES(?,'suspended',?,?)").bind(alice.id,Date.now(),alice.id).run();
  assert.equal(await studioPrincipal(db,session.token),null);
  assert.equal(await studioPrincipal(db,session.token,session.expiresAt+1),null);
 }finally{sql.close();}
});

test('resetting a password revokes Studio access and unused pairing codes',async()=>{
 const {setCredential}=await import('../lib/warlike-auth.ts');
 const {db,sql,owner,alice}=mailDatabase();try{
  await setCredential(db,owner,alice.id,'alice','ancien-mot-de-passe-valide');
  const verifier='v'.repeat(43),challenge=await sha256(verifier);
  const first=await issueStudioCode(db,alice.id,challenge),issued=await redeemStudioCode(db,first,verifier);assert.ok(issued);
  const pending=await issueStudioCode(db,alice.id,challenge);
  await setCredential(db,owner,alice.id,'alice','nouveau-mot-de-passe-valide');
  assert.equal(await studioPrincipal(db,issued.token),null);assert.equal(await redeemStudioCode(db,pending,verifier),null);
 }finally{sql.close();}
});
test('Studio bearer access cannot bypass service maintenance',async()=>{
 const {guardRequest}=await import('../lib/request-guard.ts');
 const {db,sql,owner,alice}=mailDatabase();try{
  const verifier='v'.repeat(43),code=await issueStudioCode(db,alice.id,await sha256(verifier)),issued=await redeemStudioCode(db,code,verifier);assert.ok(issued);
  sql.prepare("INSERT INTO service_settings(key,value,updated_at,updated_by) VALUES('maintenance',?,?,?)").run(JSON.stringify({enabled:true,message:'Maintenance'}),Date.now(),owner.id);
  await assert.rejects(guardRequest(new Request('https://server.test/api/studio/projects',{headers:{authorization:'Bearer '+issued.token}}),{DB:db},()=>{throw Error('dispatched')}),{status:503});
 }finally{sql.close();}
});
