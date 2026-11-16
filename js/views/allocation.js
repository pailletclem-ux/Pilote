/**
 * allocation.js — Répartition par classe d'actifs, secteur (poche actions) et
 * zone géographique, en global ou par enveloppe.
 */
import { data } from '../store.js';
import { portfolioView, allocation } from '../calc.js';
import { esc } from '../format.js';
import { topbar, donut, bindDonuts } from './ui.js';

let scope = 'all';

export function renderAllocation(main, nav) {
  const { views } = portfolioView(data);
  const sel = scope === 'all' ? views : views.filter((v) => v.account.id === scope);
  if (scope !== 'all' && !sel.length) { scope = 'all'; return renderAllocation(main, nav); }
  const sets = { cls: allocation(sel, data, 'cls'), sector: allocation(sel, data, 'sector'), zone: allocation(sel, data, 'zone') };
  const unclassified = Object.values(sets).some((s) => s.some(([n]) => n === 'Non classé'));
  const scopes = [['all', 'Global'], ...views.map((v) => [v.account.id, v.account.name])];

  main.innerHTML = `${topbar('Répartition', 'Par transparence sur les ETF')}
    ${views.length ? `<div class="seg glass" role="group" aria-label="Périmètre">${scopes.map(([id, n]) => `<button type="button" data-scope="${id}" aria-pressed="${scope === id}">${esc(n)}</button>`).join('')}</div>
    <div class="charts">${donut('cls', 'Classe d’actifs', sets.cls)}${donut('sector', 'Secteur · poche actions', sets.sector)}${donut('zone', 'Zone géographique', sets.zone)}</div>
    ${unclassified ? '<div class="note info"><span>« Non classé » : complétez la fiche des titres concernés (touchez une ligne dans le détail d’une enveloppe).</span></div>' : ''}
    <div class="hint">Les ETF sont ventilés selon leur composition, saisie sur leur fiche (valeurs indicatives pré-remplies pour les ETF connus).</div>`
    : '<section class="empty glass"><h2>Aucune donnée</h2><p>Importez un relevé pour voir la répartition de votre patrimoine.</p><button class="btn primary" type="button" data-go="imports">Importer un relevé</button></section>'}`;

  main.querySelectorAll('[data-scope]').forEach((b) => b.addEventListener('click', () => { scope = b.dataset.scope; renderAllocation(main, nav); }));
  bindDonuts(main, sets);
}
