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
export async function saveDraft(db:D1Database,memberId:string,id:string,recipient:string,subject:string,body:string,now=Date.now()) {
 const result=await db.prepare('INSERT INTO drafts(id,author_id,recipient_id,subject,body,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET recipient_id=excluded.recipient_id,subject=excluded.subject,body=excluded.body,updated_at=excluded.updated_at WHERE drafts.author_id=excluded.author_id').bind(id,memberId,recipient,subject,body,now).run();
 if(!result.meta.changes)throw new HttpError(403,'Brouillon inaccessible.');
}
