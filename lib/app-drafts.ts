import {HttpError} from './security.ts';
import {appMember,type AppPrincipal} from './app-sessions.ts';
import type {SuiteApp} from './app-contract.ts';
export const DRAFT_BODY_LIMIT=130_000;
export type OrganizationRole='owner'|'admin'|'accountant'|'viewer';
export type DraftScope={app:SuiteApp;id:string;organizationId?:string;role?:OrganizationRole};
export const validResourceId=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function personalScope(user:AppPrincipal):DraftScope{return {app:'academy',id:'member:'+user.id}}
export async function organizationScope(db:D1Database,user:AppPrincipal,id:string,write=false):Promise<DraftScope>{
 if(!validResourceId(id))throw new HttpError(404,'Organisation introuvable.');
 const row=await db.prepare("SELECT role FROM app_organization_members WHERE organization_id=? AND member_id=? AND status='active'").bind(id,user.id).first<{role:OrganizationRole}>();
 if(!row)throw new HttpError(404,'Organisation introuvable.');
 if(write&&row.role==='viewer')throw new HttpError(403,'Cette organisation est en lecture seule pour ton compte.');
 return {app:'business',id:'organization:'+id,organizationId:id,role:row.role};
}
export async function organizations(db:D1Database,user:AppPrincipal){return (await db.prepare(`SELECT o.id,o.name,o.created_at,m.role,m.version FROM app_organizations o
 JOIN app_organization_members m ON m.organization_id=o.id WHERE m.member_id=? AND m.status='active' ORDER BY o.created_at DESC LIMIT 100`).bind(user.id).all()).results}
