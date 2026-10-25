// Burlesque commentary (GDD §1, tone): turns sim events into turn announcements, phylactery
// quips and comic-book onomatopoeias. Cosmetic only: draws with Math.random, never the sim PRNG.
import { FACTIONS, unitName } from '../content/factions.ts';
import { SUBPX } from '../sim/math/fixed.ts';
import type { SimEvent } from '../sim/events.ts';
import type { SimView } from '../sim/sim.ts';
import { UNIT_HEIGHT } from '../sim/units/unit.ts';
import type { Hud } from './hud.ts';
import { houseName } from './house-names.ts';
import { pick, t, variantCount } from './i18n.ts';
import { showEndScreen } from './end-screen.ts';
import { COLORS } from './tokens.ts';
import { uiRoot } from './overlay.ts';

/** A word or number popping up in the world, in px. */
export interface Pop {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly kind: 'boom' | 'whack' | 'damage' | 'miss' | 'heal';
}

/** ticks to wait after a shot ends before calling it a miss */
const MISS_DELAY_TICKS = 20;

export class Commentary {
  private readonly hud: Hud;
  private readonly replay: () => void;
  /** « Revoir la partie » */
  private readonly watch: () => void;
  /** state of the turn being played */
  private fired = false;
  private damage = 0;
  private quipped = false;
  private lastUnit = -1;
  /** the ends of the map are already on fire */
  private burning = false;
  /** said once per tick: a cleric's blessing, a house leaving after its king */
  private blessed = false;
  private kingFell = false;
  /** the structure about to fall has lost its footing, rather than its HP */
  private undermined = false;
  /** closes the end screen, while it is up */
  private endScreen: (() => void) | null = null;
  /** last state seen of each structure, by id */
  private readonly structureStates = new Map<number, number>();
  /** a shot ended without damage so far: tick, impact point and shooter, to call the miss */
  private pendingMiss: { tick: number; x: number; y: number; unitId: number } | null = null;

  constructor(hud: Hud, replay: () => void, watch: () => void) {
    this.hud = hud;
    this.replay = replay;
    this.watch = watch;
  }

  /** Centre banner for a turn that starts; also called for the first turn of a match. */
  announceTurn(turn: number, team: number, unitId: number, now: number): void {
    this.fired = false;
    this.damage = 0;
    this.quipped = false;
    this.pendingMiss = null;
    this.lastUnit = unitId;
    const f = FACTIONS[team];
    const house = houseName(team);
    const name = unitName(unitId);
    // The units' names are written in their house's ink by the HUD.
    this.hud.announce(
      t('hud.turn', { n: turn }),
      `${house} · ${name}`,
      pick('quip.turn', { name, house }),
      f?.ink ?? COLORS.encre,
      now,
    );
  }

  /** A big « Patatras ! » over a structure that falls. */
  private fallPop(v: SimView, id: number): Pop[] {
    const st = v.structures.find((x) => x.id === id);
    if (!st) return [];
    const [x, y, w] = st.rect;
    return [{ x: x + w / 2, y: y - 20, text: pick('crash'), kind: 'boom' }];
  }

