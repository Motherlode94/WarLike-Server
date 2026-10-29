import type {Principal} from './policy';
export type MemberRow=Principal&{status:string;created_at:number};
export type GrantRow={member_id:string;site:string;status:string;updated_at:number;updated_by:string};
export type ActivityRow={member_id:string;name:string;email:string;source:string;first_seen:number;last_seen:number;requests:number};
export type AuditRow={id:string;actor_id:string;actor_name:string|null;action:string;target_id:string;detail:string;created_at:number};
export type SlotRow={id:string;name:string;role:string;status:string;email:string|null;member_id:string|null};
export type AdminData={user:Principal;server:{time:number;database:string;databaseLatency:number;hosting:string;maintenance:boolean;maintenanceMessage:string};members:MemberRow[];grants:GrantRow[];activity:ActivityRow[];audit:AuditRow[];slots:SlotRow[];counts:{members:number;pending:number};coverage:{server:boolean;mail:string;studio:boolean;engine:boolean}};
