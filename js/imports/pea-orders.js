/**
 * pea-orders.js — Lecteur de l'export CSV « Liste des opérations » du PEA.
 *
 * Format réel observé (ORDERS_<contrat>_<horodatage>.csv) :
 *   l.1  Liste des opérations en cours
 *   l.2  Edition du 16/11/2026
 *   l.3  Contrat numéro : 00213668625;;;NOM PRENOM (INTEGRAL PEA)
 *   l.4  Du 16/11/2025 au 16/11/2026
 *   l.5  en-têtes : "Date de mise à jour";"Date de création";"Type d’opération";"Nom";"Isin";
 *                   "Quantité";"Montant saisi";"Modalité";"Place";"Cours d’exécution";"Montant";
 *                   "Statut";"Référence";""
 *   puis une ligne par ordre. Séparateur « ; », nombres « 7,016 € », dates AAAA-MM-JJ.
 *
 * Seuls les ordres au statut « Exécuté » sont retenus. Le « Montant » est en euros,
 * frais inclus (négatif pour un achat), même pour un titre coté en dollars.
 */
import { parseFrNumber, currencyOf, frDateToIso } from '../format.js';

/** Reconnaît le fichier à partir de son contenu. */
export function isPeaOrdersCsv(text) {
  return /Liste des op[ée]rations/i.test(text) && /Type d.op[ée]ration/i.test(text) && /R[ée]f[ée]rence/i.test(text);
}

/** Découpe une ligne CSV « ; » en respectant les guillemets. */
export function splitCsvLine(line, sep = ';') {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Normalise un intitulé de colonne (accents, apostrophes typographiques, casse). */
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'").trim();

const COLS = {
  updated: "date de mise a jour", created: "date de creation", type: "type d'operation", name: 'nom',
  isin: 'isin', qty: 'quantite', mode: 'modalite', place: 'place', price: "cours d'execution",
  amount: 'montant', status: 'statut', ref: 'reference',
};

/**
 * @param {string} text contenu du CSV
 * @returns {{kind:string, account:object, date:string|null, orders:object[], ignored:number, warnings:string[]}}
 */
export function parsePeaOrders(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const warnings = [];

  // --- En-tête : contrat, titulaire, date d'édition
  const contratLine = lines.find((l) => /Contrat num[ée]ro/i.test(l)) || '';
  const number = (/Contrat num[ée]ro\s*:\s*(\d+)/i.exec(contratLine) || [])[1] || null;
  const label = (/\(([^)]+)\)\s*$/.exec(contratLine.replace(/;+/g, ' ')) || [])[1] || 'PEA';
  const editionLine = lines.find((l) => /Edition du/i.test(l)) || '';
  const date = frDateToIso(editionLine);

  // --- Ligne des intitulés de colonnes
  const hIdx = lines.findIndex((l) => /Type d.op[ée]ration/i.test(l) && /Isin/i.test(l));
  if (hIdx < 0) throw new Error('Ligne des colonnes introuvable : ce fichier ne ressemble pas à un export d’ordres PEA.');
  const header = splitCsvLine(lines[hIdx]).map(norm);
  const col = {};
  for (const [k, label] of Object.entries(COLS)) {
    col[k] = header.indexOf(label);
  }
  for (const k of ['type', 'isin', 'qty', 'amount', 'status', 'ref']) {
    if (col[k] < 0) throw new Error(`Colonne « ${k} » absente du fichier : le format a peut-être changé.`);
  }

  // --- Ordres
  const orders = []; let ignored = 0;
  for (const raw of lines.slice(hIdx + 1)) {
    if (!raw.trim()) continue;
    const c = splitCsvLine(raw);
    const status = c[col.status] || '';
    if (!/^ex[ée]cut[ée]$/i.test(status)) { ignored++; continue; }
    const type = norm(c[col.type] || '');
    const side = type.startsWith('achat') ? 'buy' : type.startsWith('vente') ? 'sell' : null;
    const qty = parseFrNumber(c[col.qty]);
    const amount = parseFrNumber(c[col.amount]);
    if (!side || !qty || amount == null) {
      warnings.push(`Ordre ${c[col.ref] || '?'} ignoré : type ou montant illisible (« ${c[col.type]} »).`);
      ignored++; continue;
    }
    const priceRaw = col.price >= 0 ? c[col.price] : '';
    orders.push({
      ref: c[col.ref],
      date: c[col.updated] || c[col.created],   // date d'exécution ≈ date de mise à jour
      side,
      isin: (c[col.isin] || '').toUpperCase(),
      name: c[col.name] || '',
      qty,
      price: parseFrNumber(priceRaw),
      priceCcy: currencyOf(priceRaw || ''),
      amount,                                    // € signé, frais inclus
      place: col.place >= 0 ? c[col.place] : '',
    });
  }
  if (!orders.length) warnings.push('Aucun ordre exécuté dans ce fichier.');

  return {
    kind: 'pea-orders',
    account: { key: `PEA-${number}`, type: 'PEA', name: 'PEA', label, number, institution: '' },
    date,
    orders,
    ignored,
    warnings,
  };
}
