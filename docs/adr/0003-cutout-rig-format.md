# ADR 0003 — Format des rigs cutout (`rig.json`, `anim/*.json`)

- **Statut** : acceptée le 2026-10-31
- **Tâche** : BACKLOG M6 / 6.1
- **Décision** : format maison, en JSON, versionné (`medieverse.rig/1`, `medieverse.anim/1`), validé au chargement et par les tests ; runtime d'animation pur dans `src/render/rig/`, rendu Phaser par une image par pièce dans un conteneur.

## Contexte

TECH_SPEC §7 prévoit des personnages en pièces séparées (cutout) animées par keyframes, et laisse le choix entre un format maison et Spine / DragonBones. Le lot art (lot 9) démarre sur ce format : il doit être figé avant, et assez simple pour être écrit à la main ou par Claude Code. Jusqu'au lot 9, les pièces sont des placeholders dessinés par le code (ASSETS §2.1) ; déposer le PNG d'une clé doit suffire à remplacer le placeholder.

Contraintes : le rendu lit l'état de la sim et ne l'écrit jamais ; l'animation est cosmétique (flottants et temps réel permis, `src/render/` seulement) ; pas de régression perf (TECH_SPEC §9).

## Options

| Option | Pour | Contre |
|---|---|---|
| Spine | Éditeur mûr, runtime Phaser | Licence payante pour un usage commercial, éditeur propriétaire, format binaire ou JSON verbeux |
| DragonBones | Gratuit | Maintenance arrêtée, runtime Phaser 4 absent |
| **Format maison JSON** | Petit, lisible, diffable, validable par nos tests, piloté par Claude Code ; aucune dépendance | Pas d'éditeur visuel : on règle les poses par les chiffres et on vérifie dans le jeu |

## Décision

Format maison. Les fichiers vivent dans `src/content/rigs/<rig>/` : `rig.json` et `anim/<id>.json` (le nom du fichier est l'id de l'animation). Ils sont importés au build (`import.meta.glob`) et vérifiés au chargement (`src/render/rig/format.ts`) : un champ inconnu, un os inexistant, des clés dans le désordre arrêtent le jeu avec le chemin du champ fautif. Le détail du format est dans TECH_SPEC §7.1 et §7.2, la liste des pièces du Chevalier dans ASSETS §3.5.

Conventions figées :

- Unités : px du monde à ×1 (un combattant fait environ 88 px de haut). Une texture peut avoir n'importe quelle résolution : chaque pièce est affichée à sa taille déclarée (`size`).
- Repère : le rig regarde vers la droite, y vers le bas, origine entre les pieds, au sol. Regarder à gauche retourne toute la figure (`scaleX = −1`), jamais les données.
- Angles en degrés, positifs dans le sens horaire à l'écran.
- Une pièce a son pivot sur l'origine de son os et tourne avec lui. Les pièces se dessinent dans l'ordre du tableau `pieces`, du fond vers l'avant. L'ordre ne change pas pendant une animation (V1).
- Les valeurs d'une animation sont des écarts à la pose de repos : `rot`, `x`, `y` s'ajoutent, `sx`, `sy` multiplient.
- Teinte de maison : `tint: "primary" | "secondary"`, en multiplication (`setTint`). Les placeholders tintables sont blancs, donc exactement à la couleur de la maison ; les pièces finales en gris de 50 à 85 % (ASSETS §2) donneront une teinte un peu plus sombre, à régler au lot 9.
- Slots : une pièce peut être l'« attachement » d'un slot (`weapon` : `bow`, `stone`) ; une animation change l'attachement par paliers (lâcher de la pierre).
- Événements : `{ t, name }`, émis quand la tête de lecture passe `t` (à chaque tour d'une boucle). Ce sont des crochets cosmétiques (`step`, `release`, `dust`) : la sim décide seule de l'instant du tir, l'animation de tir démarre sur l'événement `shotFired` de la sim.
- Visée : `aim` lie des os à l'angle de visée, avec un poids.

Le choix de l'animation à partir de l'état de la sim (`src/render/rig/unit-anim.ts`) est hors format : il lit `grounded`, `knocked`, `climbing`, `alive`, le déplacement interpolé et la visée, et les événements `unitDamaged`, `crushed`, `shotFired`.

## Conséquences

- Le lot art produit des PNG aux clés de `rig.json` (`unit_knight_*`, `*_tint` pour les pièces de maison) et peut retoucher pivots, tailles et keyframes sans toucher au code. Une pose qui manque (P1 : `aim_crossbow`, `aim_sling`, `aim_melee`, `aim_pointer`) emprunte celle de l'arc ou du lancer, sans l'objet tenu ; déposer `anim/aim_sling.json` suffit à la remplacer.
- Pas d'éditeur : les poses se règlent dans le JSON. Si le lot art le réclame, un convertisseur depuis un outil externe pourra écrire ce même format ; le runtime ne change pas.
- Les échelles non uniformes d'un os parent ne se propagent pas proprement à ses enfants tournés (cisaillement ignoré) : garder `sx = sy` sur les os qui ont des enfants.
- Seul le Chevalier est riggé au 6.1 ; les cinq autres classes gardent leur dessin (`figures.ts`) jusqu'à leurs rigs (lot 9, ou plus tôt sur demande).
- Le format est versionné : un changement incompatible passe à `/2`, avec mise à jour de cet ADR.

## Avenant du 2026-10-31

Les cinq autres classes (Archer, Frondeur, Sapeur, Clerc, Roi) ont leur rig, sur le squelette du Chevalier : mêmes os, pièces propres (chaperon et carquois, fronde, tablier et pioche, aube, chasuble et crosse, manteau, col d'hermine et couronne). Plutôt que de copier treize animations par classe, `rig.json` gagne un champ optionnel `anims` : l'id du rig dont il joue les animations, vérifiées contre ses propres os. Une classe pourra plus tard avoir ses propres animations en retirant ce champ et en remplissant son dossier `anim/`.
