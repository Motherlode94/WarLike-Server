import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mailDatabase} from './mail-database.ts';
import {sha256,createCode,exchangeCode,validChallenge,validState,CODE_TTL} from '../lib/heart-pairing.ts';

test('one-time PKCE code expires, requires verifier, is consumed once',async()=>{
 const {db,sql,alice}=mailDatabase();
 try{
  const verifier='a'.repeat(43),challenge=await sha256(verifier),now=Date.now();
  assert.equal(validChallenge(challenge),true);
  assert.equal(validState('b'.repeat(32)),true);
  const code=await createCode(db,alice.id,challenge,now);
  assert.equal((await exchangeCode(db,code,'c'.repeat(43),now+1000)),null);
  assert.deepEqual(await exchangeCode(db,code,verifier,now+1000),{id:alice.id,name:alice.name,role:alice.role});
  assert.equal(await exchangeCode(db,code,verifier,now+2000),null);
  const another=await createCode(db,alice.id,challenge,now);
  assert.equal(await exchangeCode(db,another,verifier,now+CODE_TTL+1),null);
 }finally{sql.close();}
});
test('no pairing for inactive member',async()=>{
 const {db,sql,alice}=mailDatabase();
 try{
  const verifier='z'.repeat(43),code=await createCode(db,alice.id,await sha256(verifier));
  await db.prepare("INSERT INTO member_controls(member_id,status,updated_at,updated_by) VALUES(?,'suspended',?,?)").bind(alice.id,Date.now(),alice.id).run();
  assert.equal(await exchangeCode(db,code,verifier),null);
 }finally{sql.close();}
});
