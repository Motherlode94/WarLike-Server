import {HttpError} from './security.ts';
import {digest,rateLimit} from './security-store.ts';
import type {Principal} from './policy.ts';

// Foundation for the future WarLike login. Nothing calls it from HTTP yet.
const ITERATIONS=600_000;
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
  const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unb64(salt),iterations,hash:'SHA-256'},key,256));
}
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
    db.prepare('INSERT INTO warlike_credentials(member_id,login,salt,verifier,iterations,version,updated_at) VALUES(?,?,?,?,?,1,?) ON CONFLICT(member_id) DO UPDATE SET login=excluded.login,salt=excluded.salt,verifier=excluded.verifier,iterations=excluded.iterations,version=warlike_credentials.version+1,updated_at=excluded.updated_at').bind(target.id,login,salt,verifier,ITERATIONS,now),
    db.prepare('DELETE FROM warlike_sessions WHERE member_id=?').bind(target.id),
  ]);
}
export async function login(db:D1Database,loginInput:unknown,password:unknown,clientId:string,now=Date.now()) {
  let loginName:string;try{loginName=normalizedLogin(loginInput)}catch{loginName='invalid-login'}
  await rateLimit(db,clientId,'warlike-login-client',25,900,now);
  await rateLimit(db,loginName,'warlike-login-account',5,900,now);
  const row=await db.prepare("SELECT c.*,m.role,COALESCE(ctl.status,'active') AS status FROM warlike_credentials c JOIN members m ON m.id=c.member_id LEFT JOIN member_controls ctl ON ctl.member_id=m.id WHERE c.login=?").bind(loginName).first<{member_id:string;salt:string;verifier:string;iterations:number;version:number;status:string}>();
  const supplied=typeof password==='string'&&password.length<=256?password:'';
  const salt=row?.salt||b64(new Uint8Array(32));
  const actual=await derive(supplied,salt,row?.iterations||ITERATIONS);
  const expected=row?unb64(row.verifier):new Uint8Array(32);
  if(!row||!equal(actual,expected)||row.status!=='active')throw new HttpError(401,'Identifiant ou mot de passe incorrect.');
  const token=b64(random(32)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  await db.prepare('INSERT INTO warlike_sessions(token_hash,member_id,credential_version,expires_at,created_at) VALUES(?,?,?,?,?)').bind(await digest(token),row.member_id,row.version,now+TTL,now).run();
  return {token,expiresAt:now+TTL};
}
export async function session(db:D1Database,token:unknown,now=Date.now()):Promise<Principal|null> {
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
  return await db.prepare("SELECT m.id,m.email,m.name,m.role FROM warlike_sessions s JOIN warlike_credentials c ON c.member_id=s.member_id AND c.version=s.credential_version JOIN members m ON m.id=s.member_id LEFT JOIN member_controls ctl ON ctl.member_id=m.id WHERE s.token_hash=? AND s.expires_at>? AND COALESCE(ctl.status,'active')='active'").bind(await digest(token),now).first<Principal>();
}
export async function logout(db:D1Database,token:unknown) {
  if(typeof token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(token))await db.prepare('DELETE FROM warlike_sessions WHERE token_hash=?').bind(await digest(token)).run();
}
