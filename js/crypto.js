/**
 * crypto.js — Sauvegardes chiffrées (fichier .pilote).
 *
 * Chiffrement AES-256-GCM ; clé dérivée du mot de passe par PBKDF2-SHA-256
 * (310 000 itérations, sel aléatoire). Le mot de passe n'est jamais stocké :
 * s'il est perdu, la sauvegarde est irrécupérable.
 */

const ITER = 310000;
const enc = new TextEncoder();
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(password, salt, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Objet JS → texte JSON chiffré prêt à être enregistré. */
export async function encryptBackup(obj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITER);
  const plain = enc.encode(JSON.stringify(obj));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  // b64 par morceaux pour éviter les dépassements de pile sur les gros fichiers
  let data = '';
  for (let i = 0; i < cipher.length; i += 0x8000) data += String.fromCharCode(...cipher.subarray(i, i + 0x8000));
  return JSON.stringify({ format: 'pilote-backup', version: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), data: btoa(data) });
}

/** Texte du fichier .pilote → objet JS. Lève une erreur si le mot de passe est faux. */
export async function decryptBackup(text, password) {
  let f;
  try { f = JSON.parse(text); } catch { throw new Error('Ce fichier n’est pas une sauvegarde Pilote.'); }
  if (f.format !== 'pilote-backup') throw new Error('Ce fichier n’est pas une sauvegarde Pilote.');
  const key = await deriveKey(password, unb64(f.salt), f.iter);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(f.iv) }, key, unb64(f.data));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error('Mot de passe incorrect ou fichier endommagé.');
  }
}
