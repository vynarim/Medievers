# Batterie d'équilibrage : 85-before-knight-random

150 parties IA contre IA (knight contre knight, combattants : random), cartes : valley, coast, holyLand, pass, 60 tours au plus ; 425 s sur 15 cœurs.

- Terminées : 112 · égalités : 38 · sans vainqueur au bout de 60 tours : 0
- Erreurs : 0 · replays divergents : 0 · combattants coincés : 0
- Tir ami : 3 % des dégâts infligés · réflexion de l'IA : 992 ms en moyenne, 2211 ms au 95ᵉ centile, 7458 ms au plus

## Victoires

| Niveau | Parties | Victoires | % |
|---|---|---|---|
| knight | 300 | 112 | 37.3 |

Côté gauche : 29.3 % · côté droit : 45.3 %

## Durée

Tours par partie : moyenne 40, médiane 39, 10ᵉ centile 34, 90ᵉ centile 48, au plus 59 ; soit 20 tours de table en moyenne.

| Carte | Parties | Tours en moyenne | Victoires à gauche % |
|---|---|---|---|
| valley | 38 | 43 | 34.2 |
| coast | 38 | 36 | 18.4 |
| holyLand | 37 | 44 | 37.8 |
| pass | 37 | 37 | 27 |

## Armes

| Arme | Tirs | Dégâts | Dégâts par tir | Morts | dont noyés |
|---|---|---|---|---|---|
| bow | 2189 | 34437 | 15.7 | 328 | 37 |
| grapple | 645 | 0 | 0 | 0 | 0 |
| crossbow | 610 | 15781 | 25.9 | 82 | 10 |
| greekFire | 548 | 10148 | 18.5 | 68 | 25 |
| trebuchet | 313 | 7211 | 23 | 8 | 0 |
| falcon | 308 | 12929 | 42 | 9 | 0 |
| sling | 303 | 5584 | 18.4 | 107 | 33 |
| miracle | 211 | 0 | 0 | 0 | 0 |
| ballista | 204 | 4103 | 20.1 | 28 | 4 |
| beehive | 180 | 3506 | 19.5 | 122 | 0 |
| banner | 155 | 0 | 0 | 0 | 0 |
| greatTrebuchet | 139 | 4508 | 32.4 | 12 | 0 |
| arrowRain | 134 | 4005 | 29.9 | 48 | 2 |
| pitchPot | 90 | 1403 | 15.6 | 38 | 16 |
| catapult | 58 | 1259 | 21.7 | 7 | 4 |
| mace | 38 | 1769 | 46.6 | 22 | 10 |
| shieldCharge | 26 | 741 | 28.5 | 19 | 8 |
| fireArrow | 15 | 454 | 30.3 | 3 | 0 |
| scorpion | 13 | 225 | 17.3 | 7 | 1 |
| ladder | 3 | 0 | 0 | 0 | 0 |
| sword | 2 | 105 | 52.5 | 1 | 0 |

## Part des morts (BACKLOG 8.5 : aucune arme au-dessus de 30 % des morts par les armes)

1655 morts, dont 909 par les armes (54.9 %). Une arme compte les morts de son tir : ses coups, et la noyade de ceux qu’elle jette à l’eau ; les morsures du dragon, l’eau qui monte au Déluge et la fin du tour n’en sont pas. Intervalle de confiance à 95 %, regroupé par partie.

| Arme | % des morts par les armes | % de toutes les morts |
|---|---|---|
| bow | 36.1 ± 3.3 | 19.8 ± 2 |
| beehive | 13.4 ± 1.9 | 7.4 ± 1 |
| sling | 11.8 ± 1.9 | 6.5 ± 1.1 |
| crossbow | 9 ± 1.8 | 5 ± 1 |
| greekFire | 7.5 ± 1.9 | 4.1 ± 1 |
| arrowRain | 5.3 ± 1.4 | 2.9 ± 0.8 |
| pitchPot | 4.2 ± 1.5 | 2.3 ± 0.8 |
| ballista | 3.1 ± 1.2 | 1.7 ± 0.6 |
| mace | 2.4 ± 0.9 | 1.3 ± 0.5 |
| shieldCharge | 2.1 ± 1.1 | 1.1 ± 0.6 |
| greatTrebuchet | 1.3 ± 0.9 | 0.7 ± 0.5 |
| falcon | 1 ± 0.6 | 0.5 ± 0.3 |
| trebuchet | 0.9 ± 0.6 | 0.5 ± 0.3 |
| catapult | 0.8 ± 0.6 | 0.4 ± 0.3 |
| scorpion | 0.8 ± 0.6 | 0.4 ± 0.4 |
| fireArrow | 0.3 ± 0.4 | 0.2 ± 0.2 |
| sword | 0.1 ± 0.2 | 0.1 ± 0.1 |

Causes de mort : bow 328, burn 298, drowned 211, dragon 186, beehive 122, sling 107, crossbow 82, greekFire 68, arrowRain 48, pitchPot 38, flames 32, ballista 28, mace 22, shieldCharge 19, greatTrebuchet 12, falcon 9, other 8, trebuchet 8, catapult 7, scorpion 7, beast 7, fireArrow 3, fall 2, lightning 1, sword 1, outOfMap 1

Hors des armes : `burn` le parchemin qui brûle, `drowned` l’eau sans tir (le Déluge qui monte), `dragon` ses morsures, `flames` les flammes au sol hors du tir qui les a posées, `beast` les bêtes, `lightning` la foudre, `fall` et `outOfMap` les chutes hors tir, `other` le reste.

| Cause | Morts | % |
|---|---|---|
| Armes | 909 | 54.9 |
| burn | 298 | 18 |
| drowned | 211 | 12.7 |
| dragon | 186 | 11.2 |
| flames | 32 | 1.9 |
| beast | 7 | 0.4 |
| lightning | 1 | 0.1 |
| fall | 2 | 0.1 |
| outOfMap | 1 | 0.1 |
| kingFell | 0 | 0 |
| other | 8 | 0.5 |

## Classes

| Classe | Combattants | Survie % | Dégâts par tour joué | Morts infligées par combattant | Dégâts subis par combattant | Tir ami par tour |
|---|---|---|---|---|---|---|
| archer | 300 | 8.7 | 18.5 | 0.82 | 102 | 0.6 |
| cleric | 292 | 6.8 | 18.5 | 0.85 | 105 | 0.6 |
| king | 199 | 2 | 19.1 | 0.37 | 86 | 0.4 |
| knight | 401 | 10 | 18.6 | 0.97 | 104 | 0.6 |
| sapper | 311 | 9.3 | 18.9 | 0.82 | 105 | 0.3 |
| slinger | 297 | 8.8 | 17.5 | 0.71 | 93 | 0.7 |
