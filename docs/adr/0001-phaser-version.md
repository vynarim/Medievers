# ADR 0001 — Version de Phaser

- **Statut** : proposée (en attente de validation)
- **Date** : 2026-10-24
- **Tâche** : BACKLOG M0 / 0.1
- **Décision** : **Phaser `4.2.1`**, figée sans plage (`"phaser": "4.2.1"`) dans `package.json`.

## Contexte

TECH_SPEC §1 impose de choisir entre Phaser 3.x et 4.x en M0, après vérification et sans rien supposer. Phaser sert au rendu, aux entrées et à l'audio. La simulation (`src/sim/`) n'en dépend pas, ce qui limite l'impact du choix sur le cœur du jeu.

Besoins qui comptent pour ce choix :

| Besoin | Référence |
|---|---|
| Couche terrain découpée en tuiles 512 × 512 modifiables à la volée : `destination-out` pour creuser, `source-atop` pour le liseré, ré-upload limité à 4 tuiles par frame | TECH_SPEC §4.3, §9 |
| Atlas de 2048 × 2048 au maximum, compatibilité GPU mobile | TECH_SPEC §9 |
| `Scale.FIT` en 1920 × 1080 avec letterbox | TECH_SPEC §4.1 |
| Tactile : drag-to-aim, multi-pointer (pinch caméra), tablette 2021+ (iPad 9ᵉ gén.) | GDD (UI), TECH_SPEC §9-§10 |
| TypeScript strict et import ESM via Vite | TECH_SPEC §1 |
| Projet de plusieurs mois : la branche choisie doit rester maintenue | — |

## État constaté le 2026-10-24

Relevé du registre npm (`npm view phaser dist-tags time`) :

- `latest` = **4.2.1** (2026-07-09). Avant elle : 4.2.0 (2026-06-19), 4.1.0 (2026-04-30), 4.0.0 « Caladan » (2026-04-10).
- Phaser 4 a mûri lentement : 8 bêtas de novembre 2024 à mars 2025, puis 7 RC d'avril 2025 à mars 2026.
- La dernière 3.x est **3.90.0** (2025-05-23). Aucune 3.x n'est sortie depuis 17 mois, ni pendant ni après la sortie de la v4. Je n'ai trouvé aucune annonce officielle de fin de support, mais en pratique la branche est figée.

API vérifiées dans les définitions de types publiées (`types/phaser.d.ts` de 3.90.0 et de 4.2.1) :

| API | 3.90.0 | 4.2.1 |
|---|---|---|
| `Textures.CanvasTexture` (`context`, `refresh()`, `update()`, `putData()` avec rectangle « dirty ») | oui | oui, même surface |
| `DynamicTexture` / `RenderTexture` avec `erase()` | oui, exécution immédiate | oui, mais les commandes sont **mises en tampon** et il faut appeler `render()`. Nouveaux : `preserve()`, `callback()`, `capture()`, `renderMode` |
| Blend mode `ERASE` (sur framebuffer) | oui | oui |
| `input.activePointers` (multi-touch) | oui | oui, aucun changement d'input dans le guide de migration |
| Types TypeScript dans le paquet | oui | oui. L'export ESM par défaut est corrigé en 4.1.0 |

Ce que le guide de migration v3 → v4 change pour nous :

- Renderer WebGL entièrement réécrit en « render nodes », avec gestion d'état et restauration du contexte intégrées.
- Le renderer Canvas existe toujours, mais il est **déprécié**. WebGL devient la cible normale.
- Plusieurs éléments sont supprimés, dont `BitmapMask` (remplacé par le filtre `Mask`), `Mesh`/`Plane`, `tintFill`, l'ancien système de pipelines et `Math.SinCosTableGenerator`. Aucun ne nous sert : on génère notre LUT trigo nous-mêmes (TECH_SPEC §3).

Tickets ouverts depuis la 4.0.0 qui touchent nos besoins (GitHub, 40 tickets ouverts depuis le 2026-04-10) :

- #7379 : le constructeur de `DynamicTexture` fuit une texture WebGL à chaque cycle création/destruction (4.2.1). Ça nous concerne si les tuiles sont des `DynamicTexture` recréées. Nous les créons une seule fois par carte.
- #7392 : sur iPadOS ≤ 16.4, un `Text` transparent s'affiche sur fond noir (division par zéro dans `ApplyTint.glsl`, 4.2.1). Les tablettes à jour ne sont pas touchées, mais il faut le savoir pour la tablette de test.
- #7351 : le zoom caméra ≠ 1 combiné à un canvas HiDPI donne un écran vide (4.1.0). Le premier diagnostic pointe l'origine de la caméra, pas un bug moteur. À surveiller pour la caméra.
- #7341 et #7372 : corruptions ponctuelles du batch de sprites WebGL. Pas de contournement à prévoir pour l'instant.

## Options

