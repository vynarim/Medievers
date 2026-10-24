# Medieverse — Game Design Document

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
1. Configuration : 2 à 4 équipes (V1 : 2 équipes garanties, 3–4 en P1), 1 à 6 unités par équipe (**6 par défaut, une de chaque classe**, décidé le 2026-10-24, réglable : « Combattants par maison », décidé le 2026-10-24 ; placement réparti sur la part de carte de chaque maison, sur un sol large), carte, schéma de règles.
2. Placement (décidé le 2026-10-24) : **chaque maison pose un combattant à tour de rôle**, en cliquant sur la carte (un trait à ses couleurs montre où il tombera), jusqu'à ce que toutes les armées soient en place ; puis le tour 1 commence. Pas à moins de 36 px d'un autre combattant ni du bord, et il faut un sol où tenir. 20 s par combattant ; le temps écoulé, il est posé sur sa colonne par défaut (`turn.placementTicks`, absent des vieux logs : placement automatique).
3. Tours alternés jusqu'à ce qu'il reste une seule équipe vivante, ou fin du Déluge.

### 2.2 Tour
| Phase | Durée par défaut | Description |
|---|---|---|
| Transition | 2 s | Caméra vers l'unité active, affichage du vent |
| Action | **45 s** pour tout le tour par défaut, au choix 30, 45, 60 ou 90 s sur l'écran de préparation (décidé le 2026-10-25) | Déplacement libre, choix d'une arme, visée, tir |
| Après le tir | **tout le temps d'action restant** (au moins 3 s) | Décidé le 2026-10-24, remplace le repli de 5 s au plus (étude E2) : le déplacement pas encore utilisé reste utilisable après le tir, le temps aussi ; `turn.retreatMaxTicks` vaut la durée du tour ( **le tir ne fait pas baisser le sablier**, qui continue de s'écouler, décidé le 2026-10-25) et reste réglable. Le tir ne termine pas le tour (décidé le 2026-10-24) : on peut se déplacer puis tirer, ou tirer puis se déplacer, avec les déplacements pas encore utilisés (marche ou saut, plus tard escalade). **Fin du tour** termine le tour ; il se termine aussi tout seul quand il ne reste aucun déplacement et que le tir est retombé |
| Résolution | variable + 2 s | Attente fin des projectiles, explosions et chutes ; les morts sont alors constatées, puis une pause de 2 s (réglable) laisse voir l'impact et le commentaire avant le tour suivant |
| Fin de tour | — | Passifs de fin de tour, apparition éventuelle d'un reliquaire |

- **Choix du combattant** (décidé le 2026-10-24) : à chaque tour, la maison qui joue **choisit** lequel de ses combattants agit, avant qu'il ne bouge ou ne tire (clic sur le combattant ou sur son nom, ou bouton **⇄ Combattant** qui passe au suivant ; viser ne compte pas comme agir). **Pas deux tours de suite** (décidé le 2026-10-24, remplace « elle peut rejouer le même ») : le combattant qui a joué le tour précédent de sa maison souffle ce tour-ci ; on choisit parmi les autres. Seul survivant, il joue à chaque tour (`turn.noRepeat`). Cliquer sur un combattant qui ne peut pas prendre la main (il souffle, ou la maison a déjà agi) ouvre une toute petite bulle au-dessus de lui qui le dit (2026-10-25). Par défaut, le jeu propose le suivant dans l'ordre de l'équipe. Les règles « rotation imposée » restent disponibles pour les vieux logs (`turn.freeSelect`).
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
- Précisions de programmation (2026-10-25) : valeurs dans `src/content/deluge.ts` (`MatchRules.deluge`, absent des vieux logs : pas de Déluge), réglables dans ⚙ Réglages ; les 5 PV par tour sont réglables, 0 les supprime. Le Déluge commence à la fin du tour N (ou du premier tour fini après 15 minutes de jeu) et l'eau monte dès cette fin de tour, depuis le bas de la carte (ou depuis le niveau d'eau de la carte, `waterLevel`). Un combattant dont les pieds passent sous la surface, à tout instant, **perd 20 PV et est rejeté sur la terre sèche la plus proche** (décidé le 2026-10-25, `deluge.wetDamage`, absent des vieux logs : il se noyait aussitôt) ; il ne se noie que si ses PV tombent à 0 ou s'il n'y a plus de terre hors de l'eau ; on ne peut pas poser un combattant sous l'eau au placement. Tirs, reliquaires, barils, pots posés, cuisine et bête qui passent sous l'eau disparaissent. Rendu : bandes d'outremer et crêtes de vagues enroulées ; annonce « Et les eaux montèrent… ». Replay de référence `deluge`.

