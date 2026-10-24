# Étude E1 — Vue isométrique ou « 3/4 de dessus »

Statut : **analyse, aucune décision prise**. Date : 2026-10-24. État du dépôt : fin de M2 (greybox jouable sur moteur 2D de profil à masque de pixels, environ 1 500 lignes dans `src/sim/`).

## 1. La demande

Étudier le passage de Medieverse d'une vue 2D de profil (principe _Worms_) à une vue pseudo-3D vue d'en haut, en 3/4 à la _Zelda: A Link to the Past_ ou en isométrique vrai (_Into the Breach_, _Final Fantasy Tactics_, _Worms 3D_), pour montrer des terrains et une bataille médiévale vus du dessus, avec un plan, une ébauche, la faisabilité et une recommandation, sachant qu'il faut choisir l'une des deux vues.

Précision ajoutée par l'utilisateur : dans une version 3D, on doit pouvoir avancer et reculer, zoomer pour voir les troupes, et regarder la bataille de dessus, de face et de côté (caméra libre ou en orbite), tout en gardant le look Maciejowski. Il demande explicitement que l'idée soit **contestée** et pas seulement validée : voir §6, « Le contre-argumentaire ».

Références utiles :

| Jeu | Projection | Ce qu'on en retient |
|---|---|---|
| _A Link to the Past_ | Oblique (cavalière) 3/4, grille carrée | Le sol est vu de dessus, les murs et les personnages de face ou de profil. Peu de relief. |
| _Into the Breach_ | Isométrique vrai, petite grille | Lisibilité totale : tout se joue au tour par tour sur 8 × 8 cases, les tirs sont prévus. |
| _Final Fantasy Tactics_ | Iso en 3D, caméra tournante | Hauteurs de case, avantage d'altitude, tirs en cloche calculés par le jeu. |
| _Worms 3D_ / _Worms 4_ | Vraie 3D, terrain voxel | Destruction sphérique, mais visée difficile et caméra pénible : la série est revenue à la 2D. |
| _Hedgewars_ | 2D de profil | Le contre-exemple : le même concept, resté en profil, toujours joué. |

## 2. Ce que deviendrait le jeu

### 2.1 Gameplay

- **Artillerie en cloche sur une grille de hauteurs.** Le champ de bataille est un plateau en relief : collines, fossés, murailles, tours. Les unités occupent une position (x, y) au sol et une altitude z.
- **Tirs paraboliques en 3D.** Viser demande trois paramètres au lieu de deux : un **azimut** (direction au sol), une **élévation** et une **puissance**. L'arc et l'arbalète tirent tendu, la fronde et les pots en cloche, le trébuchet frappe hors champ sur une case désignée.
- **Vent en 2D.** Le vent devient un vecteur (direction sur 16 ou 32 rumbs et force), tiré par le PRNG à chaque tour. Il déporte la trajectoire latéralement autant qu'en portée.
- **Couverture.** Une muraille protège ce qui est derrière elle selon la direction du tir : on retrouve le jeu de position des _tactics_ (se placer derrière un merlon, contourner une tour).
- **Chutes depuis les remparts.** La projection par une explosion fait tomber des courtines et des tours : dégâts de chute selon la hauteur, comme aujourd'hui. Les douves et le Déluge (eau qui monte sur toute la carte) fonctionnent très bien en vue de dessus.

### 2.2 Ce qu'on perd

