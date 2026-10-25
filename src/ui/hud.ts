// DOM heads-up display (GDD §9): turn and house, houses' health, wind banner, hourglass, the
// phylactery of running commentary, and the centre banner. Reads the sim view.
import { FACTIONS, unitName } from '../content/factions.ts';
import { TICKS_PER_SECOND } from '../content/rules.ts';
import type { SimView } from '../sim/sim.ts';
import { houseShortName } from './house-names.ts';
import { t } from './i18n.ts';
import { button, el, shield } from './overlay.ts';
import { playerArt } from './player-art.ts';
import { COLORS, css } from './tokens.ts';

/** ms a commentary line stays up */
const CHRONICLE_MS = 8000;
/** lines of commentary shown at once, the newest at the bottom; ms a line takes to fade */
const CHRONICLE_LINES = 3;
const CHRONICLE_FADE = 1300;
/** ms a turn announcement stays up */
const BANNER_MS = 4200;
/** ms of one pulse of the playing house's glow (team-glow in overlay.ts) */
const GLOW_MS = 1600;

export class Hud {
  private readonly turnTitle: HTMLElement;
  private readonly teams: HTMLElement;
  /** who leads each house, shown on its band when the AI plays one (null: not shown) */
  private players: readonly ('human' | 'ai')[] | null = null;
  private readonly windLabel: HTMLElement;
  private readonly windFill: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly timerSecs: HTMLElement;
  private readonly chronicle: HTMLElement;
  private lines: { readonly el: HTMLElement; until: number }[] = [];
  private readonly banner: HTMLElement;
  private bannerUntil = 0;
  private signature = '';

  constructor(root: HTMLElement) {
    // The turn, right of the wind in the title cartouche; the house that plays is told by its
    // glowing row, so neither its arms nor its name are repeated here.
    const turn = el('div', 'turn-row');
    this.turnTitle = el('div', 'turn');
    turn.append(this.turnTitle);

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
    wind.append(title, windRow, turn);

    this.timer = el('div', 'hud-timer panel');
    this.timerSecs = el('div', 'secs');
    this.timer.append(el('div', 'glass', '⌛'), this.timerSecs);

    this.chronicle = el('div', 'chronicles');
    this.banner = el('div', 'banner panel faded');
    root.append(this.teams, wind, this.timer, this.chronicle, this.banner);
    // A click or tap anywhere dismisses a turn announcement (not the end-of-match one).
    window.addEventListener('pointerdown', this.dismiss, true);
  }

  private readonly dismiss = (): void => {
    if (this.bannerUntil !== Infinity) this.bannerUntil = 0;
  };

  destroy(): void {
    window.removeEventListener('pointerdown', this.dismiss, true);
  }

  /**
   * Shows a line of commentary in a phylactery, under the ones still up: two things said in a
   * row (two coffers picked up on one walk) are both read. `tone` borders it in red (bad news)
   * or green (good news).
   */
  say(text: string, now: number, tone: 'good' | 'bad' | null = null): void {
    const line = el('div', tone ? `chronicle ${tone}` : 'chronicle');
    line.append(...this.inked(text));
    this.chronicle.append(line);
    this.lines.push({ el: line, until: now + CHRONICLE_MS });
    // The oldest ones beyond the few kept fade out like the others, sooner.
    const live = this.lines.filter((l) => l.until >= now);
    for (const l of live.slice(0, Math.max(0, live.length - CHRONICLE_LINES))) l.until = now;
  }

  /** Centre banner: a title in textura, a subtitle and a quip. Persistent ones stay until replaced. */
  announce(
    big: string,
    sub: string | readonly (string | Node)[],
    quip: string | readonly (string | Node)[],
    color: number,
    now: number,
    action: { label: string; run: () => void } | null = null,
  ): void {
    const title = el('div', 'big', big);
    title.style.color = css(color);
    const line = (cls: string, text: string | readonly (string | Node)[]): HTMLElement => {
      const d = el('div', cls);
      d.append(...(typeof text === 'string' ? this.inked(text) : text));
      return d;
    };
    this.banner.replaceChildren(title, line('sub', sub), line('quip', quip));
    if (action) {
      const b = button(action.label);
      b.addEventListener('click', action.run);
      this.banner.append(b);
    }
    this.banner.classList.remove('faded');
    this.bannerUntil = action ? Infinity : now + BANNER_MS;
  }

  /** The names of the match's units, longest first, each in its house's ink. */
  private inks: { readonly name: string; readonly ink: string }[] = [];

  /** `text` with every unit's name in its house's ink. */
  private inked(text: string): (string | Node)[] {
    let parts: (string | Node)[] = [text];
    for (const { name, ink } of this.inks) {
      parts = parts.flatMap((p): (string | Node)[] =>
        typeof p !== 'string'
          ? [p]
          : p.split(name).flatMap((piece, i): (string | Node)[] => {
              if (i === 0) return [piece];
              const span = document.createElement('span');
              span.textContent = name;
              span.style.color = ink;
              return [span, piece];
            }),
      );
    }
    return parts.filter((p) => p !== '');
  }

  /** Who leads each house, shown on the bands when one of them is the AI's. */
  setPlayers(players: readonly ('human' | 'ai')[]): void {
    this.players = players.includes('ai') ? players : null;
    this.signature = '';
  }

  update(v: SimView, now: number): void {
    if (this.inks.length !== v.units.length) {
      this.inks = v.units
        .map((u) => ({
          name: unitName(u.id),
          ink: css(FACTIONS[u.team]?.ink ?? COLORS.encre),
        }))
        .sort((a, b) => b.name.length - a.name.length);
    }
    this.lines = this.lines.filter((l) => {
      if (now > l.until + CHRONICLE_FADE) {
        l.el.remove();
        return false;
      }
      if (now > l.until) l.el.classList.add('faded');
      return true;
    });
    if (now > this.bannerUntil) this.banner.classList.add('faded');

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
    const signature = [
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

    this.turnTitle.textContent =
      turn.phase === 'placement' ? t('hud.placement') : t('hud.turn', { n: turn.number });

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
          el('span', 'name', houseShortName(team.id)),
          el('span', '', String(hp[i] ?? 0)),
          bar,
        );
        // Who leads the house: the village idiot (a person) or the helm of rivets (the AI).
        const who = this.players?.[team.id];
        if (who) {
          const face = el('span', 'who');
          face.innerHTML = playerArt(who, 24);
          face.title = t(who === 'ai' ? 'hud.who.ai' : 'hud.who.human');
          row.append(face);
        }
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
  }
}
