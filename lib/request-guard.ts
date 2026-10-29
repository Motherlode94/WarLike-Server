import { verifyClaim } from './bridge.ts';
import { withRequestIdentity } from './identity-context.ts';
import { consumeNonce, rateLimit } from './security-store.ts';
import { HttpError, readLimitedBytes } from './security.ts';
const ORIGIN = 'https://warlike-server.vikktor7.chatgpt.site';

export async function guardRequest(request: Request, env: { DB?: D1Database; WARLIKE_BRIDGE_KEY?: string }, run: (request: Request) => Response | Promise<Response>): Promise<Response> {
  const url = new URL(request.url), api = url.pathname.startsWith('/api/');
  const signed = request.headers.has('x-warlike-identity') || request.headers.has('x-warlike-signature');
  if (signed && url.pathname !== '/api/mail') throw new HttpError(403, 'Cette interface exige une connexion directe.');
  if (!api) return withRequestIdentity(null, null, () => run(request));
  if (!['GET', 'HEAD', 'POST'].includes(request.method)) throw new HttpError(405, 'Méthode non autorisée.');
  if (request.method === 'POST') {
    const origin = request.headers.get('origin');
    if (!origin || ![url.origin, ORIGIN].includes(origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'Origine refusée.');
  }
  if (!signed && (!request.headers.get('oai-authenticated-user-id') || !request.headers.get('oai-authenticated-user-email'))) throw new HttpError(401, 'Connexion requise.');
  let bytes = new Uint8Array();
  if (request.method === 'POST') {
    const multipart = url.pathname === '/api/community' && request.headers.get('content-type')?.startsWith('multipart/form-data;');
    if (!multipart && request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new HttpError(415, 'JSON requis.');
    const limit = url.pathname === '/api/vault' ? 1500000 : multipart ? 13 * 1024 * 1024 : url.pathname === '/api/admin' ? 8192 : 40000;
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
  const subject = (claim?.user.email || request.headers.get('oai-authenticated-user-email') || '').trim().toLowerCase();
  await rateLimit(env.DB, subject, request.method + ':' + url.pathname, request.method === 'POST' ? 30 : 120);
  if (request.method === 'POST' && request.headers.get('content-type')?.startsWith('multipart/')) await rateLimit(env.DB, subject, 'media-upload', 20, 3600);
  return withRequestIdentity(claim?.user || null, token, () => run(request));
}
