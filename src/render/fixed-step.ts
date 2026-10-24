// Fixed-step accumulator (TECH_SPEC §3): turns variable frame times into a whole number of
// 60 Hz sim ticks, and gives the interpolation factor for the rendering in between.

export class FixedStep {
  private readonly tickMs: number;
  private readonly maxSteps: number;
  private readonly maxDelta: number;
  /** ms of real time not yet simulated */
  private acc = 0;

  /**
   * @param tickMs duration of one tick
   * @param maxSteps catch-up limit per frame: beyond it, the lag is dropped (TECH_SPEC §3)
   * @param maxDelta longest frame taken into account, so a stalled tab does not fast-forward
   */
  constructor(tickMs: number, maxSteps: number, maxDelta: number) {
    this.tickMs = tickMs;
    this.maxSteps = maxSteps;
    this.maxDelta = maxDelta;
  }

  /** Number of ticks to run for a frame that lasted `delta` ms. */
  advance(delta: number): number {
    this.acc += Math.min(Math.max(0, delta), this.maxDelta);
    let steps = 0;
    while (this.acc >= this.tickMs && steps < this.maxSteps) {
      this.acc -= this.tickMs;
      steps++;
    }
    // Still a full tick behind after the catch-up limit: drop the lag rather than spiral.
    if (this.acc >= this.tickMs) this.acc = 0;
    return steps;
  }

  /** 0..1: how far the rendering is between the last two ticks. */
  get alpha(): number {
    return this.acc / this.tickMs;
  }

  reset(): void {
    this.acc = 0;
  }
}
