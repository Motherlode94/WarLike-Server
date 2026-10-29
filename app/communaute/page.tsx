import {identity} from '@/lib/mail';
import {chatGPTSignInPath} from '../chatgpt-auth';
import Community from './community';
import './community.css';
export const dynamic='force-dynamic';
export const metadata={title:'WarLike Communauté — Vos créations'};
export default async function CommunityPage(){try{const user=await identity();if(!user)return <main className="community-gate"><span>WARLIKE / COMMUNAUTÉ</span><h1>Vos créations,<br/>réunies.</h1><p>Un espace pour montrer vos jeux, vos sons et vos visuels.</p><a href={chatGPTSignInPath('/communaute')} target="_top">Se connecter avec ChatGPT →</a></main>;return <Community user={user}/>}catch(e){return <main className="community-gate"><h1>Le service est indisponible.</h1><p>{(e as Error).message}</p><a href="/communaute">Réessayer</a></main>}}
