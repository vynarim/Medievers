// Burlesque commentary (GDD §1, tone): turns sim events into turn announcements, phylactery
// quips and comic-book onomatopoeias. Cosmetic only: draws with Math.random, never the sim PRNG.
import { FACTIONS, unitName } from '../content/factions.ts';
import { SUBPX } from '../sim/math/fixed.ts';
import type { SimEvent } from '../sim/events.ts';
import type { SimView } from '../sim/sim.ts';
import { UNIT_HEIGHT } from '../sim/units/unit.ts';
import type { Hud } from './hud.ts';
import { pick, t } from './i18n.ts';
import { COLORS } from './tokens.ts';

/** A word or number popping up in the world, in px. */
export interface Pop {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly kind: 'boom' | 'whack' | 'damage';
}

export class Commentary {
  private readonly hud: Hud;
  private readonly replay: () => void;
  /** state of the turn being played */
  private fired = false;
  private damage = 0;
  private quipped = false;
  private lastUnit = -1;

  constructor(hud: Hud, replay: () => void) {
    this.hud = hud;
    this.replay = replay;
  }

  /** Centre banner for a turn that starts; also called for the first turn of a match. */
  announceTurn(turn: number, team: number, unitId: number, now: number): void {
    this.fired = false;
    this.damage = 0;
    this.quipped = false;
    this.lastUnit = unitId;
    const f = FACTIONS[team];
    const house = f ? t(f.nameKey) : '';
    const name = unitName(unitId);
    this.hud.announce(
      t('hud.turn', { n: turn }),
      `${house} · ${name}`,
      pick('quip.turn', { name, house }),
      f?.primary ?? COLORS.encre,
      now,
    );
  }

  /** Reacts to one tick's events; returns the pops to draw in the world. */
  react(events: readonly SimEvent[], v: SimView, now: number): Pop[] {
    const pops: Pop[] = [];
    const exploded = events.some((e) => e.e === 'explosion');
    const house = (team: number): string => {
      const f = FACTIONS[team];
      return f ? t(f.nameKey) : '';
    };
    for (const e of events) {
      switch (e.e) {
        case 'turnStarted': {
          if (this.lastUnit >= 0) {
            const prev = unitName(this.lastUnit);
            if (this.fired && this.damage === 0)
              this.hud.say(pick('quip.miss', { name: prev }), now);
            else if (!this.fired) this.hud.say(pick('quip.skip', { name: prev }), now);
          }
          this.announceTurn(e.turn, e.team, e.unitId, now);
          break;
        }
        case 'shotFired':
          this.fired = true;
          this.hud.say(
            pick('quip.fire', {
              name: unitName(v.turn.activeUnitId),
              house: house(v.turn.activeTeam),
            }),
            now,
          );
          break;
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
            this.hud.say(pick(kind, params), now);
          }
          break;
        }
        case 'unitDied':
          this.hud.say(
            pick(e.cause === 'outOfMap' ? 'quip.out' : 'quip.kill', { name: unitName(e.unitId) }),
            now,
          );
          break;
        case 'gameOver': {
          const f = e.winner >= 0 ? FACTIONS[e.winner] : undefined;
          this.hud.announce(
            f ? t('hud.winner', { house: t(f.nameKey) }) : t('hud.draw'),
            t('hud.restart'),
            f ? pick('quip.win', { house: t(f.nameKey) }) : '',
            f?.primary ?? COLORS.encre,
            now,
            { label: t('hud.replay'), run: this.replay },
          );
          break;
        }
        default:
          break;
      }
    }
    return pops;
  }
}
