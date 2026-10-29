import type {AdminData,MemberRow,GrantRow,ActivityRow,AuditRow,SlotRow} from './admin-types';
import type {Principal} from './policy';
import {assertServiceAccess,type ServicePolicy} from './admin-policy.ts';
export async function servicePolicy(db:D1Database):Promise<ServicePolicy>{const row=await db.prepare("SELECT value FROM service_settings WHERE key='maintenance'").first<{value:string}>();if(!row)return {maintenance:false,message:''};try{const value=JSON.parse(row.value);return {maintenance:value.enabled===true,message:typeof value.message==='string'?value.message.slice(0,240):''}}catch{throw Error('La configuration de maintenance est invalide.')}}
export async function checkServiceAccess(db:D1Database,user:Principal){const [control,policy]=await Promise.all([db.prepare('SELECT status FROM member_controls WHERE member_id=?').bind(user.id).first<{status:string}>(),servicePolicy(db)]);assertServiceAccess(user,control?.status||null,policy)}
export async function recordActivity(db:D1Database,user:Principal,source='server'){const now=Date.now();await db.prepare('INSERT INTO member_activity(member_id,source,first_seen,last_seen,requests) VALUES(?,?,?,?,1) ON CONFLICT(member_id,source) DO UPDATE SET last_seen=excluded.last_seen,requests=member_activity.requests+1').bind(user.id,source,now,now).run()}
export async function adminState(db:D1Database,user:Principal):Promise<AdminData>{
 const started=performance.now(),now=Date.now();await db.prepare('SELECT 1 AS ready').first();const databaseLatency=Math.round((performance.now()-started)*10)/10;
 const [members,grants,activity,audit,policy,pending,totals,slots]=await Promise.all([
  db.prepare("SELECT m.id,m.email,m.name,m.role,m.created_at,COALESCE(c.status,'active') AS status FROM members m LEFT JOIN member_controls c ON c.member_id=m.id ORDER BY m.created_at DESC LIMIT 500").all<MemberRow>(),
  db.prepare('SELECT member_id,site,status,updated_at,updated_by FROM grants').all<GrantRow>(),
  db.prepare('SELECT a.member_id,m.name,m.email,a.source,a.first_seen,a.last_seen,a.requests FROM member_activity a JOIN members m ON m.id=a.member_id ORDER BY a.last_seen DESC LIMIT 100').all<ActivityRow>(),
  db.prepare('SELECT a.id,a.actor_id,m.name AS actor_name,a.action,a.target_id,a.detail,a.created_at FROM audit_events a LEFT JOIN members m ON m.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100').all<AuditRow>(),servicePolicy(db),
  db.prepare("SELECT COUNT(*) AS total FROM applications WHERE status='pending'").first<{total:number}>(),
  db.prepare('SELECT COUNT(*) AS total FROM members').first<{total:number}>(),
  db.prepare('SELECT id,name,role,status,email,member_id FROM account_slots ORDER BY template_key').all<SlotRow>()
 ]);
 return {user,server:{time:now,database:'connected',databaseLatency,hosting:'Cloudflare Workers',maintenance:policy.maintenance,maintenanceMessage:policy.message},members:members.results,slots:slots.results,grants:grants.results,activity:activity.results,audit:audit.results,counts:{members:totals?.total||0,pending:pending?.total||0},coverage:{server:true,mail:'Appels authentifiés reçus par ce serveur',studio:false,engine:false}};
}
