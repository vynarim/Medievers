// The AI's turn (GDD §7.2): for each unit it may send and each place it may shoot from, it looks
// for throws that reach the enemy (a sweep of the real projectile's flight, then a finer search),
// plays the best candidates to the end of the turn in its sandbox, on the real sim, scores what
// they did, and keeps the best. With nothing worth a shot, it closes in on the enemy. It sees
// what its house sees: the enemy's chausse-trapes are taken out of its copy of the match.
import { AI_SCORE, type AiLevel } from '../content/ai.ts';
import { isProjectile, isTargeted, type WeaponDef } from '../content/weapons.ts';
import { classOf, mayUse, visibleMines } from '../sim/classes.ts';
import { MAX_POWER } from '../sim/commands.ts';
import type { SimEvent } from '../sim/events.ts';
import { ANGLE_MASK, atan2Bam, cosQ14, sinQ14 } from '../sim/math/angle.ts';
import { SUBPX, mulQ14, subToPx } from '../sim/math/fixed.ts';
import { createPrng, nextRange, type PrngState } from '../sim/math/prng.ts';
import { createProjectile, stepProjectile } from '../sim/projectiles/projectile.ts';
import { DRAGON_HALF_HEIGHT, DRAGON_HALF_WIDTH } from '../content/dragon.ts';
import { canPlace, canSwitchUnit, type Sim, type SimView } from '../sim/sim.ts';
import type { SimState } from '../sim/state.ts';
import type { Terrain } from '../sim/terrain/terrain.ts';
import { ropeTarget } from '../sim/units/climb.ts';
import { UNIT_HALF_WIDTH, UNIT_HEIGHT, type Unit } from '../sim/units/unit.ts';
import { shotSpeed } from '../sim/weapons/weapons.ts';
import { Sandbox } from './sandbox.ts';
import { SANDBOX_PACE, TurnScript, type AiMove, type AiPlan, type AiShot } from './script.ts';

/** px from the muzzle to the body centre, as the sim fires (weapons.ts) */
const MUZZLE = 20;
/** px between two columns tried for a placement, outwards from the one the match proposes */
const PLACE_STEP = 8;
/** ticks a sweep follows a throw at most */
const FLIGHT_MAX = 480;
/** ticks of stillness after which a play with only the dragon moving is over */
const QUIET_TICKS = 30;
/** ticks a candidate is played for at most, to the end of its turn */
const PLAY_MAX = 2400;
/** BAM: the sweep goes from a little under level on one side to the same on the other */
const SWEEP_FROM = 1792;
const SWEEP_TO = 4352;
/** the best throws also tried a little off, on each side (the shake of the hand) */
const ROBUST = 3;
/** enemies a throw is searched for more finely, the nearest the sweep came first */
const REFINED = 2;
/** px: walks tried, towards the enemy first, then away */
const WALKS = [70, 140, 210, 270, 35, -70, -140, -210];

export interface PlanInput {
  /** the match as it stands, at the start of the AI's turn (or during its transition) */
  readonly state: SimState;
  readonly team: number;
  readonly level: AiLevel;
  /** seed of the AI's own randomness (its aim's shake): from the match seed and the turn */
  readonly seed: number;
}

export interface PlanResult {
  readonly plan: AiPlan;
  readonly score: number;
  /** throws played in full, and moves tried */
  readonly played: number;
}

interface Candidate {
  readonly unitId: number;
  readonly move: AiMove;
  readonly shot: AiShot;
  /** rough worth, to choose which ones to play in full */
  readonly guess: number;
  /** a throw at the dragon */
  readonly dragon?: boolean;
}

/** The match as the AI's house sees it: without the enemy chausse-trapes it cannot see. */
export function asSeen(state: SimState, team: number): SimState {
  const s = structuredClone(state);
  const view = { ...s, turn: { ...s.turn, activeTeam: team } };
  const seen = new Set(visibleMines(view, team).map((m) => m.id));
  s.mines = s.mines.filter((m) => seen.has(m.id));
  return s;
}

const centreY = (u: Pick<Unit, 'y'>): number => u.y - (UNIT_HEIGHT * SUBPX) / 2;

function enemiesOf(v: SimView, team: number): Readonly<Unit>[] {
  return v.units.filter((u) => u.alive && u.team !== team);
}

/** px from (x, y) to the nearest living enemy. */
function nearestEnemy(v: SimView, team: number, x: number): number {
  let best = Infinity;
  for (const e of enemiesOf(v, team)) best = Math.min(best, Math.abs(subToPx(e.x) - x));
  return best;
}

