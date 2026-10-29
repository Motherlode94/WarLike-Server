import {identity} from '@/lib/mail';
import {chatGPTSignInPath} from '../chatgpt-auth';
import Vault from './vault';
import './vault.css';
export const dynamic='force-dynamic';
export const metadata={title:'WarLike Crypte — Coffre personnel'};
export default async function CryptePage(){try{const user=await identity();if(!user)return <main className="vault-gate"><span>WARLIKE CRYPTE</span><h1>Ton coffre.<br/>Ta clé.</h1><p>Connecte-toi pour ouvrir ton espace personnel.</p><a href={chatGPTSignInPath('/crypte')} target="_top">Se connecter avec ChatGPT →</a></main>;return <Vault user={user}/>}catch(e){return <main className="vault-gate"><h1>Coffre indisponible</h1><p>{(e as Error).message}</p><a href="/crypte">Réessayer</a><a href="/inscription" style={{marginTop:18}}>Mon inscription / Retour au hub</a></main>}}
