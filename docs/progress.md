# Medievers — état de session

## État courant
- **Lot 1 (M1, moteur headless) terminé**, gate M1 PASS ([rapport](reports/gates/2026-10-24-M1.md)). Les replays de référence donnent le même hash dans Node, Chromium, Firefox et WebKit (`pnpm run test:browser`).
- **Lot 2 (M2, greybox) jouable en hotseat** : `pnpm run dev`, puis http://localhost:5173 (ou VS Code « Simple Browser: Show »). Sont faites les tâches 2.1 à 2.5, 2.7, 2.8 (arc, fronde, pot) et 2.9 (2 maisons de 3 combattants sur `greybox-valley`). Reste : 2.6 (pad tactile, pincement, test sur tablette réelle), pause sur Échap, puis gate M2.
- **Trois demandes de l'utilisateur pas encore commencées** (aucun code écrit) :
  1. **Tous les réglages deviennent des paramètres de partie**, ajustables en jeu. On réglera en jouant, plus tard.
  2. **Un ensemble d'actions à la souris** : barre d'actions (marcher, sauter, arsenal, mèche, tir, passer).
  3. **Une fiche de personnage au clic** sur un combattant : caractéristiques et rappel des règles.
- Le manuel PDF (`pnpm run manual`) est à jour pour le lot 2 et doit suivre chaque mécanique livrée (cf. mémoire).

## À reprendre en premier
1. **Paramètres de partie.** Faire de `MatchRules` (`src/content/rules.ts`) le porteur de `unit`, `wind`, `explosion` et `weapons`, au lieu des imports directs de `UNIT_RULES`, `WIND_RULES`, `EXPLOSION_RULES` et `WEAPONS` (`src/sim/sim.ts`, `src/sim/weapons/weapons.ts`, `src/render/battle-scene.ts`, `src/input/local-controls.ts`). Les valeurs voyagent alors dans le log de partie et les replays restent exacts.
   - Les JSON de `tests/replays/` ne contiendront plus tous les champs : les réenregistrer avec `pnpm run replays:record --force`. Les valeurs étant inchangées, les hashes doivent rester `1f176e5e` et `f4410a9f`. S'ils changent, mettre `regen-hash: <raison>` dans le commit.
   - Ajouter ensuite un panneau « Réglages » (DOM, `src/ui/`) : champs en unités lisibles (px/tick plutôt que sub-px), sauvegarde en `localStorage` dans un try/catch, application au redémarrage de la partie (R).
2. **Souris et fiche de personnage** en DOM au-dessus du canvas (`src/ui/`). Boutons en `tabIndex=-1` et `preventDefault` sur `mousedown`, pour ne pas voler le clavier à Phaser.
   - Les intentions passent par de nouveaux champs de `RawInput` (`src/input/local-controls.ts`) : choix d'arme, saut avant ou arrière, mèche, passer le tour, marche et charge tenues.
   - Clic sans glisser sur un combattant (via `PhaserLocalInput.onUp`) → fiche : nom, maison, PV, état, arme active et ses statistiques, rappel marche, chute et dégâts. Les classes arrivent en M3 : afficher « sans classe » d'ici là.
3. **Finir M2** : tâche 2.6 (pad virtuel et pincement), pause sur Échap, puis `/milestone-gate M2`. Les CA 2.6 « tablette réelle » et 2.4 « tactile » resteront NOT ASSESSED — needs human.

## Dettes connues / à ne pas refaire
- **Mode navigateur de Vitest** : Firefox y plante sur ce poste (« page crashed »). Le déterminisme navigateur passe donc par `tools/browser-determinism.ts` (Playwright direct, Vite en mode serveur). Ne pas y revenir.
- **Coutures entre tuiles du terrain** : supprimées en combinant `antialiasGL: false` (`src/app/main.ts`), `CLAMP_TO_EDGE` et `NEAREST` sur les tuiles (`src/render/terrain-layer.ts`). Le filtre seul ne suffisait pas. Contrepartie : les Graphics ne sont plus antialiasés (bords des capsules un peu crénelés).
- **Touches** : les appuis courts sont perdus avec `JustDown` quand l'appui et le relâchement tombent dans la même frame. Toutes les touches passent par des événements `on('down')` mémorisés : garder ce schéma.
- **Pointeur** : avec la caméra HUD, `pointer.worldX` est faux. Utiliser `cameras.main.getWorldPoint`.
- **TypeScript 6.0.3, pas 7** : typescript-eslint exige une version inférieure à 6.1. Imports relatifs avec `.ts` et `erasableSyntaxOnly` (pas de propriétés de paramètre dans les constructeurs) : Node exécute `src/` et `tools/` directement.
- **pnpm** : le global virtual store est activé parce que le projet est sous OneDrive. Corepack échoue en EPERM : pnpm 12 est installé via `npm i -g`. Les « agent skills » de Phaser attendent `pnpm approve`, non approuvés : la décision revient à l'utilisateur.
- **Valeurs provisoires** (sauts, projection 40/HP, vent 2/point, vitesses des armes) : l'utilisateur veut les régler en jouant. Ne pas les retoucher avant le point 1.
- **Commits** : sans ligne « Co-Authored-By » (préférence de l'utilisateur, historique réécrit).

## État git
Branche `main`, à jour avec `origin/main` (https://github.com/vynarim/Medievers), aucune modification non commitée, aucun stash. Dernier commit : `0a2e916 docs(reports): add M1 gate report (PASS)`.
