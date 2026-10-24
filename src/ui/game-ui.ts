// On-screen controls for mouse and touch: virtual pad and weapon cluster, HUD, arsenal, character
// card, help, pause menu and the playtest settings panel. Reads the sim view; acts only through
// UiIntents (CLAUDE.md rule 3).
import { CLASSIC_RULES, type MatchRules } from '../content/rules.ts';
import { FACTIONS, unitName } from '../content/factions.ts';
import type { UiIntents } from '../input/ui-intents.ts';
import { canSwitchUnit, nextTeammate, type SimView } from '../sim/sim.ts';
import { classOf, maxHpOf, mayUse } from '../sim/classes.ts';
import { canClimb } from '../sim/units/climb.ts';
import { Hud } from './hud.ts';
import { renderTutorial } from './tutorial.ts';
import { t } from './i18n.ts';
import { button, el, holdButton, shield, uiRoot } from './overlay.ts';
import { COLORS, css } from './tokens.ts';
import {
  readValue,
  toDisplay,
  toStored,
  tuningGroups,
  type TuningOverrides,
} from './tuning-model.ts';
import { weaponLines } from './weapon-info.ts';

const STORAGE_KEY = 'medievers.tuning.v1';

export function loadOverrides(): TuningOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as TuningOverrides) : {};
  } catch {
    return {};
  }
}

function saveOverrides(o: TuningOverrides): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
  } catch {
    // Private browsing or blocked storage: settings last for this page only.
  }
}

export interface GameUiOptions {
  readonly intents: UiIntents;
  /** restart the match with these overrides applied to the Classique rules */
  readonly restart: (overrides: TuningOverrides) => void;
  /** the setup screen, to choose a new match */
  readonly newMatch: () => void;
  /** default zoom and camera back on the action */
  readonly resetView: () => void;
}

export class GameUi {
  private readonly opts: GameUiOptions;
  private readonly root: HTMLElement;
  readonly hud: Hud;
  private readonly fuses: HTMLElement;
  private readonly skip: HTMLButtonElement;
  private readonly resetView: HTMLButtonElement;
  /** ↓, shown at a ladder only */
  private readonly down: HTMLButtonElement;
  /** Fire, in the colour of the house that plays */
  private readonly fire: HTMLButtonElement;
  private fireColour = -1;
  private readonly actionButtons: HTMLButtonElement[] = [];
  private readonly veil: HTMLElement;
  private readonly arsenal: HTMLElement;
  private readonly card: HTMLElement;
  /** speech bubble describing the map object last clicked */
  private readonly bubble: HTMLElement;
  private bubbleText = '';
  /** tiny help bubble over a unit that cannot play (it played the team's last turn) */
  private readonly tip: HTMLElement;
  private readonly help: HTMLElement;
  private readonly settings: HTMLElement;
  private readonly pause: HTMLElement;
  /** the modal on screen, if any */
  private open: HTMLElement | null = null;
  private selectedUnit: number | null = null;
  /** settings tab last shown, kept while the page lives */
  private settingsTab = 0;
  private cardSignature = '';
  private arsenalSignature = '';
  private view: SimView | null = null;

