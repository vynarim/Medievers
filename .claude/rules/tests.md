---
paths:
  - "tests/**"
  - "src/**/*.test.ts"
---

# Règles — tests

- Les tests de `sim/` tournent en Node, sans DOM ni Phaser.
- **Replays de référence** : `tests/replays/<nom>.json` contient le log de partie et le `expectedHash`. Un hash ne se met jamais à jour pour faire passer un test. Il se met à jour seulement après un changement de règle assumé, avec la mention `regen-hash: <raison>` dans le message de commit.
- Un replay par arme (TECH_SPEC §12), plus des parties complètes IA contre IA.
- Les assertions de physique comparent des entiers exacts, jamais des approximations flottantes.
- Les tests ne doivent pas dépendre de l'ordre d'exécution ni de l'horloge.
