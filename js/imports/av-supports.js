/**
 * av-supports.js — Lecteur du PDF « Répartition des supports » de l'assurance-vie.
 *
 * Texte réel observé (une fois remis en lignes par pdf-text.js) :
 *   Mis à jour le 16/11/2026
 *   M CLEMENT PAILLET - Assuré
 *   Oriance - n°00221231805
 *   RÉPARTITION DES SUPPORTS
 *   Valorisation : 2 486,10 €
 *   MUF-AM MSCI WORLD SWAP II UCITS ETF   Valorisation : 2 486,10 €
 *   Répartition : 100,00 %   Dont +/- values potentielles : +75,72 €
 *   Performance dans le contrat : +6,59 %
 *
 * Le relevé ne donne ni ISIN ni nombre de parts : les supports sont rattachés
 * à une fiche titre par leur nom (l'ISIN peut être complété dans l'app).
 */
import { parseFrNumber, frDateToIso } from '../format.js';

export function isAvSupportsPdf(lines) {
  return lines.some((l) => /R[ÉE]PARTITION DES SUPPORTS/i.test(l));
}

const AMOUNT = '([+\\-−]?[\\d\\s\\u00a0\\u202f]+,\\d{2})\\s*€';

export function parseAvSupports(lines) {
  const warnings = [];
  const date = frDateToIso((lines.find((l) => /Mis à jour le/i.test(l)) || ''));

  // « Oriance - n°00221231805 » → nom du contrat + numéro
  let product = 'Assurance-vie', number = null;
  for (const l of lines) {
    const m = /^\s*(.+?)\s*-\s*n°\s*([\w-]+)/i.exec(l);
    if (m) { product = m[1].trim(); number = m[2]; break; }
  }

  let total = null;
  const positions = [];
  let cur = null;
  const reVal = new RegExp(`^(.*?)\\s*Valorisation\\s*:\\s*${AMOUNT}`, 'i');
  for (const l of lines) {
    const v = reVal.exec(l);
    if (v) {
      const name = v[1].trim();
      const value = parseFrNumber(v[2]);
      if (!name) { if (total == null) total = value; continue; }   // ligne de total du contrat
      cur = { name, value, weight: null, pv: null, perf: null };
      positions.push(cur);
      continue;
    }
    if (!cur) continue;
    const w = /R[ée]partition\s*:\s*([\d,]+)\s*%/i.exec(l);
    if (w) cur.weight = parseFrNumber(w[1]) / 100;
    const pv = new RegExp(`values potentielles\\s*:\\s*${AMOUNT}`, 'i').exec(l);
    if (pv) cur.pv = parseFrNumber(pv[1]);
    const pf = /Performance dans le contrat\s*:\s*([+\-−]?[\d,]+)\s*%/i.exec(l);
    if (pf) cur.perf = parseFrNumber(pf[1]) / 100;
  }

  if (!positions.length) throw new Error('Aucun support trouvé dans ce relevé d’assurance-vie.');
  const sum = positions.reduce((s, p) => s + (p.value || 0), 0);
  if (total == null) total = sum;
  else if (Math.abs(sum - total) > 0.05) {
    warnings.push(`La somme des supports (${sum.toFixed(2)} €) diffère de la valorisation du contrat (${total.toFixed(2)} €) : un support n’a peut-être pas été lu.`);
  }

  return {
    kind: 'av-snapshot',
    account: { key: `AV-${number}`, type: 'AV', name: `Assurance-vie ${product}`, label: product, number, institution: product },
    date,
    snapshot: { date, total, cash: 0, positions },
    warnings,
  };
}
