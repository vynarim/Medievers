// DOM heads-up display (GDD §9): turn and house, houses' health, wind banner, hourglass, weapon
// and power, the phylactery of running commentary, and the centre banner. Reads the sim view.
import { FACTIONS } from '../content/factions.ts';
import { TICKS_PER_SECOND } from '../content/rules.ts';
import { MAX_POWER } from '../sim/commands.ts';
import type { SimView } from '../sim/sim.ts';
import { t } from './i18n.ts';
import { button, el, shield } from './overlay.ts';
import { COLORS, css } from './tokens.ts';

/** ms a commentary line stays up */
const CHRONICLE_MS = 5000;
/** ms a turn announcement stays up */
const BANNER_MS = 4200;
/** ms of one pulse of the playing house's glow (team-glow in overlay.ts) */
const GLOW_MS = 1600;

export class Hud {
  private readonly turnShield: HTMLElement;
  private readonly turnTitle: HTMLElement;
  private readonly turnHouse: HTMLElement;
  private readonly turnPhase: HTMLElement;
  private readonly breath: HTMLElement;
  private readonly breathFill: HTMLElement;
  private readonly teams: HTMLElement;
  private readonly windLabel: HTMLElement;
  private readonly windFill: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly timerSecs: HTMLElement;
  private readonly weaponName: HTMLElement;
  private readonly powerFill: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly chronicle: HTMLElement;
  private readonly banner: HTMLElement;
  private chronicleUntil = 0;
  private bannerUntil = 0;
  private signature = '';
  private power = -1;

  constructor(root: HTMLElement) {
    const turn = el('div', 'hud-turn panel');
    this.turnShield = el('div');
    this.turnTitle = el('div', 'title');
    this.turnHouse = el('div', 'house');
    this.turnPhase = el('div', 'phase');
    const turnText = el('div');
    this.breath = el('div', 'breath');
    this.breathFill = el('i');
    this.breath.append(this.breathFill);
    this.breath.title = t('hud.breath');
    turnText.append(this.turnTitle, this.turnHouse, this.turnPhase, this.breath);
    turn.append(this.turnShield, turnText);

    this.teams = el('div', 'hud-teams');

    const wind = el('div', 'hud-wind panel');
    this.windLabel = el('div', 'label');
    const track = el('div', 'track');
    this.windFill = el('div', 'fill');
    track.append(this.windFill);
    const windRow = el('div', 'wind-row');
    windRow.append(this.windLabel, track);
    // The title's first and last letters in lapis, the rest in vermilion.
    const name = t('game.title');
    const title = el('div', 'game-title', name.slice(0, -1));
    title.append(el('span', 'last', name.slice(-1)));
    wind.append(title, windRow);

    this.timer = el('div', 'hud-timer panel');
    this.timerSecs = el('div', 'secs');
    this.timer.append(el('div', 'glass', '⌛'), this.timerSecs);

    const weapon = el('div', 'hud-weapon panel');
    this.weaponName = el('div', 'name');
    const power = el('div', 'power');
    this.powerFill = el('i');
    power.append(this.powerFill);
    this.hint = el('div', 'hint', t('hud.hint'));
    weapon.append(this.weaponName, power, this.hint);

    this.chronicle = el('div', 'chronicle faded');
    this.banner = el('div', 'banner panel faded');
    root.append(turn, this.teams, wind, this.timer, weapon, this.chronicle, this.banner);
    // A click or tap anywhere dismisses a turn announcement (not the end-of-match one).
    window.addEventListener('pointerdown', this.dismiss, true);
  }

  private readonly dismiss = (): void => {
    if (this.bannerUntil !== Infinity) this.bannerUntil = 0;
  };

  destroy(): void {
    window.removeEventListener('pointerdown', this.dismiss, true);
  }

  /** Shows a line of commentary in the phylactery. */
  say(text: string, now: number): void {
    this.chronicle.textContent = text;
    this.chronicle.classList.remove('faded');
    this.chronicleUntil = now + CHRONICLE_MS;
  }

  /** Centre banner: a title in textura, a subtitle and a quip. Persistent ones stay until replaced. */
  announce(
    big: string,
    sub: string,
    quip: string,
    color: number,
    now: number,
    action: { label: string; run: () => void } | null = null,
  ): void {
    const title = el('div', 'big', big);
    title.style.color = css(color);
    this.banner.replaceChildren(title, el('div', 'sub', sub), el('div', 'quip', quip));
    if (action) {
      const b = button(action.label);
      b.addEventListener('click', action.run);
      this.banner.append(b);
    }
    this.banner.classList.remove('faded');
    this.bannerUntil = action ? Infinity : now + BANNER_MS;
  }