/** The score of the end of a turn against its start (GDD §7.2). */
function scoreOutcome(
  before: SimView,
  after: SimView,
  team: number,
  unitId: number,
  drowned: ReadonlySet<number>,
  level: AiLevel,
): number {
  let score = 0;
  const regicide = before.rules.regicide === true;
  for (const b of before.units) {
    if (!b.alive) continue;
    const a = after.units.find((x) => x.id === b.id);
    const hp = Math.max(0, b.hp - Math.max(0, a?.alive ? a.hp : 0));
    const dead = !a?.alive;
    const king = regicide && classOf(before, b) === 'king';
    const weight = king ? AI_SCORE.kingFactor : 1;
    if (b.team !== team) {
      score += hp * AI_SCORE.enemyHp * weight;
      if (dead) score += (drowned.has(b.id) ? AI_SCORE.enemyDrowned : AI_SCORE.enemyKill) * weight;
    } else if (b.id === unitId) {
      score += hp * AI_SCORE.selfHp * weight;
      if (dead) score += AI_SCORE.selfDeath * weight;
    } else {
      score += hp * AI_SCORE.allyHp * weight;
      if (dead) score += AI_SCORE.allyDeath * weight;
    }
  }
  const u = after.units.find((x) => x.id === unitId);
  if (u?.alive) score -= AI_SCORE.approachPerPx * nearestEnemy(after, team, subToPx(u.x));
  // The water to come: below where it will be in three turns, the unit had better climb.
  const flood = after.rules.deluge;
  if (u?.alive && flood && level.floodFear > 0) {
    if (after.deluge || after.turn.number >= flood.startTurn - 3) {
      const line = Math.min(after.waterY, after.terrain.height) - 3 * flood.risePx;
      const below = subToPx(u.y) - line;
      if (below > 0) score -= level.floodFear * below;
    }
  }
  if (after.turn.phase === 'gameOver') score += after.winner === team ? 1000 : -1000;
  return score;
}

/** Sub-px box around the enemies, past which a throw no longer interests the AI. */
interface Field {
  readonly x0: number;
  readonly x1: number;
  readonly y1: number;
}

/** px the box reaches past the enemies */
const FIELD_MARGIN = 300;

function fieldOf(v: SimView, team: number): Field {
  const enemies = enemiesOf(v, team);
  const m = FIELD_MARGIN * SUBPX;
  return {
    x0: Math.min(...enemies.map((e) => e.x)) - m,
    x1: Math.max(...enemies.map((e) => e.x)) + m,
    y1: Math.max(...enemies.map((e) => e.y)) + m,
  };
}

/**
 * Where a throw first lands: the real projectile's flight over the terrain and the units, given
 * up once it is past the enemies and going away.
 */
function landing(
  v: SimView,
  u: Readonly<Unit>,
  def: WeaponDef,
  angle: number,
  power: number,
  field: Field,
  /** the dragon crossing the sky: whether the flight goes through it, where it will be */
  dragon?: { hit: boolean },
): { x: number; y: number; unitId: number | null } {
  const speed = shotSpeed(v as SimState, u as Unit, def, power);
  const d = dragon ? v.dragon : null;
  const dragonSpeed = v.rules.dragon?.speed ?? 0;
  const cy = centreY(u);
  const p = createProjectile(
    0,
    u.id,
    u.x + mulQ14(MUZZLE * SUBPX, cosQ14(angle)),
    cy + mulQ14(MUZZLE * SUBPX, sinQ14(angle)),
    mulQ14(speed, cosQ14(angle)),
    mulQ14(speed, sinQ14(angle)),
    { radius: def.projectileRadius, windPct: def.windPct, gravityPct: 100 },
  );
  const units = v.units as Unit[];
  for (let i = 0; i < FLIGHT_MAX; i++) {
    const hit = stepProjectile(
      p,
      v.terrain as Terrain,
      units,
      v.turn.wind,
      v.rules.wind.accelPerUnit,
    );
    if (d && dragon && !dragon.hit) {
      // Where it will be by then, flying level (its swing is slow beside a flight).
      const dx = d.x + d.dir * dragonSpeed * (i + 1);
      if (
        Math.abs(p.x - dx) <= DRAGON_HALF_WIDTH * SUBPX &&
        Math.abs(p.y - d.y) <= DRAGON_HALF_HEIGHT * SUBPX
      ) {
        dragon.hit = true;
        return { x: p.x, y: p.y, unitId: null };
      }
    }
    if (!hit) {
      if (
        !dragon &&
        ((p.vx > 0 && p.x > field.x1) ||
          (p.vx < 0 && p.x < field.x0) ||
          (p.vy > 0 && p.y > field.y1))
      ) {
        break;
      }
      continue;
    }
    if (hit.kind === 'outOfMap') break;
    return { x: hit.x, y: hit.y, unitId: hit.kind === 'unit' ? hit.unitId : null };
  }
  return { x: -1e9, y: -1e9, unitId: null };
}

