# Medievers — Game Design Document

## 1. Vision

**Pitch** : des armées enluminées sortent des pages d'un manuscrit du XIIIᵉ siècle et s'affrontent à l'arc, au trébuchet et au feu grégeois, sur des paysages peints qui s'effritent à chaque tir.

**Piliers**
1. **Le manuscrit vivant** — tout ressemble à une page enluminée : aplats, cernes noirs, fonds or, cadres architecturés. Le terrain détruit révèle le vélin.
2. **Chaos lisible** — physique imprévisible mais toujours compréhensible ; chaque tir raté peut devenir drôle.
3. **Tour par tour accessible** — une partie se comprend en 2 minutes, se maîtrise en 20 heures.
4. **Local d'abord** — on joue ensemble dans la même pièce.

**Ton** : burlesque. Les personnages gardent la gravité figée des enluminures (visages impassibles, gestes hiératiques) mais subissent des catastrophes absurdes. Le comique naît de ce contraste, et d'un humour décalé à la Monty Python : un commentaire tiré au hasard accompagne chaque début de tour, tir, blessure, mort ou tir raté, et les impacts font jaillir des onomatopées de bande dessinée à la mode médiévale (« Badaboum ! », « Palsambleu ! », « Tchac ! »). Ces répliques sont des pastiches et des clins d'œil, jamais des citations de films. Les décors s'inspirent d'épisodes du manuscrit (Jéricho, Aï, la vallée d'Ela, l'Arche) sans narration religieuse.

**Public** : 10 ans et plus, joueurs occasionnels et nostalgiques de Worms. Pas de sang : les dégâts produisent des étoiles, des plumes et des éclats de vélin.

## 2. Boucle de jeu

### 2.1 Partie (escarmouche)
1. Configuration : 2 à 4 équipes (V1 : 2 équipes garanties, 3–4 en P1), 1 à 6 unités par équipe (**4 par défaut**, réglable : « Combattants par maison », décidé le 2026-10-24 ; placement réparti sur la part de carte de chaque maison, sur un sol large), carte, schéma de règles.
2. Placement (décidé le 2026-10-24) : **chaque maison pose un combattant à tour de rôle**, en cliquant sur la carte (un trait à ses couleurs montre où il tombera), jusqu'à ce que toutes les armées soient en place ; puis le tour 1 commence. Pas à moins de 36 px d'un autre combattant ni du bord, et il faut un sol où tenir. 20 s par combattant ; le temps écoulé, il est posé sur sa colonne par défaut (`turn.placementTicks`, absent des vieux logs : placement automatique).
3. Tours alternés jusqu'à ce qu'il reste une seule équipe vivante, ou fin du Déluge.

### 2.2 Tour
| Phase | Durée par défaut | Description |
|---|---|---|
| Transition | 2 s | Caméra vers l'unité active, affichage du vent |
| Action | 45 s | Déplacement libre, choix d'une arme, visée, tir |
| Après le tir | temps d'action restant, **5 s au plus** (au moins 3 s) | Comme le repli de Worms (décidé le 2026-10-24, étude E2) : on choisit sa position avant de tirer, il reste juste de quoi se mettre à l'abri (`turn.retreatMaxTicks`). Le tir ne termine pas le tour (décidé le 2026-10-24) : on peut se déplacer puis tirer, ou tirer puis se déplacer, avec les déplacements pas encore utilisés (marche ou saut, plus tard escalade). **Fin du tour** termine le tour ; il se termine aussi tout seul quand il ne reste aucun déplacement et que le tir est retombé |
| Résolution | variable + 2 s | Attente fin des projectiles, explosions et chutes ; les morts sont alors constatées, puis une pause de 2 s (réglable) laisse voir l'impact et le commentaire avant le tour suivant |
| Fin de tour | — | Passifs de fin de tour, apparition éventuelle d'un reliquaire |

- **Choix du combattant** (décidé le 2026-10-24) : à chaque tour, la maison qui joue **choisit** lequel de ses combattants agit, avant qu'il ne bouge ou ne tire (clic sur le combattant ou sur son nom, ou bouton **⇄ Combattant** qui passe au suivant ; viser ne compte pas comme agir). **Pas deux tours de suite** (décidé le 2026-10-24, remplace « elle peut rejouer le même ») : le combattant qui a joué le tour précédent de sa maison souffle ce tour-ci ; on choisit parmi les autres. Seul survivant, il joue à chaque tour (`turn.noRepeat`). Par défaut, le jeu propose le suivant dans l'ordre de l'équipe. Les règles « rotation imposée » restent disponibles pour les vieux logs (`turn.freeSelect`).
- Le timer se met en pause pendant la visée de précision ? **Non** (le temps est une pression voulue). Il se met en pause pendant la résolution.
- Garde-fou : une résolution est coupée au bout de 30 s, pour qu'une entité bloquée ne fige jamais la partie (`src/content/rules.ts`).

### 2.3 Fin de partie
- Victoire : dernière équipe avec ≥ 1 unité vivante.
- Égalité : toutes les équipes éliminées dans la même résolution.
- Mode **Régicide** (option) : chaque équipe a un Roi ; sa mort élimine l'équipe. Programmé le 2026-10-25 (`MatchRules.regicide`) : quand les morts sont constatées, les autres combattants d'une maison dont le roi est tombé quittent le champ (morts, cause « roi tombé ») ; une maison sans roi dans sa composition joue avec la règle habituelle.

