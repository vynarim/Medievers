---
paths:
  - "src/net/**"
  - "src/input/Remote*"
---

# Règles — en ligne (`src/net/**`)

- **Modèle : lockstep par tour, pair à pair.** Firebase ne calcule rien : la Realtime Database ne sert que de boîte aux lettres. Les deux pairs exécutent le même sim sur les mêmes commandes (TECH_SPEC §8).
- Chaque tick a un seul producteur (le pair de la maison active, `D + 1` ticks plus tôt). Les deux pairs appliquent les commandes avec le même délai `D`.
- `turnEnd { turn, hash }` est envoyé par les deux pairs, et un écart déclenche l'écran de désync. Une désync n'est jamais corrigée silencieusement.
- Le protocole est versionné (`protocolVersion` + `buildHash` dans `hello`). Un changement de message implique une incrémentation de version.
- Le transport est abstrait (`Transport` : `send`, `onMessage`, `close`). La logique de lockstep n'importe ni Firebase ni le DOM ; seul `firebase-transport.ts` connaît le SDK.
- Les tests s'exécutent sur un `Transport` en mémoire, avec latence et réordonnancement simulés.
- Coûts : messages par lots, jamais un message par tick ; chaque message lu est effacé ; la salle est effacée en fin de partie.
