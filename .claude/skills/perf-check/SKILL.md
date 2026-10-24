---
name: perf-check
description: "Mesure les performances par rapport aux budgets de TECH_SPEC §9 (fps PC et tablette, sim.step, chargement des cartes, mémoire, ré-upload des tuiles de terrain) et identifie les points chauds. N'utilise que des mesures réelles : bench headless, export de l'overlay debug ou trace navigateur."
argument-hint: "[sim | render | load | all]"
allowed-tools: Read, Glob, Grep, Write, Bash(npm run bench*), Bash(npm run sim:headless*), Bash(npm run build*)
---

# Perf check

## Règle

**Aucune mesure, aucun chiffre.** Une analyse du code peut désigner des **suspects**, mais jamais des **mesures**. Chaque budget non mesuré vaut `NOT ASSESSED — no measurement`, et le rapport indique comment l'obtenir.

## Budgets (TECH_SPEC §9)

| Mesure | Budget | Comment mesurer |
|---|---|---|
| `sim.step()` moyen hors explosion | < 1 ms | `npm run bench -- sim` (Node, sur replays de référence) |
| `sim.step()` pire cas | < 4 ms | idem, p99 et max |
| FPS PC 1920×1080 | 60 constant | export de l'overlay debug F1 (`perf.json`) |
| FPS tablette | 60 visé, ≥ 45 en pic | export de l'overlay sur appareil réel → **needs human** |
| Chargement d'une carte | < 4 s (réseau) / < 2 s (cache) | overlay ou trace Performance |
| Mémoire pic | < 400 Mo | trace navigateur → **needs human** |
| Ré-upload tuiles | ≤ 4 par frame | compteur de l'overlay |
| Thread principal pendant l'IA | < 4 ms/frame | overlay (BACKLOG 5.1) |

Si `npm run bench` n'existe pas, propose de l'ajouter (tâche à ajouter au BACKLOG). Ne fabrique pas de benchmark ad hoc sans accord.

## Phase 1 — Mesurer

- **sim** : lance le bench, puis note la moyenne, le p95, le p99, le max et la machine utilisée.
- **render / load** : lis les exports `docs/reports/perf/*.json` produits par l'overlay. S'il n'y en a pas, rédige pour l'utilisateur la procédure de capture : quelle carte, quel scénario (3 explosions simultanées, zoom 0,5, 6 unités par équipe) et quelle durée.

## Phase 2 — Suspects (analyse statique, étiquetée comme telle)

Signale dans `src/sim` les allocations à chaque tick (`new`, littéraux d'objets ou de tableaux, closures) dans les boucles chaudes, et les parcours complets du masque.

Dans `src/render`, signale :
- les textures recréées au lieu d'être poolées ;
- l'absence de limite de ré-upload des tuiles ;
- les atlas de plus de 2048 px ;
- un trop grand nombre de draw calls de VFX non poolés.

## Phase 3 — Rapport

```
## Perf — <scope> — <date> — verdict: FAIL | NOT ASSESSED | PASS
| Mesure | Budget | Mesuré | Source | Statut |
### Suspects (non mesurés)   | fichier:ligne | raison | gain attendu (qualitatif) |
### Procédures de mesure à faire par un humain
### Recommandations ordonnées
```

Le verdict retient la première condition remplie, dans cet ordre :
1. **FAIL** : un budget mesuré est dépassé.
2. **NOT ASSESSED** : un budget du scope n'est pas mesuré.
3. **PASS** : sinon.
