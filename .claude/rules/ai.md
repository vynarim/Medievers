---
paths:
  - "src/ai/**"
---

# Règles — IA (`src/ai/**`)

- L'IA tourne dans un **Web Worker**. Le thread principal ne fait que poster un snapshot et recevoir des `GameCommand`.
- L'IA simule les coups candidats en clonant l'état du sim (`snapshot`/`restore`), sans jamais réimplémenter une physique approchée à part.
- **Pas de triche** : l'IA ne lit que ce qu'un joueur de son équipe voit. Les chausse-trapes ennemies restent invisibles, sauf si l'équipe compte un Sapeur (GDD §7.3).
- Son aléatoire (bruit de visée selon le niveau) vient d'un PRNG seedé propre à l'IA, dérivé de la seed de la partie. La partie IA contre IA reste ainsi rejouable.
- Budget : au plus 1,5 s de calcul effectif sur tablette. Le délai de réflexion affiché est artificiel et vit dans `AIInputSource`.
- Les niveaux (Écuyer, Chevalier, Connétable) sont des données dans `src/content`, pas des branches de code.
