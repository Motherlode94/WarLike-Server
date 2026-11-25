import {database,identity} from '@/lib/mail';
import {errorResponse,readJsonObject} from '@/lib/security';
import {publishForOwner} from '@/lib/create-publication';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Origine refusée.'},{status:403});
  const user=await identity();if(!user)return Response.json({error:'Connexion requise.'},{status:401});
  const data=await readJsonObject(request,4096);
  const result=await publishForOwner(database(),user.id,'engine',String(data.sourceId||''),String(data.title||''),String(data.description||''));
  return Response.json(result,{status:201,headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return errorResponse(error);}
}
