/**
 * imports.js — Module 1 : dépôt d'un fichier, aperçu de ce qui a été lu,
 * confirmation, historique des imports.
 */
import { data, previewImport, commitImport } from '../store.js';
import { readStatement } from '../imports/index.js';
import { eur, dateFr, esc } from '../format.js';
import { topbar, ICONS, openSheet, closeSheet, toast } from './ui.js';

const KIND = { 'pea-orders': 'Ordres PEA (CSV)', 'av-snapshot': 'Assurance-vie (PDF)', 'saxo-snapshot': 'Saxo (PDF)' };

export function renderImports(main, nav) {
  const hist = data.imports.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
  const accName = (id) => data.accounts.find((a) => a.id === id)?.name || 'Enveloppe supprimée';
  main.innerHTML = `${topbar('Imports', 'Lecture des fichiers sur cet appareil')}
    <label class="drop glass" id="drop" for="file">
      ${ICONS.upload}
      <h2>Déposez un relevé ou touchez pour choisir</h2>
      <p>Formats reconnus : export CSV des ordres du PEA, PDF « Répartition des supports » de l’assurance-vie, PDF « Relevé de portefeuille » Saxo. Relevés bancaires : bientôt.</p>
      <input type="file" id="file" accept=".csv,.pdf,text/csv,application/pdf" multiple hidden>
    </label>
    <div class="sec-h"><h2>Historique</h2><span>${hist.length ? '' : 'Aucun import pour l’instant'}</span></div>
    ${hist.length ? `<section class="list glass">${hist.map((h) => `
      <div class="row"><div><div>${esc(KIND[h.kind] || h.kind)} · ${esc(accName(h.accountId))}</div>
        <div class="d">${esc(h.summary)}${h.warnings?.length ? ' · ' + h.warnings.length + ' avertissement(s)' : ''}</div></div>
        <div class="val">${dateFr(h.at)}</div></div>`).join('')}</section>` : ''}`;

  const input = main.querySelector('#file');
  input.addEventListener('change', () => handleFiles([...input.files], nav));
  const drop = main.querySelector('#drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => handleFiles([...e.dataTransfer.files], nav));
}

/** Traite les fichiers un par un : lecture, aperçu, confirmation. */
async function handleFiles(files, nav) {
  for (const file of files) {
    let res;
    try {
      res = await readStatement(file);
    } catch (err) {
      await errorSheet(file.name, err.message);
      continue;
    }
    await previewSheet(file.name, res, nav);
  }
}

function errorSheet(name, msg) {
  return new Promise((resolve) => {
    const sh = openSheet(`<h2>Lecture impossible</h2><p class="sub">${esc(name)}</p><div class="note"><b>!</b><span>${esc(msg)}</span></div>
      <div class="sheet-actions"><button class="btn primary" type="button" data-close>Fermer</button></div>`);
    sh.parentElement.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === sh.parentElement) resolve(); });
  });
}

function previewSheet(name, res, nav) {
  return new Promise((resolve) => {
    const pv = previewImport(res);
    let body;
    if (res.kind === 'pea-orders') {
      const buys = res.orders.filter((o) => o.side === 'buy').length;
      body = `<dl class="kv">
        <dt>Contrat</dt><dd>${esc(res.account.label)} n° ${esc(res.account.number)}</dd>
        <dt>Édité le</dt><dd>${dateFr(res.date)}</dd>
        <dt>Ordres exécutés lus</dt><dd>${res.orders.length} (${buys} achats, ${res.orders.length - buys} ventes)</dd>
        <dt>Ordres ignorés</dt><dd>${res.ignored} (annulés, rejetés, expirés)</dd>
        <dt>Nouveaux</dt><dd><b>${pv.fresh}</b></dd>
        <dt>Déjà importés</dt><dd>${pv.dup}</dd></dl>`;
    } else {
      const s = res.snapshot;
      body = `<dl class="kv">
        <dt>Enveloppe</dt><dd>${esc(res.account.name)}${res.account.number ? ' n° ' + esc(res.account.number) : ''}</dd>
        <dt>Date du relevé</dt><dd>${dateFr(res.date)}</dd>
        <dt>Valorisation</dt><dd class="amt">${eur(s.total)}</dd>
        ${s.cash ? `<dt>Liquidités</dt><dd class="amt">${eur(s.cash)}</dd>` : ''}
        ${s.positions.map((p) => `<dt>${esc(p.name)}</dt><dd class="amt">${eur(p.value)}</dd>`).join('')}</dl>
        ${pv.already ? '<div class="note info"><span>Un relevé de la même date existe déjà : il sera remplacé.</span></div>' : ''}`;
    }
    const warns = res.warnings.length ? `<div class="note"><b>!</b><ul class="warns">${res.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : '';
    const newAcc = !pv.existing ? `<div class="note info"><span>Nouvelle enveloppe créée : <b>${esc(res.account.name)}</b>.</span></div>` : '';
    const sh = openSheet(`<h2>${esc(KIND[res.kind])}</h2><p class="sub">${esc(name)}</p>${body}${newAcc}${warns}
      <div class="sheet-actions"><button class="btn" type="button" data-close>Annuler</button><button class="btn primary" type="button" id="ok">Importer</button></div>`);
    sh.parentElement.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === sh.parentElement) resolve(); });
    sh.querySelector('#ok').addEventListener('click', async () => {
      const { acc, summary } = await commitImport(res, name);
      closeSheet(); toast(summary);
      resolve();
      nav('enveloppe', acc.id);
    });
  });
}
