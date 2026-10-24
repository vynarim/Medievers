# Medieverse

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
| Règles complètes | Classes, Régicide, Déluge, flammes, tours qui s'effondrent, schémas de règles, écran de préparation | jouable |
| Jeu en ligne | Créer une partie, la rejoindre par un code, reprise après rechargement | jouable |
| IA, arsenal complet | — | à venir |
| Graphismes et musique | Le style enluminé et la musique | à venir |

<div class="page-break"></div>

## 1. Le principe

Deux à quatre **maisons** s'affrontent sur une carte peinte, chacune avec un à six combattants (quatre par défaut, à choisir sur l'écran de préparation). On joue **chacun son tour** : pendant votre tour, un seul de vos combattants agit. Il se déplace, choisit une arme, vise et tire. Le terrain se creuse sous les explosions, les combattants sont projetés, tombent, se noient.

**La victoire** revient à la dernière maison qui a encore au moins un combattant debout. Si toutes les maisons tombent dans la même explosion, c'est une égalité.

Le ton est **burlesque**. Les personnages gardent la gravité figée des enluminures, mais subissent des catastrophes absurdes. Il n'y a pas de sang : les coups font voler des étoiles, des plumes et des éclats de vélin.

Un chroniqueur à l'humour douteux commente la partie {{st:jeu}} : chaque tour s'ouvre sur une annonce, et chaque tir, blessure, mort ou tir manqué lui inspire une réplique, affichée dans le phylactère sous la bannière de vent. Les impacts font jaillir des onomatopées dignes d'une bande dessinée médiévale : « Badaboum ! », « Palsambleu ! », « Tchac ! ».

## 2. Le déroulement d'un tour {{st:jeu}}

**Avant le premier tour, le placement.** Les maisons posent leurs combattants **une par une, à tour de rôle** : cliquez sur la carte à l'endroit voulu (un trait pointillé à vos couleurs montre où il tombera). Pas trop près d'un autre combattant ni du bord, et il faut un sol pour se tenir. Vous avez 20 secondes par combattant ; passé ce délai, il est posé à sa place par défaut. Quand toutes les armées sont en place, le tour 1 commence.


| Phase | Durée | Ce qui se passe |
|---|---|---|
| Transition | {{rules:transition}} | La caméra rejoint votre combattant. Le vent du tour s'affiche. |
| Action | {{rules:action}} (au choix 30, 45, 60 ou 90 s sur l'écran de préparation) | Vous vous déplacez librement, choisissez une arme, visez et tirez. |
| Après le tir | tout le temps restant | Le sablier compte tout le tour : le tir ne le fait pas baisser, il continue de s'écouler. Le déplacement que vous n'avez pas utilisé avant de tirer vous reste après. Le tir ne termine pas le tour : on peut bouger puis tirer, ou tirer puis bouger, avec le déplacement pas encore utilisé. **Fin du tour** termine le tour ; il se termine aussi tout seul quand il ne reste plus de déplacement et que le tir est retombé. |
| Résolution | variable, puis {{rules:settle}} | Le jeu attend que tout soit retombé : projectiles, explosions, chutes. Les morts sont alors constatées, puis une courte pause laisse voir le résultat et le commentaire. Le sablier est en pause. |
| Fin de tour | — | Les effets de fin de tour s'appliquent, et un reliquaire peut tomber du ciel. |

- Le sablier **ne s'arrête pas** pendant que vous visez : la pression du temps fait partie du jeu.
- Un combattant **touché pendant son propre tour** termine son tour aussitôt.
- **Le tir ami existe** : une flèche ou une explosion blesse aussi vos propres combattants, et vous-même.
- **Vous choisissez qui joue** : le jeu propose un combattant, mais un clic sur un autre de vos combattants (sur lui ou sur son nom), ou le bouton **⇄ Combattant**, lui donne la main, tant que personne n'a encore bougé ni tiré ce tour (viser ne compte pas). Ensuite, sa fiche indique « la maison a déjà bougé ou tiré ce tour ». En revanche, le combattant qui a joué le tour précédent de votre maison **souffle** : il ne peut pas rejouer tout de suite (sa fiche l'indique), sauf s'il est le dernier debout.
- Les morts sont constatées à la fin de la résolution : un combattant à 0 PV ne tombe qu'une fois que tout s'est arrêté.

## 3. Vos combattants

### 3.1 Ce que tous savent faire {{st:jeu}}

