'use client';
import {useState} from 'react';
export default function Approve({challenge,state}:{challenge:string;state:string}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function accept(){
  setBusy(true);setError('');
  try{
    const response=await fetch('/api/heart/authorize',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({challenge,state})});
    const data=await response.json() as {redirect?:string;error?:string};
    if(!response.ok||typeof data.redirect!=='string'||!data.redirect.startsWith('https://warlike-heart.pages.dev/#'))throw Error(data.error||'Association impossible.');
    window.location.assign(data.redirect);
  }catch(e){setError(e instanceof Error?e.message:'Erreur.');setBusy(false);}
 }
 return <div><button disabled={busy} onClick={accept} style={{padding:12,background:'#e476a9',border:0,borderRadius:8}}>{busy?'Association…':'Autoriser WarLike Heart'}</button>{error&&<p role="alert">{error}</p>}<p>Tu peux refuser en fermant cette page.</p></div>;
}
