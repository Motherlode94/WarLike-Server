import {identity} from '@/lib/mail';
import {validChallenge,validState} from '@/lib/heart-pairing';
import Approve from './view';
export const dynamic='force-dynamic';
export default async function HeartConnect({searchParams}:{searchParams:Promise<{challenge?:string;state?:string}>}){
 const {challenge,state}=await searchParams;
 if(!validChallenge(challenge)||!validState(state))return <main><h1>Demande d’association invalide</h1><p>Relance l’association depuis WarLike Heart.</p></main>;
 let user=null;try{user=await identity();}catch{}
 const back='/connect/heart?challenge='+encodeURIComponent(challenge)+'&state='+encodeURIComponent(state);
 return <main style={{minHeight:'100vh',background:'#10111d',color:'#f6e9f4',padding:'12vh 24px',fontFamily:'system-ui'}}>
 <section style={{maxWidth:560,margin:'auto',padding:28,border:'1px solid #745373',borderRadius:18}}>
 <h1>Associer WarLike Heart</h1><p>Cette demande permettra à WarLike Heart de connaître ton identifiant de compte, ton nom affiché et ton rôle pendant une session temporaire. Ni ton mot de passe ni ton cookie de session ne seront transmis.</p>
 {user?<><p>Compte connecté : <strong>{user.name}</strong></p><Approve challenge={challenge} state={state}/></>:<><p>Connecte-toi à WarLike Server pour autoriser l’association.</p><a style={{color:'#ffb4dc'}} href={'/connexion?return_to='+encodeURIComponent(back)}>Connexion WarLike</a></>}
 </section></main>;
}
