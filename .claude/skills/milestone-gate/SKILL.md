---
name: milestone-gate
description: "Décide si un jalon du BACKLOG (M0–M9) est terminé : vérifie chaque critère d'acceptation avec une preuve exécutée, puis rend PASS, CONCERNS, NOT ASSESSED ou FAIL. Usage : « /milestone-gate M2 » ou « peut-on passer à M3 ? »."
argument-hint: "<M0..M9>"
allowed-tools: Read, Glob, Grep, Write, Bash(pnpm run *), Bash(pnpm exec vitest *), Bash(git log *), Bash(git status*), Bash(python3 tools/*)
---

# Milestone gate

Source de vérité : `docs/BACKLOG.md`, c'est-à-dire le tableau du jalon demandé avec sa colonne CA.

## Principes

- **Une preuve, pas une impression.** Un CA est PASS seulement si une commande lancée dans cette session, un fichier lu ou un test exécuté le démontre. Une affirmation dans un commit ou dans un fichier de doc n'est pas une preuve.
- Un CA qui exige un appareil réel, comme « testé sur tablette réelle », ou un jugement humain, comme « validé visuellement », vaut **NOT ASSESSED — needs human**. Le rapport donne alors la procédure exacte à suivre par l'utilisateur.
- Un CA marqué « — » dans le BACKLOG est vérifié sur la seule existence de la fonctionnalité (code et test présents). Le rapport l'indique.
- **Ne jamais corriger pour obtenir un PASS.** Le skill ne crée aucun fichier manquant et ne modifie aucun test. Il rapporte, puis nomme la tâche ou le skill qui répond au problème.

## Phase 1 — Charger le jalon

Lis uniquement la section du jalon demandé dans `docs/BACKLOG.md` (Grep `^## M<n>`, puis Read avec offset et limit). Construis la liste des tâches et de leurs CA.

## Phase 2 — Vérifier chaque CA

Pour chaque ligne :
1. Identifie la preuve attendue : test, commande, fichier ou mesure.
2. Exécute la vérification la plus directe possible. Raccourcis utiles :
   - déterminisme → skill `determinism-check` ;
   - assets → `python3 tools/asset_audit.py` ;
   - cartes → `pnpm run maps:build` et skill `map-soak` ;
   - performances → skill `perf-check`.
3. Attribue un statut : PASS, FAIL, NOT ASSESSED (avec la raison) ou PARTIAL. PARTIAL compte comme FAIL dans le verdict.

Vérifie toujours, en plus des CA :
- `pnpm run check` (lint, typecheck et tests) ;
- le test de déterminisme, à partir de M1.

## Phase 3 — Rapport

Écris le rapport dans `docs/reports/gates/<date>-M<n>.md` après accord de l'utilisateur :

```
# Gate M<n> — <titre> — <date> — verdict: …
| # | Tâche | CA | Preuve (commande / fichier) | Statut |
## Hors CA        | pnpm run check | determinism |
## Bloquants      | liste ordonnée, chaque item → tâche BACKLOG ou skill à lancer
## À faire par un humain | procédure pas à pas pour chaque NOT ASSESSED — needs human
## Risques (BACKLOG § Risques) touchés par ce jalon
```

Le verdict retient la première condition remplie, dans cet ordre :
1. **FAIL** : un CA est en FAIL ou PARTIAL, ou `pnpm run check` est rouge.
2. **NOT ASSESSED** : un CA n'a pas pu être vérifié.
3. **CONCERNS** : tout est PASS, mais il reste des WARN (lint warnings, WARN de determinism-check, couverture inférieure à 80 %).
4. **PASS** : sinon.

## Phase 4 — Décision

Le verdict est une recommandation, et c'est l'utilisateur qui décide. Si l'utilisateur accepte un CONCERNS, consigne ce choix dans le rapport (risques acceptés, date). Pour un FAIL ou un NOT ASSESSED, propose les tâches suivantes dans l'ordre des bloquants.
