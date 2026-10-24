# Medievers — état de session

## État courant
- **Lot 1 (M1, moteur headless) terminé**, gate M1 PASS ([rapport](reports/gates/2026-10-24-M1.md)). Les replays de référence donnent le même hash dans Node, Chromium, Firefox et WebKit (`pnpm run test:browser`).
- **Lot 2 (M2, greybox) jouable en hotseat** : `pnpm run dev`, puis http://localhost:5173 (ou VS Code « Simple Browser: Show »). Sont faites les tâches 2.1 à 2.5, 2.7, 2.8 (arc, fronde, pot) et 2.9 (2 maisons de 3 combattants sur `greybox-valley`). Reste : 2.6 (pad tactile, pincement, test sur tablette réelle), pause sur Échap, puis gate M2.
- **Demandes de l'utilisateur livrées** :
  - toutes les valeurs réglables sont des paramètres de partie (`MatchRules`) et voyagent dans les logs. Le panneau **⚙ Réglages** (`src/ui/game-ui.ts`, modèle testé dans `src/ui/tuning-model.ts`) les modifie en jeu, les mémorise en `localStorage` et relance la partie ;
  - la barre d'actions à la souris (marcher, sauter, arsenal, mèche, tirer, passer, aide) ;
  - la fiche de personnage au clic (caractéristiques, état, rappel des règles, arme en main).
- Le manuel PDF (`pnpm run manual`) est à jour pour le lot 2 et doit suivre chaque mécanique livrée (cf. mémoire).

## À reprendre en premier
1. **Finir M2** :
   - tâche 2.6 : pad tactile (la barre DOM sert déjà au doigt) et pincement pour zoomer dans `src/input/phaser-local-input.ts` ;
   - pause sur Échap ;
   - puis `/milestone-gate M2`. Les CA 2.4 « tactile » et 2.6 « tablette réelle » resteront NOT ASSESSED — needs human.
2. **Lot 3 (M3, règles complètes)**, en commençant par 3.1 : classes et talents dans `content/classes.ts`. La fiche affiche « sans classe » d'ici là (`card.noClass`). Puis eau et Déluge (3.2), reliquaires (3.3), barils et flammes (3.4).
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

## État git
Branche `main`, à jour avec `origin/main` (https://github.com/vynarim/Medievers), aucune modification non commitée, aucun stash. Dernier commit : `0a2e916 docs(reports): add M1 gate report (PASS)`.
