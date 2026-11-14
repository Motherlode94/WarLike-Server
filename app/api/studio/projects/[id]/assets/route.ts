import {env} from 'cloudflare:workers';
import {database,identity} from '@/lib/mail';
import {errorResponse,HttpError} from '@/lib/security';
import {detectedMedia} from '@/lib/community-policy';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function POST(request:Request,ctx:Context){
 try{
  const url=new URL(request.url);
  if(request.headers.get('origin')!==url.origin)return json({error:'Origine refusée.'},403);
  const user=await identity();if(!user)return json({error:'Connexion requise.'},401);
  const {id}=await ctx.params;if(!/^[0-9a-f-]{36}$/i.test(id))return json({error:'Projet introuvable.'},404);
  const db=database(),project=await db.prepare('SELECT id FROM studio_projects WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(id,user.id).first();
  if(!project)return json({error:'Projet introuvable.'},404);
  if(!env.BUCKET)throw new HttpError(503,'Stockage média indisponible.');
  if(!request.headers.get('content-type')?.startsWith('multipart/form-data'))return json({error:'Multipart requis.'},415);
  const form=await request.formData(),file=form.get('file');
  if(!(file instanceof File)||!file.size||file.size>12*1024*1024)throw new HttpError(413,'Média limité à 12 Mo.');
  const bytes=new Uint8Array(await file.arrayBuffer()),type=detectedMedia(bytes);
  if(!type||!['audio/wav','audio/ogg','audio/mpeg'].includes(type))return json({error:'Audio WAV, OGG ou MP3 requis.'},415);
  const assetId=crypto.randomUUID(),key='studio/'+encodeURIComponent(user.id)+'/'+id+'/'+assetId,now=Date.now();
  await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type}});
  try{
   await db.prepare('INSERT INTO studio_project_assets (id,project_id,owner_id,object_key,filename,mime_type,byte_length,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .bind(assetId,id,user.id,key,file.name.slice(0,180),type,bytes.byteLength,now).run();
  }catch(error){await env.BUCKET.delete(key);throw error;}
  return json({id:assetId,name:file.name,type,size:bytes.byteLength},201);
 }catch(e){return errorResponse(e);}
}
