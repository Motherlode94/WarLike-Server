import {assertUnambiguousPath,limitApiRequest,requestRateScope} from './request-security.ts';
import {authorizeApplication,authorizePrincipal,protectedPage} from './application-access.ts';
import { verifyClaim } from './bridge.ts';
import { withRequestIdentity,withWarLikeIdentity,withWarLikeAnonymous } from './identity-context.ts';
import { consumeNonce, rateLimit } from './security-store.ts';
import { HttpError, readLimitedBytes } from './security.ts';
import {authHttp,tokenFrom} from './warlike-auth-http.ts';
import {session,mustChange} from './warlike-auth.ts';
import {studioPrincipal, revokeStudioToken} from './studio-pairing.ts';
const ORIGIN = 'https://warlike-server.vikktor7.chatgpt.site';

export async function guardRequest(request: Request, env: { DB?: D1Database; WARLIKE_BRIDGE_KEY?: string; WARLIKE_OWNER_EMAIL?: string; WARLIKE_AUTH_ENABLED?: string; WARLIKE_BOOTSTRAP_SECRET?: string }, run: (request: Request) => Response | Promise<Response>, development=false): Promise<Response> {
  const url = new URL(request.url), api = url.pathname.startsWith('/api/');
  assertUnambiguousPath(url);
  // Never dispatch HTTP tracing or tunnel methods, including on public pages.
  if (['TRACE','TRACK','CONNECT'].includes(request.method.toUpperCase())) throw new HttpError(405,'Méthode non autorisée.');
  // Only the operational health endpoint is public. Never expose private mailbox data here.
  if (url.pathname === '/api/health' && request.method === 'GET') {
    return withRequestIdentity(null, null, () => run(request));
  }
  // Pairing code redemption is intentionally public to the Heart backend:
  // a valid one-time PKCE verifier is the credential, never the user's cookie.
  // The endpoint itself validates and atomically consumes the code.
  if (url.pathname === '/api/heart/exchange') {
    if (request.method !== 'POST') throw new HttpError(405,'Méthode non autorisée.');
    if (!env.DB) throw new HttpError(503,'Base de données indisponible.');
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new HttpError(415,'JSON requis.');
    const bytes=await readLimitedBytes(request,2048);
    await rateLimit(env.DB,request.headers.get('cf-connecting-ip')||'unknown-client','heart-code-exchange',20,900);
    return withWarLikeAnonymous(()=>run(new Request(request,{body:bytes})));
  }
  // Studio pairing code exchange: one-use PKCE credential, not a browser identity header.
  if(url.pathname==='/api/studio/exchange'){
    if(request.method!=='POST'||!env.DB)throw new HttpError(503,'Échange Studio indisponible.');
    if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new HttpError(415,'JSON requis.');
    const bytes=await readLimitedBytes(request,2048);
    await rateLimit(env.DB,request.headers.get('cf-connecting-ip')||'unknown-client','studio-code-exchange',20,900);
    return withWarLikeAnonymous(()=>run(new Request(request,{body:bytes})));
  }
  // Private Studio API accepts only opaque revocable bearer credentials for its proxy.
  if(url.pathname.startsWith('/api/studio/')&&url.pathname!=='/api/studio/authorize'){
    const bearer=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    if(bearer){
      if(!env.DB)throw new HttpError(503,'Base de données indisponible.');
      const principal=await studioPrincipal(env.DB,bearer);
      if(!principal)throw new HttpError(401,'Session Studio invalide.');
      await authorizePrincipal(env.DB,principal,url);
      await limitApiRequest(env.DB,principal.id,request);
      if(!['GET','HEAD','POST','PUT','DELETE'].includes(request.method))throw new HttpError(405,'Méthode non autorisée.');
      if(['POST','PUT','DELETE'].includes(request.method)){
        if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json' && !request.headers.get('content-type')?.startsWith('multipart/form-data;'))throw new HttpError(415,'Format requis.');
        const bytes=await readLimitedBytes(request,request.headers.get('content-type')?.startsWith('multipart/form-data;')?13*1024*1024:900000);
        request=new Request(request,{body:bytes});
      }
      await rateLimit(env.DB,principal.id,'studio:'+requestRateScope(request.method,url.pathname),60);
      return withWarLikeIdentity(principal,()=>run(request));
    }
  }
  const enabled=env.WARLIKE_AUTH_ENABLED==='true';
  if(enabled&&!env.DB)throw Error('Database unavailable');
  if(enabled&&url.pathname.startsWith('/api/warlike-auth/')){
    if(!env.DB)throw Error('Database unavailable');
    return authHttp(request,env.DB,request.headers.get('cf-connecting-ip')||'unknown-client',{secret:env.WARLIKE_BOOTSTRAP_SECRET,ownerEmail:env.WARLIKE_OWNER_EMAIL});
  }
  if(enabled&&['/connexion','/configuration'].includes(url.pathname))return withWarLikeAnonymous(()=>run(request));
  const signed = request.headers.has('x-warlike-identity') || request.headers.has('x-warlike-signature');
  if(enabled&&signed)throw new HttpError(403,'Ancienne connexion désactivée.');
  if (signed && url.pathname !== '/api/mail') throw new HttpError(403, 'Cette interface exige une connexion directe.');
  const page=!development&&protectedPage(url.pathname);
  if(enabled&&!signed&&env.DB){
    const principal=await session(env.DB,tokenFrom(request));
    if(principal){
      if(api||page)await authorizePrincipal(env.DB,principal,url);
      if((api||page||url.pathname==='/')&&await mustChange(env.DB,principal.id)&&!['/mot-de-passe','/deconnexion'].includes(url.pathname)){
        if(api)throw new HttpError(403,'Modifie tes identifiants temporaires avant de continuer.');
        return new Response(null,{status:303,headers:{Location:'/mot-de-passe','Cache-Control':'no-store'}});
      }
      if(!['GET','HEAD','POST'].includes(request.method)&&!(url.pathname.startsWith('/api/studio/projects/')&&['PUT','DELETE'].includes(request.method)))throw new HttpError(405,'Méthode non autorisée.');
      if(['POST','PUT','DELETE'].includes(request.method)&&(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site'))throw new HttpError(403,'Origine refusée.');
      if(api)await limitApiRequest(env.DB,principal.id,request);
      if(['POST','PUT','DELETE'].includes(request.method)){
        const multipart=(url.pathname==='/api/community'||/^\/api\/studio\/projects\/[0-9a-f-]{36}\/assets$/.test(url.pathname))&&request.headers.get('content-type')?.startsWith('multipart/form-data;');
        if(!multipart&&request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new HttpError(415,'JSON requis.');
        const limit=multipart?13*1024*1024:url.pathname.startsWith('/api/studio/projects')?900000:url.pathname==='/api/vault'?1500000:['/api/admin','/api/hub'].includes(url.pathname)?8192:40000;
        const bytes=await readLimitedBytes(request,limit);
        request=new Request(request,{body:bytes});
      }
      await rateLimit(env.DB,principal.id,requestRateScope(request.method,url.pathname),request.method==='POST'?30:120);
      return withWarLikeIdentity(principal,()=>run(request));
    }
    if(api)throw new HttpError(401,'Connexion WarLike requise.');
    if(page)return new Response(null,{status:303,headers:{Location:'/connexion'}});
    return withWarLikeAnonymous(()=>run(request));
  }
  // Provider identity headers are trusted only behind the canonical Sites gateway.
  // Workers, Pages and lookalike hosts must use WarLike sessions or the signed Mail bridge.
  if (!development && url.origin !== ORIGIN && !signed && (api || page)) throw new HttpError(401, 'Accès privé requis : utilise WarLike Server avec une identité authentifiée.');
  if (!api&&!page) return withRequestIdentity(null, null, () => run(request));
  if (!['GET', 'HEAD', 'POST'].includes(request.method)) throw new HttpError(405, 'Méthode non autorisée.');
  if (request.method === 'POST') {
    const origin = request.headers.get('origin');
    if (!origin || ![url.origin, ORIGIN].includes(origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'Origine refusée.');
  }
  if (!signed && (!request.headers.get('oai-authenticated-user-id') || !request.headers.get('oai-authenticated-user-email'))) {if(page)return new Response(null,{status:303,headers:{Location:'/signin-with-chatgpt?return_to='+encodeURIComponent(url.pathname+url.search)}});throw new HttpError(401, 'Connexion requise.');}
  let bytes = new Uint8Array();
  if (request.method === 'POST') {
    const multipart = url.pathname === '/api/community' && request.headers.get('content-type')?.startsWith('multipart/form-data;');
    if (!multipart && request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new HttpError(415, 'JSON requis.');
    const limit = url.pathname === '/api/vault' ? 1500000 : multipart ? 13 * 1024 * 1024 : ['/api/admin','/api/hub'].includes(url.pathname) ? 8192 : 40000;
    bytes = await readLimitedBytes(request, limit);
    request = new Request(request, { body: bytes });
  }
  const token = request.headers.get('x-warlike-mailbox-session');
  if (token && !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new HttpError(401, 'Session de boîte invalide.');
  const claim = signed ? await verifyClaim(request.headers, env.WARLIKE_BRIDGE_KEY || '', {
    method: request.method, path: url.pathname + url.search,
    body: new TextDecoder('utf-8', { fatal: true }).decode(bytes), mailboxToken: token || '',
  }) : null;
  if (signed && !claim) throw new HttpError(401, 'Signature de requête invalide ou expirée.');
  if (!env.DB) throw Error('Database unavailable');
  if (claim) await consumeNonce(env.DB, claim.nonce, claim.expires);
  const auth=claim?.user||{userId:request.headers.get('oai-authenticated-user-id')!,email:request.headers.get('oai-authenticated-user-email')!,fullName:null,displayName:request.headers.get('oai-authenticated-user-email')!};
  if(!env.WARLIKE_OWNER_EMAIL)throw Error('Owner configuration unavailable');
  try{await authorizeApplication(env.DB,auth,env.WARLIKE_OWNER_EMAIL,!!claim,url)}catch(error){if(page&&error instanceof HttpError&&error.status===403)return new Response(null,{status:303,headers:{Location:'/inscription'}});throw error;}
  const subject = (claim?.user.email || request.headers.get('oai-authenticated-user-email') || '').trim().toLowerCase();
  await limitApiRequest(env.DB,subject,request);
  await rateLimit(env.DB, subject, requestRateScope(request.method,url.pathname), request.method === 'POST' ? url.pathname==='/api/mail'?90:30 : 120);
  return withRequestIdentity(claim?.user || null, token, () => run(request));
}
