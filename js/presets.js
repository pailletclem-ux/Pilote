/**
 * presets.js — Fiches pré-remplies pour les titres déjà rencontrés dans vos relevés.
 *
 * Les ventilations des ETF (secteur / zone) sont INDICATIVES : arrondies d'après
 * les compositions publiques des indices, à vérifier et ajuster sur la fiche
 * de l'émetteur. Elles servent seulement aux graphiques de répartition.
 */

export const CLASSES = ['Actions', 'Obligations', 'Fonds euros', 'Immobilier', 'Liquidités', 'Matières premières', 'Autres'];
export const SECTORS = ['Technologie', 'Communication', 'Conso. discrétionnaire', 'Conso. de base', 'Santé', 'Finance',
  'Industrie', 'Matériaux', 'Énergie', 'Services publics', 'Immobilier', 'Autres'];
export const ZONES = ['Amérique du Nord', 'Europe', 'Asie-Pacifique', 'Pays émergents', 'Autres'];

const WORLD = {
  zone: { 'Amérique du Nord': 0.73, 'Europe': 0.15, 'Asie-Pacifique': 0.09, 'Autres': 0.03 },
  sector: { 'Technologie': 0.26, 'Finance': 0.16, 'Santé': 0.10, 'Industrie': 0.11, 'Conso. discrétionnaire': 0.10, 'Communication': 0.08, 'Autres': 0.19 },
};
const NASDAQ100 = {
  zone: { 'Amérique du Nord': 0.97, 'Europe': 0.03 },
  sector: { 'Technologie': 0.50, 'Communication': 0.16, 'Conso. discrétionnaire': 0.13, 'Santé': 0.06, 'Conso. de base': 0.06, 'Autres': 0.09 },
};
const EMERGING = {
  zone: { 'Pays émergents': 1 },
  sector: { 'Technologie': 0.24, 'Finance': 0.23, 'Conso. discrétionnaire': 0.13, 'Communication': 0.09, 'Industrie': 0.07, 'Autres': 0.24 },
};

/** Par ISIN */
export const PRESETS = {
  'FR001400ZGR7': { name: 'Amundi PEA Nasdaq-100 UCITS ETF', cls: 'Actions', ...NASDAQ100, indicative: true },
  'FR001400ZGO4': { name: 'Amundi PEA MSCI Emerging ESG UCITS ETF', cls: 'Actions', ...EMERGING, indicative: true },
  'FR0013412020': { name: 'Amundi PEA MSCI Emerging ESG Transition', cls: 'Actions', ...EMERGING, indicative: true },
  'NL0009805522': { name: 'Nebius Group', cls: 'Actions', sector: 'Technologie', zone: 'Europe' },
};

/** Par nom (supports d'assurance-vie, sans ISIN dans le relevé) */
export const NAME_PRESETS = [
  { re: /MSCI WORLD SWAP II/i, preset: { cls: 'Actions', ...WORLD, indicative: true, isinHint: 'FR0010315770' } },
  { re: /MSCI WORLD/i, preset: { cls: 'Actions', ...WORLD, indicative: true } },
  { re: /S&P ?500/i, preset: { cls: 'Actions', zone: 'Amérique du Nord', sector: { 'Technologie': 0.32, 'Finance': 0.13, 'Santé': 0.10, 'Conso. discrétionnaire': 0.10, 'Communication': 0.09, 'Autres': 0.26 }, indicative: true } },
  { re: /FONDS? (EN )?EUROS?/i, preset: { cls: 'Fonds euros', zone: 'Europe' } },
];

export function presetFor(isin, name) {
  if (isin && PRESETS[isin]) return PRESETS[isin];
  const hit = NAME_PRESETS.find((p) => p.re.test(name || ''));
  return hit ? hit.preset : null;
}
