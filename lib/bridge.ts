export type ForwardedUser = { userId: string; email: string; fullName: string | null; displayName: string };
export type SignedRequest = { method: string; path: string; body?: string; mailboxToken?: string };
export type IdentityClaim = { version: 2; client: string; issuedAt: number; expires: number; nonce: string; user: ForwardedUser; request: { method: string; path: string; digest: string; session: string } };
const encoder = new TextEncoder();
const encode = (bytes: Uint8Array) => btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
const decode = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
async function key(secret: string) { if (secret.length < 32) throw Error('Signing key unavailable'); return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); }
async function hash(value: string) { return encode(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
async function binding(request: SignedRequest) { return { method: request.method.toUpperCase(), path: request.path, digest: await hash(request.body || ''), session: await hash(request.mailboxToken || '') }; }
export async function signIdentity(user: ForwardedUser, secret: string, request: SignedRequest) {
  const issuedAt = Date.now();
  const claim: IdentityClaim = { version: 2, client: 'warlike-mail', issuedAt, expires: issuedAt + 30000, nonce: crypto.randomUUID(), user, request: await binding(request) };
  const payload = encode(encoder.encode(JSON.stringify(claim)));
  return { 'x-warlike-identity': payload, 'x-warlike-signature': encode(new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload)))) };
}
export async function verifyClaim(headers: Pick<Headers, 'get'>, secret: string, request: SignedRequest, now = Date.now()): Promise<IdentityClaim | null> {
  try {
    const payload = headers.get('x-warlike-identity'), signature = headers.get('x-warlike-signature');
    if (!payload || !signature || payload.length > 6000 || signature.length !== 44) return null;
    if (!await crypto.subtle.verify('HMAC', await key(secret), decode(signature), encoder.encode(payload))) return null;
    const claim = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode(payload))) as IdentityClaim;
    if (claim.version !== 2 || claim.client !== 'warlike-mail' || !Number.isSafeInteger(claim.issuedAt) || !Number.isSafeInteger(claim.expires) || claim.expires <= now || claim.issuedAt > now + 5000 || claim.expires - claim.issuedAt !== 30000 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(claim.nonce)) return null;
    const expected = await binding(request);
    if (!claim.request || Object.keys(expected).some(k => claim.request[k as keyof typeof expected] !== expected[k as keyof typeof expected])) return null;
    const user = claim.user;
    if (typeof user?.userId !== 'string' || !user.userId || user.userId.length > 200 || /[\u0000-\u001f\u007f]/.test(user.userId) || typeof user.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) || user.email.length > 254) return null;
    claim.user = { userId: user.userId, email: user.email, fullName: typeof user.fullName === 'string' ? user.fullName.slice(0, 120) : null, displayName: typeof user.displayName === 'string' ? user.displayName.slice(0, 120) : user.email };
    return claim;
  } catch { return null; }
}
export async function verifyIdentity(headers: Pick<Headers, 'get'>, secret: string, request: SignedRequest): Promise<ForwardedUser | null> { return (await verifyClaim(headers, secret, request))?.user || null; }
