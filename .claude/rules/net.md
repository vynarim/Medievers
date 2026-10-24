---
paths:
  - "src/net/**"
  - "src/input/Remote*"
  - "tools/lan-server/**"
---

# Règles — LAN (`src/net/**`)

- **Modèle : lockstep par tour, pair à pair.** Il n'y a pas de serveur autoritaire. Les deux pairs exécutent le même sim sur les mêmes commandes (TECH_SPEC §8).
- Seul le joueur actif émet des `cmd`. Les deux pairs appliquent les commandes avec le même tampon de 6 ticks.
- `turnEnd { turn, hash }` est envoyé par les deux pairs, et un écart déclenche l'écran de désync. Une désync n'est jamais corrigée silencieusement.
- Le protocole est versionné (`protocolVersion` + `buildHash` dans `hello`). Un changement de message implique une incrémentation de version.
- Le transport est abstrait (`Transport` : `send`, `onMessage`, `close`). WebRTC (option A) et WebSocket local (option B) en sont deux implémentations interchangeables, et le gameplay n'en connaît aucune.
- `RTCPeerConnection({ iceServers: [] })` : aucune dépendance Internet. Pas de STUN ni de TURN, pas de service de signaling tiers.
- Les tests s'exécutent sur un `Transport` en mémoire, avec latence et réordonnancement simulés.