- **Points de vie** : {{unit:startHp}} par défaut (50, 150 ou 200 en option).
- **Marcher** : un combattant avance de {{unit:walkSpeedPx}} pixel par instant de jeu, franchit une marche de {{unit:maxStep}} pixels au plus et grimpe des pentes jusqu'à environ 60°. Au bord d'un précipice, il tombe.
- **Sauter** : **↶** et **↷** font un saut long vers la gauche ou vers la droite (le combattant se retourne au besoin) ; **↑** fait un saut haut, très haut en reculant un peu, pour sortir d'un trou ou grimper sur un rebord. Au clavier, Entrée saute loin devant, Entrée deux fois saute haut.
- **Marcher ou sauter** : à chaque tour, c'est l'un ou l'autre. Soit on marche, {{unit:moveBudget}} pixels au plus (environ 10 largeurs de combattant) ; soit on fait un seul saut, qui porte bien plus loin (environ 15 largeurs) mais toujours à la même distance. La barre verte sous le nom de la maison montre la marche qui reste.
- **Grimper** : au pied d'une échelle, un appui sur **↑** fait monter le combattant **jusqu'en haut d'un seul trait** ; **↓** (qui n'apparaît qu'à une échelle) le fait descendre jusqu'en bas. Au clavier, ↑ et ↓ font de même quand on est à l'échelle. Prendre l'échelle est **l'action du tour**, comme un tir : elle ne coûte rien de la marche, se prend avant de tirer (jamais après), et **termine le tour** une fois arrivé au bout. Il faut appuyer sur ↑ ou ↓ une fois à l'échelle : arriver devant en tenant ↑ pour viser ne la fait pas prendre ; pendant la montée, le combattant ne fait rien d'autre. Pas besoin d'être pile dessus : l'échelle se prend jusqu'à une largeur de combattant de distance, et le combattant s'y place de lui-même. En haut, il se hisse sur le rempart et y reste, même si l'on garde ↑ appuyé. Sur le haut d'une tour, il s'arrête au bord, au-dessus de l'échelle, au lieu de tomber : ↓ apparaît alors pour redescendre. Un clic sur un combattant de votre maison qui ne peut pas prendre la main (il a joué au tour précédent, ou la maison a déjà bougé) affiche une petite bulle qui le dit.
- **Se retourner** est gratuit : un appui bref vers l'autre côté retourne le combattant sur place, sans marcher. Un combattant qui commence son tour près d'un bout de la carte est déjà tourné vers l'intérieur.
- **Tomber** : une chute de plus de {{unit:fallSafeHeight}} pixels blesse. On perd 1 PV tous les {{unit:fallPxPerHp}} pixels de chute en plus, jusqu'à {{unit:fallMaxDamage}} PV au maximum. Une chute de 200 pixels coûte donc {{unit:fall200}} PV.
- **Mourir** : à 0 PV, en sortant de la carte par les bords, ou en tombant dans l'eau. Le combattant laisse une petite stèle qui roule et glisse comme un objet.

### 3.2 Les six classes {{st:jeu}}

Toutes les classes partagent le **même arsenal**. Chacune a en plus un talent, et parfois une contrepartie.

| Classe | Talent | Contrepartie |
|---|---|---|
| **Chevalier** | *Haubert* : −25 % de dégâts d'explosion reçus | Lourd : ses sauts portent environ 30 % moins loin et moins haut |
| **Archer** | *Œil exercé* : la trajectoire prévue (les points dorés qui apparaissent quand on charge le tir) s'affiche deux fois plus loin avec l'arc et l'arbalète | — |
| **Frondeur** | *Bras souple* : la fronde et les pots partent 15 % plus vite, donc plus loin | −10 PV maximum |
| **Sapeur** | *Maître d'œuvre* : creuse deux fois plus vite à la pioche et à la sape (deux fois plus profond, deux fois plus loin), et quand c'est lui qui joue, sa maison voit les chausse-trapes ennemies | — |
| **Clerc** | *Bénédiction* : à la fin de son tour, soigne de 10 PV les alliés à moins de 120 pixels (pas lui-même) | Pas d'armes de mêlée |
| **Roi** | *Majesté* : les alliés à moins de 200 pixels infligent +10 % de dégâts (il compte au moment du tir) | −20 PV ; un seul par maison |

Chaque maison compose son armée sur l'écran de préparation de la partie. On reconnaît les classes à leur attribut : la couronne du Roi, le carquois de l'Archer, la fronde du Frondeur, la pioche du Sapeur, la crosse du Clerc ; le Chevalier est le combattant en heaume, sans rien de plus. La fiche du combattant (clic sur lui) rappelle son talent et sa contrepartie, avec les valeurs de la partie. Les talents se règlent dans ⚙ Réglages, onglet **Classes**.

### 3.3 Les maisons {{st:prevu}}

Chaque équipe est une **maison héraldique** : un nom, un blason et deux couleurs, que l'on retrouve sur les écus, les bannières, la tente de départ et l'écran. Huit maisons sont prêtes à jouer : *le Lion d'Or*, *les Trois Tours*, *la Clef*, *le Croissant d'Argent*, *l'Aigle*, *l'Ancre*, *le Sanglier* et *l'Étoile*. Les combattants reçoivent des prénoms médiévaux (Godefroy, Aubri, Ermengarde…) que vous pouvez changer.

