import {database,identity} from '@/lib/mail';
import {HttpError,readJsonObject,errorResponse} from '@/lib/security';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200,publicData=false)=>Response.json(v,{status,headers:{'Cache-Control':publicData?'public, max-age=60':'private, no-store','X-Content-Type-Options':'nosniff'}});
const validUuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export async function GET(){
 try{
  // Public metadata only. Never reveal private source IDs or editable documents.
  const rows=await database().prepare("SELECT id,source_type,title,description,created_at,updated_at FROM warlike_publications WHERE status='published' ORDER BY updated_at DESC LIMIT 100").all();
  return json({creations:rows.results},200,true);
 }catch(error){return errorResponse(error);}
}
export async function POST(request:Request){
 try{
  const url=new URL(request.url);
  if(url.protocol!=='https:'||request.headers.get('origin')!==url.origin)return json({error:'Origine refusée.'},403);
  const user=await identity();if(!user)return json({error:'Connexion WarLike requise.'},401);
  const body=await readJsonObject(request,4096),type=body.sourceType,sourceId=body.sourceId;
  const title=typeof body.title==='string'?body.title.trim().slice(0,100):'';
  const description=typeof body.description==='string'?body.description.trim().slice(0,600):'';
  if(!['engine','studio'].includes(String(type))||!validUuid(sourceId)||!title)throw new HttpError(400,'Création invalide.');
  const db=database(),table=type==='engine'?'engine_projects':'studio_projects';
  const project=await db.prepare('SELECT id FROM '+table+' WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(sourceId,user.id).first();
  if(!project)return json({error:'Projet introuvable.'},404);
  const total=await db.prepare("SELECT count(*) AS n FROM warlike_publications WHERE owner_id=? AND status!='withdrawn'").bind(user.id).first<{n:number}>();
  if((total?.n||0)>=100)throw new HttpError(429,'Limite de publications atteinte.');
  const id=crypto.randomUUID(),now=Date.now();
  // Explicit metadata publication; public playable build/audio needs a dedicated artifact pipeline.
  await db.prepare("INSERT INTO warlike_publications (id,owner_id,source_type,source_id,title,description,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'published',?,?)").bind(id,user.id,type,sourceId,title,description,now,now).run();
  return json({id,title,description,sourceType:type,status:'published',mediaReady:false},201);
 }catch(error){return errorResponse(error);}
}
