# Medievers

## Manuel du joueur

{{edition}}

> Des armées enluminées sortent des pages d'un manuscrit du XIIIᵉ siècle et s'affrontent à l'arc, au trébuchet et au feu grégeois, sur des paysages peints qui s'effritent à chaque tir.

Ce manuel décrit le jeu tel qu'on le joue. Il grandit avec le jeu : chaque règle porte une étiquette qui dit où elle en est.

- {{st:jeu}} jouable dans le jeu ;
- {{st:moteur}} programmée et testée dans le moteur, mais pas encore visible à l'écran ;
- {{st:prevu}} décrite ici, pas encore programmée.

### Où en est le jeu

| Étape | Contenu | État |
|---|---|---|
| Fondations | Outils, structure, garde-fous | terminée |
| Moteur de simulation | Calcul exact et identique sur tous les appareils, terrain, combattants, projectiles, explosions, tours | terminée |
| Première version jouable | Formes simples à l'écran, clavier, souris et tactile, arc, fronde et pot | jouable (reste à essayer sur une vraie tablette) |
| Règles complètes, réseau local, IA, arsenal complet | — | à venir |
| Graphismes et musique | Le style enluminé et la musique | à venir |

<div class="page-break"></div>

## 1. Le principe

Deux à quatre **maisons** s'affrontent sur une carte peinte, chacune avec trois à six combattants. On joue **chacun son tour** : pendant votre tour, un seul de vos combattants agit. Il se déplace, choisit une arme, vise et tire. Le terrain se creuse sous les explosions, les combattants sont projetés, tombent, se noient.

**La victoire** revient à la dernière maison qui a encore au moins un combattant debout. Si toutes les maisons tombent dans la même explosion, c'est une égalité.

Le ton est **burlesque**. Les personnages gardent la gravité figée des enluminures, mais subissent des catastrophes absurdes. Il n'y a pas de sang : les coups font voler des étoiles, des plumes et des éclats de vélin.

Un chroniqueur à l'humour douteux commente la partie {{st:jeu}} : chaque tour s'ouvre sur une annonce, et chaque tir, blessure, mort ou tir manqué lui inspire une réplique, affichée dans le phylactère sous la bannière de vent. Les impacts font jaillir des onomatopées dignes d'une bande dessinée médiévale : « Badaboum ! », « Palsambleu ! », « Tchac ! ».

## 2. Le déroulement d'un tour {{st:jeu}}

| Phase | Durée | Ce qui se passe |
|---|---|---|
| Transition | {{rules:transition}} | La caméra rejoint votre combattant. Le vent du tour s'affiche. |
| Action | {{rules:action}} | Vous vous déplacez librement, choisissez une arme, visez et tirez. |
| Repli | {{rules:retreat}} | Après le tir, vous pouvez encore bouger pour vous mettre à l'abri, mais plus attaquer. |
| Résolution | variable | Le jeu attend que tout soit retombé : projectiles, explosions, chutes. Le sablier est en pause. |
| Fin de tour | — | Les effets de fin de tour s'appliquent, et un reliquaire peut tomber du ciel. |

- Le sablier **ne s'arrête pas** pendant que vous visez : la pression du temps fait partie du jeu.
- Un combattant **touché pendant son propre tour** termine son tour aussitôt.
- Vos combattants jouent à tour de rôle, dans l'ordre de l'équipe. Une option permettra de choisir librement lequel joue.
- Les morts sont constatées à la fin de la résolution : un combattant à 0 PV ne tombe qu'une fois que tout s'est arrêté.

## 3. Vos combattants

### 3.1 Ce que tous savent faire {{st:jeu}}