- **La trajectoire lisible en profil.** En profil, la hauteur et la portée sont les deux axes de l'écran : on lit la parabole d'un coup d'œil. En vue de dessus, la hauteur et la profondeur se projettent sur le même axe vertical de l'écran. Il faut des aides (ombre portée du projectile, fil à plomb, trace au sol) pour comprendre où il va tomber. C'est la raison principale pour laquelle _Worms 3D_ est moins jouable que _Worms Armageddon_.
- **La destruction pixel par pixel qui « révèle le vélin ».** Le pilier n° 1 du GDD (le terrain détruit révèle la page) repose sur la coupe : un cratère de profil montre un trou net dans une bande peinte. Vu de dessus, un cratère est une cuvette dans une surface, on voit son fond et non une découpe. On peut peindre le fond en vélin, mais l'effet « page trouée » disparaît en grande partie.
- **L'humour physique de _Worms_.** Rebondir sur un rebord, glisser au fond d'un puits, tomber à l'eau par le bord de l'écran, se balancer au grappin : tout cela marche en profil parce qu'on voit la gravité. En vue de dessus, la chute est surtout un changement d'altitude, moins visible et moins drôle.
- **Plusieurs outils.** Le grappin (pendule), la sape (tunnel horizontal), l'échelle et le mur posé en rotation par pas de 22,5° perdent leur sens ou deviennent coûteux (tunnels impossibles sur une simple carte de hauteurs).

### 2.3 Ce qu'on gagne

- **Des champs de bataille lisibles** : on voit une armée entière, des lignes, une rivière, un pont, un camp de tentes.
- **Des châteaux et des sièges** : enceintes, portes, douves, tours d'angle. Le mode _Siège_ du GDD prend tout son sens.
- **Les machines de siège** : un trébuchet placé sur la carte, une tour de siège qui avance, un bélier contre une porte.
- **Les formations et le positionnement** : flanquer, s'abriter, tenir une hauteur. Le jeu devient plus tactique et moins burlesque.

En résumé, la vue de dessus ne transforme pas Medieverse, elle en fait un **autre jeu**, plus proche d'un _tactics_ d'artillerie que d'un _Worms_.

## 3. Le style Maciejowski vu de dessus

**La tension principale.** Les miniatures de la Bible de Maciejowski sont en profil, sans perspective (ASSETS §1.1, « Pas de perspective »). Le manuscrit montre d'ailleurs ses sièges en coupe de profil : murailles de face, assiégeants côte à côte, trébuchets de profil. Une vue de dessus n'existe pas dans ce langage visuel ; il faut l'emprunter ailleurs dans l'art médiéval.

Pistes, de la plus fidèle à la plus libre :

1. **La « carte enluminée »** (mappa mundi, plans de Jérusalem, portulans). Le sol est vu de dessus comme un plan, mais chaque bâtiment, arbre ou montagne y est dessiné **debout, en élévation**, posé sur le plan. C'est exactement la projection oblique de _Zelda_ : le sol en plan, les volumes en façade. C'est la piste la plus cohérente.
2. **Les combattants en pions-figurines.** Les personnages restent dessinés en profil, comme des figurines de plomb ou des pièces d'échecs debout sur le plan. Ils ne tournent que de gauche à droite (`scaleX = -1`), ce qui conserve les rigs cutout prévus (TECH_SPEC §7) et le langage des miniatures.
3. **Le terrain en strates.** Les falaises et les bords de cratère montrent les « bandes ondulées stratifiées » de la charte (ASSETS §1.1, Paysage) sur leur face verticale visible. Le fond d'un cratère est peint en vélin, avec le bord déchiré ocre : on garde une part du pilier « le manuscrit vivant ».
4. **Le cadre de page.** Le plateau de jeu est présenté comme une page posée, avec marges, rinceaux et fond or : la caméra se promène dans la page.

L'isométrique vrai (losanges, vues à 45°) est la moins compatible : il impose une perspective géométrique et des personnages vus de trois quarts, que la charte exclut.

## 4. Options techniques

### 4.1 Les quatre options

**A. Rester en 2D de profil (statu quo).** Rien ne change. Le masque `Uint8Array` à 6 matériaux, les chunks de 256, les carves `destination-out` et le rig cutout restent la base.

**B. 2,5D « 3/4 de dessus » (projection oblique à la _Zelda_).**

