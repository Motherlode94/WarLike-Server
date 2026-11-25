import {database,identity} from '@/lib/mail';
import {HttpError,readJsonObject,errorResponse} from '@/lib/security';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function principal(ctx:Context){
 const user=await identity();if(!user)throw new HttpError(401,'Connexion requise.');
 const {id}=await ctx.params;if(!UUID.test(id))throw new HttpError(404,'Projet introuvable.');
 return {user,id};
}
export async function GET(_request:Request,ctx:Context){
 try{
  const {user,id}=await principal(ctx);
  const record=await database().prepare('SELECT project_json,revision,updated_at FROM engine_projects WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(id,user.id).first<{project_json:string;revision:number;updated_at:number}>();
  return record?json({id,project:JSON.parse(record.project_json),revision:record.revision,updatedAt:record.updated_at}):json({error:'Projet introuvable.'},404);
 }catch(error){return errorResponse(error);}
}
export async function PUT(request:Request,ctx:Context){
 try{
  const url=new URL(request.url);if(url.protocol!=='https:'||request.headers.get('origin')!==url.origin)return json({error:'Origine refusée.'},403);
  const {user,id}=await principal(ctx),body=await readJsonObject(request,1004096);
  const rev=body.expectedRevision,project=body.project as Record<string,unknown>|undefined;
  if(!Number.isSafeInteger(rev)||Number(rev)<1||!project||typeof project!=='object'||Array.isArray(project))throw new HttpError(400,'Révision ou projet invalide.');
  const raw=JSON.stringify(project),name=typeof project.name==='string'?project.name.trim().slice(0,64):'';
  if(raw.length>1000000)throw new HttpError(413,'Projet trop volumineux.');
  if(!name||!['2d','3d'].includes(String(project.type))||!project.workspaces||typeof project.workspaces!=='object'||Array.isArray(project.workspaces))throw new HttpError(400,'Projet Engine invalide.');
  const db=database(),now=Date.now(),update=await db.prepare('UPDATE engine_projects SET name=?,project_json=?,revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL').bind(name,raw,now,id,user.id,rev).run();
  if(!update.meta.changes){
   const row=await db.prepare('SELECT revision FROM engine_projects WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(id,user.id).first<{revision:number}>();
   return row?json({error:'Conflit de version.',code:'CONFLICT',revision:row.revision},409):json({error:'Projet introuvable.'},404);
  }
  return json({id,name,revision:Number(rev)+1,updatedAt:now});
 }catch(error){return errorResponse(error);}
}
export async function DELETE(request:Request,ctx:Context){
 try{
  const url=new URL(request.url);if(url.protocol!=='https:'||request.headers.get('origin')!==url.origin)return json({error:'Origine refusée.'},403);
  const {user,id}=await principal(ctx),body=await readJsonObject(request,1024);
  const rev=body.expectedRevision;if(!Number.isSafeInteger(rev)||Number(rev)<1)throw new HttpError(400,'Révision obligatoire.');
  const db=database(),now=Date.now();
  const update=await db.prepare('UPDATE engine_projects SET deleted_at=?,revision=revision+1 WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL').bind(now,id,rev).run();
  if(!update.meta.changes){
   const row=await db.prepare('SELECT revision FROM engine_projects WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(id,user.id).first<{revision:number}>();
   return row?json({error:'Conflit de version.',code:'CONFLICT',revision:row.revision},409):json({error:'Projet introuvable.'},404);
  }
  return json({id,deleted:true});
 }catch(error){return errorResponse(error);}
}
