import {suiteApplications,isSuiteApp,type SuiteApp} from './app-contract.ts';
import {issueAppCode,exchangeAppCode,appPrincipal,revokeAppSession,setAppMembership,type AppPrincipal} from './app-sessions.ts';
import {personalScope,organizationScope,organizations,createOrganization,organizationMembers,setOrganizationMember,listDrafts,getDraft,createDraft,updateDraft,DRAFT_BODY_LIMIT,type DraftScope} from './app-drafts.ts';
import {validState} from './heart-pairing.ts';
import {session,mustChange} from './warlike-auth.ts';
import {tokenFrom} from './warlike-auth-http.ts';
import {authorizePrincipal} from './application-access.ts';
import {rateLimit} from './security-store.ts';
import {limitApiRequest,requestRateScope} from './request-security.ts';
import {HttpError,errorResponse,readJsonObject} from './security.ts';
import type {Principal} from './policy.ts';
export type AppEnvironment={DB?:D1Database;WARLIKE_AUTH_ENABLED?:string};
export const isAppEndpoint=(path:string)=>/^\/api\/(?:academy|business)(?:\/|$)/.test(path)||path==='/api/apps/access';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const bearer=(request:Request)=>request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
function sameOrigin(request:Request){const url=new URL(request.url);if(url.protocol!=='https:'||request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')throw new HttpError(403,'Origine refusée.')}
async function cookieUser(db:D1Database,request:Request){const user=await session(db,tokenFrom(request));if(!user)throw new HttpError(401,'Connexion WarLike requise.');await authorizePrincipal(db,user,new URL(request.url));if(await mustChange(db,user.id))throw new HttpError(403,'Remplace tes identifiants temporaires avant de continuer.');return user}
async function appUser(db:D1Database,app:SuiteApp,request:Request):Promise<AppPrincipal>{const user=await appPrincipal(db,app,bearer(request));if(!user)throw new HttpError(401,'Session de cette application absente, expirée ou révoquée.');await authorizePrincipal(db,user,new URL(request.url));return user}
async function budget(db:D1Database,user:Principal,request:Request){await limitApiRequest(db,user.id,request);await rateLimit(db,user.id,'suite:'+requestRateScope(request.method,new URL(request.url).pathname),request.method==='GET'?120:30)}

export async function applicationHttp(request:Request,env:AppEnvironment):Promise<Response>{
 const url=new URL(request.url),part=url.pathname.split('/')[2],app=isSuiteApp(part)?part:null,origin=request.headers.get('origin');
 let response:Response;
 try{
  if(!isAppEndpoint(url.pathname))throw new HttpError(404,'Route introuvable.');
  const authorize=app&&url.pathname===`/api/${app}/authorize`,admin=url.pathname==='/api/apps/access';
  if(!authorize&&!admin&&origin&&origin!==suiteApplications[app!].origin&&origin!==url.origin)throw new HttpError(403,'Origine de l’application refusée.');
  if(request.method==='OPTIONS'){
   if(!app||authorize||origin!==suiteApplications[app].origin)throw new HttpError(403,'Prévol refusé.');
   response=new Response(null,{status:204});
  }else{
   if(!env.DB||env.WARLIKE_AUTH_ENABLED!=='true')throw new HttpError(503,'Connexion WarLike ou base de données indisponible.');
   const db=env.DB;
   if(admin){
    const user=await cookieUser(db,request);if(user.role!=='owner')throw new HttpError(403,'Gestion des accès réservée au propriétaire.');await budget(db,user,request);
    if(request.method==='GET'){
     const members=(await db.prepare('SELECT id,name,role FROM members ORDER BY created_at DESC LIMIT 500').all()).results;
     const access=(await db.prepare('SELECT app_id,member_id,role,status,version FROM app_memberships LIMIT 1000').all()).results;
     response=json({members,access});
    }else if(request.method==='POST'){
     sameOrigin(request);const input=await readJsonObject(request,4096);if(!isSuiteApp(input.app))throw new HttpError(400,'Application inconnue.');
     await setAppMembership(db,user,input.app,input.memberId,input.role,input.enabled);response=json({updated:true});
    }else throw new HttpError(405,'Méthode non autorisée.');
   }else if(authorize){
    if(request.method!=='POST')throw new HttpError(405,'Méthode non autorisée.');sameOrigin(request);
    const user=await cookieUser(db,request);await budget(db,user,request);const input=await readJsonObject(request,2048);
    if(!validState(input.state))throw new HttpError(400,'État d’association invalide.');
    const code=await issueAppCode(db,app!,user,input.challenge);
    response=json({redirect:suiteApplications[app!].origin+'/#warlike_app_code='+encodeURIComponent(code)+'&state='+encodeURIComponent(input.state)+'&app='+app});
   }else if(url.pathname===`/api/${app}/exchange`){
    if(request.method!=='POST')throw new HttpError(405,'Méthode non autorisée.');
    await rateLimit(db,request.headers.get('cf-connecting-ip')||'unknown-client',app+'-code-exchange',20,900);
    const input=await readJsonObject(request,2048),issued=await exchangeAppCode(db,app!,input.code,input.verifier);
    if(!issued)throw new HttpError(401,'Code invalide, expiré, déjà utilisé ou associé à une autre application.');response=json(issued);
   }else{
    const user=await appUser(db,app!,request);await budget(db,user,request);
    if(url.pathname===`/api/${app}/me`&&request.method==='GET')response=json({userId:user.id,displayName:user.name,app,role:user.appRole,scope:suiteApplications[app!].scope});
    else if(url.pathname===`/api/${app}/revoke`&&request.method==='POST'){
     await readJsonObject(request,1024);await revokeAppSession(db,app!,bearer(request)!);response=json({revoked:true});
    }else response=await dataHttp(db,app!,user,request);
   }
  }
 }catch(error){response=errorResponse(error)}
 // Bearer-only CORS, never credentialed cross-origin cookies. Errors are readable
 // by the exact legitimate app too, including 401 after suspension/revocation.
 if(app&&origin===suiteApplications[app].origin&&url.pathname!==`/api/${app}/authorize`){
  const headers=new Headers(response.headers);headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');
  headers.set('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');headers.set('Access-Control-Allow-Headers','Authorization, Content-Type');
  response=new Response(response.body,{status:response.status,headers});
 }
 return response;
}
async function dataHttp(db:D1Database,app:SuiteApp,user:AppPrincipal,request:Request){
 const path=new URL(request.url).pathname,method=request.method,write=!['GET','HEAD'].includes(method);
 let scope:DraftScope,resourcePath:string;
 if(app==='business'){
  if(path==='/api/business/organizations'){
   if(method==='GET')return json({organizations:await organizations(db,user)});
   if(method==='POST'){const input=await readJsonObject(request,2048);return json(await createOrganization(db,user,input.name),201)}
   throw new HttpError(405,'Méthode non autorisée.');
  }
  const match=path.match(/^\/api\/business\/organizations\/([^/]+)\/(drafts(?:\/[^/]+)?|members(?:\/revoke)?)$/);
  if(!match)throw new HttpError(404,'Route introuvable.');
  scope=await organizationScope(db,user,match[1],write);resourcePath=match[2];
  if(resourcePath==='members'||resourcePath==='members/revoke'){
   if(resourcePath==='members/revoke'){if(method!=='POST')throw new HttpError(405,'Méthode non autorisée.');const input=await readJsonObject(request,4096);return json(await setOrganizationMember(db,user,match[1],input,Date.now(),true));}
   if(method==='GET')return json({members:await organizationMembers(db,user,match[1])});
   if(method==='POST'||method==='DELETE'){const input=await readJsonObject(request,4096);return json(await setOrganizationMember(db,user,match[1],input,Date.now(),method==='DELETE'))}
   throw new HttpError(405,'Méthode non autorisée.');
  }
 }else{
  const match=path.match(/^\/api\/academy\/(drafts(?:\/[^/]+)?)$/);if(!match)throw new HttpError(404,'Route introuvable.');scope=personalScope(user);resourcePath=match[1];
 }
 const id=resourcePath.split('/')[1];
 if(!id){
  if(method==='GET')return json({drafts:await listDrafts(db,scope)});
  if(method==='POST')return json(await createDraft(db,user,scope,await readJsonObject(request,DRAFT_BODY_LIMIT)),201);
 }else{
  if(method==='GET')return json(await getDraft(db,scope,id));
  if(method==='PUT'||method==='DELETE')return json(await updateDraft(db,user,scope,id,await readJsonObject(request,method==='DELETE'?1024:DRAFT_BODY_LIMIT),method==='DELETE'));
 }
 throw new HttpError(405,'Méthode non autorisée.');
}
