# Pilote

Application web progressive (PWA) de suivi de patrimoine personnel.
Les données restent **uniquement sur l'appareil** (IndexedDB). Aucune donnée financière n'est envoyée à un serveur.

## État d'avancement

| Module | État |
|---|---|
| Base (PWA installable, hors ligne, thème liquid glass clair/sombre, navigation mobile/bureau) | ✅ |
| Module 1 · Import CSV des ordres du PEA | ✅ calé sur le format réel |
| Module 1 · Import PDF « Répartition des supports » (assurance-vie) | ✅ calé sur le format réel |
| Module 1 · Import PDF Saxo | ⚠️ liquidités seulement (aucune position dans le relevé d'exemple) |
| Module 1 · Relevés bancaires | ⏳ en attente d'un fichier d'exemple |
| Sauvegarde chiffrée (AES-256) export / restauration | ✅ |
| Verrouillage Face ID / Touch ID / Windows Hello, masquage auto 5 min | ⏳ |
| Mise à jour automatique des cours (J-1, S-1) | ⏳ |
| Module 4 · Graphiques (répartitions ✅, évolution ⏳) | 🟡 |
| Modules 2 et 3 | ⏳ |

## Structure

```
index.html               point d'entrée
manifest.webmanifest     installation (nom, icônes, couleurs)
sw.js                    service worker (hors ligne) — incrémenter VERSION à chaque publication
css/app.css              thème liquid glass
icons/                   icônes de l'application
vendor/pdfjs/            pdf.js 4.10.38 (lecture des PDF dans l'appareil, licence Apache 2.0)
js/
  app.js                 démarrage, navigation
  store.js               données en mémoire + opérations (import, fiches, positions de départ)
  db.js                  IndexedDB
  calc.js                positions, PRU, valorisations, répartitions (fonctions pures)
  format.js              formats français (1 234,56 €, JJ/MM/AAAA) et lecture des nombres
  presets.js             fiches pré-remplies (ETF connus, ventilations indicatives)
  crypto.js              sauvegardes chiffrées
  theme.js               thème clair / sombre / auto
  imports/               module 1 : un lecteur par format
  views/                 écrans
```

## Hypothèses et limites

- **PEA** : l'export d'ordres ne couvre qu'un an et ne contient pas les espèces. Les positions détenues avant la période se saisissent une fois via « Positions de départ » ; seuls les ordres postérieurs sont ensuite appliqués. PRU = moyenne pondérée frais inclus.
- **Valorisation PEA** provisoire : dernier cours d'exécution connu (ou cours saisi sur la fiche), en attendant la mise à jour automatique des cours.
- **Assurance-vie** : pas d'ISIN ni de nombre de parts dans le relevé ; rattachement par le nom. « Perf. assureur » = chiffre du relevé, tel quel.
- **Ventilations sectorielles / géographiques des ETF** : indicatives, à vérifier.

## Tester en local

```bash
python3 -m http.server 8765
```

puis ouvrir http://localhost:8765
