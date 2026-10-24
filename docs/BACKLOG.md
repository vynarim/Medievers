# Medievers — Backlog et jalons

Chaque tâche est dimensionnée pour une session Claude Code. Les critères d'acceptation (CA) sont vérifiables. On ne passe pas au jalon suivant tant que les CA du jalon courant ne sont pas verts.

Ordre recommandé : simulation d'abord, en headless et testée, puis rendu en greybox, puis art. La production artistique (planche de style, ASSETS §9.1) peut démarrer **en parallèle dès M1**.

---

## M0 — Fondations
| # | Tâche | CA |
|---|---|---|
| 0.1 | Évaluer Phaser 3.x vs 4.x (état de release, API RenderTexture/CanvasTexture, tactile) et consigner la décision dans `docs/adr/0001-phaser-version.md` | ADR rédigée avec la version exacte figée dans `package.json` |
| 0.2 | Scaffold Vite + TS strict + ESLint + Prettier + Vitest | `npm run dev`, `build`, `test` fonctionnels |
| 0.3 | Règle ESLint interdisant `Math.random`, `Math.sin`…, `Date`, `performance`, DOM et Phaser dans `src/sim/**` | Un fichier de test violant la règle échoue au lint |
| 0.4 | Arborescence `src/` conforme à `CLAUDE.md` | — |
| 0.5 | CI locale (script `npm run check` = lint + typecheck + test) | Vert sur un repo vide |

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
| 1.9 | `npm run sim:headless` + `npm run test:determinism` avec 2 replays de référence | Rejeu vert en CI |

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

## M4 — Arsenal complet
| # | Tâche | CA |
|---|---|---|
| 4.1 | Arbalète, pot de poix, cochon enflammé | Un replay de référence par arme |
| 4.2 | Ruche, faucon | idem |
| 4.3 | Volée de trébuchet, pluie de flèches | idem |
| 4.4 | Épée, masse, charge à l'écu | idem |
| 4.5 | Grappin (V1 : un seul ancrage) | idem |
| 4.6 | Mur de pierres, échelle, bannière | idem |
| 4.7 | Pioche, sape, chausse-trape (visibilité par équipe), miracle | idem |
| 4.8 | UI d'arsenal (greybox) + munitions | Accessible au clavier et au tactile |

## M5 — IA
| # | Tâche | CA |
|---|---|---|
| 5.1 | Worker IA : réception d'un snapshot, simulation headless | Ne bloque jamais le thread principal (moins de 4 ms de travail main thread par frame) |
| 5.2 | Graphe de marche depuis le masque + pathfinding | L'unité IA atteint une position cible sur 3 cartes |
| 5.3 | Solveur de tir (angle et puissance, vent) pour les armes balistiques et tendues | Touche une cible fixe à 90 % en Connétable |
| 5.4 | Scoring des coups (GDD §7.2) et fallback défensif | L'IA n'inflige pas plus de 10 % de ses dégâts à ses propres alliés sur 50 parties |
| 5.5 | Niveaux Écuyer, Chevalier, Connétable | Taux de victoire Connétable vs Écuyer ≥ 85 % |
| 5.6 | `AIInputSource` (débit de commandes « humain » : visée progressive) | L'action de l'IA reste lisible à l'écran |
| 5.7 | `npm run maps:soak` | Rapport généré |

## M6 — Pipeline artistique et vertical slice
**Prérequis** : planche de référence de style validée (ASSETS §9.1).

