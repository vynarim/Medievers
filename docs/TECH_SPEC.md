# Medieverse — Spécification technique

## 1. Stack

| Couche | Choix | Remarque |
|---|---|---|
| Langage | TypeScript (strict, `noUncheckedIndexedAccess`) | |
| Build | Vite | Sortie statique, déployable sur n'importe quel hébergement |
| Rendu / input / audio / scènes | Phaser | **À figer en M0** : vérifier l'état de Phaser 3.x vs 4.x (stabilité, API WebGL/render textures, support tactile) avant de choisir. Ne pas supposer. |
| Tests | Vitest (unitaires + déterminisme), Playwright (smoke E2E, P1) | |
| Workers | Web Worker natif (`new Worker(new URL(...), {type:'module'})`) | IA et validation de cartes |
| En ligne | Firebase : Realtime Database, Authentication (anonyme), Hosting ; projet `videogames-06` | §8, ADR 0002 |
| Lint / format | ESLint + Prettier, règle custom interdisant les imports interdits dans `src/sim/` | |
| PWA | P1 : manifest + service worker (installation tablette, plein écran) | |

## 2. Architecture

```
        ┌────────────┐   GameCommand    ┌──────────────┐
 Local ─┤            │ ───────────────▶ │              │
 AI    ─┤ InputSource│                  │   sim/       │  state (lecture seule)
 Remote─┤            │                  │  (pur, det.) │ ─────────────────────▶ render/ + ui/
 Replay─┤            │                  │              │
        └────────────┘                  └──────────────┘
                                              ▲
                                    ai/ (Worker) clone l'état et simule en headless
```

### 2.1 Interfaces clés (indicatives)

```ts
// src/input/InputSource.ts
export interface InputSource {
  readonly kind: 'local' | 'ai' | 'remote' | 'replay';
  /** Called once per tick for the active team; returns commands to apply at this tick. */
  poll(tick: number, view: ReadonlySimView): GameCommand[];
  onTurnStart?(ctx: TurnContext): void;
  dispose(): void;
}

// src/sim/commands.ts
export type GameCommand =
  | { t: 'move'; dir: -1 | 0 | 1 }
  | { t: 'jump'; kind: 'forward' | 'back' }
  | { t: 'aim'; angle: number /* BAM 0..4095 */ }
  | { t: 'selectWeapon'; id: WeaponId }
  | { t: 'setFuse'; seconds: 1 | 2 | 3 | 4 | 5 }
  | { t: 'charge'; on: boolean }               // gauge mode
  | { t: 'fire'; power: number /* 0..1024 */ }  // drag mode or gauge release
  | { t: 'target'; x: number; y: number }       // off-map strikes, teleport, homing
  | { t: 'detonate' }                           // fire pig
  | { t: 'rope'; action: 'shoot' | 'release' | 'reel'; dir?: -1 | 1 }
  | { t: 'place'; x: number; y: number; rot: number } // stone wall, ladder
  | { t: 'skip' };

// Simulation API
export interface Sim {
  init(config: MatchConfig, seed: number, map: MapData): void;
  step(cmds: GameCommand[]): void;   // advance exactly one tick
  view(): ReadonlySimView;
  hash(): number;                    // 32-bit FNV-1a over canonical state
  snapshot(): SimSnapshot;           // structured clone for AI / rollback
  restore(s: SimSnapshot): void;
}
```

- `MatchConfig` : équipes, classes, schéma de règles, seed.
- Le **log de partie** est `{ version, config, seed, mapId, commands: Array<[tick, GameCommand]> }`. Il sert à la fois de replay, de fixture de test et de reprise d'une partie en ligne.

## 3. Déterminisme

