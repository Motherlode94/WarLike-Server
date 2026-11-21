'use client';
import {useState} from 'react';
export default function Registration(){
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[done,setDone]=useState(false);
 async function submit(e:React.FormEvent<HTMLFormElement>){
 e.preventDefault();if(busy||done)return;const form=e.currentTarget,d=new FormData(form);setBusy(true);setStatus('');
 try{const r=await fetch('/api/warlike-auth/registration-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:d.get('name'),email:d.get('email')})});if(!r.ok)throw Error(r.status===429?'Trop de demandes. Réessaie plus tard.':'Demande non enregistrée.');setDone(true);form.reset();setStatus('Demande reçue. Aucun compte n’est encore créé.');}catch(e){setStatus(e instanceof Error?e.message:'Service indisponible.');}finally{setBusy(false);}
 }
 return <main style={{maxWidth:480,margin:'48px auto',padding:24}}><h1>Inscription WarLike</h1><p>Demande un compte standard soumis à validation du propriétaire. Ton nom et ton adresse seront transmis à l’administrateur.</p><form onSubmit={submit}><fieldset disabled={busy||done} style={{display:'grid',gap:12}}><label>Nom<input name="name" required maxLength={80} autoComplete="name"/></label><label>Adresse de contact<input type="email" name="email" required maxLength={254} autoComplete="email"/></label><button type="submit">Envoyer la demande</button></fieldset></form><p role="status">{status}</p><a href="/connexion">Retour à la connexion</a></main>;
}
