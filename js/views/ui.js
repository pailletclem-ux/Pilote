/**
 * ui.js — Éléments d'interface partagés : icônes, barre de titre, feuille modale,
 * message éphémère, graphique en anneau.
 */
import { esc, pct1, eur } from '../format.js';

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICONS = {
  home: svg('<path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  pie: svg('<path d="M12 3v9h9a9 9 0 1 1-9-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>'),
  imp: svg('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>'),
  set: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  eye: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: svg('<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  chev: svg('<path d="m9 6 6 6-6 6"/>'),
  back: svg('<path d="m15 6-6 6 6 6"/>'),
  upload: svg('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
};

export const NAV = [
  { id: 'accueil', label: 'Accueil', ic: 'home' },
  { id: 'repartition', label: 'Répartition', ic: 'pie' },
  { id: 'imports', label: 'Imports', ic: 'imp' },
  { id: 'reglages', label: 'Réglages', ic: 'set' },
];

export function topbar(title, sub) {
  const masked = document.body.classList.contains('masked');
  return `<div class="topbar">
    <div class="t"><img class="logo" src="icons/icon-192.png" alt=""><div><h1>${esc(title)}</h1><small>${esc(sub || '')}</small></div></div>
    <div class="actions">
      <button class="icon-btn glass" type="button" data-act="mask" aria-label="${masked ? 'Afficher' : 'Masquer'} les montants" title="${masked ? 'Afficher' : 'Masquer'} les montants">${masked ? ICONS.eyeOff : ICONS.eye}</button>
      <button class="icon-btn glass" type="button" data-act="theme" aria-label="Changer de thème" title="Thème clair / sombre">${ICONS.moon}</button>
    </div></div>`;
}

/** Ouvre une feuille modale ; renvoie l'élément pour y brancher les événements. */
export function openSheet(html) {
  closeSheet();
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet glass" role="dialog" aria-modal="true">${html}</div>`;
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-close]')) closeSheet(); });
  document.body.appendChild(bg);
  const first = bg.querySelector('input, select, button.primary');
  if (first) setTimeout(() => first.focus(), 50);
  return bg.firstElementChild;
}
export function closeSheet() { document.querySelectorAll('.sheet-bg').forEach((n) => n.remove()); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

let toastTimer;
export function toast(msg) {
  document.querySelectorAll('.toast').forEach((n) => n.remove());
  const t = document.createElement('div');
  t.className = 'toast glass'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 3500);
}

/**
 * Graphique en anneau + légende (valeurs et % toujours écrits : la couleur
 * n'est jamais le seul repère). « Autres » et « Non classé » en gris.
 */
export function donut(id, title, data) {
  if (!data.length) return `<section class="chart glass"><h3>${esc(title)}</h3><p class="hint">Aucune donnée.</p></section>`;
  const tot = data.reduce((s, d) => s + d[1], 0); const R = 70, C = 2 * Math.PI * R, GAP = data.length > 1 ? 2.5 : 0;
  const color = (name, i) => name === 'Autres' ? 'var(--s6)' : name === 'Non classé' ? 'var(--s7)' : `var(--s${i + 1})`;
  let off = 0;
  const segs = data.map((d, i) => {
    const len = (d[1] / tot) * C;
    const s = `<circle class="seg-c" data-i="${i}" cx="90" cy="90" r="${R}" fill="none" stroke="${color(d[0], i)}" stroke-width="22" stroke-dasharray="${Math.max(len - GAP, 0.1)} ${C}" stroke-dashoffset="${-off}"></circle>`;
    off += len; return s;
  }).join('');
  const leg = data.map((d, i) => `<li data-i="${i}"><i style="background:${color(d[0], i)}"></i><span>${esc(d[0])}</span><span class="p">${pct1(d[1] / tot)}</span><span class="e amt">${eur(d[1])}</span></li>`).join('');
  return `<section class="chart glass" data-chart="${id}">
    <h3>${esc(title)}</h3>
    <div class="donut-wrap"><svg viewBox="0 0 180 180" role="img" aria-label="${esc(title)}">${segs}</svg>
      <div class="donut-c"><b>${pct1(data[0][1] / tot)}</b><span>${esc(data[0][0])}</span></div></div>
    <ul class="legend">${leg}</ul></section>`;
}

/** Survol / toucher d'une part : mise en avant + libellé au centre. */
export function bindDonuts(root, datasets) {
  root.querySelectorAll('[data-chart]').forEach((card) => {
    const data = datasets[card.dataset.chart]; if (!data?.length) return;
    const tot = data.reduce((s, d) => s + d[1], 0);
    const wrap = card.querySelector('.donut-wrap'), center = card.querySelector('.donut-c');
    const set = (i) => {
      wrap.classList.toggle('hovering', i != null);
      card.querySelectorAll('[data-i]').forEach((el) => el.classList.toggle('on', String(i) === el.dataset.i));
      const d = data[i ?? 0];
      center.innerHTML = `<b>${pct1(d[1] / tot)}</b><span>${esc(d[0])}</span>`;
    };
    card.querySelectorAll('[data-i]').forEach((el) => {
      el.addEventListener('mouseenter', () => set(+el.dataset.i));
      el.addEventListener('click', () => set(+el.dataset.i));
    });
    card.addEventListener('mouseleave', () => set(null));
  });
}
