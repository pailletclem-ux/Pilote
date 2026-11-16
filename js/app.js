/**
 * app.js — Démarrage de Pilote : chargement des données locales, navigation,
 * actions globales (masquage des montants, thème), service worker.
 */
import * as store from './store.js';
import { applyTheme, isDark } from './theme.js';
import { NAV, ICONS } from './views/ui.js';
import { renderHome } from './views/home.js';
import { renderAccount } from './views/account.js';
import { renderAllocation } from './views/allocation.js';
import { renderImports } from './views/imports.js';
import { renderSettings } from './views/settings.js';

const main = document.getElementById('main');
const state = { view: 'accueil', param: null };

/** Navigation : vue + paramètre (id d'enveloppe). Reflétée dans l'adresse (#accueil, #enveloppe/<id>…). */
export function nav(view, param = null, push = true) {
  state.view = view; state.param = param;
  if (push) history.pushState(null, '', `#${view}${param ? '/' + param : ''}`);
  render();
  window.scrollTo(0, 0);
}

function render() {
  const cur = state.view === 'enveloppe' ? 'accueil' : state.view;
  const html = NAV.map((v) => `<button type="button" data-go="${v.id}" ${v.id === cur ? 'aria-current="page"' : ''}>${ICONS[v.ic]}<span>${v.label}</span></button>`).join('');
  document.getElementById('sideNav').innerHTML = html;
  document.getElementById('tabNav').innerHTML = html;
  ({
    accueil: () => renderHome(main),
    enveloppe: () => renderAccount(main, state.param, nav),
    repartition: () => renderAllocation(main, nav),
    imports: () => renderImports(main, nav),
    reglages: () => renderSettings(main, nav),
  }[state.view] || (() => renderHome(main)))();
}

function fromHash() {
  const [view, param] = location.hash.slice(1).split('/');
  state.view = view || 'accueil'; state.param = param || null;
}

/* Clics globaux : navigation, cartes d'enveloppe, boutons de la barre de titre */
document.addEventListener('click', async (ev) => {
  const go = ev.target.closest('[data-go]'); if (go) { nav(go.dataset.go); return; }
  const acc = ev.target.closest('[data-account]'); if (acc) { nav('enveloppe', acc.dataset.account); return; }
  const act = ev.target.closest('[data-act]'); if (!act) return;
  if (act.dataset.act === 'mask') {
    const on = document.body.classList.toggle('masked');
    await store.setSetting('masked', on);
    render();
  }
  if (act.dataset.act === 'theme') {
    await store.setSetting('theme', isDark() ? 'light' : 'dark');
    applyTheme();
  }
});
window.addEventListener('popstate', () => { fromHash(); render(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

/* Re-rendu après chaque modification des données */
store.onChange(() => render());

(async function start() {
  try {
    await store.load();
  } catch (e) {
    main.innerHTML = `<section class="empty glass"><h2>Stockage indisponible</h2><p>Le navigateur refuse le stockage local (navigation privée ?). Pilote a besoin d’IndexedDB pour conserver vos données sur l’appareil.</p></section>`;
    return;
  }
  applyTheme();
  document.body.classList.toggle('masked', !!store.setting('masked', false));
  fromHash();
  render();
  // Service worker : fonctionnement hors ligne (uniquement en HTTPS ou sur localhost)
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
