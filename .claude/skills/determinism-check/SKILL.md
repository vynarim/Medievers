---
name: determinism-check
description: "Vérifie le déterminisme de src/sim : imports et API interdits, flottants dans l'état, ordre d'itération, rejeu des replays de référence. À lancer avant chaque commit touchant src/sim, src/content ou tests/replays, et avant de clore une tâche M1–M5."
argument-hint: "[--quick | --full | <chemin replay.json>]"
allowed-tools: Read, Glob, Grep, Bash(pnpm run test:determinism*), Bash(pnpm run sim:headless*), Bash(pnpm run lint*), Bash(pnpm exec eslint *), Bash(git diff *), Bash(git status*)
---

# Determinism check

Référence : `CLAUDE.md` (règles 1 à 7) et `docs/TECH_SPEC.md` §3.

## Règle d'or

Un contrôle qui n'a pas pu s'exécuter rend **NOT ASSESSED**, jamais PASS. « Aucune violation trouvée parce qu'il n'y a pas de fichier » n'est pas une preuve. Pour chaque section, dis lequel des deux cas s'est produit.

## Phase 1 — Inventaire des entrées

Note `FOUND` ou `ABSENT` pour chacun :
- `src/sim/**/*.ts`
- `tests/replays/*.json` et leurs hashes attendus
- script `test:determinism` dans `package.json`
- configuration ESLint contenant les restrictions pour `src/sim/**`

Si `src/sim` est absent, tout le rapport vaut `NOT ASSESSED — no sim code`. Arrête-toi là.

## Phase 2 — Analyse statique (Grep sur `src/sim/**`, tests exclus)

| Contrôle | Motif (indicatif) | Sévérité |
|---|---|---|
| Aléatoire non seedé | `Math\.random` | FAIL |
| Trigonométrie et fonctions flottantes | `Math\.(sin|cos|tan|atan2?|sqrt|pow|exp|log|hypot|cbrt)` | FAIL |
| Horloge | `Date\b|performance\.|setTimeout|setInterval|requestAnimationFrame` | FAIL |
| DOM et rendu | `window\.|document\.|from ['"]phaser` | FAIL |
| Imports hors sim | `from ['"]\.\./\.\./(render|ui|net|app)` | FAIL |
| Division potentiellement flottante | `/ ` suivi d'aucun `| 0`, `Math.trunc` ou helper `idiv` sur une variable d'état | WARN (vérifier à la main) |
| Littéraux décimaux | `\b\d+\.\d+\b` hors commentaires et `src/sim/math/lut*` | WARN |
| Itération sur Set/Map | `for \(.* of .*(Set|Map)|\.forEach` sur un Set ou une Map d'entités | WARN |
| `delta`, `dt`, `deltaTime` | `\b(delta(Time)?|dt)\b` | FAIL (pas fixe obligatoire) |

Chaque occurrence est rapportée avec son fichier et sa ligne. Ne corrige rien dans cette phase.

## Phase 3 — Lint

Lance `pnpm run lint src/sim` ou l'équivalent du projet. Si la règle ESLint dédiée n'existe pas, le résultat de la section est `NOT ASSESSED — ESLint sim restrictions absent (BACKLOG 0.3)`.

## Phase 4 — Rejeu

- `--quick` (défaut) : `pnpm run test:determinism`.
- `--full` : rejeu complet, plus un second rejeu à partir d'un `snapshot()`/`restore()` au milieu de chaque replay, si le script le permet.
- `<replay.json>` : `pnpm run sim:headless <replay>` deux fois, puis comparaison des hashes.

Rapporte les hashes obtenus et attendus. Une sortie de commande non lue vaut NOT ASSESSED.

## Phase 5 — Rapport

```
## Determinism check — <date> — verdict: FAIL | NOT ASSESSED | PASS
Entrées : …
### Statique   | fichier:ligne | contrôle | sévérité |
### Lint       | résultat |
### Rejeu      | replay | hash attendu | hash obtenu | statut |
### Actions    | priorité | correction proposée |
```

Le verdict retient la première condition remplie, dans cet ordre :
1. **FAIL** : au moins un FAIL statique ou un hash divergent.
2. **NOT ASSESSED** : une section n'a pas pu tourner.
3. **PASS** : sinon.

Les WARN sont listés, mais ne bloquent pas.

## Après le rapport

Propose les corrections. N'applique rien sans accord. Si un hash de référence doit changer parce que les règles de jeu ont légitimement changé, demande une confirmation explicite, puis indique le commit qui justifie la régénération.