- **Points de vie** : {{unit:startHp}} par défaut (50, 150 ou 200 en option).
- **Marcher** : un combattant avance de {{unit:walkSpeedPx}} pixel par instant de jeu, franchit une marche de {{unit:maxStep}} pixels au plus et grimpe des pentes jusqu'à environ 60°. Au bord d'un précipice, il tombe.
- **Sauter** : un saut court vers l'avant, ou un saut plus haut vers l'arrière.
- **Tomber** : une chute de plus de {{unit:fallSafeHeight}} pixels blesse. On perd 1 PV tous les {{unit:fallPxPerHp}} pixels de chute en plus, jusqu'à {{unit:fallMaxDamage}} PV au maximum. Une chute de 200 pixels coûte donc {{unit:fall200}} PV.
- **Mourir** : à 0 PV, en sortant de la carte par les bords, ou en tombant dans l'eau. Le combattant laisse une petite stèle qui roule et glisse comme un objet.

### 3.2 Les six classes {{st:prevu}}

Toutes les classes partagent le **même arsenal**. Chacune a en plus un talent, et parfois une contrepartie.

| Classe | Talent | Contrepartie |
|---|---|---|
| **Chevalier** | *Haubert* : −25 % de dégâts d'explosion reçus | Saute 30 % moins haut |
| **Archer** | *Œil exercé* : la trajectoire prévue de l'arc et de l'arbalète s'affiche deux fois plus loin | — |
| **Frondeur** | *Bras souple* : +15 % de puissance maximale sur les armes lancées | −10 PV maximum |
| **Sapeur** | *Maître d'œuvre* : creuse deux fois plus vite et voit les chausse-trapes ennemies | — |
| **Clerc** | *Bénédiction* : à la fin de son tour, soigne de 10 PV les alliés à moins de 120 pixels (pas lui-même) | Pas d'armes de mêlée |
| **Roi** | *Majesté* : les alliés à moins de 200 pixels infligent +10 % de dégâts | −20 PV ; un seul par maison |

### 3.3 Les maisons {{st:prevu}}

Chaque équipe est une **maison héraldique** : un nom, un blason et deux couleurs, que l'on retrouve sur les écus, les bannières, la tente de départ et l'écran. Huit maisons sont prêtes à jouer : *le Lion d'Or*, *les Trois Tours*, *la Clef*, *le Croissant d'Argent*, *l'Aigle*, *l'Ancre*, *le Sanglier* et *l'Étoile*. Les combattants reçoivent des prénoms médiévaux (Godefroy, Aubri, Ermengarde…) que vous pouvez changer.

## 4. L'arsenal {{st:prevu}}

Les valeurs ci-dessous sont celles du schéma de règles *Classique*. « Vent » indique si le vent dévie le projectile.

### 4.1 Armes de tir et de lancer

