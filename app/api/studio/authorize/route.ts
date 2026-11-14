import {identity,database} from '@/lib/mail';
import {issueStudioCode,validStudioState,STUDIO_ORIGIN} from '@/lib/studio-pairing';
import {validChallenge} from '@/lib/heart-pairing';
import {mustChange} from '@/lib/warlike-auth';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const url=new URL(request.url);
 if(url.protocol!=='https:'||request.headers.get('origin')!==url.origin)return Response.json({error:'Origine refusée.'},{status:403});
 if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'JSON requis.'},{status:415});
 try{
  const body=await request.json() as {challenge?:string;state?:string};
  if(!validChallenge(body.challenge)||!validStudioState(body.state))return Response.json({error:'Demande invalide'},{status:400});
  const user=await identity();if(!user)return Response.json({error:'Connexion requise'},{status:401});
  const db=database();if(await mustChange(db,user.id))return Response.json({error:'Mot de passe temporaire à remplacer'},{status:403});
  const code=await issueStudioCode(db,user.id,body.challenge!);
  return Response.json({redirect:STUDIO_ORIGIN+'/#warlike_studio_pair='+encodeURIComponent(code)+'&state='+encodeURIComponent(body.state!)},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Association indisponible'},{status:503});}
}
