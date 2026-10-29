import { HttpError } from './security.ts';
export async function digest(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), n => n.toString(16).padStart(2, '0')).join('');
}
export async function consumeNonce(db: D1Database, nonce: string, expires: number, now = Date.now()) {
  const result = await db.prepare('INSERT OR IGNORE INTO security_nonces(nonce,expires_at) VALUES(?,?)').bind(nonce, expires).run();
  if (!result.meta.changes) throw new HttpError(401, 'Requête signée déjà utilisée.');
  // Bounded opportunistic cleanup; expired rows are never accepted by the verifier.
  if (Math.random() < 0.02) await db.batch([
    db.prepare('DELETE FROM security_nonces WHERE nonce IN (SELECT nonce FROM security_nonces WHERE expires_at<? LIMIT 1000)').bind(now),
    db.prepare('DELETE FROM security_windows WHERE bucket IN (SELECT bucket FROM security_windows WHERE expires_at<? LIMIT 1000)').bind(now),
    db.prepare('DELETE FROM mailbox_sessions WHERE token_hash IN (SELECT token_hash FROM mailbox_sessions WHERE expires_at<? LIMIT 1000)').bind(now),
  ]);
}
export async function rateLimit(db: D1Database, identity: string, scope: string, limit: number, seconds = 60, now = Date.now()) {
  const period = seconds * 1000, window = Math.floor(now / period), expires = (window + 1) * period;
  const bucket = await digest(identity + '\n' + scope + '\n' + window);
  const row = await db.prepare('INSERT INTO security_windows(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=security_windows.count+1 RETURNING count').bind(bucket, expires).first<{ count: number }>();
  if (!row || row.count > limit) throw new HttpError(429, 'Trop de demandes. Réessaie un peu plus tard.', Math.max(1, Math.ceil((expires - now) / 1000)));
}