### 2.5 Le parchemin brûle (décidé le 2026-10-24)
- Après **2 tours de table**, la carte prend feu **à ses deux extrémités**, comme une page de parchemin approchée d'une chandelle. À la fin de chaque tour de table, le feu avance de **60 px** de chaque côté (décidé le 2026-10-24, réduit de 120) (jusqu'au milieu de la carte au plus).
- Un combattant qui se trouve dans la partie brûlée à la fin d'un tour (n'importe quel tour) perd **20 PV**. Le feu pousse donc les armées à se rapprocher, et sert de fin forcée à côté du Déluge.
- **Quand les deux feux se rejoignent** au milieu (décidé et programmé le 2026-10-25), la partie s'arrête : la maison à qui il reste le plus de PV (total de ses combattants vivants) gagne ; à égalité, personne (`burn.endWhenMet`, absent des vieux logs : la partie continue).
- Une cuisine de campagne rattrapée par le feu s'éteint.
- Rendu : page noircie, bord brun qui ondule comme un papier qui se recroqueville, ligne de flammes. Valeurs dans `src/content/burn.ts` (`MatchRules.burn`, absent des vieux logs : pas de feu), réglables dans ⚙ Réglages (onglet Parchemin en feu).

## 3. Unités

### 3.1 Règles communes
- PV : 100 (option 50 / 150 / 200).
- Déplacement : marche (vitesse 1,5 px/tick), franchit une marche ≤ 12 px, pente max ~60°.
- **Déplacement par tour** (décidé le 2026-10-24) : **soit on marche, soit on saute**, pas les deux. La marche est limitée à environ 10 largeurs de combattant (**280 px**, action et repli confondus) ; un seul saut avant porte à environ 15 largeurs (≈ 420 px sur sol plat, portée fixe). Dès qu'on a marché, on ne peut plus sauter ; après un saut, on ne peut plus marcher. Valeur réglable (`unit.moveBudget`). Plus de barre de souffle (retirée le 2026-10-25) : les boutons de marche se grisent quand la marche est épuisée.
- **Demi-tour gratuit** (décidé le 2026-10-24, étude E2) : marcher vers l'autre côté retourne d'abord le combattant sur place pendant 0,2 s, sans avancer. Un appui bref pour regarder derrière soi ne coûte donc ni marche ni saut (`unit.turnTicks`).
- **Face à la carte** (décidé le 2026-10-25) : un combattant qui commence son tour (ou qui reçoit la main) dans le quart gauche ou droit de la carte est tourné vers l'intérieur ; ailleurs il garde son sens (`turn.faceInwardPct`, 25 %).
- **Saut long** (Entrée : devant soi ; boutons ↶ et ↷ : vers la gauche ou vers la droite, le combattant se retourne au besoin) : bond loin. **Saut haut** (double appui, bouton ↑, placé entre ◀ et ▶) : bond très haut en reculant un peu, pour sortir d'un trou ou monter sur un rebord. Un saut décolle aussi depuis une pente montante. Valeurs de départ, à régler en playtest : avant (+8,2 ; −9) px/tick, soit environ 420 px sur sol plat et 115 px de hauteur, arrière (−1 ; −10,5) px/tick, plus haut (environ 150 px) et court (`src/content/units.ts`).
- Dégâts de chute : au-delà de 160 px de hauteur de chute, 1 PV par 8 px supplémentaires, plafonné à 30. **Toute chute d'au moins 40 px** (d'un mur, d'une falaise, d'une pente trop raide) coûte **au moins 5 PV** (décidé le 2026-10-25, `unit.fallMinHeight`, `unit.fallMinDamage`).
- **Pentes raides** (décidé le 2026-10-25, `unit.steepFall`) : on ne descend en marchant qu'une pente qu'on pourrait monter (pas plus de 12 px de dénivelé sur 7 px, environ 60°) ; plus raide, le combattant tombe. Une simple marche de 12 px se descend toujours.
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
- Précisions de programmation (2026-10-25) : valeurs dans `src/content/classes.ts` (`MatchRules.classes`, absent des vieux logs : pas de classes), réglables dans ⚙ Réglages ; la composition de chaque maison est dans sa `TeamConfig` (`classes`). *Haubert* s'applique aux explosions seulement (pas aux flèches, chutes ni au feu). *Lourd* : les vitesses de saut du chevalier sont à 84 %, soit des sauts environ 30 % plus courts et moins hauts. *Œil exercé* : la trajectoire prévue s'affiche quand on charge le tir (ou toujours pour l'arbalète, à puissance fixe), sur 22 instants de vol, 44 pour l'archer à l'arc et à l'arbalète. *Bras souple* : armes marquées « lancées » (fronde, feu grégeois, poix), vitesse de départ +15 %. *Maître d'œuvre* : la pioche et la sape avancent deux fois plus vite pendant la même durée (deux fois plus profond ou plus loin) ; les chausse-trapes ennemies sont visibles pendant le tour d'un sapeur. *Bénédiction* : appliquée en fin de tour du clerc, avant le feu du parchemin, sans dépasser les PV de départ de chacun. *Majesté* : se mesure au moment du tir, entre le tireur et son roi vivant (pas pour le roi lui-même) ; un pot posé garde le bonus de son lancer. Composition par défaut tant que l'écran de préparation ne la change pas : Chevalier, Archer, Frondeur, Clerc, Sapeur, Roi (Roi en premier en Régicide).

### 3.3 Factions (maisons héraldiques fictives)
- Une équipe = un nom de maison, un blason (champ + meuble + émaux), une couleur primaire et une couleur secondaire.
- Blasons prédéfinis : 8 maisons (ex. *Maison du Lion d'Or*, *Maison des Trois Tours*, *Maison de la Clef*, *Maison du Croissant d'Argent*, *Maison de l'Aigle*, *Maison de l'Ancre*, *Maison du Sanglier*, *Maison de l'Étoile*).
- **Noms tirés à chaque partie** (décidé le 2026-10-25) : en partie, chaque maison porte un nom burlesque tiré de la graine de la partie (le même chez les deux joueurs en ligne et dans les replays) : une bête (Hareng, Limace, Lapin Tueur, Hirondelle Chargée…) avec une attitude héraldique accordée (Rampant, Couchant, Enrhumée…), un émail (d'Azur, de Gueules…), « des Trois … », ou deux bêtes. Listes dans `fr.json` (`house.*`), tirage dans `src/ui/house-names.ts`. La couleur de la maison ne change pas ; l'écran de préparation garde les noms héraldiques.
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
| **Masse d'armes** | 30 | Fort, angle visé | Équivalent batte de baseball : frappe à 34 px dans la direction visée, recul ×3,2 (programmée le 2026-10-24). **Se charge comme un tir** (décidé le 2026-10-24) : la jauge règle la distance de projection, de 20 % du recul à vide à 100 % jauge pleine (`knockbackMinPct`) ; les dégâts ne changent pas. **Pas de coup dans le vide** (décidé le 2026-10-25, `needsTarget`) : sans rien à frapper à portée dans la direction visée (combattant, baril, reliquaire, cuisine, bête, licorne, construction ; le sol nu ne compte pas), le bouton Frapper est grisé et le coup est refusé, sans consommer l'action |
| **Charge à l'écu** | 20 | Moyen | Course de 120 px, renverse tout sur le trajet |

### 4.4 Utilitaires
| Outil | Effet | Munitions |
|---|---|---|
| **Grappin** | Corde, balancement, relâchement, re-tir en l'air | 5 |
| **Escalade au grappin** (décidé le 2026-10-24) | Lance une corde vers un rebord visé, jusqu'à 320 px plus haut (sortir d'un trou, monter sur un rempart). Le combattant grimpe pendant 2 s, perd 10 PV (écorchures) et **son tour s'arrête** en haut : il ne peut plus tirer, et reste à la merci de l'ennemi jusqu'à son prochain tour. Sert à prendre d'assaut les châteaux des cartes de siège | ∞ |
| **Mur de pierres** | Pose d'un bloc de pierre taillée (3 longueurs, rotation par pas de 22,5°) | 2 |
| **Bannière** | Parachute : chute lente, sensible au vent | 3 |
| **Pioche** | Creuse verticalement vers le bas, 3 s (programmée le 2026-10-25) | 2 |
| **Sape** | Creuse un tunnel horizontal ou diagonal, 4 s (programmée le 2026-10-25) | 2 |
| **Échelle** | Pose une échelle de 200 px, praticable par toutes les unités | 2 |
| **Chausse-trape** | Mine : invisible pour l'ennemi, s'arme en 2 s, 40 dégâts / 50 px | 2 |
| **Miracle** | Téléportation vers un point libre désigné ; fin de tour | 1 |
| **Passer son tour** | — | ∞ |

- Précisions de programmation des outils (2026-10-25, `src/content/weapons.ts`, `src/sim/tools.ts`, réglables dans ⚙ Réglages) :
  - **Pioche** et **Sape** : « Creuser » lance l'outil ; la tête de coupe avance de 0,5 px (pioche) ou 0,75 px (sape) par instant dans la terre, × 100 / résistance du matériau (pierre bâtie 150 %), et s'arrête sur la roche ; elle taille un disque de 17 px de rayon (pioche) ou une colonne de disques haute comme un combattant (sape). La sape va à plat, ou à 45° vers le haut ou le bas si la visée dépasse 22,5°, du côté visé ; le combattant marche derrière la tête sans user son souffle. Pendant le creusement le chronomètre du tour s'arrête et les commandes de déplacement sont ignorées ; il s'achève au bout du temps, ou si le combattant est touché.
  - **Chausse-trape** : posée 10 px devant le flanc du combattant (à ses pieds contre un mur), elle tombe si le sol se dérobe, s'arme en 2 s, puis saute sous tout combattant qui la touche (8 px), ami compris ; une explosion qui l'atteint la fait sauter 8 instants plus tard. Son explosion se compte à hauteur de la taille d'un combattant debout, pour que celui qui marche dessus la prenne en plein. Visibilité : la maison qui joue voit ses pièges ; pendant le tour d'un sapeur, elle voit tous les pièges ; tout est révélé en fin de partie et dans la visionneuse de replays. En ligne, chaque joueur voit ainsi les pièges de ses maisons ; dans une partie d'essai sur un seul appareil, tous les pièges sont visibles. (L'écran « Passez la main » du brouillard en hotseat reste à faire.)
  - **Mur de pierres** et **Volée de trébuchet** : armes visées sur un point. Un clic sur la carte les envoie (commande `fireAt`) ; la jauge ou un glisser aussi, le point étant alors pris le long de la visée à la distance que donne la puissance (mur : 320 px à pleine puissance ; volée : 1 600 px devant soi). Le mur prend la visée arrondie au pas de 22,5° et sa longueur aux boutons 1 à 3 (48, 80, 120 px ; 14 px d'épaisseur) ; il est refusé (rien n'est dépensé) trop loin, sur un combattant ou entièrement dans le sol. **La pierre est lourde** (décidé le 2026-10-25, `wall.fall`, absent des vieux logs) : le mur tombe tout droit depuis le point visé jusqu'à reposer sur le sol, et c'est là qu'il est refusé s'il écrase un combattant ; l'aperçu le montre à sa place d'arrivée. Le mur posé est de la pierre bâtie du terrain, sans points de vie de structure. La volée lâche 5 pierres 300 px au-dessus de la carte, 28 px d'écart, lancées du côté opposé à la visée (de l'autre si elles partiraient hors de la carte) de façon à retomber sur le point ; chacune explose où elle tombe (30 / 45 px), insensible au vent par défaut.
  - Les armes sans puissance (pioche, sape, chausse-trape) partent dès l'appui sur le bouton ; la masse se charge comme un tir, qui dit ce qu'il fait : Frapper, Creuser, Poser, Bâtir, Appeler.
  - **Chaque combattant garde son arme** (décidé le 2026-10-24, `turn.rememberWeapon`, absent des vieux logs) : il reprend à son tour suivant l'arme qu'il a choisie en dernier, tant qu'il lui en reste et qu'il a le droit de s'en servir ; sinon, l'arc. Passer la main à un autre combattant de la maison lui rend sa propre arme. Le bouton Arsenal montre l'enluminure de l'arme en main.
