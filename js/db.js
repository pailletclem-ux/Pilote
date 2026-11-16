/**
 * db.js — Stockage local (IndexedDB). Les données ne quittent jamais l'appareil,
 * sauf export volontaire d'une sauvegarde chiffrée.
 *
 * Tables :
 *   accounts     enveloppes (PEA, AV, CTO, comptes bancaires)          clé : id
 *   instruments  fiches titres (ISIN, classe, secteur, zone, cours…)    clé : id
 *   orders       ordres exécutés importés                              clé : ref
 *   openings     positions de départ saisies à la main                 clé : id
 *   snapshots    relevés « photo » (assurance-vie, Saxo)               clé : id
 *   prices       historique de cours (module cours, à venir)           clé : id (isin|date)
 *   imports      journal des imports                                   clé : id
 *   settings     réglages                                              clé : key
 */

const DB_NAME = 'pilote';
const DB_VERSION = 1;
export const STORES = {
  accounts: 'id', instruments: 'id', orders: 'ref', openings: 'id',
  snapshots: 'id', prices: 'id', imports: 'id', settings: 'key',
};

let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const [name, keyPath] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

/** Exécute une fonction dans une transaction et attend sa fin. */
async function tx(stores, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result;
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
    result = fn(t);
  });
}

const reqP = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export async function getAll(store) {
  const db = await open();
  return reqP(db.transaction(store).objectStore(store).getAll());
}

export function put(store, value) {
  return tx([store], 'readwrite', (t) => { t.objectStore(store).put(value); });
}

export function putMany(store, values) {
  return tx([store], 'readwrite', (t) => { const s = t.objectStore(store); values.forEach((v) => s.put(v)); });
}

export function remove(store, key) {
  return tx([store], 'readwrite', (t) => { t.objectStore(store).delete(key); });
}

/** Charge toute la base en mémoire (volume faible : quelques milliers de lignes au plus). */
export async function loadAll() {
  const out = {};
  for (const name of Object.keys(STORES)) out[name] = await getAll(name);
  return out;
}

/** Remplace tout le contenu de la base (restauration d'une sauvegarde). */
export function replaceAll(data) {
  const names = Object.keys(STORES);
  return tx(names, 'readwrite', (t) => {
    for (const name of names) {
      const s = t.objectStore(name);
      s.clear();
      (data[name] || []).forEach((v) => s.put(v));
    }
  });
}

/** Efface toutes les données de l'appareil. */
export function clearAll() {
  return replaceAll({});
}

/** Identifiant aléatoire court */
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
