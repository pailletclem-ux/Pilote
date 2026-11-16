/**
 * settings.js — Réglages : thème, sauvegarde chiffrée (export / restauration),
 * effacement des données.
 */
import { setting, setSetting, exportData, importData, wipe, data } from '../store.js';
import { encryptBackup, decryptBackup } from '../crypto.js';
import { dateFr, esc, todayIso } from '../format.js';
import { topbar, openSheet, closeSheet, toast } from './ui.js';
import { applyTheme } from '../theme.js';

export function renderSettings(main, nav) {
  const theme = setting('theme', 'auto');
  const lastBackup = setting('lastBackup', null);
  const lite = setting('lite', false);
  main.innerHTML = `${topbar('Réglages', 'Affichage, sauvegarde, données')}
    <section class="list glass">
      <div class="row"><div><div>Thème</div><div class="d">Automatique : suit le réglage de l’appareil</div></div>
        <select id="sTheme" aria-label="Thème"><option value="auto">Automatique</option><option value="light">Clair</option><option value="dark">Sombre</option></select></div>
      <div class="row"><div><div>Effet verre allégé</div><div class="d">À activer si l’app manque de fluidité sur un appareil ancien</div></div>
        <select id="sLite" aria-label="Effet verre allégé"><option value="0">Non</option><option value="1">Oui</option></select></div>
    </section>
    <div class="sec-h"><h2>Sauvegarde et synchronisation</h2><span>${lastBackup ? 'Dernière sauvegarde : ' + dateFr(lastBackup) : 'Aucune sauvegarde'}</span></div>
    <section class="list glass">
      <div class="row"><div><div>Exporter une sauvegarde chiffrée</div><div class="d">Fichier .pilote protégé par mot de passe (AES-256). Rangez-le dans iCloud Drive / Google Drive pour le retrouver sur l’autre appareil.</div></div>
        <button class="btn small" type="button" id="bExp">Exporter</button></div>
      <div class="row"><div><div>Restaurer une sauvegarde</div><div class="d">Remplace toutes les données de cet appareil par celles du fichier.</div></div>
        <label class="btn small" for="fImp">Choisir…</label><input type="file" id="fImp" hidden></div>
    </section>
    <div class="sec-h"><h2>Données</h2><span>${data.accounts.length} enveloppe(s) · ${data.orders.length} ordre(s)</span></div>
    <section class="list glass">
      <div class="row"><div><div>Effacer toutes les données</div><div class="d">Supprime définitivement les données de cet appareil.</div></div>
        <button class="btn small danger" type="button" id="bWipe">Effacer</button></div>
    </section>
    <div class="hint">Verrouillage Face ID / Touch ID / Windows Hello : prochaine étape du développement.</div>`;

  const sTheme = main.querySelector('#sTheme'); sTheme.value = theme;
  sTheme.addEventListener('change', async () => { await setSetting('theme', sTheme.value); applyTheme(); });
  const sLite = main.querySelector('#sLite'); sLite.value = lite ? '1' : '0';
  sLite.addEventListener('change', async () => { await setSetting('lite', sLite.value === '1'); applyTheme(); });

  main.querySelector('#bExp').addEventListener('click', () => exportSheet(main, nav));
  const fImp = main.querySelector('#fImp');
  fImp.addEventListener('change', () => { if (fImp.files[0]) restoreSheet(fImp.files[0], nav); fImp.value = ''; });
  main.querySelector('#bWipe').addEventListener('click', () => wipeSheet(nav));
}

function exportSheet(main, nav) {
  const sh = openSheet(`<h2>Exporter une sauvegarde</h2>
    <p class="sub">Choisissez un mot de passe. Il n’est stocké nulle part : sans lui, la sauvegarde ne peut pas être ouverte.</p>
    <div class="field"><label for="p1">Mot de passe (10 caractères minimum)</label><input id="p1" type="password" autocomplete="new-password"></div>
    <div class="field"><label for="p2">Confirmation</label><input id="p2" type="password" autocomplete="new-password"></div>
    <div class="note" id="err" hidden></div>
    <div class="sheet-actions"><button class="btn" type="button" data-close>Annuler</button><button class="btn primary" type="button" id="go">Créer le fichier</button></div>`);
  sh.querySelector('#go').addEventListener('click', async () => {
    const p1 = sh.querySelector('#p1').value, p2 = sh.querySelector('#p2').value, err = sh.querySelector('#err');
    if (p1.length < 10) { err.hidden = false; err.textContent = 'Le mot de passe doit contenir au moins 10 caractères.'; return; }
    if (p1 !== p2) { err.hidden = false; err.textContent = 'Les deux mots de passe ne correspondent pas.'; return; }
    const text = await encryptBackup(await exportData(), p1);
    const blob = new Blob([text], { type: 'application/octet-stream' });
    const fileName = `pilote-${todayIso()}.pilote`;
    // Partage natif sur mobile (permet « Enregistrer dans Fichiers / Drive »), sinon téléchargement
    const file = new File([blob], fileName, { type: 'application/octet-stream' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Sauvegarde Pilote' }); } catch { /* partage annulé */ }
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    await setSetting('lastBackup', new Date().toISOString());
    closeSheet(); toast('Sauvegarde chiffrée créée'); renderSettings(main, nav);
  });
}

function restoreSheet(file, nav) {
  const sh = openSheet(`<h2>Restaurer ${esc(file.name)}</h2>
    <p class="sub">Toutes les données actuelles de cet appareil seront remplacées.</p>
    <div class="field"><label for="pw">Mot de passe de la sauvegarde</label><input id="pw" type="password" autocomplete="current-password"></div>
    <div class="note" id="err" hidden></div>
    <div class="sheet-actions"><button class="btn" type="button" data-close>Annuler</button><button class="btn primary" type="button" id="go">Restaurer</button></div>`);
  sh.querySelector('#go').addEventListener('click', async () => {
    const err = sh.querySelector('#err');
    try {
      const payload = await decryptBackup(await file.text(), sh.querySelector('#pw').value);
      await importData(payload);
      closeSheet(); toast('Sauvegarde restaurée'); nav('accueil');
    } catch (e) { err.hidden = false; err.textContent = e.message; }
  });
}

function wipeSheet(nav) {
  const sh = openSheet(`<h2>Effacer toutes les données ?</h2>
    <p class="sub">Enveloppes, ordres, relevés et fiches titres seront supprimés de cet appareil. Exportez d’abord une sauvegarde si besoin.</p>
    <div class="field"><label for="cf">Tapez EFFACER pour confirmer</label><input id="cf" autocapitalize="characters"></div>
    <div class="sheet-actions"><button class="btn" type="button" data-close>Annuler</button><button class="btn primary" type="button" id="go">Effacer</button></div>`);
  sh.querySelector('#go').addEventListener('click', async () => {
    if (sh.querySelector('#cf').value.trim().toUpperCase() !== 'EFFACER') return;
    await wipe(); closeSheet(); toast('Données effacées'); nav('accueil');
  });
}
