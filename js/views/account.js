/**
 * account.js — Détail d'une enveloppe : indicateurs, tableau des lignes, fiche
 * titre, positions de départ et liquidités.
 */
import { data, saveInstrument, saveOpenings, saveAccount, deleteAccount } from '../store.js';
import { accountView } from '../calc.js';
import { eur, eurSigned, pct, pct1, num, dir, dateFr, esc, todayIso, parseFrNumber } from '../format.js';
import { CLASSES, SECTORS, ZONES } from '../presets.js';
import { topbar, ICONS, openSheet, closeSheet, toast } from './ui.js';

const SRC = { 'exécution': 'dernier cours d’exécution', 'manuel': 'cours saisi', 'cours': 'cours', 'relevé': 'relevé' };

export function renderAccount(main, accountId, nav) {
  const acc = data.accounts.find((a) => a.id === accountId);
  if (!acc) { nav('accueil'); return; }
  const v = accountView(acc, data);
  const byOrders = acc.type === 'PEA';
  const isAV = acc.type === 'AV';

  const rows = v.positions.map((p) => `<tr data-inst="${esc(p.id)}">
      <td><div class="nm">${esc(p.name)} ${p.negative ? '<span class="tag">Achat antérieur au fichier</span>' : ''}</div><div class="isin">${esc(p.isin || 'ISIN à compléter')}</div></td>
      <td>${p.qty != null ? num(p.qty) : '—'}</td>
      <td class="amt">${p.pru != null ? eur(p.pru) : '—'}</td>
      <td class="amt">${p.price != null ? eur(p.price) : '—'}${p.priceSource && p.price != null ? `<span class="src">${SRC[p.priceSource]} ${dateFr(p.priceDate)}</span>` : ''}</td>
      <td class="amt"><b>${p.value != null ? eur(p.value) : '—'}</b></td>
      <td class="${dir(p.pv)} amt">${p.pv != null ? eurSigned(p.pv) : '—'}</td>
      <td class="${dir(p.pv)}">${pct(p.pvp)}</td>
      ${isAV ? `<td class="${dir(p.perfInsurer)}">${pct(p.perfInsurer)}</td>` : ''}
      <td>${pct1(p.weight)}</td></tr>`).join('');
  const cashRow = v.cash ? `<tr data-cash="1"><td><div class="nm">Liquidités</div><div class="isin">${byOrders ? 'saisies manuellement' : 'relevé'}</div></td><td>—</td><td>—</td><td>—</td><td class="amt"><b>${eur(v.cash)}</b></td><td>—</td><td>—</td>${isAV ? '<td>—</td>' : ''}<td>${pct1(v.value ? v.cash / v.value : 0)}</td></tr>` : '';

  main.innerHTML = `${topbar(acc.name, `${acc.label || ''}${acc.number ? ' · n° ' + acc.number : ''}`)}
    <button class="back" type="button" data-go="accueil">${ICONS.back}Accueil</button>
    <section class="detail-hero glass">
      <div class="kpi"><div class="label">Valorisation</div><div class="v amt">${eur(v.value)}</div><div class="hint">${v.asOf ? 'au ' + dateFr(v.asOf) : ''}</div></div>
      <div class="kpi"><div class="label">Plus-value latente</div><div class="v chg ${dir(v.pv)} amt">${v.pv != null ? eurSigned(v.pv) : '—'}</div><div class="chg ${dir(v.pv)}">${pct(v.pvp)}</div></div>
      <div class="kpi"><div class="label">Liquidités</div><div class="v amt">${eur(v.cash)}</div><div class="hint">${byOrders ? 'saisie manuelle' : 'selon relevé'}</div></div>
    </section>
    ${v.hasNegative ? `<div class="note"><b>!</b><span>Des titres ont été vendus sans achat dans la période du fichier : ils étaient détenus avant. Renseignez vos <b>positions de départ</b> pour corriger les quantités.</span></div>` : ''}
    ${v.estimated ? `<div class="note info"><span>Les lignes marquées « dernier cours d’exécution » sont valorisées au prix de votre dernier ordre. Vous pouvez saisir un cours sur la fiche du titre ; la mise à jour automatique arrivera avec le module des cours.</span></div>` : ''}
    <section class="table-card glass"><div class="tscroll"><table>
      <thead><tr><th>Titre</th><th>Quantité</th><th>PRU</th><th>Cours</th><th>Valorisation</th><th>+/- value</th><th>Perf.</th>${isAV ? '<th>Perf. assureur</th>' : ''}<th>Poids</th></tr></thead>
      <tbody>${rows}${cashRow}</tbody></table></div></section>
    <div class="hint">Touchez une ligne pour ouvrir la fiche du titre (ISIN, classe d’actifs, secteur, zone, cours).${isAV ? ' « Perf. assureur » : performance dans le contrat telle qu’indiquée sur le relevé.' : ''}</div>
    <div class="btn-row">
      ${byOrders ? `<button class="btn" type="button" id="btnOpen">${ICONS.edit}Positions de départ</button><button class="btn" type="button" id="btnCash">Liquidités</button>` : ''}
      <button class="btn danger" type="button" id="btnDel">Supprimer l’enveloppe</button>
    </div>`;

  main.querySelectorAll('[data-inst]').forEach((tr) => tr.addEventListener('click', () => instrumentSheet(tr.dataset.inst, nav)));
  main.querySelector('[data-cash]')?.addEventListener('click', () => byOrders && cashSheet(acc));
  main.querySelector('#btnOpen')?.addEventListener('click', () => openingsSheet(acc, v));
  main.querySelector('#btnCash')?.addEventListener('click', () => cashSheet(acc));
  main.querySelector('#btnDel').addEventListener('click', () => deleteSheet(acc, nav));
}

