# Medieverse — Backlog et jalons

Chaque tâche est dimensionnée pour une session Claude Code. Les critères d'acceptation (CA) sont vérifiables. On ne passe pas au jalon suivant tant que les CA du jalon courant ne sont pas verts.

Ordre recommandé : simulation d'abord, en headless et testée, puis rendu en greybox, puis art. La production artistique (planche de style, ASSETS §9.1) peut démarrer **en parallèle dès M1**.

## Ordre d'exécution (décidé le 2026-10-24)

La priorité est le moteur : simulation, règles, réseau, IA. Jusqu'au lot 9, tous les visuels sont des **placeholders dessinés par le code** (ASSETS §2.1). Les numéros de jalon et de tâche restent ceux des sections ci-dessous : seul l'ordre de réalisation change.

| Lot | Contenu | Tâches | Gate |
|---|---|---|---|
| 1 | Moteur de simulation headless + déterminisme inter-navigateurs | M1, dont 1.10 (ex-9.3) | M1 |
| 2 | Greybox jouable | M2 | M2 |
| 3 | Règles complètes | M3 | M3 |
| 4 | Jeu en ligne (remplace le LAN, décidé le 2026-10-24) | M9 | M9 |
| 5 | IA | M5 | M5 |
| 6 | Arsenal complet (chaque arme livrée avec son support IA) | M4 | M4 |
| 7 | Moteur de présentation, sans art final | Tâches **[tech]** de M6 et M7 | M6 [tech], M7 [tech] |
| 8 | Plateforme | M8 | M8 |
| 9 | Art et son (assets générés puis retouchés, ASSETS §9) | Tâches **[art]** de M6 et M7 | M6, M7 |

- Le lot 9 peut démarrer en parallèle dès que le format de rig (6.1) est figé.
- Dans M6 et M7, **[tech]** désigne une tâche réalisable avec des placeholders, et **[art]** une tâche qui dépend des assets finaux.
- Une gate de jalon partiel (« M6 [tech] ») ne vérifie que les tâches marquées [tech].

---

## M0 — Fondations
| # | Tâche | CA |
|---|---|---|
| 0.1 | Évaluer Phaser 3.x vs 4.x (état de release, API RenderTexture/CanvasTexture, tactile) et consigner la décision dans `docs/adr/0001-phaser-version.md` | ADR rédigée avec la version exacte figée dans `package.json` |
| 0.2 | Scaffold Vite + TS strict + ESLint + Prettier + Vitest | `pnpm run dev`, `build`, `test` fonctionnels |
| 0.3 | Règle ESLint interdisant `Math.random`, `Math.sin`…, `Date`, `performance`, DOM et Phaser dans `src/sim/**` | Un fichier de test violant la règle échoue au lint |
| 0.4 | Arborescence `src/` conforme à `CLAUDE.md` | — |
| 0.5 | CI locale (script `pnpm run check` = lint + typecheck + test) | Vert sur un repo vide |

## M1 — Noyau de simulation (headless)
| # | Tâche | CA |
|---|---|---|
| 1.1 | `sim/math` : fixed-point sub-pixel, LUT trigo BAM 4096 générée au build, `isqrt`, PRNG `sfc32`, hash FNV-1a | Tests unitaires ; la LUT est identique au bit près entre deux générations |
| 1.2 | Chargement du masque PNG vers `Uint8Array` (en Node via un décodeur PNG pur JS, et dans le navigateur) | Le masque de test est identique dans les deux environnements |
| 1.3 | Terrain : chunks, `carveCircle`, `stamp`, hash incrémental | Tests : creuser puis hasher est stable ; la roche reste intacte |
| 1.4 | Unité : capsule, marche (marche ≤ 12 px), chute, dégâts de chute, repos | Tests sur des pentes et des marches de référence |
| 1.5 | Projectile générique : sub-steps, gravité, vent, collision masque et unités | Pas de tunneling à 40 px/tick contre une paroi de 2 px |
| 1.6 | Explosion : carve, dégâts linéaires, impulsion, chaîne différée | Tests de dégâts à d, R/2 et R |
| 1.7 | Boucle de tour : phases, timer en ticks, repli, résolution « tout au repos », fin de partie | Partie scriptée de 3 tours jouée jusqu'à la fin |
| 1.8 | `GameCommand`, `Sim.step`, `snapshot`/`restore`, log de partie | Snapshot, N steps, restore puis N steps donnent le même hash |
| 1.9 | `pnpm run sim:headless` + `pnpm run test:determinism` avec 2 replays de référence | Rejeu vert en CI |
| 1.10 | Test de déterminisme inter-navigateurs (anciennement 9.3) : `pnpm run test:browser` exécute les mêmes sondes (`tests/browser/checks.ts`) dans Node, Chromium, Firefox et WebKit (moteur des navigateurs iPad) via Playwright, puis les replays de référence dès 1.9 | Hashes identiques à ceux de Node |

