'use client';
import {useEffect,useState} from 'react';
type Session={createdAt:number;expiresAt:number;current:boolean;browser?:string;os?:string;device?:string};
async function request(path:string,body:object){
 const r=await fetch('/api/warlike-auth/'+path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(r.status===401){location.replace('/connexion');throw Error('Connexion requise.');}
 const raw:unknown=await r.json();if(!raw||typeof raw!=='object')throw Error('Réponse invalide.');const d=raw as Record<string,unknown>;if(!r.ok)throw Error(typeof d.error==='string'?d.error:'Action indisponible.');return d;
}
export default function Sessions(){
 const [rows,setRows]=useState<Session[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
 async function refresh(){setBusy(true);setError('');try{const d=await request('sessions',{});if(!Array.isArray(d.sessions)||!d.sessions.every((x:unknown):x is Session=>{if(!x||typeof x!=='object')return false;const v=x as Record<string,unknown>;return typeof v.createdAt==='number'&&Number.isFinite(v.createdAt)&&typeof v.expiresAt==='number'&&Number.isFinite(v.expiresAt)&&typeof v.current==='boolean'&&['browser','os','device'].every(k=>v[k]===undefined||typeof v[k]==='string');}))throw Error('Inventaire des sessions invalide.');setRows(d.sessions);setLoaded(true);}catch(e){setRows([]);setLoaded(false);setError(e instanceof Error?e.message:'Chargement impossible.');}finally{setBusy(false);}}
 useEffect(()=>{void refresh();},[]);
 async function logout(){if(!confirm('Déconnecter toutes vos sessions, y compris celle-ci ?'))return;setBusy(true);setError('');try{await request('logout-all',{confirm:true});setRows([]);location.replace('/connexion');}catch(e){setError(e instanceof Error?e.message:'Déconnexion impossible.');setBusy(false);}}
 return <main style={{minHeight:'100vh',background:'#0c111b',color:'#edf2ff',padding:'32px 16px',fontFamily:'system-ui'}}>
 <section style={{maxWidth:760,margin:'auto'}}><a href="/" style={{color:'#8ee9c8'}}>Retour au Hub</a><h1>Sécurité et sessions</h1><p>Consultez vos connexions natives actives. Les appareils sont identifiés approximativement à partir du navigateur.</p>
 <button disabled={busy} onClick={refresh}>Actualiser</button><p role="status">{busy?'Chargement…':error|| (loaded?rows.length+' sessions affichées':'')}</p>
 {loaded&&!rows.length&&<p>Aucune session active.</p>}
 {rows.map((s,i)=><article key={s.createdAt+'-'+i} style={{border:'1px solid #52647b',borderRadius:12,padding:18,margin:'12px 0',background:'#151e2c'}}><strong>{s.browser||'Navigateur inconnu'} · {s.os||'Système inconnu'}{s.current?' — Session actuelle':''}</strong><p>{s.device==='desktop'?'Ordinateur':s.device==='mobile'?'Mobile':s.device==='tablet'?'Tablette':'Appareil inconnu'}</p><p>Connexion : {new Date(s.createdAt).toLocaleString('fr-FR')} · Expiration : {new Date(s.expiresAt).toLocaleString('fr-FR')}</p></article>)}
 <p>La déconnexion globale révoque aussi les accès centralisés associés à votre compte.</p><button disabled={busy||!loaded} onClick={logout} style={{background:'#b91c1c',color:'#fff',padding:12,border:0,borderRadius:8}}>Déconnecter tous mes appareils</button><p><a href="/mot-de-passe" style={{color:'#8ee9c8'}}>Modifier mes identifiants</a></p></section></main>;
}