/**
 * A throw that goes through the dragon crossing the sky, if any: shot, it swoops on one of the
 * shooter's enemies and swallows it whole (GDD §4.11). The first found, lowest powers first.
 */
export function throwAtDragon(
  v: SimView,
  u: Readonly<Unit>,
  def: WeaponDef,
  level: AiLevel,
): AiShot | null {
  const d = v.dragon;
  if (!d || d.prey !== 0 || d.fed) return null;
  const field = fieldOf(v, u.team);
  const powers = def.fixedPower ? [MAX_POWER] : level.powers;
  for (const power of powers) {
    for (let a = SWEEP_FROM; a < SWEEP_TO; a += level.angleStep) {
      const angle = a & ANGLE_MASK;
      const through = { hit: false };
      landing(v, u, def, angle, power, field, through);
      if (through.hit) return { weapon: def.id, angle, power };
    }
  }
  return null;
}

/** How far a throw lands from enemy `e` (sub-px); 0 on the enemy itself. */
function miss(hit: { x: number; y: number; unitId: number | null }, e: Readonly<Unit>): number {
  if (hit.unitId === e.id) return 0;
  return Math.hypot(hit.x - e.x, hit.y - centreY(e));
}

/**
 * The best throws of weapon `def` from where `u` stands at enemies, one per enemy it can reach:
 * a sweep of angles and powers, then a finer search around the best of each.
 */
function throwsAt(
  v: SimView,
  u: Readonly<Unit>,
  def: WeaponDef,
  level: AiLevel,
  team: number,
): { shot: AiShot; target: Readonly<Unit>; miss: number }[] {
  const enemies = enemiesOf(v, team);
  if (enemies.length === 0) return [];
  const powers = def.fixedPower ? [MAX_POWER] : level.powers;
  const field = fieldOf(v, team);
  const best = enemies.map(() => ({ angle: 0, power: 0, miss: Infinity }));
  for (let a = SWEEP_FROM; a < SWEEP_TO; a += level.angleStep) {
    const angle = a & ANGLE_MASK;
    for (const power of powers) {
      const hit = landing(v, u, def, angle, power, field);
      enemies.forEach((e, i) => {
        const m = miss(hit, e);
        const b = best[i];
        if (b && m < b.miss) best[i] = { angle, power, miss: m };
      });
    }
  }
  const reach = (def.explosionRadius > 0 ? def.explosionRadius : 0) * SUBPX;
  const out: { shot: AiShot; target: Readonly<Unit>; miss: number }[] = [];
  // The finer search only for the enemies the sweep came nearest to.
  const order = enemies
    .map((e, i) => ({ e, i, m: best[i]?.miss ?? Infinity }))
    .sort((a, b) => a.m - b.m)
    .slice(0, REFINED);
  for (const { e, i } of order) {
    let b = best[i];
    if (!b || b.miss === Infinity) continue;
    // A finer search around it: angle and power, by halving steps.
    let da = level.angleStep >> 1;
    let dp = def.fixedPower ? 0 : 96;
    while (da >= 4 && b.miss > 0) {
      let moved = false;
      for (const [sa, sp] of [
        [da, 0],
        [-da, 0],
        [0, dp],
        [0, -dp],
      ] as const) {
        if (sa === 0 && sp === 0) continue;
        const angle: number = (b.angle + sa) & ANGLE_MASK;
        const power = Math.max(64, Math.min(MAX_POWER, b.power + sp));
        const m = miss(landing(v, u, def, angle, power, field), e);
        if (m < b.miss) {
          b = { angle, power, miss: m };
          moved = true;
        }
      }
      if (!moved) {
        da >>= 1;
        dp >>= 1;
      }
    }
    // Close enough to hurt: on the unit for a direct hit, within its blast for the others.
    const close = def.explosionRadius > 0 ? b.miss <= reach * 1.1 : b.miss === 0;
    if (close) {
      out.push({
        shot: { weapon: def.id, angle: b.angle, power: b.power },
        target: e,
        miss: b.miss,
      });
    }
  }
  return out;
}

