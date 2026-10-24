# `.claude/` — skills et rules du projet Medievers

## Skills (`/nom` dans Claude Code)

| Skill | Rôle | Jalons |
|---|---|---|
| `determinism-check` | Analyse statique de `src/sim` et rejeu des replays de référence | M1 → M9, à chaque modif de sim ou content |
| `milestone-gate` | Vérifie les critères d'acceptation d'un jalon du BACKLOG avec preuves, puis rend un verdict | fin de chaque jalon |
| `asset-spec` | Fiche de production d'un asset ou d'un lot, avec prompt IA (ASSETS §9) | dès M1 (parallèle), M6, M7 |
| `asset-audit` | Audit mesuré par `tools/asset_audit.py` : nommage, palette, tint, pivots, atlas, audio, couverture P0/P1 | M6, M7, après tout ajout d'asset |
| `balance-check` | Écarts entre code et GDD, dominances, combos, statistiques de soak | M3, M4, M8.5 |
| `map-soak` | `maps:build` + parties IA contre IA headless, sur les critères du GDD §10 | M5.7, M6.3, M7.3 |
| `perf-check` | Budgets de TECH_SPEC §9, mesures réelles uniquement | M2, M6.9, M8.1 |
| `playtest-report` | Protocole de session et analyse des notes, avec routage vers le BACKLOG | à partir de M2.9 |

Tous les skills qui rendent un verdict distinguent **NOT ASSESSED** de PASS : un contrôle qui n'a pas pu tourner ne passe jamais au vert.

## Rules (`.claude/rules/*.md`, chargées selon les chemins touchés)

`sim`, `content`, `render`, `ai`, `net`, `tests`, `assets`, `docs`, `skills`. Elles déclinent par dossier les invariants de `CLAUDE.md`, notamment le pas fixe en ticks dans `sim/` et le lockstep P2P dans `net/`.

## Prérequis

- Python 3 avec Pillow pour `tools/asset_audit.py` : `pip install pillow`.
- Les scripts npm cités par les skills (`test:determinism`, `sim:headless`, `maps:build`, `maps:soak`, `bench`) sont créés au fil du BACKLOG. Tant qu'un script n'existe pas, les skills rendent `NOT ASSESSED` en le signalant.

## Origine

Ce dossier est inspiré de [Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) (MIT, © 2026 Donchitos), en particulier le principe « NOT ASSESSED » et la structure des skills asset-audit, balance-check, gate-check, soak-test, perf-profile et playtest-report. Les skills ont été réécrits pour la stack Medievers : Web, TypeScript, Phaser, simulation déterministe.
