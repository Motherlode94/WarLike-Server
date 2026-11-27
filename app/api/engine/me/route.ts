import {identity} from '@/lib/mail';
import {errorResponse} from '@/lib/security';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const user=await identity();if(!user)return Response.json({error:'Connexion WarLike requise.'},{status:401,headers:{'Cache-Control':'no-store'}});
  return Response.json({userId:user.id,engineAccess:true,displayName:user.name||''},{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){return errorResponse(error);}
}
