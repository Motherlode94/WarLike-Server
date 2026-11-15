import {HttpError} from './security.ts';
import {rateLimit} from './security-store.ts';

export function assertUnambiguousPath(url:URL) {
 let path:string;
 try{path=decodeURIComponent(url.pathname)}catch{throw new HttpError(400,'Chemin de requête invalide.');}
 if(url.href.length>16384||url.pathname.length>2048||path.includes('//')||/[\\\x00-\x1f\x7f]/.test(path)||/%(?:25|2f|5c)/i.test(url.pathname))throw new HttpError(400,'Chemin de requête invalide.');
 // A router may decode these names after authorization has already run.
 if(path!==url.pathname&&/^\/(?:api|admin|serveur|comptes|inscriptions|connexion|configuration|mot-de-passe|deconnexion)(?:\/|$)/.test(path))throw new HttpError(400,'Chemin de requête ambigu.');
}
export async function limitApiRequest(db:D1Database,memberId:string,request:Request) {
 const write=!['GET','HEAD'].includes(request.method);
 // One budget per identity, across resource IDs and routes. Run before buffering uploads.
 await rateLimit(db,memberId,write?'api:all-writes':'api:all-reads',write?90:300);
 if(write&&request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;'))await rateLimit(db,memberId,'media-upload',20,3600);
}
export function requestRateScope(method:string,path:string) {
 return method+':'+path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,':id');
}
