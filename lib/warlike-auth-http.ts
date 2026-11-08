import {HttpError,readJsonObject,errorResponse} from './security.ts';
import {login,logout,session} from './warlike-auth.ts';

// This adapter is not mounted until the surrounding access gateway is migrated.
const COOKIE='__Host-warlike_session';
const MAX_AGE=8*60*60;
export function tokenFrom(request:Request):string|null {
 const cookies=request.headers.get('cookie')?.split(';')||[];
 const values=cookies.map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));
 return values.length===1?values[0].slice(COOKIE.length+1):null;
}
function response(body:unknown,status=200,cookie?:string) {
 const headers=new Headers({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
 if(cookie)headers.set('Set-Cookie',cookie);
 return Response.json(body,{status,headers});
}
function ensureOrigin(request:Request) {
 const url=new URL(request.url);
 if(url.protocol!=='https:'||request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')throw new HttpError(403,'Origine refusée.');
}
export async function authHttp(request:Request,db:D1Database,clientId:string):Promise<Response> {
 try {
  const path=new URL(request.url).pathname;
  if(path==='/api/warlike-auth/session'&&request.method==='GET')return response({user:await session(db,tokenFrom(request))});
  if(request.method!=='POST')throw new HttpError(405,'Méthode non autorisée.');
  ensureOrigin(request);
  if(path==='/api/warlike-auth/logout'){
   await logout(db,tokenFrom(request));
   return response({ok:true},200,`${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  }
  if(path!=='/api/warlike-auth/login')throw new HttpError(404,'Route introuvable.');
  const data=await readJsonObject(request,2048);
  const result=await login(db,data.login,data.password,clientId);
  return response({ok:true},200,`${COOKIE}=${result.token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`);
 }catch(e){return errorResponse(e);}
}
