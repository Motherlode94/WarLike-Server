import {identity} from '@/lib/mail';
import Access from './view';
export const dynamic='force-dynamic';
export default async function Applications(){const user=await identity();return <main style={{minHeight:'100vh',background:'#101521',color:'#eef4ff',padding:'40px 24px',fontFamily:'system-ui'}}><section style={{maxWidth:960,margin:'auto'}}><a href="/" style={{color:'#68e2be'}}>← WarLike Server</a><h1>Accès aux applications</h1><p>Autorise les comptes WarLike existants. Chaque application conserve ses propres sessions et ses données.</p>{user?.role==='owner'?<Access/>:<p>Gestion réservée au propriétaire.</p>}</section></main>}