## M2 — Greybox jouable
| # | Tâche | CA |
|---|---|---|
| 2.1 | Scène Phaser : boucle à accumulateur, interpolation du rendu | 60 fps, aucun drift sur 10 min |
| 2.2 | Rendu du terrain en tuiles 512 et application des carves (`destination-out`) | Explosion visuellement alignée au pixel près avec le masque (overlay debug) |
| 2.3 | Unités en capsules colorées, projectiles en cercles | — |
| 2.4 | Caméra : suivi de l'unité active et des projectiles, pan, zoom, limites | Fonctionne à la souris et au tactile |
| 2.5 | `LocalInputSource` clavier et souris | Toutes les commandes de GDD §8.1 |
| 2.6 | `LocalInputSource` tactile : pad virtuel, drag-to-aim, pinch | Testé sur une tablette réelle |
| 2.7 | Overlay debug F1 (masque, hitboxes, trajectoire prédite, hash, pas-à-pas) | — |
| 2.8 | Armes : arc, fronde, pot de feu grégeois | Jouables de bout en bout |
| 2.9 | Hotseat 2 joueurs, 3 unités chacun, carte de test | Une partie complète est jouable jusqu'à la victoire |

## M3 — Règles complètes
| # | Tâche | CA |
|---|---|---|
| 3.1 | Classes et passifs (GDD §3.2), données dans `content/classes.ts` | Un test par passif |
| 3.2 | Eau, noyade, Déluge | Le Déluge démarre au tour N et l'eau monte selon la spec |
| 3.3 | Reliquaires (ange, chute avec vent, ramassage, piège) | — |
| 3.4 | Barils et flammes persistantes | — |
| 3.5 | Mode Régicide | — |
| 3.6 | Schémas de règles et écran de configuration de partie (greybox) | Les presets du GDD §6 sont disponibles |
| 3.7 | Usure du terrain par toutes les armes (`chipRadius`, GDD §4.7) | Un test : N flèches percent un mur de pierre bâtie d'épaisseur connue ; replay de référence |
| 3.8 | Structures à points de vie : calque d'appartenance, PV, états fissurée / ruine, effondrement en blocs qui tombent et écrasent (GDD §4.7, TECH_SPEC §5.4) | Une tour de la carte de test touchée au feu grégeois se fissure puis s'effondre, les combattants dessous sont blessés ; déterminisme vert |
| 3.9 | Sauvegarde automatique de la partie en cours et reprise après rafraîchissement ou plantage (GDD §12) | Rafraîchir la page en pleine partie, reprendre : même hash d'état qu'avant |
| 3.10 | Aide en tutoriel illustré (GDD §9) | Chaque page tient sur un écran de tablette |
| 3.11 | Cuisine de campagne (GDD §4.9) : apparition décroissante, équité par équipe, soin au tir | Test : sur 1 000 parties simulées, écart d'apparitions entre équipes ≤ 1 par partie |
| 3.12 | Bêtes des marges : lièvres et escargots (GDD §4.10) | Un test par effet ; replay de référence |
| 3.13 | Déplacement par tour : marche limitée ou un seul saut (GDD §3.1) | Tests : la marche s'arrête au budget ; pas de saut après avoir marché, pas de marche après un saut |
| 3.14 | Choix libre du combattant à chaque tour (GDD §2.2) | Tests : on choisit un autre combattant avant d'agir, pas après ; le même peut jouer deux tours de suite |

