'use client';
import {validAppReturn} from '../../lib/app-contract';
import {useEffect,useState} from 'react';

export default function Login(){
 const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{
   const res=await fetch('/api/warlike-auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:username,password})});
   const data=await res.json() as {error?:string;mustChange?:boolean};if(!res.ok)throw new Error(data.error||'Connexion impossible.');
   setPassword('');
   const requested=new URLSearchParams(window.location.search).get('return_to')||'/';
   const safe=validAppReturn(requested)
     ?requested:'/';
   window.location.assign(data.mustChange?'/mot-de-passe?return_to='+encodeURIComponent(safe):safe);
  }catch(e){setError(e instanceof Error?e.message:'Connexion impossible.');setPassword('');}finally{setBusy(false);}
 }
 return <main className="wl-auth-shell"><section className="wl-auth-card" aria-labelledby="login-title">
  <div className="wl-auth-brand">WARLIKE / SERVER</div>
  <h1 id="login-title">Connexion WarLike</h1>
  <p className="wl-auth-intro">Connecte-toi avec ton compte WarLike.</p>
  <form onSubmit={submit} aria-busy={busy}>
   <label>Identifiant<input disabled={!ready||busy} required autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/></label>
   <label>Mot de passe<input disabled={!ready||busy} required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
   {error&&<p className="wl-auth-status" role="alert">{error}</p>}
   <button disabled={!ready||busy}>{busy?'Connexion…':'Se connecter'}</button>
   <a className="wl-auth-link" href="/demande-compte">Demander un compte WarLike</a>
  </form>
 </section></main>;
}
