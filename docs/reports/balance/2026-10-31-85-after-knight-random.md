# Batterie d'équilibrage : 85-after-knight-random

150 parties IA contre IA (knight contre knight, combattants : random), cartes : valley, coast, holyLand, pass, 60 tours au plus ; 371 s sur 15 cœurs.

- Terminées : 108 · égalités : 41 · sans vainqueur au bout de 60 tours : 1
- Erreurs : 0 · replays divergents : 0 · combattants coincés : 2
- Tir ami : 3.3 % des dégâts infligés · réflexion de l'IA : 859 ms en moyenne, 1813 ms au 95ᵉ centile, 4156 ms au plus

## Victoires

| Niveau | Parties | Victoires | % |
|---|---|---|---|
| knight | 300 | 108 | 36 |

Côté gauche : 34.7 % · côté droit : 37.3 %

## Durée

Tours par partie : moyenne 40.4, médiane 39, 10ᵉ centile 33, 90ᵉ centile 48, au plus 61 ; soit 20.2 tours de table en moyenne.

| Carte | Parties | Tours en moyenne | Victoires à gauche % |
|---|---|---|---|
| valley | 38 | 42 | 39.5 |
| coast | 38 | 36 | 36.8 |
| holyLand | 37 | 46 | 35.1 |
| pass | 37 | 37 | 27 |

## Armes

| Arme | Tirs | Dégâts | Dégâts par tir | Morts | dont noyés |
|---|---|---|---|---|---|
| bow | 1547 | 16818 | 10.9 | 217 | 31 |
| crossbow | 908 | 22386 | 24.7 | 143 | 17 |
| sling | 744 | 16490 | 22.2 | 168 | 47 |
| grapple | 598 | 0 | 0 | 0 | 0 |
| greekFire | 530 | 10045 | 19 | 85 | 29 |
| falcon | 314 | 12893 | 41.1 | 7 | 0 |
| trebuchet | 304 | 7161 | 23.6 | 9 | 1 |
| miracle | 220 | 0 | 0 | 0 | 0 |
| ballista | 179 | 3988 | 22.3 | 20 | 4 |
| greatTrebuchet | 165 | 5406 | 32.8 | 25 | 0 |
| beehive | 164 | 3067 | 18.7 | 115 | 0 |
| banner | 139 | 6 | 0 | 0 | 0 |
| arrowRain | 127 | 3772 | 29.7 | 47 | 1 |
| pitchPot | 74 | 1517 | 20.5 | 26 | 12 |
| catapult | 55 | 1456 | 26.5 | 11 | 7 |
| shieldCharge | 39 | 1396 | 35.8 | 28 | 7 |
| mace | 27 | 1292 | 47.9 | 10 | 6 |
| fireArrow | 23 | 624 | 27.1 | 6 | 1 |
| scorpion | 16 | 260 | 16.3 | 5 | 1 |
| sword | 8 | 350 | 43.8 | 2 | 2 |

## Part des morts (BACKLOG 8.5 : aucune arme au-dessus de 30 % des morts par les armes)

1654 morts, dont 924 par les armes (55.9 %). Une arme compte les morts de son tir : ses coups, et la noyade de ceux qu’elle jette à l’eau ; les morsures du dragon, l’eau qui monte au Déluge et la fin du tour n’en sont pas. Intervalle de confiance à 95 %, regroupé par partie.

| Arme | % des morts par les armes | % de toutes les morts |
|---|---|---|
| bow | 23.5 ± 2.5 | 13.1 ± 1.5 |
| sling | 18.2 ± 2.4 | 10.2 ± 1.4 |
| crossbow | 15.5 ± 2.2 | 8.6 ± 1.2 |
| beehive | 12.4 ± 1.7 | 7 ± 0.9 |
| greekFire | 9.2 ± 1.9 | 5.1 ± 1.1 |
| arrowRain | 5.1 ± 1.3 | 2.8 ± 0.7 |
| shieldCharge | 3 ± 1.2 | 1.7 ± 0.7 |
| pitchPot | 2.8 ± 1.1 | 1.6 ± 0.6 |
| greatTrebuchet | 2.7 ± 1.5 | 1.5 ± 0.9 |
| ballista | 2.2 ± 1.1 | 1.2 ± 0.6 |
| catapult | 1.2 ± 0.9 | 0.7 ± 0.5 |
| mace | 1.1 ± 0.7 | 0.6 ± 0.4 |
| trebuchet | 1 ± 0.6 | 0.5 ± 0.3 |
| falcon | 0.8 ± 0.6 | 0.4 ± 0.3 |
| fireArrow | 0.6 ± 0.6 | 0.4 ± 0.3 |
| scorpion | 0.5 ± 0.5 | 0.3 ± 0.3 |
| sword | 0.2 ± 0.3 | 0.1 ± 0.2 |

Causes de mort : burn 307, drowned 226, bow 217, sling 168, dragon 155, crossbow 143, beehive 115, greekFire 85, arrowRain 47, flames 33, shieldCharge 28, pitchPot 26, greatTrebuchet 25, ballista 20, catapult 11, mace 10, trebuchet 9, falcon 7, fireArrow 6, scorpion 5, beast 4, fall 2, sword 2, burnt 1, other 1, lightning 1

Hors des armes : `burn` le parchemin qui brûle, `drowned` l’eau sans tir (le Déluge qui monte), `dragon` ses morsures, `flames` les flammes au sol hors du tir qui les a posées, `beast` les bêtes, `lightning` la foudre, `fall` et `outOfMap` les chutes hors tir, `other` le reste.

| Cause | Morts | % |
|---|---|---|
| Armes | 924 | 55.9 |
| burn | 307 | 18.6 |
| drowned | 226 | 13.7 |
| dragon | 155 | 9.4 |
| flames | 33 | 2 |
| beast | 4 | 0.2 |
| lightning | 1 | 0.1 |
| fall | 2 | 0.1 |
| outOfMap | 0 | 0 |
| kingFell | 0 | 0 |
| other | 1 | 0.1 |

## Classes

| Classe | Combattants | Survie % | Dégâts par tour joué | Morts infligées par combattant | Dégâts subis par combattant | Tir ami par tour |
|---|---|---|---|---|---|---|
| archer | 300 | 7.3 | 18.8 | 0.83 | 105 | 0.7 |
| cleric | 292 | 7.9 | 17.6 | 0.75 | 105 | 0.4 |
| king | 199 | 4 | 18.8 | 0.54 | 86 | 0.4 |
| knight | 401 | 9.2 | 18.6 | 0.94 | 103 | 0.6 |
| sapper | 311 | 9 | 19.2 | 0.91 | 105 | 0.6 |
| slinger | 297 | 9.4 | 17.5 | 0.68 | 94 | 0.8 |
