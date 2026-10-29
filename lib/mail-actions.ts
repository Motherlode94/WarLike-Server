import {HttpError} from './security.ts';
export async function submitApplication(db:D1Database,memberId:string,apps:string[],body:string,now=Date.now()) {
 const rid=crypto.randomUUID(),tid=crypto.randomUUID();
 const results=await db.batch([
  db.prepare("INSERT INTO applications(id,member_id,targets,status,created_at) SELECT ?,?,?,'pending',? WHERE NOT EXISTS(SELECT 1 FROM applications WHERE member_id=? AND status='pending')").bind(rid,memberId,JSON.stringify(apps),now,memberId),
  db.prepare('INSERT INTO conversations(id,member_id,application_id,subject,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM applications WHERE id=?)').bind(tid,memberId,rid,'Inscription · '+apps.map(a=>a==='studio'?'WarLike Studio':'WarLike Engine').join(' + '),now,rid),
  db.prepare('INSERT INTO messages(id,conversation_id,author_id,body,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM conversations WHERE id=?)').bind(crypto.randomUUID(),tid,memberId,body,now,tid),
 ]);
 if(!results[0].meta.changes)throw new HttpError(409,'Une demande est déjà en attente.');
}
export async function saveDraft(db:D1Database,memberId:string,id:string,recipient:string,subject:string,body:string,now=Date.now(),expected?:number,kind='direct') {
 const old=await db.prepare('SELECT author_id,revision,status,recipient_id,subject,body,kind FROM drafts WHERE id=?').bind(id).first<{author_id:string;revision:number;status:string;recipient_id:string;subject:string;body:string;kind:string}>();
 if(old&&old.author_id!==memberId)throw new HttpError(403,'Brouillon inaccessible.');
 if(old){
  if(old.status==='active'&&old.recipient_id===recipient&&old.subject===subject&&old.body===body&&old.kind===kind)return old.revision;
  if(old.status!=='active'||!Number.isSafeInteger(expected)||expected!==old.revision)throw new HttpError(409,'Ce brouillon a changé dans une autre fenêtre ou a déjà été envoyé. Recharge-le avant de continuer.');
  const changed=await db.prepare("UPDATE drafts SET kind=?,recipient_id=?,subject=?,body=?,updated_at=?,revision=revision+1 WHERE id=? AND author_id=? AND revision=? AND status='active'").bind(kind,recipient,subject,body,now,id,memberId,expected).run();
  if(!changed.meta.changes)throw new HttpError(409,'Ce brouillon vient d’être modifié. Recharge-le avant de continuer.');
  return old.revision+1;
 }
 if(expected!==undefined&&expected!==0)throw new HttpError(409,'Le brouillon original est introuvable.');
 const created=await db.prepare("INSERT OR IGNORE INTO drafts(id,author_id,recipient_id,subject,body,updated_at,kind,revision,status) SELECT ?,?,?,?,?,?,?,1,'active' WHERE (SELECT COUNT(*) FROM drafts WHERE author_id=? AND status='active')<100").bind(id,memberId,recipient,subject,body,now,kind,memberId).run();
 if(!created.meta.changes)throw new HttpError(409,'Le brouillon existe déjà ou la limite de 100 brouillons est atteinte.');
 return 1;
}
export async function discardDraft(db:D1Database,memberId:string,id:string){await db.prepare("UPDATE drafts SET status='deleted',subject='',body='',revision=revision+1 WHERE id=? AND author_id=?").bind(id,memberId).run()}
