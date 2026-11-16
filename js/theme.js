/**
 * theme.js — Applique le thème (auto / clair / sombre) et l'effet verre allégé.
 */
import { setting } from './store.js';

export function applyTheme() {
  const root = document.documentElement;
  const t = setting('theme', 'auto');
  if (t === 'auto') delete root.dataset.theme; else root.dataset.theme = t;
  root.classList.toggle('lite', !!setting('lite', false));
  // Couleur de la barre d'état du navigateur / de l'app installée
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0d0e11' : '#f6f7f9');
}

/** Bascule rapide clair ↔ sombre depuis la barre de titre. */
export function isDark() {
  const r = document.documentElement.dataset.theme;
  return r ? r === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}
