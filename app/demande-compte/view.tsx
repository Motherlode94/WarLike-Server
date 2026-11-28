'use client';
import {useState} from 'react';
export default function Registration(){
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[done,setDone]=useState(false);
 async function submit(e:React.FormEvent<HTMLFormElement>){
 e.preventDefault();if(busy||done)return;const form=e.currentTarget,d=new FormData(form);setBusy(true);setStatus('');
 try{const r=await fetch('/api/warlike-auth/registration-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:d.get('name'),email:d.get('email')})});if(!r.ok)throw Error(r.status===429?'Trop de demandes. Réessaie plus tard.':'Demande non enregistrée.');setDone(true);form.reset();setStatus('Demande reçue. Aucun compte n’est encore créé.');}catch(e){setStatus(e instanceof Error?e.message:'Service indisponible.');}finally{setBusy(false);}
 }
 return <main className="wl-auth-shell">
  <section className="wl-auth-card" aria-labelledby="registration-title">
   <div className="wl-auth-brand">WARLIKE / SERVER</div>
   <h1 id="registration-title">Inscription WarLike</h1>
   <p className="wl-auth-intro">Demande un compte standard soumis à validation du propriétaire. Ton nom et ton adresse seront transmis à l’administrateur.</p>
   <form onSubmit={submit} aria-busy={busy}>
    <fieldset disabled={busy||done}>
     <label htmlFor="registration-name">Nom</label>
     <input id="registration-name" name="name" required maxLength={80} autoComplete="name" placeholder="Ton nom"/>
     <label htmlFor="registration-email">Adresse de contact</label>
     <input id="registration-email" type="email" name="email" required maxLength={254} autoComplete="email" placeholder="nom@exemple.fr"/>
     <button type="submit">{busy?'Envoi en cours…':done?'Demande envoyée':'Envoyer la demande'}</button>
    </fieldset>
   </form>
   <p className="wl-auth-status" role="status" data-success={done}>{status}</p>
   <a className="wl-auth-back" href="/connexion">← Retour à la connexion</a>
  </section>
 </main>;
}