/** The weapons the unit may take up this turn, among the level's. */
function weaponsFor(v: SimView, u: Readonly<Unit>, level: AiLevel): WeaponDef[] {
  const team = v.teams[u.team];
  return v.rules.weapons.filter((w, i) => {
    if (level.weapons && !level.weapons.includes(w.id)) return false;
    if ((team?.ammo[i] ?? 0) === 0) return false;
    if (!mayUse(v as SimState, u as Unit, w as WeaponDef)) return false;
    return (
      isProjectile(w as WeaponDef) ||
      w.behavior === 'melee' ||
      w.behavior === 'charge' ||
      w.behavior === 'strike'
    );
  }) as WeaponDef[];
}

/** What a hit is roughly worth: damage, more on a weak or royal enemy. */
function guessWorth(
  v: SimView,
  def: WeaponDef,
  target: Readonly<Unit>,
  m: number,
  /** hits it may take: the stones or arrows of a strike that land on it */
  hits = 1,
): number {
  const reach = Math.max(1, def.explosionRadius * SUBPX);
  const one = def.explosionRadius > 0 ? def.damage * Math.max(0, 1 - m / reach) : def.damage;
  const dmg = one * hits;
  let worth = Math.min(dmg, target.hp);
  if (dmg >= target.hp) worth += AI_SCORE.enemyKill;
  if (v.rules.regicide && classOf(v, target) === 'king') worth *= AI_SCORE.kingFactor;
  return worth;
}

/** The moves tried for a unit: stay, walks towards the enemy then away, jumps. */
function movesFor(v: SimView, u: Readonly<Unit>, team: number, level: AiLevel): AiMove[] {
  const x = subToPx(u.x);
  const enemies = enemiesOf(v, team);
  let toward: -1 | 1 = 1;
  let nearest = Infinity;
  for (const e of enemies) {
    const d = subToPx(e.x) - x;
    if (Math.abs(d) < nearest) {
      nearest = Math.abs(d);
      toward = d < 0 ? -1 : 1;
    }
  }
  const moves: AiMove[] = [{ kind: 'stay' }];
  const width = v.terrain.width;
  // Within a walk of an enemy: right beside it, for the mace.
  const budget = v.rules.unit.moveBudget ?? 280;
  if (nearest > 30 && nearest < budget) {
    moves.push({ kind: 'walk', x: x + toward * (nearest - 26) });
  }
  const tries: AiMove[] = [
    ...WALKS.slice(0, 4).map((d): AiMove => ({ kind: 'walk', x: x + toward * d })),
    { kind: 'jump', jump: 'forward', dir: toward },
    ...WALKS.slice(4).map((d): AiMove => ({ kind: 'walk', x: x + toward * d })),
    { kind: 'jump', jump: 'forward', dir: toward > 0 ? -1 : 1 },
  ];
  for (const m of tries) {
    if (moves.length > level.positions) break;
    if (m.kind === 'walk' && (m.x < 8 || m.x > width - 8)) continue;
    moves.push(m);
  }
  // A rope up a wall that hems it in, or down a drop, on either side (« Grimper »).
  if (level.positions >= 6) {
    for (const face of [toward, toward > 0 ? -1 : 1] as const) {
      for (const dir of [-1, 1] as const) {
        if (ropeTarget(v.terrain as Terrain, x, subToPx(u.y), face, dir, v.rules.unit)) {
          moves.push({ kind: 'rope', dir, face });
        }
      }
    }
  }
  return moves;
}

/** The units the house may send: the given one, or the nearest to the enemy if it may choose. */
function shootersOf(v: SimView, team: number, level: AiLevel): number[] {
  const active = v.turn.activeUnitId;
  if (level.units <= 1 || !canSwitchUnit(v)) return [active];
  const ids = v.units
    .filter((u) => u.alive && u.team === team && u.id !== v.turn.restingUnitId)
    .sort((a, b) => nearestEnemy(v, team, subToPx(a.x)) - nearestEnemy(v, team, subToPx(b.x)))
    .map((u) => u.id);
  const out = ids.slice(0, level.units);
  if (!out.includes(active) && ids.includes(active)) out[out.length - 1] = active;
  return out.length > 0 ? out : [active];
}