| # | Tâche | CA |
|---|---|---|
| 6.1 | Format `rig.json` + `anim/*.json`, runtime d'animation cutout | Le Chevalier P0 joue toutes ses animations P0 |
| 6.2 | Tint de faction + composition dynamique du blason sur l'écu et la bannière | 8 blasons pré-composés affichés |
| 6.3 | `npm run maps:build` (découpe, validations) | La carte Jéricho passe les validations |
| 6.4 | Carte Jéricho complète (peinture, masque, parallaxe, cadre) | — |
| 6.5 | Bord « vélin déchiré » sur les carves | Validé visuellement |
| 6.6 | VFX P0 (explosion M, débris, poussière, étoiles, trajectoire) | — |
| 6.7 | HUD P0 (vent, timer, phylactères, cartouches) | — |
| 6.8 | Audio P0 (8 SFX d'armes, 5 SFX d'unités, 1 piste de musique) | — |
| 6.9 | **Vertical slice** : Jéricho, 2 maisons, 3 Chevaliers chacune, arc/fronde/pot/épée/mur, hotseat et IA | Démo jouable sur PC et tablette à 60 fps |

## M7 — Contenu V1
| # | Tâche | CA |
|---|---|---|
| 7.1 | Rigs et animations des 5 autres classes | — |
| 7.2 | Assets de toutes les armes et VFX P1 | — |
| 7.3 | Cartes Ela, Camp, Arche, Tour, Verger | Chacune passe `maps:build` et `maps:soak` |
| 7.4 | Menus complets, écran titre, victoire, « passez la main », « tournez l'appareil » | — |
| 7.5 | Éditeur de blason et gestion des équipes (persistance) | — |
| 7.6 | Audio P1 complet | — |
| 7.7 | Replays : revoir la dernière partie, export et import JSON | Un replay importé est identique bit à bit |

## M8 — Finition et plateforme
| # | Tâche | CA |
|---|---|---|
| 8.1 | Profilage tablette et optimisations (atlas, pooling, limite de ré-upload des tuiles) | Objectifs de TECH_SPEC §9 atteints |
| 8.2 | PWA (manifest, service worker, plein écran, orientation) | Installable ; jouable hors ligne |
| 8.3 | Options d'accessibilité (GDD §13) | — |
| 8.4 | i18n EN | — |
| 8.5 | Équilibrage (tableur de paramètres ; soak IA contre IA par arme) | Aucune arme n'est utilisée dans plus de 30 % des kills IA |

## M9 — LAN
| # | Tâche | CA |
|---|---|---|
| 9.1 | **Spike WebRTC** : 2 PC du réseau cible, `iceServers: []`, signaling par copier-coller ; tester Chrome↔Chrome, Chrome↔Firefox et Edge ; mesurer la taille du SDP compressé | Rapport Go/No-Go dans `docs/adr/0002-lan-transport.md` |
| 9.2 | Interface `Transport` + `RemoteInputSource` + protocole (TECH_SPEC §8.1) | Tests avec un transport en mémoire |
| 9.3 | Test de déterminisme inter-navigateurs (mêmes replays dans Chrome et Firefox) | Hashes identiques |
| 9.4 | UI d'appairage : QR + code texte, lecture QR caméra (optionnelle) | Appairage en moins de 1 min, en 2 échanges |
| 9.5 | Lockstep par tour, détection de désync, reconnexion par rejeu | Désync simulée détectée ; reconnexion OK |
| 9.6 | *Si le spike échoue* : `tools/lan-server` (Node WS + statique, exécutable unique) | Connexion par URL LAN depuis le second PC |

---

## Risques suivis
| Risque | Impact | Mitigation |
|---|---|---|
| Incohérence de style des assets générés | Fort | Planche de référence, génération en pose unique puis découpe, retouche des cernes (ASSETS §9) |
| Désync inter-navigateurs | Fort en LAN | Entiers uniquement, LUT figée, test inter-navigateurs en M9.3 |
| Performance terrain sur tablette | Moyen | Tuiles de 512, upload limité aux tuiles dirty, profilage dès M2 sur un appareil réel |
| Signaling WebRTC en LAN (mDNS) | Moyen | Spike M9.1 et fallback B |
| Droits sur les scans et la musique | Moyen | Scans en référence uniquement ; enregistrements sous licence vérifiée |
| Lisibilité au tactile (petits éléments) | Moyen | Cibles de 48 px minimum, tests sur appareil dès M2.6 |