- `src/sim` : le masque 2D devient une **grille de colonnes** (par exemple une cellule de 8 px de côté, 512 × 512 cellules au plus), chaque colonne portant une hauteur entière et un matériau, ou une courte liste de tranches (sol, plancher de rempart) pour autoriser ponts et passages voûtés. Positions et vitesses en `(x, y, z)` sub-pixels `int32`. Collision d'un projectile = comparer son `z` à la hauteur de la colonne traversée, avec sous-pas ≤ 2 px comme aujourd'hui. Explosion = calotte sphérique retirée des colonnes (`isqrt(R² − d²)`), dégâts linéaires en distance 3D. Marche des unités en (x, y) avec une marche maximale en z ; chute libre selon z. Le vent devient `(wx, wy)`. Hash par chunk de colonnes. Tout reste entier et déterministe.
- `render` : tuiles du sol dessinées de dessus, faces verticales sud dessinées en façade, tri en profondeur par `y`. Une destruction redessine les colonnes touchées de quelques tuiles. Ombre portée et fil à plomb sous chaque projectile, trace au sol de la trajectoire prédite.
- `input` : azimut + élévation + puissance. Au clavier, ← → tourne l'azimut, ↑ ↓ l'élévation, Espace la puissance. Au tactile, glisser depuis l'unité donne l'azimut et la puissance ; l'élévation vient d'un curseur ou d'un préréglage par arme (tendu / cloche).
- `ai` : la marche se fait sur une grille, donc le pathfinding devient plus simple (A\* sur cellules). Le solveur de tir gagne une dimension : l'azimut se déduit de la direction de la cible corrigée du vent, puis on cherche élévation et puissance. Coût de recherche environ ×3 à ×5.
- `assets` : rigs inchangés (pions en profil), plus une ombre. Les cartes ne sont plus une grande peinture et un masque PNG, mais une carte de hauteurs + une carte de matériaux + un jeu de tuiles en strates + des structures dessinées en élévation. Pipeline ASSETS §7 et §9 à refaire.
- `maps` : `map.json` + `height.png` (niveaux de gris) + `material.png` + `structures`. `maps:build` change entièrement.
- `net` : inchangé dans son principe (lockstep par tour, commandes, hash). Seul le contenu des commandes `aim` change.

**C. Isométrique vrai avec voxels destructibles.**

- `src/sim` : volume de voxels (par exemple 256 × 256 × 64 voxels de 8 px, 4 Mo à un octet par voxel), cratères sphériques, tunnels et surplombs possibles. Effondrement des structures en blocs 3D. Plus lourd en mémoire et en hash (chunks 3D), mais faisable en entiers.
- `render` : sprites iso en losange triés en profondeur (`x + y + z`), invalidation et retri à chaque destruction. Le tri et le redessin sont le point dur sur tablette. Murs devant les unités à rendre translucides ou à couper.
- `input` / `ai` : comme B, plus la gestion de l'occlusion (cibler une unité cachée derrière une tour) et la rotation de caméra par quarts de tour.
- `assets` : chaque structure dessinée sous 2 à 4 orientations, personnages en trois quarts (contraire à la charte), tuiles iso. Volume d'assets nettement supérieur.

**D. Vraie 3D (Three.js ou Babylon.js).**

- La simulation pourrait rester pure et entière, mais tout le reste change : abandon de Phaser, modèles 3D à produire, éclairage, caméra libre.
- **À déconseiller** : la perf sur tablette de milieu de gamme (iPad 9ᵉ génération) avec un terrain destructible remaillé à chaque explosion est hors budget (TECH_SPEC §9) ; le pipeline d'assets (génération IA d'images plates puis retouche) ne produit pas de modèles 3D ; l'esthétique des aplats cernés se perd presque toujours en 3D, sauf en billboards plats, ce qui revient à B en plus cher.

### 4.2 Comparaison

