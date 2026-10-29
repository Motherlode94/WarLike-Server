import type {ForwardedUser} from './bridge.ts';
import {resolveMember} from './member-identity.ts';
import {checkServiceAccess} from './admin-store.ts';
import {hubMembership} from './hub-store.ts';
import {assertHubMembership} from './hub-policy.ts';
import {HttpError} from './security.ts';

const publicPages=new Set(['/','/inscription','/signin-with-chatgpt','/signout-with-chatgpt','/callback']);
export function protectedPage(path:string){
 if(publicPages.has(path))return false;
 // Build assets contain no account data. Application routes are private by default.
 if(/^\/(?:assets|_next|@vite|vendor)\//.test(path)||/^\/(?:favicon\.(?:svg|ico)|icon-\d+\.png|manifest\.webmanifest|robots\.txt)$/.test(path))return false;
 return !path.startsWith('/api/');
}
export async function authorizeApplication(db:D1Database,auth:ForwardedUser,ownerEmail:string,fromMail:boolean,url:URL){
 const user=await resolveMember(db,auth,ownerEmail.trim().toLowerCase(),fromMail);
 await checkServiceAccess(db,user);
 const enrollment=url.pathname==='/api/hub'&&url.searchParams.get('queue')!=='1';
 if(!enrollment)assertHubMembership(user,(await hubMembership(db,user)).status);
 if((/^\/(?:admin|inscriptions)(?:\/|$)/.test(url.pathname)||url.pathname==='/api/admin'||url.pathname==='/api/hub'&&url.searchParams.get('queue')==='1')&&!['owner','referent'].includes(user.role))throw new HttpError(403,'Espace réservé aux responsables.');
 if(/^\/serveur(?:\/|$)/.test(url.pathname)&&user.role!=='owner')throw new HttpError(403,'Infrastructure réservée au propriétaire.');
 return user;
}