  constructor(opts: GameUiOptions) {
    this.opts = opts;
    this.root = uiRoot();
    this.root.replaceChildren();
    const i = opts.intents;
    this.hud = new Hud(this.root);

    /**
     * 'walk' and 'jump' follow the moves left (a walk or one jump per turn), 'action' is before
     * the shot only, 'end' is the whole turn, 'switch' while the turn can change hands.
     */
    const act = (
      b: HTMLButtonElement,
      when: 'walk' | 'jump' | 'up' | 'action' | 'end' | 'switch' = 'action',
      tip = '',
    ): HTMLButtonElement => {
      b.dataset.when = when;
      if (tip) b.title = t(tip);
      this.actionButtons.push(b);
      return b;
    };
    // One action bar, centred at the bottom (GDD §8.2): moves, then aim and weapons.
    const bar = el('div', 'bar panel');
    const pad = el('div', 'group');
    const longJump = (dir: -1 | 1): HTMLButtonElement =>
      this.click(button(t(dir < 0 ? 'ui.jumpLeft' : 'ui.jumpRight'), 'icon'), () => {
        i.jump = 'forward';
        i.jumpDir = dir;
      });
    // Long jumps on the outside, the high jump between the walking arrows.
    pad.append(
      act(longJump(-1), 'jump', 'tip.jumpLeft'),
      act(
        holdButton(t('ui.walkLeft'), (h) => (i.walk = h ? -1 : 0), 'icon'),
        'walk',
        'tip.walkLeft',
      ),
      // ↑: the high jump, or, at a ladder, climb up while held (GDD §4.4).
      act(
        holdButton(
          t('ui.jumpUp'),
          (h) => {
            if (!h) i.climb = 0;
            else if (this.onLadder()) i.climb = -1;
            else i.jump = 'back';
          },
          'icon',
        ),
        'up',
        'tip.jumpUp',
      ),
      (this.down = act(
        holdButton(t('ui.climbDown'), (h) => (i.climb = h ? 1 : 0), 'icon hidden'),
        'walk',
        'tip.climbDown',
      )),
      act(
        holdButton(t('ui.walkRight'), (h) => (i.walk = h ? 1 : 0), 'icon'),
        'walk',
        'tip.walkRight',
      ),
      act(longJump(1), 'jump', 'tip.jumpRight'),
    );
    // Weapons and fire, bottom right.
    this.fuses = el('div', 'fuses');
    this.fuses.append(el('span', '', t('ui.fuse')));
    for (let s = 1; s <= 5; s++) {
      const b = act(button(String(s)));
      b.dataset.fuse = String(s);
      b.addEventListener('click', () => (i.fuse = s));
      this.fuses.append(b);
    }
    const arms = el('div', 'group');
    this.skip = act(
      this.click(button(t('ui.skip')), () => (i.skip = true)),
      'end',
    );
    // Weapon, aim and fire together.
    arms.append(
      act(this.click(button(t('ui.arsenal')), () => this.toggle(this.arsenal))),
      this.fuses,
      act(
        holdButton(t('ui.spin'), (h) => (i.spin = h)),
        'action',
        'tip.spin',
      ),
      (this.fire = act(
        holdButton(
          t('ui.fire'),
          (h) => {
            i.charge = h;
            if (h) i.firePressed = true;
          },
          'fire',
        ),
      )),
    );
    // Worms' « worm select »: hands the turn to the next unit of the team (GDD §2.2).
    const switchUnit = act(
      this.click(button(t('ui.switchUnit')), () => {
        const next = this.view ? nextTeammate(this.view) : null;
        if (next !== null) i.selectUnit = next;
      }),
      'switch',
      'tip.switchUnit',
    );
    bar.append(pad, el('div', 'sep'), arms, el('div', 'sep'), switchUnit, this.skip);
    const sys = el('div', 'sys');
    // Shown only away from the default view (showResetView).
    this.resetView = this.click(button(t('ui.resetView'), 'icon hidden'), () => opts.resetView());
    this.resetView.title = t('tip.resetView');
    if (document.fullscreenEnabled) sys.append(this.fullscreenButton());
    sys.append(
      this.resetView,
      this.click(button(`? ${t('ui.help')}`), () => this.toggle(this.help)),
      this.click(button(`⚙ ${t('ui.settings')}`), () => this.openSettings()),
      this.click(button(`☰ ${t('ui.pause')}`), () => this.toggle(this.pause)),
    );

    this.veil = el('div', 'veil hidden');
    this.veil.addEventListener('pointerdown', () => this.show(null));
    this.arsenal = this.modal();
    this.card = el('div', 'card panel hidden');
    this.bubble = el('div', 'bubble panel hidden');
    this.bubble.addEventListener('pointerdown', () => this.showBubble(null, 0, 0));
    this.tip = el('div', 'tip panel hidden');
    this.help = this.modal('help');
    this.settings = this.modal();
    this.pause = this.modal('pause');
    const pauseActions = el('div', 'actions');
    pauseActions.append(
      this.click(button(t('pause.resume')), () => this.show(null)),
      this.click(button(t('pause.restart')), () => {
        this.show(null);
        this.opts.restart(loadOverrides());
      }),
      this.click(button(t('pause.newMatch')), () => {
        this.show(null);
        this.opts.newMatch();
      }),
      this.click(button(`? ${t('ui.help')}`), () => this.show(this.help)),
      this.click(button(`⚙ ${t('ui.settings')}`), () => this.openSettings()),
    );
    this.pause.append(el('h2', '', t('pause.title')), el('p', '', t('pause.body')), pauseActions);
    this.root.append(
      bar,
      sys,
      this.card,
      this.bubble,
      this.tip,
      this.veil,
      this.arsenal,
      this.help,
      this.settings,
      this.pause,
    );
  }

