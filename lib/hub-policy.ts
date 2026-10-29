import type {Principal} from './policy';
import {AdminAccessError} from './admin-policy.ts';
export type HubStatus='new'|'pending'|'active'|'declined';
export type HubApplication={id:string;name:string;subtitle:string;description:string;group:'creation'|'community'|'tools'|'team';icon:string;tone:string;path:string;external?:boolean;grant?:string;role?:'manager'|'owner'};
export const hubApplications:HubApplication[]=[
 {id:'studio',name:'WarLike Studio',subtitle:'STUDIO DE CRÉATION',description:'Retrouve ton studio et continue tes créations.',group:'creation',icon:'sliders',tone:'violet',path:'https://warlike-studio.pages.dev/',external:true,grant:'studio'},
 {id:'engine',name:'WarLike Engine',subtitle:'MOTEUR DE JEU',description:'Construis tes mondes en 2D et 3D, du hub au mode Play.',group:'creation',icon:'code',tone:'mint',path:'https://warlike-engine.pages.dev/',external:true,grant:'engine'},
 {id:'community',name:'Communauté',subtitle:'PARTAGER & DÉCOUVRIR',description:'Montre tes œuvres, écoute et échange avec les créateurs.',group:'community',icon:'users',tone:'orange',path:'/communaute'},
 {id:'mail',name:'WarLike Mail',subtitle:'MESSAGERIE',description:'Tes conversations et tes demandes, au même endroit.',group:'community',icon:'mail',tone:'blue',path:'https://warlike-mail.vikktor7.chatgpt.site',external:true},
 {id:'pdf',name:'WarLike PDF',subtitle:'DOCUMENTS',description:'Assemble, organise et annote tes documents en local.',group:'tools',icon:'file',tone:'sand',path:'/pdf'},
 {id:'vault',name:'WarLike Crypte',subtitle:'COFFRE PERSONNEL',description:'Tes accès chiffrés avec ta clé personnelle. Version expérimentale.',group:'tools',icon:'lock',tone:'violet',path:'/crypte'},
 {id:'admin',name:'Administration',subtitle:'MEMBRES & ACCÈS',description:'Les comptes, les rôles et le suivi de ton équipe.',group:'team',icon:'shield',tone:'mint',path:'/admin',role:'manager'},
 {id:'server',name:'WarLike Server',subtitle:'INFRASTRUCTURE',description:'Consulte l’état de ton serveur et de ses données.',group:'team',icon:'server',tone:'blue',path:'/serveur',role:'owner'},
];
export const publicInterests=['studio','engine','community','mail','pdf','vault'];
export function interests(value:unknown){if(!Array.isArray(value)||!value.length||value.length>6||value.some(v=>typeof v!=='string'||!publicInterests.includes(v)))throw new AdminAccessError('Choisis au moins un espace parmi ceux proposés.',400);return [...new Set(value)] as string[]}
export function mayEnterHub(user:Principal,status:HubStatus){return user.role==='owner'||user.role==='referent'||status==='active'}
export function assertHubMembership(user:Principal,status:HubStatus){if(!mayEnterHub(user,status))throw new AdminAccessError(status==='pending'?'Ton inscription au hub attend la validation de l’équipe.':status==='declined'?'Ta demande n’a pas été retenue. Tu peux consulter sa réponse dans le hub.':'Inscris-toi dans le hub pour accéder aux espaces WarLike.',403)}
export function mayOpenApplication(user:Principal|null,status:HubStatus,app:HubApplication,grants:string[]){if(!user||!mayEnterHub(user,status))return false;const manager=['owner','referent'].includes(user.role);if(app.role==='owner'&&user.role!=='owner'||app.role==='manager'&&!manager)return false;return !app.grant||manager||grants.includes(app.grant)}
