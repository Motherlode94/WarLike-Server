import {identity,database} from '@/lib/mail';
import {adminState} from '@/lib/admin-store';
import {manager} from '@/lib/policy';
import {chatGPTSignInPath} from '../chatgpt-auth';
import AdminConsole from './console';
import './admin.css';
export const dynamic='force-dynamic';
export const metadata={title:'WarLike Admin — Serveur et accès'};
export default async function AdminPage(){
 try{const user=await identity();if(!user)return <main className="admin-gate"><a className="admin-wordmark" href="/">W / WARLIKE CONTROL</a><h1>Ton serveur.<br/>Ton contrôle.</h1><p>Connecte-toi à ton compte pour administrer les membres et les services WarLike.</p><a className="admin-primary" href={chatGPTSignInPath('/admin')} target="_top">Se connecter avec ChatGPT →</a></main>;
 if(!manager(user))return <main className="admin-gate"><h1>Accès réservé</h1><p>Cette console est accessible au propriétaire et aux approbateurs autorisés.</p><a href="/">Retour au serveur</a></main>;
 return <AdminConsole initial={await adminState(database(),user)}/>;
 }catch(error){return <main className="admin-gate"><h1>Vérification nécessaire</h1><p>{error instanceof Error?error.message:'Le serveur ne répond pas.'}</p><a className="admin-primary" href="/admin">Réessayer</a><a href="/">Vue du serveur</a></main>}
}
