# Batterie d'équilibrage : body-blast-burnfear

150 parties IA contre IA (knight contre knight, combattants : random), cartes : valley, coast, holyLand, pass, 60 tours au plus ; 440 s sur 15 cœurs.

- Terminées : 113 · égalités : 37 · sans vainqueur au bout de 60 tours : 0
- Erreurs : 0 · replays divergents : 0 · combattants coincés : 3
- Tir ami : 2.6 % des dégâts infligés · réflexion de l'IA : 1054 ms en moyenne, 2507 ms au 95ᵉ centile, 10069 ms au plus

## Victoires

| Niveau | Parties | Victoires | % |
|---|---|---|---|
| knight | 300 | 113 | 37.7 |

Côté gauche : 34 % · côté droit : 41.3 %

## Durée

Tours par partie : moyenne 39, médiane 38, 10ᵉ centile 31, 90ᵉ centile 49, au plus 60 ; soit 19.5 tours de table en moyenne.

| Carte | Parties | Tours en moyenne | Victoires à gauche % |
|---|---|---|---|
| valley | 38 | 43 | 26.3 |
| coast | 38 | 34 | 44.7 |
| holyLand | 37 | 41 | 40.5 |
| pass | 37 | 37 | 24.3 |

## Armes

| Arme | Tirs | Dégâts | Dégâts par tir | Morts | dont noyés |
|---|---|---|---|---|---|
| bow | 1300 | 15701 | 12.1 | 243 | 27 |
| crossbow | 900 | 22350 | 24.8 | 174 | 17 |
| grapple | 557 | 0 | 0 | 0 | 0 |
| greekFire | 556 | 17600 | 31.7 | 128 | 31 |
| sling | 556 | 13746 | 24.7 | 168 | 50 |
| trebuchet | 315 | 25721 | 81.7 | 93 | 9 |
| falcon | 307 | 14808 | 48.2 | 47 | 2 |
| miracle | 251 | 0 | 0 | 0 | 0 |
| ballista | 177 | 3556 | 20.1 | 20 | 3 |
| banner | 157 | 0 | 0 | 0 | 0 |
| beehive | 155 | 3081 | 19.9 | 99 | 0 |
| arrowRain | 131 | 3923 | 29.9 | 61 | 1 |
| greatTrebuchet | 128 | 6794 | 53.1 | 37 | 1 |
| pitchPot | 125 | 6420 | 51.4 | 76 | 11 |
| catapult | 80 | 3113 | 38.9 | 18 | 8 |
| mace | 36 | 1840 | 51.1 | 15 | 6 |
| shieldCharge | 23 | 758 | 33 | 17 | 5 |
| fireArrow | 22 | 664 | 30.2 | 1 | 0 |
| scorpion | 16 | 260 | 16.3 | 7 | 0 |
| sword | 2 | 85 | 42.5 | 0 | 0 |
| ladder | 1 | 0 | 0 | 0 | 0 |

## Part des morts (BACKLOG 8.5 : aucune arme au-dessus de 30 % des morts par les armes)

1650 morts, dont 1204 par les armes (73 %). Une arme compte les morts de son tir : ses coups, et la noyade de ceux qu’elle jette à l’eau ; les morsures du dragon, l’eau qui monte au Déluge et la fin du tour n’en sont pas. Intervalle de confiance à 95 %, regroupé par partie.

| Arme | % des morts par les armes | % de toutes les morts |
|---|---|---|
| bow | 20.2 ± 2.2 | 14.7 ± 1.7 |
| crossbow | 14.5 ± 1.8 | 10.5 ± 1.3 |
| sling | 14 ± 2 | 10.2 ± 1.5 |
| greekFire | 10.6 ± 2 | 7.8 ± 1.4 |
| beehive | 8.2 ± 1.4 | 6 ± 1.1 |
| trebuchet | 7.7 ± 1.4 | 5.6 ± 1 |
| pitchPot | 6.3 ± 1.4 | 4.6 ± 1 |
| arrowRain | 5.1 ± 1.2 | 3.7 ± 0.9 |
| falcon | 3.9 ± 1 | 2.8 ± 0.7 |
| greatTrebuchet | 3.1 ± 1.3 | 2.2 ± 1 |
| ballista | 1.7 ± 0.8 | 1.2 ± 0.6 |
| catapult | 1.5 ± 0.9 | 1.1 ± 0.6 |
| shieldCharge | 1.4 ± 0.7 | 1 ± 0.5 |
| mace | 1.2 ± 0.6 | 0.9 ± 0.4 |
| scorpion | 0.6 ± 0.5 | 0.4 ± 0.4 |
| fireArrow | 0.1 ± 0.2 | 0.1 ± 0.1 |

Causes de mort : bow 243, drowned 186, crossbow 174, sling 168, greekFire 128, dragon 127, beehive 99, trebuchet 93, burn 92, pitchPot 76, arrowRain 61, falcon 47, greatTrebuchet 37, ballista 20, catapult 18, flames 17, shieldCharge 17, mace 15, scorpion 7, beast 6, lightning 4, crushed 4, burnt 3, outOfMap 3, other 2, fall 2, fireArrow 1

Hors des armes : `burn` le parchemin qui brûle, `drowned` l’eau sans tir (le Déluge qui monte), `dragon` ses morsures, `flames` les flammes au sol hors du tir qui les a posées, `beast` les bêtes, `lightning` la foudre, `fall` et `outOfMap` les chutes hors tir, `other` le reste.

| Cause | Morts | % |
|---|---|---|
| Armes | 1204 | 73 |
| burn | 92 | 5.6 |
| drowned | 186 | 11.3 |
| dragon | 127 | 7.7 |
| flames | 17 | 1 |
| beast | 6 | 0.4 |
| lightning | 4 | 0.2 |
| fall | 2 | 0.1 |
| outOfMap | 3 | 0.2 |
| kingFell | 0 | 0 |
| other | 2 | 0.1 |

## Classes

| Classe | Combattants | Survie % | Dégâts par tour joué | Morts infligées par combattant | Dégâts subis par combattant | Tir ami par tour |
|---|---|---|---|---|---|---|
| archer | 300 | 9 | 24.8 | 0.8 | 106 | 0.7 |
| cleric | 292 | 9.2 | 23.2 | 0.83 | 105 | 0.6 |
| king | 199 | 3.5 | 26.5 | 0.51 | 92 | 0.7 |
| knight | 401 | 10.2 | 23.5 | 1.14 | 104 | 0.5 |
| sapper | 311 | 9.6 | 27.7 | 0.83 | 106 | 0.9 |
| slinger | 297 | 6.1 | 24.3 | 0.78 | 100 | 0.7 |
