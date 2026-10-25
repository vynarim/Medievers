// The AI's houses, turn after turn: it places their units, asks for a plan at the start of each
// of their turns (from a Web Worker in the game, at once in the headless tools), waits the time
// it seems to think, then plays the plan with its script. It reads the view and returns
// commands, like a player; it never writes the match.
import type { AiLevel } from '../content/ai.ts';
import type { GameCommand } from '../sim/commands.ts';
import { createPrng, nextRange } from '../sim/math/prng.ts';
import type { SimView } from '../sim/sim.ts';
import type { SimState } from '../sim/state.ts';
import type { PlanInput, PlanResult } from './plan.ts';
import { planPlacement } from './plan.ts';
import { TurnScript, type ScriptPace } from './script.ts';

/** Plans a turn: at once (headless), or later (a Web Worker). */
export type Planner = (input: PlanInput) => PlanResult | Promise<PlanResult>;

export interface AiControllerOptions {
  /** the level of each house the AI plays; the others are not its own */
  readonly levels: ReadonlyMap<number, AiLevel>;
  /** the match seed: the AI's own randomness comes from it */
  readonly seed: number;
  readonly planner: Planner;
  /** how fast its hands go */
  readonly pace: ScriptPace;
  /** ticks per second, to turn the levels' thinking time into ticks; 0: no thinking time */
  readonly ticksPerSecond: number;
}

/** ticks a plan may be waited for before the turn is passed */
const PLAN_TIMEOUT = 20 * 60;
/** ticks before the AI puts down one of its units */
const PLACE_DELAY = 30;

export class AiController {
  private readonly opts: AiControllerOptions;
  private turn = -1;
  private started = 0;
  private thinkTicks = 0;
  private result: PlanResult | null = null;
  private failed = false;
  private script: TurnScript | null = null;
  private placeAt = -1;

  constructor(opts: AiControllerOptions) {
    this.opts = opts;
  }

  /** The AI plays the house whose turn (or placement) it is. */
  plays(v: SimView): boolean {
    if (v.turn.phase === 'placement') {
      const next = v.placing[0];
      return next !== undefined && this.opts.levels.has(next.team);
    }
    return this.opts.levels.has(v.turn.activeTeam);
  }

  /** The last plan's score and the moves it tried, for the debug overlay and the tools. */
  get last(): PlanResult | null {
    return this.result;
  }

  /** The commands of tick `tick`. */
  poll(tick: number, v: SimView): GameCommand[] {
    if (!this.plays(v) || v.turn.phase === 'gameOver') return [];
    if (v.turn.phase === 'placement') {
      if (this.placeAt < 0) this.placeAt = tick + PLACE_DELAY;
      if (tick < this.placeAt) return [];
      this.placeAt = -1;
      const x = planPlacement(v);
      return x === null ? [] : [{ t: 'place', x }];
    }
    const team = v.turn.activeTeam;
    const level = this.opts.levels.get(team);
    if (!level) return [];
    if (v.turn.number !== this.turn) this.begin(tick, v, team, level);
    if (!this.script) {
      if (this.result && tick - this.started >= this.thinkTicks) {
        this.script = new TurnScript(this.result.plan, this.opts.pace);
      } else if (this.failed || tick - this.started > PLAN_TIMEOUT) {
        // No plan came: the turn is passed rather than left to run out.
        this.script = new TurnScript(
          { unitId: v.turn.activeUnitId, move: { kind: 'stay' }, shot: null },
          this.opts.pace,
        );
      } else {
        return [];
      }
    }
    return this.script.next(v);
  }

  private begin(tick: number, v: SimView, team: number, level: AiLevel): void {
    this.turn = v.turn.number;
    this.started = tick;
    this.result = null;
    this.failed = false;
    this.script = null;
    const seed = (this.opts.seed ^ Math.imul(v.turn.number + 1, 0x9e3779b1) ^ (team << 24)) >>> 0;
    const prng = createPrng(seed);
    const [lo, hi] = level.thinkMs;
    this.thinkTicks = Math.round((nextRange(prng, lo, hi) * this.opts.ticksPerSecond) / 1000);
    // The match as it stands: the planner copies it (a worker by posting it, planTurn itself).
    const input: PlanInput = { state: v as SimState, team, level, seed };
    const turn = this.turn;
    try {
      const out = this.opts.planner(input);
      if (out instanceof Promise) {
        out.then(
          (r) => {
            if (this.turn === turn) this.result = r;
          },
          () => {
            if (this.turn === turn) this.failed = true;
          },
        );
      } else {
        this.result = out;
      }
    } catch {
      this.failed = true;
    }
  }
}
