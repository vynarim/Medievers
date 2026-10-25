# Passe UX : iconographie et libellés de l'interface (2026-10-25)

Analyse de tous les boutons et menus du jeu sur PC (1920 × 1080), tablette en paysage (1180 × 820) et smartphone en portrait (390 × 844), d'après le code (`src/ui/`) et les captures de la session. Rien n'est encore modifié : ce rapport propose, pèse et ordonne.

## 1. Constats

### 1.1 La barre d'actions en partie

| Bouton | Libellé actuel | Problème |
|---|---|---|
| Saut long | `↶` `↷` | Ce sont les icônes universelles d'**annuler / rétablir**. Un joueur lit « undo », pas « saut » |
| Marcher | `◀` `▶` | Clair. Sur iOS, ces caractères s'affichent souvent en **emoji colorés** (▶️) : rendu imprévisible selon l'appareil |
| Saut haut / échelle | `↑` `↓` | Clair, mais le même bouton fait « saut haut » ou « grimper l'échelle » sans que rien ne change à l'écran |
| Corde | « Grimper » / « Descendre » | Seul texte du pavé de déplacement ; il apparaît et disparaît **au milieu** du pavé, ce qui décale ▶ et ↷ sous le doigt |
| Arsenal | « Arsenal » + dessin de l'arme | Bon principe (l'arme en main est visible). Le mot « Arsenal » coûte de la place sans rien apprendre de plus que le dessin |
| Viser | « ⟳ Viser » | Correct, mais « maintenir pour tourner » ne se devine pas |
| Tirer | « Tirer (maintenir) », « Bâtir (ou cliquer) », « Appeler (ou cliquer) » | **Mode d'emploi dans le libellé** : long, et répété à chaque tour alors qu'il ne sert qu'une fois |
| Jauge de puissance | panneau séparé au-dessus de la barre | Sur téléphone, un panneau de plus entre le terrain et la barre |
| Mèche | « Mèche (tours) » + 1 2 3 | Prend **une ligne entière** sur téléphone pour un réglage d'une seule arme |
| Changer de combattant | « ⇄ Combattant » | Correct |
| Fin du tour | « Passer » / « Fin du tour » | Deux libellés pour la même place, selon la phase ; correct |

Sur téléphone, la barre fait **trois lignes, environ 160 px**, soit près de 20 % de l'écran, et c'est elle qui décide de la hauteur du champ de bataille.

### 1.2 Les boutons système

`◎` (vue par défaut), `?`, `⚙`, `☰ Pause`, `⤢` (plein écran). Les conventions sont respectées (`?`, `⚙`, `☰`). `◎` et `⤢` sont moins lisibles, et tous dépendent de la police du système : `⤢` et `◎` manquent dans certaines polices Android et tombent sur une police de remplacement.

### 1.3 Les écrans de menus

- **Titre** : quatre boutons texte, clairs. Rien à changer.
- **Préparation** :
  - le `−` / `+` des combattants et le `−` rouge de la maison utilisent **le même signe pour deux choses** (retirer un combattant, retirer une maison) ;
  - « Régicide : non » est un interrupteur déguisé en bouton : on ne voit pas que c'est cliquable avant d'essayer ;
  - « Tour : 45 s » change de valeur à chaque clic, sans l'indiquer.
- **Pause** : « ? Aide » et « ⚙ Réglages » ont une icône, les autres non (« Reprendre », « Recommencer la partie », « Nouvelle partie… », « Écran titre »). Le mélange se voit.
- **Fin de partie** : « Contempler le champ » est joli mais flou (cela veut dire : fermer la tapisserie et regarder le terrain).
- **Replay** : « ⏸ Pause », « ⟲ Depuis le début », « ✕ Quitter » : icône et texte, bien, mais `⏸` s'affiche en emoji sur iOS.

### 1.4 Le tactile n'a pas d'infobulles

Toutes les explications des boutons vivent dans l'attribut `title` (« Saut long vers la gauche, environ 15 largeurs… »). Sur téléphone et tablette, **ces infobulles n'existent pas**. Passer des boutons en icône seule sans rien d'autre retirerait la seule explication disponible.

## 2. Principes proposés

1. **Une icône dessinée, pas un caractère Unicode.** Un petit jeu d'icônes SVG à l'encre, dans le style des dessins d'armes de l'arsenal (`weapon-art.ts`) : même rendu sur tous les appareils, pas d'emoji iOS, et cohérent avec la direction artistique.
2. **Selon l'écran** :
   - PC et tablette : icône **et** libellé court, parce que la place existe et que le libellé fait découvrir ;
   - téléphone en portrait : **icône seule** pour les gestes fréquents (déplacements, visée, tir, changer de combattant), texte gardé pour les gestes rares ou sans retour (quitter, recommencer).
3. **Pas de mode d'emploi dans les libellés.** « (maintenir) », « (ou cliquer) » vont dans la ligne d'aide du panneau d'arme, qui existe déjà (`hud.hint.*`), et dans le tutoriel. Le bouton dit l'action : « Tirer », « Bâtir », « Appeler ».
4. **Un appui long explique.** Sur écran tactile, un appui long sur un bouton ouvre sa bulle d'explication (la même que les « ? » de l'écran de préparation). C'est ce qui rend les icônes seules acceptables sur téléphone.
5. **Un signe = un sens.** `−` retire un combattant ; une maison se retire autrement.

