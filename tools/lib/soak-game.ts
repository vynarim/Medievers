// One match of AI against AI, headless (BACKLOG 5.7): the loop shared by `maps:soak` and the
// balance battery (`tools/battery.ts`). It reports the winner, the length, units stuck, kills by
// weapon, damage dealt and taken by each unit with its class, the AI's planning times, and
// whether the log replays to the same hash.
import { AiController } from '../../src/ai/controller.ts';
import { planTurn } from '../../src/ai/plan.ts';
import { buildMap } from '../../src/app/map-build.ts';
import { defaultSetup, matchConfig, rulesFor, type MatchSetup } from '../../src/app/match-setup.ts';
import { AI_LEVELS, type AiLevelId } from '../../src/content/ai.ts';
import type { ClassId } from '../../src/content/classes.ts';
import { generatedMapId, type MapTheme } from '../../src/content/maps.ts';
import type { GameCommand, TimedCommand } from '../../src/sim/commands.ts';
import type { DamageSource } from '../../src/sim/events.ts';
import { LOG_VERSION, replay, type GameLog } from '../../src/sim/log.ts';
import { Sim } from '../../src/sim/sim.ts';

/** ticks a match may last at most (well beyond any turn limit) */
const MAX_TICKS = 60 * 60 * 90;

/** What one unit did in the match. */
export interface UnitReport {
  readonly id: number;
  readonly team: number;
  readonly cls: ClassId | null;
  /** HP it took from enemies with its own shots, and from its own side */
  readonly dealt: number;
  readonly friendly: number;
  /** enemies it killed (with its shots: the last one to have hurt them before they died) */
  readonly kills: number;
  /** HP it lost, whoever's doing */
  readonly taken: number;
  readonly survived: boolean;
  /** turns it played */
  readonly turns: number;
}

export interface GameReport {
  readonly seed: number;
  readonly mapId: string;
  readonly theme: MapTheme;
  /** team id, -1 draw, null unfinished */
  readonly winner: number | null;
  readonly levels: readonly AiLevelId[];
  readonly turns: number;
  readonly ticks: number;
  readonly error?: string;
  readonly stuck: readonly { unitId: number; x: number; turn: number }[];
  /**
   * deaths by the weapon of the turn (its hits, or the water it threw the victim into during the
   * shot), or their cause: dragon (its bite, whoever angered it), drowned (the Déluge's rising
   * water, or a unit that walked in), outOfMap, kingFell…
   */
  readonly kills: Record<string, number>;
  /** of the weapon kills above, the victims drowned (thrown into the water by the shot) */
  readonly drownedBy?: Record<string, number>;
  /** shots taken with each weapon */
  readonly shots: Record<string, number>;
  /** HP taken from enemies by each weapon */
  readonly weaponDamage: Record<string, number>;
  readonly enemyDamage: number;
  readonly friendlyDamage: number;
  readonly units: readonly UnitReport[];
  readonly planMs: readonly number[];
  readonly replayOk?: boolean;
}

export interface GameOptions {
  readonly theme: MapTheme;
  readonly seed: number;
  /** level of each house */
  readonly levels: readonly AiLevelId[];
  readonly maxTurns: number;
  /** classes of each house's units; absent: the default line-up (one of each class) */
  readonly lineups?: readonly (readonly ClassId[])[];
  /** check that the log replays to the same hash */
  readonly checkReplay?: boolean;
}

/** The active unit can get somewhere: a walk, a jump or a rope moves it at least 4 px. */
function canMove(sim: Sim): boolean {
  const v = sim.view();
  const id = v.turn.activeUnitId;
  const x0 = v.units.find((u) => u.id === id)?.x ?? 0;
  const y0 = v.units.find((u) => u.id === id)?.y ?? 0;
  const tries: GameCommand[] = [
    { t: 'move', dir: 1 },
    { t: 'move', dir: -1 },
    { t: 'jump', kind: 'forward', dir: 1 },
    { t: 'jump', kind: 'forward', dir: -1 },
    { t: 'climb', dir: -1 },
    { t: 'climb', dir: 1 },
  ];
  return tries.some((cmd) => {
    const s = Sim.fromState(sim.snapshot());
    s.step([cmd]);
    for (let i = 0; i < 90; i++) s.step();
    const u = s.view().units.find((w) => w.id === id);
    return Math.abs((u?.x ?? x0) - x0) >= 4 * 256 || Math.abs((u?.y ?? y0) - y0) >= 4 * 256;
  });
}

