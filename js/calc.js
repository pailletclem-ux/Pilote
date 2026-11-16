/**
 * calc.js — Calcul des positions, valorisations et répartitions à partir des
 * données stockées. Fonctions pures (aucun accès à la base ni au DOM).
 *
 * Deux familles d'enveloppes :
 *  - « par ordres » (PEA, et plus tard CTO) : positions de départ + ordres exécutés
 *    postérieurs, PRU moyen pondéré frais inclus (méthode fiscale française) ;
 *  - « par relevé » (assurance-vie, Saxo à ce stade) : dernier relevé importé.
 */

/** Identifiant de fiche titre : l'ISIN, ou le nom normalisé à défaut. */
export function instrumentId(isin, name) {
  if (isin && /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) return isin;
  return 'nom:' + (name || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

/** Dernier cours connu d'un titre, par ordre de priorité. */
export function lastPrice(inst, prices, lastOrder) {
  const hist = prices.filter((p) => p.instrumentId === inst?.id).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (hist) return { price: hist.close, date: hist.date, source: 'cours' };
  if (inst?.manualPrice) return { price: inst.manualPrice, date: inst.manualPriceDate, source: 'manuel' };
  if (lastOrder) {
    // Cours d'exécution en euros ; pour un titre coté en devise, montant € / quantité (frais inclus)
    const price = lastOrder.priceCcy === 'EUR' && lastOrder.price ? lastOrder.price : Math.abs(lastOrder.amount) / lastOrder.qty;
    return { price, date: lastOrder.date, source: 'exécution' };
  }
  return null;
}

/** Positions d'une enveloppe « par ordres ». */
function positionsFromOrders(account, data) {
  const openings = data.openings.filter((o) => o.accountId === account.id);
  const startDate = openings.reduce((d, o) => (o.date > d ? o.date : d), '');
  const book = new Map(); // instrumentId → {qty, cost, name, isin, lastOrder}
  const get = (isin, name) => {
    const id = instrumentId(isin, name);
    if (!book.has(id)) book.set(id, { id, isin, name, qty: 0, cost: 0, lastOrder: null, fees: 0 });
    return book.get(id);
  };
  for (const o of openings) {
    const p = get(o.isin, o.name);
    p.qty += o.qty; p.cost += o.qty * o.pru;
  }
  const orders = data.orders
    .filter((o) => o.accountId === account.id && (!startDate || o.date > startDate))
    .sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));
  for (const o of orders) {
    const p = get(o.isin, o.name);
    if (o.side === 'buy') { p.qty += o.qty; p.cost += -o.amount; }
    else {
      // Une vente réduit le coût au PRU, sans le modifier
      const sold = Math.min(o.qty, Math.max(p.qty, 0));
      if (p.qty > 0) p.cost -= (p.cost / p.qty) * sold;
      p.qty -= o.qty;
    }
    if (Math.abs(p.qty) < 1e-9) { p.qty = 0; p.cost = 0; }
    p.lastOrder = o;
  }
  // Dernier ordre connu par titre (toutes dates), pour le cours d'exécution de repli
  const lastById = new Map();
  for (const o of data.orders.filter((x) => x.accountId === account.id)) {
    const id = instrumentId(o.isin, o.name), prev = lastById.get(id);
    if (!prev || o.date >= prev.date) lastById.set(id, o);
  }
  const out = [];
  for (const p of book.values()) {
    if (p.qty === 0) continue;
    const inst = data.instruments.find((i) => i.id === p.id);
    const lp = lastPrice(inst, data.prices, lastById.get(p.id));
    // Quantité négative = vente d'un titre acheté avant la période du fichier : non valorisée
    const value = lp && p.qty > 0 ? p.qty * lp.price : null;
    out.push({
      id: p.id, isin: p.isin, name: inst?.name || p.name, qty: p.qty,
      pru: p.qty > 0 ? p.cost / p.qty : null, cost: p.cost,
      price: lp?.price ?? null, priceDate: lp?.date ?? null, priceSource: lp?.source ?? null,
      value, pv: value != null ? value - p.cost : null, pvp: value != null && p.cost ? (value - p.cost) / p.cost : null,
      negative: p.qty < 0,
    });
  }
  // Plus grosses lignes d'abord, lignes à compléter (quantité négative) en dernier
  return out.sort((a, b) => (a.negative - b.negative) || (b.value || 0) - (a.value || 0));
}

