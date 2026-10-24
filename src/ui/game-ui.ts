// On-screen controls for mouse and touch: virtual pad and weapon cluster, HUD, arsenal, character
// card, help, pause menu and the playtest settings panel. Reads the sim view; acts only through
// UiIntents (CLAUDE.md rule 3).
import { CLASSIC_RULES, type MatchRules } from '../content/rules.ts';
import { FACTIONS, unitName } from '../content/factions.ts';
import type { UiIntents } from '../input/ui-intents.ts';
import type { SimView } from '../sim/sim.ts';
import { Hud } from './hud.ts';
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
}

export class GameUi {
  private readonly opts: GameUiOptions;
  private readonly root: HTMLElement;
  readonly hud: Hud;
  private readonly fuses: HTMLElement;
  private readonly actionButtons: HTMLButtonElement[] = [];
  private readonly veil: HTMLElement;
  private readonly arsenal: HTMLElement;
  private readonly card: HTMLElement;
  private readonly help: HTMLElement;
  private readonly settings: HTMLElement;
  private readonly pause: HTMLElement;
  /** the modal on screen, if any */
  private open: HTMLElement | null = null;
  private selectedUnit: number | null = null;
  private cardSignature = '';
  private arsenalSignature = '';
  private view: SimView | null = null;

  constructor(opts: GameUiOptions) {
    this.opts = opts;
    this.root = uiRoot();
    this.root.replaceChildren();
    const i = opts.intents;
    this.hud = new Hud(this.root);

    /** 'move': usable in action and retreat; 'action': only before the shot. */
    const act = (
      b: HTMLButtonElement,
      when: 'move' | 'action' = 'action',
      tip = '',
    ): HTMLButtonElement => {
      b.dataset.when = when;
      if (tip) b.title = t(tip);
      this.actionButtons.push(b);
      return b;
    };
    // Virtual pad, bottom left (GDD §8.2): walk, jump, aim, turn around.
    const pad = el('div', 'cluster pad panel');
    pad.append(
      act(
        holdButton(t('ui.walkLeft'), (h) => (i.walk = h ? -1 : 0)),
        'move',
        'tip.walkLeft',
      ),
      act(
        holdButton(t('ui.walkRight'), (h) => (i.walk = h ? 1 : 0)),
        'move',
        'tip.walkRight',
      ),
      act(
        this.click(button(t('ui.jumpForward')), () => (i.jump = 'forward')),
        'move',
        'tip.jumpForward',
      ),
      act(
        this.click(button(t('ui.jumpBack')), () => (i.jump = 'back')),
        'move',
        'tip.jumpBack',
      ),
      act(
        holdButton(t('ui.aimUp'), (h) => (i.aim = h ? 1 : 0)),
        'action',
        'tip.aimUp',
      ),
      act(
        holdButton(t('ui.aimDown'), (h) => (i.aim = h ? -1 : 0)),
        'action',
        'tip.aimDown',
      ),
      act(
        this.click(button(t('ui.flip')), () => (i.flip = true)),
        'action',
        'tip.flip',
      ),
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
    const arms = el('div', 'cluster arms panel');
    arms.append(
      act(this.click(button(t('ui.arsenal')), () => this.toggle(this.arsenal))),
      this.fuses,
      act(this.click(button(t('ui.skip')), () => (i.skip = true))),
      act(holdButton(t('ui.fire'), (h) => (i.charge = h), 'fire')),
    );
    const sys = el('div', 'sys');
    sys.append(
      this.click(button(`? ${t('ui.help')}`), () => this.toggle(this.help)),
      this.click(button(`⚙ ${t('ui.settings')}`), () => this.openSettings()),
      this.click(button(`☰ ${t('ui.pause')}`), () => this.toggle(this.pause)),
    );

    this.veil = el('div', 'veil hidden');
    this.veil.addEventListener('pointerdown', () => this.show(null));
    this.arsenal = this.modal();
    this.card = el('div', 'card panel hidden');
    this.help = this.modal('help');
    this.help.append(this.closeButton(), el('h2', '', t('help.title')));
    for (const line of t('help.body').split('\n')) this.help.append(el('p', '', line));
    this.settings = this.modal();
    this.pause = this.modal('pause');
    const pauseActions = el('div', 'actions');
    pauseActions.append(
      this.click(button(t('pause.resume')), () => this.show(null)),
      this.click(button(t('pause.restart')), () => {
        this.show(null);
        this.opts.restart(loadOverrides());
      }),
      this.click(button(`? ${t('ui.help')}`), () => this.show(this.help)),
      this.click(button(`⚙ ${t('ui.settings')}`), () => this.openSettings()),
    );
    this.pause.append(el('h2', '', t('pause.title')), el('p', '', t('pause.body')), pauseActions);
    this.root.append(
      pad,
      arms,
      sys,
      this.card,
      this.veil,
      this.arsenal,
      this.help,
      this.settings,
      this.pause,
    );
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

  /** Called every frame with the current view, the charged power and the frame time in ms. */
  update(view: SimView, power: number, now: number): void {
    this.view = view;
    this.hud.update(view, power, now);
    const phase = view.turn.phase;
    const canMove = phase === 'action' || phase === 'retreat';
    for (const b of this.actionButtons) {
      b.disabled = b.dataset.when === 'move' ? !canMove : phase !== 'action';
    }
    const def = view.rules.weapons.find((w) => w.id === view.turn.weapon);
    this.fuses.classList.toggle('hidden', def?.behavior !== 'fusedBouncer');
    const fuseSeconds = Math.round((view.turn.fuse || (def?.defaultFuse ?? 0)) / 60);
    for (const b of this.fuses.querySelectorAll('button')) {
      b.classList.toggle('on', b.dataset.fuse === String(fuseSeconds));
    }
    if (this.open === this.arsenal) this.renderArsenal(false);
    this.renderCard(view);
  }

  private renderArsenal(force: boolean): void {
    const v = this.view;
    if (!v) return;
    const team = v.teams[v.turn.activeTeam];
    const signature = `${v.turn.weapon}|${team?.ammo.join(',')}|${v.turn.phase}`;
    if (!force && signature === this.arsenalSignature) return;
    this.arsenalSignature = signature;
    this.arsenal.replaceChildren(this.closeButton(), el('h2', '', t('ui.arsenal')));
    const grid = el('div', 'grid');
    v.rules.weapons.forEach((w, idx) => {
      const ammo = team?.ammo[idx] ?? 0;
      const b = button('', `weapon${w.id === v.turn.weapon ? ' on' : ''}`);
      b.append(el('b', '', t(`weapons.${w.id}`)));
      for (const line of weaponLines({ ...w, ammo })) b.append(el('small', '', line));
      b.disabled = ammo === 0 || v.turn.phase !== 'action';
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
    const signature = `${u.hp}|${u.alive}|${u.grounded}|${active}|${v.turn.weapon}|${v.turn.phase}`;
    if (signature === this.cardSignature) return;
    this.cardSignature = signature;

    const faction = FACTIONS[u.team];
    const r = v.rules.unit;
    const state = !u.alive
      ? t('card.state.dead')
      : !u.grounded
        ? t('card.state.air')
        : active
          ? t('card.state.active')
          : t('card.state.waiting');
    const house = el('div', 'house');
    house.append(
      shield(faction?.primary ?? COLORS.encre, faction?.secondary ?? COLORS.or, true),
      el('span', '', faction ? t(faction.nameKey) : ''),
    );
    house.style.color = css(faction?.primary ?? COLORS.encre);
    const hpBar = el('div', 'hpbar');
    const fill = el('i');
    fill.style.width = `${Math.min(100, (u.hp * 100) / Math.max(1, v.rules.startHp))}%`;
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
      el('div', '', `${t('card.hp')} : ${u.hp} / ${v.rules.startHp}`),
      hpBar,
      el('div', '', `${t('card.state')} : ${state}`),
      el('h3', '', t('card.class')),
      el('div', '', t('card.noClass')),
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
    for (const group of tuningGroups(base)) {
      this.settings.append(el('h3', '', t(group.titleKey)));
      const table = el('table');
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
    this.root.replaceChildren();
  }
}