/**
 * What a blow that took a unit's last HP is put down to (BACKLOG 8.5): the shot of the turn for
 * its hits and for the falls, water, flames and falling blocks it caused while it lasted
 * (`shot`: its weapon, '' outside a shot); else the dragon, the burning parchment, the Déluge, a
 * beast, flames, a fall, the water, a block, the weapon of a blast going off later (a pot), the
 * turn end (lightning and the like), or other.
 */
function fatalSource(
  source: DamageSource | 'lightning' | undefined,
  bitten: boolean,
  shot: string,
  turnEnd: boolean,
): string {
  if (bitten || source === 'dragon') return 'dragon';
  if (source === 'burn' || source === 'deluge' || source === 'beast' || source === 'lightning')
    return source;
  if (shot !== '') return shot;
  if (source === 'water') return 'drowned';
  return source ?? (turnEnd ? 'turnEnd' : 'other');
}

export function playGame(o: GameOptions): GameReport {
  const base = defaultSetup(false);
  const setup: MatchSetup = o.lineups ? { ...base, lineups: o.lineups } : base;
  const rules = rulesFor(setup, {});
  const built = buildMap(o.theme, o.seed);
  const config = matchConfig(built, setup, rules);
  const sim = new Sim(config, o.seed, built.mask);
  const planMs: number[] = [];
  const ctrl = new AiController({
    levels: new Map(o.levels.map((l, team) => [team, AI_LEVELS[l]])),
    seed: o.seed,
    planner: (input) => {
      const t0 = performance.now();
      const r = planTurn(input);
      planMs.push(performance.now() - t0);
      return r;
    },
    pace: { aimPerTick: 24, afterShot: 30, settle: 6 },
    ticksPerSecond: 0,
  });
  const commands: TimedCommand[] = [];
  const kills: Record<string, number> = {};
  const drownedBy: Record<string, number> = {};
  /** units the dragon bit this turn: their damage and death are the dragon's, not the weapon's */
  const bitten = new Set<number>();
  /**
   * what brought each unit's HP to 0 (a weapon, dragon, turnEnd, other): deaths are only called
   * once everything has stopped, at the end of the turn, so the death event cannot tell
   */
  const fatal = new Map<number, string>();
  let lightningAt = -10;
  const shots: Record<string, number> = {};
  const weaponDamage: Record<string, number> = {};
  let enemyDamage = 0;
  let friendlyDamage = 0;
  let weapon = '';
  let shooter = -1;
  /** the unit playing the current turn, credited with it when the next one starts */
  let playing = -1;
  // Damage counts as the active unit's doing between its shot and the end of its turn.
  let shooting = false;
  const per = new Map<
    number,
    { dealt: number; friendly: number; kills: number; taken: number; turns: number }
  >();
  const stat = (id: number) => {
    let s = per.get(id);
    if (!s) per.set(id, (s = { dealt: 0, friendly: 0, kills: 0, taken: 0, turns: 0 }));
    return s;
  };
  /** the unit whose shot last hurt each unit, to credit its death */
  const lastHurtBy = new Map<number, number>();
  const blocked = new Map<number, number>();
  let probed = -1;
  const stuck: { unitId: number; x: number; turn: number }[] = [];
  let error: string | undefined;
  try {
    for (let tick = 1; tick <= MAX_TICKS; tick++) {
      const v = sim.view();
      if (v.turn.phase === 'gameOver' || v.turn.number > o.maxTurns) break;
      const active = v.turn.activeUnitId;
      const team = v.turn.activeTeam;
      const turn = v.turn.number;
      if (v.turn.phase === 'action' && probed !== turn) {
        probed = turn;
        const n = canMove(sim) ? 0 : (blocked.get(active) ?? 0) + 1;
        blocked.set(active, n);
        const u = v.units.find((x) => x.id === active);
        if (n === 3 && u) stuck.push({ unitId: active, x: u.x >> 8, turn });
      }
      if (v.turn.phase === 'action' || v.turn.phase === 'retreat') playing = active;
      const cmds = ctrl.poll(tick, v);
      for (const c of cmds) commands.push([tick, c]);
      /** HP of the units as this tick's events go, from those before it (the view is live) */
      const hp = new Map(v.units.map((u) => [u.id, u.hp]));
      const events = sim.step(cmds);
      const now = sim.view();
      // The end of a turn (fire, water, the dragon…) is nobody's shot.
      const turnEnd = events.some((x) => x.e === 'turnStarted' || x.e === 'gameOver');
      for (const e of events) {
        if (e.e === 'turnStarted') {
          // The turn that ends was played by the unit active at its end (a house may switch).
          if (playing >= 0) stat(playing).turns++;
          weapon = '';
          shooting = false;
          shooter = e.unitId;
          bitten.clear();
        }
        if (e.e === 'dragonBit' || e.e === 'dragonAte') bitten.add(e.unitId);
        // The bolt strikes at a turn's end; its blast goes off on the next tick.
        if (e.e === 'lightning') lightningAt = tick;
        if (e.e === 'unitHealed') hp.set(e.unitId, (hp.get(e.unitId) ?? 0) + e.heal);
        if (e.e === 'shotFired') {
          weapon = e.weapon;
          shooting = true;
          shooter = now.turn.activeUnitId;
          shots[e.weapon] = (shots[e.weapon] ?? 0) + 1;
        }
        if (e.e === 'unitDamaged') {
          stat(e.unitId).taken += e.damage;
          const before = hp.get(e.unitId) ?? 0;
          hp.set(e.unitId, before - e.damage);
          if (before > 0 && before - e.damage <= 0 && !fatal.has(e.unitId)) {
            fatal.set(
              e.unitId,
              fatalSource(
                e.source ?? (tick - lightningAt <= 2 ? 'lightning' : undefined),
                bitten.has(e.unitId),
                shooting && !turnEnd ? weapon : '',
                turnEnd,
              ),
            );
          }
          if (shooting && !turnEnd && !bitten.has(e.unitId)) {
            const victim = now.units.find((u) => u.id === e.unitId);
            lastHurtBy.set(e.unitId, shooter);
            if (victim?.team === team) {
              friendlyDamage += e.damage;
              stat(shooter).friendly += e.damage;
            } else {
              enemyDamage += e.damage;
              stat(shooter).dealt += e.damage;
              weaponDamage[weapon] = (weaponDamage[weapon] ?? 0) + e.damage;
            }
          }
        }
        if (e.e === 'unitDied') {
          // The weapon of the turn is credited with the deaths during its shot (its hits, or the
          // water it threw the victim into); the dragon's bites, the Déluge's rising water and
          // the fires of the turn end are not a weapon's.
          const key =
            bitten.has(e.unitId) || e.cause === 'dragon'
              ? 'dragon'
              : e.cause === 'hp'
                ? (fatal.get(e.unitId) ?? 'other')
                : e.cause === 'drowned'
                  ? (fatal.get(e.unitId) ??
                    fatalSource('water', false, shooting && !turnEnd ? weapon : '', turnEnd))
                  : e.cause;
          kills[key] = (kills[key] ?? 0) + 1;
          if (e.cause === 'drowned' && key === weapon)
            drownedBy[weapon] = (drownedBy[weapon] ?? 0) + 1;
          const by = lastHurtBy.get(e.unitId);
          const victim = now.units.find((u) => u.id === e.unitId);
          const killer = by !== undefined ? now.units.find((u) => u.id === by) : undefined;
          if (killer && victim && killer.team !== victim.team) stat(killer.id).kills++;
        }
      }
      // Healed back from 0 HP (a cleric, a reliquary…) before its death was called: what felled
      // it no longer counts.
      for (const id of fatal.keys()) {
        const u = now.units.find((x) => x.id === id);
        if (u?.alive && u.hp > 0) fatal.delete(id);
      }
    }
  } catch (e) {
    error = e instanceof Error ? (e.stack ?? e.message) : String(e);
  }
  const v = sim.view();
  const log: GameLog = {
    version: LOG_VERSION,
    config,
    seed: o.seed,
    mapId: generatedMapId(o.theme, o.seed),
    commands,
    endTick: v.tick,
  };
  const units: UnitReport[] = v.teams.flatMap((t) =>
    t.unitIds.map((id, rank) => {
      const u = v.units.find((x) => x.id === id);
      const s = stat(id);
      return {
        id,
        team: t.id,
        cls: t.classes?.[rank] ?? null,
        dealt: s.dealt,
        friendly: s.friendly,
        kills: s.kills,
        taken: s.taken,
        survived: u?.alive === true,
        turns: s.turns,
      };
    }),
  );
  return {
    seed: o.seed,
    mapId: log.mapId,
    theme: o.theme,
    winner: v.winner,
    levels: o.levels,
    turns: v.turn.number,
    ticks: v.tick,
    ...(error ? { error } : {}),
    stuck,
    kills,
    drownedBy,
    shots,
    weaponDamage,
    enemyDamage,
    friendlyDamage,
    units,
    planMs,
    ...(o.checkReplay && !error ? { replayOk: replay(log, built.mask).hash() === sim.hash() } : {}),
  };
}
