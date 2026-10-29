export type Principal={id:string;email:string;name:string;role:string};
export const manager=(user:Principal)=>user.role==='owner'||user.role==='referent';
export function mayRead(user:Principal,thread:{member_id:string}){return manager(user)||thread.member_id===user.id;}
export function text(value:unknown,max:number,label='Champ'){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(label+' invalide.');return value.trim();}
export function targets(value:unknown){if(!Array.isArray(value)||!value.length||value.length>2||value.some(v=>!['studio','engine'].includes(v)))throw Error('Choisis Studio et/ou Engine.');return [...new Set(value)] as string[];}
export function email(value:unknown){const s=text(value,254,'E-mail').toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))throw Error('Adresse e-mail invalide.');return s;}
export function roleChange(actor:Principal,target:Principal,role:unknown){if(actor.role!=='owner')throw Error('Seul le propriétaire peut nommer un référent.');if(target.role==='owner'||actor.id===target.id)throw Error('Le propriétaire conserve son rôle.');if(!['member','referent'].includes(String(role)))throw Error('Rôle invalide.');return String(role);}
export function assertOrigin(origin:string|null,url:string,hostedOrigin:string){if(!origin||![new URL(url).origin,hostedOrigin].includes(origin))throw Error('Origine de la requête refusée.');}
export const newMemberId=()=> 'WL-'+crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase();
