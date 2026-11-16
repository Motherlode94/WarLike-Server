import {HttpError} from './security.ts';
import {assertAccountControl} from './admin-policy.ts';
import type {Principal} from './policy.ts';

// The public Worker and Sites runtime can have different migration levels.
// Only tables from this fixed allowlist can ever enter a DELETE statement.
const credentialTables=['warlike_sessions','mailbox_sessions','studio_access_sessions','heart_pair_codes','studio_pair_codes','app_pair_codes','app_access_sessions'] as const;
export async function memberSessionRevocations(db:D1Database,memberId:string):Promise<D1PreparedStatement[]> {
 const tables=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('warlike_sessions','mailbox_sessions','studio_access_sessions','heart_pair_codes','studio_pair_codes','app_pair_codes','app_access_sessions')").all<{name:string}>();
 const present=new Set(tables.results.map(row=>row.name));
 return credentialTables.filter(name=>present.has(name)).map(name=>db.prepare(`DELETE FROM ${name} WHERE member_id=?`).bind(memberId));
}
export async function ownerSessionRevocations(db:D1Database,actor:Principal,target:Principal) {
 if(actor.role!=='owner')throw new HttpError(403,'La déconnexion globale est réservée au propriétaire.');
 assertAccountControl(actor,target);
 return memberSessionRevocations(db,target.id);
}