**À chaque partie, les maisons reçoivent un nom nouveau** {{st:jeu}}, tiré d'une héraldique un peu dérangée : *Maison du Hareng Rampant*, *Maison des Trois Limaces d'Azur*, *Maison de l'Oie et du Poireau*… Leur couleur, elle, ne change pas.

## 4. L'arsenal {{st:prevu}}

**Chaque combattant garde son arme** {{st:jeu}} : à son tour suivant, il reprend celle qu'il a choisie en dernier (l'arc s'il n'en reste plus). L'enluminure de l'arme en main est dessinée sur le bouton **Arsenal**.

Les valeurs ci-dessous sont celles du schéma de règles *Classique*. « Vent » indique si le vent dévie le projectile.

### 4.1 Armes de tir et de lancer

Déjà jouables {{st:jeu}} : **arc**, **arbalète**, **fronde**, **pot de feu grégeois** (il laisse des flammes au sol) et **pot de poix**. Les autres armes sont {{st:prevu}}. Les munitions limitées se regagnent dans les reliquaires.

| Arme | Dégâts max | Rayon d'explosion | Vent | Munitions | À savoir |
|---|---|---|---|---|---|
| **Arc** | 35 | — | oui | ∞ | La flèche reste fichée dans le décor |
| **Arbalète** | 45 | — | faible | 2 | Puissance fixe : on ne règle que l'angle |
| **Fronde** | 25 | — | oui | ∞ | Fort recul : idéale pour éjecter un ennemi |
| **Pot de feu grégeois** | 45 | 60 px | non | 3 | Rebondit. **Mèche en tours** : 1 = il explose pendant ce tour (après 3 s) ; 2 = il se pose et explose au début du tour suivant ; 3 = dans deux tours. Un pot posé affiche son compte (I, II) et peut être projeté par une explosion |
| **Pot de poix** | 30 + 5 × 15 | 50 / 30 px | non | 1 | Rebondit, puis éclate en 5 gouttes enflammées qui explosent là où elles tombent |
| **Cochon enflammé** | 70 | 90 px | non | 1 | Avance seul, saute les obstacles, explose sur ordre ou au bout de 8 s |
| **Ruche** | 5 par contact | — | oui | 1 | L'essaim poursuit le combattant le plus proche pendant 4 s |
| **Faucon** | 50 | 50 px | oui | 1 | Vous désignez la cible, il y vole |

### 4.2 Frappes venues du ciel

| Arme | Dégâts | Rayon | Munitions | À savoir |
|---|---|---|---|---|
| **Volée de trébuchet** {{st:jeu}} | 5 × 30 | 45 px | 1 | Cliquez sur la carte : 5 pierres tombent autour du point, lancées du côté opposé à la visée (la flèche de visée montre où elles vont). Sans clic, la jauge choisit la distance devant vous. Chaque pierre explose là où elle tombe |
| **Pluie de flèches** | 12 × 10 | — | 1 | Couvre une large zone, faibles dégâts par flèche |

### 4.3 Mêlée

La **masse d'armes** est jouable {{st:jeu}} : le bouton devient « Frapper ». Elle se charge comme un tir : maintenez « Frapper » (ou Espace), la jauge se remplit, relâchez pour frapper, à 34 pixels devant vous dans la direction visée. Les dégâts sont toujours les mêmes ; plus la jauge est pleine, plus l'ennemi vole loin (jauge vide : un cinquième de la distance). Sans rien à frapper à portée dans la direction visée, le bouton **Frapper** reste grisé : on ne gâche pas son action à battre l'air. Les autres armes de mêlée sont {{st:prevu}}.

| Arme | Dégâts | Recul | À savoir |
|---|---|---|---|
| **Épée** | 25 | faible | Frappe devant soi |
| **Masse d'armes** | 30 | fort, dans la direction visée | Pour envoyer l'ennemi au loin |
| **Charge à l'écu** | 20 | moyen | Course de 120 px qui renverse tout sur son passage |

### 4.4 Outils

