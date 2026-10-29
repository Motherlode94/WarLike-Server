import type { Principal } from './policy.ts';
import { requestIdentity } from './identity-context.ts';
import { HttpError } from './security.ts';
import { digest } from './security-store.ts';
import { MAIL_DOMAIN, PASSWORD_ITERATIONS, mailboxStem, generatedPassword, passwordRecord, verifyPassword } from './mailbox-policy.ts';
type MailboxRow = { member_id: string; address: string; given_name: string; family_name: string; salt: string; verifier: string; credential_version: number; updated_at: number };
export async function mailboxInfo(db: D1Database, memberId: string) {
  return db.prepare('SELECT address,given_name,family_name,updated_at FROM mailboxes WHERE member_id=?').bind(memberId).first();
}
export async function hasMailboxAccess(db: D1Database, user: Principal, token = requestIdentity()?.mailboxToken) {
  // Owner and referents already administer the shared team inbox through Sites.
  if (user.role === 'owner' || user.role === 'referent') return true;
  if (!await db.prepare('SELECT member_id FROM mailboxes WHERE member_id=?').bind(user.id).first()) return true;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  return !!await db.prepare('SELECT s.token_hash FROM mailbox_sessions s JOIN mailboxes b ON b.member_id=s.member_id WHERE s.token_hash=? AND s.member_id=? AND s.credential_version=b.credential_version AND s.expires_at>?').bind(await digest(token), user.id, Date.now()).first();
}
export async function issueMailbox(db: D1Database, actor: Principal, target: Principal, given: unknown, family: unknown) {
  if (!['owner', 'referent'].includes(actor.role) || actor.role === 'referent' && target.role !== 'member' || target.role === 'owner' && actor.id !== target.id) throw new HttpError(403, 'Ce compte est protégé.');
  const stem = mailboxStem(given, family), old = await db.prepare('SELECT address FROM mailboxes WHERE member_id=?').bind(target.id).first<{ address: string }>();
  let address = old?.address || stem + '@' + MAIL_DOMAIN;
  if (!old) {
    // Stable disambiguation: two people with the same name keep distinct boxes.
    const used = await db.prepare('SELECT member_id FROM mailboxes WHERE address=?').bind(address).first();
    if (used) address = stem + '.' + target.id.replace(/^WL-/, '').toLowerCase() + '@' + MAIL_DOMAIN;
  }
  const password = generatedPassword(), record = await passwordRecord(password, target.id), now = Date.now();
  await db.batch([
    db.prepare('INSERT INTO mailboxes(member_id,address,given_name,family_name,salt,verifier,iterations,credential_version,updated_at) VALUES(?,?,?,?,?,?,?,1,?) ON CONFLICT(member_id) DO UPDATE SET given_name=excluded.given_name,family_name=excluded.family_name,salt=excluded.salt,verifier=excluded.verifier,credential_version=mailboxes.credential_version+1,updated_at=excluded.updated_at').bind(target.id, address, String(given).trim(), String(family).trim(), record.salt, record.verifier, PASSWORD_ITERATIONS, now),
    db.prepare('DELETE FROM mailbox_sessions WHERE member_id=?').bind(target.id),
    db.prepare('INSERT INTO audit_events(id,actor_id,action,target_id,detail,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), actor.id, 'mailbox.credentials.rotate', target.id, 'Identifiants de boîte créés ou renouvelés ; sessions révoquées.', now),
  ]);
  return { memberId: target.id, address, password };
}
export async function loginMailbox(db: D1Database, user: Principal, address: unknown, password: unknown) {
  const row = await db.prepare('SELECT * FROM mailboxes WHERE member_id=?').bind(user.id).first<MailboxRow>();
  if (!row || typeof address !== 'string' || row.address !== address.trim().toLowerCase() || !await verifyPassword(password, user.id, row.salt, row.verifier)) throw new HttpError(401, 'Adresse ou mot de passe incorrect.');
  const token = generatedPassword(), expires = Date.now() + 8 * 3600000;
  await db.prepare('INSERT INTO mailbox_sessions(token_hash,member_id,credential_version,expires_at) VALUES(?,?,?,?)').bind(await digest(token), user.id, row.credential_version, expires).run();
  return token;
}
export async function logoutMailbox(db: D1Database, user: Principal) {
  const token = requestIdentity()?.mailboxToken;
  if (token) await db.prepare('DELETE FROM mailbox_sessions WHERE token_hash=? AND member_id=?').bind(await digest(token), user.id).run();
}
