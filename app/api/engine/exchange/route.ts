import {database} from '@/lib/mail';
import {redeemEngineCode} from '@/lib/engine-pairing';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'JSON requis.'},{status:415});
 if(Number(request.headers.get('content-length')||0)>2048)return Response.json({error:'Requête trop longue.'},{status:413});
 try{
  const raw=await request.text();if(raw.length>2048)return Response.json({error:'Requête trop longue.'},{status:413});
  const input=JSON.parse(raw);
  const session=await redeemEngineCode(database(),input.code,input.verifier);
  return session?Response.json(session,{headers:{'Cache-Control':'no-store'}}):Response.json({error:'Code invalide, expiré ou réutilisé.'},{status:401,headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Association indisponible.'},{status:503});}
}
