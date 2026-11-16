/**
 * imports/index.js — Point d'entrée du module 1 : reconnaît le type de fichier
 * et appelle le bon lecteur. Tout se passe dans l'appareil.
 */
import { pdfToLines } from './pdf-text.js';
import { isPeaOrdersCsv, parsePeaOrders } from './pea-orders.js';
import { isAvSupportsPdf, parseAvSupports } from './av-supports.js';
import { isSaxoStatementPdf, parseSaxoStatement } from './saxo-statement.js';

/** Décode un CSV : UTF-8, ou Windows-1252 si l'UTF-8 produit des caractères illisibles. */
function decodeText(buf) {
  const utf8 = new TextDecoder('utf-8').decode(buf);
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(buf) : utf8;
}

/**
 * @param {File} file
 * @returns {Promise<object>} résultat normalisé (kind, account, date, orders|snapshot, warnings)
 */
export async function readStatement(file) {
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf.slice(0, 5));
  const isPdf = String.fromCharCode(...head) === '%PDF-';

  if (isPdf) {
    const lines = await pdfToLines(buf);
    if (!lines.length) throw new Error('Ce PDF ne contient pas de texte lisible (document scanné ?). La lecture automatique est impossible.');
    if (isAvSupportsPdf(lines)) return parseAvSupports(lines);
    if (isSaxoStatementPdf(lines)) return parseSaxoStatement(lines);
    throw new Error('Format de PDF non reconnu. Formats pris en charge : répartition des supports d’assurance-vie, relevé de portefeuille Saxo.');
  }

  const text = decodeText(buf);
  if (isPeaOrdersCsv(text)) return parsePeaOrders(text);
  throw new Error('Format de fichier non reconnu. Formats pris en charge : export CSV des ordres du PEA, PDF d’assurance-vie, PDF Saxo.');
}
