# ADR 0002 — Jeu à distance : en ligne par Firebase plutôt que LAN WebRTC

- **Statut** : acceptée le 2026-10-24
- **Date** : 2026-10-24
- **Tâche** : BACKLOG M9 (lot 4)
- **Décision** : le jeu à deux machines se fait **en ligne**. Un joueur crée la partie et reçoit un code ; l'autre la rejoint avec ce code. Les commandes passent par **Firebase Realtime Database** (projet `videogames-06`), en lockstep par tour. Le LAN WebRTC sans serveur est abandonné.

## Contexte

Le plan initial prévoyait un LAN entre 2 PC : WebRTC DataChannel sans serveur, appairage par copier-coller ou QR de l'offre et de la réponse SDP, avec un mini-serveur Node local en secours. Le jeu en ligne était hors périmètre.

Le 2026-10-24, avant la première ligne de code du lot, l'utilisateur a demandé si deux joueurs pouvaient jouer à distance, sur le modèle d'un autre de ses jeux : une partie créée en ligne, rejointe par un code, des données partagées. Le jeu étant au tour par tour, le débit et la latence demandés sont faibles.

Ce qui rend la chose simple ici : la simulation est déterministe (CLAUDE.md, règles 1 à 6). Deux pairs qui appliquent les mêmes commandes aux mêmes ticks calculent le même état au bit près. Il suffit d'échanger les commandes, quelques centaines par partie, pas l'état.

## Options

| Option | Pour | Contre |
|---|---|---|
| **A. LAN WebRTC sans serveur** (plan initial) | Aucune dépendance Internet ni compte | Même réseau obligatoire ; appairage par SDP pénible (QR, copier-coller) ; incertitudes mDNS, Firefox et isolation Wi-Fi à lever par un spike sur deux PC |
| **B. WebRTC sur Internet** (signaling par une base, STUN public) | Pair à pair, latence minimale | Échoue derrière certains NAT sans relais TURN (payant ou à héberger) ; il faut un service de signaling de toute façon |
| **C. Firebase Realtime Database comme boîte aux lettres** | Code court à saisir ; marche partout où il y a Internet, réseau local compris ; reprise après rechargement simple ; l'utilisateur connaît déjà Firebase (autres projets) ; quotas gratuits largement suffisants | Dépendance à un service ; latence de 100 à 300 ms ; les données passent par Google |
| D. Firestore | Même avantages que C | Pensé pour des documents, pas un flux ; facturé à l'écriture |

## Décision

Option **C**.

- Projet Firebase **`videogames-06`** (« VideoGames »), créé le 2026-10-24, que l'utilisateur veut partager entre ses jeux vidéo, comme `boardgames-06` pour ses jeux de société. Medieverse y a son application web, son site d'hébergement et son espace de données.
- Connexion anonyme, Realtime Database, Hosting.
- Le projet reste en Spark pour l'instant ; l'utilisateur le passera en **Blaze** plus tard (instance de base dédiée, nettoyage planifié, mails). Voir BACKLOG 9.7.
- Lockstep par tour : chaque tick a un seul producteur, et les deux pairs appliquent les commandes avec le même délai (30 ticks). Détail : TECH_SPEC §8.

## Complément du 2026-10-25 : plusieurs joueurs et l'IA en ligne

L'utilisateur a trouvé le parcours « Créer une partie en ligne » obscur (un code, puis rien qu'un bouton Annuler) et a demandé de pouvoir composer une partie en ligne maison par maison : « 3 joueurs et 1 IA, 2 et 2… ». Décision :
- le menu de chaque maison offre « Un copain » à côté de « Vous » et des niveaux de l'IA ; la première maison de copain ouvre la salle et affiche son code sur l'écran de préparation ;
- jusqu'à 4 joueurs, par sièges numérotés ; topologie en étoile par le créateur, qui relaie (un copain n'écrit qu'à lui), pour garder un seul écrivain par boîte et peu de lectures ;
- l'IA tourne chez le créateur, qui produit les ticks des maisons de l'IA comme ceux de la sienne ;
- le départ d'un joueur arrête la partie pour tous (comme à deux) ;
- protocole en version 2. Détail : TECH_SPEC §8.

## Conséquences

- Le jeu doit être mis en ligne (Firebase Hosting) pour qu'un joueur distant l'ouvre.
- Le tableau des décisions de `CLAUDE.md`, le GDD §6 et §14, TECH_SPEC §8, le BACKLOG M9 et la règle `.claude/rules/net.md` sont mis à jour.
- Les tâches 9.1 (spike WebRTC) et 9.6 (serveur LAN de secours) disparaissent ; le BACKLOG M9 est réécrit.
- La logique de lockstep reste indépendante du transport (`Transport`) : un LAN pourrait revenir plus tard comme un second transport, sans toucher au jeu.
- Le brouillard des chausse-trapes prend tout son sens : chaque joueur ne voit que les pièges de ses maisons.
- Coûts : rien à payer en Spark. En Blaze, les quotas gratuits restent ; les messages partent par lots, chaque message lu est effacé, et une alerte de budget est prévue.