### A — Phaser 3.90.0
- **Pour** : plus de 7 ans de production, écosystème (exemples, plugins, réponses de forum) presque entièrement en v3, `RenderTexture` à exécution immédiate et donc simple.
- **Contre** : plus aucune release depuis mai 2025. Les correctifs moteur, WebGL mobile ou Safari ne viendront plus. En choisissant la v3 aujourd'hui, on prévoit une migration v3 → v4 au milieu du projet, au moment où le rendu sera le plus développé (M6-M8).

### B — Phaser 4.2.1 (retenue)
- **Pour** : branche maintenue (3 versions en 3 mois après la 4.0.0), renderer reconstruit avec restauration de contexte, `CanvasTexture` identique à la v3 pour notre usage terrain, types et ESM corrigés, démarrage sans dette de migration.
- **Contre** : jeune (6 mois en stable), moins de ressources communautaires, bugs WebGL encore ouverts (voir plus haut), sémantique différée de `DynamicTexture` à maîtriser.

### C — Phaser 4.x en plage (`^4.2.1`)
- Écartée : CLAUDE.md demande une version figée, et une mise à jour silencieuse du renderer pourrait faire régresser le rendu sans aucun changement de notre côté.

## Décision

**Phaser 4.2.1**, épinglée exactement. Chaque montée de version fera l'objet d'un commit dédié `build(deps): bump phaser x → y`, avec relance de `perf-check` sur la carte de référence.

Recommandation d'implémentation pour le terrain (à confirmer en M2) :
- Tuiles 512 × 512 en **`CanvasTexture`** : les opérations `destination-out` et `source-atop` sont natives du contexte 2D, puis `refresh()` envoie la tuile au GPU. On applique à la lettre TECH_SPEC §4.3, sans dépendre de l'API `DynamicTexture`, qui est celle qui a le plus changé en v4 (#7379).
- Coût de `refresh()` : environ 1 Mo par tuile RGBA 512². Avec 4 tuiles par frame, on reste dans le budget de TECH_SPEC §9, ce que `perf-check` devra confirmer en M2.
- Repli si la mesure montre que l'upload est trop coûteux : tuiles en `DynamicTexture` (créées une fois, jamais détruites pendant la partie), creusage par `erase()` puis `render()`.

## Conséquences

- `package.json` contiendra `"phaser": "4.2.1"` (tâche 0.2).
- Renderer configuré en `Phaser.WEBGL`. Le renderer Canvas n'est pas une cible, puisqu'il est déprécié en v4.
- Les exemples et réponses trouvés en ligne pour la v3 sont à vérifier contre le guide de migration, en particulier pour `DynamicTexture`/`RenderTexture` (`render()` obligatoire), les masques (filtre `Mask`) et le tint.
- Le guide de migration et les « skills » fournis dans le paquet (`node_modules/phaser/skills/`, `changelog/v4/`) servent de référence locale.
- La tablette de test doit tourner sous iPadOS ≥ 17 (#7392), sinon le symptôme devra être noté dans les rapports de playtest.

## Risques et suivi

| Risque | Mitigation |
|---|---|
| Bug WebGL bloquant propre à la v4 | Rendu isolé dans `src/render/`. La sim ne dépend pas de Phaser. Version épinglée. Ticket suivi sur GitHub |
| Upload `CanvasTexture` trop coûteux sur tablette | Mesure par `perf-check` en M2. Repli `DynamicTexture`. Upload partiel (`putData` avec rectangle « dirty ») |
| Le support WebGL1/WebGL2 n'est pas documenté dans le guide de migration | Vérifier `renderer.gl` sur la tablette cible en M2 (smoke test) |

## Sources consultées (2026-10-24)

- Registre npm, `npm view phaser dist-tags time --json` : dist-tags et dates de toutes les versions.
- Releases GitHub : <https://github.com/phaserjs/phaser/releases> (notes de 4.0.0, 4.1.0, 4.2.0, 4.2.1).
- Guide de migration v3 → v4 (dans le paquet 4.2.1) : <https://unpkg.com/phaser@4.2.1/changelog/v4/4.0/MIGRATION-GUIDE.md>
- Article « Migrating from Phaser 3 to Phaser 4 », 16 avril 2026 : <https://phaser.io/news/2026/04/migrating-from-phaser-3-to-phaser-4-what-you-need-to-know>
- Page de téléchargement stable : <https://phaser.io/download/stable>
- Définitions de types : <https://unpkg.com/phaser@4.2.1/types/phaser.d.ts> et <https://unpkg.com/phaser@3.90.0/types/phaser.d.ts> (CanvasTexture, DynamicTexture, ERASE, activePointers)
- Tickets GitHub ouverts depuis le 2026-04-10 (`gh api search/issues`), en particulier #7379, #7392, #7351, #7341 et #7372 : <https://github.com/phaserjs/phaser/issues>
