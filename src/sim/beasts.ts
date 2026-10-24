// Les bêtes des marges (GDD §4.10). Only present when the match rules have `beasts` (absent from
// older logs). Everything happens between two turns, except the lasting tricks (afflictions),
// which act on the victim's own turns.
import { BEAST_HEIGHT, BEAST_REACH, BEAST_WIDTH, BeastKind, Trick } from '../content/beasts.ts';
import type { SimEvent } from './events.ts';
import type { Explosion } from './explosions/explosion.ts';
import { SUBPX, idiv, subToPx } from './math/fixed.ts';
import { isqrt } from './math/isqrt.ts';
import { nextRange } from './math/prng.ts';
import type { SimState } from './state.ts';
import { isSolid } from './terrain/terrain.ts';
import { jump, launch, type Unit } from './units/unit.ts';

/** px between two samples of a hare's bound, to find walls */
const STEP_SAMPLE = 4;
/** px: a unit's feet within this height of the beast's base can be reached */
const REACH_HEIGHT = 80;

function surface(s: SimState, x: number): number | null {
  for (let y = 0; y < s.terrain.height; y++) if (isSolid(s.terrain, x, y)) return y;
  return null;
}

export function hasAffliction(s: SimState, unitId: number, trick: number): boolean {
  return s.afflictions.some((a) => a.unitId === unitId && a.trick === trick);
}

/** Adds (or renews) a lasting trick, keeping the list sorted by unit then trick. */
function afflict(s: SimState, unitId: number, trick: number, turns: number): void {
  const old = s.afflictions.findIndex((a) => a.unitId === unitId && a.trick === trick);
  if (old >= 0) s.afflictions.splice(old, 1);
  s.afflictions.push({ unitId, trick, turns });
  s.afflictions.sort((a, b) => a.unitId - b.unitId || a.trick - b.trick);
}

/** The beast plays its trick on unit u, then goes back to its margin. */
function strike(s: SimState, u: Unit, events: SimEvent[]): void {
  const r = s.rules.beasts;
  const b = s.beast;
  if (!r || !b) return;
  const trick = nextRange(s.prng, 0, 2) + (b.kind === BeastKind.Snail ? Trick.Slime : 0);
  s.beast = null;
  switch (trick) {
    case Trick.Kick: {
      const damage = Math.min(u.hp, r.kickDamage);
      u.hp -= damage;
      events.push({ e: 'unitDamaged', unitId: u.id, damage });
      u.vx += (u.x >= b.x ? 1 : -1) * r.kickSpeed;
      u.vy -= r.kickSpeed >> 1;
      launch(u);
      break;
    }
    case Trick.Steal: {
      // The scarcest limited weapon the house still has a shot of.
      const team = s.teams[u.team];
      let best = -1;
      team?.ammo.forEach((a, i) => {
        if (a > 0 && (best < 0 || a < (team.ammo[best] ?? 0))) best = i;
      });
      if (team && best >= 0) team.ammo[best] = (team.ammo[best] ?? 1) - 1;
      break;
    }
    case Trick.Panic:
    case Trick.Shell:
      afflict(s, u.id, trick, 1);
      break;
    case Trick.Slime:
      afflict(s, u.id, trick, r.slimeTurns);
      break;
    case Trick.Bite:
      afflict(s, u.id, trick, r.biteTurns);
      break;
  }
  events.push({ e: 'beastStruck', kind: b.kind, unitId: u.id, trick });
}

/** The nearest living unit to the beast, along x (ties: lowest id). */
function nearestUnit(s: SimState, x: number): Unit | null {
  let best: Unit | null = null;
  for (const u of s.units) {
    if (!u.alive) continue;
    if (!best || Math.abs(u.x - x) < Math.abs(best.x - x)) best = u;
  }
  return best;
}

/**
 * End of a turn: lasting tricks act, the beast moves on its prey and maybe reaches it, and a new
 * beast may come out of a margin.
 */
