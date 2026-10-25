// The AI's houses as an InputSource (TECH_SPEC §2.1): its controller plays them, its plans come
// from a Web Worker (falling back on the main thread if workers are unavailable), and its hands
// move at a pace a player can follow. Gameplay code never knows the commands came from it.
import { AiController, type Planner } from '../ai/controller.ts';
import { planTurn, type PlanResult } from '../ai/plan.ts';
import { AI_LEVELS, type AiLevelId } from '../content/ai.ts';
import { TICKS_PER_SECOND } from '../content/rules.ts';
import type { GameCommand } from '../sim/commands.ts';
import type { SimView } from '../sim/sim.ts';
import type { InputSource } from './InputSource.ts';

/** How fast the AI's hands go in a match: the aim turns visibly, the shot is seen leaving. */
const PACE = { aimPerTick: 24, afterShot: 45, settle: 12 };

interface Reply {
  readonly id: number;
  readonly result?: PlanResult;
  readonly error?: string;
}

/** A planner running in a Web Worker, one request at a time. */
function workerPlanner(): { planner: Planner; dispose: () => void } | null {
  if (typeof Worker === 'undefined') return null;
  let worker: Worker;
  try {
    worker = new Worker(new URL('../ai/worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
  let next = 0;
  const pending = new Map<number, { ok: (r: PlanResult) => void; ko: (e: Error) => void }>();
  worker.onmessage = (e: MessageEvent<Reply>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.result) p.ok(e.data.result);
    else p.ko(new Error(e.data.error ?? 'AI worker failed'));
  };
  worker.onerror = () => {
    for (const p of pending.values()) p.ko(new Error('AI worker crashed'));
    pending.clear();
  };
  return {
    planner: (input) =>
      new Promise<PlanResult>((ok, ko) => {
        const id = next++;
        pending.set(id, { ok, ko });
        worker.postMessage({ id, input });
      }),
    dispose: () => worker.terminate(),
  };
}

export class AIInputSource implements InputSource {
  readonly kind = 'ai' as const;
  private readonly controller: AiController;
  private readonly stop: () => void;

  constructor(levels: ReadonlyMap<number, AiLevelId>, seed: number) {
    const w = workerPlanner();
    this.stop = w?.dispose ?? (() => undefined);
    this.controller = new AiController({
      levels: new Map([...levels].map(([team, id]) => [team, AI_LEVELS[id]])),
      seed,
      planner: w?.planner ?? planTurn,
      pace: PACE,
      ticksPerSecond: TICKS_PER_SECOND,
    });
  }

  /** The AI plays the house whose turn (or placement) it is. */
  plays(view: SimView): boolean {
    return this.controller.plays(view);
  }

  poll(tick: number, view: SimView): GameCommand[] {
    return this.controller.poll(tick, view);
  }

  dispose(): void {
    this.stop();
  }
}
