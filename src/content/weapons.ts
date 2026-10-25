// Weapon definitions (GDD §4). Speeds in sub-px/tick (256 = 1 px), radii in px, times in ticks.
// Only the weapons implemented in src/sim/weapons are listed; the rest arrive with M4.

export type WeaponId =
  | 'bow'
  | 'fireArrow'
  | 'sling'
  | 'greekFire'
  | 'crossbow'
  | 'pitchPot'
  | 'mace'
  | 'pick'
  | 'sap'
  | 'caltrop'
  | 'stoneWall'
  | 'trebuchet'
  | 'sword'
  | 'shieldCharge'
  | 'arrowRain'
  | 'miracle'
  | 'ladder'
  | 'banner'
  | 'flamingPig'
  | 'beehive'
  | 'falcon'
  | 'grapple';

/** Fragments a cluster weapon throws when it bursts (pot de poix, GDD §4.1). */
export interface FragmentDef {
  readonly count: number;
  /** HP at the centre of each fragment's blast */
  readonly damage: number;
  /** px: blast radius of each fragment */
  readonly radius: number;
  /** sub-px/tick: launch speed of the fragments */
  readonly speed: number;
}

/** Digging tools (pioche, sape, GDD §4.4): the unit cuts its way through the ground. */
export interface DigDef {
  /** ticks the digging lasts */
  readonly ticks: number;
  /** sub-px/tick the cut advances in earth (the sapper's passive multiplies it) */
  readonly speed: number;
  /** px: radius of the cut; a column of such discs as tall as a unit for the sap */
  readonly radius: number;
  /** down: straight down (pick); aim: level or 45° up or down, on the aimed side (sap) */
  readonly along: 'down' | 'aim';
  /**
   * the sap only cuts through matter: aimed at open air it is refused (the turn keeps its
   * action), and it stops where its tunnel comes out into the open (2026-10-25). Absent from
   * older logs: it went on through the air, the unit walking after it.
   */
  readonly needsMatter?: boolean;
}

/** Chausse-trape (GDD §4.4): a mine left on the ground, seen only by its own house. */
export interface MineDef {
  /** ticks before it is armed */
  readonly armTicks: number;
  /** px: a unit this close to it sets it off */
  readonly triggerRadius: number;
  /** ticks between a blast reaching it and its own blast */
  readonly chainDelay: number;
}

/** Mur de pierres (GDD §4.4): a block of dressed stone set where the unit points. */
export interface WallDef {
  /** px: the three lengths, chosen with the fuse buttons 1 to 3 */
  readonly short: number;
  readonly medium: number;
  readonly long: number;
  /** px */
  readonly thickness: number;
  /** px: farthest from the unit's body centre the wall's centre may be */
  readonly reach: number;
  /**
   * the wall drops straight down onto the ground below where it is set (2026-10-25). Absent
   * from older logs: it stays where it is set, in the air if need be.
   */
  readonly fall?: boolean;
}

/** Volée de trébuchet (GDD §4.2): stones falling from off the map on a chosen point. */
export interface StrikeDef {
  readonly count: number;
  /** px between two stones as they land */
  readonly spacing: number;
  /** sub-px/tick: sideways speed of the stones, from the chosen side */
  readonly speed: number;
  /** px: farthest from the unit the target may be, with the gauge (a click goes anywhere) */
  readonly range: number;
  /** px above the top of the map the stones start from */
  readonly height: number;
}

/** Charge à l'écu (GDD §4.3): a run along the facing side that throws over all it meets. */
export interface ChargeDef {
  /** px the run covers at most */
  readonly distance: number;
  /** sub-px/tick of the run */
  readonly speed: number;
}

/** Miracle (GDD §4.4): the unit is taken up and set down on a free point of the map. */
export interface TeleportDef {
  /** px: farthest from the unit the point may be with the gauge (a click goes anywhere) */
  readonly reach: number;
}

/** Échelle (GDD §4.4): a ladder set up against what stands in front of the unit. */
export interface LadderDef {
  /** px: its height at most, from the ground (a ceiling stops it lower) */
  readonly height: number;
}