### 2.4 Le Déluge (mort subite)
- Démarre après N tours (défaut : 20 tours ou 15 minutes).
- Annonce en pleine page enluminée (« Et les eaux montèrent… »).
- Chaque fin de tour : niveau d'eau +48 px ; toutes les unités perdent 5 PV (option).
- L'eau tue instantanément (noyade).
- Précisions de programmation (2026-10-25) : valeurs dans `src/content/deluge.ts` (`MatchRules.deluge`, absent des vieux logs : pas de Déluge), réglables dans ⚙ Réglages ; les 5 PV par tour sont réglables, 0 les supprime. Le Déluge commence à la fin du tour N (ou du premier tour fini après 15 minutes de jeu) et l'eau monte dès cette fin de tour, depuis le bas de la carte (ou depuis le niveau d'eau de la carte, `waterLevel`). Un combattant se noie dès que ses pieds passent sous la surface, à tout instant ; on ne peut pas poser un combattant sous l'eau au placement. Tirs, reliquaires, barils, pots posés, cuisine et bête qui passent sous l'eau disparaissent. Rendu : bandes d'outremer et crêtes de vagues enroulées ; annonce « Et les eaux montèrent… ». Replay de référence `deluge`.

### 2.5 Le parchemin brûle (décidé le 2026-10-24)
- Après **2 tours de table**, la carte prend feu **à ses deux extrémités**, comme une page de parchemin approchée d'une chandelle. À la fin de chaque tour de table, le feu avance de **60 px** de chaque côté (décidé le 2026-10-24, réduit de 120) (jusqu'au milieu de la carte au plus).
- Un combattant qui se trouve dans la partie brûlée à la fin d'un tour (n'importe quel tour) perd **20 PV**. Le feu pousse donc les armées à se rapprocher, et sert de fin forcée à côté du Déluge.
- Une cuisine de campagne rattrapée par le feu s'éteint.
- Rendu : page noircie, bord brun qui ondule comme un papier qui se recroqueville, ligne de flammes. Valeurs dans `src/content/burn.ts` (`MatchRules.burn`, absent des vieux logs : pas de feu), réglables dans ⚙ Réglages (onglet Parchemin en feu).

## 3. Unités

### 3.1 Règles communes
- PV : 100 (option 50 / 150 / 200).
- Déplacement : marche (vitesse 1,5 px/tick), franchit une marche ≤ 12 px, pente max ~60°.
- **Déplacement par tour** (décidé le 2026-10-24) : **soit on marche, soit on saute**, pas les deux. La marche est limitée à environ 10 largeurs de combattant (**280 px**, action et repli confondus) ; un seul saut avant porte à environ 15 largeurs (≈ 420 px sur sol plat, portée fixe). Dès qu'on a marché, on ne peut plus sauter ; après un saut, on ne peut plus marcher. Valeur réglable (`unit.moveBudget`). La barre de souffle s'affiche dans le cartouche du tour.
- **Demi-tour gratuit** (décidé le 2026-10-24, étude E2) : marcher vers l'autre côté retourne d'abord le combattant sur place pendant 0,2 s, sans avancer. Un appui bref pour regarder derrière soi ne coûte donc ni marche ni saut (`unit.turnTicks`).
- **Saut long** (Entrée : devant soi ; boutons ↶ et ↷ : vers la gauche ou vers la droite, le combattant se retourne au besoin) : bond loin. **Saut haut** (double appui, bouton ↑, placé entre ◀ et ▶) : bond très haut en reculant un peu, pour sortir d'un trou ou monter sur un rebord. Un saut décolle aussi depuis une pente montante. Valeurs de départ, à régler en playtest : avant (+8,2 ; −9) px/tick, soit environ 420 px sur sol plat et 115 px de hauteur, arrière (−1 ; −10,5) px/tick, plus haut (environ 150 px) et court (`src/content/units.ts`).
- Dégâts de chute : au-delà de 160 px de hauteur de chute, 1 PV par 8 px supplémentaires, plafonné à 30.
- Hors carte (bords latéraux) ou eau : mort.
- Une unité touchée pendant son tour termine son tour immédiatement.
- Mort : l'unité laisse une stèle (petite croix ou dalle gravée) soumise à la physique.

### 3.2 Classes (hybride : arsenal commun + un passif)
| Classe | Passif | Contrepartie | Visuel |
|---|---|---|---|
| **Chevalier** | Haubert : −25 % de dégâts d'explosion reçus | Saut −30 %, recul +0 (lourd) | Haubert intégral, heaume, écu armorié |
| **Archer** | Œil exercé : prévisualisation de trajectoire 2× plus longue pour arc/arbalète | — | Chaperon, carquois |
| **Frondeur** | Bras souple : puissance max +15 % sur les armes lancées (fronde, pots) | PV max −10 | Tunique courte, fronde |
| **Sapeur** | Maître d'œuvre : creusement 2× plus rapide ; voit les chausse-trapes ennemies | — | Bonnet, pioche, tablier |
| **Clerc** | Bénédiction : en fin de *son* tour, +10 PV aux alliés à ≤ 120 px (pas lui-même) | Pas d'armes de mêlée | Robe, tonsure, crosse |
| **Roi** | Majesté : alliés à ≤ 200 px infligent +10 % de dégâts | PV −20 ; obligatoire et unique en mode Régicide | Couronne, manteau, sceptre |

