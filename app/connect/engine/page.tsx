import {identity} from '@/lib/mail';
import {validChallenge} from '@/lib/heart-pairing';
import {validEngineState} from '@/lib/engine-pairing';
import Approve from './view';
export const dynamic='force-dynamic';
export default async function EngineConnect({searchParams}:{searchParams:Promise<{challenge?:string;state?:string}>}){
 const {challenge,state}=await searchParams;
 if(!validChallenge(challenge)||!validEngineState(state))return <main>Demande d'association Engine invalide.</main>;
 let user=null;try{user=await identity();}catch{}
 const back='/connect/engine?challenge='+encodeURIComponent(challenge!)+'&state='+encodeURIComponent(state!);
 return <main style={{background:'#101521',color:'#f7f2ff',minHeight:'100vh',padding:'12vh 24px',fontFamily:'system-ui'}}><section style={{maxWidth:580,margin:'auto'}}>
 <h1>Autoriser WarLike Engine</h1><p>Engine pourra consulter et sauvegarder uniquement les projets de ton compte WarLike. Tu pourras révoquer cette session. Ton mot de passe n'est jamais transmis à Engine.</p>
 {user?<><p>Compte : {user.name}</p><Approve challenge={challenge!} state={state!}/></>:<a href={'/connexion?return_to='+encodeURIComponent(back)} style={{color:'#d2b0ff'}}>Se connecter à WarLike Server</a>}
 </section></main>;
}
