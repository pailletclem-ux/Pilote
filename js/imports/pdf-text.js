/**
 * pdf-text.js — Extrait le texte d'un PDF, ligne par ligne, directement dans
 * l'appareil (pdf.js). Aucun envoi réseau.
 *
 * Les fragments de texte sont regroupés par ligne (même ordonnée) puis triés
 * de gauche à droite. Un grand écart horizontal est rendu par « ␣␣␣ » (3 espaces)
 * pour que les lecteurs puissent distinguer les colonnes.
 */

let pdfjsPromise = null;

/** Charge pdf.js à la demande (fichier local, disponible hors ligne). */
async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('../../vendor/pdfjs/pdf.min.mjs').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
      return lib;
    });
  }
  return pdfjsPromise;
}

/**
 * @param {ArrayBuffer} data  contenu du fichier
 * @param {object} [pdfjsLib] permet d'injecter pdf.js (tests sous Node)
 * @returns {Promise<string[]>} lignes de texte, toutes pages confondues
 */
export async function pdfToLines(data, pdfjsLib) {
  const lib = pdfjsLib || (await loadPdfjs());
  const doc = await lib.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    lines.push(...groupLines(content.items));
  }
  await doc.destroy();
  return lines;
}

/** Regroupe les fragments pdf.js en lignes lisibles. */
export function groupLines(items) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const x = it.transform[4], y = it.transform[5], h = Math.abs(it.transform[3]) || 10;
    // Une ligne = fragments dont l'ordonnée diffère de moins d'un tiers de la hauteur du texte
    let row = rows.find((r) => Math.abs(r.y - y) < h / 3);
    if (!row) rows.push((row = { y, h, parts: [] }));
    row.parts.push({ x, w: it.width, s: it.str, h });
  }
  rows.sort((a, b) => b.y - a.y); // haut de page en premier
  return rows.map((r) => {
    r.parts.sort((a, b) => a.x - b.x);
    let out = '', end = null;
    for (const p of r.parts) {
      if (end != null) {
        const gap = p.x - end;
        out += gap > p.h * 1.2 ? '   ' : gap > p.h * 0.15 && !out.endsWith(' ') && !p.s.startsWith(' ') ? ' ' : '';
      }
      out += p.s;
      end = p.x + p.w;
    }
    return out.replace(/\s+$/, '');
  });
}
