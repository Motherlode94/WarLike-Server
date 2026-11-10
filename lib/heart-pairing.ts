// OAuth-inspired one-use proof-key authorization codes; no password/cookie shared with Heart.
const encoder=new TextEncoder();
export const HEART_ORIGIN='https://warlike-heart.pages.dev';
export const CODE_TTL=120_000;
const b64url=(bytes:Uint8Array)=>btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export async function sha256(value:string):Promise<string>{return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));}
export function validChallenge(value:unknown):value is string {return typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);}
export function validState(value:unknown):value is string {return typeof value==='string'&&/^[A-Za-z0-9_-]{24,128}$/.test(value);}
export async function createCode(db:D1Database,memberId:string,challenge:string,now=Date.now()):Promise<string>{
 if(!validChallenge(challenge))throw Error('Challenge PKCE invalide.');
 const code=b64url(crypto.getRandomValues(new Uint8Array(32)));
 await db.prepare('INSERT INTO heart_pair_codes(code_hash,member_id,challenge,expires_at,created_at) VALUES(?,?,?,?,?)')
 .bind(await sha256(code),memberId,challenge,now+CODE_TTL,now).run();
 return code;
}
export async function exchangeCode(db:D1Database,code:unknown,verifier:unknown,now=Date.now()){
 if(typeof code!=='string'||!validChallenge(code)||typeof verifier!=='string'||!/^[A-Za-z0-9_-]{43,128}$/.test(verifier))return null;
 const challenge=await sha256(verifier);
 const row=await db.prepare(`UPDATE heart_pair_codes SET used_at=?
 WHERE code_hash=? AND challenge=? AND used_at IS NULL AND expires_at>?
 RETURNING member_id`).bind(now,await sha256(code),challenge,now).first<{member_id:string}>();
 if(!row)return null;
 const member=await db.prepare(`SELECT m.id,m.name,m.role FROM members m
 LEFT JOIN member_controls ctl ON ctl.member_id=m.id
 WHERE m.id=? AND COALESCE(ctl.status,'active')='active'`).bind(row.member_id).first<{id:string;name:string;role:string}>();
 if(!member)return null;
 return {id:member.id,name:member.name,role:member.role};
}
