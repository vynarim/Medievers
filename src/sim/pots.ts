// Pots with a fuse counted in turns (GDD §4.1, BACKLOG 4.10): with a fuse of 2 or 3 the pot does
// not go off during the throw; once it comes to rest it stays on the map, counting down at each
// turn start, until it explodes. Explosions throw resting pots about; a pot whose ground goes falls.
import type { WeaponDef } from '../content/weapons.ts';
import type { SimEvent } from './events.ts';
import { queueExplosion, type Explosion } from './explosions/explosion.ts';
import { SUBPX, idiv, subToPx } from './math/fixed.ts';
import { isqrt } from './math/isqrt.ts';
import { createProjectile } from './projectiles/projectile.ts';
import type { FlyingShot, SimState } from './state.ts';
import { isSolid } from './terrain/terrain.ts';

/** sub-px/tick: a bouncing pot slower than this, after touching the ground, is at rest */
const REST_SPEED = 2 * SUBPX;
/** ticks: a pot still moving after this long is put down where it is (never blocks a turn) */
const MAX_FLIGHT = 10 * 60;
/** sub-px/tick: speed a blast gives a resting pot, plus an upward lift of half of it */
const BLAST_THROW = 6 * SUBPX;
/** ticks a lit pot waits at the start of its turn before it goes off */
const LIGHT_DELAY = 30;

/** Turns a fuse setting (1 to 3) of a turn-fused weapon gives: 0 = this turn, in seconds. */
export function fuseTurnsOf(def: WeaponDef, fuseTicks: number): number {
  const n = Math.max(1, Math.min(3, Math.round(fuseTicks / 60)));
  return def.fuseTurns === undefined ? 0 : n - 1;
}

/** A turn-fused pot in flight: put it down once it rests (after a bounce) or flew too long. */
export function maybeRest(s: SimState, shot: FlyingShot, bounced: boolean, events: SimEvent[]) {
  const p = shot.projectile;
  const slow = Math.abs(p.vx) + Math.abs(p.vy) < REST_SPEED;
  if (!((bounced && slow) || p.age > MAX_FLIGHT)) return false;
  s.pots.push({
    id: p.id,
    x: p.x,
    y: p.y,
    turns: shot.turns ?? 0,
    weapon: shot.weapon,
    ...(shot.damagePct !== undefined ? { damagePct: shot.damagePct } : {}),
  });
  s.pots.sort((a, b) => a.id - b.id);
  events.push({ e: 'potPlaced', id: p.id, turns: shot.turns ?? 0 });
  return true;
}

/** Puts a resting pot back in flight, with the given velocity. */
function relaunch(s: SimState, index: number, vx: number, vy: number): void {
  const pot = s.pots[index];
  if (!pot) return;
  s.pots.splice(index, 1);
  const def = s.rules.weapons.find((w) => w.id === pot.weapon);
  const projectile = createProjectile(pot.id, 0, pot.x, pot.y - 2 * SUBPX, vx, vy, {
    radius: def?.projectileRadius ?? 5,
    windPct: def?.windPct ?? 0,
    gravityPct: 100,
  });
  projectile.clearOfOwner = true;
  s.shots.push({
    projectile,
    weapon: pot.weapon,
    fuse: 0,
    turns: pot.turns,
    ...(pot.damagePct !== undefined ? { damagePct: pot.damagePct } : {}),
  });
  s.shots.sort((a, b) => a.projectile.id - b.projectile.id);
}

/** Start of a turn: every resting pot counts down; the ones at 0 go off. */
export function potsTurn(s: SimState, events: SimEvent[]): void {
  for (let i = s.pots.length - 1; i >= 0; i--) {
    const pot = s.pots[i];
    if (!pot) continue;
    pot.turns--;
    if (pot.turns > 0) continue;
    s.pots.splice(i, 1);
    const def = s.rules.weapons.find((w) => w.id === pot.weapon);
    queueExplosion(s.explosions, s.tick + LIGHT_DELAY, {
      x: pot.x,
      y: pot.y - 4 * SUBPX,
      radius: def?.explosionRadius ?? 0,
      carveRadius: def?.explosionRadius ?? 0,
      maxDamage: idiv((def?.damage ?? 0) * (pot.damagePct ?? 100) + 50, 100),
      sourceId: pot.id,
      ...(def?.flames && s.rules.flames ? { flames: true } : {}),
    });
    events.push({ e: 'potLit', id: pot.id });
  }
}

/** A blast throws the resting pots it reaches away from its centre. */
export function blastMovesPots(s: SimState, e: Explosion): void {
  for (let i = s.pots.length - 1; i >= 0; i--) {
    const pot = s.pots[i];
    if (!pot) continue;
    const dx = pot.x - e.x;
    const dy = pot.y - e.y;
    const d = isqrt(dx * dx + dy * dy);
    if (d > e.radius * SUBPX) continue;
    const vx = d === 0 ? 0 : idiv(dx * BLAST_THROW, d);
    const vy = (d === 0 ? 0 : idiv(dy * BLAST_THROW, d)) - (BLAST_THROW >> 1);
    relaunch(s, i, vx, vy);
  }
}

/** Each tick: a resting pot whose ground is gone starts falling. */
export function stepPots(s: SimState): void {
  for (let i = s.pots.length - 1; i >= 0; i--) {
    const pot = s.pots[i];
    if (!pot) continue;
    const x = subToPx(pot.x);
    const y = subToPx(pot.y);
    if (!isSolid(s.terrain, x, y + 1) && !isSolid(s.terrain, x, y + 6)) relaunch(s, i, 0, 0);
  }
}
