import { describe, expect, it } from 'vitest';
import { WEATHER_RULES } from '../../src/content/weather.ts';
import { CLASSIC_RULES, type MatchRules } from '../rules-fixture.ts';
import { Material, Sim, type Mask, type SimEvent } from '../../src/sim/index.ts';

function flatMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 500; y < height; y++) data.fill(Material.Earth, y * width, (y + 1) * width);
  return { width, height, data };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, beasts, crates, barrels, burn, deluge, weather, ...BASE } = CLASSIC_RULES;

function passTurns(sim: Sim, turns: number): SimEvent[] {
  const events: SimEvent[] = [];
  const end = sim.view().turn.number + turns;
  for (let i = 0; i < 100000 && sim.view().turn.number < end; i++) {
    if (sim.view().turn.phase === 'gameOver') break;
    events.push(...sim.step(sim.view().turn.phase === 'action' ? [{ t: 'skip' }] : []));
  }
  // Let a strike queued at the last turn end go off.
  for (let i = 0; i < 5; i++) events.push(...sim.step());
  return events;
}

describe('weather (GDD §5 bis)', () => {
  it('brings rain for a few turns, and lightning that blasts the field while it rains', () => {
    const rules: MatchRules = {
      ...BASE,
      weather: { ...WEATHER_RULES, rainPermille: 1000, lightningPermille: 1000 },
    };
    const sim = new Sim({ rules, teams: [{ spawns: [300] }, { spawns: [900] }] }, 3, flatMask());
    const events = passTurns(sim, 4);
    expect(events).toContainEqual({ e: 'rainStarted' });
    const strikes = events.filter((e) => e.e === 'lightning');
    expect(strikes.length).toBeGreaterThan(0);
    const blasts = events.filter((e) => e.e === 'explosion');
    expect(blasts.length).toBe(strikes.length);
    for (const s of strikes) if (s.e === 'lightning') expect(s.y).toBe(500);
  });

  it('stays fair in logs recorded without it, and with no chance of rain', () => {
    const sim = new Sim(
      { rules: BASE, teams: [{ spawns: [300] }, { spawns: [900] }] },
      3,
      flatMask(),
    );
    expect(passTurns(sim, 6).some((e) => e.e === 'rainStarted')).toBe(false);
    const dry: MatchRules = { ...BASE, weather: { ...WEATHER_RULES, rainPermille: 0 } };
    const sim2 = new Sim(
      { rules: dry, teams: [{ spawns: [300] }, { spawns: [900] }] },
      3,
      flatMask(),
    );
    expect(passTurns(sim2, 6).some((e) => e.e === 'rainStarted')).toBe(false);
    expect(sim2.view().rain).toBe(0);
  });
});
