// On-screen controls for mouse and touch: action bar, arsenal, character card, help and the
// playtest settings panel. Reads the sim view; acts only through UiIntents (CLAUDE.md rule 3).
import { CLASSIC_RULES, type MatchRules } from '../content/rules.ts';
import { FACTIONS, UNIT_NAMES } from '../content/factions.ts';
import type { UiIntents } from '../input/ui-intents.ts';
import type { SimView } from '../sim/sim.ts';
import { t } from './i18n.ts';
import { button, el, holdButton, uiRoot } from './overlay.ts';
import { css } from './tokens.ts';
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
  private readonly bar: HTMLElement;
  private readonly fuses: HTMLElement;
  private readonly actionButtons: HTMLButtonElement[] = [];
  private readonly arsenal: HTMLElement;
  private readonly card: HTMLElement;
  private readonly help: HTMLElement;
  private readonly settings: HTMLElement;
  private selectedUnit: number | null = null;
  private cardSignature = '';
  private arsenalSignature = '';
  private view: SimView | null = null;

  constructor(opts: GameUiOptions) {
    this.opts = opts;
    this.root = uiRoot();
    this.root.replaceChildren();
    const i = opts.intents;

    this.bar = el('div', 'bar panel');
    /** 'move': usable in action and retreat; 'action': only before the shot. */
    const act = (b: HTMLButtonElement, when: 'move' | 'action' = 'action'): HTMLButtonElement => {
      b.dataset.when = when;
      this.actionButtons.push(b);
      return b;
    };
    this.fuses = el('div', 'fuses');
    this.fuses.append(el('span', '', t('ui.fuse')));
    for (let s = 1; s <= 5; s++) {
      const b = act(button(String(s)));
      b.dataset.fuse = String(s);
      b.addEventListener('click', () => (i.fuse = s));
      this.fuses.append(b);
    }
    this.bar.append(
      act(
        holdButton(t('ui.walkLeft'), (h) => (i.walk = h ? -1 : 0)),
        'move',
      ),
      act(
        holdButton(t('ui.walkRight'), (h) => (i.walk = h ? 1 : 0)),
        'move',
      ),
      act(
        this.click(button(t('ui.jumpForward')), () => (i.jump = 'forward')),
        'move',
      ),
      act(
        this.click(button(t('ui.jumpBack')), () => (i.jump = 'back')),
        'move',
      ),
      act(this.click(button(t('ui.arsenal')), () => this.toggle(this.arsenal))),
      this.fuses,
      act(holdButton(t('ui.fire'), (h) => (i.charge = h), 'fire')),
      act(this.click(button(t('ui.skip')), () => (i.skip = true))),
      this.click(button(`? ${t('ui.help')}`), () => this.toggle(this.help)),
      this.click(button(`⚙ ${t('ui.settings')}`), () => this.openSettings()),
    );

    this.arsenal = this.modal();
    this.card = el('div', 'card panel hidden');
    this.help = this.modal();
    this.help.classList.add('help');
    this.help.append(el('h2', '', t('help.title')), el('p', '', t('help.body')));
    this.settings = this.modal();
    this.root.append(this.bar, this.card, this.arsenal, this.help, this.settings);
  }

  private click(b: HTMLButtonElement, fn: () => void): HTMLButtonElement {
    b.addEventListener('click', fn);
    return b;
  }

  private modal(): HTMLElement {
    const m = el('div', 'modal panel hidden');
    return m;
  }

  private closeButton(target: HTMLElement): HTMLButtonElement {
    return this.click(button('✕', 'close'), () => target.classList.add('hidden'));
  }

  private toggle(panel: HTMLElement): void {
    const show = panel.classList.contains('hidden');
    for (const p of [this.arsenal, this.help, this.settings]) p.classList.add('hidden');
    if (show) panel.classList.remove('hidden');
    if (show && panel === this.arsenal) this.renderArsenal(true);
    if (show && panel === this.help && !panel.querySelector('.close')) {
      panel.prepend(this.closeButton(panel));
    }
  }

  /** Selects the unit under a click (or clears the card). */
  selectUnit(unitId: number | null): void {
    this.selectedUnit = unitId;
    this.cardSignature = '';
    this.card.classList.toggle('hidden', unitId === null);
  }

  /** Called every frame with the current view. */
  update(view: SimView): void {
    this.view = view;
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
    if (!this.arsenal.classList.contains('hidden')) this.renderArsenal(false);
    this.renderCard(view);
  }

  private renderArsenal(force: boolean): void {
    const v = this.view;
    if (!v) return;
    const team = v.teams[v.turn.activeTeam];
    const signature = `${v.turn.weapon}|${team?.ammo.join(',')}|${v.turn.phase}`;
    if (!force && signature === this.arsenalSignature) return;
    this.arsenalSignature = signature;
    this.arsenal.replaceChildren(this.closeButton(this.arsenal), el('h2', '', t('ui.arsenal')));
    const grid = el('div', 'grid');
    v.rules.weapons.forEach((w, idx) => {
      const ammo = team?.ammo[idx] ?? 0;
      const b = button('', `weapon${w.id === v.turn.weapon ? ' on' : ''}`);
      b.append(el('b', '', t(`weapons.${w.id}`)));
      for (const line of weaponLines({ ...w, ammo })) b.append(el('small', '', line));
      b.disabled = ammo === 0 || v.turn.phase !== 'action';
      b.addEventListener('click', () => {
        this.opts.intents.selectWeapon = w.id;
        this.arsenal.classList.add('hidden');
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
    const house = el('div', 'house', faction ? t(faction.nameKey) : '');
    house.style.color = css(faction?.primary ?? 0);
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
      el('h2', '', UNIT_NAMES[(u.id - 1) % UNIT_NAMES.length] ?? ''),
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
    if (!this.settings.classList.contains('hidden')) {
      this.settings.classList.add('hidden');
      return;
    }
    const overrides = new Map<string, number>(Object.entries(loadOverrides()));
    const asObject = (): TuningOverrides => Object.fromEntries(overrides);
    const base: MatchRules = CLASSIC_RULES;
    this.settings.replaceChildren(
      this.closeButton(this.settings),
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
        this.settings.classList.add('hidden');
        this.opts.restart(asObject());
      }),
      this.click(button(t('tuning.reset')), () => {
        saveOverrides({});
        this.settings.classList.add('hidden');
        this.openSettings();
      }),
      this.click(button(t('tuning.copy')), () => {
        void navigator.clipboard?.writeText(JSON.stringify(asObject(), null, 2));
        window.alert(t('tuning.copied'));
      }),
    );
    this.settings.append(actions);
    for (const p of [this.arsenal, this.help]) p.classList.add('hidden');
    this.settings.classList.remove('hidden');
  }

  destroy(): void {
    this.root.replaceChildren();
  }
}
