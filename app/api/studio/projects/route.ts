import {database,identity} from '@/lib/mail';
import {HttpError,readJsonObject,errorResponse} from '@/lib/security';
export const dynamic='force-dynamic';
const respond=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function GET(){
 try{
  const user=await identity();if(!user)return respond({error:'Connexion WarLike requise'},401);
  const projects=(await database().prepare("SELECT id,name,revision,created_at,updated_at FROM studio_projects WHERE owner_id=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200").bind(user.id).all()).results;
  return respond({projects});
 }catch(e){return errorResponse(e);}
}
export async function POST(request:Request){
 try{
  const url=new URL(request.url);
  if(request.headers.get('origin')!==url.origin)return respond({error:'Origine refusée'},403);
  const user=await identity();if(!user)return respond({error:'Connexion WarLike requise'},401);
  const body=await readJsonObject(request,900000);
  const project=body.project as Record<string,unknown>|undefined;
  if(!project||typeof project!=='object'||Array.isArray(project))throw new HttpError(400,'Projet invalide.');
  const raw=JSON.stringify(project);
  if(raw.length>800000)throw new HttpError(413,'Projet trop volumineux.');
  const name=typeof project.name==='string'?project.name.trim().slice(0,60):'';
  if(!name||!Array.isArray(project.tracks))throw new HttpError(400,'Nom ou pistes invalides.');
  const db=database(),total=await db.prepare('SELECT count(*) as n FROM studio_projects WHERE owner_id=? AND deleted_at IS NULL').bind(user.id).first<{n:number}>();
  if((total?.n||0)>=200)throw new HttpError(429,'Limite de 200 projets atteinte.');
  const id=crypto.randomUUID(),now=Date.now();
  await db.prepare('INSERT INTO studio_projects (id,owner_id,name,project_json,revision,created_at,updated_at) VALUES(?,?,?,?,1,?,?)').bind(id,user.id,name,raw,now,now).run();
  return respond({id,name,revision:1,createdAt:now,updatedAt:now},201);
 }catch(e){return errorResponse(e);}
}
