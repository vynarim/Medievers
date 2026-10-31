# Batterie d’équilibrage : 85-trial-burn10-knight-random (essai : parchemin à 10 PV, abandonné)

150 parties IA contre IA (knight contre knight, combattants : random), cartes : valley, coast, holyLand, pass, 60 tours au plus ; 402 s sur 15 cœurs.

- Terminées : 100 · égalités : 50 · sans vainqueur au bout de 60 tours : 0
- Erreurs : 0 · replays divergents : 0 · combattants coincés : 0
- Tir ami : 2.5 % des dégâts infligés · réflexion de l'IA : 934 ms en moyenne, 2062 ms au 95ᵉ centile, 7486 ms au plus

## Victoires

| Niveau | Parties | Victoires | % |
|---|---|---|---|
| knight | 300 | 100 | 33.3 |

Côté gauche : 29.3 % · côté droit : 37.3 %

## Durée

Tours par partie : moyenne 40.5, médiane 40, 10ᵉ centile 34, 90ᵉ centile 48, au plus 54 ; soit 20.2 tours de table en moyenne.

| Carte | Parties | Tours en moyenne | Victoires à gauche % |
|---|---|---|---|
| valley | 38 | 42 | 26.3 |
| coast | 38 | 37 | 28.9 |
| holyLand | 37 | 45 | 32.4 |
| pass | 37 | 38 | 29.7 |

## Armes

| Arme | Tirs | Dégâts | Dégâts par tir | Morts | dont noyés |
|---|---|---|---|---|---|
| bow | 1568 | 17572 | 11.2 | 212 | 30 |
| crossbow | 908 | 22461 | 24.7 | 142 | 17 |
| sling | 763 | 16825 | 22.1 | 193 | 65 |
| grapple | 579 | 0 | 0 | 0 | 0 |
| greekFire | 510 | 9641 | 18.9 | 64 | 20 |
| falcon | 309 | 12810 | 41.5 | 6 | 0 |
| trebuchet | 305 | 7171 | 23.5 | 10 | 2 |
| miracle | 211 | 0 | 0 | 0 | 0 |
| ballista | 182 | 3612 | 19.8 | 23 | 3 |
| beehive | 175 | 3414 | 19.5 | 118 | 0 |
| greatTrebuchet | 161 | 5262 | 32.7 | 22 | 0 |
| arrowRain | 151 | 4529 | 30 | 52 | 0 |
| banner | 144 | 6 | 0 | 0 | 0 |
| pitchPot | 76 | 1417 | 18.6 | 24 | 15 |
| catapult | 51 | 1488 | 29.2 | 15 | 8 |
| shieldCharge | 37 | 1112 | 30.1 | 32 | 9 |
| mace | 32 | 1331 | 41.6 | 16 | 11 |
| fireArrow | 29 | 535 | 18.4 | 5 | 0 |
| scorpion | 9 | 165 | 18.3 | 3 | 1 |
| sword | 8 | 397 | 49.6 | 3 | 3 |
| ladder | 2 | 0 | 0 | 0 | 0 |

## Part des morts (BACKLOG 8.5 : aucune arme au-dessus de 30 % des morts par les armes)

1665 morts, dont 940 par les armes (56.5 %). Une arme compte les morts de son tir : ses coups, et la noyade de ceux qu’elle jette à l’eau ; les morsures du dragon, l’eau qui monte au Déluge et la fin du tour n’en sont pas. Intervalle de confiance à 95 %, regroupé par partie.

| Arme | % des morts par les armes | % de toutes les morts |
|---|---|---|
| bow | 22.6 ± 2.7 | 12.7 ± 1.6 |
| sling | 20.5 ± 2.7 | 11.6 ± 1.6 |
| crossbow | 15.1 ± 2 | 8.5 ± 1.2 |
| beehive | 12.6 ± 1.7 | 7.1 ± 1 |
| greekFire | 6.8 ± 1.8 | 3.8 ± 1 |
| arrowRain | 5.5 ± 1.2 | 3.1 ± 0.7 |
| shieldCharge | 3.4 ± 1.3 | 1.9 ± 0.7 |
| pitchPot | 2.6 ± 1.1 | 1.4 ± 0.6 |
| ballista | 2.4 ± 1.2 | 1.4 ± 0.7 |
| greatTrebuchet | 2.3 ± 1.2 | 1.3 ± 0.7 |
| mace | 1.7 ± 0.8 | 1 ± 0.5 |
| catapult | 1.6 ± 0.9 | 0.9 ± 0.5 |
| trebuchet | 1.1 ± 0.6 | 0.6 ± 0.4 |
| falcon | 0.6 ± 0.5 | 0.4 ± 0.3 |
| fireArrow | 0.5 ± 0.6 | 0.3 ± 0.4 |
| sword | 0.3 ± 0.4 | 0.2 ± 0.2 |
| scorpion | 0.3 ± 0.4 | 0.2 ± 0.2 |

Causes de mort : burn 266, drowned 261, bow 212, sling 193, dragon 161, crossbow 142, beehive 118, greekFire 64, arrowRain 52, shieldCharge 32, flames 27, pitchPot 24, ballista 23, greatTrebuchet 22, mace 16, catapult 15, trebuchet 10, falcon 6, fireArrow 5, other 3, scorpion 3, sword 3, beast 2, fall 2, crushed 1, lightning 1, burnt 1

## Classes

| Classe | Combattants | Survie % | Dégâts par tour joué | Morts infligées par combattant | Dégâts subis par combattant | Tir ami par tour |
|---|---|---|---|---|---|---|
| archer | 300 | 7 | 19.6 | 0.87 | 103 | 0.5 |
| cleric | 292 | 5.1 | 18.1 | 0.72 | 106 | 0.5 |
| king | 199 | 2 | 19.7 | 0.51 | 87 | 0.2 |
| knight | 401 | 11.2 | 18.7 | 1.01 | 103 | 0.5 |
| sapper | 311 | 7.4 | 18.6 | 0.87 | 105 | 0.5 |
| slinger | 297 | 9.1 | 17.2 | 0.74 | 94 | 0.4 |