- **Grimper aux échelles** (programmé le 2026-10-25, sur retour de playtest) : les échelles des cartes (matière « échelle » du masque) se grimpent dès maintenant, avant l'outil Échelle. Au pied d'une échelle (ou au sommet), **↑** maintenu monte et **↓** descend, au clavier comme à l'écran (le bouton ↓ n'apparaît qu'à une échelle ; à l'échelle, ↑ ↓ du clavier grimpent au lieu de viser). Le combattant s'y tient sans tomber ; en haut, il se hisse sur le sol à côté ; en bas, il pose pied à terre ; marcher de côté le fait lâcher. Grimper dépense la marche du tour à moitié prix (1 px de marche pour 2 px d'échelle, `unit.climbCostPct`) et, comme la marche, interdit le saut ensuite. Vitesse 1 px par instant (`unit.climbSpeed`, absent des vieux logs : pas d'escalade). Une échelle détruite fait lâcher prise. **L'échelle termine le tour** (décidé par l'utilisateur le 2026-10-24, `unit.ladderEndsTurn`, absent des vieux logs) : un appui sur ↑ ou ↓ fait monter (ou descendre) toute l'échelle d'un trait, sans dépenser la marche, et le tour se termine au bout ; pendant la montée, les autres ordres sont ignorés ; un appui qui ne peut pas faire grimper d'un pixel (pas d'échelle à portée, déjà au bout) ne coûte rien. **Prendre l'échelle est l'action du tour, pas un déplacement** (décidé le 2026-10-25, `unit.ladderIsAction`, absent des vieux logs) : comme un tir, elle se prend avant le tir, jamais après ; et il faut un **nouvel appui** sur ↑ ou ↓ à l'échelle : une touche déjà tenue (pour viser) en arrivant à l'échelle ne la fait pas prendre. Sans cette règle (vieux logs), le comportement ci-dessus : ↑ ↓ maintenus, à demi-tarif de marche. **Tolérance** (décidé le 2026-10-25, sur retour de playtest) : l'échelle se prend jusqu'à une largeur de combattant au-delà du corps (`unit.ladderReach`, 28 px, réglable) ; le combattant se place alors contre elle. Pour monter, il faut de l'échelle au-dessus des pieds, pour descendre juste en dessous : hissé en haut, il y reste même si ↑ reste appuyé (il ne repart plus en boucle, ce qui vidait sa marche). Sur le haut d'une tour, la marche **s'arrête au bord** au-dessus d'une échelle au lieu de faire tomber (chute de plus de 40 px), et ↓ apparaît pour redescendre.

### 4.5 Reliquaires (caisses)
- Probabilité d'apparition en fin de tour : 30 %, 3 reliquaires au plus sur la carte. Un ange descend en planant (1 px par instant) et dépose un coffret ; il est sensible au vent pendant la descente, plus une fois posé. Il tombe hors des bouts de carte et des parties brûlées (programmé le 2026-10-24, `src/content/crates.ts`).
- Contenu : 10 % de pièges ; sinon 35 % de fioles de baume (+25 PV, sans dépasser les PV de départ) et 65 % de reliquaires d'armes (+1 munition d'une arme à munitions limitées, tirée au hasard).
- Un tir ou une explosion qui touche un reliquaire le fait éclater (15 dégâts / 40 px ; piège : 20 / 40, réduit le 2026-10-25 pour rester une mauvaise surprise et non un désastre). Le feu du parchemin les détruit. Si le sol se dérobe, ils retombent.
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
- **Flammes** : 3 PV par tick de contact (plafonné à 10 par tour). Elles s'éteignent dans l'eau. Programmées le 2026-10-25 (`src/content/flames.ts`, `MatchRules.flames`, absent des vieux logs ; armes marquées `flames` : le feu grégeois) : une explosion de feu grégeois pose 6 flammes réparties sur 80 % de son rayon, sur le sol sous elle ; elles durent 3 tours (fins de tour), brûlent tout combattant qui les touche (le plafond se remet à zéro à chaque début de tour), font sauter les barils, tombent si le sol se dérobe, s'éteignent sous l'eau. Réglables dans ⚙ Réglages. Replay de référence `greek-flames`.
- **Terrain indestructible** : roche peinte et piliers de cadre.

### 4.7 Décors destructibles (décidé le 2026-10-24)
- **Tout tir abîme le décor.** Les armes sans explosion entament le terrain au point d'impact : un petit cratère de quelques pixels (flèche 3 px, pierre de fronde 5 px, `chipRadius` dans `src/content/weapons.ts`, réglable), réduit par la résistance du matériau comme une explosion. Percer un mur à l'arc prend du temps, mais reste possible : six flèches bien alignées traversent un mur de pierre bâtie de 20 px (test `tests/sim/terrain-wear.test.ts`, replay de référence `wall-arrows`).
- **Les structures ont des points de vie** : tours, murailles, ponts, échafaudages, arbres. Chaque structure d'une carte est déclarée dans `map.json` avec son type ; les PV et la sensibilité par type vivent dans `src/content/structures.ts`.
- Chaque coup qui touche une structure lui retire des PV : les dégâts de l'arme, multipliés selon le matériau (le feu grégeois ronge le bois deux fois plus vite que la pierre, une flèche ne fait qu'un quart de ses dégâts à une muraille). Le cratère creusé s'ajoute, comme pour le terrain.
- **États visibles** : intacte, fissurée (66 % des PV ou moins), en ruine (33 % ou moins). Le rendu ajoute des fissures et fait tomber des éclats.
- **À 0 PV, la structure s'effondre** : ce qu'il en reste se détache en blocs qui tombent, écrasent les combattants dessous (dégâts selon la hauteur de chute, comme une chute de combattant) et se reposent en gravats. Un combattant perché dessus tombe avec.
- La roche peinte et les piliers de cadre restent indestructibles.
- Précisions de programmation (2026-10-25) : valeurs dans `src/content/structures.ts` (`MatchRules.structures`, absent des vieux logs), structures déclarées par la carte (`MapDef.structures` puis `MatchConfig.structures`, rectangle `[x, y, w, h]` : la pierre bâtie, le bois et les échelles du masque dans ce rectangle). PV de départ : tour 240, muraille 160, pont 90, échafaudage 60. Pourcentage des dégâts de l'arme : pierre — arc et arbalète 25 %, fronde 40 %, masse 50 %, poix 80 %, feu grégeois 100 % ; bois — arc 50 %, arbalète 60 %, fronde 50 %, masse 100 %, feu grégeois et poix 200 % ; autre explosion (baril, reliquaire) 100 %. Une explosion compte une fois par structure que son rayon atteint, avec ses dégâts au centre ; un tir direct compte pour la structure qu'il frappe. À l'effondrement, la structure se découpe en blocs de 32 px qui **basculent du côté opposé au coup** (plus vite en haut qu'en bas), tombent, et ne laissent en gravats (terre) que 40 % de leur hauteur, le reste partant en poussière. Un bloc qui traverse un combattant le blesse (1 PV par 4 px de chute, entre 10 et 40) et le projette ; chaque combattant n'est frappé qu'une fois par effondrement. La résolution attend que tous les blocs soient posés. Un clic sur une structure montre ses PV. Réglages : onglet Constructions. **Tours de la vallée grise** (décidé le 2026-10-25, sur retour de playtest) : le corps d'une tour est un décor **devant lequel on passe** (combattants et tirs) ; seul le chemin de ronde, en haut, arrête et porte ; on y monte par l'échelle. Leur **hauteur est un réglage** (`structures.towerHeight`, 320 px), les tours étant construites par la partie au lieu d'être peintes dans le masque. **Tours de bois** (décidé le 2026-10-25) : dans la vallée et sur la côte, environ une tour sur deux est un **donjon de bois sur sa motte**, comme les mottes castrales : une butte de terre de 70 px aux pentes douces, une tour de 220 px (`structures.woodTowerHeight`), un corps de charpente devant lequel on passe (matière « charpente de fond »), un chemin de ronde en bois. 140 PV, et les dégâts du bois (le feu la ronge deux fois plus vite, `structures.defs.woodTower`). **Fondations sapées** (décidé le 2026-10-25) : une tour ou une muraille dont **moins de la moitié des colonnes** reposent encore sur le sol (cratère, pioche, sape) s'effondre aussitôt, quels que soient ses PV, et **bascule vers le vide** (du côté opposé aux colonnes qui la portaient encore). Mêmes blocs, mêmes dégâts d'écrasement ; ceux qui étaient dessus tombent avec elle (dégâts de chute). Une colonne porte quand le pixel sous son pixel le plus bas est plein ; une colonne entièrement creusée ne porte pas. Seuil `structures.supportPct` (50 %, absent des vieux logs : pas d'effondrement par sape). Test `tests/sim/structures.test.ts`, replay de référence `tower-collapse`.

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

