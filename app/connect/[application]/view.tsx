'use client';
import {useState} from 'react';
import {suiteApplications,type SuiteApp} from '@/lib/app-contract';
export default function Approve({app,challenge,state}:{app:SuiteApp;challenge:string;state:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function consent(){
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/'+app+'/authorize',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({challenge,state})});
   const result=await response.json() as {redirect?:string;error?:string};
   if(!response.ok||typeof result.redirect!=='string'||!result.redirect.startsWith(suiteApplications[app].origin+'/#warlike_app_code='))throw Error(result.error||'Association impossible.');
   location.assign(result.redirect);
  }catch(error){setError(error instanceof Error?error.message:'Association impossible.');setBusy(false)}
 }
 return <><button type="button" disabled={busy} onClick={consent} style={{padding:'14px 22px',border:0,borderRadius:8,background:'#68e2be',color:'#101521',fontWeight:700}}>{busy?'Autorisation…':'Autoriser '+suiteApplications[app].name}</button>{error&&<p role="alert" style={{color:'#ffaaa5'}}>{error}</p>}</>;
}