| Règle | Implémentation |
|---|---|
| Pas fixe | 60 ticks/s. Accumulateur côté rendu, `sim.step()` appelé N fois par frame (max 5 pour éviter la spirale de rattrapage) |
| Entiers uniquement dans l'état | Positions et vitesses en sub-pixels `int32` (1 px = 256). Multiplications via `Math.imul`, ou contrôle du débordement en dev |
| Angles | BAM 12 bits (4096 = 360°). LUT `sin/cos` de 4096 entrées, en Q14, générée **au build** et figée dans le code (pas calculée à l'exécution) |
| Racine carrée | `isqrt` entière (méthode de Newton sur entiers) |
| Aléatoire | PRNG seedé (`sfc32` ou `mulberry32`) stocké dans l'état. Un seul flux de gameplay, et un flux séparé pour le cosmétique côté rendu |
| Ordre d'itération | Tableaux ordonnés par id ; jamais d'itération sur un `Set` ou une `Map` à ordre implicite issu d'insertions non déterministes |
| Temps | Exprimé en ticks. Aucune lecture d'horloge dans `sim/` |
| Hash | FNV-1a 32 bits sur la sérialisation canonique : unités, projectiles, PRNG, et hash incrémental du masque (somme XOR par chunk modifié) |
| Garde-fou | Règle ESLint `no-restricted-globals` / `no-restricted-properties` sur `src/sim/**` : `Math.random`, `Math.sin`, `Date`, `performance`, `window`, `document` |

**Test de déterminisme** : `tests/replays/*.json` contient des logs de référence et leur hash final attendu. Le CI rejoue tout en Node. En M9, le même rejeu est exécuté dans deux navigateurs différents (Chrome et Firefox, plus Safari si possible) pour comparer les hashes.

## 4. Terrain

### 4.1 Dimensions de référence
- Viewport logique : 1920 × 1080. Phaser met à l'échelle avec `Scale.FIT` et un letterbox enluminé.
- Hauteur d'une unité : environ 88 px logiques.
- Monde : jusqu'à **5120 × 2560 px** par carte.

### 4.2 Masque de collision
- `Uint8Array` de largeur × hauteur (13 Mo au maximum). Valeur par pixel = matériau :
  - `0` air
  - `1` terre (destructible)
  - `2` roche (indestructible)
  - `3` pierre bâtie (mur posé, destructible, résistance ×1,5)
  - `4` bois (destructible)
  - `5` échelle (praticable, non solide pour les projectiles)
  - `6` maçonnerie de fond (corps des tours, 2026-10-25 : dessinée, destructible, résistance ×1,5, ni les unités ni les projectiles ne s'y arrêtent)
- Le masque est découpé en **chunks de 256 × 256**, chacun avec un flag `dirty` et un hash.
- Le masque source est un PNG dont les couleurs sont fixes par matériau (table dans `content/materials.ts`). Il est converti en `Uint8Array` au chargement, avec un cache possible en `.bin` lors du build (P1).

### 4.3 Rendu du terrain
- **Point de vigilance** : une texture unique de 5120 × 2560 dépasse la limite `MAX_TEXTURE_SIZE` de certains GPU mobiles. On découpe donc la couche peinte en **tuiles de 512 × 512**, chacune étant une `CanvasTexture` ou une `RenderTexture` Phaser.
- Destruction :
  1. `sim` modifie le masque et émet `TerrainCarved { shape, x, y, r }` dans les événements du tick.
  2. `render` applique la même forme en `destination-out` sur les tuiles concernées.
  3. Il peint un liseré « vélin déchiré » (texture de bord brûlé ou ocre) en contour, via un pass `source-atop` avec un anneau de r à r+6 px.
- Pierres posées : sprite de pierre taillée tamponné sur la tuile, avec écriture du masque à 3.
- Le rendu ne relit jamais le masque pour décider de la physique. Il le lit en revanche pour l'affichage : après un creusement, il efface des tuiles exactement les pixels que le masque a passés à l'air, ce qui garantit l'alignement au pixel près.
- Tuiles en `CLAMP_TO_EDGE` et filtrage `NEAREST`, contexte WebGL créé sans antialiasing (`antialiasGL: false`) : sans cela, les bords des tuiles se mélangent et dessinent des lignes fines aux jointures (constaté au greybox, M2).

### 4.4 Couches de scène (du fond vers l'avant)
1. Fond or ou fond diapré (motif losangé), statique.
2. Décor architecturé lointain (parallaxe 0,3).
3. Décor intermédiaire (parallaxe 0,6).
4. Terrain peint (tuiles).
5. Objets de carte (barils, tentes).
6. Unités et projectiles.
7. Eau (shader ou sprite animé de vagues stylisées en spirales, à la manière du manuscrit).
8. VFX.
9. Cadre de page enluminé (marges, optionnel, masquable en jeu).
10. HUD.

## 5. Physique

### 5.1 Unités
- Hitbox : capsule verticale de 28 × 80 px, avec des points d'échantillonnage sur le masque (pieds ×3, flancs ×4, tête ×2).
- Marche : à chaque pas de 1 px, la marche cherche le sol jusqu'à 12 px au-dessus ou en dessous. Au-delà, l'unité bloque ou tombe.
- Chute : gravité de 0,35 px/tick², arrondie à 90 sub-px/tick² (0,3516), vitesse terminale de 14 px/tick.
- Échantillonnage : les pieds et les flancs partagent la colonne extérieure (±13 px), pour qu'une unité qui perd pied n'ait jamais un flanc encore au-dessus du rebord quitté. La pente maximale se mesure sur la colonne centrale : la montée sur 7 px ne doit pas dépasser la marche de 12 px (≈ 60°).
- Projection (explosion) : vélocité initiale, puis rebonds amortis (restitution 0,3) et friction au sol. L'unité « glisse » jusqu'à repos complet (vitesse < seuil pendant 10 ticks).
- La résolution de tour attend que **toutes** les entités soient au repos.

### 5.2 Projectiles
- Intégration d'Euler semi-implicite. **Sub-steps** de sorte que le déplacement par sous-pas soit ≤ 2 px, pour éviter le tunneling.
- Détection : échantillon du masque au point (ou au disque de rayon r pour les pots), et test cercle contre capsule pour les unités.
- Rebonds (pots, barils) : normale estimée par gradient local du masque, sur un voisinage 5 × 5.
- Vent : `ax += wind × windFactor(weapon)`.

### 5.3 Explosions
- Elles creusent un disque de rayon R (forme variable possible via un tampon de masque prédéfini).
- Dégâts linéaires selon la distance au centre de la hitbox : `dmg = max × (1 − d/R)`, arrondis à l'entier, avec les multiplicateurs de passifs.
- Impulsion radiale proportionnelle aux dégâts : 40 sub-px/tick par PV infligé (avant passifs), plus une poussée vers le haut de 35 % de cette vitesse (`src/content/world.ts`, à régler en playtest). Une explosion au centre exact de la hitbox pousse à la verticale.
- Ordre de résolution : explosions ordonnées par id d'entité ; les réactions en chaîne (barils) sont placées en file pour le tick suivant.

### 5.4 Usure et structures (GDD §4.7)
- **Usure** : `WeaponDef.chipRadius` (px) creuse un disque à l'impact d'un projectile sans explosion, avec la résistance du matériau comme pour les explosions. 0 désactive.
- **Tours construites** (2026-10-25) : une structure peut être déclarée `{ id, type: 'tower', build: { x, width, ladder } }` ; le sim la construit au début de la partie, haute de `structures.towerHeight` px au-dessus du sol en son milieu : corps en maçonnerie de fond, chemin de ronde solide de 14 px avec merlons (sauf 40 px côté échelle), échelle contre une face, fondation 20 px sous le sol le plus bas.
- **Calque d'appartenance** : un `Uint8Array` parallèle au masque donne l'id de structure de chaque pixel (0 = aucune). Il est produit au chargement à partir de `map.json` (`structures: [{ "id", "type", "rect" }]`, ou un `structures.png` si les formes l'exigent).
- **État** : `structures: { id, type, hp, state }[]`, trié par id, inclus dans le hash. Un coup applique ses dégâts aux structures dont l'emprise croise le rayon d'impact (une seule fois par structure et par coup), pondérés par `StructureDef.damagePct[weapon]`.
- **Effondrement** : à 0 PV, les pixels restants de la structure (pierre bâtie, bois, échelles du rectangle déclaré) sont retirés du masque et découpés en blocs de 32 × 32 au plus. Ils basculent du côté opposé au coup (vitesse latérale proportionnelle à la hauteur au-dessus de la base) et ne s'impriment qu'à 40 % de leur hauteur en gravats. Chaque bloc est un corps entier (position et vitesse en sub-px, sans rotation) qui tombe sous la gravité, inflige des dégâts de chute aux unités qu'il traverse, puis s'imprime dans le masque en terre (gravats) quand il se pose. L'ordre est celui des ids de bloc ; la résolution du tour attend que tous les blocs soient posés.

### 5.5 Grappin
- Contrainte de distance unique (pendule) avec ré-ancrage aux coins du masque (wrap de corde). La V1 se limite à un seul point d'ancrage, le wrap est en P1.

## 6. Cartes

```
public/assets/maps/<mapId>/
  map.json        # metadata
  paint_*.webp    # couche peinte découpée en tuiles (générées au build depuis paint.png)
  mask.png        # masque matériaux (couleurs fixes)
  bg_far.webp, bg_mid.webp, frame.webp
```

```jsonc
// map.json
{
  "id": "jericho",
  "name": { "fr": "Les Murailles de Jéricho", "en": "The Walls of Jericho" },
  "size": [5120, 2304],
  "waterLevel": 2150,
  "spawnZones": [[x, y, w, h], ...],
  "props": [{ "type": "barrel", "x": 1200, "y": 980 }],
  "palette": "ochre",
  "music": "siege",
  "ambience": "wind",
  "parallax": { "far": 0.3, "mid": 0.6 }
}
```

- Script `pnpm run maps:build` : découpe `paint.png` en tuiles WebP, vérifie que le masque et la peinture ont la même taille, que les zones de spawn reposent sur un sol et sont accessibles, et qu'aucun pixel n'a une couleur de masque inconnue.
- Script `pnpm run maps:soak` : lance N parties IA contre IA en headless (Node) et sort un rapport (durée moyenne, unités coincées, tours).

## 7. Rendu des personnages : cutout rig
- Chaque classe est un **rig 2D de pièces séparées** : tête, buste, bras haut et bas ×2, mains, jambes haut et bas ×2, pieds, accessoire de tête, accessoire porté (écu, carquois…).
- Format maison `rig.json` : hiérarchie, pivots, ordre de dessin, slots d'équipement (arme en main, écu).
- Animations décrites en **keyframes** (`anim/*.json` : rotations et translations par os, easing). Elles sont interpolées dans `render/`, purement cosmétiques et non déterministes autorisées.
- Teinte de faction : pièces « tissu » en niveaux de gris recolorées par tint ; blason composé dynamiquement sur l'écu et la bannière (RenderTexture).
- Variété : 3 à 4 têtes par classe, 2 coiffes, symétrie gauche/droite par `scaleX = -1`.
- Alternative possible si l'outillage le justifie : Spine ou DragonBones. Il faut alors vérifier la licence du runtime Spine (payante pour un usage commercial) et la maintenance de DragonBones avant de choisir. **La V1 part sur le format maison**, plus simple à piloter avec Claude Code.

## 8. En ligne (jalon M9)

Décidé le 2026-10-24 : le jeu à distance remplace le LAN 2 PC (WebRTC sans serveur). Raisons et options écartées : [ADR 0002](adr/0002-online-transport.md).

### 8.1 Firebase
- Projet `videogames-06`, partagé par les jeux vidéo de l'utilisateur. Medieverse y a son application web, son site d'hébergement (`medieverse-06`) et son espace de données (`/medieverse/` dans la base par défaut, puis une instance Realtime Database dédiée une fois le projet en Blaze).
- Connexion **anonyme** : chaque appareil a un `uid` stable (persisté par le SDK), ce qui permet de reprendre une partie après un rechargement.
- Aucun serveur de calcul : la base ne sert que de boîte aux lettres entre les deux pairs.

### 8.2 Salle et code
- L'hôte crée `/medieverse/rooms/{code}` : `{ v, host: uid, guest: null, createdAt }`. Le code fait 6 caractères pris dans un alphabet sans ambiguïté (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`), affiché `XXX-XXX`.
- L'invité saisit le code et s'inscrit dans `guest` (la place doit être libre, ou déjà la sienne).
- Messages : `/medieverse/rooms/{code}/to/{host|guest}/{pushId}`. Chaque pair écrit dans la boîte de l'autre et lit la sienne ; il efface chaque message lu.
- Règles de sécurité (`database.rules.json`) : seuls l'hôte et l'invité lisent et écrivent leur salle ; un message est une chaîne de 64 Ko au plus.
- Nettoyage : l'hôte efface la salle en fin de partie. Le nettoyage des salles abandonnées attend Blaze (fonction programmée).

### 8.3 Protocole
JSON, versionné par `PROTOCOL_VERSION` (`src/net/protocol.ts`) ; tout changement de message l'incrémente.
- `hello { protocolVersion, buildHash, tick }` : à chaque connexion ; un écart de version ou de build refuse la partie. `tick` dit jusqu'où le pair a joué (0 : il n'a rien).
- `start { setup, rules, seed, delay }` : envoyé par l'hôte ; les deux pairs construisent la même carte et la même configuration.
- `frames { from, cmds }` : les commandes des ticks `from..from + cmds.length - 1`, par lots.
- `turnEnd { turn, hash }` : à chaque début de tour, par les deux pairs ; un écart affiche l'écran de désync. Une désync n'est jamais corrigée en silence.
- `resume { start, frames }` : la configuration et toutes les commandes produites, pour un pair qui revient sans état.
- `pause { on }`, `resign`.

### 8.4 Lockstep
- Chaque tick `t` a exactement **un producteur** : le pair qui contrôle la maison active dans l'état du tick `t - D - 1`. Les maisons paires sont à l'hôte, les impaires à l'invité.
- Le producteur décide des commandes du tick `t` quand il atteint le tick `t - D - 1`, les garde et les envoie. Les deux pairs les appliquent au tick `t` : le **délai** `D` est le même des deux côtés (30 ticks, une demi-seconde, porté par `start`). Les ticks `1..D` sont vides.
- Un pair ne joue le tick `t` que s'il en a les commandes ; sinon il attend. Le changement de producteur entre deux tours ne crée ni trou ni chevauchement, puisque la propriété de chaque tick se lit dans un état que les deux pairs calculent à l'identique.
- Les lots partent tous les 6 ticks (100 ms) ou dès qu'ils portent une commande.
- Les menus qui arrêtent l'horloge (pause, aide, réglages) envoient `pause` : les deux pairs s'arrêtent.
- Reprise : un pair qui revient (page rechargée) envoie `hello { tick: 0 }` ; l'autre lui envoie `resume`. Le pair rejoue en accéléré, puis le lockstep reprend.
- Les tests tournent sur un transport en mémoire, avec latence et désordre simulés (`tests/net/`).

### 8.5 À faire au passage en Blaze
- Instance Realtime Database dédiée à Medieverse (changement d'URL dans la configuration).
- Fonction programmée qui efface les salles abandonnées.
- Alerte de budget sur le compte de facturation.

## 9. Performance

| Cible | Objectif |
|---|---|
| PC milieu de gamme (iGPU récent) | 60 fps constants, 1920 × 1080 |
| Tablette milieu de gamme 2021+ (iPad 9ᵉ gén. / Android équivalent) | 60 fps visés, 45 fps minimum en pic d'explosions |
| Chargement d'une carte | < 4 s en Wi-Fi local, < 2 s en cache |
| Mémoire | < 400 Mo en pic |
| `sim.step()` | < 1 ms en moyenne hors résolution d'explosion, et < 4 ms au pire |

Règles :
- Atlas de textures (au maximum 2048 × 2048 par page pour la compatibilité mobile).
- Pooling des projectiles et des VFX.
- Ré-upload des tuiles de terrain limité aux tuiles `dirty`, au maximum 4 par frame, le reste étant différé à la frame suivante.

## 10. Plateforme et intégration navigateur
- Orientation : paysage par défaut ; un smartphone tenu en portrait (fenêtre de 760 px de large au plus, plus haute que large, `isPhonePortrait` dans `src/ui/ui-scale.ts`) est aussi pris en charge (décidé le 2026-10-25). L'overlay reçoit alors la classe `phone` : mise en page sur une colonne, échelle calculée sur la largeur seule (référence 520 px), HUD empilé en haut à droite et à gauche, menu de pause sur toute la largeur, pas de bouton plein écran. Le canevas du jeu s'arrête au-dessus de la barre d'actions, toujours visible (`--bar-h`, mesuré par `watchBar`). Les textes d'ambiance (descriptions des cartes et des règles, accroche et colophon du titre, note des maisons) portent la classe `ambient` et sont remplacés par un bouton « ? » (`infoButton`) qui les ouvre dans une bulle. La vue par défaut suit le combattant qui joue quand le champ entier ne tient pas à plus de 1000 px de monde en largeur. Rien ne change au-delà de ce seuil.
- Plein écran : bouton dédié (Fullscreen API ; comportement à vérifier sur iPadOS).
- Audio : déverrouillage du contexte audio au premier geste utilisateur.
- Persistance : `localStorage` encapsulé dans try/catch pour les options et équipes, IndexedDB (P1) pour les replays longs.
- Garde-fous contre les gestes système sur tablette : `touch-action: none` sur le canvas et prévention du pull-to-refresh.

## 11. Internationalisation
- Clés i18n dès la V1 (`src/content/i18n/fr.json`, `en.json` en P1).
- Les polices gothiques doivent couvrir les accents français (à vérifier pour chaque police retenue).

## 12. Qualité
- Couverture des tests unitaires `sim/` ≥ 80 %.
- Replays de référence : un par arme, plus 5 parties complètes IA contre IA.
- Outils de debug (touche F1 en dev) : overlay du masque, hitboxes, trajectoires prédites, hash du tick, pas-à-pas du sim, export de l'état.