| Outil | Effet | Munitions |
|---|---|---|
| **Grappin** | Une corde pour se balancer, la lâcher et la relancer en l'air | 5 |
| **Mur de pierres** {{st:jeu}} | Cliquez sur la carte pour poser un bloc de pierre taillée, jusqu'à 320 px de vous ; la pierre est lourde : il tombe tout droit jusqu'au sol, où son contour s'affiche. La visée le tourne (par pas de 22,5°), les boutons 1 à 3 choisissent sa longueur (48, 80 ou 120 px). Son contour s'affiche sous la souris, en rouge là où il ne peut pas aller (trop loin, sur un combattant, en pleine terre) : le mur n'est alors pas posé et vous le gardez | 2 |
| **Bannière** | Parachute : on descend lentement, porté par le vent | 3 |
| **Pioche** {{st:jeu}} | « Creuser » : creuse droit vers le bas pendant 3 s, environ 90 px dans la terre (180 pour un Sapeur), plus lentement dans la pierre, pas du tout dans la roche. Le temps du tour s'arrête pendant qu'on creuse | 2 |
| **Sape** {{st:jeu}} | « Creuser » : un tunnel à plat, ou en biais à 45° vers le haut ou le bas selon la visée, pendant 4 s (environ 180 px, 360 pour un Sapeur) ; le combattant le suit | 2 |
| **Échelle** | Pose une échelle de 200 px que tout le monde peut emprunter | 2 |
| **Chausse-trape** {{st:jeu}} | « Poser » : le piège tombe juste devant vous. Il s'arme en 2 s puis saute sous le premier combattant qui marche dessus, ami ou ennemi : 40 dégâts dans un rayon de 50 px. Une explosion proche le fait sauter aussi. En ligne, chacun ne voit que les pièges de ses maisons (et tous quand c'est son Sapeur qui joue) | 2 |
| **Miracle** | Vous téléporte sur un point libre ; votre tour s'arrête | 1 |
| **Passer son tour** | — | ∞ |

### 4.5 Comment se calculent les dégâts {{st:jeu}}

Une explosion fait ses dégâts maximum en son centre, puis de moins en moins jusqu'au bord de son rayon. Au bord, elle ne fait plus rien. Un combattant à mi-rayon reçoit la moitié des dégâts. La distance se mesure jusqu'au milieu du corps du combattant. L'explosion **projette** aussi les combattants, d'autant plus fort qu'ils sont touchés durement. Ils rebondissent puis glissent jusqu'à s'arrêter. Les talents (Haubert, Majesté) s'appliquent ensuite.

## 5. Le champ de bataille

### 5.1 Le terrain {{st:jeu}}

**Trois champs de bataille** {{st:jeu}}, au choix sur l'écran de préparation, et **redessinés à chaque partie** : les collines, les tours, les murailles et les rochers n'y sont jamais au même endroit.

- **La vallée** : collines vertes, moulins et vaches, deux tours et une muraille.
- **La côte normande** : une falaise d'un côté, une plage qui s'enfonce dans la mer de l'autre (attention, la mer coûte 20 PV et vous rejette sur la rive), des cogues et une abbaye sur son rocher au loin.
- **La Terre sainte** : des dunes, des rochers indestructibles, une forteresse sarrasine au milieu, Jérusalem à l'horizon, des palmiers et des chameaux.

Chaque carte est une peinture, doublée d'une carte invisible des matières. Ce que vous voyez creusé est exactement ce qui est creusé : le jeu ne triche jamais sur la forme du terrain.

{{materials}}

Quand une explosion creuse la terre, le décor peint disparaît et laisse voir **le vélin** de la page, avec un bord déchiré.

**Tout tir abîme le décor.** Une flèche qui se fiche dans le sol y laisse un petit trou de {{rules:chipBow}} pixels de rayon, une pierre de fronde de {{rules:chipSling}} pixels, un peu moins dans la pierre bâtie, plus dure. Percer un mur à l'arc est long, mais possible : il faut environ six flèches bien alignées pour traverser un mur de pierre de 20 pixels.

**Les tours et les murailles ont des points de vie** {{st:jeu}}. Chaque coup leur en retire : une flèche ne fait qu'un quart de ses dégâts à de la pierre, le feu grégeois toute sa force, et il ronge le bois deux fois plus vite. Un clic sur une tour montre ce qui lui reste. Abîmée, elle se lézarde, puis tombe en ruine ; à 0 PV, **elle s'effondre** : elle bascule du côté opposé au coup qui l'a abattue, ses blocs écrasent les combattants qui se trouvent dessous (jusqu'à 40 PV), et il n'en reste qu'un tas de gravats. Ceux qui étaient perchés dessus tombent avec elle. **Creuser sous une tour** (explosions, pioche, sape) marche aussi : quand plus de la moitié de sa base ne repose plus sur rien, elle s'effondre du côté du trou, quels que soient ses points de vie. Le corps d'une tour n'est pas un obstacle : on passe devant, et les tirs aussi ; seul son chemin de ronde, en haut, arrête les coups et porte les combattants, qui y montent par l'échelle. Dans la vallée et sur la côte, certaines tours sont **en bois**, dressées sur une butte de terre comme les mottes castrales : plus basses (140 PV), elles brûlent deux fois plus vite au feu grégeois et à la poix. La hauteur des tours se règle dans ⚙ Réglages, onglet **Constructions**.

