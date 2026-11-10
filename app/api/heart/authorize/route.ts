import {identity,database} from '@/lib/mail';
import {createCode,validChallenge,validState,HEART_ORIGIN} from '@/lib/heart-pairing';
import {mustChange} from '@/lib/warlike-auth';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function POST(request:Request){
 const url=new URL(request.url);
 if(url.protocol!=='https:'||request.headers.get('origin')!==url.origin)return json({error:'Origine refusée.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Format JSON requis.'},415);
 let body:any;try{if(Number(request.headers.get('content-length')||0)>2048)throw Error('size');const raw=await request.text();if(raw.length>2048)throw Error('size');body=JSON.parse(raw);}catch{return json({error:'Requête invalide.'},400);}
 if(!validChallenge(body?.challenge)||!validState(body?.state))return json({error:'Paramètres PKCE invalides.'},400);
 try{
  const user=await identity();
  if(!user)return json({error:'Connexion WarLike requise.'},401);
  const db=database();
  if(await mustChange(db,user.id))return json({error:'Change le mot de passe initial avant d’associer Heart.'},403);
  const code=await createCode(db,user.id,body.challenge);
  return json({redirect:HEART_ORIGIN+'/#warlike_pair='+encodeURIComponent(code)+'&state='+encodeURIComponent(body.state)});
 }catch{return json({error:'Association indisponible.'},503);}
}
