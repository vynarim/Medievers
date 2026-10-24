import { describe, expect, it } from 'vitest';
import { CRATE_RULES } from '../../src/content/crates.ts';
import { CLASSIC_RULES, type MatchRules } from '../rules-fixture.ts';
import { Material, Sim, type Mask, type SimEvent } from '../../src/sim/index.ts';

function flatMask(): Mask {
  const width = 1200;
  const height = 800;
  const data = new Uint8Array(width * height);
  for (let y = 600; y < height; y++) data.fill(Material.Earth, y * width, (y + 1) * width);
  return { width, height, data };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, burn, barrels, beasts, deluge, weather, ...BASE } = CLASSIC_RULES;
const RULES: MatchRules = {
  ...BASE,
  wind: { ...CLASSIC_RULES.wind, max: 0 },
  crates: { ...CRATE_RULES, chancePermille: 0 },
};

/** A duel with an angel bringing a coffer down above the archer (unit 1): its wing over it. */
function withAngel(rules: MatchRules = RULES): Sim {
  const sim = new Sim({ rules, teams: [{ spawns: [300] }, { spawns: [1000] }] }, 4, flatMask());
  for (let i = 0; i < 1000 && sim.view().turn.phase !== 'action'; i++) sim.step();
  const snap = sim.snapshot();
  snap.crates.push({ id: 900, x: 330 * 256, y: 300 * 256, kind: 0, weapon: 0, landed: false });
  sim.restore(snap);
  return sim;
}

const shootUp = (sim: Sim): SimEvent[] => {
  const events = [
    ...sim.step([
      { t: 'aim', angle: 3072 },
      { t: 'fire', power: 1024 },
    ]),
  ];
  for (let i = 0; i < 600; i++) events.push(...sim.step());
  return events;
};

describe('angels bringing reliquaries (GDD §4.5)', () => {
  it('shot, lift the shooter in a beam of light and let go of it: the fall hurts', () => {
    const sim = withAngel();
    const events = shootUp(sim);
    expect(events).toContainEqual({ e: 'angelLift', unitId: 1 });
    expect(events).toContainEqual({ e: 'angelDropped', unitId: 1 });
    const hurt = events.find((e) => e.e === 'unitDamaged' && e.unitId === 1);
    expect(hurt?.e === 'unitDamaged' ? hurt.damage : 0).toBeGreaterThanOrEqual(15);
    expect(hurt?.e === 'unitDamaged' ? hurt.damage : 0).toBeLessThanOrEqual(20);
    // Back on the ground, alive; the coffer, dropped, lies there too.
    const u = sim.view().units[0];
    expect(u?.alive).toBe(true);
    expect((u?.y ?? 0) >> 8).toBe(600);
  });

  it('are not hit in logs recorded before', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { angelLift, ...old } = CRATE_RULES;
    const sim = withAngel({ ...RULES, crates: { ...old, chancePermille: 0 } });
    expect(shootUp(sim).some((e) => e.e === 'angelLift')).toBe(false);
  });
});