/**
 * Plays `plan` in the sandbox to the end of its turn; `look` is called once the unit has moved
 * and stands still, with the match at that moment. Returns the score of what happened.
 */
function play(
  box: Sandbox,
  plan: AiPlan,
  team: number,
  level: AiLevel,
  look?: (v: SimView) => void,
): number {
  const sim: Sim = box.load();
  const before = box.state;
  const script = new TurnScript(plan, SANDBOX_PACE);
  const drowned = new Set<number>();
  const turn = before.turn.number;
  let looked = false;
  let quiet = 0;
  for (let i = 0; i < PLAY_MAX; i++) {
    const v = sim.view();
    if (!looked && script.moved) {
      looked = true;
      look?.(v);
    }
    const events: SimEvent[] = sim.step(script.next(v));
    for (const e of events) if (e.e === 'unitDied' && e.cause === 'drowned') drowned.add(e.unitId);
    const after = sim.view();
    if (after.turn.phase === 'gameOver' || after.turn.number !== turn) break;
    // A dragon crossing the sky holds the turn's end for half a minute: once the move has been
    // played and all is still but the dragon (not swooping), what it did is known already.
    quiet = script.done && after.dragon?.prey === 0 && stillBut(after) ? quiet + 1 : 0;
    if (quiet >= QUIET_TICKS) break;
  }
  if (!looked) look?.(sim.view());
  return scoreOutcome(before, sim.view(), team, plan.unitId, drowned, level);
}

/** Nothing moves but the dragon: no shot, blast, falling block, digging, nor unit in motion. */
function stillBut(v: SimView): boolean {
  return (
    v.shots.length === 0 &&
    v.explosions.items.length === 0 &&
    v.blocks.length === 0 &&
    v.dig === null &&
    v.units.every((u) => !u.alive || (u.grounded && u.vx === 0 && u.vy === 0))
  );
}

/** The throws, blows and volleys worth trying from where unit `u` stands after `move`. */
function candidatesFrom(
  at: SimView,
  u: Readonly<Unit>,
  move: AiMove,
  level: AiLevel,
  team: number,
): Candidate[] {
  const out: Candidate[] = [];
  const unitId = u.id;
  for (const def of weaponsFor(at, u, level)) {
    if (isProjectile(def)) {
      for (const t of throwsAt(at, u, def, level, team)) {
        out.push({ unitId, move, shot: t.shot, guess: guessWorth(at, def, t.target, t.miss) });
      }
      // The dragon, sent on the enemy (a direct hit is enough; once per position).
      if (level.dragon && def.behavior === 'directHit' && !out.some((c) => c.dragon)) {
        const shot = throwAtDragon(at, u, def, level);
        if (shot) out.push({ unitId, move, shot, guess: AI_SCORE.enemyKill * 1.5, dragon: true });
      }
    } else if (def.behavior === 'melee') {
      const reach = (def.reach ?? 30) + 16;
      for (const e of enemiesOf(at, team)) {
        const dx = subToPx(e.x) - subToPx(u.x);
        const dy = subToPx(centreY(e)) - subToPx(centreY(u));
        if (Math.abs(dx) > reach || Math.abs(dy) > 50) continue;
        out.push({
          unitId,
          move,
          shot: { weapon: def.id, angle: atan2Bam(dy, dx), power: MAX_POWER },
          guess: guessWorth(at, def, e, 0),
        });
      }
    } else if (def.charge) {
      // A run at the enemies standing level with it, within its length: towards each side once.
      const run = def.charge.distance + 2 * UNIT_HALF_WIDTH;
      for (const dir of [-1, 1] as const) {
        const met = enemiesOf(at, team).filter((e) => {
          const dx = (subToPx(e.x) - subToPx(u.x)) * dir;
          return dx > 0 && dx <= run && Math.abs(subToPx(e.y) - subToPx(u.y)) <= 40;
        });
        if (met.length === 0) continue;
        out.push({
          unitId,
          move,
          shot: { weapon: def.id, angle: dir > 0 ? 0 : 2048, power: MAX_POWER },
          guess: met.reduce((sum, e) => sum + guessWorth(at, def, e, 0), 0),
        });
      }
    } else if (isTargeted(def) && move.kind === 'stay') {
      // A volley from off the map: on each enemy, from the side it stands on.
      for (const e of enemiesOf(at, team)) {
        const ex = subToPx(e.x);
        out.push({
          unitId,
          move,
          shot: {
            weapon: def.id,
            angle: ex >= subToPx(u.x) ? 3584 : 2560,
            power: MAX_POWER,
            at: { x: ex, y: subToPx(e.y) },
          },
          // Two stones of a volley, or three arrows of the rain, may well fall on it.
          guess: guessWorth(at, def, e, 0, def.explosionRadius > 0 ? 2 : 3) * 0.8,
        });
      }
    }
  }
  return out;
}

