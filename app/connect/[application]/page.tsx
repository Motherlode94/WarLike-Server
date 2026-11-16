import {identity} from '@/lib/mail';
import {suiteApplications,isSuiteApp} from '@/lib/app-contract';
import {validChallenge,validState} from '@/lib/heart-pairing';
import Approve from './view';
export const dynamic='force-dynamic';
export default async function AppConnect({params,searchParams}:{params:Promise<{application:string}>;searchParams:Promise<{challenge?:string;state?:string}>}){
 const {application}=await params,{challenge,state}=await searchParams;
 if(!isSuiteApp(application)||!validChallenge(challenge)||!validState(state))return <main>Demande d’association invalide. Reviens dans l’application pour recommencer.</main>;
 const app=suiteApplications[application];let user=null;try{user=await identity()}catch{}
 const back='/connect/'+application+'?challenge='+encodeURIComponent(challenge)+'&state='+encodeURIComponent(state);
 return <main style={{background:'#101521',color:'#f7f2ff',minHeight:'100vh',padding:'10vh 24px',fontFamily:'system-ui'}}><section style={{maxWidth:620,margin:'auto'}}>
 <p style={{color:'#68e2be'}}>WARLIKE / CONNEXION COMMUNE</p><h1>Autoriser {app.name}</h1>
 <p>{application==='academy'?'L’application pourra retrouver tes brouillons personnels. Les notes et certifications ne sont pas validées par cette sauvegarde.':'L’application pourra retrouver les organisations dont tu es membre et leurs brouillons, selon ton rôle.'}</p>
 <p>Ton mot de passe reste dans WarLike Server. La session expire après huit heures et peut être révoquée. Les accès sont contrôlés à chaque requête.</p>
 {user?<><p>Compte : <strong>{user.name}</strong></p><Approve app={application} challenge={challenge} state={state}/>{user.role==='owner'&&<p><a style={{color:'#68e2be'}} href="/applications">Gérer les accès aux applications</a></p>}</>:<a style={{color:'#68e2be'}} href={'/connexion?return_to='+encodeURIComponent(back)}>Se connecter avec mon compte WarLike</a>}
 <p><a style={{color:'#b9c8e8'}} href={app.origin}>Annuler et retourner dans {app.name}</a></p>
 </section></main>;
}