Déjà jouables : **arc**, **fronde** et **pot de feu grégeois** {{st:jeu}} (le pot n'allume pas encore de flammes). Les autres armes sont {{st:prevu}}.

| Arme | Dégâts max | Rayon d'explosion | Vent | Munitions | À savoir |
|---|---|---|---|---|---|
| **Arc** | 35 | — | oui | ∞ | La flèche reste fichée dans le décor |
| **Arbalète** | 45 | — | faible | 3 | Puissance fixe : on ne règle que l'angle |
| **Fronde** | 25 | — | oui | ∞ | Fort recul : idéale pour éjecter un ennemi |
| **Pot de feu grégeois** | 45 | 60 px | non | ∞ | Rebondit ; mèche de 1 à 5 s ; laisse des flammes 3 tours |
| **Pot de poix** | 30 + 5 × 15 | 50 / 30 px | non | 2 | Éclate en 5 gouttes enflammées |
| **Cochon enflammé** | 70 | 90 px | non | 1 | Avance seul, saute les obstacles, explose sur ordre ou au bout de 8 s |
| **Ruche** | 5 par contact | — | oui | 1 | L'essaim poursuit le combattant le plus proche pendant 4 s |
| **Faucon** | 50 | 50 px | oui | 1 | Vous désignez la cible, il y vole |

### 4.2 Frappes venues du ciel

| Arme | Dégâts | Rayon | Munitions | À savoir |
|---|---|---|---|---|
| **Volée de trébuchet** | 5 × 30 | 45 px | 1 | 5 pierres sur la cible choisie, en venant de gauche ou de droite |
| **Pluie de flèches** | 12 × 10 | — | 1 | Couvre une large zone, faibles dégâts par flèche |

### 4.3 Mêlée

| Arme | Dégâts | Recul | À savoir |
|---|---|---|---|
| **Épée** | 25 | faible | Frappe devant soi |
| **Masse d'armes** | 30 | fort, dans la direction visée | Pour envoyer l'ennemi au loin |
| **Charge à l'écu** | 20 | moyen | Course de 120 px qui renverse tout sur son passage |

### 4.4 Outils

| Outil | Effet | Munitions |
|---|---|---|
| **Grappin** | Une corde pour se balancer, la lâcher et la relancer en l'air | 5 |
| **Mur de pierres** | Pose un bloc de pierre taillée (3 longueurs, rotation par pas de 22,5°) | 2 |
| **Bannière** | Parachute : on descend lentement, porté par le vent | 3 |
| **Pioche** | Creuse droit vers le bas pendant 3 s | 2 |
| **Sape** | Creuse un tunnel horizontal ou en biais pendant 4 s | 2 |
| **Échelle** | Pose une échelle de 200 px que tout le monde peut emprunter | 2 |
| **Chausse-trape** | Piège invisible pour l'ennemi, armé en 2 s : 40 dégâts dans un rayon de 50 px | 2 |
| **Miracle** | Vous téléporte sur un point libre ; votre tour s'arrête | 1 |
| **Passer son tour** | — | ∞ |

### 4.5 Comment se calculent les dégâts {{st:jeu}}

Une explosion fait ses dégâts maximum en son centre, puis de moins en moins jusqu'au bord de son rayon. Au bord, elle ne fait plus rien. Un combattant à mi-rayon reçoit la moitié des dégâts. La distance se mesure jusqu'au milieu du corps du combattant. L'explosion **projette** aussi les combattants, d'autant plus fort qu'ils sont touchés durement. Ils rebondissent puis glissent jusqu'à s'arrêter. Les talents (Haubert, Majesté) s'appliquent ensuite.

## 5. Le champ de bataille

### 5.1 Le terrain {{st:jeu}}

Chaque carte est une peinture, doublée d'une carte invisible des matières. Ce que vous voyez creusé est exactement ce qui est creusé : le jeu ne triche jamais sur la forme du terrain.

{{materials}}

Quand une explosion creuse la terre, le décor peint disparaît et laisse voir **le vélin** de la page, avec un bord déchiré.

### 5.2 Le vent {{st:jeu}}

Le vent change à chaque tour, de −10 (fort vers la gauche) à +10 (fort vers la droite). Il dévie les flèches, les pierres de fronde, la ruche, le faucon et la bannière, mais pas les pots. Une bannière en haut de l'écran montre sa force et son sens. Au-delà de 7, un petit ange souffle dans la marge. Une option permet de supprimer le vent.

### 5.3 Reliquaires, barils et flammes {{st:prevu}}

- **Reliquaires** : à chaque fin de tour, il y a 30 % de chances qu'un ange descende en planant (porté par le vent) et dépose un coffret. On le ramasse en le touchant.
  - *Reliquaire d'armes* : une arme au hasard, les plus puissantes étant les plus rares.
  - *Fiole de baume* : +25 PV.
  - *Coffret piégé* (10 % des cas) : il explose quand on le touche ou qu'on tire dessus.
- **Barils de poix** : touchés, ils explosent (30 dégâts dans un rayon de 60 px), puis enflamment le sol. Une explosion peut en déclencher d'autres en chaîne.
- **Flammes** : 3 PV par instant de contact, 10 PV au plus par tour. L'eau les éteint.

### 5.4 Le Déluge {{st:prevu}}

Pour que les parties ne s'éternisent pas, **le Déluge** arrive après 20 tours (ou 15 minutes). Une pleine page enluminée l'annonce : « *Et les eaux montèrent…* ». Ensuite, l'eau monte de 48 pixels à chaque fin de tour, et en option tous les combattants perdent 5 PV. L'eau noie instantanément.

## 6. Les modes de jeu

| Mode | Joueurs | État |
|---|---|---|
| **Escarmouche contre l'IA** | 1 humain contre 1 à 3 maisons de l'IA | {{st:prevu}} |
| **Hotseat** | 2 à 4 humains sur le même appareil, qui se passent la main | {{st:jeu}} (2 maisons de 3 combattants) |
| **Mixte** | Humains et IA dans la même partie | {{st:prevu}} |
| **LAN** | 2 PC du même réseau, un joueur par machine, sans serveur | {{st:prevu}} |
| **Replays** | Revoir la dernière partie, l'exporter ou l'importer | {{st:prevu}} |

**Régicide** (option) : chaque maison a un Roi, et sa mort élimine toute la maison.

**Schémas de règles** :
- *Classique* : les valeurs de ce manuel.
- *Siège* : forts de départ, beaucoup de murs de pierres, trois volées de trébuchet.
- *Fortune* : aucune munition au départ (hormis l'arc et la fronde) ; tout vient des reliquaires.
- *Personnalisé* : vous réglez tout, et le jeu s'en souvient.

### Les adversaires de l'IA {{st:prevu}}

L'IA joue avec les mêmes règles et les mêmes commandes que vous. Elle ne voit pas vos chausse-trapes, sauf si elle a un Sapeur.

| Niveau | Style |
|---|---|
| **Écuyer** | Vise approximativement, s'en tient à l'arc, la fronde et les pots |
| **Chevalier** | Précis, utilise presque tout l'arsenal |
| **Connétable** | Redoutable : grappin, combinaisons, tirs au millimètre |

## 7. Les commandes

### Au clavier et à la souris {{st:jeu}}

| Action | Commande |
|---|---|
| Marcher | ← → ou A / D |
| Saut avant / arrière | Entrée / Entrée deux fois |
| Viser | ↑ ↓ ou la souris |
| Se retourner sur place | T |
| Tirer avec la jauge | Maintenir Espace, relâcher pour tirer |
| Tirer « à la fronde » | Cliquer sur le combattant, tirer en arrière, relâcher |
| Ouvrir l'arsenal | Clic droit ou Tab |
| Régler la mèche d'un pot | Touches 1 à 5 |
| Déplacer la caméra / zoomer | Bords de l'écran ou clic molette / molette |
| Recentrer | C ou double clic |
| Afficher les informations de debug | F1 (puis P : pause, N : avancer d'un instant) |
| Pause | Échap |

### Qui joue, et dans quel sens ? {{st:jeu}}

Le combattant qui joue porte une **auréole dorée**, une **flèche** oscille au-dessus de son nom et son cartouche passe à l'or. Une annonce au centre de l'écran rappelle à chaque tour qui a la main.

Il vise **du côté où il regarde** : la ligne de points rouges et dorés, terminée par une pointe de flèche, part de lui. ↑ ↓ lèvent ou baissent la visée. Pour tirer de l'autre côté, **T** (ou le bouton **⇄ Se tourner**) le retourne sur place en gardant la même hauteur de visée ; marcher avec ← → le retourne aussi.

### À la souris {{st:jeu}}

Tout se fait aussi à la souris (ou au doigt), avec les deux groupes de boutons du bas de l'écran.

En bas à gauche, le **pad** :

- **◀** et **▶** : maintenir le bouton pour marcher ;
- **Sauter** et **↶ Arrière** ;
- **▲ Viser** et **▼** : maintenir pour lever ou baisser la visée ;
- **⇄ Se tourner** : se retourner sur place.

En bas à droite, les armes :

- **Arsenal** : la liste des armes avec leurs dégâts, leur rayon, leur sensibilité au vent et les munitions restantes ; un clic choisit l'arme ;
- **Mèche 1 à 5** : visible avec le pot de feu grégeois ;
- **Passer** : finir son tour sans tirer ;
- **Tirer** : maintenir pour charger la puissance, relâcher pour tirer.

Au-dessus, le cartouche de l'arme en main montre la jauge de puissance. En haut à droite : **Aide**, **Réglages** et **Pause**. Le menu de pause (aussi sur Échap) propose de reprendre, de recommencer la partie, de lire l'aide ou d'ouvrir les réglages ; le temps est arrêté tant qu'il est ouvert, comme pendant l'aide et les réglages.

On peut aussi viser « à la fronde » : appuyer sur son combattant, tirer en arrière, relâcher.

### La fiche du combattant {{st:jeu}}

Un clic sur n'importe quel combattant ouvre sa fiche : nom, maison, points de vie, état (joue ce tour, attend, en l'air, tombé), classe et talent (à venir), un rappel des règles de marche, de chute et de mort, et, pour le combattant qui joue, l'arme en main avec ses caractéristiques.

### Réglages de test {{st:jeu}}

Le bouton **⚙ Réglages** ouvre toutes les valeurs du jeu en cours de réglage : durées du tour, points de vie, vitesse de marche, sauts, chutes, vent, projections, et pour chaque arme ses dégâts, sa vitesse, son rayon, sa mèche, ses munitions. Elles s'appliquent à la partie suivante (**Appliquer et relancer**), le navigateur s'en souvient, et **Valeurs par défaut** remet tout comme avant. Les valeurs d'une partie sont enregistrées avec son replay.

### Sur tablette {{st:jeu}}

- Le **pad** en bas à gauche pour marcher, sauter, viser et se retourner ; **Arsenal**, **Passer** et **Tirer** en bas à droite. Tous les boutons font au moins 48 px de côté.
- **Viser à la fronde** : glissez depuis votre combattant, puis relâchez.
- **Viser à la jauge** : ▲ ▼ pour l'angle, le bouton Tirer maintenu pour la puissance.
- **Caméra** : un doigt glissé hors du combattant pour se déplacer, deux doigts pour zoomer, double tap pour recentrer.
- **Frappes du ciel** {{st:prevu}} : touchez la cible, puis Confirmer.

Le choix du mode de visée dans les options est prévu {{st:prevu}}. Le jeu n'a pas encore été essayé sur une vraie tablette.

## 8. Les cartes {{st:prevu}}

| Carte | Inspirée de | Particularités |
|---|---|---|
| **Les Murailles de Jéricho** | le siège de Jéricho | Remparts destructibles, tours indestructibles |
| **La Vallée d'Ela** | David et Goliath | Deux collines face à face, ravin inondé au centre |
| **Le Camp sous les Tentes** | les camps militaires | Tentes, chariots et nombreux barils de poix |
| **L'Arche** | l'arche de Noé | Grande coque au centre, eau haute dès le départ |
| **La Tour** | la tour de Babel | Carte verticale, échafaudages |
| **Le Verger** | les arbres du manuscrit | Arbres en boules, terre meuble |

## 9. Options et confort {{st:prevu}}

Choix du mode de visée · résolution accélérée ×2 · secousses de caméra réduites · couleurs de maisons distinguables pour les daltoniens (un motif en plus de la couleur) · taille du texte · volume par canal · français, puis anglais.

## 10. Musique {{st:prevu}}

L'énergie rythmique de *Patapon*, remixée en médiéval : tambours en avant, petites boucles entraînantes à la chalemie, à la flûte et à la vièle, et chœurs scandés comme une troupe en marche.

---

*Medievers s'inspire de la Bible de Maciejowski (Morgan Library & Museum, MS M.638, Paris, vers 1250). Les maisons sont fictives.*