/** The AI's plan for its house's turn. */
export function planTurn(input: PlanInput): PlanResult {
  const { team, level } = input;
  const box = new Sandbox(asSeen(input.state, team));
  const v0 = box.state as SimView;
  let best: { plan: AiPlan; score: number } | null = null;
  const consider = (plan: AiPlan, score: number): void => {
    if (!best || score > best.score) best = { plan, score };
  };
  let played = 0;
  const candidates: Candidate[] = [];

  for (const unitId of shootersOf(v0, team, level)) {
    const unit = v0.units.find((u) => u.id === unitId);
    if (!unit) continue;
    for (const move of movesFor(v0, unit, team, level)) {
      // Moving there and passing: what the move alone is worth, and, once there, a look around
      // for throws (on the sandbox's live match, before the turn goes on).
      const stay: AiPlan = { unitId, move, shot: null };
      const score = play(box, stay, team, level, (at) => {
        const u = at.units.find((x) => x.id === unitId);
        if (u?.alive && at.turn.phase === 'action') {
          candidates.push(...candidatesFrom(at, u, move, level, team));
        }
      });
      played++;
      consider(stay, score);
    }
  }

  // The most promising throws, played to the end of the turn.
  candidates.sort((a, b) => b.guess - a.guess);
  const shots: { plan: AiPlan; score: number }[] = [];
  for (const c of candidates.slice(0, level.candidates)) {
    const plan: AiPlan = { unitId: c.unitId, move: c.move, shot: c.shot };
    shots.push({ plan, score: play(box, plan, team, level) });
    played++;
  }
  // The hand shakes: the best throws are tried a little off on each side as well, and count
  // for the mean of their own score and the worse of the two, so that a throw that would burn
  // its own side if slightly off is not taken.
  shots.sort((a, b) => b.score - a.score);
  shots.forEach((s, i) => {
    const shot = s.plan.shot;
    if (i >= ROBUST || !shot || shot.at || level.angleNoise === 0) {
      consider(s.plan, s.score);
      return;
    }
    const off = Math.round((level.angleNoise * 2) / 3);
    const worst = Math.min(
      ...[-off, off].map((d) =>
        play(
          box,
          { ...s.plan, shot: { ...shot, angle: (shot.angle + d) & ANGLE_MASK } },
          team,
          level,
        ),
      ),
    );
    played += 2;
    consider(s.plan, (s.score + worst) / 2);
  });
  const chosen = best as { plan: AiPlan; score: number } | null;
  const plan = chosen?.plan ?? { unitId: v0.turn.activeUnitId, move: { kind: 'stay' }, shot: null };
  return { plan: shaken(plan, level, createPrng(input.seed)), score: chosen?.score ?? 0, played };
}

/** The plan as the AI's hand plays it: its aim off by its level's shake (GDD §7.3). */
function shaken(plan: AiPlan, level: AiLevel, prng: PrngState): AiPlan {
  const shot = plan.shot;
  if (!shot || shot.at || level.angleNoise + level.powerNoisePct === 0) return plan;
  const angle = (shot.angle + nextRange(prng, -level.angleNoise, level.angleNoise)) & ANGLE_MASK;
  const pct = nextRange(prng, -level.powerNoisePct, level.powerNoisePct);
  const power = Math.max(64, Math.min(MAX_POWER, Math.round((shot.power * (100 + pct)) / 100)));
  return { ...plan, shot: { ...shot, angle, power } };
}

/**
 * Where the AI puts its next unit during the placement: where the match proposes, or the
 * nearest column allowed (a unit already stands there, say), as the sim does when time runs out.
 */
export function planPlacement(v: SimView): number | null {
  const next = v.placing[0];
  if (!next) return null;
  for (let d = 0; d < v.terrain.width; d += PLACE_STEP) {
    for (const x of d === 0 ? [next.x] : [next.x + d, next.x - d]) if (canPlace(v, x)) return x;
  }
  return null;
}
