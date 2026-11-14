import {env} from 'cloudflare:workers';
import {database,identity} from '@/lib/mail';
import {errorResponse} from '@/lib/security';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string;assetId:string}>};
export async function GET(_request:Request,ctx:Context){
 try{
  const user=await identity();
  if(!user)return Response.json({error:'Connexion requise.'},{status:401,headers:{'Cache-Control':'no-store'}});
  const {id,assetId}=await ctx.params;
  if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f-]{36}$/i.test(assetId))return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
  const row=await database().prepare(`SELECT a.object_key,a.mime_type,a.filename FROM studio_project_assets a
   JOIN studio_projects p ON p.id=a.project_id AND p.owner_id=a.owner_id
   WHERE a.id=? AND a.project_id=? AND a.owner_id=? AND p.deleted_at IS NULL`)
   .bind(assetId,id,user.id).first<{object_key:string;mime_type:string;filename:string}>();
  if(!row||!env.BUCKET)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
  const object=await env.BUCKET.get(row.object_key);
  if(!object)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
  return new Response(object.body,{headers:{'Content-Type':row.mime_type,'Content-Disposition':'attachment; filename="studio-audio"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return errorResponse(e);}
}
