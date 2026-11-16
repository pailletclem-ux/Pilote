/**
 * format.js — Formats français (montants, pourcentages, dates) et lecture des
 * nombres/dates tels qu'ils apparaissent dans les relevés.
 */

const EUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const PCT = new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });
const PCT1 = new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NUM = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });

/** 1234.56 → « 1 234,56 € » */
export const eur = (v) => (v == null || Number.isNaN(v) ? '—' : EUR.format(v));
/** Montant signé : « +12,00 € » / « −12,00 € » */
export const eurSigned = (v) => (v == null || Number.isNaN(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + EUR.format(Math.abs(v)));
/** 0.0123 → « +1,23 % » */
export const pct = (v) => (v == null || !Number.isFinite(v) ? '—' : PCT.format(v));
/** 0.123 → « 12,3 % » (sans signe, pour les poids) */
export const pct1 = (v) => (v == null || !Number.isFinite(v) ? '—' : PCT1.format(v));
/** Quantités : jusqu'à 4 décimales */
export const num = (v) => (v == null ? '—' : NUM.format(v));
/** Sens d'une variation, pour la couleur */
export const dir = (v) => (v == null ? 'flat' : v > 0.004 ? 'up' : v < -0.004 ? 'down' : 'flat');

/** Date ISO « 2026-11-16 » → « 16/11/2026 » */
export function dateFr(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
/** Date du jour au format ISO local (AAAA-MM-JJ) */
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Lit un nombre au format français : « -4 380,3 € », « 172,23546 $ », « 2 486,10 », « +75,72 € ».
 * Retourne null si la valeur est absente (« -- », vide).
 */
export function parseFrNumber(s) {
  if (s == null) return null;
  const t = String(s)
    .replace(/[  \s]/g, '')   // espaces, y compris insécables
    .replace(/[€$£]|EUR|USD|%/gi, '')
    .replace('−', '-')
    .replace(',', '.');
  if (t === '' || t === '--' || t === '-') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Devise repérée dans une chaîne de cours : « 161,82 $ » → 'USD' */
export function currencyOf(s) {
  if (/\$|USD/.test(s)) return 'USD';
  if (/£|GBP/.test(s)) return 'GBP';
  return 'EUR';
}

/** « 16/11/2026 » → « 2026-11-16 » */
export function frDateToIso(s) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

const MOIS = { 'janv': 1, 'févr': 2, 'fevr': 2, 'mars': 3, 'avr': 4, 'mai': 5, 'juin': 6, 'juil': 7, 'août': 8, 'aout': 8, 'sept': 9, 'oct': 10, 'nov': 11, 'déc': 12, 'dec': 12 };
/** Format Saxo « 13-nov.-2026 » → « 2026-11-13 » */
export function saxoDateToIso(s) {
  const m = /(\d{1,2})-([a-zéû]+)\.?-(\d{4})/i.exec(s || '');
  if (!m) return null;
  const mo = MOIS[m[2].toLowerCase().replace('.', '')];
  return mo ? `${m[3]}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

/** Échappe le HTML (noms de titres insérés dans les vues) */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
