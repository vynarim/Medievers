---
paths:
  - "src/content/**"
---

# Règles — données de jeu (`src/content/**`)

- Ce dossier contient uniquement des données typées : `WeaponDef`, `ClassDef`, schémas, manifeste des cartes, factions, i18n. Aucune logique hormis de petites fonctions pures de lecture.
- Les valeurs reprennent celles du GDD (§3.2, §4, §6). Une valeur qui change ici change dans le GDD **dans le même commit**, et inversement.
- Les unités sont celles du sim : px (convertis en sub-pixels par un helper), ticks, BAM. Indique l'unité en commentaire sur chaque champ.
- Toute modification invalide les hashes des replays de référence. Lance `determinism-check` et demande confirmation avant de régénérer les hashes.
- Les textes visibles sont des clés i18n (`src/content/i18n/fr.json`), jamais des chaînes en dur.