  update(v: SimView, power: number, now: number): void {
    if (now > this.chronicleUntil) this.chronicle.classList.add('faded');
    if (now > this.bannerUntil) this.banner.classList.add('faded');
    if (power !== this.power) {
      this.power = power;
      this.powerFill.style.width = `${(power * 100) / MAX_POWER}%`;
    }

    const turn = v.turn;
    const timed = turn.phase === 'action' || turn.phase === 'retreat' || turn.phase === 'placement';
    const seconds = timed ? Math.ceil(turn.phaseTicks / TICKS_PER_SECOND) : null;
    const def = v.rules.weapons.find((w) => w.id === turn.weapon);
    const fuse =
      def?.behavior === 'fusedBouncer' || def?.behavior === 'cluster' || def?.behavior === 'build'
        ? Math.round((turn.fuse || def.defaultFuse) / TICKS_PER_SECOND)
        : null;
    const hp = v.teams.map((team) =>
      team.unitIds.reduce((sum, id) => {
        const u = v.units.find((x) => x.id === id);
        return sum + (u?.alive ? u.hp : 0);
      }, 0),
    );
    const budget = (v.rules.unit.moveBudget ?? 0) * 256;
    const breath = budget > 0 ? Math.round((turn.moveLeft * 100) / budget) : -1;
    const signature = [
      breath,
      turn.number,
      turn.phase,
      turn.activeTeam,
      turn.wind,
      seconds,
      turn.weapon,
      fuse,
      hp,
    ]
      .map(String)
      .join('|');
    if (signature === this.signature) return;
    this.signature = signature;

    const faction = FACTIONS[turn.activeTeam];
    this.turnShield.replaceChildren(
      shield(faction?.primary ?? COLORS.encre, faction?.secondary ?? COLORS.or),
    );
    this.turnTitle.textContent =
      turn.phase === 'placement' ? t('hud.placement') : t('hud.turn', { n: turn.number });
    this.turnHouse.textContent = faction ? t(faction.nameKey) : '';
    this.turnHouse.style.color = css(faction?.ink ?? COLORS.encre);
    this.turnPhase.textContent = t(`hud.phase.${turn.phase}`);
    this.breath.classList.toggle('hidden', breath < 0);
    this.breathFill.style.width = `${Math.max(0, breath)}%`;

    const max = v.rules.startHp * Math.max(1, ...v.teams.map((x) => x.unitIds.length));
    this.teams.replaceChildren(
      ...v.teams.map((team, i) => {
        const f = FACTIONS[team.id];
        const playing = team.id === turn.activeTeam && turn.phase !== 'gameOver';
        const row = el(
          'div',
          `team panel${(hp[i] ?? 0) === 0 ? ' out' : ''}${playing ? ' playing' : ''}`,
        );
        row.style.setProperty('--p', css(f?.primary ?? COLORS.encre));
        // The rows are rebuilt every second: the pulse keeps to the clock, not to the rebuild.
        if (playing) row.style.animationDelay = `-${Math.round(now % GLOW_MS)}ms`;
        const bar = el('div', 'hp');
        const fill = el('i');
        fill.style.width = `${Math.min(100, ((hp[i] ?? 0) * 100) / max)}%`;
        bar.style.setProperty('--p', css(f?.primary ?? COLORS.encre));
        bar.append(fill);
        row.append(
          shield(f?.primary ?? COLORS.encre, f?.secondary ?? COLORS.or, true),
          el('span', 'name', f ? t(f.nameKey) : ''),
          el('span', '', String(hp[i] ?? 0)),
          bar,
        );
        return row;
      }),
    );

    const arrow = turn.wind > 0 ? '→' : turn.wind < 0 ? '←' : '·';
    this.windLabel.textContent = `${t('hud.wind')} ${arrow} ${Math.abs(turn.wind)}`;
    const len = (Math.abs(turn.wind) / Math.max(1, v.rules.wind.max)) * 50;
    this.windFill.style.left = `${turn.wind >= 0 ? 50 : 50 - len}%`;
    this.windFill.style.width = `${len}%`;

    this.timerSecs.textContent = seconds === null ? '—' : String(seconds);
    this.timer.classList.toggle('hurry', seconds !== null && seconds <= 5);
    this.timer.classList.toggle('idle', seconds === null);

    const fuseKey =
      def?.behavior === 'build'
        ? `hud.wallLength.${Math.max(1, Math.min(3, fuse ?? 2))}`
        : def?.fuseTurns !== undefined
          ? 'hud.fuseTurns'
          : 'hud.fuse';
    const fuseText = fuse === null ? '' : ` · ${t(fuseKey, { s: fuse ?? 0 })}`;
    this.weaponName.textContent = `${t(`weapons.${turn.weapon}`)}${fuseText}`;
    // How to use the weapon in hand: aim and charge, click the map, or just press.
    const hintKey = `hud.hint.${def?.behavior ?? 'directHit'}`;
    const hint = t(hintKey).startsWith('[') ? t('hud.hint') : t(hintKey);
    if (this.hint.textContent !== hint) this.hint.textContent = hint;
    this.hint.classList.toggle('hidden', turn.phase !== 'action');
  }
}