| Critère | A. Profil 2D | B. 3/4 oblique (colonnes) | C. Iso voxels | D. Vraie 3D |
|---|---|---|---|---|
| Effort supplémentaire | 0 | Élevé : +10 à 14 semaines | Très élevé : +16 à 24 semaines | Hors de portée : refonte complète |
| Risque | Faible | Moyen : lisibilité de la visée à prouver | Élevé : perf tablette, occlusion, tri | Très élevé |
| Déterminisme | Acquis (gate M1 PASS) | Conservé, à re-prouver (sim en x, y, z entiers) | Conservé, hash 3D plus coûteux | Conservé si la sim reste séparée |
| Destruction du terrain | Pixel près, vélin révélé | Cratères en cuvette, tunnels impossibles | Totale (tunnels, surplombs) | Totale, mais remaillage coûteux |
| IA | Prévue (M5) | Pathfinding plus simple, solveur ×3 à ×5 | Comme B, plus l'occlusion | Comme C |
| LAN | Prévu (M9) | Inchangé | Inchangé | Inchangé |
| Assets (ASSETS.md) | Pipeline actuel | Rigs conservés ; cartes et tuiles à refaire | Rigs à refaire en 3/4, tuiles iso, ×2 à ×3 | Modèles 3D, pipeline à inventer |
| Fidélité au style | Native | Bonne (carte enluminée, pions en profil) | Faible (perspective, 3/4) | Faible |
| Tablette | Budget tenu en M2 | Probable, à mesurer | Incertain | Improbable |
| Caméra (cf. §6.1) | Pan + zoom, vue de côté fixe | 4 rotations de 90° + zoom, inclinaison fixe | 4 rotations de 90° + zoom, inclinaison fixe | Orbite libre, dessus, face, côté |

Les efforts sont des ordres de grandeur, comptés en plus du backlog actuel, à confirmer par le spike.

### 4.3 Ce que B réutilise du code actuel

- Intégralement : `src/sim/math/` (fixed-point, LUT, `isqrt`, PRNG, hash), `GameCommand` et `InputSource`, la boucle de tour (phases, timer, repli, résolution « tout au repos »), le log et les replays, `tools/browser-determinism.ts`, le HUD et l'habillage DOM (`src/ui/`), les commentaires burlesques, le LAN prévu.
- À réécrire : `src/sim/terrain/` (masque → colonnes), `src/sim/units/unit.ts` (capsule 2D → cylindre 3D), `src/sim/projectiles/projectile.ts` et `src/sim/explosions/explosion.ts` (en 3D), `src/render/terrain-layer.ts` et la caméra de `src/render/battle-scene.ts`, `src/input/local-controls.ts` (visée à trois paramètres), les replays de référence (à réenregistrer).

## 5. Ébauche visuelle (option B)

```
+--------------------------------------------------------------------------------------+
| Tour 7   Déluge dans 13      ~~~~ vent ↗ 6 ~~~~                         [sablier 31] |
|                         « Visez la tête, messire ! »                                 |
|                                                                                      |
|      ^^^  ^^^        ______________________________                                  |
|     (♣)  (♣)        |▓▓ courtine ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓|  ← face sud en strates           |
|                     |  ┌──┐    ┌──┐      ┌──┐     |                                  |
|   ≈≈≈≈ douves ≈≈≈≈≈≈|  │♜ │    │♜ │ .  ' │♜ │ ° B |  ← B = arbalétrier ennemi        |
|   ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈|  └──┘   .°  '     └──┘  ●  |    ● = ombre du projectile       |
|                     |____.______________________|    ° = trajectoire (arc projeté)  |
|          ,,,,      .         ,,,                       ' = fil à plomb               |
|        ,,,,,,,  .     ___                                                            |
|       ,,,,,,,,.      ( o ) ← cratère au fond de vélin                                |
|            A ─ ─ ─ ·  ·  ·  (trace au sol de la visée, azimut 52°)                   |
|           /█\  ← pion en profil, auréole dorée                                       |
|                                                                                      |
| [◄][►][saut]   Azimut 52°  Élév. 38°  ▮▮▮▮▮▯▯ puissance    [Arsenal] [Passer] [TIR] |
+--------------------------------------------------------------------------------------+
```