## 3. Propositions, avec le pour et le contre

### Lot A — Jeu d'icônes dessinées et appui long (fondation)

Icônes SVG pour : marcher, sauter long (un arc de saut, pas une flèche d'annulation), sauter haut, échelle, corde, viser, tirer, changer de combattant, fin du tour, vue par défaut, plein écran, aide, réglages, menu, et lecture / pause / début / quitter du replay. Plus l'appui long sur tactile.

- **Pour** : rendu identique partout, fin du piège « annuler / rétablir », style manuscrit cohérent. C'est aussi la condition des lots B et C.
- **Contre** : une quinzaine de dessins à faire et à valider. Une icône bien dessinée reste moins explicite qu'un mot : d'où l'appui long et le libellé gardé sur PC.

### Lot B — Barre d'actions plus courte

- « Tirer (maintenir) » devient « Tirer » ; même chose pour Lancer, Bâtir, Appeler. La consigne part dans la ligne d'aide.
- Sur téléphone, la **jauge de puissance se remplit dans le bouton Tirer lui-même**, et le panneau d'arme au-dessus de la barre disparaît (le nom de l'arme reste sur le bouton Arsenal).
- « Arsenal » : le dessin de l'arme seul sur téléphone, le mot gardé sur PC.
- La mèche devient un bouton qui fait défiler 1 → 2 → 3 (« ⌛ 2 »), comme la durée du tour à l'écran de préparation.
- Le bouton corde (Grimper / Descendre) garde une place fixe, **à droite du pavé**, au lieu de s'insérer au milieu.

- **Pour** : sur téléphone, la barre passe de 3 lignes à 2 et le panneau d'arme disparaît, soit environ 100 px de champ de bataille gagnés. Les boutons ne bougent plus sous le doigt.
- **Contre** : un nouveau joueur qui tape sur « Tirer » au lieu de maintenir tire à puissance minimale. La jauge qui se remplit dans le bouton et la ligne d'aide le lui apprennent, mais plus tard qu'un libellé explicite. Pour la mèche : 2 appuis au lieu d'1 pour passer de 1 à 3.

### Lot C — Disposition « manette » sur téléphone

Pavé de déplacement en croix à gauche, sous le pouce gauche ; tir (gros bouton rond), visée, arsenal à droite, sous le pouce droit ; changer de combattant et fin du tour en petit au-dessus. C'est la convention des jeux mobiles (Worms en tête).

- **Pour** : les deux pouces jouent sans croiser, et le tir est le plus gros bouton, là où il doit être. Moins de hauteur encore.
- **Contre** : le plus gros changement de la liste. Une deuxième disposition à maintenir à côté de celle du PC. À valider sur un vrai téléphone avant de l'adopter.

### Lot D — Écran de préparation

- Combattants : chaque liste de classe porte un petit `✕` pour retirer **ce** combattant, et un emplacement en pointillé « + » ajoute le suivant. Le `−` / `+` disparaît, et le `−` rouge de la maison redevient le seul « retirer ».
- Régicide : un vrai interrupteur (case ou bascule ✓ / ✗) au lieu de « Régicide : non ».
- Durée du tour : « ⌛ 45 s » avec un petit chevron ▸ qui montre qu'un clic change la valeur.

- **Pour** : on retire le combattant qu'on veut, pas toujours le dernier. Les choix oui / non se lisent comme tels, sans ambiguïté sur les signes.
- **Contre** : un peu plus d'éléments par ligne de maison sur PC (la ligne reste sur une ligne jusqu'à 5 combattants).

### Lot E — Menus

- Pause : une icône devant chaque entrée (▶ Reprendre, ↻ Recommencer, ✚ Nouvelle partie, ⌂ Écran titre), en icônes dessinées du lot A.
- Fin de partie : « Contempler le champ » devient « Voir le champ de bataille ».
- Replay, sur téléphone : icônes seules.

- **Pour** : menus homogènes, lecture plus rapide.
- **Contre** : gain modeste. « Contempler » perd un peu de son ton.

### Ce que je ne changerais pas

- **Le titre et ses quatre boutons** : clairs, et c'est la vitrine.
- **« À la bataille ! », « Recommencer la partie », « Écran titre »** : gestes rares ou sans retour, que le texte rend sûrs.
- **Les noms d'armes dans l'arsenal** : le dessin aide, mais le nom fait partie de l'humour.

## 4. Ordre recommandé

1. **Lot A** : fondation, et fin du piège `↶ ↷`.
2. **Lot B** : le gain le plus visible sur téléphone.
3. **Lot D** : court, lève une vraie ambiguïté.
4. **Lot E** : rapide une fois le lot A fait.
5. **Lot C** : seulement après un essai sur un vrai téléphone, avec les lots A et B déjà en place, car il se juge en main.

## 5. Points à trancher par l'utilisateur

- Libellé gardé à côté des icônes sur PC et tablette (recommandé), ou icônes seules partout ?
- La jauge dans le bouton Tirer sur téléphone (recommandé), ou garder le panneau d'arme ?
- Lot C (disposition manette) : à prototyper maintenant, ou après un essai des lots A et B sur téléphone (recommandé) ?
- « Contempler le champ » : on garde le ton, ou on gagne en clarté ?
