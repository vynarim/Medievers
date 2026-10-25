// A sandbox the AI plays its candidate moves in (GDD §7.1): the real sim, run from a copy of the
// match, never a physics of its own. Copying the whole state costs a few ms because of the
// terrain; the sandbox keeps one terrain buffer and copies the pixels back into it instead, so
// trying a move again costs little. One sim at a time lives in a sandbox.
import { Sim } from '../sim/sim.ts';
import type { SimState } from '../sim/state.ts';

/** A state without its pixels (terrain and structure owners): what a walk leaves unchanged. */
export type LightState = SimState;

const NO_PIXELS = new Uint8Array(0);

/** `s` with its big pixel arrays left out, cloned. */
function lighten(s: SimState): LightState {
  const stripped = {
    ...s,
    terrain: { ...s.terrain, data: NO_PIXELS },
    owners: s.owners ? NO_PIXELS : null,
  };
  return structuredClone(stripped);
}

export class Sandbox {
  private readonly base: SimState;
  private readonly baseLight: LightState;
  private readonly data: Uint8Array;
  private readonly owners: Uint8Array | null;

  constructor(snapshot: SimState) {
    this.base = snapshot;
    this.baseLight = lighten(snapshot);
    this.data = new Uint8Array(snapshot.terrain.data.length);
    this.owners = snapshot.owners ? new Uint8Array(snapshot.owners.length) : null;
  }

  /** The state the sandbox was made from. */
  get state(): SimState {
    return this.base;
  }

  /**
   * A sim at the sandbox's state, or at `from`, a light state captured from it (whose pixels are
   * still the base's). The previous sim of this sandbox is no longer valid.
   */
  load(from: LightState = this.baseLight): Sim {
    const s = structuredClone(from);
    this.data.set(this.base.terrain.data);
    const terrain = {
      ...s.terrain,
      data: this.data,
      chunkHash: this.base.terrain.chunkHash.slice(),
      hashDirty: this.base.terrain.hashDirty.slice(),
      maskHash: this.base.terrain.maskHash,
    };
    let owners: Uint8Array | null = null;
    if (this.owners && this.base.owners) {
      this.owners.set(this.base.owners);
      owners = this.owners;
    }
    return Sim.fromState({ ...s, terrain, owners });
  }

  /**
   * The light state of `sim`, to load again later. Only for a sim whose pixels still are the
   * base's: the caller checks that nothing was dug or blown up on the way.
   */
  capture(sim: Sim): LightState {
    return lighten(sim.view() as SimState);
  }
}
