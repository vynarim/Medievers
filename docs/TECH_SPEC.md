# Medievers — Spécification technique

## 1. Stack

| Couche | Choix | Remarque |
|---|---|---|
| Langage | TypeScript (strict, `noUncheckedIndexedAccess`) | |
| Build | Vite | Sortie statique, déployable sur n'importe quel hébergement |
| Rendu / input / audio / scènes | Phaser | **À figer en M0** : vérifier l'état de Phaser 3.x vs 4.x (stabilité, API WebGL/render textures, support tactile) avant de choisir. Ne pas supposer. |
| Tests | Vitest (unitaires + déterminisme), Playwright (smoke E2E, P1) | |
| Workers | Web Worker natif (`new Worker(new URL(...), {type:'module'})`) | IA et validation de cartes |
| Réseau LAN | WebRTC `RTCDataChannel` | §8 |
| QR | Bibliothèque légère de génération et de lecture de QR (à choisir en M9) | Lecture caméra optionnelle, le copier-coller reste le fallback |
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
- Le **log de partie** est `{ version, config, seed, mapId, commands: Array<[tick, GameCommand]> }`. Il sert à la fois de replay, de fixture de test et de flux LAN.

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
- Le masque est découpé en **chunks de 256 × 256**, chacun avec un flag `dirty` et un hash.
- Le masque source est un PNG dont les couleurs sont fixes par matériau (table dans `content/materials.ts`). Il est converti en `Uint8Array` au chargement, avec un cache possible en `.bin` lors du build (P1).

### 4.3 Rendu du terrain
- **Point de vigilance** : une texture unique de 5120 × 2560 dépasse la limite `MAX_TEXTURE_SIZE` de certains GPU mobiles. On découpe donc la couche peinte en **tuiles de 512 × 512**, chacune étant une `CanvasTexture` ou une `RenderTexture` Phaser.
- Destruction :
  1. `sim` modifie le masque et émet `TerrainCarved { shape, x, y, r }` dans les événements du tick.
  2. `render` applique la même forme en `destination-out` sur les tuiles concernées.
  3. Il peint un liseré « vélin déchiré » (texture de bord brûlé ou ocre) en contour, via un pass `source-atop` avec un anneau de r à r+6 px.
- Pierres posées : sprite de pierre taillée tamponné sur la tuile, avec écriture du masque à 3.
- Le rendu ne relit jamais le masque pour décider de la physique.

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
- Impulsion radiale proportionnelle aux dégâts.
- Ordre de résolution : explosions ordonnées par id d'entité ; les réactions en chaîne (barils) sont placées en file pour le tick suivant.

### 5.4 Grappin
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

## 8. LAN (jalon M9)

### 8.1 Option A : WebRTC sans serveur (cible)
- `RTCPeerConnection({ iceServers: [] })` : candidats host uniquement, sans STUN, en LAN.
- Signaling manuel :
  1. L'hôte crée l'offre et attend la fin du gathering ICE. Il compresse le SDP (minification des lignes + deflate + base64url) et l'affiche en **QR code et en code texte**.
  2. L'invité colle ou scanne l'offre, génère la réponse et l'affiche en QR et en texte.
  3. L'hôte colle ou scanne la réponse, et la connexion s'établit.
- Un DataChannel fiable et ordonné, protocole JSON versionné :
  - `hello { protocolVersion, buildHash }` : refus si les builds diffèrent ;
  - `config { MatchConfig, seed, mapId }` : envoyé par l'hôte ;
  - `cmd { tick, cmds[] }` : diffusé en continu par le joueur actif, pour une vision en direct ;
  - `turnEnd { turn, hash }` : envoyé par les deux pairs, et un écart déclenche une alerte de désync ;
  - `ping` / `pong`, `pause`, `resign`.
- Modèle : **lockstep par tour**. Seul le joueur actif émet ; le pair passif applique les commandes avec un tampon d'environ 6 ticks (100 ms). Le pair actif retarde aussi sa propre application de 6 ticks pour rester aligné. Les hashes sont comparés à chaque fin de tour.
- Reconnexion : l'hôte conserve le log complet, et un pair qui revient reçoit `config + commands` puis rejoue en accéléré.
- **Incertitudes à lever par un spike (M9.1)** :
  - Chrome et Safari masquent l'IP locale derrière des noms `.local` (mDNS) ; il faut vérifier qu'ils se résolvent entre les deux PC sur le réseau cible ;
  - comportement de Firefox ;
  - isolation client de certaines box ou réseaux Wi-Fi invités ;
  - taille du SDP compressé, pour qu'il reste lisible en QR.

### 8.2 Option B : fallback mini-serveur local
- `tools/lan-server/` : un serveur Node (WebSocket + service statique du build) empaqueté en exécutable unique (pkg, bun compile ou équivalent, à choisir au moment voulu).
- L'hôte lance l'exécutable, qui affiche une URL `http://<ip-lan>:<port>` ; l'invité l'ouvre dans son navigateur.
- Même protocole qu'en A, seul le transport change (`Transport` interface : `send`, `onMessage`, `close`).

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
- Orientation paysage : un écran « tournez votre appareil » s'affiche en portrait. `screen.orientation.lock('landscape')` n'est tenté qu'en plein écran, car le support varie selon les navigateurs (**à vérifier sur iPadOS Safari**, probablement non supporté).
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