Un tour : la caméra glisse vers l'unité active (pion A, en profil sur le plan). Le joueur la déplace sur le sol, contourne un bosquet, s'arrête au bord des douves. Il choisit la fronde, fait glisser le doigt vers l'arrière depuis l'unité : la trace au sol indique la direction, l'arc pointillé et son ombre montrent où la pierre retombera. Il relève l'élévation pour passer par-dessus la courtine. La pierre part, son ombre file sur l'herbe, franchit les douves et monte sur le chemin de ronde ; elle touche l'arbalétrier, qui bascule en arrière et chute de six mètres dans la cour. Badaboum.

## 6. Le contre-argumentaire

Cette section prend le contre-pied de la demande, surtout de la caméra libre (avancer, reculer, zoomer, voir de dessus, de face et de côté), et cherche les objections les plus solides.

### 6.1 Ce que chaque option permet vraiment comme caméra

| Option | Avancer / reculer, zoom | Vue de dessus | Vue de face / de côté | Rotation |
|---|---|---|---|---|
| A. Profil 2D | Pan et zoom déjà livrés en M2 (on voit les troupes de près) | Non | De côté seulement, par construction | Aucune |
| B. 3/4 oblique | Pan et zoom | Oui, inclinaison fixe (une seule) | Non : la projection est figée | 4 quarts de tour, si chaque structure est dessinée sur ses 4 faces |
| C. Iso voxels | Pan et zoom | Oui, inclinaison fixe | Non | 4 quarts de tour (_FFT_, _Tactics Ogre_) ; tuiles et structures ×4 |
| D. Vraie 3D | Libre | Oui | Oui | Orbite libre |

**Seule l'option D satisfait la demande à la lettre.** B et C donnent au mieux « dessus en 3/4, quatre orientations, zoom ». Les jeux 2D à caméra tournante plafonnent tous à 4 ou 8 orientations avec une inclinaison fixe (_Don't Starve_, _Tactics Ogre_), précisément parce que chaque orientation supplémentaire est un jeu de dessins de plus.

### 6.2 Objections

1. **Une caméra libre tue l'enluminure.** Un dessin plat n'a qu'un angle de vue. En orbite libre, il faut soit des modèles 3D avec un shader de cerne (on obtient un rendu de type _Ni no Kuni_ ou _Zelda: Wind Waker_, pas une miniature de 1250), soit des personnages en panneaux plats toujours tournés vers la caméra (_Paper Mario_), qui deviennent des lames sans épaisseur vues de dessus. Le fond or ou diapré n'existe plus (il faut un ciel), le terrain n'est plus une peinture mais une texture plaquée sur un maillage, et la « page trouée qui révèle le vélin » disparaît. On garde la palette, plus le manuscrit. Le look « fun Maciejowski » survit en vue de côté, c'est-à-dire… en 2D.
2. **La lisibilité se dégrade à chaque angle.** Avec une caméra libre, le joueur doit régler la caméra à chaque tour avant de viser. C'était la principale critique adressée à _Worms 3D_. La profondeur se lit mal sur un écran plat : il faut des ombres, des fils à plomb, une trace au sol. Les murailles cachent les unités (occlusion, murs à rendre transparents). En hotseat, chacun hérite de la caméra laissée par l'autre. Le pilier « chaos lisible » et la promesse « une partie se comprend en 2 minutes » (GDD §1) en souffrent directement.
3. **Les contrôles tactiles saturent.** Sur tablette, sans manettes, il faudrait en même temps : déplacer la caméra (un doigt), zoomer (pincer), tourner l'orbite (deux doigts en rotation), incliner (deux doigts verticaux), déplacer l'unité (pad) et viser sur trois paramètres (azimut, élévation, puissance). Les gestes entrent en conflit avec le drag-to-aim, et les cibles de 48 px s'empilent. _Worms 3D_ se jouait avec deux sticks analogiques.
4. **Le coût change d'échelle.** L'option D, c'est un nouveau moteur de rendu (Three.js ou Babylon.js à la place de Phaser pour la bataille), un terrain destructible remaillé à chaque explosion (marching cubes sur chunks de voxels), des modèles 3D riggés et skinnés à produire (la génération d'images IA puis la retouche, ASSETS §9, ne fabrique pas de modèles 3D), l'éclairage, les ombres, les niveaux de détail. Ordre de grandeur : **6 à 12 mois de plus**, sans garantie de tenir 45 fps sur un iPad 9ᵉ génération. Seuls `src/sim/math/`, les règles, le LAN, les replays et l'UI DOM survivent.
5. **L'emballement du périmètre.** Une fois la caméra libre acquise, chaque « tant qu'on y est » paraît naturel : rotation, occlusion, collisions 3D des unités, IA qui cherche aussi l'azimut, son 3D, éditeur de cartes en 3D (il n'y a plus d'image à peindre, il faut un outil type MagicaVoxel ou Blender). C'est le schéma classique du projet qui ne sort jamais. CLAUDE.md fixe un périmètre court (pas d'éditeur in-game, pas d'online) : la 3D libre le contredit.
6. **Le déterminisme devient plus délicat.** Il reste possible, mais en 3D les carrés de distance en sub-pixels dépassent vite `int32` (1 310 720² ≈ 1,7 × 10¹²) : il faut réduire la précision ou découper les calculs, et tout re-prouver sur les quatre moteurs de navigateur.
7. **Une partie de la demande est déjà couverte.** Zoomer pour voir les troupes de près, avancer et reculer le long du champ de bataille : la caméra de M2 le fait déjà en 2D. Avec les rigs finaux (M6), un zoom avant montrera les mailles des hauberts et les blasons. Ce qui manque vraiment, c'est la vue de dessus et la rotation, et ce sont justement les deux éléments les plus coûteux et les plus contraires au style.

