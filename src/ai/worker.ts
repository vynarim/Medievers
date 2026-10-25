// The AI's Web Worker (GDD §7.1): it receives the match at the start of an AI turn and sends back
// the plan, so that the search never holds up the main thread.
import { planTurn, type PlanInput } from './plan.ts';

interface Request {
  readonly id: number;
  /** the match without its pixels, which come apart, handed over */
  readonly input: PlanInput;
  readonly data: Uint8Array;
  readonly owners: Uint8Array | null;
}

self.onmessage = (e: MessageEvent<Request>) => {
  const { id, input, data, owners } = e.data;
  try {
    const s = input.state;
    const state = { ...s, terrain: { ...s.terrain, data }, owners };
    self.postMessage({ id, result: planTurn({ ...input, state }) });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
