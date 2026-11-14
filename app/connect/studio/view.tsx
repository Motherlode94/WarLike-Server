'use client';
import {useState} from 'react';
export default function Approve({challenge,state}:{challenge:string;state:string}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function consent(){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/studio/authorize',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({challenge,state})});
   const out=await r.json() as {redirect?:string;error?:string};
   if(!r.ok||typeof out.redirect!=='string'||!out.redirect.startsWith('https://warlike-studio.pages.dev/#'))throw Error(out.error||'Échec de l’association');
   location.assign(out.redirect);
  }catch(e){setError(e instanceof Error?e.message:'Échec');setBusy(false);}
 }
 return <><button disabled={busy} onClick={consent}>{busy?'Autorisation…':'Autoriser Studio'}</button>{error&&<p role="alert">{error}</p>}</>;
}
