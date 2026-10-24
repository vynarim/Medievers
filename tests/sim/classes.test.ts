import { describe, expect, it } from 'vitest';
import { AIM_PREVIEW_TICKS, CLASS_RULES, type ClassId } from '../../src/content/classes.ts';
import { CLASSIC_RULES, weaponDefIn, type MatchRules } from '../rules-fixture.ts';
import {
  Material,
  Sim,
  aimPreviewTicks,
  digPctOf,
  shotSpeed,
  visibleMines,
  type Mask,
  type SimEvent,
} from '../../src/sim/index.ts';

function flatMask(): Mask {
  const width = 1200;
  const height = 600;
  const data = new Uint8Array(width * height);
  for (let y = 500; y < height; y++) data.fill(Material.Earth, y * width, (y + 1) * width);
  return { width, height, data };
}

// Nothing but the classes: no wind, no map events.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { kitchen, burn, crates, beasts, barrels, ...BASE } = CLASSIC_RULES;
const CALM: MatchRules = { ...BASE, wind: { ...CLASSIC_RULES.wind, max: 0 } };

function match(
  a: { x: number[]; c: ClassId[] },
  b: { x: number[]; c: ClassId[] },
  rules: MatchRules = CALM,
): Sim {
  return new Sim(
    {
      rules,
      teams: [
        { spawns: a.x, classes: a.c },
        { spawns: b.x, classes: b.c },
      ],
    },
    3,
    flatMask(),
  );
}

function toAction(sim: Sim): void {
  for (let i = 0; i < 2000 && sim.view().turn.phase !== 'action'; i++) sim.step();
}

function run(sim: Sim, ticks: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) events.push(...sim.step());
  return events;
}

const hpOf = (sim: Sim, id: number): number => sim.view().units.find((u) => u.id === id)?.hp ?? -1;

/** Queues a blast at the hitbox centre of each listed unit, on the next tick. */
function blastOn(sim: Sim, ids: number[], damage: number): void {
  const snap = sim.snapshot();
  for (const id of ids) {
    const u = snap.units.find((x) => x.id === id);
    if (!u) continue;
    snap.explosions.items.push({
      tick: snap.tick + 1,
      seq: snap.explosions.nextSeq++,
      explosion: {
        x: u.x,
        y: u.y - 40 * 256,
        radius: 50,
        carveRadius: 0,
        maxDamage: damage,
        sourceId: 900 + id,
      },
    });
  }
  sim.restore(snap);
}

