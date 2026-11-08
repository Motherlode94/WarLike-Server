import {HttpError} from './security.ts';
import {digest,rateLimit} from './security-store.ts';
import type {Principal} from './policy.ts';
import {generatedPassword,passwordRecord,PASSWORD_ITERATIONS} from './mailbox-policy.ts';
import {scryptSync} from 'node:crypto';

// Foundation for the future WarLike login. Nothing calls it from HTTP yet.
// scrypt N=2^14, r=8, p=5 (16 MiB); supported by Workers node:crypto.
const ITERATIONS=16_384;
const TTL=8*60*60*1000;
const enc=new TextEncoder();
const b64=(b:Uint8Array)=>btoa(Array.from(b,n=>String.fromCharCode(n)).join(''));
const unb64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const random=(n:number)=>crypto.getRandomValues(new Uint8Array(n));
export function normalizedLogin(value:unknown):string {
  if(typeof value!=='string') throw new HttpError(400,'Identifiant invalide.');
  const login=value.trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9._@-]{2,253}$/.test(login)) throw new HttpError(400,'Identifiant invalide.');
  return login;
}
async function derive(password:string,salt:string,iterations:number):Promise<Uint8Array> {
  if(iterations!==ITERATIONS)throw new Error('Paramètres de mot de passe non reconnus.');
  return new Uint8Array(scryptSync(password,unb64(salt),32,{N:iterations,r:8,p:5,maxmem:64*1024*1024}));
}
export async function checkKdf():Promise<boolean>{return (await derive('warlike-kdf-check',b64(new Uint8Array(32)),ITERATIONS)).length===32;}
function validPassword(value:unknown):value is string {
  return typeof value==='string'&&value.length>=12&&value.length<=256&&enc.encode(value).length<=1024;
}
function equal(a:Uint8Array,b:Uint8Array):boolean {
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
export async function setCredential(db:D1Database,actor:Principal,targetId:string,loginInput:unknown,password:unknown,now=Date.now()) {
  if(actor.role!=='owner')throw new HttpError(403,'Seul le propriétaire peut gérer les comptes.');
  if(!validPassword(password))throw new HttpError(400,'Le mot de passe doit contenir entre 12 et 256 caractères.');
  const target=await db.prepare('SELECT id,role FROM members WHERE id=?').bind(targetId).first<{id:string;role:string}>();
  if(!target)throw new HttpError(404,'Membre introuvable.');
  if(target.role==='owner'&&actor.id!==target.id)throw new HttpError(403,'Compte propriétaire protégé.');
  const login=normalizedLogin(loginInput),salt=b64(random(32)),verifier=b64(await derive(password,salt,ITERATIONS));
  await db.batch([
    db.prepare('INSERT INTO warlike_credentials(member_id,login,salt,verifier,iterations,version,updated_at,must_change) VALUES(?,?,?,?,?,1,?,1) ON CONFLICT(member_id) DO UPDATE SET login=excluded.login,salt=excluded.salt,verifier=excluded.verifier,iterations=excluded.iterations,version=warlike_credentials.version+1,must_change=1,updated_at=excluded.updated_at').bind(target.id,login,salt,verifier,ITERATIONS,now),
    db.prepare('DELETE FROM warlike_sessions WHERE member_id=?').bind(target.id),
  ]);
}
// One-time setup only: never overwrites an existing owner's credentials.
export async function bootstrapOwner(db:D1Database,ownerEmail:string,loginInput:unknown,password:unknown,now=Date.now()) {
 if(!validPassword(password))throw new HttpError(400,'Le mot de passe doit contenir entre 12 et 256 caractères.');
 const owner=await db.prepare("SELECT id FROM members WHERE email=? AND role='owner'").bind(ownerEmail.trim().toLowerCase()).first<{id:string}>();
 if(!owner)throw new HttpError(409,'Compte propriétaire existant introuvable.');
 const name=normalizedLogin(loginInput),salt=b64(random(32)),verifier=b64(await derive(password,salt,ITERATIONS));
 const result=await db.prepare('INSERT OR IGNORE INTO warlike_credentials(member_id,login,salt,verifier,iterations,version,updated_at) VALUES(?,?,?,?,?,1,?)').bind(owner.id,name,salt,verifier,ITERATIONS,now).run();
 if(!result.meta.changes)throw new HttpError(409,'Initialisation déjà effectuée ou identifiant indisponible.');
}
export async function createMember(db:D1Database,actor:Principal,loginInput:unknown,password:unknown,displayName:unknown,now=Date.now()) {
 if(actor.role!=='owner')throw new HttpError(403,'Seul le propriétaire peut créer les comptes.');
 if(!validPassword(password)||typeof displayName!=='string'||!displayName.trim()||displayName.length>80)throw new HttpError(400,'Nom ou mot de passe invalide.');
 const login=normalizedLogin(loginInput);
 if(!/^[a-z0-9][a-z0-9._-]{2,50}$/.test(login))throw new HttpError(400,'Identifiant de membre invalide.');
 const memberId='WL-'+crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase();
 const email=login+'@warlike.local',address=login+'@warlike.maill.dev';
 const salt=b64(random(32)),verifier=b64(await derive(password,salt,ITERATIONS));
 const mailbox=await passwordRecord(generatedPassword(),memberId);
 await db.batch([
  db.prepare("INSERT INTO members(id,email,name,role,created_at) VALUES(?,?,?,'member',?)").bind(memberId,email,displayName.trim(),now),
  db.prepare("INSERT INTO hub_memberships(member_id,status,display_name,goal,interests,created_at,updated_at,decided_by,decision_note) VALUES(?,'active',?,'Compte créé par le propriétaire','[\"mail\"]',?,?,?,'Compte standard')").bind(memberId,displayName.trim(),now,now,actor.id),
  db.prepare('INSERT INTO warlike_credentials(member_id,login,salt,verifier,iterations,version,must_change,updated_at) VALUES(?,?,?,?,?,1,1,?)').bind(memberId,login,salt,verifier,ITERATIONS,now),
  db.prepare('INSERT INTO mailboxes(member_id,address,given_name,family_name,salt,verifier,iterations,credential_version,updated_at) VALUES(?,?,?,?,?,?,?,1,?)').bind(memberId,address,displayName.trim(),'WarLike',mailbox.salt,mailbox.verifier,PASSWORD_ITERATIONS,now),
  db.prepare('INSERT INTO audit_events(id,actor_id,action,target_id,detail,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor.id,'warlike.member.create',memberId,'Compte membre créé',now),
 ]);
 return {memberId,address};
}
export async function bootstrapTeam(db:D1Database,ownerEmail:string,admin:{login:unknown;password:unknown},members:Array<{login:unknown;password:unknown;displayName:unknown}>,now=Date.now()) {
 if(members.length!==9||!validPassword(admin.password))throw new HttpError(400,'Données de configuration invalides.');
 const owner=await db.prepare("SELECT id FROM members WHERE email=? AND role='owner'").bind(ownerEmail.trim().toLowerCase()).first<{id:string}>();
 if(!owner)throw new HttpError(409,'Compte propriétaire existant introuvable.');
 const loginName=normalizedLogin(admin.login),salt=b64(random(32)),verifier=b64(await derive(admin.password,salt,ITERATIONS));
 const statements=[db.prepare('INSERT INTO warlike_credentials(member_id,login,salt,verifier,iterations,version,must_change,updated_at) VALUES(?,?,?,?,?,1,1,?)').bind(owner.id,loginName,salt,verifier,ITERATIONS,now)];
 for(const member of members){
  if(!validPassword(member.password)||typeof member.displayName!=='string'||!member.displayName.trim()||member.displayName.length>80)throw new HttpError(400,'Compte collaborateur invalide.');
  const login=normalizedLogin(member.login);if(!/^[a-z0-9][a-z0-9._-]{2,50}$/.test(login))throw new HttpError(400,'Identifiant de membre invalide.');
  const id='WL-'+crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase(),name=member.displayName.trim();
  const s=b64(random(32)),v=b64(await derive(member.password,s,ITERATIONS)),box=await passwordRecord(generatedPassword(),id);
  statements.push(
   db.prepare("INSERT INTO members(id,email,name,role,created_at) VALUES(?,?,?,'member',?)").bind(id,login+'@warlike.local',name,now),
   db.prepare("INSERT INTO hub_memberships(member_id,status,display_name,goal,interests,created_at,updated_at,decided_by,decision_note) VALUES(?,'active',?,'Compte créé par le propriétaire','[\"mail\"]',?,?,?,'Compte standard')").bind(id,name,now,now,owner.id),
   db.prepare('INSERT INTO warlike_credentials(member_id,login,salt,verifier,iterations,version,must_change,updated_at) VALUES(?,?,?,?,?,1,1,?)').bind(id,login,s,v,ITERATIONS,now),
   db.prepare('INSERT INTO mailboxes(member_id,address,given_name,family_name,salt,verifier,iterations,credential_version,updated_at) VALUES(?,?,?,?,?,?,?,1,?)').bind(id,login+'@warlike.maill.dev',name,'WarLike',box.salt,box.verifier,PASSWORD_ITERATIONS,now),
   db.prepare('INSERT INTO audit_events(id,actor_id,action,target_id,detail,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),owner.id,'warlike.member.create',id,'Compte membre créé',now),
  );
 }
 await db.batch(statements);
}
export async function login(db:D1Database,loginInput:unknown,password:unknown,clientId:string,now=Date.now()) {
  let loginName:string;try{loginName=normalizedLogin(loginInput)}catch{loginName='invalid-login'}
  await rateLimit(db,clientId,'warlike-login-client',25,900,now);
  await rateLimit(db,loginName,'warlike-login-account',5,900,now);
  const row=await db.prepare("SELECT c.*,m.role,COALESCE(ctl.status,'active') AS status FROM warlike_credentials c JOIN members m ON m.id=c.member_id LEFT JOIN member_controls ctl ON ctl.member_id=m.id WHERE c.login=?").bind(loginName).first<{member_id:string;salt:string;verifier:string;iterations:number;version:number;status:string;must_change:number}>();
  const supplied=typeof password==='string'&&password.length<=256?password:'';
  const salt=row?.salt||b64(new Uint8Array(32));
  const actual=await derive(supplied,salt,row?.iterations||ITERATIONS);
  const expected=row?unb64(row.verifier):new Uint8Array(32);
  if(!row||!equal(actual,expected)||row.status!=='active')throw new HttpError(401,'Identifiant ou mot de passe incorrect.');
  const token=b64(random(32)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  await db.prepare('INSERT INTO warlike_sessions(token_hash,member_id,credential_version,expires_at,created_at) VALUES(?,?,?,?,?)').bind(await digest(token),row.member_id,row.version,now+TTL,now).run();
  return {token,expiresAt:now+TTL,mustChange:row.must_change===1};
}
export async function mustChange(db:D1Database,memberId:string):Promise<boolean> {
 const row=await db.prepare('SELECT must_change FROM warlike_credentials WHERE member_id=?').bind(memberId).first<{must_change:number}>();return row?.must_change!==0;
}
export async function session(db:D1Database,token:unknown,now=Date.now()):Promise<Principal|null> {
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
  return await db.prepare("SELECT m.id,m.email,m.name,m.role FROM warlike_sessions s JOIN warlike_credentials c ON c.member_id=s.member_id AND c.version=s.credential_version JOIN members m ON m.id=s.member_id LEFT JOIN member_controls ctl ON ctl.member_id=m.id WHERE s.token_hash=? AND s.expires_at>? AND COALESCE(ctl.status,'active')='active'").bind(await digest(token),now).first<Principal>();
}
export async function logout(db:D1Database,token:unknown) {
  if(typeof token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(token))await db.prepare('DELETE FROM warlike_sessions WHERE token_hash=?').bind(await digest(token)).run();
}
export async function changePassword(db:D1Database,token:unknown,current:unknown,next:unknown,newLogin?:unknown,now=Date.now()) {
 const user=await session(db,token,now);if(!user)throw new HttpError(401,'Connexion requise.');
 await rateLimit(db,user.id,'warlike-password-change',5,900,now);
 if(!validPassword(next))throw new HttpError(400,'Le mot de passe doit contenir entre 12 et 256 caractères.');
 const row=await db.prepare('SELECT login,salt,verifier,iterations,version,must_change FROM warlike_credentials WHERE member_id=?').bind(user.id).first<{login:string;salt:string;verifier:string;iterations:number;version:number;must_change:number}>();
 if(!row||typeof current!=='string'||current.length>256||!equal(await derive(current,row.salt,row.iterations),unb64(row.verifier)))throw new HttpError(401,'Mot de passe actuel incorrect.');
 const loginName=newLogin===undefined||newLogin===''?row.login:normalizedLogin(newLogin);
 if(row.must_change===1&&loginName===row.login)throw new HttpError(400,'Choisis un nouvel identifiant.');
 if(current===next)throw new HttpError(400,'Choisis un nouveau mot de passe.');
 const collision=await db.prepare('SELECT member_id FROM warlike_credentials WHERE login=? AND member_id<>?').bind(loginName,user.id).first();
 if(collision)throw new HttpError(409,'Cet identifiant est déjà utilisé.');
 const salt=b64(random(32)),verifier=b64(await derive(next,salt,ITERATIONS));
 const updated=await db.prepare('UPDATE warlike_credentials SET login=?,salt=?,verifier=?,iterations=?,version=version+1,must_change=0,updated_at=? WHERE member_id=? AND version=?').bind(loginName,salt,verifier,ITERATIONS,now,user.id,row.version).run();
 if(!updated.meta.changes)throw new HttpError(409,'Les identifiants ont changé ; reconnecte-toi.');
 // All sessions are invalid immediately through the credential version check.
 await db.prepare('DELETE FROM warlike_sessions WHERE member_id=?').bind(user.id).run();
}
