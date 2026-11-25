import {database,identity} from '@/lib/mail';
import {HttpError,readJsonObject,errorResponse} from '@/lib/security';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const MAX_BYTES=1000000;
export async function GET(){
 try{
  const user=await identity();if(!user)return json({error:'Connexion WarLike requise.'},401);
  const rows=await database().prepare("SELECT id,name,revision,created_at,updated_at FROM engine_projects WHERE owner_id=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200").bind(user.id).all();
  return json({projects:rows.results});
 }catch(error){return errorResponse(error);}
}
export async function POST(request:Request){
 try{
  const url=new URL(request.url);
  if(url.protocol!=='https:'||request.headers.get('origin')!==url.origin)return json({error:'Origine refusée.'},403);
  const user=await identity();if(!user)return json({error:'Connexion WarLike requise.'},401);
  const body=await readJsonObject(request,MAX_BYTES+4096);
  const project=body.project as Record<string,unknown>|undefined;
  if(!project||typeof project!=='object'||Array.isArray(project))throw new HttpError(400,'Projet invalide.');
  const raw=JSON.stringify(project),name=typeof project.name==='string'?project.name.trim().slice(0,64):'';
  if(raw.length>MAX_BYTES)throw new HttpError(413,'Projet trop volumineux.');
  if(!name||!['2d','3d'].includes(String(project.type))||!project.workspaces||typeof project.workspaces!=='object'||Array.isArray(project.workspaces))throw new HttpError(400,'Projet Engine invalide.');
  const db=database(),limit=await db.prepare('SELECT count(*) AS n FROM engine_projects WHERE owner_id=? AND deleted_at IS NULL').bind(user.id).first<{n:number}>();
  if((limit?.n||0)>=200)throw new HttpError(429,'Limite de 200 projets atteinte.');
  const id=crypto.randomUUID(),now=Date.now();
  await db.prepare('INSERT INTO engine_projects (id,owner_id,name,project_json,revision,created_at,updated_at) VALUES(?,?,?,?,1,?,?)').bind(id,user.id,name,raw,now,now).run();
  return json({id,name,revision:1,createdAt:now,updatedAt:now},201);
 }catch(error){return errorResponse(error);}
}
