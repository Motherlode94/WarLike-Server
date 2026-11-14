import {database,identity} from '@/lib/mail';
import {HttpError,readJsonObject,errorResponse} from '@/lib/security';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
type Context={params:Promise<{id:string}>};
const validId=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
async function principalAndId(ctx:Context){
 const user=await identity();if(!user)throw new HttpError(401,'Connexion WarLike requise.');
 const {id}=await ctx.params;if(!validId(id))throw new HttpError(404,'Projet introuvable.');
 return {user,id};
}
export async function GET(_request:Request,ctx:Context){
 try{
  const {user,id}=await principalAndId(ctx);
  const row=await database().prepare('SELECT project_json,revision,updated_at FROM studio_projects WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(id,user.id).first<{project_json:string;revision:number;updated_at:number}>();
  if(!row)return json({error:'Projet introuvable.'},404);
  return json({id,project:JSON.parse(row.project_json),revision:row.revision,updatedAt:row.updated_at});
 }catch(e){return errorResponse(e);}
}
export async function PUT(request:Request,ctx:Context){
 try{
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origine refusée.'},403);
  const {user,id}=await principalAndId(ctx),body=await readJsonObject(request,900000);
  const rev=body.expectedRevision,project=body.project as Record<string,unknown>|undefined;
  if(!Number.isSafeInteger(rev)||Number(rev)<1||!project||Array.isArray(project)||typeof project!=='object')throw new HttpError(400,'Révision ou projet invalide.');
  const raw=JSON.stringify(project);if(raw.length>800000)throw new HttpError(413,'Projet trop volumineux.');
  const name=typeof project.name==='string'?project.name.trim().slice(0,60):'';
  if(!name||!Array.isArray(project.tracks))throw new HttpError(400,'Projet invalide.');
  const db=database(),now=Date.now();
  const update=await db.prepare('UPDATE studio_projects SET name=?,project_json=?,revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL').bind(name,raw,now,id,user.id,rev).run();
  if(!update.meta.changes){
    const exists=await db.prepare('SELECT revision FROM studio_projects WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(id,user.id).first<{revision:number}>();
    return exists?json({error:'Conflit de version.',code:'CONFLICT',revision:exists.revision},409):json({error:'Projet introuvable.'},404);
  }
  return json({id,name,revision:Number(rev)+1,updatedAt:now});
 }catch(e){return errorResponse(e);}
}
export async function DELETE(request:Request,ctx:Context){
 try{
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origine refusée.'},403);
  const {user,id}=await principalAndId(ctx),body=await readJsonObject(request,1024);
  const rev=body.expectedRevision;
  if(!Number.isSafeInteger(rev)||Number(rev)<1)throw new HttpError(400,'Révision obligatoire.');
  const now=Date.now(),db=database();
  const change=await db.prepare('UPDATE studio_projects SET deleted_at=?,revision=revision+1 WHERE id=? AND owner_id=? AND revision=? AND deleted_at IS NULL').bind(now,id,user.id,rev).run();
  if(!change.meta.changes){
   const exists=await db.prepare('SELECT revision FROM studio_projects WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(id,user.id).first<{revision:number}>();
   return exists?json({error:'Conflit de version.',code:'CONFLICT',revision:exists.revision},409):json({error:'Projet introuvable.'},404);
  }
  return json({id,deleted:true});
 }catch(e){return errorResponse(e);}
}
