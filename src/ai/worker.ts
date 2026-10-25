// The AI's Web Worker (GDD §7.1): it receives the match at the start of an AI turn and sends back
// the plan, so that the search never holds up the main thread.
import { planTurn, type PlanInput } from './plan.ts';

interface Request {
  readonly id: number;
  readonly input: PlanInput;
}

self.onmessage = (e: MessageEvent<Request>) => {
  const { id, input } = e.data;
  try {
    self.postMessage({ id, result: planTurn(input) });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
