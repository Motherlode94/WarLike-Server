import {conversationState,accessibleThread} from './conversations';
import {headers} from 'next/headers';
import {resolveMember} from './member-identity';
import {hubMembership} from './hub-store';
import {assertHubMembership} from './hub-policy';
import {mailboxInfo,hasMailboxAccess} from './mailbox-store';
import {HttpError} from './security';
import {checkServiceAccess,recordActivity} from './admin-store';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {manager,mayRead,newMemberId,type Principal} from './policy';
export const HOSTED_ORIGIN='https://warlike-server.vikktor7.chatgpt.site';
export function database(){if(!env.DB)throw Error('Base de données indisponible.');return env.DB;}
export async function identity(options:{allowPending?:boolean}={}):Promise<Principal|null>{const auth=await getChatGPTUser();if(!auth)return null;const db=database(),ownerEmail=(env.WARLIKE_OWNER_EMAIL||'').trim().toLowerCase();if(!ownerEmail)throw Error('Propriétaire non configuré.');const principal=await resolveMember(db,auth,ownerEmail,(await headers()).has('x-warlike-identity'));await checkServiceAccess(db,principal);if(!options.allowPending)assertHubMembership(principal,(await hubMembership(db,principal)).status);await recordActivity(db,principal);return principal;}
export async function state(user:Principal,token?:string){const db=database(),admin=manager(user),mailbox=await mailboxInfo(db,user.id),unlocked=await hasMailboxAccess(db,user,token);if(!unlocked)return {user,mailbox,locked:true,conversations:[],messages:[],members:[],applications:[],grants:[],drafts:[]};const {conversations,messages}=await conversationState(db,user);const members=(await db.prepare(`SELECT m.id,CASE WHEN ?=1 OR m.id=? THEN m.email ELSE COALESCE(b.address,'') END AS email,m.name,m.role,m.created_at,b.address AS mailbox_address FROM members m LEFT JOIN mailboxes b ON b.member_id=m.id LEFT JOIN hub_memberships h ON h.member_id=m.id LEFT JOIN member_controls ctl ON ctl.member_id=m.id ${admin?'':"WHERE m.id=? OR (COALESCE(ctl.status,'active')='active' AND (m.role IN ('owner','referent') OR (b.address IS NOT NULL AND (h.status='active' OR EXISTS(SELECT 1 FROM account_slots sl WHERE sl.member_id=m.id AND sl.status='assigned')))))"} ORDER BY m.created_at LIMIT 500`).bind(admin?1:0,user.id,...(admin?[]:[user.id])).all<any>()).results;const applications=(await db.prepare('SELECT * FROM applications '+(admin?'':'WHERE member_id=?')+' ORDER BY created_at DESC LIMIT 500').bind(...(admin?[]:[user.id])).all<any>()).results;const grants=(await db.prepare('SELECT * FROM grants '+(admin?'':'WHERE member_id=?')).bind(...(admin?[]:[user.id])).all<any>()).results;const drafts=(await db.prepare("SELECT * FROM drafts WHERE author_id=? AND status='active' ORDER BY updated_at DESC").bind(user.id).all<any>()).results;return {user,mailbox,locked:false,conversations,messages,members,applications,grants,drafts};}
export async function threadFor(user:Principal,id:string){return accessibleThread(database(),user,id)}