/** Bannière (GDD §4.4): held up as the unit falls, it slows the fall and the wind carries it. */
export interface BannerDef {
  /** sub-px/tick: speed of the fall under the banner */
  readonly fallSpeed: number;
  /** sub-px/tick of sideways drift per point of wind */
  readonly windDrift: number;
}

/** Cochon enflammé (GDD §4.1): a beast let loose that trots on by itself, then goes up. */
export interface WalkerDef {
  /** sub-px/tick it trots at */
  readonly speed: number;
  /** ticks before it goes up of itself */
  readonly fuse: number;
  /** sub-px/tick: the speed of its hop over what blocks its way */
  readonly hop: number;
  /** px: the highest step it trots up without a hop */
  readonly maxStep: number;
}

/** Ruche (GDD §4.1): a hive thrown that breaks and lets out a swarm. */
export interface HiveDef {
  /** ticks the swarm lives */
  readonly ticks: number;
  /** sub-px/tick the swarm flies at, after the nearest unit */
  readonly speed: number;
  /** px around a unit's body within which the swarm stings */
  readonly reach: number;
  /** ticks between two stings of the same swarm */
  readonly every: number;
}

/** Faucon (GDD §4.1): a bird sent at a point, that steers its way there and strikes. */
export interface HomingDef {
  /** sub-px/tick it flies at */
  readonly speed: number;
  /** BAM it may turn by in a tick */
  readonly turn: number;
  /** ticks it first rises straight up, before it steers */
  readonly rise: number;
  /** sub-px/tick of sideways drift per point of wind */
  readonly windDrift: number;
  /** ticks it flies at most, before it strikes where it is */
  readonly ticks: number;
  /** px: farthest from the unit the point may be with the gauge (a click goes anywhere) */
  readonly reach: number;
}

/** Grappin (GDD §4.4): a rope shot at the ground above, to swing from, let go and shoot again. */
export interface RopeDef {
  /** px: the farthest the hook catches */
  readonly length: number;
  /** px: the shortest the rope is hauled in to */
  readonly minLength: number;
  /** sub-px/tick the rope is hauled in or paid out by */
  readonly climbSpeed: number;
  /** sub-px/tick²: the push of ← → as the unit swings */
  readonly pump: number;
}

export interface WeaponDef {
  readonly id: WeaponId;
  /** behaviour implemented in src/sim/weapons */
  readonly behavior:
    | 'directHit'
    | 'fusedBouncer'
    | 'cluster'
    | 'melee'
    | 'charge'
    | 'dig'
    | 'mine'
    | 'build'
    | 'strike'
    | 'teleport'
    | 'ladder'
    | 'banner'
    | 'walker'
    | 'hive'
    | 'homing'
    | 'rope';
  /** px; 0 = point projectile */
  readonly projectileRadius: number;
  /** percent of wind acceleration applied (GDD §4.1 « Vent ») */
  readonly windPct: number;
  /** sub-px/tick at full power (power 1024) */
  readonly maxSpeed: number;
  /** HP: direct hit damage, or explosion damage at the centre */
  readonly damage: number;
  /** px: explosion radius; 0 for direct-hit weapons */
  readonly explosionRadius: number;
  /**
   * px: crater a direct-hit projectile digs where it strikes the ground (GDD §4.7), before the
   * material's resistance. Absent from logs recorded before 2026-10-24: no wear.
   */
  readonly chipRadius?: number;
  /** percent of the standard knockback for direct hits (sling: strong recoil) */
  readonly knockbackPct: number;
  /** percent of speed kept on each bounce (fusedBouncer) */
  readonly bouncePct: number;
  /** ticks: default fuse; 0 = no fuse */
  readonly defaultFuse: number;
  /** starting ammunition; -1 = unlimited */
  readonly ammo: number;
  /** the power is always full: only the angle is aimed (crossbow) */
  readonly fixedPower?: boolean;
  /** cluster: the fragments of the burst */
  readonly fragments?: FragmentDef;
  /** px: melee reach, from the body centre along the aim */
  readonly reach?: number;
  /**
   * melee: percent of the knockback at zero power, rising to 100 at full power, charged like a
   * shot (2026-10-24). Absent from older logs: the full knockback, struck at once.
   */
  readonly knockbackMinPct?: number;
  /**
   * melee: the blow is only struck at something within reach along the aim (a unit, a barrel, a
   * coffer, the kitchen, a beast, the unicorn, a structure); otherwise it is refused and the turn
   * keeps its action (2026-10-25). Absent from older logs: a blow at nothing counts.
   */
  readonly needsTarget?: boolean;
  /**
   * The fuse is set in turns (GDD §4.1, 2026-10-24): 1 = this turn, after this many ticks;
   * 2 = at the start of the next turn; 3 = in two turns, the pot resting on the map meanwhile.
   * Absent from older logs: a fuse in seconds.
   */
  readonly fuseTurns?: number;
  /** melee: the blow is struck level on the side the unit faces, whatever the aim (the sword) */
  readonly frontal?: boolean;
  /** Charge à l'écu: the run */
  readonly charge?: ChargeDef;
  /** thrown by hand (sling, pots): the slinger's passive applies (GDD §3.2) */
  readonly thrown?: boolean;
  /**
   * its blast leaves burning flames on the ground (rules.flames, GDD §4.1); a direct hit (the
   * fire arrow) sets alight what it strikes, but stone: a flame on the ground, a wooden tower
   */
  readonly flames?: boolean;
  /** shots a weapon reliquary holds of it (absent: 1) */
  readonly crateAmmo?: number;
  /**
   * Using it is not the turn's action (the ladder, the banner): the turn goes on as before, the
   * unit may still shoot; only the ammunition is spent.
   */
  readonly free?: boolean;
  /** Using it ends the turn at once (the miracle). */
  readonly endsTurn?: boolean;
  readonly walker?: WalkerDef;
  readonly hive?: HiveDef;
  readonly homing?: HomingDef;
  readonly rope?: RopeDef;
  readonly teleport?: TeleportDef;
  readonly ladder?: LadderDef;
  readonly banner?: BannerDef;
  readonly dig?: DigDef;
  readonly mine?: MineDef;
  readonly wall?: WallDef;
  readonly strike?: StrikeDef;
}