  /**
   * Reacts to one tick's events; returns the pops to draw in the world. `shotAt` gives the last
   * drawn position of a projectile (px), which the sim no longer holds once the shot has ended.
   */
  react(
    events: readonly SimEvent[],
    v: SimView,
    now: number,
    shotAt: (shotId: number) => { x: number; y: number } | null,
  ): Pop[] {
    const pops: Pop[] = [];
    this.blessed = false;
    this.kingFell = false;
    const exploded = events.some((e) => e.e === 'explosion');
    const house = houseName;
    for (const e of events) {
      switch (e.e) {
        case 'turnStarted': {
          if (this.lastUnit >= 0) {
            const name = unitName(this.lastUnit);
            if (!this.fired) this.hud.say(pick('quip.skip', { name }), now);
            else if (this.pendingMiss) this.hud.say(pick('quip.miss', { name }), now);
          }
          this.announceTurn(e.turn, e.team, e.unitId, now);
          break;
        }
        case 'shotFired': {
          this.fired = true;
          const b = v.rules.weapons.find((w) => w.id === e.weapon)?.behavior;
          const tool =
            b === 'dig'
              ? 'quip.dig'
              : b === 'mine'
                ? 'quip.mine'
                : b === 'build'
                  ? 'quip.wall'
                  : b === 'strike'
                    ? 'quip.strike'
                    : 'quip.fire';
          // A tool is not a shot that can miss.
          if (tool !== 'quip.fire' && tool !== 'quip.strike') this.pendingMiss = null;
          // A weapon with quips of its own says them (the sword, the charge…).
          const own = `quip.weapon.${e.weapon}`;
          this.hud.say(
            pick(variantCount(own) > 0 ? own : tool, {
              name: unitName(v.turn.activeUnitId),
              house: house(v.turn.activeTeam),
            }),
            now,
          );
          break;
        }
        case 'mineSprung':
          this.hud.say(pick('quip.mineSprung'), now, 'bad');
          break;
        case 'jumpRefused':
          this.hud.say(t('quip.jumpRefused', { name: unitName(e.unitId) }), now);
          break;
        case 'toolRefused':
          this.hud.say(
            t(
              e.weapon === 'mace'
                ? 'quip.strikeRefused'
                : e.weapon === 'sap'
                  ? 'quip.sapRefused'
                  : 'quip.toolRefused',
            ),
            now,
          );
          break;
        case 'shotEnded': {
          const at = shotAt(e.shotId);
          const b = v.rules.weapons.find((w) => w.id === v.turn.weapon)?.behavior;
          const tool = b === 'dig' || b === 'mine' || b === 'build';
          if (this.damage === 0 && at && !tool) {
            this.pendingMiss = { tick: v.tick, ...at, unitId: v.turn.activeUnitId };
          }
          break;
        }
        case 'explosion':
          pops.push({ x: e.x / SUBPX, y: e.y / SUBPX - 40, text: pick('boom'), kind: 'boom' });
          break;
        case 'unitDamaged': {
          this.damage += e.damage;
          const u = v.units.find((x) => x.id === e.unitId);
          if (!u) break;
          const x = u.x / SUBPX;
          const y = u.y / SUBPX - UNIT_HEIGHT;
          pops.push({ x, y: y - 20, text: `−${e.damage}`, kind: 'damage' });
          if (!exploded) pops.push({ x: x + 40, y: y - 60, text: pick('whack'), kind: 'whack' });
          if (!this.quipped) {
            this.quipped = true;
            const params = { name: unitName(u.id), damage: e.damage };
            const kind =
              u.id === v.turn.activeUnitId
                ? 'quip.self'
                : u.team === v.turn.activeTeam
                  ? 'quip.friendly'
                  : 'quip.hit';
            this.hud.say(pick(kind, params), now, 'bad');
          }
          break;
        }
        case 'kitchenAppeared':
          this.hud.say(pick('quip.kitchen'), now);
          break;
        case 'kitchenUsed': {
          const u = v.units.find((x) => x.id === e.unitId);
          const name = unitName(e.unitId);
          this.hud.say(
            pick(e.heal > 0 ? 'quip.soup' : 'quip.soupFull', { name, heal: e.heal }),
            now,
            e.heal > 0 ? 'good' : null,
          );
          if (u && e.heal > 0) {
            pops.push({
              x: u.x / SUBPX,
              y: u.y / SUBPX - UNIT_HEIGHT - 20,
              text: `+${e.heal}`,
              kind: 'heal',
            });
          }
          break;
        }
        case 'placeRefused':
          this.hud.say(t('hud.placeRefused'), now);
          break;
        case 'potPlaced':
          // A pot laid for a later turn is not a miss.
          this.pendingMiss = null;
          this.hud.say(pick('quip.potPlaced'), now);
          break;
        case 'potLit':
          this.hud.say(pick('quip.potLit'), now);
          break;
        case 'beastAppeared':
          this.hud.say(pick(e.kind === 0 ? 'quip.hare' : 'quip.snail'), now);
          break;
        case 'beastStruck':
          this.hud.say(pick(`quip.trick${e.trick}`, { name: unitName(e.unitId) }), now, 'bad');
          break;
        case 'beastKilled':
          this.hud.say(pick('quip.beastKilled'), now, 'good');
          break;
        case 'dragonAppeared':
          this.hud.say(pick('quip.dragon'), now);
          break;
        case 'angelLift':
          this.hud.say(pick('quip.angelLift', { name: unitName(e.unitId) }), now);
          break;
        case 'angelDropped':
          this.hud.say(pick('quip.angelDropped', { name: unitName(e.unitId) }), now, 'bad');
          break;
        case 'towerAlight':
          this.hud.say(pick('quip.towerAlight'), now, 'bad');
          break;
        case 'towerBurnt':
          this.hud.say(pick('quip.towerBurnt'), now, 'bad');
          break;
        case 'washedUp':
          this.hud.say(pick('quip.washedUp', { name: unitName(e.unitId) }), now, 'bad');
          break;
        case 'unicornAppeared':
          this.hud.say(pick('quip.unicorn'), now);
          break;
        case 'unicornTouched':
          this.hud.say(
            pick('quip.unicornTouched', { name: unitName(e.unitId), heal: e.heal }),
            now,
            'good',
          );
          break;
        case 'dragonEnraged':
          this.hud.say(pick('quip.dragonEnraged', { name: unitName(e.unitId) }), now, 'bad');
          break;
        case 'panicked':
          this.hud.say(pick('quip.panicked', { name: unitName(e.unitId) }), now, 'bad');
          break;
        case 'crateDropped':
          this.hud.say(pick('quip.crate'), now);
          break;
        case 'crateTaken': {
          const name = unitName(e.unitId);
          const w = v.rules.weapons[e.weapon];
          if (e.kind === 1) {
            this.hud.say(pick('quip.crateBalm', { name, heal: e.heal }), now, 'good');
            const u = v.units.find((x) => x.id === e.unitId);
            if (u && e.heal > 0) {
              pops.push({
                x: u.x / SUBPX,
                y: u.y / SUBPX - UNIT_HEIGHT - 20,
                text: `+${e.heal}`,
                kind: 'heal',
              });
            }
          } else if (w) {
            this.hud.say(
              pick('quip.crateWeapon', { name, weapon: t(`weapons.${w.id}`) }),
              now,
              'good',
            );
          }
          break;
        }
        case 'crateBurst':
          if (e.trap) this.hud.say(pick('quip.crateTrap'), now, 'bad');
          break;
        case 'rainStarted':
          this.hud.say(pick('quip.rain'), now);
          break;
        case 'rainStopped':
          this.hud.say(pick('quip.rainStop'), now);
          break;
        case 'lightning':
          pops.push({ x: e.x, y: e.y - 60, text: pick('thunder'), kind: 'boom' });
          this.hud.say(pick('quip.lightning'), now, 'bad');
          break;
        case 'burnMet':
          this.hud.say(pick('quip.burnMet'), now);
          break;
        case 'burnSpread':
          this.hud.say(pick(this.burning ? 'quip.burn' : 'quip.burnStart'), now, 'bad');
          this.burning = true;
          break;
        case 'structureHit':
          // Said when the structure gets worse (cracked, then ruined), not at every scratch.
          if ((e.state === 1 || e.state === 2) && this.structureStates.get(e.id) !== e.state) {
            this.hud.say(pick(`quip.structure${e.state}`), now);
          }
          this.structureStates.set(e.id, e.state);
          break;
        case 'structureUndermined':
          this.undermined = true;
          break;
        case 'structureFell':
          pops.push(...this.fallPop(v, e.id));
          this.hud.say(pick(this.undermined ? 'quip.undermined' : 'quip.structureFell'), now);
          this.undermined = false;
          break;
        case 'crushed':
          this.hud.say(pick('quip.crushed', { name: unitName(e.unitId) }), now, 'bad');
          break;
        case 'delugeStarted':
          this.hud.announce(
            t('hud.deluge'),
            t('hud.delugeSub'),
            pick('quip.deluge'),
            COLORS.lapis,
            now,
          );
          break;
        case 'waterRose':
          if (!events.some((x) => x.e === 'delugeStarted')) this.hud.say(pick('quip.water'), now);
          break;
        case 'kitchenGone':
          this.hud.say(pick('quip.kitchenGone'), now, 'bad');
          break;
        case 'unitHealed': {
          const u = v.units.find((x) => x.id === e.unitId);
          if (!u) break;
          pops.push({
            x: u.x / SUBPX,
            y: u.y / SUBPX - UNIT_HEIGHT - 20,
            text: `+${e.heal}`,
            kind: 'heal',
          });
          if (!this.blessed)
            this.hud.say(pick('quip.bless', { name: unitName(e.unitId) }), now, 'good');
          this.blessed = true;
          break;
        }
        case 'unitDied': {
          const key = {
            outOfMap: 'quip.out',
            hp: 'quip.kill',
            drowned: 'quip.drowned',
            kingFell: 'quip.kingFell',
            dragon: 'quip.dragonAte',
            burnt: 'quip.burnt',
          }[e.cause];
          // The house leaving the field after its king is said once, not per unit.
          if (e.cause === 'kingFell' && this.kingFell) break;
          if (e.cause === 'kingFell') this.kingFell = true;
          this.hud.say(
            pick(key, {
              name: unitName(e.unitId),
              house: house(v.units.find((x) => x.id === e.unitId)?.team ?? 0),
            }),
            now,
            'bad',
          );
          break;
        }
        case 'gameOver': {
          // The Bayeux-style tapestry: the winner parades and feasts, or nobody is left at all.
          const f = e.winner >= 0 ? FACTIONS[e.winner] : undefined;
          this.endScreen?.();
          this.endScreen = showEndScreen(uiRoot(), {
            winner: f
              ? {
                  nameKey: f.nameKey,
                  name: houseName(e.winner),
                  primary: f.primary,
                  secondary: f.secondary,
                }
              : null,
            quip: f ? pick('quip.win', { house: houseName(e.winner) }) : pick('quip.draw'),
            onRestart: this.replay,
            onReplay: this.watch,
          });
          break;
        }
        default:
          break;
      }
    }
    // A miss is called a few ticks after the shot ends, once a delayed blast had its chance.
    const miss = this.pendingMiss;
    if (miss && this.damage > 0) this.pendingMiss = null;
    else if (miss && v.tick >= miss.tick + MISS_DELAY_TICKS) {
      this.pendingMiss = null;
      this.hud.say(pick('quip.miss', { name: unitName(miss.unitId) }), now);
      pops.push({ x: miss.x, y: miss.y - 40, text: pick('oops'), kind: 'miss' });
    }
    return pops;
  }
}
