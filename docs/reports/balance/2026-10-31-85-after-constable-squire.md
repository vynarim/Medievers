# Batterie d'équilibrage : 85-after-constable-squire

90 parties IA contre IA (constable contre squire, combattants : default), cartes : valley, coast, holyLand, pass, 60 tours au plus ; 142 s sur 15 cœurs.

- Terminées : 87 · égalités : 3 · sans vainqueur au bout de 60 tours : 0
- Erreurs : 0 · replays divergents : 0 · combattants coincés : 3
- Tir ami : 5 % des dégâts infligés · réflexion de l'IA : 698 ms en moyenne, 2171 ms au 95ᵉ centile, 5313 ms au plus

## Victoires

| Niveau | Parties | Victoires | % |
|---|---|---|---|
| constable | 90 | 84 | 93.3 |
| squire | 90 | 3 | 3.3 |

Côté gauche : 51.1 % · côté droit : 45.6 %

## Durée

Tours par partie : moyenne 30.3, médiane 30, 10ᵉ centile 21, 90ᵉ centile 39, au plus 53 ; soit 15.1 tours de table en moyenne.

| Carte | Parties | Tours en moyenne | Victoires à gauche % |
|---|---|---|---|
| valley | 23 | 30 | 95.7 |
| coast | 23 | 29 | 0 |
| holyLand | 22 | 33 | 95.5 |
| pass | 22 | 29 | 13.6 |

## Armes

| Arme | Tirs | Dégâts | Dégâts par tir | Morts | dont noyés |
|---|---|---|---|---|---|
| bow | 875 | 7313 | 8.4 | 75 | 10 |
| sling | 378 | 6051 | 16 | 51 | 12 |
| crossbow | 268 | 9171 | 34.2 | 57 | 6 |
| greekFire | 253 | 3942 | 15.6 | 34 | 4 |
| miracle | 108 | 0 | 0 | 0 | 0 |
| beehive | 70 | 1287 | 18.4 | 43 | 0 |
| falcon | 67 | 2752 | 41.1 | 15 | 5 |
| grapple | 63 | 0 | 0 | 0 | 0 |
| trebuchet | 56 | 1080 | 19.3 | 15 | 4 |
| banner | 41 | 0 | 0 | 0 | 0 |
| greatTrebuchet | 40 | 1925 | 48.1 | 6 | 0 |
| ballista | 33 | 1201 | 36.4 | 5 | 0 |
| pitchPot | 27 | 583 | 21.6 | 4 | 1 |
| arrowRain | 17 | 413 | 24.3 | 6 | 0 |
| flamingPig | 4 | 109 | 27.3 | 2 | 1 |
| catapult | 3 | 85 | 28.3 | 1 | 1 |
| fireArrow | 2 | 40 | 20 | 0 | 0 |
| scorpion | 1 | 60 | 60 | 0 | 0 |
| sword | 1 | 50 | 50 | 1 | 0 |

## Part des morts (BACKLOG 8.5 : aucune arme au-dessus de 30 % des morts par les armes)

471 morts, dont 315 par les armes (66.9 %). Une arme compte les morts de son tir : ses coups, et la noyade de ceux qu’elle jette à l’eau ; les morsures du dragon, l’eau qui monte au Déluge et la fin du tour n’en sont pas. Intervalle de confiance à 95 %, regroupé par partie.

| Arme | % des morts par les armes | % de toutes les morts |
|---|---|---|
| bow | 23.8 ± 5 | 15.9 ± 3.3 |
| crossbow | 18.1 ± 3.8 | 12.1 ± 2.7 |
| sling | 16.2 ± 4.1 | 10.8 ± 2.7 |
| beehive | 13.7 ± 2.8 | 9.1 ± 2.1 |
| greekFire | 10.8 ± 4.2 | 7.2 ± 2.9 |
| falcon | 4.8 ± 2.2 | 3.2 ± 1.5 |
| trebuchet | 4.8 ± 2.3 | 3.2 ± 1.5 |
| arrowRain | 1.9 ± 1.5 | 1.3 ± 1 |
| greatTrebuchet | 1.9 ± 1.7 | 1.3 ± 1.2 |
| ballista | 1.6 ± 1.6 | 1.1 ± 1.1 |
| pitchPot | 1.3 ± 1.2 | 0.8 ± 0.8 |
| flamingPig | 0.6 ± 0.9 | 0.4 ± 0.6 |
| sword | 0.3 ± 0.6 | 0.2 ± 0.4 |
| catapult | 0.3 ± 0.6 | 0.2 ± 0.4 |

Causes de mort : bow 75, crossbow 57, sling 51, drowned 45, burn 44, beehive 43, dragon 39, greekFire 34, flames 19, falcon 15, trebuchet 15, arrowRain 6, greatTrebuchet 6, ballista 5, fall 4, pitchPot 4, beast 4, flamingPig 2, sword 1, catapult 1, other 1

Hors des armes : `burn` le parchemin qui brûle, `drowned` l’eau sans tir (le Déluge qui monte), `dragon` ses morsures, `flames` les flammes au sol hors du tir qui les a posées, `beast` les bêtes, `lightning` la foudre, `fall` et `outOfMap` les chutes hors tir, `other` le reste.

| Cause | Morts | % |
|---|---|---|
| Armes | 315 | 66.9 |
| burn | 44 | 9.3 |
| drowned | 45 | 9.6 |
| dragon | 39 | 8.3 |
| flames | 19 | 4 |
| beast | 4 | 0.8 |
| lightning | 0 | 0 |
| fall | 4 | 0.8 |
| outOfMap | 0 | 0 |
| kingFell | 0 | 0 |
| other | 1 | 0.2 |

## Classes

| Classe | Combattants | Survie % | Dégâts par tour joué | Morts infligées par combattant | Dégâts subis par combattant | Tir ami par tour |
|---|---|---|---|---|---|---|
| archer | 180 | 41.1 | 8.1 | 0.27 | 67 | 0.8 |
| cleric | 180 | 31.7 | 21.7 | 0.96 | 86 | 0.4 |
| knight | 180 | 24.4 | 5.9 | 0.3 | 91 | 1.3 |
| slinger | 180 | 41.1 | 16.3 | 0.68 | 67 | 0.5 |
