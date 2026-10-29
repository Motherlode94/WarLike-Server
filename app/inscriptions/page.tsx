import {identity,database} from '@/lib/mail';
import {enrollmentQueue} from '@/lib/hub-store';
import Queue from './queue';
import '../hub.css';
export const dynamic='force-dynamic';
export const metadata={title:'Inscriptions — WarLike Hub'};
export default async function RequestsPage(){try{const user=await identity();if(!user)return <main className="hub-auth-shell hub-simple-gate"><h1>Connexion requise</h1><a className="hub-primary" href="/inscription">Ouvrir ma connexion</a></main>;return <Queue initial={await enrollmentQueue(database(),user)}/>}catch(e){return <main className="hub-auth-shell hub-simple-gate"><h1>Accès aux inscriptions</h1><p>{(e as Error).message}</p><a className="hub-primary" href="/">Retour au hub</a></main>}}
