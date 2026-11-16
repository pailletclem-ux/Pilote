/**
 * store.js — Données en mémoire + opérations métier (enregistrement d'un import,
 * fiches titres, positions de départ…). Chaque modification est écrite dans
 * IndexedDB puis signalée à l'interface.
 */
import * as db from './db.js';
import { instrumentId } from './calc.js';
import { presetFor } from './presets.js';
import { todayIso } from './format.js';

export const data = { accounts: [], instruments: [], orders: [], openings: [], snapshots: [], prices: [], imports: [], settings: [] };
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((fn) => fn());

export async function load() {
  Object.assign(data, await db.loadAll());
  emit();
}

export function setting(key, fallback) {
  const s = data.settings.find((x) => x.key === key);
  return s ? s.value : fallback;
}
export async function setSetting(key, value) {
  const rec = { key, value };
  const i = data.settings.findIndex((x) => x.key === key);
  if (i >= 0) data.settings[i] = rec; else data.settings.push(rec);
  await db.put('settings', rec);
}

const ORDER = { PEA: 1, AV: 2, CTO: 3, BANK: 4 };
const ICON = { PEA: 'PEA', AV: 'AV', CTO: 'CTO', BANK: '€' };

/** Retrouve ou crée l'enveloppe correspondant à un relevé. */
async function ensureAccount(acc) {
  let a = data.accounts.find((x) => x.key === acc.key);
  if (!a) {
    a = { id: db.uid(), key: acc.key, type: acc.type, name: acc.name, label: acc.label, number: acc.number,
      institution: acc.institution, icon: ICON[acc.type] || '€', order: ORDER[acc.type] || 9, cash: 0 };
    data.accounts.push(a);
    await db.put('accounts', a);
  }
  return a;
}

/** Crée la fiche d'un titre s'il est inconnu, pré-remplie si possible. */
async function ensureInstrument(isin, name) {
  const id = instrumentId(isin, name);
  if (data.instruments.some((i) => i.id === id)) return;
  const p = presetFor(isin, name) || {};
  const inst = {
    id, isin: isin || p.isinHint || '', name: p.name || name, ticker: '',
    cls: p.cls || '', sector: p.sector || '', zone: p.zone || '', indicative: !!p.indicative,
    isinToCheck: !isin && !!p.isinHint,
  };
  data.instruments.push(inst);
  await db.put('instruments', inst);
}

/**
 * Prépare le bilan d'un import avant confirmation (aucune écriture).
 * Pour les ordres : nouveaux vs déjà présents (clé = référence de l'ordre).
 */
export function previewImport(res) {
  const existing = data.accounts.find((a) => a.key === res.account.key);
  if (res.kind === 'pea-orders') {
    const known = new Set(data.orders.map((o) => o.ref));
    const fresh = res.orders.filter((o) => !known.has(o.ref));
    return { existing, fresh: fresh.length, dup: res.orders.length - fresh.length };
  }
  const already = existing && data.snapshots.some((s) => s.accountId === existing.id && s.date === res.date);
  return { existing, already };
}

/** Enregistre un import confirmé. */
export async function commitImport(res, fileName) {
  const acc = await ensureAccount(res.account);
  let summary;
  if (res.kind === 'pea-orders') {
    const known = new Set(data.orders.map((o) => o.ref));
    const fresh = res.orders.filter((o) => !known.has(o.ref)).map((o) => ({ ...o, accountId: acc.id }));
    for (const o of fresh) await ensureInstrument(o.isin, o.name);
    data.orders.push(...fresh);
    await db.putMany('orders', fresh);
    summary = `${fresh.length} ordre(s) ajouté(s), ${res.orders.length - fresh.length} déjà connu(s)`;
  } else {
    const id = `${acc.id}|${res.date}`;
    const snap = { id, accountId: acc.id, ...res.snapshot };
    for (const p of snap.positions) await ensureInstrument(p.isin, p.name);
    const i = data.snapshots.findIndex((s) => s.id === id);
    if (i >= 0) data.snapshots[i] = snap; else data.snapshots.push(snap);
    await db.put('snapshots', snap);
    const what = snap.positions.length ? `${snap.positions.length} ligne(s)` : 'liquidités';
    summary = `Relevé du ${res.date.split('-').reverse().join('/')} importé : ${what}`;
  }
  const log = { id: db.uid(), at: new Date().toISOString(), fileName, kind: res.kind, accountId: acc.id, date: res.date, summary, warnings: res.warnings };
  data.imports.push(log);
  await db.put('imports', log);
  emit();
  return { acc, summary };
}

export async function saveInstrument(inst) {
  const i = data.instruments.findIndex((x) => x.id === inst.id);
  if (i >= 0) data.instruments[i] = inst; else data.instruments.push(inst);
  await db.put('instruments', inst);
  emit();
}

export async function saveAccount(acc) {
  const i = data.accounts.findIndex((x) => x.id === acc.id);
  if (i >= 0) data.accounts[i] = acc; else data.accounts.push(acc);
  await db.put('accounts', acc);
  emit();
}

/** Remplace toutes les positions de départ d'une enveloppe. */
export async function saveOpenings(accountId, rows) {
  for (const o of data.openings.filter((x) => x.accountId === accountId)) await db.remove('openings', o.id);
  data.openings = data.openings.filter((x) => x.accountId !== accountId);
  const recs = rows.map((r) => ({ id: db.uid(), accountId, date: r.date || todayIso(), isin: r.isin, name: r.name, qty: r.qty, pru: r.pru }));
  for (const r of recs) await ensureInstrument(r.isin, r.name);
  data.openings.push(...recs);
  await db.putMany('openings', recs);
  emit();
}

/** Supprime une enveloppe et tout ce qui s'y rattache. */
export async function deleteAccount(accountId) {
  for (const store of ['orders', 'openings', 'snapshots', 'imports']) {
    const key = db.STORES[store];
    for (const r of data[store].filter((x) => x.accountId === accountId)) await db.remove(store, r[key]);
    data[store] = data[store].filter((x) => x.accountId !== accountId);
  }
  await db.remove('accounts', accountId);
  data.accounts = data.accounts.filter((a) => a.id !== accountId);
  emit();
}

export async function exportData() {
  return { app: 'pilote', exportedAt: new Date().toISOString(), data: await db.loadAll() };
}
export async function importData(payload) {
  if (payload?.app !== 'pilote' || !payload.data) throw new Error('Contenu de sauvegarde invalide.');
  await db.replaceAll(payload.data);
  await load();
}
export async function wipe() {
  await db.clearAll();
  await load();
}