- Composition d'équipe : libre (option : max 2 par classe), Roi limité à 1.
- Les passifs sont affichés dans la fiche de l'unité (appui long / survol).
- Précisions de programmation (2026-10-25) : valeurs dans `src/content/classes.ts` (`MatchRules.classes`, absent des vieux logs : pas de classes), réglables dans ⚙ Réglages ; la composition de chaque maison est dans sa `TeamConfig` (`classes`). *Haubert* s'applique aux explosions seulement (pas aux flèches, chutes ni au feu). *Lourd* : les vitesses de saut du chevalier sont à 84 %, soit des sauts environ 30 % plus courts et moins hauts. *Œil exercé* : la trajectoire prévue s'affiche quand on charge le tir (ou toujours pour l'arbalète, à puissance fixe), sur 22 instants de vol, 44 pour l'archer à l'arc et à l'arbalète. *Bras souple* : armes marquées « lancées » (fronde, feu grégeois, poix), vitesse de départ +15 %. *Maître d'œuvre* : valeur prête, appliquée quand la pioche et la sape arriveront (M4). *Bénédiction* : appliquée en fin de tour du clerc, avant le feu du parchemin, sans dépasser les PV de départ de chacun. *Majesté* : se mesure au moment du tir, entre le tireur et son roi vivant (pas pour le roi lui-même) ; un pot posé garde le bonus de son lancer. Composition par défaut tant que l'écran de préparation ne la change pas : Chevalier, Archer, Frondeur, Clerc, Sapeur, Roi (Roi en premier en Régicide).

### 3.3 Factions (maisons héraldiques fictives)
- Une équipe = un nom de maison, un blason (champ + meuble + émaux), une couleur primaire et une couleur secondaire.
- Blasons prédéfinis : 8 maisons (ex. *Maison du Lion d'Or*, *Maison des Trois Tours*, *Maison de la Clef*, *Maison du Croissant d'Argent*, *Maison de l'Aigle*, *Maison de l'Ancre*, *Maison du Sanglier*, *Maison de l'Étoile*).
- Éditeur de blason (P1) : 7 émaux héraldiques × ~20 meubles × 6 partitions.
- Le blason est peint sur l'écu, la bannière, la tente de départ et le HUD.
- Noms des unités : listes de prénoms médiévaux tirés aléatoirement (Godefroy, Aubri, Ermengarde…), éditables.

## 4. Arsenal

Toutes les valeurs sont des défauts dans `src/content/weapons.ts`, ajustables par schéma.

### 4.1 Armes de tir et lancées
| Arme | Type | Dégâts max | Rayon expl. | Vent | Munitions | Notes |
|---|---|---|---|---|---|---|
| **Arc** | Projectile tendu | 35 | 0 (impact) | Oui | ∞ | Flèche fichée dans le terrain ; 1 seul tir |
| **Arbalète** | Projectile très tendu | 45 | 0 | Faible (×0,4) | 2 | Puissance fixe, angle seul ; le carreau creuse 4 px (programmée le 2026-10-24) |
| **Fronde** | Projectile balistique | 25 + recul fort | 0 | Oui | ∞ | Recul important : arme d'éjection |
| **Pot de feu grégeois** | Lancé, rebondit | 45 | 60 px | Non | 3 (rareté, décidé le 2026-10-24) | Mèche réglable ; laisse des flammes 3 tours. **Mèche en tours** (décidé et programmé le 2026-10-24) : 1 = explose à ce tour (après 3 s), 2 = au début du tour suivant, 3 = dans deux tours ; le pot reste posé une fois arrêté (il ne bloque pas la fin du tour), visible avec son compte en chiffres romains, et il est projeté par les explosions ; si le sol se dérobe il retombe. Il part une demi-seconde après le début du tour où son compte tombe à zéro (`fuseTurns`, `src/sim/pots.ts`) |
| **Pot de poix** | Lancé, à fragmentation | 30 + 5×15 | 50 / 30 | Non | 1 | Rebondit comme le feu grégeois ; à la fin de la mèche il explose et projette 5 gouttes en éventail vers le haut, chacune explose là où elle tombe (programmé le 2026-10-24) |
| **Cochon enflammé** | Marcheur | 70 | 90 px | Non | 1 | Avance seul, saute les obstacles, explose sur commande ou au timer de 8 s |
| **Ruche** | Lancé | 5/tick de contact | — | Oui | 1 | Libère un essaim qui poursuit l'unité la plus proche 4 s |
| **Faucon** | Tête chercheuse | 50 | 50 px | Oui | 1 | Cible désignée au toucher/clic, puis vol |

### 4.2 Frappes hors champ
| Arme | Dégâts | Rayon | Munitions | Notes |
|---|---|---|---|---|
| **Volée de trébuchet** | 5 × 30 | 45 px | 1 | 5 pierres, cible au toucher, direction gauche/droite choisie |
| **Pluie de flèches** | 12 × 10 | 0 | 1 | Zone large, faible dégât unitaire |

### 4.3 Mêlée
| Arme | Dégâts | Recul | Notes |
|---|---|---|---|
| **Épée** | 25 | Faible | Frappe frontale |
| **Masse d'armes** | 30 | Fort, angle visé | Équivalent batte de baseball : frappe à 34 px dans la direction visée, recul ×3,2 (programmée le 2026-10-24) |
| **Charge à l'écu** | 20 | Moyen | Course de 120 px, renverse tout sur le trajet |

### 4.4 Utilitaires
| Outil | Effet | Munitions |
|---|---|---|
| **Grappin** | Corde, balancement, relâchement, re-tir en l'air | 5 |
| **Escalade au grappin** (décidé le 2026-10-24) | Lance une corde vers un rebord visé, jusqu'à 320 px plus haut (sortir d'un trou, monter sur un rempart). Le combattant grimpe pendant 2 s, perd 10 PV (écorchures) et **son tour s'arrête** en haut : il ne peut plus tirer, et reste à la merci de l'ennemi jusqu'à son prochain tour. Sert à prendre d'assaut les châteaux des cartes de siège | ∞ |
| **Mur de pierres** | Pose d'un bloc de pierre taillée (3 longueurs, rotation par pas de 22,5°) | 2 |
| **Bannière** | Parachute : chute lente, sensible au vent | 3 |
| **Pioche** | Creuse verticalement vers le bas, 3 s | 2 |
| **Sape** | Creuse un tunnel horizontal ou diagonal, 4 s | 2 |
| **Échelle** | Pose une échelle de 200 px, praticable par toutes les unités | 2 |
| **Chausse-trape** | Mine : invisible pour l'ennemi, s'arme en 2 s, 40 dégâts / 50 px | 2 |
| **Miracle** | Téléportation vers un point libre désigné ; fin de tour | 1 |
| **Passer son tour** | — | ∞ |

### 4.5 Reliquaires (caisses)
- Probabilité d'apparition en fin de tour : 30 %, 3 reliquaires au plus sur la carte. Un ange descend en planant (1 px par instant) et dépose un coffret ; il est sensible au vent pendant la descente, plus une fois posé. Il tombe hors des bouts de carte et des parties brûlées (programmé le 2026-10-24, `src/content/crates.ts`).
- Contenu : 10 % de pièges ; sinon 35 % de fioles de baume (+25 PV, sans dépasser les PV de départ) et 65 % de reliquaires d'armes (+1 munition d'une arme à munitions limitées, tirée au hasard).
- Un tir ou une explosion qui touche un reliquaire le fait éclater (15 dégâts / 40 px ; piège : 35 / 60). Le feu du parchemin les détruit. Si le sol se dérobe, ils retombent.
- Types :
  - **Reliquaire d'armes** : 1 arme aléatoire, pondérée par rareté.
  - **Fiole de baume** : +25 PV.
  - **Coffret piégé** : 10 % de chances, explose au contact ou si on tire dessus.
