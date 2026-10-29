import {identity} from '@/lib/mail';
import {chatGPTSignInPath} from '../chatgpt-auth';
import PdfEditor from './editor';
import './pdf.css';
export const dynamic='force-dynamic';
export const metadata={title:'WarLike PDF — Éditeur de documents'};
export default async function PdfPage(){try{const user=await identity();if(!user)return <main className="pdf-gate"><span>WARLIKE PDF</span><h1>Des documents,<br/>à ta manière.</h1><p>Organise, annote et exporte tes PDF directement dans le navigateur.</p><a href={chatGPTSignInPath('/pdf')} target="_top">Se connecter avec ChatGPT →</a></main>;return <PdfEditor name={user.name}/>}catch(e){return <main className="pdf-gate"><h1>Connexion indisponible</h1><p>{(e as Error).message}</p><a href="/pdf">Réessayer</a><a href="/inscription" style={{marginTop:18}}>Mon inscription / Retour au hub</a></main>}}
