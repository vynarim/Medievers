# Medievers — état de session

## État courant
- **M1 terminé** (gate PASS). **M2 : gate du 2026-10-24 = NOT ASSESSED** ([rapport](reports/gates/2026-10-24-M2.md)) : tous les CA sont verts sauf deux qui attendent l'utilisateur, 60 fps mesurés 10 min à l'écran (2.1) et une tablette réelle (2.6).
- Livré aujourd'hui sur retours de playtest (tout est poussé) : habillage « manuscrit » provisoire (polices embarquées, panneaux vélin, décor en parallaxe avec château, fermes, moulins et bêtes), humour Monty Python (annonces, répliques, onomatopées, pastiches seulement), choix libre du combattant à chaque tour, déplacement par tour (marche de 280 px **ou** un saut), tir qui ne termine plus le tour, pause sur Échap, tutoriel illustré dans Aide, sauvegarde automatique et reprise, barre d'action unique et centrée avec actions grisées, F1 avec masque brut.
- Livré ensuite (2026-10-24, soir) : interface qui rapetisse sur petit écran, pad ↶ ◀ ↑ ▶ ↷, bouton ⇄ Combattant et clic sur le nom, plein écran, bouton ◎ seulement hors vue par défaut, vue par défaut qui cadre tous les combattants, oiseaux / dragon / arc-en-ciel, réglages en onglets, **3.7 usure du terrain** (replay `wall-arrows`), **3.11 cuisine de campagne** (replay `field-kitchen`). Étude [règles face à Worms](etudes/regles-vs-worms.md) : recommandations à arbitrer par l'utilisateur.
- Livré ensuite (2026-10-24, nuit) : repli de 5 s au plus et demi-tour gratuit, pas deux tours de suite pour le même combattant, combattants par maison (4 par défaut), parchemin qui brûle aux deux bouts, barils de poudre, arbalète, pot de poix, masse d'armes, reliquaires, munitions limitées, **3.12 bêtes des marges**, **4.10 mèche en tours**, placement des armées à tour de rôle, première passe graphique « Maciejowski » (fond d'or, sol en marches, chevaliers, phylactères). Le son est à planifier avec la musique (décision de l'utilisateur). Les tests partent sans placement via `tests/rules-fixture.ts`.
- Planifié dans le GDD et le BACKLOG (décidé avec l'utilisateur, pas encore programmé) : décors destructibles à points de vie (3.7, 3.8), cuisine de campagne (3.11), lièvres et escargots (3.12), machines de siège (4.9), mèche du pot en tours (4.10), escalade au grappin (4.5), cartes de grandes batailles (7.3), étude vue isométrique E1 ([étude](etudes/vue-isometrique.md), recommandation : garder la 2D de profil).

## À reprendre en premier
1. **Clore M2** : quand l'utilisateur aura fait les deux vérifications humaines du rapport, consigner le résultat et passer la gate à PASS.
2. **Lot 3 (M3)** : 3.7, 3.9, 3.10, 3.11, 3.13 et 3.14 sont faits. Restent 3.1 classes et passifs, 3.2 Déluge, 3.3 reliquaires, 3.4 barils, 3.5, 3.6, 3.8, 3.12, dans l'ordre que l'utilisateur choisira ; voir aussi les recommandations de l'étude E2 (repli limité après le tir, demi-tour gratuit).
3. **À chaque mécanique livrée** : manuel + `pnpm run manual`, champs de réglage, GDD, et commit + push automatique (préférence de l'utilisateur).

## Dettes connues / à ne pas refaire
- **Mode navigateur de Vitest** : Firefox y plante sur ce poste (« page crashed »). Le déterminisme navigateur passe donc par `tools/browser-determinism.ts` (Playwright direct, Vite en mode serveur). Ne pas y revenir.
- **Coutures entre tuiles du terrain** : supprimées en combinant `antialiasGL: false` (`src/app/main.ts`), `CLAMP_TO_EDGE` et `NEAREST` sur les tuiles (`src/render/terrain-layer.ts`). Le filtre seul ne suffisait pas. Contrepartie : les Graphics ne sont plus antialiasés (bords des capsules un peu crénelés).
- **Touches** : les appuis courts sont perdus avec `JustDown` quand l'appui et le relâchement tombent dans la même frame. Toutes les touches passent par des événements `on('down')` mémorisés : garder ce schéma.
- **Pointeur** : avec la caméra HUD, `pointer.worldX` est faux. Utiliser `cameras.main.getWorldPoint`.
- **TypeScript 6.0.3, pas 7** : typescript-eslint exige une version inférieure à 6.1. Imports relatifs avec `.ts` et `erasableSyntaxOnly` (pas de propriétés de paramètre dans les constructeurs) : Node exécute `src/` et `tools/` directement.
- **pnpm** : le global virtual store est activé parce que le projet est sous OneDrive. Corepack échoue en EPERM : pnpm 12 est installé via `npm i -g`. Les « agent skills » de Phaser attendent `pnpm approve`, non approuvés : la décision revient à l'utilisateur.
- **Valeurs provisoires** (projection 40/HP, vent 2/point, vitesses des armes) : l'utilisateur les réglera lui-même via ⚙ Réglages. Exception : marche 280 px et saut long ≈ 420 px, fixés par l'utilisateur le 2026-10-24.
- **Nouvelles règles = champs optionnels** de `MatchRules` (`settleTicks`, `moveAfterShot`, `freeSelect`, `moveBudget`, `slopeTakeoff`) : absents des logs anciens, ils gardent leurs hashes de référence. Garder ce schéma tant que les replays de référence ne sont pas régénérés avec accord.
- **Sondes navigateur** : une fenêtre Chromium visible mais masquée tombe à 1 image/s ; lancer les sondes fonctionnelles sans tête, et la mesure de fps seulement à l'écran, par un humain.
- **Sauvegarde** : `localStorage.clear()` puis rechargement ne suffit pas à repartir de zéro, car `pagehide` réécrit la sauvegarde ; retirer la clé `medievers.save.v1` avant de recharger, ou utiliser « Recommencer la partie ».
- **UI en DOM** au-dessus du canvas (`src/ui/overlay.ts`) : les boutons ont `tabIndex=-1` et `preventDefault` sur `mousedown`, sinon Espace et les flèches activent les boutons au lieu du jeu. Les champs du panneau stoppent la propagation de `keydown`.
- **Commits** : sans ligne « Co-Authored-By » (préférence de l'utilisateur, historique réécrit).
- **Navigateur Playwright du MCP** : le rAF y tourne à ~1 Hz (fenêtre en arrière-plan), le jeu semble figé. Ce n'est pas un problème de perf (≈ 1,3 ms par frame) : pour tester, avancer à la main avec `window.medievers.step(performance.now(), 1000 / 60)` et piloter `scene.input_.ui`.
- **Tablette 4:3** : `Scale.FIT` en 16:9 laisse des bandes et rapetisse le monde ; le HUD DOM, lui, occupe tout l'écran. À revoir avec l'écran de jeu final (M8), pas avant.

## État git
Branche `main`, à jour avec `origin/main` après le commit du rapport de gate M2.