/** Weapons aimed at a point of the map rather than fired along the aim (click or gauge). */
export const isTargeted = (w: WeaponDef): boolean =>
  w.behavior === 'build' ||
  w.behavior === 'strike' ||
  w.behavior === 'teleport' ||
  w.behavior === 'homing';

/** The gauge sets something (speed, distance, a blow's knockback); the others act at once. */
export const usesPower = (w: WeaponDef): boolean =>
  isProjectile(w) || isTargeted(w) || w.knockbackMinPct !== undefined;

/** Weapons that throw something through the air along the aim (they have a flight preview). */
export const isProjectile = (w: WeaponDef): boolean =>
  w.behavior === 'directHit' ||
  w.behavior === 'fusedBouncer' ||
  w.behavior === 'cluster' ||
  w.behavior === 'hive';

/** Tools without a projectile or explosion of their own: placed, dug or set. */
const TOOL = {
  projectileRadius: 0,
  windPct: 0,
  maxSpeed: 0,
  damage: 0,
  explosionRadius: 0,
  knockbackPct: 0,
  bouncePct: 0,
  defaultFuse: 0,
} as const;

export const WEAPONS: readonly WeaponDef[] = [
  {
    id: 'bow',
    behavior: 'directHit',
    projectileRadius: 0,
    windPct: 100,
    maxSpeed: 24 * 256,
    damage: 35,
    explosionRadius: 0,
    chipRadius: 3,
    knockbackPct: 60,
    bouncePct: 0,
    defaultFuse: 0,
    ammo: -1,
  },
  {
    // Flèche enflammée (2026-10-25): found in the reliquaries only, three at a time. An arrow
    // that sets alight what it strikes, but stone; 5 HP more than the bow on a unit.
    id: 'fireArrow',
    behavior: 'directHit',
    flames: true,
    projectileRadius: 0,
    windPct: 100,
    maxSpeed: 24 * 256,
    damage: 40,
    explosionRadius: 0,
    chipRadius: 3,
    knockbackPct: 60,
    bouncePct: 0,
    defaultFuse: 0,
    ammo: 0,
    crateAmmo: 3,
  },
  {
    id: 'crossbow',
    behavior: 'directHit',
    projectileRadius: 0,
    windPct: 40,
    maxSpeed: 30 * 256,
    damage: 45,
    explosionRadius: 0,
    chipRadius: 4,
    knockbackPct: 80,
    bouncePct: 0,
    defaultFuse: 0,
    ammo: 2,
    fixedPower: true,
  },
  {
    id: 'sling',
    thrown: true,
    behavior: 'directHit',
    projectileRadius: 2,
    windPct: 100,
    maxSpeed: 20 * 256,
    damage: 25,
    explosionRadius: 0,
    chipRadius: 5,
    knockbackPct: 250,
    bouncePct: 0,
    defaultFuse: 0,
    ammo: -1,
  },
  {
    id: 'greekFire',
    thrown: true,
    flames: true,
    behavior: 'fusedBouncer',
    projectileRadius: 5,
    windPct: 0,
    maxSpeed: 18 * 256,
    damage: 45,
    explosionRadius: 60,
    knockbackPct: 100,
    bouncePct: 45,
    // One turn: the fuse buttons read 1 to 3 turns for this pot.
    defaultFuse: 60,
    ammo: 3,
    fuseTurns: 3 * 60,
  },
  {
    id: 'pitchPot',
    thrown: true,
    behavior: 'cluster',
    projectileRadius: 5,
    windPct: 0,
    maxSpeed: 17 * 256,
    damage: 30,
    explosionRadius: 50,
    knockbackPct: 100,
    bouncePct: 40,
    defaultFuse: 3 * 60,
    ammo: 1,
    fragments: { count: 5, damage: 15, radius: 30, speed: 6 * 256 },
  },
  {
    // Cochon enflammé (2026-10-25): let loose on the facing side, it trots at 2 px a tick, hops
    // over walls, and goes up at a second press of Fire, or after 8 s, or when a blast reaches it.
    id: 'flamingPig',
    behavior: 'walker',
    ...TOOL,
    damage: 70,
    explosionRadius: 90,
    knockbackPct: 100,
    ammo: 1,
    walker: { speed: 2 * 256, fuse: 8 * 60, hop: 7 * 256, maxStep: 8 },
  },
  {
    // Ruche (2026-10-25): thrown like a stone, bent by the wind; where it breaks, a swarm comes
    // out that flies after the nearest unit, whoever's, for 4 s, stinging it for 5 HP every
    // half-second it is on it.
    id: 'beehive',
    behavior: 'hive',
    thrown: true,
    projectileRadius: 4,
    windPct: 100,
    maxSpeed: 18 * 256,
    damage: 5,
    explosionRadius: 0,
    knockbackPct: 0,
    bouncePct: 0,
    defaultFuse: 0,
    ammo: 1,
    hive: { ticks: 4 * 60, speed: 3 * 256, reach: 10, every: 30 },
  },
  {
    // Faucon (2026-10-25): sent at the point clicked (or as far along the aim as the gauge says),
    // it rises, then steers its way there at 8 px a tick, the wind bending its course, and
    // strikes the first thing it meets: 50 HP at the centre, 50 px.
    id: 'falcon',
    behavior: 'homing',
    projectileRadius: 4,
    windPct: 0,
    maxSpeed: 8 * 256,
    damage: 50,
    explosionRadius: 50,
    knockbackPct: 100,
    bouncePct: 0,
    defaultFuse: 0,
    ammo: 1,
    homing: { speed: 8 * 256, turn: 80, rise: 16, windDrift: 24, ticks: 6 * 60, reach: 1200 },
  },
  {
    id: 'trebuchet',
    behavior: 'strike',
    ...TOOL,
    projectileRadius: 6,
    damage: 30,
    explosionRadius: 45,
    knockbackPct: 100,
    ammo: 1,
    strike: { count: 5, spacing: 28, speed: 3 * 256, range: 1600, height: 300 },
  },
  {
    // Pluie de flèches (2026-10-25): twelve arrows from off the map on a chosen point, 14 px
    // apart; each one strikes like an arrow (10 HP, a chip in the ground) and the wind bends them.
    id: 'arrowRain',
    behavior: 'strike',
    ...TOOL,
    windPct: 100,
    damage: 10,
    chipRadius: 3,
    knockbackPct: 30,
    ammo: 1,
    strike: { count: 12, spacing: 14, speed: 2 * 256, range: 1600, height: 300 },
  },
  {
    id: 'mace',
    behavior: 'melee',
    projectileRadius: 0,
    windPct: 0,
    maxSpeed: 0,
    damage: 30,
    explosionRadius: 0,
    knockbackPct: 320,
    bouncePct: 0,
    defaultFuse: 0,
    ammo: -1,
    reach: 34,
    knockbackMinPct: 20,
    needsTarget: true,
  },
  {
    // Épée (2026-10-25): a level blow on the side the unit faces, struck at once, light recoil.
    id: 'sword',
    behavior: 'melee',
    projectileRadius: 0,
    windPct: 0,
    maxSpeed: 0,
    damage: 25,
    explosionRadius: 0,
    knockbackPct: 100,
    bouncePct: 0,
    defaultFuse: 0,
    ammo: -1,
    reach: 34,
    frontal: true,
    needsTarget: true,
  },
  {
    // Charge à l'écu (2026-10-25): a run of 120 px along the facing side, at 6 px a tick; every
    // unit met takes 20 HP and is thrown ahead, a barrel met goes up, a coffer bursts.
    id: 'shieldCharge',
    behavior: 'charge',
    projectileRadius: 0,
    windPct: 0,
    maxSpeed: 0,
    damage: 20,
    explosionRadius: 0,
    knockbackPct: 250,
    bouncePct: 0,
    defaultFuse: 0,
    ammo: -1,
    charge: { distance: 120, speed: 6 * 256 },
  },
  {
    // Grappin (2026-10-25): a hook shot along the aim catches the first ground within 400 px;
    // the unit hangs and swings from it (← → push, ↑ ↓ haul in or pay out), lets go with a
    // jump, and may shoot it again in the air. Not the turn's action: a shot may follow.
    id: 'grapple',
    behavior: 'rope',
    ...TOOL,
    ammo: 5,
    free: true,
    rope: { length: 400, minLength: 30, climbSpeed: 3 * 256, pump: 12 },
  },
  {
    // Échelle (2026-10-25): a ladder of 200 px set up just in front of the unit (against a wall
    // within 40 px); setting it is not the turn's action, climbing it is (as any ladder).
    id: 'ladder',
    behavior: 'ladder',
    ...TOOL,
    ammo: 2,
    free: true,
    ladder: { height: 200 },
  },
  {
    // Bannière (2026-10-25): held up for the next fall of the turn: down at 2 px a tick, carried
    // by the wind, no fall damage. Not the turn's action; it opens in the air as well.
    id: 'banner',
    behavior: 'banner',
    ...TOOL,
    ammo: 3,
    free: true,
    banner: { fallSpeed: 2 * 256, windDrift: 40 },
  },
  {
    // Pioche: 3 s straight down; about 90 px in earth, twice that for a sapper.
    id: 'pick',
    behavior: 'dig',
    ...TOOL,
    ammo: 2,
    dig: { ticks: 3 * 60, speed: 128, radius: 17, along: 'down' },
  },
  {
    // Sape: 4 s of tunnel, level or diagonal; about 180 px in earth, twice that for a sapper.
    id: 'sap',
    behavior: 'dig',
    ...TOOL,
    ammo: 2,
    dig: { ticks: 4 * 60, speed: 192, radius: 17, along: 'aim', needsMatter: true },
  },
  {
    id: 'caltrop',
    behavior: 'mine',
    ...TOOL,
    damage: 40,
    explosionRadius: 50,
    knockbackPct: 100,
    ammo: 2,
    mine: { armTicks: 2 * 60, triggerRadius: 8, chainDelay: 8 },
  },
  {
    id: 'stoneWall',
    behavior: 'build',
    ...TOOL,
    ammo: 2,
    defaultFuse: 2 * 60,
    wall: { short: 48, medium: 80, long: 120, thickness: 14, reach: 320, fall: true },
  },
  {
    // Miracle (2026-10-25): the unit is set down on the free point clicked (or along the aim, as
    // far as the gauge says), dropping onto the ground below it; the turn ends there.
    id: 'miracle',
    behavior: 'teleport',
    ...TOOL,
    ammo: 1,
    endsTurn: true,
    teleport: { reach: 900 },
  },
];