### 4.11 Le dragon des marges (décidé le 2026-10-24)
Le dragon de la « vie du ciel » n'est plus un décor : il est dans la simulation.

- **Passage** : 12 % de chances au début de l'action de chaque tour (PRNG du sim), un seul à la fois. Il traverse la carte d'un bord à l'autre, à 120 px/s, **le plus bas possible** : il épouse le relief, son ventre à 100 px au-dessus du point le plus haut du sol ou de la maçonnerie sous son corps, juste au-dessus de la tête des combattants (80 px), donc à portée de flèche (décidé le 2026-10-25 : il volait d'abord au-dessus du point le plus haut de toute la carte, hors d'atteinte). Il monte et descend à sa vitesse de vol, et **change un peu d'altitude en volant** : il s'élève jusqu'à 240 px au-dessus de cette hauteur puis redescend raser les troupes, une ondulation toutes les 7 s (renforcé le 2026-10-25 : il était trop facile à toucher) (`dragon.swing`, `dragon.swingTicks`, décidé le 2026-10-25, absents des vieux logs : vol à plat).
- **Colère** : un tir qui le touche (quels que soient ses dégâts ; la flèche s'y arrête) ou une explosion qui l'atteint le met en colère : il pique sur **un combattant vivant d'une maison adverse du tireur, tiré au hasard**, et l'avale (mort immédiate, cause « dragon »), puis remonte et quitte le ciel. Pour une explosion, le tireur est la maison qui joue. Une fois en colère ou repu, il ignore les tirs.
- La résolution du tour attend la fin de son piqué.
- Précisions de programmation : valeurs dans `src/content/dragon.ts` (`MatchRules.dragon`, absent des vieux logs), corps de 240 × 90 px autour de son centre, piqué à 12 px/tick. Test `tests/sim/dragon.test.ts`, replay de référence `dragon`.

### 4.12 La licorne des marges (décidé le 2026-10-25)
- **Passage** : très rare, 2,5 % de chances au début de l'action de chaque tour (PRNG du sim), une seule à la fois. Elle traverse la carte au galop d'un bord à l'autre, **sur le sol** (elle suit le relief et ses pentes, et passe devant les tours et les murailles sans y monter), à 240 px/s.
- **Bienfait** : le combattant dont le tir (ou le coup de masse) la touche **retrouve tous ses PV** ; la flèche s'y arrête et la licorne disparaît. Une explosion qui l'atteint compte comme touchée par le combattant qui joue.
- Précisions de programmation : valeurs dans `src/content/unicorn.ts` (`MatchRules.unicorn`, absent des vieux logs), corps de 64 × 56 px debout sur ses sabots. Test `tests/sim/unicorn.test.ts`.

## 5. Vent
- Valeur entière de −10 à +10, tirée par PRNG à chaque tour. Une option permet de le figer à 0.
- Il affecte les projectiles marqués « Vent » (accélération horizontale proportionnelle : 2 sub-px/tick² par point de vent, multipliée par le facteur de vent de l'arme, `src/content/world.ts`), la bannière, les anges des reliquaires et la fumée (visuel).
- Indicateur : une bannière en haut d'écran dont la longueur et le sens suivent la valeur du vent. Un petit ange soufflant en marge apparaît au-delà de ±7.

### 5 bis. Pluie et foudre (décidé et programmé le 2026-10-25, sur demande)
- À chaque fin de tour par beau temps, 12 % de chances qu'il se mette à pleuvoir, pour 2 à 5 tours : les nuages virent au gris et la pluie tombe en biais, penchée par le vent (visuel seulement).
- À chaque fin de tour de pluie, 30 % de chances qu'**un éclair** frappe une colonne tirée au hasard (hors des 5 % de chaque bout), sur le sol ou l'eau : explosion de 35 PV dans un rayon de 45 px, avec cratère ; elle fait sauter les barils, éclater les reliquaires, etc. Elle part au premier instant du tour suivant.
- Valeurs dans `src/content/weather.ts` (`MatchRules.weather`, absent des vieux logs : beau temps), tirages au PRNG du sim, réglables dans ⚙ Réglages (onglet Météo).

## 6. Modes de jeu
| Mode | V1 | Description |
|---|---|---|
| Escarmouche vs IA | ✅ | 1 humain vs 1–3 IA |
| ~~Hotseat~~ | Retiré | Décidé le 2026-10-24 : deux humains ne jouent jamais sur le même appareil. L'écran « Passez la main » et l'option « Brouillard des chausse-trapes » sont retirés. En attendant l'IA (lot 5), « À la bataille ! » lance une partie d'essai sur un seul appareil, où tous les pièges sont visibles ; elle disparaîtra avec l'IA |
| Mixte | ✅ | Joueurs en ligne + maisons de l'IA |
| En ligne | Jalon M9 | 2 joueurs à distance, un par appareil (décidé le 2026-10-24, remplace le LAN 2 PC). L'un crée la partie sur l'écran de préparation et reçoit un **code** ; l'autre le saisit dans « Rejoindre une partie ». Les maisons paires (1ʳᵉ, 3ᵉ) sont à l'hôte, les impaires à l'invité. Chacun ne voit que les chausse-trapes de ses maisons (et toutes pendant le tour de son Sapeur) ; pas d'écran « Passez la main ». Les gestes de l'adversaire s'affichent avec environ une demi-seconde de retard. Une page rechargée reprend la partie par le même code. Cf. TECH_SPEC §8. Programmé le 2026-10-24 : boutons « Créer une partie en ligne » et « Rejoindre une partie… » de l'écran de préparation ; les règles et les maisons sont celles de l'hôte ; pause, aide et réglages arrêtent le jeu des deux côtés ; un bandeau dit quand on attend l'adversaire ; une désynchronisation ou le départ de l'adversaire arrête la partie ; quitter une partie en cours (Nouvelle partie, Recommencer) la donne perdue à l'adversaire. Hébergé sur https://medieverse-06.web.app |
| Défis | P2 | Puzzles à munitions imposées, du type « tuer 3 unités en 1 tour » |
| Replays | ✅ | Revoir la dernière partie, exporter et importer en JSON. Programmé le 2026-10-25 : « Revoir la partie » sur la tapisserie de fin rejoue le log depuis le premier instant (`ReplayInput`, une `InputSource` comme les autres) ; barre de lecture : pause, ×1 ×2 ×4, depuis le début, exporter (JSON), quitter ; la dernière partie terminée est gardée par le navigateur et l'écran de préparation propose de la revoir ou d'importer un fichier |

### Schémas de règles (presets)
- **Classique** : valeurs par défaut.
- **Siège** : forts de départ, beaucoup de murs de pierres, trébuchet ×3.
- **Fortune** : tout passe par les reliquaires (aucune munition de départ, hors arc et fronde).
- **Personnalisé** : tous les paramètres sont éditables et sauvegardés localement.
- Programmé le 2026-10-25 (`src/content/schemes.ts`, écran de préparation `src/ui/setup-screen.ts`) : avant la première partie (et par « Nouvelle partie… » du menu pause ou de la tapisserie de fin), on choisit le schéma, le Régicide, 2 à 4 maisons et la classe de chacun de leurs 1 à 6 combattants ; le choix est gardé. **Siège** : tours de 440 px, tours 360 PV, murailles 240 PV, 8 murs de pierres, 3 volées de trébuchet, 3 pioches, 3 sapes, 5 feux grégeois et 2 pots de poix (les « forts de départ » sont les murs que chaque maison bâtit). **Fortune** : feu grégeois, arbalète, poix et tous les outils à munitions (pioche, sape, chausse-trape, mur, trébuchet) à 0 au départ (arc, fronde et masse illimités), reliquaires à 70 % par tour, 5 au plus sur la carte. **Personnalisé** = les valeurs de ⚙ Réglages ; appliquer des réglages passe la partie en Personnalisé. « R » ou « Recommencer » rejoue la même préparation.

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
- **Haut** : au centre, la bannière du titre avec le vent puis le **numéro du tour**, en grand (décidé le 2026-10-25 : plus de cartouche du tour à gauche, la maison qui joue se lit à son bandeau qui brille) ; à gauche, tout en haut, les bandeaux des maisons, celui de la maison qui joue **brillant et pulsant à sa couleur** ; à droite, les boutons sans texte (⤢, ?, ⚙, Pause) et le sablier.
- **Bas** : barres de vie par équipe sous forme de phylactères avec blason ; fiche de l'unité active (nom, classe, PV).
- **Au-dessus des unités** : nom et PV dans un petit cartouche aux couleurs de la maison.
- **Tombes** (décidé le 2026-10-25) : un combattant tombé laisse une tombe **à la couleur de sa maison** ; au survol (ou au clic), une bulle donne son nom et une **épitaphe amusante**, toujours la même pour lui (la maison se lit à la couleur de la tombe).
- **Actions indisponibles grisées** (décidé le 2026-10-24) : marcher après un saut, sauter après avoir marché, tirer ou changer d'arme après le tir… le bouton est grisé. Les boutons d'action forment une seule barre centrée en bas de l'écran.
- **Taille de l'interface** (décidé le 2026-10-24) : panneaux, boutons et textes sont dessinés pour un écran 1920 × 1080 et rapetissent automatiquement sur une fenêtre plus petite (jusqu'à 60 %), pour laisser voir le champ de bataille ; sur écran tactile, les boutons gardent 48 px au minimum.
- **Arsenal** : grille d'icônes dans un cadre architecturé (arcades), avec les munitions en chiffres romains ou arabes (option).
- **Bulle d'objet** (décidé le 2026-10-24) : un clic (ou un appui) sur un baril, un reliquaire, la cuisine de campagne, une bête des marges ou un pot posé ouvre une bulle au-dessus de lui : son nom et ce qu'il fait, avec les valeurs de la partie. Elle le suit, se ferme d'un clic ou quand l'objet disparaît. Un reliquaire piégé n'est jamais signalé. Chaque arme de l'arsenal a aussi une phrase qui dit à quoi elle sert.
- **Dégâts** : chiffres en écriture gothique qui s'élèvent et s'estompent.
- **Aide** (décidé le 2026-10-24) : le bouton Aide ouvre un **tutoriel illustré** en quelques pages courtes (le but, un tour de jeu, viser et tirer, les armes, le vent, la caméra, les raccourcis), avec un schéma par page ; on y navigue par Précédent / Suivant.
- **Écrans** : titre (page enluminée avec lettrine animée), nouvelle partie, équipes et blasons, options, crédits, fin de partie (scène de triomphe peinte et tableau des exploits).

## 10. Cartes (V1 : 6, P1 : +4)
Chaque carte a un thème, une palette, un niveau d'eau initial et des éléments spécifiques.

**Cartes générées** (décidé et programmé le 2026-10-25, sur demande) : chaque carte est **redessinée à chaque partie** à partir de son thème et de la graine de la partie (`src/sim/terrain/generate.ts`, paramètres dans `src/content/maps.ts`) : collines ou dunes, tours, murailles, rochers affleurants et poches de roche changent de place à chaque fois (les barils l'étaient déjà). Calcul en entiers avec le PRNG du sim : la même graine donne la même carte partout ; le log de partie garde l'identifiant `thème@graine` et le replay redessine la carte. Trois thèmes, choisis sur l'écran de préparation (« Champ de bataille ») :
- **La vallée** : collines vertes, deux tours et une muraille ; strates en écailles ; au fond, château, fermes, moulins, vaches, moutons, chevaux.
- **La côte normande** : falaise à un bout, plage qui descend sous la mer à l'autre (l'eau est là dès le début : on y perd 20 PV et on est rejeté sur la rive), une ou deux tours ; strates en vagues semées de coquillages, oyats sur le dessus ; au fond, la mer, des cogues, une abbaye sur son rocher, des huttes de pêcheurs, des barques tirées sur le sable, des moutons de pré salé.
- **La Terre sainte** : dunes, rochers et une forteresse sarrasine (deux tours et une courtine) dans le tiers central ; strates en rides de sable, pierre de grès ; au fond, Jérusalem (murailles, dôme d'or, minaret), une forteresse, des palmiers, des tentes et des chameaux ; sur le terrain, des palmiers et des buissons secs.
- La vallée grise fixe des premières versions n'est plus proposée ; ses vieux logs se rejouent encore.

**Vie du ciel** (décidé le 2026-10-24, purement décoratif) : de temps en temps, une volée d'oiseaux traverse le ciel ou s'envole d'un arbre ; ou un arc-en-ciel apparaît derrière les collines, les pieds dans le décor du fond, puis s'efface. Le dragon des marges, d'abord décoratif, est devenu un élément de jeu (§4.11).

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
Jeu en ligne à plus de 2 joueurs ou avec matchmaking, éditeur de cartes in-game, campagne scénarisée, plus de 4 équipes, cosmétiques à débloquer, voix.
