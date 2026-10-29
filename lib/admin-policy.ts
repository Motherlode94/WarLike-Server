import {HttpError} from './security.ts';
import type {Principal} from './policy';
export type ServicePolicy={maintenance:boolean;message:string};
export class AdminAccessError extends HttpError{constructor(message:string,status:number){super(status,message)}}
export function assertManager(user:Principal){if(!['owner','referent'].includes(user.role))throw new AdminAccessError('Administration réservée au propriétaire et au référent.',403)}
export function assertAccountControl(actor:Principal,target:Principal){assertManager(actor);if(actor.id===target.id||target.role==='owner')throw new AdminAccessError('Le propriétaire et ton propre compte sont protégés.',403);if(actor.role==='referent'&&target.role!=='member')throw new AdminAccessError('Seul le propriétaire gère les autres responsables.',403)}
export function assertServiceControl(user:Principal){if(user.role!=='owner')throw new AdminAccessError('Seul le propriétaire contrôle la maintenance du serveur.',403)}
export function assertServiceAccess(user:Principal,status:string|null,policy:ServicePolicy){if(user.role!=='owner'&&status==='suspended')throw new AdminAccessError('Ton compte WarLike est suspendu. Contacte le propriétaire.',403);if(user.role==='member'&&policy.maintenance)throw new AdminAccessError(policy.message||'Le service WarLike est temporairement en maintenance.',503)}
export const activityWindow=120000;
export const recentlyActive=(lastSeen:number,now=Date.now())=>Number.isFinite(lastSeen)&&lastSeen>=now-activityWindow&&lastSeen<=now+5000;

export const accountTemplates=()=>[...Array.from({length:5},(_,i)=>({key:'tester-'+(i+1),name:'Testeur '+String(i+1).padStart(2,'0'),role:'member'})),...Array.from({length:4},(_,i)=>({key:'approver-'+(i+1),name:'Approbateur '+String(i+1).padStart(2,'0'),role:'referent'}))];