- Ramassage au contact.

### 4.6 bis Qui est affecté par quoi (décidé le 2026-10-24)

| Élément | Vent | Explosion qui l'atteint | Tir qui le touche | Feu du parchemin | Sol qui se dérobe |
|---|---|---|---|---|---|
| Flèche, carreau, pierre | Oui (carreau ×0,4) | — | S'arrête sur ce qu'elle touche | — | — |
| Pots (feu grégeois, poix) | Non | — | Continue sa course | — | — |
| Gouttes de poix | Non | — | Explosent à l'impact | — | — |
| Combattant | Non | Dégâts dégressifs + projection | Dégâts + recul de l'arme | 20 PV par fin de tour | Tombe (dégâts de chute) |
| Baril de poudre | Non | Saute après 8 instants (chaîne) | Saute | Saute | Tombe |
| Reliquaire | Oui, en descente | Éclate | Éclate (une flèche s'y arrête) | Détruit | Retombe |
| Cuisine de campagne | Non | Soigne le tireur, disparaît | Soigne le tireur (une flèche s'y arrête) | S'éteint | Tombe |
| Terrain | — | Cratère (selon le matériau) | Petit trou (flèche 3 px, carreau 4, pierre 5) | Noirci, reste praticable | — |

### 4.6 Éléments de carte
- **Barils de poudre** (décidé le 2026-10-24, remplacent les barils de poix) : 5 barils posés au hasard (PRNG du sim) au début de la partie, sur un sol plat, à plus de 70 px des combattants et les uns des autres, hors des 10 % de chaque bout de carte. Un tir qui les touche (une flèche s'y arrête), une explosion qui les atteint ou le feu du parchemin les fait sauter : 40 dégâts dans un rayon de 70 px, avec cratère. Un baril qui saute peut en déclencher d'autres, avec un court délai (réaction en chaîne). Si le sol se dérobe, ils tombent. Valeurs dans `src/content/barrels.ts` (`MatchRules.barrels`, absent des vieux logs), réglables dans ⚙ Réglages.
- **Flammes** : 3 PV par tick de contact (plafonné à 10 par tour). Elles s'éteignent dans l'eau.
- **Terrain indestructible** : roche peinte et piliers de cadre.

### 4.7 Décors destructibles (décidé le 2026-10-24)
- **Tout tir abîme le décor.** Les armes sans explosion entament le terrain au point d'impact : un petit cratère de quelques pixels (flèche 3 px, pierre de fronde 5 px, `chipRadius` dans `src/content/weapons.ts`, réglable), réduit par la résistance du matériau comme une explosion. Percer un mur à l'arc prend du temps, mais reste possible : six flèches bien alignées traversent un mur de pierre bâtie de 20 px (test `tests/sim/terrain-wear.test.ts`, replay de référence `wall-arrows`).
- **Les structures ont des points de vie** : tours, murailles, ponts, échafaudages, arbres. Chaque structure d'une carte est déclarée dans `map.json` avec son type ; les PV et la sensibilité par type vivent dans `src/content/structures.ts`.
- Chaque coup qui touche une structure lui retire des PV : les dégâts de l'arme, multipliés selon le matériau (le feu grégeois ronge le bois deux fois plus vite que la pierre, une flèche ne fait qu'un quart de ses dégâts à une muraille). Le cratère creusé s'ajoute, comme pour le terrain.
- **États visibles** : intacte, fissurée (66 % des PV ou moins), en ruine (33 % ou moins). Le rendu ajoute des fissures et fait tomber des éclats.
- **À 0 PV, la structure s'effondre** : ce qu'il en reste se détache en blocs qui tombent, écrasent les combattants dessous (dégâts selon la hauteur de chute, comme une chute de combattant) et se reposent en gravats. Un combattant perché dessus tombe avec.
- La roche peinte et les piliers de cadre restent indestructibles.

### 4.8 Machines de siège (décidé le 2026-10-24)
Les cartes portent des machines de siège fixes, que n'importe quel combattant peut servir. Il se place à côté (≤ 40 px), choisit **Servir la machine** dans l'arsenal, et tire avec elle à la place de son arme pendant ce tour.

| Machine | Tir | Effet | Recharge | PV |
|---|---|---|---|---|
| **Baliste** | Trait très tendu, puissance fixe | 55 dégâts, traverse le premier combattant touché | 2 tours | 120 |
| **Scorpion** | Rafale de 3 carreaux, angle seul | 3 × 20 | 1 tour | 80 |
| **Catapulte** | Pierre en cloche, sensible au vent | 50 / 70 px, gros cratère | 2 tours | 150 |
| **Trébuchet** | Très longue portée, visée lente (angle verrouillé à 45° ± 15°) | 70 / 90 px | 3 tours | 200 |
| **Bélier** | Mêlée contre une structure | 4× dégâts aux structures, rien aux combattants | 1 tour | 150 |

- Une machine est une structure (§4.7) : on peut la viser, l'endommager, la détruire ; détruite, elle s'effondre en gravats.
- La recharge est partagée par toutes les équipes : celui qui la sert la rend indisponible pour les autres.
- Placement par carte (`map.json`, `siegeEngines`), à égale distance des spawns pour rester équitable.

### 4.9 La cuisine de campagne (décidé le 2026-10-24)
- Un **foyer avec un chaudron pendu** apparaît parfois sur la carte. Le toucher d'un tir (n'importe quelle arme) rend **+30 PV** au combattant qui a tiré (sans dépasser ses PV de départ) ; la cuisine disparaît alors. Tirer sur la cuisine plutôt que sur l'ennemi est un choix.
- **Apparition** : tirée au début de chaque tour avec le PRNG du sim. La chance baisse au fil de la partie pour que les parties ne s'éternisent pas : 25 % au premier tour de table, × 0,8 à chaque tour de table, plancher 2 %.
- **Équité** : une équipe ne peut pas voir apparaître une deuxième cuisine « à son tour » tant que les autres équipes encore en vie n'en ont pas eu autant. Une cuisine apparue au tour d'une équipe est placée à distance égale (± 10 %) de ses combattants et des combattants adverses les plus proches, sur un sol stable.
- Une seule cuisine à la fois ; si personne ne la touche, elle s'éteint au bout de 2 tours de table.
- Précisions de programmation (2026-10-24) : la cuisine se place au milieu de la paire (combattant de l'équipe qui joue, ennemi) la plus proche en x, sur le sol plat le plus proche du milieu (dans les ± 10 %), à plus de 40 px de tout combattant ; sinon elle n'apparaît pas ce tour-là. Une flèche ou une pierre qui la touche s'y arrête ; un pot continue sa course ; une explosion dont le rayon l'atteint compte aussi. Si le sol se dérobe, elle tombe. Valeurs dans `src/content/kitchen.ts` (`MatchRules.kitchen`, absent des vieux logs : pas de cuisine), réglables dans ⚙ Réglages. Replay de référence `field-kitchen`.

### 4.10 Les bêtes des marges (décidé le 2026-10-24)
Les lièvres et les escargots des marges du manuscrit entrent dans la bataille. Ils menacent tout le monde, sans camp.

- **Apparition** : 8 % de chances au début de chaque tour (PRNG du sim), une seule bête à la fois, sur un bord de la carte.
- **Déplacement** : entre deux tours, la bête avance vers le combattant le plus proche (lièvre : 300 px par bonds ; escargot : 60 px en rampant, mais il passe partout, murs compris).
- **Contact** : quand elle atteint un combattant, elle applique **un effet tiré au hasard** parmi ceux de son espèce, puis disparaît.

| Bête | Effets possibles (un seul, tiré au hasard) |
|---|---|
| **Lièvre** | Ruade : 15 dégâts et projection forte · Chapardage : vole une munition de l'arme limitée la plus rare de la victime · Panique : la victime fait un bond en arrière incontrôlé au début de son prochain tour |
| **Escargot** | Bave : marche réduite de moitié pendant 2 tours · Coquille : la victime ne peut ni marcher ni sauter à son prochain tour (elle peut tirer) · Morsure lente : 3 dégâts par tour pendant 3 tours |

- Une bête peut être tuée par un tir (10 PV) ; elle ne rapporte rien, sauf la paix.
- Précisions de programmation (2026-10-24) : tout se passe **à la fin de chaque tour** : les effets durables agissent, la bête avance (le lièvre est arrêté par une montée de plus de 40 px, l'escargot passe partout), puis, s'il n'y a pas de bête, 8 % de chances qu'une sorte d'un bord (hors parties brûlées). La proie est le combattant vivant le plus proche en x ; la bête l'atteint à 26 px. N'importe quel tir, coup de masse ou explosion qui la touche la tue. Le feu du parchemin la chasse. « Prochain tour » et « tours » de la bave et de la coquille comptent les tours où la victime joue ; la morsure et la ruade comptent tous les tours. Le chapardage prend une munition de l'arme à munitions limitées la plus rare de la maison. Valeurs dans `src/content/beasts.ts` (`MatchRules.beasts`, absent des vieux logs), réglables dans ⚙ Réglages ; effets durables affichés au-dessus du nom et dans la fiche.

## 5. Vent
- Valeur entière de −10 à +10, tirée par PRNG à chaque tour. Une option permet de le figer à 0.
- Il affecte les projectiles marqués « Vent » (accélération horizontale proportionnelle : 2 sub-px/tick² par point de vent, multipliée par le facteur de vent de l'arme, `src/content/world.ts`), la bannière, les anges des reliquaires et la fumée (visuel).
- Indicateur : une bannière en haut d'écran dont la longueur et le sens suivent la valeur du vent. Un petit ange soufflant en marge apparaît au-delà de ±7.

## 6. Modes de jeu
| Mode | V1 | Description |
|---|---|---|
| Escarmouche vs IA | ✅ | 1 humain vs 1–3 IA |
| Hotseat | ✅ | 2–4 humains, même appareil ; écran « Passez la main à … » entre deux tours si l'option « Brouillard des chausse-trapes » est active |
| Mixte | ✅ | Humains + IA |
| LAN 2 PC | Jalon M9 | 1 humain par machine, cf. TECH_SPEC §8 |
| Défis | P2 | Puzzles à munitions imposées, du type « tuer 3 unités en 1 tour » |
| Replays | ✅ | Revoir la dernière partie, exporter et importer en JSON |

### Schémas de règles (presets)
- **Classique** : valeurs par défaut.
- **Siège** : forts de départ, beaucoup de murs de pierres, trébuchet ×3.
- **Fortune** : tout passe par les reliquaires (aucune munition de départ, hors arc et fronde).
- **Personnalisé** : tous les paramètres sont éditables et sauvegardés localement.

## 7. IA adverse

### 7.1 Principe
L'IA joue via `InputSource` et produit les mêmes commandes qu'un humain. Elle évalue des coups candidats en **simulant le moteur en headless** (clone d'état), dans un Web Worker.

### 7.2 Algorithme (par tour)
1. Énumérer les cibles : unités ennemies visibles, barils proches d'ennemis, reliquaires.
2. Pour chaque (position de tir accessible ≤ N, arme disponible, cible) :
   - résoudre l'angle et la puissance par recherche (balayage grossier puis raffinement), en simulant la trajectoire avec le vent ;
   - simuler l'impact complet sur un clone et scorer : `dégâts ennemis × 1,0 − dégâts alliés × 1,5 − risque d'auto-dégât × 2 + kill bonus 40 + noyade ennemie 60 − exposition finale`.
3. Si aucun coup n'atteint le seuil : se mettre à l'abri (mur, tunnel, retraite), ramasser un reliquaire ou poser une chausse-trape.
4. Exécuter : déplacement par pathfinding sur graphe de marche (recalculé à chaque tour sur le masque), puis visée et tir.

### 7.3 Niveaux
| Niveau | Candidats évalués | Bruit sur angle/puissance | Armes utilisées | Temps de réflexion affiché |
|---|---|---|---|---|
| Écuyer | 30 | ±8° / ±15 % | Arc, fronde, pot | 2–3 s |
| Chevalier | 150 | ±3° / ±6 % | Tout sauf utilitaires avancés | 2–4 s |
| Connétable | 600 | ±1° / ±2 % | Tout, y compris grappin et combos | 3–5 s |

- Budget CPU : ≤ 1,5 s de calcul effectif sur une tablette de milieu de gamme. Le délai affiché est artificiel, pour garder un rythme lisible.
- L'IA ne triche pas : elle ne voit pas les chausse-trapes ennemies, sauf si elle a un Sapeur.

## 8. Contrôles

### 8.1 PC
| Action | Clavier / souris |
|---|---|
| Marcher | ← → ou A/D |
| Saut long / saut haut | Entrée / Entrée ×2 (pad : **↶ ◀ ↑ ▶ ↷**, sauts longs vers la gauche et la droite aux deux bouts) |
| Changer de combattant | Clic sur un combattant de sa maison ou sur son nom, ou bouton **⇄ Combattant**, tant qu'on n'a ni bougé ni tiré |
| Plein écran | Bouton **⤢** en haut à droite (comme F11) |
| Viser (angle) | ↑ ↓, ou glisser la pointe de la flèche de visée (n'importe quel côté, l'unité se retourne) |
| Se retourner sur place | T (garde l'élévation de la visée) |
| Tirer (jauge de puissance) | Espace maintenu puis relâché |
| Drag-to-aim | Clic gauche maintenu sur l'unité, tirer en arrière d'au moins 48 px écran (sinon rien n'est visé ni tiré : un clic ne tire jamais), relâcher |
| Arsenal | Clic droit ou Tab |
| Mèche (pot) | Touches 1–5 |
| Caméra | Bords d'écran, glisser clic molette, molette = zoom |
| Recentrer | C ou bouton **◎** (retour à la vue par défaut ; affiché seulement quand on a zoomé ou déplacé la vue), double clic |
| Vue par défaut (décidé le 2026-10-24) | La caméra cadre **tous les combattants vivants**, quelle que soit la taille de l'écran, en laissant libres le HUD et la barre d'action ; pendant un tir, elle garde aussi le projectile dans le cadre. Elle reprend la main à chaque tour et à chaque tir |
| Pause / menu | Échap : menu Reprendre, Recommencer, Aide, Réglages. Le temps s'arrête aussi pendant l'aide et les réglages, pas pendant l'arsenal |

### 8.2 Tablette
- **Pad virtuel** en bas à gauche (← → saut, saut arrière, **⟳ Viser** maintenu : la visée fait le tour complet et l'unité se retourne quand elle passe derrière elle), boutons **Arsenal**, **Passer** et **Tir** en bas à droite, **Aide**, **Réglages** et **Pause** en haut à droite.
- **Pointe de visée** : glisser la pointe rouge de la flèche de visée oriente le tir, sans tirer.
- **Drag-to-aim** : glisser depuis l'unité active. Une ligne pointillée enluminée prolonge la trajectoire, avec une longueur limitée (passif Archer ×2).
- **Mode jauge** : roue d'angle autour de l'unité et bouton Tir maintenu pour la puissance.
- Caméra : glisser à 1 doigt hors de l'unité, pincer pour zoomer, double-tap pour recentrer.
- Cibles des frappes hors champ : tap sur la carte, puis bouton Confirmer.
- Toutes les zones tactiles font au moins 48 × 48 px CSS.

## 9. UI / HUD
- **Unité active** : auréole dorée et flèche qui oscille au-dessus de son nom ; son cartouche passe à l'or. La visée est une ligne de points vermillon et or terminée par une pointe de flèche.
- **Commentaire** : un phylactère sous la bannière de vent affiche la dernière réplique ; une annonce centrale ouvre chaque tour (numéro, maison, combattant, réplique) ; elle reste environ 4 s et un clic n'importe où la ferme.
- **Haut** : bannière de vent au centre, sablier du timer à droite (un vrai sablier qui s'écoule), tour courant et compte à rebours du Déluge à gauche.
- **Bas** : barres de vie par équipe sous forme de phylactères avec blason ; fiche de l'unité active (nom, classe, PV).
- **Au-dessus des unités** : nom et PV dans un petit cartouche aux couleurs de la maison.
- **Actions indisponibles grisées** (décidé le 2026-10-24) : marcher après un saut, sauter après avoir marché, tirer ou changer d'arme après le tir… le bouton est grisé. Les boutons d'action forment une seule barre centrée en bas de l'écran.
- **Taille de l'interface** (décidé le 2026-10-24) : panneaux, boutons et textes sont dessinés pour un écran 1920 × 1080 et rapetissent automatiquement sur une fenêtre plus petite (jusqu'à 60 %), pour laisser voir le champ de bataille ; sur écran tactile, les boutons gardent 48 px au minimum.
- **Arsenal** : grille d'icônes dans un cadre architecturé (arcades), avec les munitions en chiffres romains ou arabes (option).
- **Bulle d'objet** (décidé le 2026-10-24) : un clic (ou un appui) sur un baril, un reliquaire, la cuisine de campagne, une bête des marges ou un pot posé ouvre une bulle au-dessus de lui : son nom et ce qu'il fait, avec les valeurs de la partie. Elle le suit, se ferme d'un clic ou quand l'objet disparaît. Un reliquaire piégé n'est jamais signalé. Chaque arme de l'arsenal a aussi une phrase qui dit à quoi elle sert.
- **Dégâts** : chiffres en écriture gothique qui s'élèvent et s'estompent.
- **Aide** (décidé le 2026-10-24) : le bouton Aide ouvre un **tutoriel illustré** en quelques pages courtes (le but, un tour de jeu, viser et tirer, les armes, le vent, la caméra, les raccourcis), avec un schéma par page ; on y navigue par Précédent / Suivant.
- **Écrans** : titre (page enluminée avec lettrine animée), nouvelle partie, équipes et blasons, options, crédits, fin de partie (scène de triomphe peinte et tableau des exploits).

## 10. Cartes (V1 : 6, P1 : +4)
Chaque carte a un thème, une palette, un niveau d'eau initial et des éléments spécifiques.

**Vie du ciel** (décidé le 2026-10-24, purement décoratif) : de temps en temps, une volée d'oiseaux traverse le ciel ou s'envole d'un arbre ; plus rarement, un dragon des marges passe en battant des ailes, ou un arc-en-ciel apparaît derrière les collines puis s'efface.

**Grandes batailles de l'histoire** (décidé le 2026-10-24) : en plus des épisodes du manuscrit, les cartes évoquent de grandes batailles médiévales, avec une touche historique (lieu, date, armées en présence, une phrase de contexte dans l'écran de choix) et des décors fun. La liste ci-dessous sera revue en conséquence au lot de contenu (M7).

| Bataille | Date | Décor et particularités |
|---|---|---|
| **Hastings** | 1066 | Colline de Senlac, mur de boucliers saxon en haut, marécage en bas ; tapisserie en guise de fond |
| **Bouvines** | 1214 | Plaine et pont sur la Marque, destructible |
| **Azincourt** | 1415 | Champ boueux entre deux bois, pieux d'archers anglais, boue qui ralentit la marche |
| **Orléans** | 1429 | Siège : bastides, pont fortifié des Tourelles, la Loire |
| **Constantinople** | 1453 | Murailles théodosiennes en trois rangs, énorme bombarde (machine de siège unique) |
| **Pavie** | 1525 | Parc clos de murs, brèches à ouvrir, bosquets |

| # | Nom | Inspiration | Particularités |
|---|---|---|---|
| 1 | **Les Murailles de Jéricho** | Siège de Jéricho | Remparts destructibles, tours indestructibles |
| 2 | **La Vallée d'Ela** | David et Goliath | Deux collines face à face, ravin central inondé |
| 3 | **Le Camp sous les Tentes** | Scènes de camp militaire | Tentes et chariots, nombreux barils de poix |
| 4 | **L'Arche** | Arche de Noé | Grande coque centrale, eau haute dès le départ |
| 5 | **La Tour** | Tour de Babel | Carte verticale, échafaudages |
| 6 | **Le Verger** | Arbres stylisés du manuscrit | Arbres « sucettes », terrain meuble |
| P1 | Le Désert d'Aï, La Mer Rouge (eau qui monte et descend), Le Palais, Les Grottes |

Règles de level design :
- Largeur de 3 à 5 écrans, hauteur de 1,5 à 2 écrans à zoom 1.
- Au moins 8 zones de spawn valides par équipe, répartition équitable vérifiée par script.
- Les éléments indestructibles ne dépassent pas 15 % du terrain.
- Chaque carte est testée avec 3 parties IA contre IA automatiques. Critère : aucune unité coincée et aucune partie interminable (plus de 40 tours).

## 11. Audio
- **Musique** : instrumentation d'époque (vièle, flûte, chalemie, tambour, psaltérion).
- **Style musical** (décidé le 2026-10-24) : l'esprit rythmique de [*Patapon*](https://fr.wikipedia.org/wiki/Patapon), **remixé en médiéval**. Percussions au premier plan (tambours, tabor, nacaires) sur des boucles courtes et entraînantes ; motifs mélodiques simples et répétés à la chalemie, à la flûte et à la vièle ; chœurs scandés en onomatopées ou en latin de cuisine, comme une troupe en marche. Ton joyeux et burlesque, accordé à celui du jeu. On s'inspire de l'énergie et de la structure, sans reprendre aucune mélodie ni aucun motif existant. Les compositions médiévales sont dans le domaine public, mais **les enregistrements existants ne le sont pas** : il faut un enregistrement propre, une génération ou une banque sous licence vérifiée.
- **Ambiance** par carte : vent, oiseaux, camp, eau.
- **SFX** : la liste est dans `ASSETS.md` §6.
- **Voix** : courtes interjections en ancien français ou en latin de cuisine (« Hélas ! », « Par ma foi ! », « Mea culpa ! »), avec 3 timbres. P1.

## 12. Progression et persistance
- Pas de progression obligatoire en V1.
- **Sauvegarde automatique de la partie en cours** (décidé le 2026-10-24) : en solo contre l'IA comme en hotseat, le log de la partie (configuration, graine, commandes) est enregistré en local à chaque commande. Après un rafraîchissement, un plantage ou un redémarrage, le jeu propose **Reprendre la partie** : il rejoue le log jusqu'au dernier tick, ce qui redonne exactement le même état (déterminisme). Une partie terminée efface sa sauvegarde.
- Persistance locale : équipes (noms, blasons, compositions), schémas, options, statistiques simples (parties, victoires, plus gros dégât en un tir), dernier replay.
- P2 : déblocage cosmétique (meubles héraldiques, chapeaux) par exploits.

## 13. Accessibilité et options
- Choix du mode de visée (drag / jauge).
- Vitesse de résolution ×1 / ×2.
- Option « réduire les secousses de caméra ».
- Palettes de maisons distinguables pour les daltoniens (motif héraldique et pas seulement la couleur).
- Taille du texte du HUD.
- Volume par canal.
- Langues : français, puis anglais en P1 (clés i18n dès V1).

## 14. Hors périmètre V1
Jeu en ligne, éditeur de cartes in-game, campagne scénarisée, plus de 4 équipes, cosmétiques à débloquer, voix.
