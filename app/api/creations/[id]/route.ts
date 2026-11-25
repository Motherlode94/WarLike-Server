import {database,identity} from '@/lib/mail';
import {HttpError,readJsonObject,errorResponse} from '@/lib/security';
export const dynamic='force-dynamic';
type C={params:Promise<{id:string}>};
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function DELETE(request:Request,ctx:C){
 try{
  const url=new URL(request.url);
  if(url.protocol!=='https:'||request.headers.get('origin')!==url.origin)return json({error:'Origine refusée.'},403);
  const user=await identity();if(!user)return json({error:'Connexion WarLike requise.'},401);
  const {id}=await ctx.params;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return json({error:'Publication introuvable.'},404);
  const body=await readJsonObject(request,1024);
  if(body.confirm!==true)throw new HttpError(400,'Confirmation nécessaire.');
  const done=await database().prepare("UPDATE warlike_publications SET status='withdrawn',updated_at=? WHERE id=? AND owner_id=? AND status!='withdrawn'").bind(Date.now(),id,user.id).run();
  return done.meta.changes?json({id,withdrawn:true}):json({error:'Publication introuvable.'},404);
 }catch(error){return errorResponse(error);}
}
