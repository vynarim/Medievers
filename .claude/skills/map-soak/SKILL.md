---
name: map-soak
description: "Valide une carte (maps:build) puis la fait jouer en parties IA contre IA headless (maps:soak) : unités coincées, parties interminables, spawns inéquitables, désyncs de replay. À lancer pour chaque nouvelle carte ou modification de masque."
argument-hint: "<mapId|all> [--games N]"
allowed-tools: Read, Glob, Grep, Write, Bash(npm run maps:build*), Bash(npm run maps:soak*), Bash(npm run sim:headless*)
---

# Map soak

Références : TECH_SPEC §6 (format et scripts) et GDD §10 (règles de level design).

## Phase 1 — Build et validations statiques

`npm run maps:build -- <mapId>`. Reprends les erreurs du script telles quelles :
- tailles du masque et de la peinture ;
- couleurs de masque inconnues ;
- spawns en l'air ou inaccessibles.

Ajoute ces contrôles, s'ils ne sont pas couverts par le script :
- au moins 8 zones de spawn valides par équipe ;
- pas plus de 15 % de terrain indestructible ;
- largeur de 3 à 5 écrans et hauteur de 1,5 à 2 écrans à zoom 1 ;
- `waterLevel` sous tous les spawns.

Si le script n'existe pas encore, le statut est `NOT ASSESSED — maps:build absent (BACKLOG 6.3)`. Ne recode pas les validations à la main dans ce skill.

## Phase 2 — Soak

`npm run maps:soak -- <mapId> --games <N>` (N vaut 30 par défaut, et au moins 3 selon le GDD §10). Le script doit écrire un rapport JSON dans `docs/reports/soak/`. Si ce n'est pas le cas, signale-le comme NOT ASSESSED.

Critères :

| Critère | Seuil | Source |
|---|---|---|
| Unités coincées (aucun déplacement possible pendant 3 tours consécutifs) | 0 | GDD §10 |
| Parties de plus de 40 tours | 0 | GDD §10 |
| Écart de taux de victoire entre spawn gauche et spawn droit | ≤ 15 points | équité |
| Rejeu des logs de 3 parties tirées au hasard | hash identique | TECH_SPEC §3 |
| Exceptions et erreurs du sim | 0 | — |

## Phase 3 — Rapport

```
## Map soak — <mapId> — <date> — verdict: FAIL | NOT ASSESSED | PASS
Build : … | Parties : N | Seeds : …
| Critère | Mesure | Seuil | Statut |
### Positions problématiques  (coordonnées des unités coincées, avec la seed et le tick pour rejouer)
### Recommandations          (zone du masque à modifier, spawn à déplacer…)
```

Le verdict retient la première condition remplie, dans cet ordre :
1. **FAIL** : un critère dépasse son seuil.
2. **NOT ASSESSED** : un script ou une donnée manque.
3. **PASS** : sinon.

Pour chaque problème, donne la commande `npm run sim:headless -- <log>` qui le reproduit. Ne modifie pas le masque de la carte : c'est un asset, qui se corrige dans la source artistique.
