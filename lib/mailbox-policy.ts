import { HttpError } from './security.ts';
export const MAIL_DOMAIN = 'warlike.maill.dev';
export const PASSWORD_ITERATIONS = 100000;
const encoder = new TextEncoder();
const b64 = (value: Uint8Array) => btoa(Array.from(value, n => String.fromCharCode(n)).join(''));
const bytes = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
export function mailboxStem(given: unknown, family: unknown) {
  const part = (value: unknown) => {
    if (typeof value !== 'string' || value.length > 80) throw new HttpError(400, 'Prénom et nom requis.');
    const result = value.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!result || result.length > 22) throw new HttpError(400, 'Utilise un prénom et un nom de 22 caractères maximum après normalisation.');
    return result;
  };
  return part(given) + '.' + part(family);
}
export function generatedPassword() { return b64(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
async function passwordKey(password: string, salt: string) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: bytes(salt), iterations: PASSWORD_ITERATIONS, hash: 'SHA-256' }, material, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign', 'verify']);
}
const purpose = (memberId: string) => encoder.encode('WarLike Mail / generated credentials / v1 / ' + memberId);
export async function passwordRecord(password: string, memberId: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(password)) throw new HttpError(400, 'Mot de passe généré invalide.');
  const salt = b64(crypto.getRandomValues(new Uint8Array(32)));
  const verifier = b64(new Uint8Array(await crypto.subtle.sign('HMAC', await passwordKey(password, salt), purpose(memberId))));
  return { salt, verifier };
}
export async function verifyPassword(password: unknown, memberId: string, salt: string, verifier: string) {
  if (typeof password !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(password)) return false;
  try { return await crypto.subtle.verify('HMAC', await passwordKey(password, salt), bytes(verifier), purpose(memberId)); } catch { return false; }
}
