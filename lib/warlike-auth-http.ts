import {HttpError,readJsonObject,errorResponse} from './security.ts';
import {login,logout,session,bootstrapOwner,setCredential,changePassword,mustChange,createMember,bootstrapTeam,checkKdf} from './warlike-auth.ts';
import {digest,rateLimit} from './security-store.ts';

// This adapter is not mounted until the surrounding access gateway is migrated.
const COOKIE='__Host-warlike_session';
const MAX_AGE=8*60*60;
export function tokenFrom(request:Request):string|null {
 const cookies=request.headers.get('cookie')?.split(';')||[];
 const values=cookies.map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));
 return values.length===1?values[0].slice(COOKIE.length+1):null;
}
function response(body:unknown,status=200,cookie?:string) {
 const headers=new Headers({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
 if(cookie)headers.set('Set-Cookie',cookie);
 return Response.json(body,{status,headers});
}
function ensureOrigin(request:Request) {
 const url=new URL(request.url);
 if(url.protocol!=='https:'||request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')throw new HttpError(403,'Origine refusée.');
}
export async function authHttp(request:Request,db:D1Database,clientId:string,setup?:{secret?:string;ownerEmail?:string}):Promise<Response> {
 try {
  const path=new URL(request.url).pathname;
  if(path==='/api/warlike-auth/session'&&request.method==='GET'){await rateLimit(db,clientId,'auth-session-read',120);const user=await session(db,tokenFrom(request));return response({user,mustChange:user?await mustChange(db,user.id):false});}
  if(request.method!=='POST')throw new HttpError(405,'Méthode non autorisée.');
  ensureOrigin(request);
  if(path==='/api/warlike-auth/logout'){
   await logout(db,tokenFrom(request));
   return response({ok:true},200,`${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  }
  if(path==='/api/warlike-auth/bootstrap'||path==='/api/warlike-auth/bootstrap-team'||path==='/api/warlike-auth/test-kdf'){
   await rateLimit(db,clientId,'warlike-bootstrap',5,900);
   const data=await readJsonObject(request,8192);
   const expected=setup?.secret||'';
   if(expected.length<32||typeof data.setupCode!=='string'||data.setupCode.length>256||!setup?.ownerEmail)throw new HttpError(403,'Initialisation indisponible.');
   // Compare a fixed-size digest, regardless of supplied code length.
   const a=await digest(expected),b=await digest(data.setupCode);let diff=0;
   for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
   if(diff!==0)throw new HttpError(403,'Initialisation indisponible.');
   if(path.endsWith('/test-kdf'))return response({ok:await checkKdf()});
   if(path.endsWith('/bootstrap-team')){
    if(!data.admin||!Array.isArray(data.members))throw new HttpError(400,'Liste des comptes invalide.');
    await bootstrapTeam(db,setup.ownerEmail,data.admin,data.members);
   }else await bootstrapOwner(db,setup.ownerEmail,data.login,data.password);
   return response({ok:true});
  }
  if(path==='/api/warlike-auth/credentials'){
   const actor=await session(db,tokenFrom(request));
   if(!actor||actor.role!=='owner'||await mustChange(db,actor.id))throw new HttpError(403,'Espace réservé au propriétaire.');
   await rateLimit(db,actor.id,'auth-account-management',10,900);
   const data=await readJsonObject(request,2048);
   if(typeof data.memberId!=='string'||data.memberId.length>100)throw new HttpError(400,'Membre invalide.');
   await setCredential(db,actor,data.memberId,data.login,data.password);
   return response({ok:true});
  }
  if(path==='/api/warlike-auth/member'){
   const actor=await session(db,tokenFrom(request));
   if(!actor||actor.role!=='owner'||await mustChange(db,actor.id))throw new HttpError(403,'Espace réservé au propriétaire.');
   await rateLimit(db,actor.id,'auth-account-management',10,900);
   const data=await readJsonObject(request,2048);
   return response(await createMember(db,actor,data.login,data.password,data.displayName),201);
  }
  if(path==='/api/warlike-auth/registration-request'){
   await rateLimit(db,clientId,'registration-request',3,3600);
   const d=await readJsonObject(request,2048);
   if(typeof d.name!=='string'||!d.name.trim()||d.name.length>80||typeof d.email!=='string'||d.email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()))throw new HttpError(400,'Nom ou adresse invalide.');
   await db.prepare("INSERT OR IGNORE INTO registration_requests(id,name,email,created_at) VALUES(?,?,?,?)").bind(crypto.randomUUID(),d.name.trim(),d.email.trim().toLowerCase(),Date.now()).run();
   return response({ok:true},202);
  }
  if(path==='/api/warlike-auth/registration-activate'){
   const actor=await session(db,tokenFrom(request));
   if(!actor||actor.role!=='owner'||await mustChange(db,actor.id))throw new HttpError(403,'Espace réservé au propriétaire.');
   await rateLimit(db,actor.id,'auth-account-management',10,900);
   const d=await readJsonObject(request,2048);
   if(typeof d.id!=='string'||!/^[0-9a-f-]{36}$/.test(d.id))throw new HttpError(400,'Demande invalide.');
   const row=await db.prepare("SELECT r.name FROM registration_requests r WHERE r.id=? AND r.status='accepted' AND NOT EXISTS(SELECT 1 FROM registration_activations a WHERE a.request_id=r.id)").bind(d.id).first<{name:string}>();
   if(!row)throw new HttpError(409,'Demande non acceptée ou déjà activée.');
   return response(await createMember(db,actor,d.login,d.password,row.name,Date.now(),d.id),201);
  }
  if(path==='/api/warlike-auth/registration-decision'){
   const actor=await session(db,tokenFrom(request));
   if(!actor||actor.role!=='owner'||await mustChange(db,actor.id))throw new HttpError(403,'Espace réservé au propriétaire.');
   await rateLimit(db,actor.id,'registration-decision',30,900);
   const d=await readJsonObject(request,2048);
   if(typeof d.id!=='string'||!/^[0-9a-f-]{36}$/.test(d.id)||(d.decision!=='accepted'&&d.decision!=='refused'))throw new HttpError(400,'Décision invalide.');
   const result=await db.prepare("UPDATE registration_requests SET status=?,decided_at=?,decided_by=? WHERE id=? AND status='pending'").bind(d.decision,Date.now(),actor.id,d.id).run();
   if(result.meta.changes!==1)throw new HttpError(409,'Demande absente ou déjà traitée.');
   return response({ok:true,status:d.decision});
  }
  if(path==='/api/warlike-auth/registration-list'){
   const actor=await session(db,tokenFrom(request));
   if(!actor||actor.role!=='owner'||await mustChange(db,actor.id))throw new HttpError(403,'Espace réservé au propriétaire.');
   const rows=await db.prepare("SELECT r.id,r.name,r.email,r.created_at,CASE WHEN a.member_id IS NOT NULL THEN 'activated' ELSE r.status END AS status,r.decided_at,r.decided_by,a.member_id,a.activated_at,CASE WHEN a.member_id IS NOT NULL THEN COALESCE(c.status,'active') ELSE NULL END AS account_status FROM registration_requests r LEFT JOIN registration_activations a ON a.request_id=r.id LEFT JOIN member_controls c ON c.member_id=a.member_id ORDER BY (r.status='pending') DESC,r.created_at DESC LIMIT 100").all();
   return response({requests:rows.results});
  }
  if(path==='/api/warlike-auth/password'){
   const data=await readJsonObject(request,2048);
   await changePassword(db,tokenFrom(request),data.currentPassword,data.newPassword,data.newLogin);
   return response({ok:true},200,`${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  }
  if(path!=='/api/warlike-auth/login')throw new HttpError(404,'Route introuvable.');
  const data=await readJsonObject(request,2048);
  const result=await login(db,data.login,data.password,clientId);
  return response({ok:true,mustChange:result.mustChange},200,`${COOKIE}=${result.token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`);
 }catch(e){return errorResponse(e);}
}