### 6.3 Ce qui reste valable dans l'idée

Le spectacle d'un siège vu d'en haut, l'immersion, le plaisir de tourner autour d'un château sont réels. Une vraie 3D aurait du sens pour **un autre produit** : d'abord sur PC, avec un artiste 3D dans l'équipe et un style assumé « figurines peintes » plutôt que « manuscrit ». Pour Medieverse tel que défini, le meilleur compromis 3D serait B (ou C) avec 4 orientations, une inclinaison fixe et le zoom, pas une orbite libre. Ce contre-argumentaire renforce la recommandation du §8.

## 7. Plan proposé

### Phase 0 — Maintenant (sans coût)

- Terminer la gate M2 en 2D. Ne rien changer au moteur.
- Ne pas lancer de travail coûteux spécifique au profil avant la décision si elle doit tomber vite : en particulier 3.7 et 3.8 (usure et effondrement des structures sur le masque 2D) et le format de rig 6.1.

### Phase 1 — Spike jetable (1 semaine, timebox stricte)

Branche `spike/iso`, code jetable, hors `src/` de `main`. Greybox uniquement : colonnes en blocs colorés, pions en capsules debout.

| CA du spike | Mesure |
|---|---|
| Lisibilité de la visée | Après 10 tirs d'échauffement, l'utilisateur prédit la case d'impact à ±1 cellule dans 70 % des tirs, sur cible à 3 distances, vent compris |
| Temps de visée | Médiane < 15 s par tir, au clavier et au tactile |
| Coût de la destruction | Cratère R = 60 px sur une carte de 512 × 512 colonnes : < 1 ms dans la sim, < 8 ms de redessin, mesurés sur tablette |
| Perf tablette | 60 fps sur iPad 9ᵉ gén. (ou équivalent) avec 12 unités et 3 projectiles, 45 fps minimum en pic |
| Déterminisme | Une sonde 3D (projectile + cratère) donne le même hash dans Node, Chromium, Firefox et WebKit |
| Style | Une maquette peinte d'un écran (carte enluminée, pions en profil) jugée par l'utilisateur à côté d'une capture 2D actuelle |
| Plaisir | Une partie hotseat de 10 tours en greybox : l'utilisateur dit s'il préfère la jouer à la 2D |

Un CA non mesuré (pas de tablette disponible, par exemple) est **NOT ASSESSED**, jamais PASS.

### Phase 2 — Décision

