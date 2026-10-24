---
name: asset-audit
description: "Audite les assets (assets/ et public/assets/) par rapport à docs/ASSETS.md : nommage, palette Maciejowski, pièces tintables, pivots de rig, taille des atlas et des tuiles, audio, et couverture P0/P1 de la liste d'assets. À lancer après tout ajout d'asset et avant M6/M7."
argument-hint: "[all|units|weapons|vfx|ui|maps|audio] [--coverage P0|P1]"
allowed-tools: Read, Glob, Grep, Write, Bash(python3 tools/asset_audit.py*), Bash(pip install pillow*)
---

# Asset audit

Les mesures viennent **exclusivement** de `tools/asset_audit.py`. N'estime jamais une taille, une palette ou un ratio à l'œil : si l'outil ne mesure pas un point, ce point est NOT ASSESSED.

## Phase 1 — Mesure automatique

```
python3 tools/asset_audit.py --scope <scope> --md
```

Si Pillow manque, propose `pip install pillow --break-system-packages`, puis relance. Reprends tel quel le verdict de l'outil : COMPLIANT, WARNINGS, NON_COMPLIANT ou NOT_ASSESSED.

Seuils appliqués par l'outil (issus d'ASSETS §1.2, §2 et §9.3) :
- pixels opaques hors palette (teintes ×0,82 et ×0,66 incluses) : 5 % au maximum ;
- `*_tint*` : niveaux de gris neutres ;
- rig sources `assets/**/unit_*.png` : pixel pivot magenta #ff00ff présent ;
- atlas : 2048 px au maximum par côté ;
- tuiles de terrain `paint_*` : 512 px au maximum ;
- audio packagé : `.ogg`, à 44,1 ou 48 kHz.

Si une constante de l'outil diverge d'ASSETS.md, signale la divergence. Ne modifie ni l'un ni l'autre sans accord.

## Phase 2 — Couverture de la liste (option `--coverage`)

1. Lis les tableaux d'ASSETS.md (§3 à §8) et retiens les lignes de la priorité demandée.
2. Pour chaque ligne, cherche des fichiers correspondants par Glob sur le préfixe de nommage, par exemple `unit_knight_head_*` ou `weapon_icon_*`.
3. Classe chaque ligne : **Présent** (avec le nombre trouvé et le nombre attendu), **Partiel** ou **Absent**.
4. Les animations keyframes (`anim/*.json`) se vérifient par la présence des fichiers JSON nommés d'après §3.4.

## Phase 3 — Contrôles hors outil (signalés, jamais devinés)

Ces points ne sont pas mesurables automatiquement. Liste-les en **NOT ASSESSED — needs human**, avec la liste des fichiers concernés :
- épaisseur des cernes à ×1 ;
- absence de halo de détourage ;
- cohérence de style avec la planche de référence (ASSETS §9.1) ;
- rendu en jeu aux zooms 0,5, 1 et 1,5.

## Phase 4 — Rapport

Produis le rapport complet de l'outil, puis la couverture et la liste des points needs human. Termine par des recommandations concrètes, une par violation : nom corrigé, couleur fautive, dimension cible.

Après accord, écris le rapport dans `docs/reports/assets/<date>-<scope>.md`. Ne renomme et ne supprime aucun asset sans accord explicite, fichier par fichier ou par lot nommé.
