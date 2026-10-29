import {test} from 'node:test';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';import {readFileSync,readdirSync} from 'node:fs';
import {issueMailbox,loginMailbox,hasMailboxAccess} from '../lib/mailbox-store.ts';
import {submitApplication,saveDraft} from '../lib/mail-actions.ts';
import {HttpError} from '../lib/security.ts';
function database(){
 const sql=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const adapter:any={prepare(query:string){let args:any[]=[];const s:any={bind(...values:any[]){args=values;return s},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}}}};return s},async batch(statements:any[]){sql.exec('BEGIN IMMEDIATE');try{const r=[];for(const s of statements)r.push(await s.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
 const owner={id:'WL-OWNER',email:'owner@example.test',name:'Owner',role:'owner'},alice={id:'WL-ALICE',email:'alice@example.test',name:'Alice',role:'member'},bob={id:'WL-BOB',email:'bob@example.test',name:'Bob',role:'member'},referent={id:'WL-REFERENT',email:'referent@example.test',name:'Referent',role:'referent'};
 for(const u of [owner,alice,bob,referent])sql.prepare('INSERT INTO members(id,email,name,role,created_at) VALUES(?,?,?,?,?)').run(u.id,u.email,u.name,u.role,Date.now());
 return {db:adapter as D1Database,sql,owner,alice,bob,referent};
}
test('actual migrations and SQL enforce private, revocable mailbox credentials',async()=>{
 const {db,sql,owner,alice,bob,referent}=database();
 try{
  const issued=await issueMailbox(db,owner,alice,'Élodie','Dangelo');assert.equal(issued.address,'elodie.dangelo@warlike.maill.dev');
  assert.equal(JSON.stringify(sql.prepare('SELECT * FROM mailboxes').all()).includes(issued.password),false);
  assert.equal(await hasMailboxAccess(db,alice),false);
  await assert.rejects(()=>loginMailbox(db,bob,issued.address,issued.password),e=>e instanceof HttpError&&e.status===401);
  const token=await loginMailbox(db,alice,issued.address,issued.password);assert.equal(await hasMailboxAccess(db,alice,token),true);
  const second=await issueMailbox(db,owner,bob,'Élodie','Dangelo');assert.notEqual(second.address,issued.address);
  assert.equal(await hasMailboxAccess(db,bob,token),false);
  assert.equal(JSON.stringify(sql.prepare('SELECT * FROM mailbox_sessions').all()).includes(token),false);
  await assert.rejects(()=>issueMailbox(db,referent,owner,'Owner','Person'),e=>e instanceof HttpError&&e.status===403);
  await issueMailbox(db,owner,alice,'Élodie','Dangelo');assert.equal(await hasMailboxAccess(db,alice,token),false);
  await assert.rejects(()=>loginMailbox(db,alice,issued.address,issued.password),e=>e instanceof HttpError&&e.status===401);
 }finally{sql.close()}
});
test('actual SQL prevents duplicate pending applications and cross-member draft replacement',async()=>{
 const {db,sql,alice,bob}=database();
 try{
  await submitApplication(db,alice.id,['studio','engine'],'Bonjour');
  await assert.rejects(()=>submitApplication(db,alice.id,['studio'],'Doublon'),e=>e instanceof HttpError&&e.status===409);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,1);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM conversations').get()!.n,1);
  await saveDraft(db,alice.id,'draft-private','','Objet','Contenu privé');
  await assert.rejects(()=>saveDraft(db,bob.id,'draft-private','','Autre','Écrasé'),e=>e instanceof HttpError&&e.status===403);
  assert.equal(sql.prepare('SELECT body FROM drafts WHERE id=?').get('draft-private')!.body,'Contenu privé');
 }finally{sql.close()}
});
