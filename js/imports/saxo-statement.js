/**
 * saxo-statement.js — Lecteur du PDF « Relevé de Portefeuille » Saxo Bank.
 *
 * Calé sur un relevé réel ne contenant que des liquidités :
 *   Page 1 de 10   Compte(s): Compte-titres SRD 78800/188293EUR   Généré le: 16-nov.-2026
 *   …
 *   Positions, EUR
 *   En date du
 *   13-nov.-2026
 *   Liquidités
 *   78800/188293EUR   EUR   500,00
 *   Tous les comptes   EUR   500,00   0,00 %
 *
 * LIMITE : la mise en page du tableau des titres (actions, ETF…) n'est pas encore
 * connue. Si des lignes de titres sont détectées, un avertissement est affiché et
 * seules les liquidités sont importées.
 */
import { parseFrNumber, saxoDateToIso } from '../format.js';

export function isSaxoStatementPdf(lines) {
  return lines.some((l) => /Saxo Bank/i.test(l)) && lines.some((l) => /Relev[ée] de Portefeuille|Positions, EUR/i.test(l));
}

export function parseSaxoStatement(lines) {
  const warnings = [];
  const accLine = lines.find((l) => /Compte\(s\)\s*:/i.test(l)) || '';
  const accM = /Compte\(s\)\s*:\s*(.+?)\s+(\d+\/\w+)/i.exec(accLine);
  const accName = accM ? accM[1].trim() : 'Compte-titres';
  const number = accM ? accM[2] : null;

  // Bloc « Positions, EUR » … jusqu'à « Relevé des coûts »
  const start = lines.findIndex((l) => /^Positions,\s*EUR/i.test(l.trim()));
  if (start < 0) throw new Error('Section « Positions » introuvable dans le relevé Saxo.');
  let end = lines.findIndex((l, i) => i > start && /Relev[ée] des co[ûu]ts/i.test(l));
  if (end < 0) end = lines.length;
  const block = lines.slice(start, end);

  let date = null;
  for (const l of block) { const d = saxoDateToIso(l); if (d) { date = d; break; } }

  let cash = null;
  const unknown = [];
  for (const l of block) {
    const t = l.trim();
    const m = /^Tous les comptes\s+EUR\s+([-−\d\s  ]+,\d{2})/i.exec(t);
    if (m) { cash = parseFrNumber(m[1]); continue; }
    // Lignes porteuses de montants autres que l'en-tête, les liquidités et le pied de page
    if (/\d+,\d{2}/.test(t) && !/^\d+\/\w+\s+EUR/.test(t) && !/^(Page|Devise|Saxo Bank)/i.test(t) && !saxoDateToIso(t)) unknown.push(t);
  }
  if (cash == null) warnings.push('Solde de liquidités introuvable.');
  if (unknown.length) {
    warnings.push(`Le relevé contient ${unknown.length} ligne(s) de titres dont le format n’est pas encore pris en charge : seules les liquidités sont importées. Envoyez ce relevé pour que le lecteur soit complété.`);
  }

  return {
    kind: 'saxo-snapshot',
    account: { key: `CTO-${number}`, type: 'CTO', name: 'Saxo', label: accName, number, institution: 'Saxo Bank' },
    date,
    snapshot: { date, total: cash || 0, cash: cash || 0, positions: [] },
    warnings,
  };
}
