// Shared HTTP invariants. No framework dependency: exercised in Node and Workers.
export class HttpError extends Error {
  status: number; retryAfter?: number;
  constructor(status: number, message: string, retryAfter?: number) { super(message); this.status = status; this.retryAfter = retryAfter; }
}

export async function readLimitedBytes(request: Request, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new HttpError(413, 'Requête trop volumineuse.');
  if (request.headers.has('content-encoding') && request.headers.get('content-encoding') !== 'identity') throw new HttpError(415, 'Compression de requête non prise en charge.');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) { void reader.cancel().catch(() => {}); throw new HttpError(413, 'Requête trop volumineuse.'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of chunks) { bytes.set(part, offset); offset += part.byteLength; }
  return bytes;
}

export async function readJsonObject(request: Request, limit: number): Promise<Record<string, any>> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new HttpError(415, 'JSON requis.');
  const bytes = await readLimitedBytes(request, limit);
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new HttpError(400, 'JSON invalide.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Objet JSON requis.');
  return value;
}

export function errorResponse(error: unknown) {
  const id = crypto.randomUUID();
  const known = error instanceof HttpError;
  if (!known) console.error('warlike_request_failed', { id, type: error instanceof Error ? error.name : 'unknown' });
  return Response.json({ error: known ? error.message : 'Service indisponible. Réessaie dans un instant.', ...(!known ? { requestId: id } : {}) }, {
    status: known ? error.status : 500,
    headers: { 'Cache-Control': 'no-store', ...(known && error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {}) },
  });
}

export function secureResponse(response: Response, request: Request, development = false) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (!development && new URL(request.url).protocol === 'https:') headers.set('Strict-Transport-Security', 'max-age=31536000');
  if ((response.status>=300&&response.status<400) || new URL(request.url).pathname.startsWith('/api/') || headers.get('content-type')?.includes('text/html')) {
    headers.set('Cache-Control', 'private, no-store'); headers.set('Pragma', 'no-cache'); headers.delete('ETag');
  }
  if (!headers.has('Content-Security-Policy')) headers.set('Content-Security-Policy', [
    "default-src 'self'", "base-uri 'self'", "object-src 'none'",
    "frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com",
    "form-action 'self' https://chatgpt.com https://auth.openai.com",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "media-src 'self' blob: data:",
    "font-src 'self' data:", "connect-src 'self'", "worker-src 'self' blob:",
  ].join('; '));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