export async function createOrganization(db:D1Database,user:AppPrincipal,name:unknown,now=Date.now()){
 const title=label(name),id=crypto.randomUUID();
 const result=await db.batch([
  db.prepare(`INSERT INTO app_organizations(id,name,created_by,created_at) SELECT ?,?,?,?
   WHERE (SELECT count(*) FROM app_organizations WHERE created_by=?)<10`).bind(id,title,user.id,now,user.id),
  db.prepare(`INSERT INTO app_organization_members(organization_id,member_id,role,version,updated_at)
   SELECT id,?,'owner',1,? FROM app_organizations WHERE id=? AND created_by=?`).bind(user.id,now,id,user.id),
  db.prepare(`INSERT INTO audit_events(id,actor_id,action,target_id,detail,created_at)
   SELECT ?,?,'apps.organization.create',id,'Organisation Business',? FROM app_organizations WHERE id=? AND created_by=?`).bind(crypto.randomUUID(),user.id,now,id,user.id),
 ]);
 if(!result[0].meta.changes)throw new HttpError(429,'Limite de 10 organisations créées atteinte.');
 return {id,name:title,role:'owner',version:1,createdAt:now};
}
export async function organizationMembers(db:D1Database,user:AppPrincipal,id:string){
 const scope=await organizationScope(db,user,id);
 if(!['owner','admin'].includes(scope.role!))throw new HttpError(403,'Gestion des membres réservée aux responsables de l’organisation.');
 return (await db.prepare(`SELECT x.member_id,m.name,x.role,x.version,x.status FROM app_organization_members x JOIN members m ON m.id=x.member_id WHERE x.organization_id=? LIMIT 100`).bind(id).all()).results;
}
export async function setOrganizationMember(db:D1Database,user:AppPrincipal,id:string,input:Record<string,unknown>,now=Date.now(),remove=false){
 const scope=await organizationScope(db,user,id,true),role=input.role,target=input.memberId,revision=input.expectedRevision;
 if(!['owner','admin'].includes(scope.role!))throw new HttpError(403,'Gestion des membres réservée aux responsables de l’organisation.');
 if(typeof target!=='string'||!remove&&!['admin','accountant','viewer'].includes(String(role))||!Number.isSafeInteger(revision)||Number(revision)<0)throw new HttpError(400,'Membre, rôle ou révision invalide.');
 const existing=await db.prepare('SELECT role,version,status FROM app_organization_members WHERE organization_id=? AND member_id=?').bind(id,target).first<{role:string;version:number;status:string}>();
 if(existing?.role==='owner'||target===user.id)throw new HttpError(403,'Le propriétaire et ton propre rôle sont protégés.');
 if(scope.role==='admin'&&(!remove&&role==='admin'||existing?.role==='admin'))throw new HttpError(403,'Seul le propriétaire attribue le rôle administrateur.');
 if(!remove&&!await appMember(db,'business',target))throw new HttpError(403,'Le membre doit disposer d’un accès Business actif.');
 const marker=crypto.randomUUID();
 if(remove){
  if(!existing||existing.status!=='active'||existing.version!==revision)throw new HttpError(409,'Les droits ont changé. Recharge la liste des membres.');
  const result=await db.batch([db.prepare(`UPDATE app_organization_members SET operation_id=?,status='revoked',version=version+1 WHERE organization_id=? AND member_id=? AND version=? AND role<>'owner' AND status='active'`).bind(marker,id,target,revision),
   db.prepare(`INSERT INTO audit_events(id,actor_id,action,target_id,detail,created_at) SELECT ?,?,'apps.organization.member.remove',?,?,? WHERE EXISTS(SELECT 1 FROM app_organization_members WHERE organization_id=? AND member_id=? AND operation_id=?)`).bind(marker,user.id,id,JSON.stringify({memberId:target}),now,id,target,marker)]);
  if(!result[0].meta.changes)throw new HttpError(409,'Les droits ont changé. Recharge la liste des membres.');
  return {memberId:target,removed:true,version:Number(revision)+1};
 }
 const results=await db.batch([
  db.prepare(`INSERT INTO app_organization_members(organization_id,member_id,role,version,updated_at,operation_id)
   SELECT ?,?,?,1,?,? WHERE ?=0 AND NOT EXISTS(SELECT 1 FROM app_organization_members WHERE organization_id=? AND member_id=?)
   ON CONFLICT(organization_id,member_id) DO NOTHING`).bind(id,target,role,now,marker,revision,id,target),
  db.prepare(`UPDATE app_organization_members SET role=?,status='active',version=version+1,updated_at=?,operation_id=? WHERE organization_id=? AND member_id=? AND version=? AND ?>0 AND role<>'owner'`).bind(role,now,marker,id,target,revision,revision),
  db.prepare(`INSERT INTO audit_events(id,actor_id,action,target_id,detail,created_at)
   SELECT ?,?,'apps.organization.member',?,?,? WHERE EXISTS(SELECT 1 FROM app_organization_members WHERE organization_id=? AND member_id=? AND role=? AND version=? AND updated_at=? AND operation_id=?)`)
   .bind(marker,user.id,id,JSON.stringify({memberId:target,role}),now,id,target,role,Number(revision)+1,now,marker),
 ]);
 if(!results[0].meta.changes&&!results[1].meta.changes)throw new HttpError(409,'Les droits ont changé. Recharge la liste des membres.');
 return {memberId:target,role,version:Number(revision)+1};
}
function label(value:unknown){if(typeof value!=='string'||!value.trim()||value.trim().length>120)throw new HttpError(400,'Nom obligatoire, 120 caractères maximum.');return value.trim()}
function draftInput(input:Record<string,unknown>){
 const title=label(input.title),payload=input.payload;
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new HttpError(400,'Le brouillon doit contenir un objet JSON.');
 const pending:Array<{value:unknown;depth:number}>=[{value:payload,depth:0}];let nodes=0;
 while(pending.length){const {value,depth}=pending.pop()!;if(depth>32||++nodes>10_000)throw new HttpError(400,'Structure du brouillon trop complexe.');if(value&&typeof value==='object')for(const child of Object.values(value))pending.push({value:child,depth:depth+1})}
 const raw=JSON.stringify(payload);if(new TextEncoder().encode(raw).byteLength>120_000)throw new HttpError(413,'Brouillon limité à 120 Ko.');
 return {title,raw};
}
function revisionOf(input:Record<string,unknown>){const revision=input.expectedRevision;if(!Number.isSafeInteger(revision)||Number(revision)<1)throw new HttpError(400,'Révision attendue obligatoire.');return Number(revision)}
function resource(id:string){if(!validResourceId(id))throw new HttpError(404,'Brouillon introuvable.')}
export async function listDrafts(db:D1Database,scope:DraftScope){return (await db.prepare(`SELECT id,title,revision,created_at,updated_at FROM app_drafts WHERE app_id=? AND scope_id=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200`).bind(scope.app,scope.id).all()).results}
export async function getDraft(db:D1Database,scope:DraftScope,id:string){
 resource(id);const row=await db.prepare('SELECT title,payload_json,revision,created_at,updated_at FROM app_drafts WHERE app_id=? AND scope_id=? AND id=? AND deleted_at IS NULL').bind(scope.app,scope.id,id).first<{title:string;payload_json:string;revision:number;created_at:number;updated_at:number}>();
 if(!row)throw new HttpError(404,'Brouillon introuvable.');return {id,title:row.title,payload:JSON.parse(row.payload_json),revision:row.revision,createdAt:row.created_at,updatedAt:row.updated_at};
}
export async function createDraft(db:D1Database,user:AppPrincipal,scope:DraftScope,input:Record<string,unknown>,now=Date.now()){
 const {title,raw}=draftInput(input),id=crypto.randomUUID(),operation=crypto.randomUUID();
 const results=await db.batch([
  db.prepare(`INSERT INTO app_drafts(app_id,scope_id,id,title,payload_json,revision,created_at,updated_at,updated_by,operation_id)
   SELECT ?,?,?,?,?,1,?,?,?,? WHERE (SELECT count(*) FROM app_drafts WHERE app_id=? AND scope_id=? AND deleted_at IS NULL)<200`)
   .bind(scope.app,scope.id,id,title,raw,now,now,user.id,operation,scope.app,scope.id),
  draftAudit(db,user,scope,id,operation,'create',now),
 ]);
 if(!results[0].meta.changes)throw new HttpError(429,'Limite de 200 brouillons atteinte.');return {id,title,revision:1,createdAt:now,updatedAt:now};
}
function draftAudit(db:D1Database,user:AppPrincipal,scope:DraftScope,id:string,operation:string,action:string,now:number){
 return db.prepare(`INSERT INTO audit_events(id,actor_id,action,target_id,detail,created_at)
 SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_drafts WHERE app_id=? AND scope_id=? AND id=? AND operation_id=?)`)
 .bind(operation,user.id,'apps.draft.'+action,id,JSON.stringify({app:scope.app,scope:scope.id}),now,scope.app,scope.id,id,operation);
}
export async function updateDraft(db:D1Database,user:AppPrincipal,scope:DraftScope,id:string,input:Record<string,unknown>,remove=false,now=Date.now()){
 resource(id);const revision=revisionOf(input),data=remove?null:draftInput(input),operation=crypto.randomUUID();
 const mutation=remove?db.prepare(`UPDATE app_drafts SET deleted_at=?,updated_at=?,updated_by=?,revision=revision+1,operation_id=? WHERE app_id=? AND scope_id=? AND id=? AND revision=? AND deleted_at IS NULL`).bind(now,now,user.id,operation,scope.app,scope.id,id,revision):
 db.prepare(`UPDATE app_drafts SET title=?,payload_json=?,updated_at=?,updated_by=?,revision=revision+1,operation_id=? WHERE app_id=? AND scope_id=? AND id=? AND revision=? AND deleted_at IS NULL`).bind(data!.title,data!.raw,now,user.id,operation,scope.app,scope.id,id,revision);
 const result=await db.batch([mutation,draftAudit(db,user,scope,id,operation,remove?'delete':'update',now)]);
 if(!result[0].meta.changes){const row=await db.prepare('SELECT revision,deleted_at FROM app_drafts WHERE app_id=? AND scope_id=? AND id=?').bind(scope.app,scope.id,id).first<{revision:number;deleted_at:number|null}>();if(!row||row.deleted_at!==null)throw new HttpError(404,'Brouillon introuvable.');throw new HttpError(409,'Conflit de version. Recharge le brouillon avant d’enregistrer.');}
 return {id,revision:revision+1,...(remove?{deleted:true}:{title:data!.title}),updatedAt:now};
}
