import type {Principal} from './policy.ts';
import {manager,text} from './policy.ts';
import {HttpError} from './security.ts';
import {digest} from './security-store.ts';

export type Thread={id:string;member_id:string;kind?:string;updated_at:number;folder?:string;starred?:number;send_fingerprint?:string|null};
// The same predicate protects thread metadata, message bodies and mutations.
export function scope(user:Principal){
 return {sql:"((c.kind='team' AND (?=1 OR c.member_id=?)) OR (c.kind='direct' AND EXISTS(SELECT 1 FROM conversation_participants p WHERE p.conversation_id=c.id AND p.member_id=?)))",values:[manager(user)?1:0,user.id,user.id]};
}
export async function accessibleThread(db:D1Database,user:Principal,id:string){
 const access=scope(user);
 const thread=await db.prepare(`SELECT c.* FROM conversations c WHERE c.id=? AND ${access.sql}`).bind(id,...access.values).first<Thread>();
 if(!thread)throw new HttpError(404,'Conversation inaccessible.');return thread;
}
export async function conversationState(db:D1Database,user:Principal){
 const access=scope(user);
 const conversations=(await db.prepare(`SELECT c.*,
  COALESCE(v.folder,c.folder) AS folder,COALESCE(v.starred,c.starred) AS starred,
  CASE WHEN v.read_at IS NOT NULL THEN v.read_at>=c.updated_at WHEN ?=1 THEN c.manager_read ELSE c.member_read END AS is_read,
  COALESCE((SELECT m.name FROM conversation_participants p JOIN members m ON m.id=p.member_id WHERE p.conversation_id=c.id AND p.member_id!=? LIMIT 1),m.name) AS member_name,
  COALESCE((SELECT b.address FROM conversation_participants p JOIN mailboxes b ON b.member_id=p.member_id WHERE p.conversation_id=c.id AND p.member_id!=? LIMIT 1),b.address,'') AS member_email,
  (SELECT substr(body,1,220) FROM messages WHERE conversation_id=c.id ORDER BY created_at DESC,id DESC LIMIT 1) AS preview,
  EXISTS(SELECT 1 FROM messages sm WHERE sm.conversation_id=c.id AND sm.author_id=?) AS has_sent
  FROM conversations c JOIN members m ON m.id=c.member_id LEFT JOIN mailboxes b ON b.member_id=m.id
  LEFT JOIN conversation_views v ON v.conversation_id=c.id AND v.member_id=?
  WHERE ${access.sql} ORDER BY c.updated_at DESC,c.id DESC LIMIT 500`).bind(manager(user)?1:0,user.id,user.id,user.id,user.id,...access.values).all<any>()).results;
 const messages=(await db.prepare(`SELECT mm.*,m.name AS author_name,b.address AS author_address FROM messages mm
  JOIN conversations c ON c.id=mm.conversation_id LEFT JOIN members m ON m.id=mm.author_id LEFT JOIN mailboxes b ON b.member_id=mm.author_id
  WHERE ${access.sql} ORDER BY mm.created_at DESC,mm.id DESC LIMIT 500`).bind(...access.values).all<any>()).results.reverse();
 return {conversations:conversations.map(c=>({...c,manager_read:c.is_read,member_read:c.is_read})),messages};
}
export async function updateView(db:D1Database,user:Principal,id:string,input:{read?:unknown;starred?:unknown;folder?:unknown},now=Date.now()){
 const thread=await accessibleThread(db,user,id);
 for(const key of ['read','starred'] as const)if(input[key]!==undefined&&typeof input[key]!=='boolean')throw new HttpError(400,'État invalide.');
 if(input.folder!==undefined&&!['inbox','archive','trash','sent'].includes(String(input.folder)))throw new HttpError(400,'Dossier invalide.');
 if(input.folder==='sent'&&!await db.prepare('SELECT id FROM messages WHERE conversation_id=? AND author_id=? LIMIT 1').bind(id,user.id).first())throw new HttpError(400,'Aucun message envoyé dans cette conversation.');
 await db.prepare(`INSERT INTO conversation_views(conversation_id,member_id,folder,starred,read_at)
  VALUES(?,?,COALESCE(?,?),COALESCE(?,?),?) ON CONFLICT(conversation_id,member_id) DO UPDATE SET
  folder=COALESCE(?,conversation_views.folder),starred=COALESCE(?,conversation_views.starred),read_at=COALESCE(?,conversation_views.read_at)`).bind(
  id,user.id,input.folder??null,thread.folder||'inbox',input.starred===undefined?null:input.starred?1:0,thread.starred||0,input.read===undefined?null:input.read?Math.max(now,thread.updated_at):0,
  input.folder??null,input.starred===undefined?null:input.starred?1:0,input.read===undefined?null:input.read?Math.max(now,thread.updated_at):0).run();
}
export async function replyToThread(db:D1Database,user:Principal,id:string,body:string,now=Date.now()){
 const thread=await accessibleThread(db,user,id),stamp=Math.max(now,thread.updated_at+1);
 await db.batch([
  db.prepare('INSERT INTO messages(id,conversation_id,author_id,body,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),id,user.id,body,stamp),
  db.prepare('UPDATE conversations SET updated_at=?,manager_read=?,member_read=? WHERE id=?').bind(stamp,manager(user)?1:0,manager(user)?0:1,id),
  // New mail returns an archived conversation to the inbox; a trashed one stays trashed.
  db.prepare("UPDATE conversation_views SET folder=CASE WHEN folder IN ('archive','sent') THEN 'inbox' ELSE folder END WHERE conversation_id=? AND member_id!=?").bind(id,user.id),
  db.prepare("INSERT INTO conversation_views(conversation_id,member_id,folder,starred,read_at) VALUES(?,?,'inbox',0,?) ON CONFLICT(conversation_id,member_id) DO UPDATE SET read_at=excluded.read_at").bind(id,user.id,stamp),
 ]);
}
export async function sendDirect(db:D1Database,user:Principal,input:{recipient:unknown;subject:unknown;body:unknown;clientKey:unknown;draftId?:unknown},now=Date.now()){
 const recipient=text(input.recipient,254,'Destinataire'),subject=text(input.subject,180,'Objet'),body=text(input.body,12000,'Message'),clientKey=text(input.clientKey,100,'Identifiant du message');
 if(!await db.prepare('SELECT member_id FROM mailboxes WHERE member_id=?').bind(user.id).first())throw new HttpError(409,'Active ta boîte dans Paramètres avant d’envoyer un message privé.');
 const target=await db.prepare(`SELECT m.id FROM members m JOIN mailboxes b ON b.member_id=m.id LEFT JOIN member_controls ctl ON ctl.member_id=m.id
  LEFT JOIN hub_memberships h ON h.member_id=m.id WHERE (m.id=? OR b.address=?) AND COALESCE(ctl.status,'active')='active'
  AND (m.role IN ('owner','referent') OR h.status='active' OR EXISTS(SELECT 1 FROM account_slots s WHERE s.member_id=m.id AND s.status='assigned'))`).bind(recipient,recipient.toLowerCase()).first<{id:string}>();
 if(!target)throw new HttpError(404,'Adresse WarLike indisponible ou membre non validé.');
 const fingerprint=await digest(JSON.stringify([user.id,target.id,subject,body])),id=await digest('WarLike direct / '+user.id+' / '+clientKey);
 if(input.draftId){const draft=await db.prepare('SELECT author_id FROM drafts WHERE id=?').bind(text(input.draftId,100)).first<{author_id:string}>();if(draft&&draft.author_id!==user.id)throw new HttpError(403,'Brouillon inaccessible.');}
 const statements=[db.prepare("INSERT OR IGNORE INTO conversations(id,member_id,subject,kind,send_fingerprint,manager_read,member_read,updated_at) VALUES(?,?,?,'direct',?,0,0,?)").bind(id,target.id,subject,fingerprint,now)];
 for(const member of new Set([user.id,target.id])){
  statements.push(db.prepare('INSERT OR IGNORE INTO conversation_participants(conversation_id,member_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM conversations WHERE id=? AND send_fingerprint=?)').bind(id,member,id,fingerprint));
  statements.push(db.prepare("INSERT OR IGNORE INTO conversation_views(conversation_id,member_id,folder,starred,read_at) SELECT ?,?,?,0,? WHERE EXISTS(SELECT 1 FROM conversations WHERE id=? AND send_fingerprint=?)").bind(id,member,member===user.id&&target.id!==user.id?'sent':'inbox',member===user.id?now:0,id,fingerprint));
 }
 statements.push(db.prepare('INSERT OR IGNORE INTO messages(id,conversation_id,author_id,body,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM conversations WHERE id=? AND send_fingerprint=?)').bind('send-'+id,id,user.id,body,now,id,fingerprint));
 if(input.draftId)statements.push(db.prepare("UPDATE drafts SET status='deleted',subject='',body='',revision=revision+1 WHERE id=? AND author_id=? AND EXISTS(SELECT 1 FROM conversations WHERE id=? AND send_fingerprint=?)").bind(String(input.draftId),user.id,id,fingerprint));
 await db.batch(statements);
 const saved=await db.prepare('SELECT send_fingerprint FROM conversations WHERE id=?').bind(id).first<{send_fingerprint:string}>();
 if(saved?.send_fingerprint!==fingerprint)throw new HttpError(409,'Cet identifiant de message a déjà été envoyé avec un autre contenu.');
 return id;
}