describe('class passives (GDD §3.2)', () => {
  it('are off without rules.classes, whatever the line-up', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { classes, ...plain } = CALM;
    const sim = match({ x: [300], c: ['king'] }, { x: [900], c: ['slinger'] }, plain);
    expect(sim.view().units.map((u) => u.hp)).toEqual([100, 100]);
  });

  it('knight: takes a quarter less from explosions', () => {
    const sim = match({ x: [300], c: ['knight'] }, { x: [900], c: ['archer'] });
    blastOn(sim, [1, 2], 40);
    sim.step();
    expect(100 - hpOf(sim, 2)).toBe(40);
    expect(100 - hpOf(sim, 1)).toBe(30);
  });

  it('knight: jumps shorter than the others', () => {
    const reach = (cls: ClassId): number => {
      const sim = match({ x: [300], c: [cls] }, { x: [1000], c: ['archer'] });
      toAction(sim);
      sim.step([{ t: 'jump', kind: 'forward' }]);
      run(sim, 200);
      return (sim.view().units[0]?.x ?? 0) / 256 - 300;
    };
    const knight = reach('knight');
    const archer = reach('archer');
    expect(knight).toBeGreaterThan(0);
    // 84 % of the speeds: about 70 % of the reach.
    expect(knight / archer).toBeGreaterThan(0.6);
    expect(knight / archer).toBeLessThan(0.8);
  });

  it('archer: twice the aim preview with the bow and the crossbow only', () => {
    const sim = match({ x: [300], c: ['archer'] }, { x: [900], c: ['knight'] });
    const v = sim.view();
    const [archer, knight] = v.units;
    if (!archer || !knight) throw new Error('units');
    const bow = weaponDefIn(v.rules, 'bow');
    expect(aimPreviewTicks(v, archer, bow)).toBe(AIM_PREVIEW_TICKS * 2);
    expect(aimPreviewTicks(v, archer, weaponDefIn(v.rules, 'crossbow'))).toBe(
      AIM_PREVIEW_TICKS * 2,
    );
    expect(aimPreviewTicks(v, archer, weaponDefIn(v.rules, 'sling'))).toBe(AIM_PREVIEW_TICKS);
    expect(aimPreviewTicks(v, knight, bow)).toBe(AIM_PREVIEW_TICKS);
  });

  it('slinger: throws 15 % faster, with 10 HP less', () => {
    const sim = match({ x: [300], c: ['slinger'] }, { x: [900], c: ['knight'] });
    const v = sim.view();
    const [slinger, knight] = v.units;
    if (!slinger || !knight) throw new Error('units');
    expect(slinger.hp).toBe(90);
    const sling = weaponDefIn(v.rules, 'sling');
    expect(shotSpeed(v, knight, sling, 1024)).toBe(sling.maxSpeed);
    expect(shotSpeed(v, slinger, sling, 1024)).toBe(Math.trunc((sling.maxSpeed * 115) / 100));
    // The bow is not thrown by hand.
    const bow = weaponDefIn(v.rules, 'bow');
    expect(shotSpeed(v, slinger, bow, 1024)).toBe(bow.maxSpeed);
  });

  it('sapper: its house sees the enemy caltrops while it plays, and only then', () => {
    const sim = match({ x: [300, 500], c: ['sapper', 'knight'] }, { x: [900], c: ['knight'] });
    toAction(sim);
    const view = sim.view();
    const [sapper, knight, enemy] = view.units;
    if (!sapper || !knight || !enemy) throw new Error('units');
    const mines = [
      { id: 1, team: 0 },
      { id: 2, team: 1 },
    ];
    /** The view with these caltrops, on the turn of unitId. */
    const at = (unitId: number, activeTeam: number, rules = view.rules) => ({
      ...view,
      rules,
      mines,
      turn: { ...view.turn, activeUnitId: unitId, activeTeam },
    });
    const seen = (v: ReturnType<typeof at>, team: number): number[] =>
      visibleMines(v, team).map((m) => m.id);
    expect(seen(at(sapper.id, 0), 0)).toEqual([1, 2]);
    expect(seen(at(knight.id, 0), 0)).toEqual([1]);
    // The other house's turn: each sees its own.
    expect(seen(at(enemy.id, 1), 0)).toEqual([1]);
    expect(seen(at(enemy.id, 1), 1)).toEqual([2]);
    // Without classes there is no sapper.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { classes, ...noClasses } = view.rules;
    expect(seen(at(sapper.id, 0, noClasses), 0)).toEqual([1]);
  });

  it('sapper: digs twice as fast (for the pick and the sap)', () => {
    const sim = match({ x: [300], c: ['sapper'] }, { x: [900], c: ['knight'] });
    const [sapper, knight] = sim.view().units;
    if (!sapper || !knight) throw new Error('units');
    expect(digPctOf(sim.view(), sapper)).toBe(CLASS_RULES.sapper.digPct);
    expect(digPctOf(sim.view(), knight)).toBe(100);
  });

  it('cleric: heals the allies in reach at the end of the turn, not itself', () => {
    // Cleric at 300, ally at 380 (in reach), ally at 700 (too far).
    const sim = match(
      { x: [300, 380, 700], c: ['cleric', 'knight', 'archer'] },
      { x: [1100], c: ['knight'] },
    );
    const snap = sim.snapshot();
    for (const u of snap.units) if (u.team === 0) u.hp = 50;
    sim.restore(snap);
    toAction(sim);
    expect(sim.view().turn.activeUnitId).toBe(1);
    const events = [...sim.step([{ t: 'skip' }]), ...run(sim, 400)];
    expect(hpOf(sim, 1)).toBe(50);
    expect(hpOf(sim, 2)).toBe(50 + CLASS_RULES.cleric.blessHp);
    expect(hpOf(sim, 3)).toBe(50);
    expect(events).toContainEqual({ e: 'unitHealed', unitId: 2, heal: CLASS_RULES.cleric.blessHp });
  });

  it('cleric: may not take up a melee weapon', () => {
    const sim = match({ x: [300], c: ['cleric'] }, { x: [334], c: ['knight'] });
    toAction(sim);
    sim.step([{ t: 'selectWeapon', id: 'mace' }]);
    expect(sim.view().turn.weapon).toBe('bow');
  });

  it('king: allies within reach deal 10 % more, others do not; 20 HP less', () => {
    const arrow = (allyX: number): number => {
      // Ally archer at 300 shoots the enemy at 500; the king stands at 160.
      const sim = match({ x: [300, allyX], c: ['archer', 'king'] }, { x: [500], c: ['knight'] });
      expect(sim.view().units[1]?.hp).toBe(80);
      toAction(sim);
      sim.step([
        { t: 'aim', angle: 0 },
        { t: 'fire', power: 1024 },
      ]);
      run(sim, 120);
      return 100 - hpOf(sim, 3);
    };
    const bow = weaponDefIn(CALM, 'bow').damage;
    expect(arrow(160)).toBe(Math.trunc((bow * 110 + 50) / 100));
    expect(arrow(40)).toBe(bow);
  });

  it('Régicide: the house whose king falls is out, and the other one wins', () => {
    const rules: MatchRules = { ...CALM, regicide: true, startHp: 30 };
    const sim = match(
      { x: [300], c: ['archer'] },
      { x: [500, 1000], c: ['king', 'knight'] },
      rules,
    );
    toAction(sim);
    // The king has 10 HP: one arrow.
    sim.step([
      { t: 'aim', angle: 0 },
      { t: 'fire', power: 1024 },
    ]);
    const events = run(sim, 600);
    expect(events).toContainEqual({ e: 'unitDied', unitId: 2, cause: 'hp' });
    expect(events).toContainEqual({ e: 'unitDied', unitId: 3, cause: 'kingFell' });
    expect(sim.view().winner).toBe(0);
  });
});
