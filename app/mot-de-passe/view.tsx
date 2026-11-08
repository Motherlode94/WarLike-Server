'use client';
import {useState} from 'react';

export default function ChangePassword(){
 const [currentPassword,setCurrent]=useState(''),[newLogin,setLogin]=useState(''),[newPassword,setNew]=useState(''),[confirmation,setConfirmation]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState(false);
 async function submit(e:React.FormEvent){
  e.preventDefault();
  if(newPassword!==confirmation){setMessage('Les mots de passe ne correspondent pas.');return;}
  setBusy(true);setMessage('');
  try{
   const r=await fetch('/api/warlike-auth/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword,newPassword,newLogin})});
   const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error||'Modification impossible.');
   setSuccess(true);setMessage('Identifiants modifiés. Reconnecte-toi avec les nouveaux.');
  }catch(e){setMessage(e instanceof Error?e.message:'Modification impossible.');}
  finally{setCurrent('');setNew('');setConfirmation('');setBusy(false);}
 }
 const field:React.CSSProperties={display:'block',boxSizing:'border-box',width:'100%',height:48,marginTop:8,padding:'10px 12px',border:'1px solid #52647b',borderRadius:8,background:'#0c1420',color:'#f5f8ff',font:'inherit'};
 const label:React.CSSProperties={display:'block',fontSize:14,fontWeight:600,color:'#e8eef9'};
 return <main style={{display:'block',boxSizing:'border-box',width:'100%',minHeight:'100vh',padding:'48px 18px',background:'#0c111b',color:'#edf2ff',fontFamily:'system-ui, sans-serif'}}>
  <section style={{boxSizing:'border-box',width:'100%',maxWidth:500,margin:'0 auto',padding:'32px',border:'1px solid #324054',borderRadius:16,background:'#151e2c'}}>
   <div style={{color:'#68e2be',fontWeight:700,letterSpacing:'.08em',fontSize:12}}>WARLIKE / SERVER</div>
   <h1 style={{display:'block',fontSize:28,lineHeight:1.2,margin:'14px 0'}}>Changer mes identifiants</h1>
   <p style={{display:'block',color:'#b9c6d7',lineHeight:1.55,margin:'0 0 24px'}}>À la première connexion, choisis un nouvel identifiant et un nouveau mot de passe. Cette action ferme les sessions ouvertes.</p>
   {!success&&<form onSubmit={submit} style={{display:'grid',gridTemplateColumns:'minmax(0,1fr)',gap:18}}>
    <label style={label}>Nouvel identifiant<input style={field} required value={newLogin} onChange={e=>setLogin(e.target.value)} autoComplete="username"/></label>
    <label style={label}>Mot de passe actuel<input style={field} type="password" required autoComplete="current-password" value={currentPassword} onChange={e=>setCurrent(e.target.value)}/></label>
    <label style={label}>Nouveau mot de passe<input style={field} type="password" required minLength={12} maxLength={256} autoComplete="new-password" value={newPassword} onChange={e=>setNew(e.target.value)}/><small style={{display:'block',fontWeight:400,color:'#b9c6d7',marginTop:6}}>12 caractères minimum.</small></label>
    <label style={label}>Confirmer le nouveau mot de passe<input style={field} type="password" required minLength={12} maxLength={256} autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
    <button type="submit" disabled={busy} style={{display:'block',width:'100%',minHeight:48,padding:'12px 18px',background:'#68e2be',color:'#101b1a',border:0,borderRadius:8,fontWeight:700,fontSize:15,cursor:'pointer'}}>{busy?'Modification…':'Modifier mes identifiants'}</button>
   </form>}
   {message&&<p role="status" style={{display:'block',color:success?'#8ee9c8':'#ffaaa5',lineHeight:1.5,margin:'18px 0'}}>{message}</p>}
   <a href="/connexion" style={{display:'inline-block',color:'#8ee9c8',marginTop:20,textDecoration:'underline'}}>Retour à la connexion WarLike</a>
  </section>
 </main>;
}
