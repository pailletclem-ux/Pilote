/**
 * home.js — Écran d'accueil : patrimoine total (variations J-1 / S-1) puis une
 * carte par enveloppe.
 */
import { data } from '../store.js';
import { portfolioView } from '../calc.js';
import { eur, pct1, dateFr, esc } from '../format.js';
import { topbar, ICONS } from './ui.js';

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function renderHome(main) {
  const today = new Date();
  const sub = `${DAYS[today.getDay()][0].toUpperCase()}${DAYS[today.getDay()].slice(1)} ${dateFr(today.toISOString())}`;
  const { views, total } = portfolioView(data);

  if (!views.length) {
    main.innerHTML = `${topbar('Accueil', sub)}
      <section class="empty glass">
        <h2>Bienvenue dans Pilote</h2>
        <p>Importez un premier relevé (CSV des ordres du PEA, PDF d’assurance-vie ou relevé Saxo) : vos enveloppes apparaîtront ici avec leur valorisation. Tout reste stocké sur cet appareil.</p>
        <button class="btn primary" type="button" data-go="imports">${ICONS.upload}Importer un relevé</button>
      </section>`;
    return;
  }

  const anyEstimated = views.some((v) => v.estimated);
  const anyNegative = views.some((v) => v.hasNegative);
  const cards = views.map((v) => {
    const a = v.account;
    const n = v.positions.length;
    const status = v.hasNegative ? '<span class="tag">À compléter</span>'
      : v.pv != null ? `<span class="chg ${v.pv >= 0 ? 'up' : 'down'}">+/- value <span class="amt">${eur(v.pv)}</span></span>` : '<span class="chg flat">—</span>';
    return `<button class="env glass" type="button" data-account="${a.id}">
      <div class="env-top"><div class="env-ic">${esc(a.icon)}</div>
        <div><div class="env-name">${esc(a.name)}</div><div class="env-sub">${esc(a.label || '')}${a.number ? ' · n° ' + esc(a.number) : ''} · ${n} ligne${n > 1 ? 's' : ''}</div></div>
        <span class="env-chev">${ICONS.chev}</span></div>
      <div class="env-val amt">${eur(v.value)}</div>
      <div class="env-foot">${status}
        <span class="weight">${pct1(v.weight)}<span class="bar"><b style="width:${(v.weight * 100).toFixed(1)}%"></b></span></span></div>
    </button>`;
  }).join('');

  main.innerHTML = `${topbar('Accueil', sub)}
    <section class="hero glass" aria-label="Patrimoine total">
      <div class="label">Patrimoine total</div>
      <div class="big amt">${eur(total)}</div>
      <div class="var-row">
        <span class="pill" title="Disponible avec la mise à jour automatique des cours"><span class="k">J-1</span>bientôt</span>
        <span class="pill" title="Disponible avec la mise à jour automatique des cours"><span class="k">S-1</span>bientôt</span>
      </div>
      <div class="updated">${anyEstimated ? 'Certaines lignes sont valorisées au dernier cours d’exécution connu, en attendant la mise à jour automatique des cours.' : 'Valorisation au dernier relevé importé.'}</div>
    </section>
    ${anyNegative ? `<div class="note"><b>!</b><span>Une enveloppe contient des ventes de titres achetés avant la période couverte par le fichier. Ouvrez-la et renseignez vos <b>positions de départ</b> pour un total exact.</span></div>` : ''}
    <div class="sec-h"><h2>Mes enveloppes</h2><span>Touchez une carte pour le détail</span></div>
    <div class="envs">${cards}</div>`;
}
