import {database} from '@/lib/mail';
import {exchangeCode} from '@/lib/heart-pairing';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function POST(request:Request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON requis.'},415);
 const len=Number(request.headers.get('content-length')||0);
 if(len>2048)return json({error:'Requête invalide.'},400);
 let body:any;try{const raw=await request.text();if(raw.length>2048)throw Error();body=JSON.parse(raw);}catch{return json({error:'JSON invalide.'},400);}
 try{
   const user=await exchangeCode(database(),body?.code,body?.verifier);
   return user?json({user}):json({error:'Code expiré, invalide ou déjà utilisé.'},401);
 }catch{return json({error:'Service d’association indisponible.'},503);}
}