### 5.2 Le vent {{st:jeu}}

Le vent change à chaque tour, de −10 (fort vers la gauche) à +10 (fort vers la droite). Il dévie les flèches, les pierres de fronde, la ruche, le faucon et la bannière, mais pas les pots. Une bannière en haut de l'écran montre sa force et son sens. Au-delà de 7, un petit ange souffle dans la marge. Une option permet de supprimer le vent.

**Pluie et foudre** {{st:jeu}} : de temps en temps, les nuages grisent et il pleut pendant quelques tours. Tant qu'il pleut, à la fin de chaque tour, un **éclair** peut frapper n'importe où sur le champ de bataille : 35 dégâts dans un rayon de 45 pixels, un cratère, et les barils voisins sautent. Réglages : onglet **Météo**.

### 5.3 Reliquaires, barils et flammes {{st:jeu}}

- **Reliquaires** : à chaque fin de tour, il y a 30 % de chances qu'un ange descende en planant (porté par le vent) et dépose un coffret. On le ramasse en le touchant.
  - *Reliquaire d'armes* : une arme au hasard, les plus puissantes étant les plus rares.
  - *Fiole de baume* : +25 PV.
  - *Coffret piégé* (10 % des cas) : il explose quand on le touche ou qu'on tire dessus.
- **Flammes** : le pot de feu grégeois laisse six flammes sur le sol, dans son rayon, pendant trois tours. Qui s'y tient perd 3 PV par instant, 10 PV au plus par tour ; y marcher pendant son tour, c'est être touché, donc finir son tour. Elles font sauter les barils de poudre, tombent si le sol se dérobe, et l'eau les éteint. Réglages : onglet **Flammes**.

### Les reliquaires {{st:jeu}}

À la fin d'un tour sur trois environ, **un ange descend du ciel** avec un reliquaire, qu'il laisse dériver avec le vent avant de le poser. Le premier combattant qui le touche en marchant le prend :
- **reliquaire d'armes** : une munition de plus pour une arme à munitions limitées ;
- **fiole de baume** : +25 PV (sans dépasser les PV de départ) ;
- **coffret piégé** (un sur dix) : il vous explose au nez, sans trop de gravité (20 PV au plus, dans un petit rayon).

Un tir ou une explosion qui touche un reliquaire le fait éclater, et le feu du parchemin le détruit.

### Les barils de poudre {{st:jeu}}

Cinq **barils de poudre** sont posés au hasard sur la carte au début de la partie. Une flèche, une pierre, un pot, une explosion ou le feu du parchemin qui les touche les fait sauter : **40 dégâts** dans un rayon de 70 pixels, et un beau cratère. Un baril qui saute fait sauter ses voisins une fraction de seconde plus tard : visez le baril plutôt que l'ennemi qui s'est caché à côté. Réglages : onglet **Barils de poudre**.

### La cuisine de campagne {{st:jeu}}

De temps en temps, au début d'un tour, **un foyer avec un chaudron** s'installe entre les deux camps, à mi-chemin entre la maison qui joue et l'ennemi le plus proche, sur un sol plat. Le combattant dont le tir la touche (flèche, pierre, ou l'explosion d'un pot qui l'atteint) **regagne 30 PV**, sans dépasser ses PV de départ ; la cuisine disparaît alors, et une flèche s'arrête dans la marmite. Tirer sur la soupe plutôt que sur l'ennemi est donc un choix.

- La chance d'apparition baisse au fil de la partie : 25 % au premier tour de table, puis un peu moins à chaque tour de table, jamais moins de 2 %.
- C'est équitable : aucune maison ne voit apparaître une deuxième cuisine à son tour tant que les autres n'en ont pas eu autant.
- Une seule cuisine à la fois ; si personne n'y touche, elle s'éteint au bout de deux tours de table.
- Toutes ces valeurs se règlent dans l'onglet **Cuisine de campagne** des réglages. Une partie commencée avant l'arrivée de la cuisine n'en aura pas : recommencez la partie pour la voir.

### Les bêtes des marges {{st:jeu}}

Les lièvres et les escargots qui peuplent les marges du manuscrit se mêlent parfois à la bataille : à la fin d'un tour, il y a 8 % de chances qu'une bête sorte d'un bord de la carte. Elle n'est d'aucun camp. À la fin de chaque tour, elle avance vers le combattant le plus proche : le **lièvre** bondit de 300 pixels (mais un mur l'arrête), l'**escargot** rampe de 60 pixels (et passe à travers tout). Quand elle l'atteint, elle lui joue un tour au hasard, puis disparaît :