## M4 — Arsenal complet
| # | Tâche | CA |
|---|---|---|
| 4.1 | Arbalète, pot de poix, cochon enflammé | Un replay de référence par arme |
| 4.2 | Ruche, faucon | idem |
| 4.3 | Volée de trébuchet, pluie de flèches | idem |
| 4.4 | Épée, masse, charge à l'écu | idem |
| 4.5 | Grappin (V1 : un seul ancrage) et escalade au grappin (GDD §4.4 : sortir d'un trou, monter sur un rempart ; 10 PV, fin du tour) | idem ; un combattant au fond d'un trou de 300 px en sort |
| 4.6 | Mur de pierres, échelle, bannière | idem |
| 4.7 | Pioche, sape, chausse-trape (visibilité par équipe), miracle | idem |
| 4.8 | UI d'arsenal (greybox) + munitions | Accessible au clavier et au tactile |
| 4.9 | Machines de siège : baliste, scorpion, catapulte, trébuchet, bélier (GDD §4.8) | Un replay de référence par machine ; une machine détruite s'effondre |
| 4.10 | Mèche du pot en tours (1 = ce tour, 2 = tour suivant, 3 = dans deux tours), pots posés persistants entre les tours (GDD §4.1) | Un pot à mèche 2 explose au début du tour suivant ; replay de référence |

## M5 — IA
| # | Tâche | CA |
|---|---|---|
| 5.1 | Worker IA : réception d'un snapshot, simulation headless | Ne bloque jamais le thread principal (moins de 4 ms de travail main thread par frame) |
| 5.2 | Graphe de marche depuis le masque + pathfinding | L'unité IA atteint une position cible sur 3 cartes |
| 5.3 | Solveur de tir (angle et puissance, vent) pour les armes balistiques et tendues | Touche une cible fixe à 90 % en Connétable |
| 5.4 | Scoring des coups (GDD §7.2) et fallback défensif | L'IA n'inflige pas plus de 10 % de ses dégâts à ses propres alliés sur 50 parties |
| 5.5 | Niveaux Écuyer, Chevalier, Connétable | Taux de victoire Connétable vs Écuyer ≥ 85 % |
| 5.6 | `AIInputSource` (débit de commandes « humain » : visée progressive) | L'action de l'IA reste lisible à l'écran |
| 5.7 | `pnpm run maps:soak` | Rapport généré |

## M6 — Pipeline artistique et vertical slice
**Prérequis** : planche de référence de style validée (ASSETS §9.1).

| # | Tâche | CA |
|---|---|---|
| 6.1 **[tech]** | Format `rig.json` + `anim/*.json`, runtime d'animation cutout | Le Chevalier P0 joue toutes ses animations P0 (rig placeholder accepté en lot 7) |
| 6.2 **[tech]** | Tint de faction + composition dynamique du blason sur l'écu et la bannière | 8 blasons pré-composés affichés |
| 6.3 **[tech]** | `pnpm run maps:build` (découpe, validations) | La carte de test greybox passe les validations (Jéricho : vérifiée au lot 9) |
| 6.4 **[art]** | Carte Jéricho complète (peinture, masque, parallaxe, cadre) | — |
| 6.5 **[art]** | Bord « vélin déchiré » sur les carves | Validé visuellement |
| 6.6 **[art]** | VFX P0 (explosion M, débris, poussière, étoiles, trajectoire) | — |
| 6.7 **[tech]** | HUD P0 (vent, timer, phylactères, cartouches) | — |
| 6.8 **[art]** | Audio P0 (8 SFX d'armes, 5 SFX d'unités, 1 piste de musique) | — |
| 6.9 **[art]** | **Vertical slice** : Jéricho, 2 maisons, 3 Chevaliers chacune, arc/fronde/pot/épée/mur, hotseat et IA | Démo jouable sur PC et tablette à 60 fps |

## M7 — Contenu V1
| # | Tâche | CA |
|---|---|---|
| 7.1 **[art]** | Rigs et animations des 5 autres classes | — |
| 7.2 **[art]** | Assets de toutes les armes et VFX P1 | — |
| 7.3 **[art]** | Cartes du GDD §10, dont les grandes batailles (Hastings, Azincourt, Pavie…) | Chacune passe `maps:build` et `maps:soak` |
| 7.4 **[tech]** | Menus complets, écran titre, victoire, « passez la main », « tournez l'appareil » | — |
| 7.5 **[tech]** | Éditeur de blason et gestion des équipes (persistance) | — |
| 7.6 **[art]** | Audio P1 complet | — |
| 7.7 **[tech]** | Replays : revoir la dernière partie, export et import JSON | Un replay importé est identique bit à bit |

## M8 — Finition et plateforme
| # | Tâche | CA |
|---|---|---|
| 8.1 | Profilage tablette et optimisations (atlas, pooling, limite de ré-upload des tuiles) | Objectifs de TECH_SPEC §9 atteints |
| 8.2 | PWA (manifest, service worker, plein écran, orientation) | Installable ; jouable hors ligne |
| 8.3 | Options d'accessibilité (GDD §13) | — |
| 8.4 | i18n EN | — |
| 8.5 | Équilibrage (tableur de paramètres ; soak IA contre IA par arme) | Aucune arme n'est utilisée dans plus de 30 % des kills IA |

## M9 — En ligne
Décidé le 2026-10-24 : le jeu à distance par code remplace le LAN 2 PC ([ADR 0002](adr/0002-online-transport.md), TECH_SPEC §8).

| # | Tâche | CA |
|---|---|---|
| 9.1 | Projet Firebase `videogames-06` : application web, connexion anonyme, Realtime Database, site d'hébergement `medieverse-06` | Le build est servi en HTTPS sur le site ; un client anonyme lit et écrit `/medieverse/` |
| 9.2 | Interface `Transport` + `RemoteInputSource` + protocole (TECH_SPEC §8.3) | Tests avec un transport en mémoire (latence, désordre) |
| 9.3 | *Déplacée en 1.10* | — |
| 9.4 | Créer une partie et la rejoindre par un code ; règles de sécurité de la salle | Deux navigateurs se retrouvent par le code en moins de 1 min ; un troisième est refusé |
| 9.5 | Lockstep par tour, détection de désync, reprise par rejeu | Désync simulée détectée ; une page rechargée reprend la partie au même hash |
| 9.6 | Partie complète à distance | Une partie jouée jusqu'à la victoire entre deux appareils sur deux réseaux différents (vérification humaine) |
| 9.7 | **Passage du projet en Blaze** (action de l'utilisateur), puis instance de base dédiée, nettoyage planifié des salles abandonnées, alerte de budget | Base dédiée en service ; une salle de plus de 48 h est effacée |

---|---|---|
| 9.1 | **Spike WebRTC** : 2 PC du réseau cible, `iceServers: []`, signaling par copier-coller ; tester Chrome↔Chrome, Chrome↔Firefox et Edge ; mesurer la taille du SDP compressé | Rapport Go/No-Go dans `docs/adr/0002-lan-transport.md` |
| 9.2 | Interface `Transport` + `RemoteInputSource` + protocole (TECH_SPEC §8.1) | Tests avec un transport en mémoire |
| 9.3 | *Déplacée en 1.10* | — |
| 9.4 | UI d'appairage : QR + code texte, lecture QR caméra (optionnelle) | Appairage en moins de 1 min, en 2 échanges |
| 9.5 | Lockstep par tour, détection de désync, reconnexion par rejeu | Désync simulée détectée ; reconnexion OK |
| 9.6 | *Si le spike échoue* : `tools/lan-server` (Node WS + statique, exécutable unique) | Connexion par URL LAN depuis le second PC |

---

## Études
| # | Étude | Livrable |
|---|---|---|
| E1 | Vue isométrique / 3/4 de dessus : analyse et spike ([docs/etudes/vue-isometrique.md](etudes/vue-isometrique.md)) | Décision 2D profil vs iso avant M6 |

## Risques suivis
| Risque | Impact | Mitigation |
|---|---|---|
| Incohérence de style des assets générés | Fort | Planche de référence, génération en pose unique puis découpe, retouche des cernes (ASSETS §9) |
| Désync inter-navigateurs | Fort en ligne | Entiers uniquement, LUT figée, test inter-navigateurs en M9.3 |
| Performance terrain sur tablette | Moyen | Tuiles de 512, upload limité aux tuiles dirty, profilage dès M2 sur un appareil réel |
| Coût Firebase en Blaze | Faible | Messages par lots, salles effacées, alerte de budget (9.7) |
| Droits sur les scans et la musique | Moyen | Scans en référence uniquement ; enregistrements sous licence vérifiée |
| Lisibilité au tactile (petits éléments) | Moyen | Cibles de 48 px minimum, tests sur appareil dès M2.6 |
