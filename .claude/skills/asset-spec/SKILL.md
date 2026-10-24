---
name: asset-spec
description: "Produit la fiche de production d'un asset ou d'un lot (unité, arme, VFX, carte, UI) : dimensions, pièces de rig, pivots, palette, nommage, prompt de génération IA et checklist de validation, à partir de docs/ASSETS.md et du GDD. Usage : « /asset-spec chevalier », « /asset-spec vfx explosion », « /asset-spec map jericho »."
argument-hint: "<sujet> | --batch P0"
allowed-tools: Read, Glob, Grep, Write
---

# Asset spec

Sources, à lire par section (Grep `^#`, puis Read avec offset et limit) :
- `docs/ASSETS.md` : charte §1, conventions §2, tableaux §3 à §8, pipeline §9 ;
- `docs/GDD.md` : classe (§3.2), arme (§4) ou carte (§10) concernée ;
- `docs/TECH_SPEC.md` §7 (rig) et §6 (cartes) quand c'est pertinent ;
- les fiches déjà écrites dans `assets/specs/`, pour ne pas les dupliquer et rester cohérent.

## Phase 1 — Identifier le périmètre

Retrouve dans ASSETS.md toutes les lignes qui concernent le sujet, avec leur priorité. Pour une unité, cela couvre les pièces de base (§3.1), les têtes et coiffes (§3.2), l'équipement (§3.3) et la liste des animations (§3.4). Présente la liste à l'utilisateur avant de rédiger, s'il y a plus de 10 fiches.

## Phase 2 — Rédiger chaque fiche

Fichier `assets/specs/<asset_id>.md`, où `<asset_id>` suit la convention de nommage, par exemple `unit_knight`.

```
# <asset_id> — <nom FR>
Priorité : P0|P1|P2 · Source : ASSETS §x.y · GDD §x.y
## Rôle en jeu         (1–3 lignes, d'après le GDD : ce que le joueur doit lire immédiatement)
## Livrables
| Fichier | Taille ×2 | Pivot | Tintable | Notes |
## Style               (règles de la charte §1.1 pertinentes, couleurs de la palette §1.2 utilisées, par nom et hex)
## Prompt de génération
<prompt de base ASSETS §9.2, avec [SUJET] rempli précisément : pose, équipement, expression, cadrage>
Négatif / à éviter : …
## Procédure          (pose unique → découpe → cernes → quantification palette, ASSETS §9.1)
## Animations liées   (pour les rigs : liste §3.4 avec boucle et durée)
## Validation         (checklist ASSETS §9.3 + `python3 tools/asset_audit.py --scope …`)
```

Règles :
- Les dimensions et quantités viennent des tableaux d'ASSETS.md. Si une valeur n'y figure pas, écris `À définir`. Ne l'invente pas.
- Les pièces tintables portent le suffixe `_tint` dans leur nom de fichier, condition pour que l'audit les reconnaisse.
- Le prompt ne doit jamais reproduire une miniature précise du manuscrit (ASSETS §1.3).
- Pas de sang (GDD §1) : les impacts produisent des étoiles, des plumes et des éclats de vélin.

## Phase 3 — Index

Mets à jour `assets/specs/INDEX.md`, avec une ligne par fiche : id, priorité, statut (`spec` → `produit` → `validé`) et lien. Demande l'accord avant d'écrire plus de 10 fichiers d'un coup.