/* ---------- Fiche titre ---------- */
function allocToText(a) {
  if (!a) return '';
  if (typeof a === 'string') return a;
  return Object.entries(a).map(([k, w]) => `${k} ${Math.round(w * 100)}`).join(' ; ');
}
/** « Amérique du Nord 70 ; Europe 30 » → objet de poids, ou chaîne simple */
function textToAlloc(t) {
  t = t.trim(); if (!t) return '';
  if (!/\d/.test(t)) return t;
  const out = {}; let sum = 0;
  for (const part of t.split(';')) {
    const m = /^(.+?)\s+([\d,.]+)\s*%?$/.exec(part.trim()); if (!m) continue;
    const w = parseFrNumber(m[2]); out[m[1].trim()] = w; sum += w;
  }
  if (!sum) return '';
  Object.keys(out).forEach((k) => { out[k] = out[k] / sum; });
  return out;
}

function instrumentSheet(id, nav) {
  const inst = data.instruments.find((i) => i.id === id) || { id, name: id.replace(/^nom:/, ''), isin: '' };
  const opts = (list, cur) => ['<option value="">— Non classé —</option>', ...list.map((x) => `<option ${x === cur ? 'selected' : ''}>${esc(x)}</option>`)].join('');
  const sh = openSheet(`
    <h2>${esc(inst.name)}</h2>
    <p class="sub">Fiche titre : ces informations servent aux graphiques de répartition et à la mise à jour des cours.</p>
    ${inst.isinToCheck ? `<div class="note"><b>!</b><span>ISIN proposé d’après le nom du support, absent du relevé : vérifiez-le.</span></div>` : ''}
    ${inst.indicative ? `<div class="note info"><span>Ventilation pré-remplie à titre indicatif d’après la composition de l’indice. Ajustez-la avec la fiche de l’émetteur si besoin.</span></div>` : ''}
    <form id="fInst" class="grid2">
      <div class="field"><label for="iName">Nom</label><input id="iName" value="${esc(inst.name)}" required></div>
      <div class="field"><label for="iIsin">ISIN</label><input id="iIsin" value="${esc(inst.isin || '')}" maxlength="12" autocapitalize="characters"></div>
      <div class="field"><label for="iTicker">Code de cotation</label><input id="iTicker" value="${esc(inst.ticker || '')}" placeholder="ex. PUST.PA"><span class="d">Servira à la mise à jour automatique des cours.</span></div>
      <div class="field"><label for="iCls">Classe d’actifs</label><select id="iCls">${opts(CLASSES, inst.cls)}</select></div>
      <div class="field"><label for="iSector">Secteur</label><input id="iSector" list="dlSector" value="${esc(allocToText(inst.sector))}"><span class="d">Un secteur, ou une ventilation : « Technologie 50 ; Santé 20 ; Autres 30 »</span></div>
      <div class="field"><label for="iZone">Zone géographique</label><input id="iZone" list="dlZone" value="${esc(allocToText(inst.zone))}"><span class="d">Une zone, ou une ventilation en %</span></div>
      <div class="field"><label for="iPrice">Cours saisi (€)</label><input id="iPrice" inputmode="decimal" value="${inst.manualPrice ? String(inst.manualPrice).replace('.', ',') : ''}"><span class="d">Remplace le dernier cours d’exécution en attendant la mise à jour automatique.</span></div>
      <div class="field"><label for="iPriceDate">Date du cours</label><input id="iPriceDate" type="date" value="${inst.manualPriceDate || todayIso()}"></div>
    </form>
    <datalist id="dlSector">${SECTORS.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
    <datalist id="dlZone">${ZONES.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
    <div class="sheet-actions"><button class="btn" type="button" data-close>Annuler</button><button class="btn primary" type="button" id="sv">Enregistrer</button></div>`);
  sh.querySelector('#sv').addEventListener('click', async () => {
    const g = (s) => sh.querySelector(s).value.trim();
    const price = parseFrNumber(g('#iPrice'));
    await saveInstrument({
      ...inst, name: g('#iName') || inst.name, isin: g('#iIsin').toUpperCase(), ticker: g('#iTicker'),
      cls: g('#iCls'), sector: textToAlloc(g('#iSector')), zone: textToAlloc(g('#iZone')),
      manualPrice: price || null, manualPriceDate: price ? g('#iPriceDate') : null, isinToCheck: false,
    });
    closeSheet(); toast('Fiche enregistrée');
  });
}