export function beastsTurnEnd(s: SimState, events: SimEvent[]): void {
  const r = s.rules.beasts;
  if (!r) return;
  const active = s.turn.activeUnitId;
  // Lasting tricks: bites hurt every turn; shell and slime wear off with the victim's turns.
  for (let i = s.afflictions.length - 1; i >= 0; i--) {
    const a = s.afflictions[i];
    if (!a) continue;
    const u = s.units.find((x) => x.id === a.unitId);
    if (!u?.alive) {
      s.afflictions.splice(i, 1);
      continue;
    }
    if (a.trick === Trick.Bite) {
      const damage = Math.min(u.hp, r.biteDamage);
      u.hp -= damage;
      events.push({ e: 'unitDamaged', unitId: u.id, damage });
      a.turns--;
    } else if ((a.trick === Trick.Shell || a.trick === Trick.Slime) && a.unitId === active) {
      a.turns--;
    }
    if (a.turns <= 0) s.afflictions.splice(i, 1);
  }

  const w = s.terrain.width;
  const b = s.beast;
  if (b) {
    const prey = nearestUnit(s, b.x);
    if (prey) {
      const step = b.kind === BeastKind.Hare ? r.hareStep : r.snailStep;
      const dir = prey.x >= b.x ? 1 : -1;
      // Stop just in front of the prey, or at a wall for a hare.
      const gap = Math.max(0, idiv(Math.abs(prey.x - b.x), SUBPX) - (BEAST_REACH >> 1));
      let x = subToPx(b.x);
      let y = subToPx(b.y);
      for (let moved = 0; moved < Math.min(step, gap); moved += STEP_SAMPLE) {
        const nx = x + dir * Math.min(STEP_SAMPLE, Math.min(step, gap) - moved);
        const ny = surface(s, nx);
        if (ny === null) break;
        if (b.kind === BeastKind.Hare && y - ny > r.hareClimb) break;
        x = nx;
        y = ny;
      }
      b.x = x * SUBPX;
      b.y = y * SUBPX;
      events.push({ e: 'beastMoved', x, y });
      const reach = Math.abs(prey.x - b.x) <= BEAST_REACH * SUBPX;
      if (reach && Math.abs(prey.y - b.y) <= REACH_HEIGHT * SUBPX) strike(s, prey, events);
    }
  }
  // The fire of the parchment drives a beast away.
  if (s.beast) {
    const x = subToPx(s.beast.x);
    if (x < s.burnPx || x >= w - s.burnPx) {
      s.beast = null;
      events.push({ e: 'beastGone' });
    }
  }
  if (!s.beast && nextRange(s.prng, 0, 999) < r.spawnPermille) {
    const kind = nextRange(s.prng, 0, 1);
    const left = nextRange(s.prng, 0, 1) === 0;
    const x = left ? s.burnPx + BEAST_WIDTH : w - 1 - s.burnPx - BEAST_WIDTH;
    const y = surface(s, x);
    if (y !== null && x > 0 && x < w - 1) {
      s.beast = { id: s.nextEntityId++, kind, x: x * SUBPX, y: y * SUBPX };
      events.push({ e: 'beastAppeared', kind, x, y });
    }
  }
}

/** Start of the victim's action: a panicked unit jumps backwards whether it likes it or not. */
export function panicAtAction(s: SimState, events: SimEvent[]): void {
  const u = s.units.find((x) => x.id === s.turn.activeUnitId);
  if (!u?.alive || !hasAffliction(s, u.id, Trick.Panic)) return;
  s.afflictions.splice(
    s.afflictions.findIndex((a) => a.unitId === u.id && a.trick === Trick.Panic),
    1,
  );
  jump(u, 'back', s.rules.unit);
  events.push({ e: 'panicked', unitId: u.id });
}

function inBeast(s: SimState, x: number, y: number): boolean {
  const b = s.beast;
  if (!b) return false;
  const half = (BEAST_WIDTH >> 1) * SUBPX;
  return x >= b.x - half && x <= b.x + half && y <= b.y && y >= b.y - BEAST_HEIGHT * SUBPX;
}

/** True when the segment between two sub-px points crosses the beast (2 px samples). */
export function beastOnSegment(s: SimState, x0: number, y0: number, x1: number, y1: number) {
  if (!s.beast) return false;
  const steps = Math.max(1, idiv(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), 2 * SUBPX));
  for (let i = 0; i <= steps; i++) {
    if (inBeast(s, x0 + idiv((x1 - x0) * i, steps), y0 + idiv((y1 - y0) * i, steps))) return true;
  }
  return false;
}

/** A shot or a blast puts the beast down (GDD §4.10: 10 HP, it brings nothing but peace). */
export function killBeast(s: SimState, events: SimEvent[]): void {
  if (!s.beast) return;
  s.beast = null;
  events.push({ e: 'beastKilled' });
}

export function blastReachesBeast(s: SimState, e: Explosion, events: SimEvent[]): void {
  const b = s.beast;
  if (!b) return;
  const dx = b.x - e.x;
  const dy = b.y - (BEAST_HEIGHT >> 1) * SUBPX - e.y;
  if (isqrt(dx * dx + dy * dy) <= (e.radius + (BEAST_WIDTH >> 1)) * SUBPX) killBeast(s, events);
}