/** Positions d'une enveloppe « par relevé » (dernier relevé). */
function positionsFromSnapshot(account, data) {
  const snap = latestSnapshot(account, data);
  if (!snap) return [];
  return snap.positions.map((s) => {
    const id = instrumentId(s.isin, s.name);
    const inst = data.instruments.find((i) => i.id === id);
    const cost = s.pv != null ? s.value - s.pv : null;
    return {
      id, isin: inst?.isin || s.isin || null, name: inst?.name || s.name, qty: null, pru: null, cost,
      price: null, priceDate: snap.date, priceSource: 'relevé',
      value: s.value, pv: s.pv, pvp: cost ? s.pv / cost : null, perfInsurer: s.perf, negative: false,
    };
  });
}

export function latestSnapshot(account, data) {
  return data.snapshots.filter((s) => s.accountId === account.id).sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}

/** Vue complète d'une enveloppe. */
export function accountView(account, data) {
  const byOrders = account.type === 'PEA' || account.mode === 'orders';
  const positions = byOrders ? positionsFromOrders(account, data) : positionsFromSnapshot(account, data);
  const snap = byOrders ? null : latestSnapshot(account, data);
  const cash = byOrders ? (account.cash || 0) : (snap?.cash || 0);
  const invested = positions.reduce((s, p) => s + (p.value || 0), 0);
  const cost = positions.reduce((s, p) => s + (p.cost || 0), 0);
  const value = invested + cash;
  const pv = positions.some((p) => p.pv != null) ? positions.reduce((s, p) => s + (p.pv || 0), 0) : null;
  positions.forEach((p) => { p.weight = value ? (p.value || 0) / value : null; });
  const dates = positions.map((p) => p.priceDate).filter(Boolean).sort();
  return {
    account, positions, cash, value, cost, pv, pvp: pv != null && cost ? pv / cost : null,
    asOf: snap?.date || dates[dates.length - 1] || null,
    missingPrice: positions.some((p) => p.value == null),
    hasNegative: positions.some((p) => p.negative),
    estimated: positions.some((p) => p.priceSource === 'exécution'),
  };
}

export function portfolioView(data) {
  const accounts = data.accounts.slice().sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
  const views = accounts.map((a) => accountView(a, data));
  const total = views.reduce((s, v) => s + v.value, 0);
  views.forEach((v) => { v.weight = total ? v.value / total : 0; });
  return { views, total };
}

/**
 * Répartition par clé (cls | sector | zone), avec transparence sur les ETF.
 * Les liquidités comptent en classe « Liquidités », zone « Europe », hors secteur.
 */
export function allocation(views, data, key) {
  const out = {};
  const add = (k, v) => { out[k] = (out[k] || 0) + v; };
  for (const v of views) {
    if (v.cash) {
      if (key === 'cls') add('Liquidités', v.cash);
      if (key === 'zone') add('Europe', v.cash);
    }
    for (const p of v.positions) {
      if (!p.value || p.value < 0) continue;
      const inst = data.instruments.find((i) => i.id === p.id) || {};
      if (key === 'sector' && inst.cls && inst.cls !== 'Actions') continue; // secteurs : poche actions seulement
      const a = inst[key];
      if (!a) add('Non classé', p.value);
      else if (typeof a === 'string') add(a, p.value);
      else Object.entries(a).forEach(([k, w]) => add(k, p.value * w));
    }
  }
  // 5 parts nommées au plus, le reste dans « Autres » ; « Non classé » toujours visible
  let arr = Object.entries(out).filter(([, v]) => v > 0.005).sort((a, b) => b[1] - a[1]);
  const special = (n) => n === 'Autres' || n === 'Non classé';
  const named = arr.filter(([n]) => !special(n));
  let autres = (out['Autres'] || 0) + named.slice(5).reduce((s, [, v]) => s + v, 0);
  arr = named.slice(0, 5);
  if (autres > 0.005) arr.push(['Autres', autres]);
  if (out['Non classé']) arr.push(['Non classé', out['Non classé']]);
  return arr;
}
