# Medievers — Direction artistique et liste des assets

## 1. Charte de style « Maciejowski »

### 1.1 Principes
| Règle | Application |
|---|---|
| **Aplats** | Couleurs franches, modelé minimal par 1 à 2 nuances plus sombres posées en traits, pas de dégradé lisse |
| **Cernes** | Contour noir-brun (#2a1d14), épaisseur constante de 3 px à l'échelle 1, 2 px pour les détails internes |
| **Pas de perspective** | Vue de profil ou de trois-quarts plat ; échelle hiérarchique admise pour les décors |
| **Fonds** | Or (aplat ou texture feuille d'or légèrement craquelée), ou fond diapré losangé bleu/rouge |
| **Architecture** | Arcatures, tours crénelées, tuiles en écailles, utilisées comme cadres et décors |
| **Paysage** | Sol en bandes ondulées stratifiées, rochers en « marches » arrondies, arbres en boules de feuillage sur tronc fin |
| **Figures** | Visages ovales, yeux en amande, sourcils arqués, petites bouches ; gestes expressifs des mains ; drapés en plis tubulaires |
| **Équipement** | Hauberts en mailles (motif de petits arcs répétés), heaumes, cervelières, écus en amande ou triangulaires, cottes d'armes |
| **Eau** | Bandes ondulées bleu-vert avec volutes blanches |
| **Feu** | Langues rouge vermillon et orange, cernées, en flammèches stylisées |
| **Vélin** | Couleur de fond du terrain creusé (#e9dcc0) avec bord déchiré ocre, ce qui « révèle la page » |

### 1.2 Palette de référence (approximative, à étalonner sur les sources)
| Rôle | Nom | Hex |
|---|---|---|
| Bleu principal | Lapis | #2c4a8c |
| Bleu clair | Azur | #6f93c9 |
| Rouge | Vermillon | #b8322a |
| Rose | Rose garance | #c96a6e |
| Vert | Vert-de-gris | #4d7a4a |
| Vert clair | Vert tendre | #8fae6a |
| Ocre | Ocre jaune | #c99a3e |
| Brun | Terre d'ombre | #6b4a2e |
| Or | Or | #d4a93c (+ texture) |
| Blanc | Céruse | #f3ecd9 |
| Vélin | Vélin | #e9dcc0 |
| Cerne | Encre | #2a1d14 |
| Chair | Carnation | #f0cfb0 |

### 1.3 Références et droits
- Source : Morgan Library & Museum, MS M.638, consultable en ligne (Corsair).
- L'œuvre est du domaine public. **Les conditions de réutilisation des photographies numériques de la Morgan restent à vérifier** avant toute intégration de scans dans le build. Par défaut, les scans servent de **référence de style uniquement** et ne sont jamais intégrés.
- En cas de génération IA : prompts « dans le style de » autorisés, mais ne pas reproduire une miniature précise à l'identique.

## 2. Conventions techniques

| Élément | Règle |
|---|---|
| Échelle de production | Produire en **×2** (unité ≈ 176 px de haut), puis réduire à ×1 et ×0,5 au packaging |
| Format source | PSD, Krita ou SVG selon l'outil ; export en PNG RGBA |
| Format runtime | WebP (décors, terrain), PNG en atlas (sprites, UI) |
| Atlas | Au maximum 2048 × 2048 par page, padding de 2 px, extrusion de 1 px |
| Nommage | `snake_case` : `<categorie>_<sujet>_<variante>_<etat>`, par ex. `unit_knight_head_02`, `weapon_icon_greek_fire`, `vfx_explosion_m_04` |
| Pivots | Pièces de rig avec point de pivot documenté (`rig.json`) ; marquer le pivot par un pixel magenta (#ff00ff) sur un calque séparé dans la source |
| Tintables | Pièces « tissu de faction » en niveaux de gris neutres (luminosité 50–85 %) |
| Frames VFX | Animations image par image en 12 fps, 6 à 12 frames |

Colonnes des tableaux : **P** = priorité (P0 prototype / vertical slice, P1 V1, P2 après V1). **Qté** = nombre de fichiers ou de pièces.

### 2.1 Placeholders (lots 1 à 8)

Jusqu'à la production artistique (BACKLOG, lot 9), aucun fichier image n'est requis :

- **Tout visuel est référencé par sa clé d'asset** (le nommage ci-dessus : `unit_knight_head_02`, `vfx_explosion_m_04`…), jamais par un chemin de fichier écrit en dur.
- Quand le fichier correspondant n'existe pas, `src/render` génère au démarrage une **texture placeholder sous la même clé**, dessinée par le code (`Graphics` puis `generateTexture`). Les unités sont des capsules aux couleurs de la maison, les projectiles des cercles, les pièces de rig des rectangles à la bonne taille avec leur pivot, et le terrain des aplats par matériau.
- Les dimensions, les pivots et les zones tintables du placeholder sont ceux de la spec finale. Remplacer un placeholder revient donc à déposer le fichier : aucune modification de code.
- Les placeholders ne sont jamais livrés comme assets finaux. `asset-audit` signale toute clé encore servie par un placeholder.

## 3. Unités (cutout rigs)

### 3.1 Pièces communes à toutes les classes (squelette de base)
| Asset | Qté | Taille ×2 (indicative) | P |
|---|---|---|---|
| Buste (de face trois-quarts) | 1 par classe | 70 × 80 | P0 |
| Bras haut / avant-bras / main (gauche et droite séparés) | 6 par classe | 20–30 × 50 | P0 |
| Cuisse / jambe / pied (gauche et droite) | 6 par classe | 24 × 50 | P0 |
| Main fermée, main ouverte, main désignant | 3 × 2 | 20 × 20 | P1 |
| Cou / bassin de liaison (évite les trous de rotation) | 2 par classe | — | P0 |

### 3.2 Têtes et coiffes
| Classe | Têtes | Coiffes | P |
|---|---|---|---|
| Chevalier | 3 (visage dans le camail) | heaume à nasal, heaume fermé, cervelière | P0 (1 tête) / P1 (reste) |
| Archer | 4 | chaperon, chapeau de fer | P1 |
| Frondeur | 4 | tête nue, bandeau | P1 |
| Sapeur | 3 | bonnet, coiffe | P1 |
| Clerc | 3 (tonsure) | mitre (variante), capuche | P1 |
| Roi | 2 (barbe ou imberbe) | couronne fleuronnée | P1 |
| Expressions (superposition yeux et bouche) | 5 : neutre, surprise, douleur, triomphe, effroi | — | P1 |

### 3.3 Équipement porté
| Asset | Qté | P |
|---|---|---|
| Écu en amande (tintable + zone blason) | 1 | P0 |
| Cotte d'armes (tintable) | 1 par classe militaire | P1 |
| Carquois | 1 | P1 |
| Manteau royal (tintable) | 1 | P1 |
| Crosse / croix processionnelle | 1 | P1 |
| Tablier et pioche dorsale (Sapeur) | 1 | P1 |

### 3.4 Animations (keyframes dans `anim/*.json`, aucun dessin supplémentaire hors expressions)
| Anim | Boucle | Durée | P |
|---|---|---|---|
| idle (respiration, regard) | oui | 2 s | P0 |
| idle_fidget ×3 (se gratter, ajuster le heaume, prier) | non | 1,5 s | P1 |
| walk | oui | 0,8 s | P0 |
| jump_forward, jump_back, fall, land | non | — | P0 |
| fly_tumble (projeté) | oui | 0,6 s | P0 |
| hurt | non | 0,4 s | P0 |
| aim_bow, aim_crossbow, aim_sling, aim_throw, aim_melee, aim_pointer (frappes, miracle) | pose maintenue | — | P0 (bow, throw) / P1 |
| fire_* (une par pose de visée) | non | 0,3–0,5 s | P0 / P1 |
| rope_hang, rope_swing | oui | — | P1 |
| banner_glide | oui | — | P1 |
| dig_down, dig_side | oui | 0,6 s | P1 |
| place_stone, place_ladder | non | 0,6 s | P1 |
| drown | non | 1,5 s | P1 |
| death (chute raide, puis remplacement par une stèle) | non | 1 s | P0 |
| victory, taunt | non | 1,5 s | P1 |
| clerc_bless (VFX halo) | non | 1 s | P1 |

## 4. Armes et objets

### 4.1 Icônes d'arsenal (128 × 128 ×2, sur fond de cartouche)
Arc, arbalète, fronde, pot de feu grégeois, pot de poix, cochon enflammé, ruche, faucon, volée de trébuchet, pluie de flèches, épée, masse d'armes, charge à l'écu, grappin, mur de pierres, bannière, pioche, sape, échelle, chausse-trape, miracle, passer son tour.
**Qté : 22**. **P** : P0 pour 6 (arc, fronde, pot, épée, mur, passer), P1 pour le reste.

### 4.2 Armes en main et projectiles in-world
| Asset | Qté | P |
|---|---|---|
| Arc (bandé et au repos), flèche, flèche fichée | 4 | P0 |
| Arbalète, carreau | 2 | P1 |
| Fronde (lanière), pierre de fronde | 2 | P0 |
| Pot de feu grégeois (avec mèche, 3 frames de mèche) | 4 | P0 |
| Pot de poix, goutte enflammée | 2 | P1 |
| Cochon enflammé (rig 4 pattes ou 6 frames de marche) | 1 rig | P1 |
| Ruche, abeille (3 frames) | 4 | P1 |
| Faucon (6 frames de vol) | 6 | P1 |
| Pierre de trébuchet, trébuchet lointain en silhouette (bord d'écran) | 2 | P1 |
| Épée, masse d'armes | 2 | P0 / P1 |
| Grappin + segment de corde | 2 | P1 |
| Pierres taillées (3 longueurs : 64/128/192 ×2) | 3 | P0 |
| Échelle (tronçon répétable) | 2 | P1 |
| Bannière déployée (tintable + blason) | 1 | P1 |
| Chausse-trape (armée, désarmée) | 2 | P1 |
| Baril de poix | 1 + 3 frames de dégâts | P1 |
| Stèle funéraire (3 variantes) | 3 | P0 |

### 4.3 Reliquaires
| Asset | Qté | P |
|---|---|---|
| Ange porteur (rig simple : corps, 2 ailes, bras ; 4 keyframes de vol) | 1 rig | P1 |
| Reliquaire d'armes (châsse dorée) | 1 | P1 |
| Fiole de baume | 1 | P1 |
| Coffret piégé (identique au reliquaire + variante de « tell » subtil, optionnelle) | 1 | P1 |

## 5. VFX (frame par frame, 12 fps)
| Asset | Frames | P |
|---|---|---|
| Explosion S / M / L (flammes cernées + fumée en volutes) | 8 / 10 / 12 | P0 (M) / P1 |
| Fumée persistante (volutes) | 6 | P1 |
| Flammes au sol (boucle) | 6 | P1 |
| Éclats de terrain (débris ocre et vélin, en particules) | 4 sprites | P0 |
| Poussière d'atterrissage | 5 | P0 |
| Éclaboussure (eau) | 6 | P1 |
| Étoiles de choc / plumes (remplacent le sang) | 4 sprites | P0 |
| Halo de bénédiction (rayons dorés) | 8 | P1 |
| Miracle (colonne de lumière + nuée) | 10 | P1 |
| Traînée de trajectoire (pointillé enluminé : petits points dorés cernés) | 1 tuile | P0 |
| Vagues du Déluge (bord supérieur animé, tuile répétable) | 8 | P1 |
| Ange soufflant (vent fort) | 4 | P1 |

## 6. Audio
| Catégorie | Contenu | Qté | P |
|---|---|---|---|
| Musique | Menu, sélection d'équipes, 3 thèmes de bataille (calme, tendu, Déluge), victoire, défaite. Style : rythmes et sonorités à la *Patapon* remixés en médiéval (GDD §11) | 7 pistes | P1 (1 piste en P0) |
| Ambiances | Vent de plaine, camp, eau, tour (vent fort), verger (oiseaux) | 5 boucles | P1 |
| SFX armes | Corde d'arc, impact de flèche ×2, arbalète, fronde (rotation + lâcher), pot (lancer, rebond ×2, mèche), explosions S/M/L ×2, poix, grognement de cochon ×3, essaim, cri de faucon, trébuchet lointain + sifflement, épée ×2, masse ×2 | ~30 | P0 (8) / P1 |
| SFX utilitaires | Grappin (tir, accroche), pierre posée, échelle, bannière qui claque, pioche ×3, chausse-trape (armement, déclenchement), miracle (chœur bref) | ~12 | P1 |
| SFX unités | Pas (terre, pierre, bois), saut, atterrissage, chute lourde, plouf, noyade, mort | ~12 | P0 (5) / P1 |
| SFX UI | Clic, ouverture d'arsenal, sablier (fin de tour ×3 tic), début de tour (cloche), annonce du Déluge (cor), victoire (fanfare) | ~10 | P1 |
| Voix | Interjections, 3 timbres × ~10 répliques | 30 | P2 |

**Droits musicaux** : les partitions médiévales sont dans le domaine public, mais pas les enregistrements. Il faut un enregistrement propre, une génération sous licence permettant l'usage, ou une banque de sons dont la licence a été vérifiée (CC0 de préférence).

## 7. Cartes (par carte)
| Asset | Format | Qté par carte | P |
|---|---|---|---|
| Couche peinte (terrain) | PNG source à la taille du monde (jusqu'à 5120 × 2560), découpé au build | 1 | P0 (1 carte) |
| Masque de matériaux | PNG aux couleurs fixes (`content/materials.ts`) | 1 | P0 |
| Fond (or ou diapré) | WebP, tuile répétable ou plein écran | 1 | P0 |
| Décor lointain (parallaxe) | WebP, environ 1,3 × la largeur d'écran | 1 | P1 |
| Décor intermédiaire | WebP | 1 | P1 |
| Objets spécifiques (tentes, tours, arbres non destructibles en avant-plan) | PNG | 3–8 | P1 |
| Vignette de sélection | 480 × 270 | 1 | P1 |
| Miniature d'annonce (pleine page enluminée du thème) | 1920 × 1080 | 1 | P2 |

Cartes V1 : Jéricho (P0, carte de référence), Ela, Camp, Arche, Tour, Verger (P1).

## 8. Interface
| Asset | Qté | P |
|---|---|---|
| Logo « Medievers » (lettrine historiée + lettrage gothique) | 1 + version compacte | P1 |
| Écran titre (page enluminée, lettrine animable en calques) | 1 composition, environ 6 calques | P1 |
| Cadres de panneaux (arcature, 9-slice) | 3 | P0 (1) |
| Boutons (normal, survol, pressé, désactivé ; 9-slice) | 2 styles × 4 | P0 |
| Phylactère de barre de vie (9-slice) + remplissage | 2 | P0 |
| Cartouche de nom d'unité (9-slice, tintable) | 1 | P0 |
| Sablier (animation de 12 frames) | 1 | P1 |
| Bannière de vent (rig 3 segments) | 1 | P0 |
| Pad virtuel tablette (flèches, saut, tir, arsenal) | 5 icônes + fond | P0 |
| Roue d'angle (mode jauge) + jauge de puissance (cierge qui se consume ?) | 2 | P1 |
| Curseurs (visée, cible, main) | 3 | P1 |
| Blasons : 7 émaux, 6 partitions, environ 20 meubles (lion, tour, clef, croissant, aigle, ancre, sanglier, étoile, fleur de lis, croix, roue, poisson, cerf, coq, épée, couronne, coquille, chevron, bande, fasce) | ~33 | P0 (8 blasons pré-composés) / P1 (éditeur) |
| Écran « tournez votre appareil » | 1 | P1 |
| Écran « passez la main » (hotseat) | 1 | P1 |
| Écran de victoire (scène de triomphe, calques) | 1 | P1 |

### Polices
- **Titres** : gothique textura *UnifrakturMaguntia* (OFL, accents français couverts), retenue le 2026-10-24. En casse mixte uniquement : ses capitales sont illisibles.
- **Texte et HUD** : *IM Fell English* (OFL), et sa version petites capitales *IM Fell English SC* pour les boutons, noms et intertitres. La gothique est illisible en petit.
- Les trois polices sont embarquées via les paquets `@fontsource/*` (aucun appel réseau) et chargées avant la première scène (`src/ui/fonts.ts`).

## 9. Pipeline de production (génération IA + retouche)

### 9.1 Règles de cohérence
1. Produire d'abord une **planche de référence de style** validée (1 chevalier complet, 1 morceau de terrain, 1 explosion, 1 bouton). Elle sert d'image de référence à toutes les générations suivantes.
2. Générer les personnages **en pose neutre de profil, bras écartés du corps**, sur fond uni (#ff00ff ou blanc pur), puis découper les pièces à la main. Ne pas générer les pièces séparément, car leurs styles divergent.
3. Repasser systématiquement les cernes à la main ou en vectoriel pour normaliser leur épaisseur.
4. Réduire les couleurs à la palette du §1.2 (quantification + retouche).
5. Le terrain se peint en grandes plaques, qui se découpent ensuite ; on ne génère pas de tuiles indépendantes.

### 9.2 Prompt de base (à adapter par asset)
> Medieval manuscript illumination in the style of the Maciejowski Bible (Paris, c. 1250). Flat opaque colors (lapis blue, vermilion, verdigris green, ochre, burnished gold), uniform dark brown outlines, minimal shading with darker line strokes, no perspective, no gradients. [SUJET]. Isolated on plain white background, full figure, side view, arms slightly away from the body. No text, no frame.

Sujets types :
- `a knight in full chainmail hauberk with nasal helmet and almond-shaped shield, calm stern face`
- `a monk in brown robe with tonsure holding a processional cross`
- `layered stylized rocky hillside with wavy earth strata and lollipop-shaped trees, wide panorama`
- `stylized explosion of red and orange flame tongues with curling grey smoke, outlined`

### 9.3 Checklist de validation d'un asset
- [ ] Palette respectée (pas de couleur hors charte de plus de 5 %)
- [ ] Cernes conformes à l'épaisseur cible à ×1
- [ ] Fond transparent propre (pas de halo)
- [ ] Pivots marqués (pièces de rig)
- [ ] Nommage conforme
- [ ] Testé en jeu à zoom 0,5 / 1 / 1,5

## 10. Récapitulatif des volumes
| Catégorie | P0 (vertical slice) | V1 complète |
|---|---|---|
| Pièces de rig unités | ~25 (Chevalier seul) | ~170 |
| Animations keyframes | ~12 | ~40 |
| Icônes d'arsenal | 6 | 22 |
| Sprites d'armes et objets | ~15 | ~55 |
| VFX (séquences) | 5 | 15 |
| Cartes | 1 | 6 |
| UI | ~15 | ~60 |
| Audio | ~15 | ~110 |
