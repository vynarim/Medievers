# Étude E2 — Les règles de Medievers face à Worms et Worms Armageddon

*2026-10-24. Passe de cohérence sur ce qui est programmé aujourd'hui (pas sur ce qui est seulement prévu dans le GDD), comparée aux règles de Worms (1995) et de Worms Armageddon (1999), schéma « Standard ».*

## 1. Ce qui se passe dans un tour aujourd'hui

| Étape | Medievers (code actuel) | Worms Armageddon (Standard) |
|---|---|---|
| Qui joue | Les maisons alternent. Dans la maison, **libre choix** du combattant tant qu'il n'a ni bougé ni tiré (clic, nom ou ⇄) | Les équipes alternent ; les vers tournent **dans l'ordre**. Choisir son ver est un outil (« Worm Select ») ou une option du schéma |
| Transition | 2 s, caméra et vent | Idem, le temps du tour ne court pas encore |
| Temps de tour | 45 s | 45 s |
| Déplacement | **Soit** marche de 280 px, **soit** un saut (de côté ou vertical), une seule fois | Marche et sauts **illimités** dans le temps du tour ; saut avant, saut arrière (salto), corde ninja, etc. |
| Tir | Un tir. Le tour **continue** ensuite avec tout le temps restant pour les déplacements non utilisés | Un tir (deux pour le fusil) ; ensuite **temps de repli fixe** (3 s, réglable de 0 à 9 s) |
| Touché pendant son tour | Fin immédiate du tour (dégâts de chute compris) | Idem |
| Résolution | Attente de l'arrêt complet, puis morts constatées, puis 2 s de pause | Idem ; les PV perdus défilent sur les barres à la fin du tour |
| Mort | Une stèle | Le ver **explose** (petite explosion qui blesse ses voisins), puis une tombe |
| Fin du tour | Rien de plus pour l'instant ; parfois une cuisine de campagne | Chute de caisses (armes, soins, outils) ; plus tard la mort subite |
| Fin de partie | Dernière maison debout | Idem ; mort subite (eau qui monte, PV à 1) après N minutes |

## 2. Incohérences et frictions relevées

1. **Changer de combattant semblait ne pas marcher.** Dans une partie neuve, le changement fonctionne (vérifié dans le navigateur). Deux causes rendent le refus invisible :
   - une partie **reprise** depuis une sauvegarde faite avant l'arrivée du libre choix garde ses anciennes règles : elle tourne en rotation imposée, et le clic ne fait rien ;
   - dès que le combattant a bougé d'un pixel (une flèche du clavier pour se retourner suffit), le changement est refusé, sans message.
   *Corrigé le 2026-10-24* : bouton ⇄ Combattant grisé quand c'est trop tard, clic possible sur le nom, et fiche qui dit « la maison a déjà bougé ou tiré ce tour ».
2. **Se retourner coûte le saut.** Appuyer sur ← pour regarder à gauche fait marcher d'un pas : la marche est entamée, donc le saut est perdu pour le tour. Worms n'a pas ce problème (pas de budget). Proposition : le premier appui dans l'autre sens retourne le combattant sans le déplacer.
3. **Le « tout ou rien » marche / saut est sévère.** Un pas de travers interdit tout saut. Proposition : une seule réserve de souffle, où un saut coûte une part fixe (par exemple la moitié) : on peut marcher un peu puis sauter.
4. **Après le tir, tout le temps restant reste disponible.** Tirer à la 5ᵉ seconde laisse 40 s pour aller se cacher. Dans Worms, le repli fixe (3 s) oblige à choisir sa position *avant* de tirer : c'est une grande partie de la tension. Proposition : repli = le plus petit du temps restant et de 5 s (réglable).
5. **Libre choix et rythme.** Avec le libre choix permanent, le combattant le mieux placé peut jouer tous les tours ; les autres restent immobiles, ce qui fige la carte et rend la partie moins vivante. C'est un choix stratégique voulu ; si le playtest le confirme, Worms Armageddon offre deux réglages possibles : rotation par défaut avec un nombre limité de « changements de combattant » par partie, ou interdiction de jouer le même deux tours de suite.
6. **Arsenal trop court et sans rareté.** Trois armes, munitions illimitées : l'arc (35 dégâts, tendu, précis) domine, et rien ne pousse à prendre des risques. Dans Worms, la rareté (munitions limitées, caisses, armes « retardées » qui n'arrivent qu'après quelques tours) crée les décisions.
7. **Pas de fin forcée.** Sans Déluge (3.2), une partie défensive peut durer indéfiniment ; la cuisine de campagne et le libre choix encouragent même à temporiser.

## 3. Ce qui rend Worms vivant, et ce qui manque ici

| Ressort de Worms | Medievers aujourd'hui | Piste |
|---|---|---|
| **Le son** : voix des vers, cris, explosions, musique | Aucun son | Le plus gros manque. Grommelots médiévaux (« Pardiou ! », « Hélas ! »), bruitages d'onomatopées, cloche de fin de tour |
| **Réactions des personnages** : ils regardent le projectile, grimacent, fanfaronnent, dansent à la victoire | Figurines figées | Animations simples (respiration, tête qui suit le tir, chute comique, prière avant un tir risqué) |
| **Réactions en chaîne** : barils, mines, vers qui explosent en mourant | Rien | Barils de poix (3.4), chausse-trapes (4.7), « dernier soupir » : petite explosion à la mort |
| **Caisses** à chaque tour, avec des armes rares et absurdes (mouton, sainte grenade) | Seulement la cuisine | Reliquaires (3.3), avec des armes burlesques réservées aux reliquaires (cochon enflammé, ruche, Sainte Relique explosive) |
| **L'eau** : envoyer l'ennemi au fond, la vraie mise à mort | Le bas de la carte tue, mais l'eau n'est pas mise en scène | Eau visible et éclaboussures (3.2), commentaire dédié |
| **Mobilité** : sauts, salto, corde ninja, téléportation | Une marche ou un saut | Grappin (4.5), échelle (4.6), réserve de souffle partagée (point 3) |
| **Bilan du tour** : les barres de PV fondent après les tirs | Les chiffres de dégâts s'affichent sur le coup | Bilan des PV en fin de tour, barres qui descendent |

## 4. Recommandations, dans l'ordre

1. **Repli limité après le tir** (point 4) et **demi-tour gratuit** (point 2) : quelques lignes, gros effet sur la tension du tour.
2. **Son** : un premier lot de bruitages et de grommelots (ASSETS, audio).
3. **Reliquaires + munitions limitées + 2 ou 3 armes de plus** (3.3, 4.1) : c'est la variété qui manque le plus.
4. **Barils et « dernier soupir »** (3.4) : les réactions en chaîne font les meilleurs moments de Worms.
5. **Déluge** (3.2) pour que toute partie se termine.
6. **Animations de réaction** des combattants.
7. Revoir en playtest la **réserve de souffle partagée** (point 3) et l'éventuelle limite du libre choix (point 5).

Rien de tout cela ne remet en cause les décisions actées : ce sont des réglages et des ajouts à arbitrer par l'utilisateur.
