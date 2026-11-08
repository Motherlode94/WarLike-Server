'use client';
import {useState} from 'react';

export default function Login(){
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{
   const res=await fetch('/api/warlike-auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:username,password})});
   const data=await res.json() as {error?:string};if(!res.ok)throw new Error(data.error||'Connexion impossible.');
   setPassword('');window.location.assign('/');
  }catch(e){setError(e instanceof Error?e.message:'Connexion impossible.');setPassword('');}finally{setBusy(false);}
 }
 return <main style={{minHeight:'100vh',background:'#0c111b',color:'#edf2ff',display:'grid',placeItems:'center',padding:24,fontFamily:'system-ui'}}><form onSubmit={submit} style={{width:'min(100%,400px)',background:'#151e2c',padding:32,borderRadius:18,display:'grid',gap:16}}><div style={{color:'#68e2be',fontWeight:700}}>WARLIKE / SERVER</div><h1>Connexion WarLike</h1><p>Connecte-toi avec ton compte WarLike.</p><label>Identifiant<input required autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} style={{display:'block',width:'100%',padding:12,marginTop:6,color:'#fff',background:'#0c111b',border:'1px solid #45556b',borderRadius:8}}/></label><label>Mot de passe<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} style={{display:'block',width:'100%',padding:12,marginTop:6,color:'#fff',background:'#0c111b',border:'1px solid #45556b',borderRadius:8}}/></label>{error&&<p role="alert">{error}</p>}<button disabled={busy} style={{padding:14,background:'#68e2be',color:'#101b1a',border:0,borderRadius:8,fontWeight:700}}>{busy?'Connexion…':'Se connecter'}</button></form></main>;
}
