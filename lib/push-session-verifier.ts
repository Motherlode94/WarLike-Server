// Internal service helper only; never expose session digests through a public API.
export async function isPushSessionActive(db:D1Database,hash:string,memberId:string,now=Date.now()):Promise<boolean>{
 if(typeof hash!=='string'||! /^[a-f0-9]{64}$/.test(hash)||typeof memberId!=='string'||!memberId||memberId.length>100)return false;
 const row=await db.prepare("SELECT m.id FROM warlike_sessions s JOIN warlike_credentials c ON c.member_id=s.member_id AND c.version=s.credential_version JOIN members m ON m.id=s.member_id LEFT JOIN member_controls ctl ON ctl.member_id=m.id WHERE s.token_hash=? AND s.member_id=? AND s.expires_at>? AND COALESCE(ctl.status,'active')='active'").bind(hash,memberId,now).first<{id:string}>();
 if(!row)return false;
 return !(await mustChange(db,row.id));
}
import {mustChange} from './warlike-auth.ts';
