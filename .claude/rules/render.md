---
paths:
  - "src/render/**"
  - "src/ui/**"
---

# Règles — rendu et UI (`src/render/**`, `src/ui/**`)

- **Le rendu lit l'état, il ne l'écrit jamais.** Toute intention du joueur devient une `GameCommand` émise par l'`InputSource` locale.
- **Interpolation** : la position affichée vaut `lerp(prev, curr, alpha)`, avec `alpha` issu de l'accumulateur. Le delta time est permis ici, et **seulement ici**, pour l'interpolation et les animations cosmétiques.
- **Aléatoire cosmétique** autorisé (particules, fidgets), mais jamais à partir du PRNG du sim.
- **Terrain** : tuiles de 512 × 512, ré-upload limité aux tuiles dirty, au maximum 4 par frame (TECH_SPEC §4.3 et §9). Le rendu ne relit pas le masque pour une décision de gameplay.
- **Atlas** de 2048 px au maximum. Pooling des projectiles et VFX.
- **Tactile** : cibles d'au moins 48 × 48 px CSS, et `touch-action: none` sur le canvas.
- **Textes** : clés i18n uniquement. La police gothique est réservée aux titres et la police lisible sert au HUD (ASSETS §8).
- **Palette** : les couleurs d'UI viennent d'un module de tokens unique, aligné sur ASSETS §1.2. Pas de hex dispersés dans le code.
