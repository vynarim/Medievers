---
paths:
  - "src/sim/**"
---

# Règles — simulation déterministe (`src/sim/**`)

Référence : CLAUDE.md, règles 1 à 7, et TECH_SPEC §3 et §5.

- **Pas fixe uniquement** : 1 appel à `step()` correspond à 1 tick à 60 Hz. Aucun `delta`, `dt` ou `deltaTime` n'existe dans ce dossier. Les durées s'expriment en ticks.
- **Entiers uniquement dans l'état** : positions et vitesses en sub-pixels `int32` (1 px = 256), angles en BAM (0..4095). Les divisions passent par un helper entier (`idiv`, `| 0` ou `Math.trunc`), choisi une fois pour toutes et documenté dans `sim/math`.
- **Interdits** : `Math.random`, `Math.sin`, `cos`, `tan`, `atan2`, `sqrt`, `pow`, `exp`, `log` et `hypot`, `Date`, `performance`, timers, `window` et `document`, ainsi que tout import de `phaser`, `render/`, `ui/`, `net/` ou `app/`. Les remplaçants sont dans `src/sim/math/` : LUT, `isqrt`, PRNG.
- **Aléatoire** : le PRNG de gameplay vit dans l'état et ne se consomme que dans `step()`. Le cosmétique utilise un flux séparé, côté rendu, qui ne touche jamais l'état.
- **Ordre** : les entités vivent dans des tableaux triés par `id`. Pas d'itération sur un `Set` ou une `Map` dont l'ordre dépend des insertions.
- **Événements** : `step()` peut émettre des événements (`TerrainCarved`, `UnitDamaged`, etc.) pour le rendu. Les événements ne remontent jamais dans l'état.
- **Hors boucle chaude, pas d'allocation** : réutiliser des buffers et pools dans les boucles par tick (TECH_SPEC §9).
- **Valeurs de gameplay** : elles sont lues depuis `src/content`, jamais écrites en dur. Seules les constantes physiques sont autorisées dans `sim/` (gravité, sub-step), nommées et commentées avec leur section de TECH_SPEC.
- **Tests** : toute fonction publique de `sim/` a un test Vitest. Tout nouveau comportement d'arme a un replay de référence dans `tests/replays/`.
- Après une modification de ce dossier, lance le skill `determinism-check` avant de considérer la tâche terminée.
