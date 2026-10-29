import {test} from 'node:test';import assert from 'node:assert/strict';
import {mailDatabase} from './mail-database.ts';
import {sendDirect,conversationState,accessibleThread,replyToThread,updateView} from '../lib/conversations.ts';
import {issueMailbox} from '../lib/mailbox-store.ts';
import {saveDraft,discardDraft} from '../lib/mail-actions.ts';
import {guardRequest} from '../lib/request-guard.ts';
import {HttpError} from '../lib/security.ts';
const denied=(e:unknown)=>e instanceof HttpError&&(e.status===403||e.status===404);
test('direct mail is visible only to its participants, including against owner and referent roles',async()=>{
 const f=mailDatabase();try{
  const {db,owner,alice,bob,referent,eve}=f;await issueMailbox(db,owner,alice,'Alice','Test');const box=await issueMailbox(db,owner,bob,'Bob','Test');
  const input={recipient:box.address,subject:'Un échange privé',body:'Seulement Alice et Bob.',clientKey:'private-one'};
  const id=await sendDirect(db,alice,input,1000);assert.equal((await conversationState(db,alice)).messages[0].body,input.body);assert.equal((await conversationState(db,bob)).conversations[0].member_name,'Alice');
  for(const other of [owner,referent,eve]){assert.equal((await conversationState(db,other)).conversations.length,0);assert.equal((await conversationState(db,other)).messages.length,0);await assert.rejects(()=>accessibleThread(db,other,id),denied);await assert.rejects(()=>replyToThread(db,other,id,'intrusion'),denied);await assert.rejects(()=>updateView(db,other,id,{folder:'trash'}),denied);}
  assert.equal(await sendDirect(db,alice,input,2000),id);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM messages').get()!.n,1);
  await assert.rejects(()=>sendDirect(db,alice,{...input,body:'Autre contenu'},3000),e=>e instanceof HttpError&&e.status===409);
 }finally{f.sql.close()}
});
test('folders, stars and read state are personal; replies preserve the other participant trash',async()=>{
 const f=mailDatabase();try{
  const {db,owner,alice,bob}=f;await issueMailbox(db,owner,alice,'Alice','Test');await issueMailbox(db,owner,bob,'Bob','Test');
  const id=await sendDirect(db,alice,{recipient:bob.id,subject:'Privé',body:'Bonjour',clientKey:'folders'},1000);
  assert.equal((await conversationState(db,bob)).conversations[0].is_read,0);
  await updateView(db,bob,id,{read:true,starred:true,folder:'trash'},2000);
  assert.equal((await conversationState(db,bob)).conversations[0].folder,'trash');assert.equal((await conversationState(db,alice)).conversations[0].folder,'sent');assert.equal((await conversationState(db,alice)).conversations[0].starred,0);
  await replyToThread(db,alice,id,'Un deuxième message',3000);const after=(await conversationState(db,bob)).conversations[0];assert.equal(after.is_read,0);assert.equal(after.folder,'trash');
  await assert.rejects(()=>updateView(db,bob,id,{folder:'sent'},3500),/Aucun message envoyé/);
  await updateView(db,alice,id,{folder:'trash'},3500);await updateView(db,alice,id,{folder:'sent'},3600);assert.equal((await conversationState(db,alice)).conversations[0].folder,'sent');
  await updateView(db,bob,id,{folder:'inbox'},4000);assert.equal((await conversationState(db,bob)).messages.length,2);
 }finally{f.sql.close()}
});
test('pending or suspended recipients cannot receive new private messages',async()=>{
 const f=mailDatabase();try{
  const {db,owner,alice,eve}=f;await issueMailbox(db,owner,alice,'Alice','Test');await issueMailbox(db,owner,eve,'Eve','Test');
  const input={recipient:eve.id,subject:'Privé',body:'Bonjour',clientKey:'pending'};await assert.rejects(()=>sendDirect(db,alice,input),denied);
  f.sql.prepare("UPDATE hub_memberships SET status='active' WHERE member_id=?").run(eve.id);f.sql.prepare('INSERT INTO member_controls(member_id,status,updated_at,updated_by) VALUES(?,?,?,?)').run(eve.id,'suspended',Date.now(),owner.id);
  await assert.rejects(()=>sendDirect(db,alice,input),denied);
 }finally{f.sql.close()}
});
test('draft revisions detect conflicting windows and sent/deleted drafts cannot be revived',async()=>{
 const f=mailDatabase();try{
  const {db,alice}=f;assert.equal(await saveDraft(db,alice.id,'draft-one','','Objet','Texte',1000,0),1);
  assert.equal(await saveDraft(db,alice.id,'draft-one','','Objet','Deuxième texte',2000,1),2);
  await assert.rejects(()=>saveDraft(db,alice.id,'draft-one','','Objet','Écriture obsolète',3000,1),e=>e instanceof HttpError&&e.status===409);
  await discardDraft(db,alice.id,'draft-one');await assert.rejects(()=>saveDraft(db,alice.id,'draft-one','','Objet','Réapparition',4000,2),e=>e instanceof HttpError&&e.status===409);
 }finally{f.sql.close()}
});
test('gateway blocks anonymous, pending, declined and suspended visitors on direct page/API paths',async()=>{
 const f=mailDatabase();try{
  const env={DB:f.db,WARLIKE_OWNER_EMAIL:f.owner.email};let dispatched=0;const run=async()=>{dispatched++;return new Response('private')};
  const headers=(u:typeof f.owner)=>({'oai-authenticated-user-id':'auth-'+u.id,'oai-authenticated-user-email':u.email});
  assert.equal((await guardRequest(new Request('https://example.test/pdf'),env,run)).status,303);
  for(const status of ['new','pending','declined']){f.sql.prepare('UPDATE hub_memberships SET status=? WHERE member_id=?').run(status,f.eve.id);await assert.rejects(()=>guardRequest(new Request('https://example.test/api/vault',{headers:headers(f.eve)}),env,run),denied);assert.equal((await guardRequest(new Request('https://example.test/extensions',{headers:headers(f.eve)}),env,run)).status,303);}
  assert.equal(dispatched,0);
  await guardRequest(new Request('https://example.test/pdf',{headers:headers(f.alice)}),env,run);assert.equal(dispatched,1);
  await assert.rejects(()=>guardRequest(new Request('https://example.test/api/admin',{headers:headers(f.alice)}),env,run),denied);
  f.sql.prepare('INSERT INTO member_controls(member_id,status,updated_at,updated_by) VALUES(?,?,?,?)').run(f.alice.id,'suspended',Date.now(),f.owner.id);
  await assert.rejects(()=>guardRequest(new Request('https://example.test/api/mail',{headers:headers(f.alice)}),env,run),denied);
  assert.equal((await guardRequest(new Request('https://example.test/serveur',{headers:headers(f.owner)}),env,run)).status,200);
 }finally{f.sql.close()}
});