/* ---------- Positions de départ ---------- */
function openingsSheet(acc, v) {
  const existing = data.openings.filter((o) => o.accountId === acc.id);
  // Sans saisie préalable : pré-remplissage avec les positions calculées (quantités positives)
  const seed = existing.length ? existing
    : v.positions.filter((p) => p.qty > 0).map((p) => ({ isin: p.isin, name: p.name, qty: p.qty, pru: p.pru, date: todayIso() }));
  const date = existing[0]?.date || todayIso();
  const rowHtml = (r = {}) => `<div class="op-row">
      <div class="field"><label>Titre (nom)</label><input data-k="name" value="${esc(r.name || '')}"></div>
      <div class="field"><label>ISIN</label><input data-k="isin" value="${esc(r.isin || '')}" maxlength="12"></div>
      <div class="field"><label>Quantité</label><input data-k="qty" inputmode="decimal" value="${r.qty != null ? String(r.qty).replace('.', ',') : ''}"></div>
      <div class="field"><label>PRU (€)</label><input data-k="pru" inputmode="decimal" value="${r.pru != null ? String(+r.pru.toFixed(4)).replace('.', ',') : ''}"></div>
    </div>`;
  const sh = openSheet(`
    <h2>Positions de départ</h2>
    <p class="sub">${esc(acc.name)} : votre portefeuille à une date donnée. Seuls les ordres <b>postérieurs</b> à cette date seront ensuite appliqués.</p>
    <div class="note info"><span>${existing.length ? 'Modifiez vos positions de départ.' : 'Pré-rempli avec les positions calculées depuis vos ordres. Ajoutez les lignes détenues avant la période du fichier et corrigez les quantités ou PRU si besoin (votre courtier les affiche).'}</span></div>
    <div class="field" style="max-width:220px"><label for="opDate">Positions arrêtées au</label><input id="opDate" type="date" value="${date}"></div>
    <div id="opRows" style="display:flex;flex-direction:column;gap:12px">${(seed.length ? seed : [{}]).map(rowHtml).join('')}</div>
    <div><button class="btn small" type="button" id="opAdd">+ Ajouter une ligne</button></div>
    <div class="sheet-actions"><button class="btn" type="button" data-close>Annuler</button><button class="btn primary" type="button" id="opSave">Enregistrer</button></div>`);
  sh.querySelector('#opAdd').addEventListener('click', () => sh.querySelector('#opRows').insertAdjacentHTML('beforeend', rowHtml()));
  sh.querySelector('#opSave').addEventListener('click', async () => {
    const d = sh.querySelector('#opDate').value || todayIso();
    const rows = [...sh.querySelectorAll('.op-row')].map((r) => {
      const g = (k) => r.querySelector(`[data-k="${k}"]`).value.trim();
      return { name: g('name'), isin: g('isin').toUpperCase(), qty: parseFrNumber(g('qty')), pru: parseFrNumber(g('pru')) ?? 0, date: d };
    }).filter((r) => r.name && r.qty);
    await saveOpenings(acc.id, rows);
    closeSheet(); toast(`${rows.length} position(s) de départ enregistrée(s)`);
  });
}

/* ---------- Liquidités (PEA) ---------- */
function cashSheet(acc) {
  const sh = openSheet(`
    <h2>Liquidités</h2>
    <p class="sub">Solde espèces de ${esc(acc.name)} (l’export des ordres ne le contient pas).</p>
    <div class="field"><label for="cash">Montant (€)</label><input id="cash" inputmode="decimal" value="${acc.cash ? String(acc.cash).replace('.', ',') : ''}"></div>
    <div class="sheet-actions"><button class="btn" type="button" data-close>Annuler</button><button class="btn primary" type="button" id="cSave">Enregistrer</button></div>`);
  sh.querySelector('#cSave').addEventListener('click', async () => {
    await saveAccount({ ...acc, cash: parseFrNumber(sh.querySelector('#cash').value) || 0, cashDate: todayIso() });
    closeSheet(); toast('Liquidités enregistrées');
  });
}

/* ---------- Suppression ---------- */
function deleteSheet(acc, nav) {
  const sh = openSheet(`
    <h2>Supprimer ${esc(acc.name)} ?</h2>
    <p class="sub">Les ordres, relevés et positions de départ de cette enveloppe seront effacés de cet appareil. Les fiches titres sont conservées.</p>
    <div class="sheet-actions"><button class="btn" type="button" data-close>Annuler</button><button class="btn primary" type="button" id="dOk">Supprimer</button></div>`);
  sh.querySelector('#dOk').addEventListener('click', async () => { await deleteAccount(acc.id); closeSheet(); toast('Enveloppe supprimée'); nav('accueil'); });
}
