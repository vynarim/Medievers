<div align="center">

# Medievers

**Des armées enluminées sortent des pages d'un manuscrit du XIIIᵉ siècle et s'affrontent à l'arc, au trébuchet et au feu grégeois, sur des paysages peints qui s'effritent à chaque tir.**

Jeu Web 2D d'artillerie au tour par tour, dans l'esprit de *Worms*, dessiné à la manière de la [Bible de Maciejowski](https://fr.wikipedia.org/wiki/Bible_de_Maciejowski) (Paris, vers 1250).

![Statut](https://img.shields.io/badge/statut-M0%20Fondations%20✓-c99a3e)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-2c4a8c?logo=typescript&logoColor=white)
![Phaser](https://img.shields.io/badge/Phaser-4.2.1-b8322a)
![Vite](https://img.shields.io/badge/Vite-8-4d7a4a?logo=vite&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-12-6b4a2e?logo=pnpm&logoColor=white)

</div>

> [!NOTE]
> Le projet en est à ses **fondations** : la chaîne d'outils, la structure et les garde-fous sont en place. Le gameplay décrit ci-dessous est la cible définie dans le [Game Design Document](docs/GDD.md), pas encore un jeu jouable. Voir la [feuille de route](#feuille-de-route).

---

## Sommaire

- [Le jeu](#le-jeu)
- [Direction artistique](#direction-artistique)
- [Architecture](#architecture)
- [Démarrer](#démarrer)
- [Feuille de route](#feuille-de-route)
- [Documentation](#documentation)
- [Contribuer](#contribuer)
- [Références et droits](#références-et-droits)

## Le jeu

### Les quatre piliers

| | Pilier | En pratique |
|---|---|---|
| 📜 | **Le manuscrit vivant** | Tout ressemble à une page enluminée : aplats, cernes noirs, fonds or, cadres architecturés. Le terrain détruit révèle le vélin. |
| 💥 | **Chaos lisible** | Physique imprévisible mais toujours compréhensible. Chaque tir raté peut devenir drôle. |
| ⏳ | **Tour par tour accessible** | Une partie se comprend en 2 minutes et se maîtrise en 20 heures. |
| 🏠 | **Local d'abord** | On joue ensemble dans la même pièce : contre l'IA, en hotseat sur un seul appareil, puis en LAN. |

Le ton est **burlesque** : les personnages gardent la gravité figée des enluminures, visages impassibles et gestes hiératiques, mais subissent des catastrophes absurdes. Pas de sang : les coups font voler des étoiles, des plumes et des éclats de vélin. Public visé : 10 ans et plus.

### Une partie

2 à 4 maisons héraldiques de 3 à 6 unités chacune s'affrontent sur une carte peinte. Chaque tour dure 45 secondes : se déplacer, choisir une arme, viser, tirer, puis 3 secondes pour se mettre à l'abri. Le vent change à chaque tour. Après 20 tours vient **le Déluge** : « Et les eaux montèrent… », et le niveau de l'eau grimpe à chaque fin de tour.

### Six classes, un arsenal commun

Toutes les unités partagent le même arsenal. Chaque classe ajoute un passif.

| Classe | Passif |
|---|---|
| **Chevalier** | Haubert : −25 % de dégâts d'explosion reçus, mais saute moins haut |
| **Archer** | Œil exercé : trajectoire prévisualisée deux fois plus loin à l'arc et à l'arbalète |
| **Frondeur** | Bras souple : +15 % de puissance sur les armes lancées |
| **Sapeur** | Maître d'œuvre : creuse deux fois plus vite et voit les chausse-trapes ennemies |
| **Clerc** | Bénédiction : soigne les alliés proches à la fin de son tour |
| **Roi** | Majesté : les alliés proches infligent +10 % de dégâts. Sa mort élimine l'équipe en mode Régicide |

### Un arsenal du XIIIᵉ siècle

- **Tir et lancer** : arc, arbalète, fronde, pot de feu grégeois à mèche réglable, pot de poix à fragmentation, **cochon enflammé** qui marche tout seul, **ruche** dont l'essaim poursuit l'ennemi, faucon à tête chercheuse.
- **Frappes hors champ** : volée de trébuchet, pluie de flèches.
- **Mêlée** : épée, masse d'armes, charge à l'écu.
- **Utilitaires** : grappin, mur de pierres, bannière-parachute, pioche, sape, échelle, chausse-trape, et **Miracle** pour se téléporter.
- **Reliquaires** : un ange descend en planant et dépose un coffret : une arme, une fiole de baume… ou un piège.

### Modes de jeu

| Mode | Prévu |
|---|---|
| Escarmouche contre l'IA (Écuyer, Chevalier, Connétable) | V1 |
| Hotseat, de 2 à 4 joueurs sur le même appareil | V1 |
| Mixte, humains et IA | V1 |
| Replays exportables en JSON | V1 |
| LAN entre 2 PC (WebRTC, sans serveur) | Jalon M9 |
| Jeu en ligne | Hors périmètre |

### Six cartes inspirées du manuscrit

Les Murailles de **Jéricho** · La Vallée d'**Ela** (David et Goliath) · Le **Camp** sous les tentes · L'**Arche** · La **Tour** (de Babel) · Le **Verger**

### Plateformes

Navigateur en paysage. Sur **PC**, on joue au clavier et à la souris. Sur **tablette**, on joue au tactile, avec un pad virtuel et des cibles de 48 px minimum. Deux modes de visée, au choix dans les options : *drag-to-aim* (on tire l'unité en arrière comme une fronde) ou jauge angle + puissance.

## Direction artistique

La charte s'inspire de la Bible de Maciejowski (Morgan Library, MS M.638) :

- **aplats** de couleurs franches, sans dégradé lisse ;
- **cernes** noir-brun d'épaisseur constante ;
- **pas de perspective** : profils et trois-quarts plats ;
- **fonds or** ou diaprés ;
- sol en bandes ondulées, arbres en boules de feuillage, eau en volutes.

Les personnages sont des **pantins articulés** (*cutout rigs*) dont les pièces de couleur se teintent aux émaux de chaque maison.

Palette de référence :

| Lapis | Azur | Vermillon | Vert-de-gris | Ocre | Or | Vélin | Encre |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ![](https://img.shields.io/badge/-%20%20%20%20-2c4a8c) | ![](https://img.shields.io/badge/-%20%20%20%20-6f93c9) | ![](https://img.shields.io/badge/-%20%20%20%20-b8322a) | ![](https://img.shields.io/badge/-%20%20%20%20-4d7a4a) | ![](https://img.shields.io/badge/-%20%20%20%20-c99a3e) | ![](https://img.shields.io/badge/-%20%20%20%20-d4a93c) | ![](https://img.shields.io/badge/-%20%20%20%20-e9dcc0) | ![](https://img.shields.io/badge/-%20%20%20%20-2a1d14) |
| `#2c4a8c` | `#6f93c9` | `#b8322a` | `#4d7a4a` | `#c99a3e` | `#d4a93c` | `#e9dcc0` | `#2a1d14` |

Le détail est dans [docs/ASSETS.md](docs/ASSETS.md) : charte, conventions, liste exhaustive des assets et pipeline de production.

## Architecture

Le cœur du jeu est une **simulation déterministe**, un module TypeScript pur sans aucune dépendance au rendu. Avec la même seed et le même journal de commandes, on obtient toujours, au bit près, le même état final. C'est ce qui rend possibles les replays, l'IA (qui simule des coups en arrière-plan) et le LAN en lockstep.

```mermaid
flowchart LR
    subgraph inputs["InputSource"]
        L[Local<br/>clavier · souris · tactile]
        A[IA<br/>Web Worker]
        R[Remote<br/>WebRTC]
        P[Replay<br/>JSON]
    end
    inputs -- GameCommand --> S["src/sim<br/>moteur déterministe<br/>60 ticks/s, entiers uniquement"]
    S -- état en lecture seule<br/>+ événements --> V["src/render + src/ui<br/>Phaser 4"]
    A -. clone l'état<br/>et simule en headless .-> S
```

| Principe | Mise en œuvre |
|---|---|
| Pas fixe | 60 ticks/s. Le rendu interpole entre deux ticks. |
| Entiers uniquement | Positions en sub-pixels (1 px = 256), angles en *binary angle* (4096 = 360°), temps en ticks |
| Pas de flottants transcendants | LUT trigonométrique figée, `isqrt` entière, PRNG seedé |
| Physique maison | Collision pixel contre un masque bitmap. Pas de Matter.js ni de Box2D. |
| Terrain destructible | Masque `Uint8Array` découpé en chunks de 256², couche peinte en tuiles de 512² |
| Contrôle automatique | Règle ESLint qui interdit `Math.random`, `Math.sin`, `Date`, `performance`, le DOM et Phaser dans `src/sim/**`, et test de rejeu des replays de référence |

**Stack** : [TypeScript](https://www.typescriptlang.org/) strict · [Phaser 4](https://github.com/phaserjs/phaser) pour le rendu, les entrées et l'audio ([pourquoi la v4](docs/adr/0001-phaser-version.md)) · [Vite](https://vite.dev/) · [Vitest](https://vitest.dev/) · [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/) · [pnpm](https://pnpm.io/)

```
src/
  sim/        moteur déterministe (state, tick, physics, terrain, weapons, rules)
    math/     fixed-point, LUT trigo, PRNG, hash
  ai/         IA (Web Worker, utilise sim/ en headless)
  net/        LAN : WebRTC, signaling manuel, lockstep
  input/      InputSource : Local, AI, Remote, Replay
  render/     scènes Phaser, tuiles de terrain, cutout rig, VFX, caméra
  ui/         menus, HUD, options
  content/    données typées : armes, classes, cartes, factions
  app/        bootstrap, enchaînement des scènes, réglages
tests/        Vitest, garde-fou ESLint, replays de référence
docs/         GDD, spécification technique, assets, backlog, ADR, rapports
```

## Démarrer

**Prérequis** : [Node.js](https://nodejs.org/) 24 ou plus et [pnpm](https://pnpm.io/installation) 12.

```bash
git clone https://github.com/vynarim/Medievers.git
cd Medievers
pnpm install
pnpm run dev        # http://localhost:5173
```

| Commande | Rôle |
|---|---|
| `pnpm run dev` | Serveur de développement Vite |
| `pnpm run build` | Typecheck puis build statique dans `dist/` |
| `pnpm test` | Tests Vitest |
| `pnpm run lint` | ESLint, zéro warning toléré |
| `pnpm run typecheck` | `tsc --noEmit` |
| `pnpm run check` | Lint, typecheck et tests : à faire passer avant chaque commit |
| `pnpm run format` | Prettier |

> [!TIP]
> Le dépôt active le [global virtual store](https://pnpm.io/global-virtual-store) de pnpm (`pnpm-workspace.yaml`). `node_modules` ne contient alors que des liens vers le store de la machine. C'est utile quand le projet vit dans un dossier synchronisé (OneDrive, Dropbox…), qui n'a plus que quelques dizaines de fichiers à suivre au lieu de plusieurs milliers.

## Feuille de route

| Jalon | Contenu | État |
|---|---|---|
| **M0** | Fondations : choix de Phaser, scaffold, garde-fou ESLint, `check` | ✅ [rapport de gate](docs/reports/gates/2026-10-24-M0.md) |
| **M1** | Noyau de simulation headless : math entière, terrain, unités, projectiles, explosions, tours, replays | ⏳ prochain |
| **M2** | Greybox jouable dans le navigateur, PC et tablette | |
| **M3** | Règles complètes : vent, reliquaires, Déluge, classes, schémas | |
| **M4** | Arsenal complet | |
| **M5** | IA (trois niveaux) | |
| **M6** | Pipeline artistique et *vertical slice* | |
| **M7** | Contenu V1 : 6 cartes, 8 maisons | |
| **M8** | Finition et plateforme : PWA, options, accessibilité | |
| **M9** | LAN entre 2 PC (WebRTC) | |

Le détail des tâches et des critères d'acceptation est dans [docs/BACKLOG.md](docs/BACKLOG.md). Un jalon n'est clos qu'après une *gate* qui vérifie chaque critère par une preuve exécutée.

## Documentation

| Document | Contenu |
|---|---|
| [docs/GDD.md](docs/GDD.md) | Game design : règles, unités, arsenal, modes, IA, contrôles, UI, cartes |
| [docs/TECH_SPEC.md](docs/TECH_SPEC.md) | Architecture, déterminisme, terrain, physique, formats, LAN, budgets de performance |
| [docs/ASSETS.md](docs/ASSETS.md) | Direction artistique, conventions et liste des assets |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Jalons, tâches et critères d'acceptation |
| [docs/adr/](docs/adr/) | Décisions d'architecture (ADR) |
| [CLAUDE.md](CLAUDE.md) | Décisions actées et règles d'architecture non négociables |

## Contribuer

- **Langues** : code, identifiants, commentaires et commits en anglais ; documentation en français.
- **Commits** : [Conventional Commits](https://www.conventionalcommits.org/fr/), par exemple `feat(sim): …` ou `fix(render): …`.
- **`src/sim/` est pur** : rien de Phaser, du DOM, de l'horloge ni du hasard non seedé. Toute modification d'état passe par une `GameCommand`.
- **Données** : les valeurs de gameplay (dégâts, rayons, munitions) vivent dans `src/content/`, jamais en dur dans la logique.
- **Avant de proposer un changement** : `pnpm run check` doit être vert. À partir de M1, le test de déterminisme aussi.

Medievers est développé avec l'aide de [Claude Code](https://claude.com/claude-code). Le dossier [.claude/](.claude/README.md) contient les skills et les règles qui encadrent ce travail : contrôle du déterminisme, gate de jalon, fiches d'assets, équilibrage…

## Références et droits

- **Source d'inspiration** : la Bible de Maciejowski, dite aussi *Crusader Bible* ou *Morgan Picture Bible*, est conservée à la Morgan Library & Museum de New York sous la cote **MS M.638** : [notice du manuscrit](https://www.themorgan.org/manuscript/158530), [feuillets en ligne](https://www.themorgan.org/collection/Crusader-Bible). Voir aussi [Wikipédia](https://fr.wikipedia.org/wiki/Bible_de_Maciejowski).
- L'œuvre est du domaine public, mais les conditions de réutilisation des photographies numériques de la Morgan restent à vérifier. Les scans servent donc **uniquement de référence de style** et ne sont jamais intégrés au jeu.
- Les maisons héraldiques sont **fictives**. Les décors reprennent des épisodes du manuscrit sans aucune narration religieuse.
- **Licence** : pas encore définie. En attendant, tous droits réservés.
