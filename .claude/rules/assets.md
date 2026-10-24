---
paths:
  - "assets/**"
  - "public/assets/**"
---

# Règles — assets

- Nommage : `snake_case`, au format `<categorie>_<sujet>_<variante>_<etat>`. Catégories : unit, weapon, vfx, ui, map, prop, sfx, mus, amb, font, atlas (ASSETS §2). Les pièces tintables portent le suffixe `_tint`.
- Les fichiers d'une carte gardent les noms fixes de TECH_SPEC §6 : `map.json`, `paint_*`, `mask.png`, `bg_*` et `frame`.
- Ne jamais intégrer de scan du manuscrit dans `public/assets/` (ASSETS §1.3). Ils servent de référence de style uniquement.
- Audio : `.ogg` en version packagée. La licence de chaque piste est consignée dans `assets/LICENSES.md`.
- Après un ajout ou une modification, lance `python3 tools/asset_audit.py --md` ou le skill `asset-audit`.
- Ne renomme et ne supprime aucun asset sans accord explicite.
