# Medievers — état de session

## État courant
- **Lot 1 (M1, moteur headless) terminé**, gate M1 PASS ([rapport](reports/gates/2026-10-24-M1.md)).
- **Lot 2 (M2, greybox)** : toutes les tâches 2.1 à 2.9 sont codées. 2.6 vient d'être livrée : pad tactile (DOM, en bas à gauche), pincement pour zoomer, double tap pour recentrer. S'y ajoutent la pause sur Échap (menu Reprendre / Recommencer / Aide / Réglages ; le temps s'arrête aussi pendant l'aide et les réglages) et le demi-tour sur place (T ou ⇄, commande `aim` existante, aucun changement du sim). Reste la gate M2.
- **Habillage provisoire « manuscrit »** à la demande de l'utilisateur, en attendant la charte finale : polices embarquées (UnifrakturMaguntia, IM Fell), panneaux en vélin à filet d'or, HUD en DOM (`src/ui/hud.ts`), fond diapré, terrain cerné d'encre avec herbe et strates ondulées, figurines provisoires, auréole et flèche sur l'unité active, éclats d'explosion.
- **Humour à la Monty Python** (demande de l'utilisateur) : annonces de tour, répliques sur tir, blessure, tir ami, mort, tir raté, et onomatopées médiévales (`src/ui/commentary.ts`, textes `quip.*`, `boom.*`, `whack.*` dans `fr.json`). Ce sont des pastiches, pas des citations de films (droits d'auteur), règle notée au GDD §1.

## À reprendre en premier
1. **Playtest de l'utilisateur** sur l'habillage et le ton, puis `/milestone-gate M2`. Les CA 2.4 « tactile » et 2.6 « tablette réelle » resteront NOT ASSESSED — needs human.
2. **Lot 3 (M3, règles complètes)**, en commençant par 3.1 : classes et talents dans `content/classes.ts` (la fiche affiche « sans classe » d'ici là).
3. **À chaque mécanique livrée** : manuel (`docs/manual/manuel.md` + `pnpm run manual`), champs de réglage (`tuningGroups`) et GDD dans le même commit.

## Dettes connues / à ne pas refaire
- **Mode navigateur de Vitest** : Firefox y plante sur ce poste (« page crashed »). Le déterminisme navigateur passe donc par `tools/browser-determinism.ts` (Playwright direct, Vite en mode serveur). Ne pas y revenir.
- **Coutures entre tuiles du terrain** : supprimées en combinant `antialiasGL: false` (`src/app/main.ts`), `CLAMP_TO_EDGE` et `NEAREST` sur les tuiles (`src/render/terrain-layer.ts`). Le filtre seul ne suffisait pas. Contrepartie : les Graphics ne sont plus antialiasés (bords des capsules un peu crénelés).
- **Touches** : les appuis courts sont perdus avec `JustDown` quand l'appui et le relâchement tombent dans la même frame. Toutes les touches passent par des événements `on('down')` mémorisés : garder ce schéma.
- **Pointeur** : avec la caméra HUD, `pointer.worldX` est faux. Utiliser `cameras.main.getWorldPoint`.
- **TypeScript 6.0.3, pas 7** : typescript-eslint exige une version inférieure à 6.1. Imports relatifs avec `.ts` et `erasableSyntaxOnly` (pas de propriétés de paramètre dans les constructeurs) : Node exécute `src/` et `tools/` directement.
- **pnpm** : le global virtual store est activé parce que le projet est sous OneDrive. Corepack échoue en EPERM : pnpm 12 est installé via `npm i -g`. Les « agent skills » de Phaser attendent `pnpm approve`, non approuvés : la décision revient à l'utilisateur.
- **Valeurs provisoires** (sauts, projection 40/HP, vent 2/point, vitesses des armes) : l'utilisateur les réglera lui-même via ⚙ Réglages quand le jeu sera plus complet. Ne pas les retoucher de notre côté.
- **UI en DOM** au-dessus du canvas (`src/ui/overlay.ts`) : les boutons ont `tabIndex=-1` et `preventDefault` sur `mousedown`, sinon Espace et les flèches activent les boutons au lieu du jeu. Les champs du panneau stoppent la propagation de `keydown`.
- **Commits** : sans ligne « Co-Authored-By » (préférence de l'utilisateur, historique réécrit).
- **Navigateur Playwright du MCP** : le rAF y tourne à ~1 Hz (fenêtre en arrière-plan), le jeu semble figé. Ce n'est pas un problème de perf (≈ 1,3 ms par frame) : pour tester, avancer à la main avec `window.medievers.step(performance.now(), 1000 / 60)` et piloter `scene.input_.ui`.
- **Tablette 4:3** : `Scale.FIT` en 16:9 laisse des bandes et rapetisse le monde ; le HUD DOM, lui, occupe tout l'écran. À revoir avec l'écran de jeu final (M8), pas avant.

## État git
Branche `main`. Le lot « 2.6 + pause + habillage + commentaires » est commité localement, non poussé.
