import type {Principal} from './policy';
// Only call after Sites identity / the Mail bridge signature has been verified.
// Sites user IDs differ between applications; Mail must never replace the Hub ID.
export async function resolveMember(db:D1Database,auth:{userId:string;email:string;fullName:string|null},ownerEmail:string,fromMail:boolean){
 const email=auth.email.trim().toLowerCase();let user=fromMail?null:await db.prepare('SELECT * FROM members WHERE auth_id=?').bind(auth.userId).first<Principal>();
 if(!user){const invited=await db.prepare('SELECT * FROM members WHERE email=?').bind(email).first<Principal&{auth_id:string|null}>();
  if(invited&&(fromMail||email===ownerEmail&&invited.auth_id))user=invited;
  else if(invited){if(invited.auth_id&&invited.auth_id!==auth.userId)throw Error('Ce compte doit être relié par le propriétaire.');await db.prepare('UPDATE members SET auth_id=? WHERE id=? AND auth_id IS NULL').bind(auth.userId,invited.id).run();user=await db.prepare('SELECT * FROM members WHERE auth_id=?').bind(auth.userId).first<Principal>();}
  else{const id='WL-'+crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase();await db.prepare('INSERT OR IGNORE INTO members(id,auth_id,email,name,role,created_at) VALUES(?,?,?,?,?,?)').bind(id,fromMail?null:auth.userId,email,auth.fullName||email.split('@')[0],email===ownerEmail?'owner':'member',Date.now()).run();user=fromMail?await db.prepare('SELECT * FROM members WHERE email=?').bind(email).first<Principal>():await db.prepare('SELECT * FROM members WHERE auth_id=?').bind(auth.userId).first<Principal>();}
 }
 if(!user)throw Error('Compte indisponible.');if(email===ownerEmail&&user.role!=='owner'){await db.prepare("UPDATE members SET role='owner' WHERE id=?").bind(user.id).run();user.role='owner';}return {id:user.id,email:user.email,name:user.name,role:user.role};
}
