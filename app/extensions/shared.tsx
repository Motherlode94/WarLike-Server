'use client';
import {useEffect,useState} from 'react';
export function useSaved<T>(key:string,initial:T,validate:(value:unknown)=>T){
 const [value,setValue]=useState(initial),[ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setReady(false);try{const raw=localStorage.getItem(key);setValue(raw?validate(JSON.parse(raw)):initial);setError('');setReady(true)}catch(e){setError((e as Error).message)}},[key]);
 function save(next:T){const checked=validate(next);setValue(checked);try{localStorage.setItem(key,JSON.stringify(checked));setError('')}catch{setError('Enregistrement local impossible. Exporte une copie avant de fermer.')}}
 return {value,save,ready,error};
}
export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
export function download(content:string,name:string,type:string){downloadBlob(new Blob([content],{type}),name)}
export const uid=()=>Array.from(crypto.getRandomValues(new Uint8Array(12)),n=>n.toString(16).padStart(2,'0')).join('');
export const Status=({error}:{error:string})=>error?<p className="hub-notice error" role="alert">{error}</p>:null;