ADR `docs/adr/0003-vue-de-jeu.md` : contexte, mesures du spike, décision, conséquences. Si la vue de profil est gardée, la branche du spike est supprimée et l'étude est close.

### Phase 3 — Si la vue de dessus est retenue : re-cadrage du backlog

| Jalon | Impact |
|---|---|
| M1 | Rouvert pour 1.2 à 1.6 (terrain en colonnes, unité 3D, projectile 3D, explosion sphérique), 1.9 et 1.10 (replays à réenregistrer). 3 à 4 semaines |
| M2 | 2.2, 2.4, 2.6, 2.7, 2.8 refaits (rendu oblique, caméra, visée à trois paramètres, overlay debug). 3 à 4 semaines |
| M3 | 3.7 et 3.8 à respécifier (usure et effondrement en 3D) ; Déluge et eau simplifiés. +1 semaine |
| M4 | Grappin, sape, échelle et mur en rotation à repenser ou retirer ; trébuchet et pluie de flèches gagnent. +1 à 2 semaines |
| M5 | 5.2 plus simple (grille), 5.3 plus coûteux (azimut). +1 semaine |
| M6–M7 | `maps:build`, format de carte, tuiles en strates, structures en élévation, 6 cartes à refaire. +2 à 4 semaines |
| M9 | Sans impact |
| Docs | GDD §2 à §5, §8, §10 ; TECH_SPEC §4 à §6 ; ASSETS §1.1, §3, §7 ; manuel du joueur |

Total : **environ 10 à 14 semaines** de plus pour B, soit l'équivalent de plusieurs jalons, avant tout gain visible.

## 8. Recommandation

**Garder la vue 2D de profil (option A) pour Medieverse.** Les raisons :

1. **Le style l'exige.** La Bible de Maciejowski est en profil, ses sièges aussi. Les piliers du GDD (« le manuscrit vivant », « le terrain détruit révèle le vélin », « chaos lisible ») sont des propriétés de la vue en coupe. La vue de dessus garde la palette et les cernes, pas le langage.
2. **Le genre l'exige.** Une artillerie à visée libre en vue de dessus pose un problème de lisibilité connu (_Worms 3D_). Les jeux qui réussissent en iso (_Into the Breach_, _FFT_) le font en renonçant à la visée libre : le joueur désigne une case et le jeu calcule l'arc. Ce serait un autre jeu. Quant à la caméra libre (dessus, face, côté), seule la vraie 3D (D) la permet, et c'est l'option la plus chère et la plus éloignée du style (§6).
3. **Le coût est réel et il croît.** Aujourd'hui, la partie spécifique au profil fait environ 800 lignes dans `src/sim/` et 400 dans `src/render/` : changer coûte encore « seulement » 10 à 14 semaines. Chaque lot ajouté sur le masque 2D (structures en 3.8, IA en lot 5, arsenal en lot 6) alourdit la facture.
4. **Le désir de champs de bataille vus d'en haut se satisfait autrement**, sans changer de moteur : une **carte de campagne enluminée** à la manière d'une mappa mundi pour choisir les batailles (écran de sélection en M7, ou mode campagne en P2) ; des cartes de profil plus larges avec **châteaux en coupe**, comme les sièges du manuscrit (le schéma _Siège_ du GDD) ; un **plan de la carte en vignette** dans le HUD.
5. **Si l'envie d'un _tactics_ médiéval persiste**, en faire un projet distinct plus tard : `src/sim/math/`, l'architecture `GameCommand` / `InputSource`, les replays, le LAN, l'IA headless et l'habillage manuscrit sont réutilisables tels quels.

**Échéance.** La décision doit être prise **au plus tard avant le lot 9 (art de M6) et le gel du format de rig 6.1**. Au-delà, des cartes peintes et des rigs auraient été produits pour une vue abandonnée. Le moment le moins cher est **maintenant, juste après la gate M2 et avant le lot 3** : si l'utilisateur hésite vraiment, lancer le spike d'une semaine (phase 1) à ce moment-là plutôt que plus tard. Sans hésitation réelle, clore l'étude et poursuivre en profil.
