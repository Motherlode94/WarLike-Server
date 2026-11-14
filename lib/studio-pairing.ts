import {sha256,validChallenge} from './heart-pairing.ts';
const encode=(bytes:Uint8Array)=>btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const random=()=>encode(crypto.getRandomValues(new Uint8Array(32)));
export const STUDIO_ORIGIN='https://warlike-studio.pages.dev';
export const STUDIO_CODE_TTL=120000, STUDIO_TOKEN_TTL=8*3600000;
export function validStudioState(value:unknown){return typeof value==='string'&&/^[A-Za-z0-9_-]{24,128}$/.test(value);}
export async function issueStudioCode(db:D1Database,memberId:string,challenge:string,now=Date.now()){
 if(!validChallenge(challenge))throw Error('Challenge invalide');
 const code=random();
 await db.prepare('INSERT INTO studio_pair_codes(code_hash,member_id,challenge,expires_at,created_at) VALUES(?,?,?,?,?)')
  .bind(await sha256(code),memberId,challenge,now+STUDIO_CODE_TTL,now).run();
 return code;
}
export async function redeemStudioCode(db:D1Database,code:unknown,verifier:unknown,now=Date.now()){
 if(typeof code!=='string'||!validChallenge(code)||typeof verifier!=='string'||!/^[A-Za-z0-9_-]{43,128}$/.test(verifier))return null;
 const row=await db.prepare(`UPDATE studio_pair_codes SET used_at=? WHERE code_hash=? AND challenge=? AND used_at IS NULL AND expires_at>? RETURNING member_id`)
 .bind(now,await sha256(code),await sha256(verifier),now).first<{member_id:string}>();
 if(!row)return null;
 const member=await db.prepare(`SELECT m.id,m.name,m.role FROM members m LEFT JOIN member_controls ctl ON ctl.member_id=m.id
 WHERE m.id=? AND COALESCE(ctl.status,'active')='active'`).bind(row.member_id).first<{id:string;name:string;role:string}>();
 if(!member)return null;
 const token=random();
 await db.prepare('INSERT INTO studio_access_sessions(token_hash,member_id,expires_at,created_at) VALUES(?,?,?,?)')
  .bind(await sha256(token),member.id,now+STUDIO_TOKEN_TTL,now).run();
 return {token,expiresAt:now+STUDIO_TOKEN_TTL};
}
export async function studioPrincipal(db:D1Database,raw:unknown,now=Date.now()){
 if(typeof raw!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(raw))return null;
 return db.prepare(`SELECT m.id,m.email,m.name,m.role FROM studio_access_sessions s
 JOIN members m ON m.id=s.member_id LEFT JOIN member_controls ctl ON ctl.member_id=m.id
 LEFT JOIN hub_memberships h ON h.member_id=m.id
 WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?
 AND COALESCE(ctl.status,'active')='active' AND COALESCE(h.status,'pending')='active'`)
 .bind(await sha256(raw),now).first<{id:string;email:string;name:string;role:string}>();
}
export async function revokeStudioToken(db:D1Database,token:string,now=Date.now()){
 await db.prepare('UPDATE studio_access_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL').bind(now,await sha256(token)).run();
}