| Bête | Tours possibles |
|---|---|
| **Lièvre** | *Ruade* : 15 PV et une belle projection · *Chapardage* : il vole une munition de votre arme la plus rare · *Panique* : au début de son prochain tour, la victime saute en arrière malgré elle |
| **Escargot** | *Bave* : pendant deux de ses tours, sa marche compte double · *Coquille* : à son prochain tour, ni marche ni saut (il peut tirer) · *Morsure lente* : 3 PV à chaque fin de tour, trois fois |

Un tir, un coup de masse ou une explosion qui touche la bête la renvoie dans sa marge. Les effets en cours s'affichent au-dessus du nom du combattant et dans sa fiche.

### Le dragon {{st:jeu}}

De temps en temps (12 % de chances au début d'un tour), un dragon des marges traverse le ciel en rase-mottes : il suit le relief, juste au-dessus de la tête des combattants, et monte par-dessus les collines et les tours ; il ondule aussi en volant : tantôt il rase les troupes, tantôt il remonte bien haut. Une flèche l'atteint sans peine. **Ne lui tirez pas dessus** : touché, même sans dégâts, il pique sur un combattant d'une maison adverse tiré au hasard, l'avale tout rond, puis repart. Le tour attend qu'il ait fini. Une explosion qui l'atteint le fâche de la même façon, comme si la maison qui joue avait tiré.

### La licorne {{st:jeu}}

Très rarement (2,5 % de chances au début d'un tour), une licorne traverse le champ de bataille au galop, en suivant le relief. **Touchez-la** d'une flèche, d'une pierre ou d'un coup de masse : votre combattant **retrouve tous ses points de vie**, et elle disparaît.

### Le parchemin brûle {{st:jeu}}

Après deux tours de table, un moine maladroit renverse sa chandelle : **la carte prend feu à ses deux bouts**. À la fin de chaque tour de table, le feu mange 60 pixels de plus de chaque côté. Un combattant qui se trouve dans la partie brûlée à la fin d'un tour perd **20 PV**, à chaque tour. Les armées n'ont donc pas intérêt à rester sur les bords : il faut se rapprocher de l'ennemi. Une cuisine de campagne rattrapée par le feu s'éteint. **Quand les deux feux se rejoignent au milieu, la partie s'arrête** : la maison à qui il reste le plus de points de vie, tous ses combattants vivants comptés, l'emporte. Réglages : onglet **Parchemin en feu**.

### 5.4 Le Déluge {{st:jeu}}

Pour que les parties ne s'éternisent pas, **le Déluge** arrive après 20 tours (ou 15 minutes). Une pleine page enluminée l'annonce : « *Et les eaux montèrent…* ». Ensuite, l'eau monte de 48 pixels à chaque fin de tour, et tous les combattants perdent 5 PV (0 pour s'en passer). Un combattant qui tombe à l'eau, ou que l'eau rattrape, **perd 20 PV et est rejeté sur la terre sèche la plus proche** ; il ne se noie que si ses PV n'y suffisent pas, ou quand il n'y a plus de terre hors de l'eau. Ce qui tombe à l'eau disparaît aussi : tirs, reliquaires, barils, pots, cuisine, bêtes. Si l'eau emporte toutes les maisons à la fois, c'est une égalité. Réglages : onglet **Déluge**.

## 6. Les modes de jeu

| Mode | Joueurs | État |
|---|---|---|
| **Escarmouche contre l'IA** | 1 humain contre 1 à 3 maisons de l'IA | {{st:prevu}} |
| **Mixte** | Joueurs en ligne et maisons de l'IA dans la même partie | {{st:prevu}} |
| **En ligne** | 2 joueurs à distance, chacun sur son appareil : l'un crée la partie et donne le code, l'autre la rejoint | {{st:jeu}} |
| **Replays** | « Revoir la partie » sur la tapisserie de fin (ou à tout moment, depuis le début) ; « Revoir la dernière partie » et « Importer un replay… » sur l'écran de préparation ; pendant le replay : pause, vitesse ×1, ×2, ×4, depuis le début, **Exporter** (fichier JSON) et Quitter. Tous les pièges y sont visibles | {{st:jeu}} |

**Écran titre** {{st:jeu}} : il s'ouvre à chaque lancement, avec **Reprendre la partie** quand une partie est en cours, **Entrer en lice** pour en préparer une nouvelle et **Rejoindre une partie…** pour saisir le code d'un adversaire, et **Comment jouer** pour le tutoriel illustré. Le menu ☰ Pause y ramène (**Écran titre**).

**Jouer en ligne** {{st:jeu}} : le jeu se joue sur https://medieverse-06.web.app. Sur l'écran de préparation, l'un choisit la carte, les règles et les maisons, puis touche **Créer une partie en ligne** : un code de six signes s'affiche (par exemple `K7M-2QX`). Il le donne à son adversaire, qui touche **Rejoindre une partie…** et le saisit. Celui qui a créé la partie joue la 1ʳᵉ maison (et la 3ᵉ), l'autre la 2ᵉ (et la 4ᵉ). Pendant le tour adverse, on regarde : les gestes de l'adversaire arrivent avec une demi-seconde de retard. Chacun ne voit que ses propres chausse-trapes. La pause, l'aide et les réglages arrêtent le jeu des deux côtés. Si la page se recharge, le jeu retrouve la partie tout seul et rattrape ce qui s'est passé. Quitter une partie en cours la laisse à l'adversaire.

On ne joue jamais à deux sur le même appareil : c'est en ligne, ou contre l'IA (à venir). En attendant l'IA, **À la bataille !** lance une partie d'essai sur un seul appareil.

**Régicide** (option) {{st:jeu}} : chaque maison a un Roi, et sa mort élimine toute la maison : ses autres combattants quittent aussitôt le champ.


**Préparer la bataille** {{st:jeu}} : avant la première partie, et ensuite par **Nouvelle partie…** (menu ☰ Pause, ou la tapisserie de fin), un écran permet de choisir les règles, le Régicide, le nombre de maisons (2 à 4) et, pour chacune, ses combattants (1 à 6) et leur classe. Le jeu s'en souvient ; **Recommencer** rejoue la même préparation.

**La fin de la partie** {{st:jeu}} : une tapisserie brodée, à la manière de celle de Bayeux, défile : la maison victorieuse y parade, festoie et chante faux, avec des légendes en latin. Si tout le monde tombe en même temps (le feu, l'eau…), la tapisserie montre un champ vide, un mouton et des moines perplexes. On peut fermer la tapisserie pour contempler le champ de bataille.

**Schémas de règles** {{st:jeu}} :
- *Classique* : les valeurs de ce manuel.
- *Siège* : des tours plus hautes et plus solides, 8 murs de pierres pour bâtir ses forts, 3 volées de trébuchet, 3 pioches et 3 sapes, 5 pots de feu grégeois et 2 de poix.
- *Fortune* : aucune munition au départ hormis l'arc, la fronde et la masse ; les reliquaires tombent bien plus souvent.
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
| Viser | ↑ ↓, ou faire glisser la pointe rouge de la flèche de visée |
| Se retourner sur place | T |
| Tirer avec la jauge | Maintenir Espace, relâcher pour tirer |
| Tirer « à la fronde » | Cliquer sur le combattant, tirer en arrière, relâcher |
| Ouvrir l'arsenal | Clic droit ou Tab |
| Régler la mèche d'un pot | Touches 1 à 5 |
| Déplacer la caméra / zoomer | Bords de l'écran ou clic molette / molette |
| Revenir à la vue par défaut | C ou le bouton **◎**, visible seulement quand vous avez zoomé ou déplacé la vue (ou double clic). La vue par défaut montre toujours tous les combattants, et suit le projectile pendant un tir |
| Afficher les informations de debug | F1 (puis P : pause, N : avancer d'un instant) |
| Pause | Échap |

### Qui joue, et dans quel sens ? {{st:jeu}}

Le combattant qui joue porte une **auréole dorée**, une **flèche** oscille au-dessus de son nom et son cartouche passe à l'or. Une annonce au centre de l'écran rappelle à chaque tour qui a la main.

Il vise **du côté où il regarde** : la ligne de points rouges et dorés, terminée par une pointe de flèche, part de lui. Le plus simple : **attrapez la pointe rouge** à la souris ou au doigt et faites-la glisser où vous voulez viser, même derrière lui ; il se retourne tout seul, et rien ne part tant que vous n'avez pas tiré. Sans souris, maintenez **⟳ Viser** : la visée fait le tour complet, et le combattant se retourne quand elle passe derrière lui. Au clavier, ↑ ↓ lèvent ou baissent la visée, et **T** le retourne sur place. Un appui bref sur ← ou → vers l'autre côté le retourne aussi sans le faire avancer : se retourner ne coûte ni marche ni saut.

### À la souris {{st:jeu}}

Tout se fait aussi à la souris (ou au doigt), avec les deux groupes de boutons du bas de l'écran.

En bas à gauche, le **pad** :

- **↶ ◀ ↑ ▶ ↷** : au centre, ◀ et ▶ (maintenir pour marcher) entourent ↑, le saut haut ; aux deux bouts, ↶ et ↷ sont les sauts longs vers la gauche et vers la droite ;
- **⟳ Viser** : maintenir pour faire tourner la visée tout autour du combattant.

En bas à droite, les armes :

- **Arsenal** : la liste des armes avec leurs dégâts, leur rayon, leur sensibilité au vent et les munitions restantes ; un clic choisit l'arme ;
- **Mèche 1 à 5** : visible avec le pot de feu grégeois ;
- **⇄ Combattant** : donner la main au combattant suivant de votre maison, avant d'avoir bougé ou tiré ;
- **Passer** : finir son tour sans tirer ;
- **Tirer** est aux couleurs de la maison qui joue : on sait toujours à qui c'est le tour. Maintenir pour charger la puissance, relâcher pour tirer. Une jauge pleine repart de zéro : rien ne part tout seul, il faut lâcher au bon moment.

Au-dessus, le cartouche de l'arme en main montre la jauge de puissance. En haut à droite : **⤢** (plein écran, comme F11 ; un second appui en sort), **◎** (revenir au zoom par défaut et recentrer ; il n'apparaît que lorsque vous avez zoomé ou déplacé la vue), **?** (l'aide : un petit tutoriel illustré en sept pages : le but, le tour, se déplacer, viser, tirer, le vent, la caméra), **⚙** (les réglages) et **Pause**. En haut au centre, la bannière du titre montre le vent, le numéro du tour et la barre de souffle ; en haut à gauche, les bandeaux des maisons, celui de la maison qui joue brillant à sa couleur. La souris posée contre un bord de l'écran fait défiler la carte. Le menu de pause (aussi sur Échap) propose de reprendre, de recommencer la partie, de lire l'aide ou d'ouvrir les réglages ; le temps est arrêté tant qu'il est ouvert, comme pendant l'aide et les réglages.

On peut aussi viser « à la fronde » : appuyer sur son combattant, tirer franchement en arrière (le trait devient rouge quand le tir est armé), relâcher. Un simple clic sur le combattant ne tire jamais, et revenir près de lui avant de relâcher annule le tir.

### La fiche du combattant {{st:jeu}}

Au-dessus de chaque combattant, une petite étiquette porte son nom, et une fine barre à ses couleurs montre ce qui lui reste de vie. À la souris, il suffit de passer sur un combattant pour voir sa classe et ses points de vie exacts.

Un clic sur n'importe quel combattant ouvre sa fiche : nom, maison, points de vie, état (joue ce tour, attend, en l'air, tombé), classe, talent et contrepartie, un rappel des règles de marche, de chute et de mort, et, pour le combattant qui joue, l'arme en main avec ses caractéristiques.

### Les bulles d'objets {{st:jeu}}

Un clic (ou un appui) sur un baril de poudre, un reliquaire, la cuisine de campagne, une bête des marges ou un pot posé ouvre une **bulle** au-dessus de lui, qui dit ce que c'est et ce que ça fait. Un clic sur la bulle la ferme. Un reliquaire piégé ne se trahit pas.

### Réglages de test {{st:jeu}}

Le bouton **⚙ Réglages** ouvre toutes les valeurs du jeu en cours de réglage : durées du tour, points de vie, vitesse de marche, sauts, chutes, vent, projections, et pour chaque arme ses dégâts, sa vitesse, son rayon, son usure du terrain, sa mèche, ses munitions. Les valeurs sont rangées par onglets (Tour, Combattants, Vent et explosions, puis une page par arme). Elles s'appliquent à la partie suivante (**Appliquer et relancer**), le navigateur s'en souvient, et **Valeurs par défaut** remet tout comme avant. Les valeurs d'une partie sont enregistrées avec son replay.

### Sur tablette {{st:jeu}}

- Le **pad** en bas à gauche pour marcher, sauter et viser ; **Arsenal**, **Passer** et **Tirer** en bas à droite. Tous les boutons font au moins 48 px de côté.
- **Viser à la fronde** : glissez depuis votre combattant, puis relâchez.
- **Viser à la jauge** : ⟳ Viser maintenu (ou la pointe rouge glissée) pour l'angle, le bouton Tirer maintenu pour la puissance.
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

## 9. Partie sauvegardée {{st:jeu}}

La partie en cours s'enregistre toute seule dans le navigateur. Si la page est rechargée, si le navigateur se ferme ou si l'ordinateur redémarre, le jeu reprend la bataille exactement où elle en était. Une partie terminée, ou recommencée depuis le menu de pause, efface la sauvegarde.

## 10. Options et confort {{st:prevu}}

Choix du mode de visée · résolution accélérée ×2 · secousses de caméra réduites · couleurs de maisons distinguables pour les daltoniens (un motif en plus de la couleur) · taille du texte · volume par canal · français, puis anglais.

## 11. Musique {{st:prevu}}

L'énergie rythmique de *Patapon*, remixée en médiéval : tambours en avant, petites boucles entraînantes à la chalemie, à la flûte et à la vièle, et chœurs scandés comme une troupe en marche.

---

*Medieverse s'inspire de la Bible de Maciejowski (Morgan Library & Museum, MS M.638, Paris, vers 1250). Les maisons sont fictives.*
