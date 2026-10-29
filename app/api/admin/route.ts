import {HttpError,readJsonObject,errorResponse} from '@/lib/security';
import {database,identity,HOSTED_ORIGIN} from '@/lib/mail';
import {assertOrigin,roleChange,targets,text,email,newMemberId,type Principal} from '@/lib/policy';
import {AdminAccessError,assertAccountControl,assertManager,assertServiceControl,accountTemplates} from '@/lib/admin-policy';
import {adminState} from '@/lib/admin-store';
export const dynamic='force-dynamic';
const result=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const failure=errorResponse;
export async function GET(){try{const user=await identity();if(!user)return result({error:'Connexion requise.'},401);assertManager(user);return result(await adminState(database(),user))}catch(e){return failure(e)}}
export async function POST(request:Request){
 try{assertOrigin(request.headers.get('origin'),request.url,HOSTED_ORIGIN)}catch{return result({error:'Origine refusée.'},403)}
 try{
  const user=await identity();if(!user)return result({error:'Connexion requise.'},401);assertManager(user);const data=await readJsonObject(request,8192);
  const db=database(),now=Date.now(),statements:D1PreparedStatement[]=[];let targetId='server',detail='';
  if(data.action==='provision'){
   assertServiceControl(user);for(const slot of accountTemplates())statements.push(db.prepare("INSERT OR IGNORE INTO account_slots(id,template_key,name,role,status,created_at,created_by) VALUES(?,?,?,?,'prepared',?,?)").bind(newMemberId(),slot.key,slot.name,slot.role,now,user.id));detail='5 profils testeurs et 4 profils approbateurs préparés, sans accès actif.';
  }else if(data.action==='assign'){
   assertServiceControl(user);const slotId=text(data.slotId,100),address=email(data.email),slot=await db.prepare('SELECT * FROM account_slots WHERE id=?').bind(slotId).first<any>();if(!slot||slot.status!=='prepared')return result({error:'Ce compte a déjà été attribué ou est introuvable.'},409);const existing=await db.prepare('SELECT id,email,name,role FROM members WHERE email=?').bind(address).first<Principal>();if(existing)assertAccountControl(user,existing);targetId=existing?.id||slot.id;
   if(await db.prepare("SELECT id FROM account_slots WHERE status='assigned' AND email=?").bind(address).first())return result({error:'Cette adresse est déjà associée à un profil.'},409);
   const role=slot.role==='referent'?'referent':'member';
   if(existing)statements.push(db.prepare("UPDATE members SET role=? WHERE id=? AND role!='owner' AND EXISTS(SELECT 1 FROM account_slots WHERE id=? AND status='prepared')").bind(role,targetId,slotId));
   else statements.push(db.prepare("INSERT INTO members(id,email,name,role,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM account_slots WHERE id=? AND status='prepared')").bind(targetId,address,slot.name,role,now,slotId));
   statements.push(db.prepare("UPDATE account_slots SET status='assigned',email=?,member_id=? WHERE id=? AND status='prepared'").bind(address,targetId,slotId));detail=slot.name+' associé à un compte authentifié lors de sa prochaine connexion.';
  }else if(data.action==='maintenance'){
   assertServiceControl(user);if(typeof data.enabled!=='boolean')return result({error:'État de maintenance invalide.'},400);const message=typeof data.message==='string'?data.message.trim().slice(0,240):'';statements.push(db.prepare("INSERT INTO service_settings(key,value,updated_at,updated_by) VALUES('maintenance',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(JSON.stringify({enabled:data.enabled,message}),now,user.id));detail=data.enabled?'Maintenance activée'+(message?' · '+message:''):'Service réouvert';
  }else{
   targetId=text(data.memberId,100,'Identifiant');const target=await db.prepare('SELECT id,email,name,role FROM members WHERE id=?').bind(targetId).first<Principal>();if(!target)return result({error:'Membre introuvable.'},404);assertAccountControl(user,target);
   if(data.action==='status'){
    if(!['active','suspended'].includes(data.status))return result({error:'État invalide.'},400);statements.push(db.prepare('INSERT INTO member_controls(member_id,status,updated_at,updated_by) VALUES(?,?,?,?) ON CONFLICT(member_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at,updated_by=excluded.updated_by').bind(targetId,data.status,now,user.id));detail=data.status==='suspended'?'Compte suspendu':'Compte réactivé';
   }else if(data.action==='role'){
    let role:string;try{role=roleChange(user,target,data.role)}catch(e){throw new AdminAccessError((e as Error).message,403)}statements.push(db.prepare("UPDATE members SET role=? WHERE id=? AND role!='owner'").bind(role,targetId));detail=role==='referent'?'Référent désigné':'Rôle membre rétabli';
   }else if(data.action==='grant'){
    const site=targets([data.site])[0];if(!['active','revoked'].includes(data.status))return result({error:'Autorisation invalide.'},400);statements.push(db.prepare('INSERT INTO grants(id,member_id,site,status,updated_at,updated_by) VALUES(?,?,?,?,?,?) ON CONFLICT(member_id,site) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at,updated_by=excluded.updated_by').bind(crypto.randomUUID(),targetId,site,data.status,now,user.id));detail=site+' · '+(data.status==='active'?'autorisation accordée':'autorisation révoquée');
   }else return result({error:'Action inconnue.'},400);
  }
  statements.push(db.prepare('INSERT INTO audit_events(id,actor_id,action,target_id,detail,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),user.id,data.action,targetId,detail,now));await db.batch(statements);return result(await adminState(db,user));
 }catch(e){return failure(e)}
}
