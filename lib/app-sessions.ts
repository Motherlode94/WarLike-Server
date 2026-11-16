import {sha256,validChallenge} from './heart-pairing.ts';
import {allowedAppRole,suiteApplications,type SuiteApp,type SuiteRole} from './app-contract.ts';
import {HttpError} from './security.ts';
import type {Principal} from './policy.ts';
export const APP_CODE_TTL=120_000, APP_SESSION_TTL=8*3600_000;
const random=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export type AppPrincipal=Principal&{appRole:SuiteRole;credentialVersion:number;accessVersion:number};
// Native credentials, active hub membership, suspension and current application
// rights are resolved from D1. Browser-provided identity/role fields are never used.
const joins=`FROM members m JOIN warlike_credentials c ON c.member_id=m.id
 LEFT JOIN member_controls ctl ON ctl.member_id=m.id
 LEFT JOIN hub_memberships h ON h.member_id=m.id
 LEFT JOIN app_memberships a ON a.member_id=m.id AND a.app_id=?`;
const active=`c.must_change=0 AND COALESCE(ctl.status,'active')='active'
 AND (m.role='owner' OR h.status='active') AND (m.role='owner' OR a.status='active')`;
const accessVersion=`CASE WHEN m.role='owner' THEN 0 ELSE a.version END`;
export async function appMember(db:D1Database,app:SuiteApp,memberId:string):Promise<AppPrincipal|null>{
 const row=await db.prepare(`SELECT m.id,m.email,m.name,m.role,c.version AS credentialVersion,
 ${accessVersion} AS accessVersion,CASE WHEN m.role='owner' THEN ? ELSE a.role END AS appRole ${joins} WHERE m.id=? AND ${active}`)
 .bind(app==='academy'?'editor':'member',app,memberId).first<AppPrincipal>();
 return row;
}
export async function issueAppCode(db:D1Database,app:SuiteApp,user:Principal,challenge:unknown,now=Date.now()){
 if(!validChallenge(challenge))throw new HttpError(400,'Challenge PKCE invalide.');
 const code=random(),hash=await sha256(code);
 const results=await db.batch([db.prepare(`INSERT INTO app_pair_codes(code_hash,app_id,member_id,origin,challenge,credential_version,access_version,expires_at,created_at)
 SELECT ?,?,m.id,?,?,c.version,${accessVersion},?,? ${joins} WHERE m.id=? AND ${active}`)
 .bind(hash,app,suiteApplications[app].origin,challenge,now+APP_CODE_TTL,now,app,user.id),
  db.prepare('DELETE FROM app_pair_codes WHERE code_hash IN (SELECT code_hash FROM app_pair_codes WHERE expires_at<=? LIMIT 100)').bind(now),
  db.prepare('DELETE FROM app_access_sessions WHERE token_hash IN (SELECT token_hash FROM app_access_sessions WHERE expires_at<=? LIMIT 100)').bind(now),
 ]);
 if(!results[0].meta.changes)throw new HttpError(403,'Accès à cette application non autorisé ou identifiants temporaires à remplacer.');
 return code;
}
export async function exchangeAppCode(db:D1Database,app:SuiteApp,code:unknown,verifier:unknown,now=Date.now()){
 if(!validChallenge(code)||typeof verifier!=='string'||!/^[A-Za-z0-9_-]{43,128}$/.test(verifier))return null;
 const token=random(),tokenHash=await sha256(token),codeHash=await sha256(code),challenge=await sha256(verifier);
 const eligible=`EXISTS(SELECT 1 ${joins} WHERE m.id=app_pair_codes.member_id AND ${active}
 AND c.version=app_pair_codes.credential_version AND ${accessVersion}=app_pair_codes.access_version)`;
 // A random redemption hash ties the INSERT to this exact successful UPDATE.
 // Concurrent/replayed exchanges cannot reuse a consumed code, even in the same ms.
 const results=await db.batch([
  db.prepare(`UPDATE app_pair_codes SET used_at=?,redemption_hash=? WHERE code_hash=? AND app_id=? AND origin=?
   AND challenge=? AND used_at IS NULL AND expires_at>? AND ${eligible}`)
   .bind(now,tokenHash,codeHash,app,suiteApplications[app].origin,challenge,now,app),
  db.prepare(`INSERT INTO app_access_sessions(token_hash,app_id,member_id,credential_version,access_version,expires_at,created_at)
   SELECT ?,app_id,member_id,credential_version,access_version,?,? FROM app_pair_codes
   WHERE code_hash=? AND app_id=? AND redemption_hash=? AND used_at=?`)
   .bind(tokenHash,now+APP_SESSION_TTL,now,codeHash,app,tokenHash,now),
 ]);
 if(!results[0].meta.changes||!results[1].meta.changes)return null;
 return {token,expiresAt:now+APP_SESSION_TTL,app};
}
export async function appPrincipal(db:D1Database,app:SuiteApp,token:unknown,now=Date.now()):Promise<AppPrincipal|null>{
 if(!validChallenge(token))return null;
 return db.prepare(`SELECT m.id,m.email,m.name,m.role,c.version AS credentialVersion,${accessVersion} AS accessVersion,
 CASE WHEN m.role='owner' THEN ? ELSE a.role END AS appRole ${joins}
 JOIN app_access_sessions s ON s.member_id=m.id AND s.app_id=? AND s.credential_version=c.version AND s.access_version=${accessVersion}
 WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND ${active}`)
 .bind(app==='academy'?'editor':'member',app,app,await sha256(token),now).first<AppPrincipal>();
}
export async function revokeAppSession(db:D1Database,app:SuiteApp,token:string,now=Date.now()){
 await db.prepare('UPDATE app_access_sessions SET revoked_at=? WHERE app_id=? AND token_hash=? AND revoked_at IS NULL').bind(now,app,await sha256(token)).run();
}
export async function setAppMembership(db:D1Database,actor:Principal,app:SuiteApp,memberId:unknown,role:unknown,enabled:unknown,now=Date.now()){
 if(actor.role!=='owner')throw new HttpError(403,'Gestion des accès réservée au propriétaire.');
 if(typeof memberId!=='string'||memberId.length>80||!allowedAppRole(app,role)||typeof enabled!=='boolean')throw new HttpError(400,'Membre, rôle ou statut invalide.');
 const target=await db.prepare('SELECT id,role FROM members WHERE id=?').bind(memberId).first<{id:string;role:string}>();
 if(!target)throw new HttpError(404,'Membre introuvable.');
 if(target.role==='owner')throw new HttpError(403,'Les accès du propriétaire sont protégés.');
 await db.batch([
  db.prepare(`INSERT INTO app_memberships(app_id,member_id,role,status,version,updated_at,updated_by) VALUES(?,?,?,?,1,?,?)
   ON CONFLICT(app_id,member_id) DO UPDATE SET role=excluded.role,status=excluded.status,version=app_memberships.version+1,updated_at=excluded.updated_at,updated_by=excluded.updated_by`)
   .bind(app,memberId,role,enabled?'active':'revoked',now,actor.id),
  db.prepare('DELETE FROM app_pair_codes WHERE app_id=? AND member_id=?').bind(app,memberId),
  db.prepare('DELETE FROM app_access_sessions WHERE app_id=? AND member_id=?').bind(app,memberId),
  db.prepare('INSERT INTO audit_events(id,actor_id,action,target_id,detail,created_at) VALUES(?,?,?,?,?,?)')
   .bind(crypto.randomUUID(),actor.id,'apps.access.change',memberId,JSON.stringify({app,role,enabled}),now),
 ]);
}
