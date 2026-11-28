'use client';
import {useState,useRef} from 'react';
export default function Signout(){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const pending=useRef(false);
 async function logout(){
  if(pending.current)return;pending.current=true;setBusy(true);setError('');
  try{const r=await fetch('/api/warlike-auth/logout',{method:'POST'});if(!r.ok)throw Error('Déconnexion impossible.');location.assign('/connexion');}
  catch(e){setError(e instanceof Error?e.message:'Déconnexion impossible.');pending.current=false;setBusy(false);}
 }
 return <main className="wl-auth-shell"><section className="wl-auth-card" aria-labelledby="signout-title">
  <div className="wl-auth-brand">WARLIKE / SERVER</div>
  <h1 id="signout-title">Déconnexion</h1>
  <p className="wl-auth-intro">Fermer ta session WarLike sur ce site ?</p>
  <button type="button" disabled={busy} aria-busy={busy} onClick={()=>void logout()}>{busy?'Déconnexion…':'Se déconnecter'}</button>
  {error&&<p className="wl-auth-status" role="alert">{error}</p>}
  <a className="wl-auth-back" href="/">Annuler et retourner au serveur</a>
 </section></main>;
}