  /** Toggles the browser's full screen, like F11; the tooltip follows the state. */
  private fullscreenButton(): HTMLButtonElement {
    const b = this.click(button(t('ui.fullscreen'), 'icon'), () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen().catch(() => undefined);
    });
    const sync = (): void => {
      b.title = t(document.fullscreenElement ? 'tip.fullscreenExit' : 'tip.fullscreen');
    };
    sync();
    document.addEventListener('fullscreenchange', sync);
    return b;
  }

  /** The ◎ button appears once the camera has left the default view (zoom or pan). */
  showResetView(away: boolean): void {
    this.resetView.classList.toggle('hidden', !away);
  }

  /** True while a menu that stops the clock is open (pause, help, settings). */
  get blocking(): boolean {
    return this.open !== null && this.open !== this.arsenal;
  }

  /** Escape: closes the open menu, or opens the pause menu. */
  escape(): void {
    this.show(this.open ? null : this.pause);
  }

  private click(b: HTMLButtonElement, fn: () => void): HTMLButtonElement {
    b.addEventListener('click', fn);
    return b;
  }

  private modal(extra = ''): HTMLElement {
    return el('div', `modal panel hidden ${extra}`.trim());
  }

  private closeButton(): HTMLButtonElement {
    return this.click(button('✕', 'close'), () => this.show(null));
  }

  /** Shows one modal (or none), with the veil behind it. */
  private show(panel: HTMLElement | null): void {
    for (const p of [this.arsenal, this.help, this.settings, this.pause]) {
      p.classList.toggle('hidden', p !== panel);
    }
    this.veil.classList.toggle('hidden', panel === null);
    this.open = panel;
    if (panel === this.arsenal) this.renderArsenal(true);
    if (panel === this.help) renderTutorial(this.help, () => this.show(null));
  }

  private toggle(panel: HTMLElement): void {
    this.show(this.open === panel ? null : panel);
  }

  /** Selects the unit under a click (or clears the card). */
  selectUnit(unitId: number | null): void {
    this.selectedUnit = unitId;
    this.cardSignature = '';
    this.card.classList.toggle('hidden', unitId === null);
  }

  /**
   * The bubble over a map object (screen px of the point it hangs from), or none. The text is
   * rebuilt only when it changes.
   */
  showBubble(info: { title: string; text: string } | null, sx: number, sy: number): void {
    this.bubble.classList.toggle('hidden', info === null);
    if (!info) {
      this.bubbleText = '';
      return;
    }
    const text = `${info.title}|${info.text}`;
    if (text !== this.bubbleText) {
      this.bubbleText = text;
      this.bubble.replaceChildren(el('b', '', info.title), el('div', '', info.text));
    }
    this.bubble.style.left = `${Math.round(sx)}px`;
    this.bubble.style.top = `${Math.round(sy)}px`;
  }

  /** The tiny help bubble at screen px (sx, sy), above a unit, or none. */
  showTip(text: string | null, sx: number, sy: number): void {
    this.tip.classList.toggle('hidden', text === null);
    if (text === null) return;
    if (this.tip.textContent !== text) this.tip.textContent = text;
    this.tip.style.left = `${Math.round(sx)}px`;
    this.tip.style.top = `${Math.round(sy)}px`;
  }

  /** Puts the character card on the side of the screen away from its unit. */
  setCardSide(side: 'left' | 'right'): void {
    this.card.classList.toggle('left', side === 'left');
  }

  /** Called every frame with the current view, the charged power and the frame time in ms. */
  update(view: SimView, power: number, now: number): void {
    this.view = view;
    this.hud.update(view, power, now);
    const phase = view.turn.phase;
    const canMove = phase === 'action' || phase === 'retreat';
    const budget = (view.rules.unit.moveBudget ?? 0) * 256;
    const moveLeft = budget === 0 || view.turn.moveLeft > 0;
    const jumpLeft = budget === 0 || view.turn.moveLeft === budget;
    const canSwitch = canSwitchUnit(view) && nextTeammate(view) !== null;
    const ladder = this.onLadder();
    this.down.classList.toggle('hidden', !ladder);
    // Who plays is never in doubt: Fire wears the colours of the house whose turn it is.
    const colour = FACTIONS[view.turn.activeTeam]?.primary ?? COLORS.vermillon;
    if (colour !== this.fireColour) {
      this.fireColour = colour;
      this.fire.style.background = css(colour);
      this.fire.style.borderColor = css(colour);
    }
    for (const b of this.actionButtons) {
      const when = b.dataset.when;
      b.disabled =
        when === 'switch'
          ? !canSwitch
          : when === 'walk'
            ? !canMove || !moveLeft
            : when === 'jump'
              ? !canMove || !jumpLeft
              : when === 'up'
                ? !canMove || (ladder ? !moveLeft : !jumpLeft)
                : when === 'end'
                  ? !canMove
                  : phase !== 'action';
    }
    // Before the shot it passes the turn; after it, it ends the turn.
    const skipLabel = phase === 'retreat' ? t('ui.endTurn') : t('ui.skip');
    if (this.skip.textContent !== skipLabel) this.skip.textContent = skipLabel;
    const def = view.rules.weapons.find((w) => w.id === view.turn.weapon);
    const build = def?.behavior === 'build';
    const fused = def?.behavior === 'fusedBouncer' || def?.behavior === 'cluster' || build;
    this.fuses.classList.toggle('hidden', !fused);
    const fuseSeconds = Math.round((view.turn.fuse || (def?.defaultFuse ?? 0)) / 60);
    // A fuse in turns (Greek fire) offers 1 to 3 turns; in seconds, 1 to 5; a wall, 3 lengths.
    const inTurns = def?.fuseTurns !== undefined || build;
    const fuseLabel = t(build ? 'ui.wallLength' : inTurns ? 'ui.fuseTurns' : 'ui.fuse');
    const fuseTitle = this.fuses.firstElementChild;
    if (fuseTitle && fuseTitle.textContent !== fuseLabel) fuseTitle.textContent = fuseLabel;
    for (const b of this.fuses.querySelectorAll('button')) {
      b.classList.toggle('on', b.dataset.fuse === String(fuseSeconds));
      b.classList.toggle('hidden', inTurns && Number(b.dataset.fuse) > 3);
    }
    // Fire says what the weapon does: strike, dig, set, build…
    const fireLabel = t(`ui.fire.${def?.behavior ?? 'directHit'}`);
    if (this.fire.textContent !== fireLabel) this.fire.textContent = fireLabel;
    if (this.open === this.arsenal) this.renderArsenal(false);
    this.renderCard(view);
  }

  private renderArsenal(force: boolean): void {
    const v = this.view;
    if (!v) return;
    const team = v.teams[v.turn.activeTeam];
    const signature = `${v.turn.weapon}|${team?.ammo.join(',')}|${v.turn.phase}|${v.turn.activeUnitId}`;
    if (!force && signature === this.arsenalSignature) return;
    this.arsenalSignature = signature;
    this.arsenal.replaceChildren(this.closeButton(), el('h2', '', t('ui.arsenal')));
    const grid = el('div', 'grid');
    const unit = v.units.find((u) => u.id === v.turn.activeUnitId);
    v.rules.weapons.forEach((w, idx) => {
      const ammo = team?.ammo[idx] ?? 0;
      // A cleric may not take up a melee weapon (GDD §3.2).
      const allowed = !unit || mayUse(v, unit, w);
      const b = button('', `weapon${w.id === v.turn.weapon ? ' on' : ''}`);
      b.append(el('b', '', t(`weapons.${w.id}`)));
      for (const line of weaponLines({ ...w, ammo })) b.append(el('small', '', line));
      if (!allowed) b.append(el('small', '', t('weapons.forbidden')));
      b.disabled = ammo === 0 || !allowed || v.turn.phase !== 'action';
      b.addEventListener('click', () => {
        this.opts.intents.selectWeapon = w.id;
        this.show(null);
      });
      grid.append(b);
    });
    this.arsenal.append(grid);
  }

  private renderCard(v: SimView): void {
    if (this.selectedUnit === null) return;
    const u = v.units.find((x) => x.id === this.selectedUnit);
    if (!u) return;
    const active = u.id === v.turn.activeUnitId && v.turn.phase !== 'gameOver';
    // A teammate of the playing unit: says whether a click can still hand it the turn.
    const mate = !active && u.team === v.turn.activeTeam && v.turn.phase !== 'gameOver';
    const switchable = mate && canSwitchUnit(v) && u.id !== v.turn.restingUnitId;
    const resting = mate && u.id === v.turn.restingUnitId;
    const marks = v.afflictions
      .filter((a) => a.unitId === u.id)
      .map((a) => `${a.trick}:${a.turns}`);
    const signature = `${marks.join(',')}|${u.hp}|${u.alive}|${u.grounded}|${active}|${switchable}|${resting}|${v.turn.weapon}|${v.turn.phase}`;
    if (signature === this.cardSignature) return;
    this.cardSignature = signature;

    const faction = FACTIONS[u.team];
    const r = v.rules.unit;
    const cls = classOf(v, u);
    const state = !u.alive
      ? t('card.state.dead')
      : !u.grounded
        ? t('card.state.air')
        : active
          ? t('card.state.active')
          : mate
            ? t(
                resting
                  ? 'card.state.resting'
                  : switchable
                    ? 'card.state.mate'
                    : 'card.state.tooLate',
              )
            : t('card.state.waiting');
    const house = el('div', 'house');
    house.append(
      shield(faction?.primary ?? COLORS.encre, faction?.secondary ?? COLORS.or, true),
      el('span', '', faction ? t(faction.nameKey) : ''),
    );
    house.style.color = css(faction?.primary ?? COLORS.encre);
    const hpBar = el('div', 'hpbar');
    const fill = el('i');
    const maxHp = maxHpOf(v, u);
    fill.style.width = `${Math.min(100, (u.hp * 100) / maxHp)}%`;
    hpBar.append(fill);
    const rules = el('ul');
    for (const line of [
      t('card.rule.walk', { speed: (r.walkSpeed / 256).toLocaleString('fr-FR'), step: r.maxStep }),
      t('card.rule.fall', { safe: r.fallSafeHeight, per: r.fallPxPerHp, max: r.fallMaxDamage }),
      t('card.rule.hurt'),
      t('card.rule.death'),
    ]) {
      rules.append(el('li', '', line));
    }
    this.card.replaceChildren(
      this.click(button('✕', 'close'), () => this.selectUnit(null)),
      el('h2', '', unitName(u.id)),
      house,
      el('div', '', `${t('card.hp')} : ${u.hp} / ${maxHp}`),
      hpBar,
      el('div', '', `${t('card.state')} : ${state}`),
      ...v.afflictions
        .filter((a) => a.unitId === u.id)
        .map((a) => el('div', 'note', t(`card.trick.${a.trick}`, { turns: a.turns }))),
      el('h3', '', cls ? `${t('card.class')} : ${t(`classes.${cls}`)}` : t('card.class')),
      ...this.classLines(v, cls).map((line) => el('div', '', line)),
      el('h3', '', t('card.rules')),
      rules,
    );
    if (active) {
      const def = v.rules.weapons.find((w) => w.id === v.turn.weapon);
      if (def) {
        const list = el('ul');
        for (const line of weaponLines(def)) list.append(el('li', '', line));
        this.card.append(el('h3', '', `${t('card.weapon')} : ${t(`weapons.${def.id}`)}`), list);
      }
    }
  }

  /** The playing unit can climb a ladder where it stands. */
  private onLadder(): boolean {
    const v = this.view;
    const u = v?.units.find((x) => x.id === v.turn.activeUnitId);
    return v !== null && u !== undefined && u.alive && canClimb(v.terrain, u, v.rules.unit);
  }

  /** The passive and the drawback of a class, with this match's values (GDD §3.2). */
  private classLines(v: SimView, cls: string | null): string[] {
    const c = v.rules.classes;
    if (!c || !cls) return [t('card.noClass')];
    const less = (pct: number): number => 100 - pct;
    const params: Record<string, Record<string, number>> = {
      knight: { pct: less(c.knight.blastTakenPct) },
      archer: { pct: c.archer.previewPct - 100 },
      slinger: { pct: c.slinger.throwPct - 100, hp: -c.slinger.hpDelta },
      sapper: {},
      cleric: { hp: c.cleric.blessHp, px: c.cleric.blessRadius },
      king: { pct: c.king.auraPct - 100, px: c.king.auraRadius, hp: -c.king.hpDelta },
    };
    const p = params[cls] ?? {};
    const lines = [t(`classes.${cls}.passive`, p), t(`classes.${cls}.drawback`, p)];
    if (cls === 'king' && v.rules.regicide) lines.push(t('classes.king.regicide'));
    return lines;
  }

  private openSettings(): void {
    if (this.open === this.settings) {
      this.show(null);
      return;
    }
    const overrides = new Map<string, number>(Object.entries(loadOverrides()));
    const asObject = (): TuningOverrides => Object.fromEntries(overrides);
    const base: MatchRules = CLASSIC_RULES;
    this.settings.replaceChildren(
      this.closeButton(),
      el('h2', '', t('tuning.title')),
      el('p', 'note', t('tuning.note')),
    );
    // One tab per group, so the panel never needs a long scroll.
    const tabs = el('div', 'tabs');
    const pages: HTMLElement[] = [];
    const showTab = (n: number): void => {
      this.settingsTab = n;
      pages.forEach((p, k) => p.classList.toggle('hidden', k !== n));
      tabs.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === n));
    };
    this.settings.append(tabs);
    for (const group of tuningGroups(base)) {
      const n = pages.length;
      tabs.append(this.click(button(t(group.titleKey)), () => showTab(n)));
      const table = el('table');
      pages.push(table);
      for (const f of group.fields) {
        const def = readValue(base, f.path) ?? 0;
        const input = el('input');
        input.type = 'number';
        input.step = String(f.step);
        input.min = String(f.min);
        input.max = String(f.max);
        input.value = String(toDisplay(f, overrides.get(f.path) ?? def));
        // Typing in the panel must not move the unit.
        input.addEventListener('keydown', (e) => e.stopPropagation());
        input.addEventListener('change', () => {
          const stored = toStored(f, Number(input.value));
          input.value = String(toDisplay(f, stored));
          if (stored === def) overrides.delete(f.path);
          else overrides.set(f.path, stored);
        });
        const row = el('tr');
        const cell = el('td');
        cell.append(input);
        row.append(
          el('td', '', t(f.labelKey)),
          cell,
          el('td', 'unit', t(f.unitKey)),
          el('td', 'def', t('tuning.default', { v: toDisplay(f, def).toLocaleString('fr-FR') })),
        );
        table.append(row);
      }
      this.settings.append(table);
    }
    showTab(Math.min(this.settingsTab, pages.length - 1));
    const actions = el('div', 'actions');
    actions.append(
      this.click(button(t('tuning.apply')), () => {
        saveOverrides(asObject());
        this.show(null);
        this.opts.restart(asObject());
      }),
      this.click(button(t('tuning.reset')), () => {
        saveOverrides({});
        this.open = null;
        this.openSettings();
      }),
      this.click(button(t('tuning.copy')), () => {
        void navigator.clipboard?.writeText(JSON.stringify(asObject(), null, 2));
        window.alert(t('tuning.copied'));
      }),
    );
    this.settings.append(actions);
    this.show(this.settings);
  }

  destroy(): void {
    this.hud.destroy();
    this.root.replaceChildren();
  }
}
