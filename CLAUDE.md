# Medievers — instructions projet pour Claude Code

Jeu Web 2D d'artillerie tour par tour (principe *Worms*), dans le style graphique de la Bible de Maciejowski (Morgan Library, MS M.638, ~1250). Cible : navigateur, orientation paysage, PC (clavier/souris) et tablette (tactile).

Documents de référence (à lire avant toute tâche structurante) :
- `docs/GDD.md` — règles, unités, arsenal, modes, IA, UI
- `docs/TECH_SPEC.md` — architecture, déterminisme, terrain, formats
- `docs/ASSETS.md` — direction artistique et liste exhaustive des assets
- `docs/BACKLOG.md` — jalons, tâches, critères d'acceptation

## Décisions actées (ne pas remettre en cause sans demande explicite)

| Sujet | Décision |
|---|---|
| Modes | Solo vs IA, hotseat 2 joueurs (même appareil), LAN 2 PC en jalon tardif |
| Online | Hors périmètre |
| Unités | Hybride : arsenal partagé + 1 passif par classe |
| Simulation | Déterministe, module pur sans dépendance au rendu |
| Physique | Collision pixel vs masque bitmap, maison. Pas de Matter.js / Box2D |
| Rendu / input / audio | Phaser (version à figer au setup, cf. TECH_SPEC §1) |
| Langage / build | TypeScript strict, Vite, Vitest |
| Paquets | pnpm (projet sous OneDrive : store global et `enableGlobalVirtualStore` pour que `node_modules` ne contienne que des liens) |
| Visée | Drag-to-aim ET jauge angle+puissance, choix en options |
| Cartes | Image peinte + masque PNG + JSON. Pas d'éditeur in-game en V1 |
| LAN | WebRTC DataChannel, appairage manuel par QR/code, sans serveur ; fallback mini-serveur Node local |
| Factions | Maisons héraldiques fictives, blason personnalisable |
| Ton | Gameplay burlesque, décors inspirés d'épisodes du manuscrit |

## Règles d'architecture NON négociables

1. **`src/sim/` est pur** : aucun import de Phaser, du DOM, de `window`, de `Date`, de `performance`.
2. **Interdits dans `src/sim/`** : `Math.random`, `Math.sin/cos/tan/atan2/sqrt/pow/exp/log` sur des flottants, tout `number` non entier dans l'état. Utiliser `src/sim/math/` (fixed-point, LUT trigo, `isqrt`, PRNG seedé).
3. Toute modification d'état passe par une `GameCommand` appliquée au tick. Le rendu lit l'état, ne l'écrit jamais.
4. Pas fixe à 60 Hz. Le rendu interpole entre deux ticks.
5. Toute entrée (humain, IA, réseau) implémente `InputSource`. Aucun code de gameplay ne sait d'où vient une commande.
6. Un test de déterminisme (`pnpm run test:determinism`) doit passer sur chaque PR : même seed + même log de commandes ⇒ même hash d'état final.
7. Les paramètres de gameplay (dégâts, rayons, munitions) vivent dans `src/content/*.ts` typés, jamais en dur dans la logique.

## Structure

```
src/
  sim/          # moteur déterministe (state, tick, physics, terrain, weapons, rules)
    math/       # fixed-point, trig LUT, PRNG, hash
  ai/           # IA (s'exécute en Web Worker, utilise sim/ en headless)
  net/          # LAN : WebRTC, signaling manuel, lockstep
  input/        # InputSource : Local, AI, Remote, Replay
  render/       # Phaser scenes, terrain chunks, cutout rig, VFX, camera
  ui/           # menus, HUD, options
  content/      # données : weapons, classes, maps manifest, factions
  app/          # bootstrap, scene flow, settings persistence
assets/         # sources artistiques (hors build)
public/assets/  # assets packagés (atlas, maps, audio)
tests/
docs/
```

## Commandes

- `pnpm run dev` — serveur Vite
- `pnpm run build` — build statique
- `pnpm test` — Vitest (Node)
- `pnpm run test:browser` — mêmes sondes de déterminisme dans Node, Chromium, Firefox et WebKit (Playwright)
- `pnpm run check` — lint + typecheck + tests + test:browser
- `pnpm run test:determinism` — rejeu des replays de référence de `tests/replays/`
- `pnpm run sim:headless <replay.json>` — exécution CLI sans rendu

## Conventions

- Code, identifiants, commentaires, commits : anglais. Docs : français.
- Commits conventionnels (`feat(sim): …`, `fix(render): …`).
- Unités internes : positions en **sub-pixels** (1 px = 256 unités, `int32`), angles en **binary angle** (0..4095 = 360°), temps en **ticks**.
- Chaque arme = une entrée `WeaponDef` + un `WeaponBehavior` dans `src/sim/weapons/`.
- Imports relatifs avec extension (`'./mask.ts'`) et syntaxe TypeScript effaçable uniquement (`erasableSyntaxOnly`) : Node exécute `src/` et `tools/` directement, sans build.

## Skills et rules

- Skills projet dans `.claude/skills/`, présentés dans `.claude/README.md` : `determinism-check`, `milestone-gate`, `asset-spec`, `asset-audit`, `balance-check`, `map-soak`, `perf-check`, `playtest-report`.
- Rules par dossier dans `.claude/rules/`. Elles précisent les règles ci-dessus pour chaque zone du code.
- Avant de déclarer une tâche terminée : `determinism-check` si `src/sim` ou `src/content` a changé ; `milestone-gate` pour clore un jalon.
- Un contrôle qui n'a pas pu s'exécuter rend **NOT ASSESSED**, jamais PASS.

## Definition of Done

- Types stricts, pas de `any`.
- Tests unitaires pour toute logique `sim/`.
- Test de déterminisme vert.
- Pas de régression perf : 60 fps sur la carte de référence en 1920×1080 (cf. TECH_SPEC §9).
- Mise à jour de la doc concernée si une règle change.
