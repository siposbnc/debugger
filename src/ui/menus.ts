import type { SaveData } from '../save/save';
import { persistSave, wipeSave } from '../save/save';
import { CHARACTER_LIST, CHARACTERS } from '../data/characters';
import { MAP_LIST, MAPS } from '../data/maps';
import { META_UPGRADES, metaCost } from '../data/meta';
import { SHOP_WEAPONS, WEAPONS } from '../data/weapons';
import { ENEMIES } from '../data/enemies';
import { BOSSES } from '../data/bosses';
import { OBJECTIVES } from '../data/objectives';
import { CARD_BY_ID } from '../data/upgrades';
import { PATCH_NOTES } from '../data/patchNotes';
import { RARITY_COLOR, RARITY_ORDER, type StatMods, type EnemyDef, type BossDef, type MetaUpgradeDef, type WeaponLevelStats } from '../data/types';
import { bugSprite, bossSprite } from '../render/sprites';
import { computeStats, type ComputedStats } from '../game/stats';
import { formatTime, formatDuration, mulberry32 } from '../core/util';
import { DEFAULT_BINDINGS, type BindAction } from '../core/input';
import { sound } from '../audio/sound';
import { makeOffer, applyOffer, offerOdds, type OfferItem } from '../game/levelup';
import { effective } from '../game/combat';
import type { Run, RunResults } from '../game/run';
import { KbNav } from './kbnav';

// All DOM UI: menus, shop, codex, settings, level-up modal, pause, summary.
// Mutates the shared SaveData for purchases and persists immediately.

// Remappable actions shown in settings (arrows/Esc stay fixed fallbacks).
const BIND_ACTIONS: { action: BindAction; label: string }[] = [
  { action: 'up', label: 'Move up' },
  { action: 'down', label: 'Move down' },
  { action: 'left', label: 'Move left' },
  { action: 'right', label: 'Move right' },
  { action: 'pause', label: 'Pause' },
];

/** Human label for a KeyboardEvent.code ("KeyW" → "W", "ArrowUp" → "↑"). */
function keyLabel(code: string): string {
  const arrows: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  return arrows[code] ?? code.replace(/^(Key|Digit)/, '').toUpperCase();
}

// Card stat preview: each StatMods key → the resolved stat it lands on and how
// to print it. Resulting values come from computeStats() with the card
// hypothetically applied, so every cap/floor (75% CDR, 100% crit, …) is
// inherited — never duplicate clamp constants here.
const STAT_VIEW: Partial<Record<keyof StatMods, {
  label: string; get: (s: ComputedStats) => number; fmt: (v: number) => string;
}>> = {
  maxHp: { label: 'Max HP', get: (s) => s.maxHp, fmt: (v) => `${Math.round(v)}` },
  regen: { label: 'Regen', get: (s) => s.regen, fmt: (v) => `${+v.toFixed(1)}/s` },
  armor: { label: 'Armor', get: (s) => s.armor, fmt: (v) => `${v}` },
  speed: { label: 'Speed', get: (s) => s.moveSpeed, fmt: (v) => `${Math.round(v)}` },
  damage: { label: 'Damage', get: (s) => s.damageMult, fmt: (v) => `×${v.toFixed(2)}` },
  cooldown: { label: 'Cooldown', get: (s) => 1 - s.cooldownFactor, fmt: (v) => `−${Math.round(v * 100)}%` },
  area: { label: 'Area', get: (s) => s.areaMult, fmt: (v) => `×${v.toFixed(2)}` },
  projectiles: { label: 'Projectiles', get: (s) => s.projectiles, fmt: (v) => `+${v}` },
  critChance: { label: 'Crit chance', get: (s) => s.critChance, fmt: (v) => `${Math.round(v * 100)}%` },
  critMult: { label: 'Crit dmg', get: (s) => s.critMult, fmt: (v) => `×${v.toFixed(2)}` },
  pickupRadius: { label: 'Pickup', get: (s) => s.pickupRadius, fmt: (v) => `${Math.round(v)}` },
  xpGain: { label: 'XP gain', get: (s) => s.xpMult, fmt: (v) => `×${v.toFixed(2)}` },
  luck: { label: 'Luck', get: (s) => s.luck, fmt: (v) => `${v}` },
  shield: { label: 'Shield', get: (s) => s.shieldMax, fmt: (v) => `${Math.round(v)}` },
};

/** "dmg ×1.00 → ×1.08" rows for a stat card, with CAPPED marks on mods the
 *  stat clamps would fully waste. fullyCapped = every mod on the card is dead. */
function cardStatPreview(run: Run, cardId: string): { html: string; fullyCapped: boolean } {
  const card = CARD_BY_ID[cardId];
  if (!card) return { html: '', fullyCapped: false };
  const next = computeStats(run.character, run.metaLevels, [...run.cardMods, card.mods]);
  const rows: string[] = [];
  let live = 0;
  for (const k of Object.keys(card.mods) as (keyof StatMods)[]) {
    const view = STAT_VIEW[k];
    if (!view) continue;
    const a = view.get(run.stats), b = view.get(next);
    if (Math.abs(b - a) > 1e-9) {
      live++;
      rows.push(`<div class="stat-line"><span>${view.label}</span>` +
        `<span class="v"><span class="from">${view.fmt(a)} →</span> ${view.fmt(b)}</span></div>`);
    } else {
      rows.push(`<div class="stat-line wasted"><span>${view.label}</span>` +
        `<span class="v">${view.fmt(a)} <span class="cap-badge">CAPPED</span></span></div>`);
    }
  }
  return {
    html: rows.length > 0 ? `<div class="stat-preview">${rows.join('')}</div>` : '',
    fullyCapped: rows.length > 0 && live === 0,
  };
}

// Weapon preview: which levels[] fields change going into the offered level.
const WEAPON_FIELD_VIEW: [keyof WeaponLevelStats, string, (v: number) => string][] = [
  ['damage', 'Damage', (v) => `${Math.round(v)}`],
  ['cooldown', 'Cooldown', (v) => `${v.toFixed(2)}s`],
  ['count', 'Count', (v) => `${v}`],
  ['area', 'Area', (v) => `${Math.round(v)}`],
  ['speed', 'Speed', (v) => `${Math.round(v)}`],
  ['duration', 'Duration', (v) => `${+v.toFixed(1)}s`],
  ['pierce', 'Pierce', (v) => `${v}`],
  ['slow', 'Slow', (v) => `${Math.round(v * 100)}%`],
];

/** "Damage 22 → 30" rows for weapon offers: the concrete level delta for a
 *  weapon-up (only the fields that change), or the level-1 sheet for a new
 *  weapon (only its nonzero fields). Raw levels[] values — global multipliers
 *  (damageMult/CDR/area) apply on top and belong to the stat cards' preview. */
function weaponStatPreview(run: Run, item: OfferItem): string {
  const def = WEAPONS[item.id];
  if (!def) return '';
  let cur: WeaponLevelStats | null = null;
  let next: WeaponLevelStats;
  if (item.kind === 'weaponUp') {
    const w = run.weapons.find((x) => x.def.id === item.id);
    if (!w || w.level >= def.levels.length) return '';
    cur = def.levels[w.level - 1];
    next = def.levels[w.level];
  } else {
    next = def.levels[0];
  }
  const rows: string[] = [];
  for (const [key, label, fmt] of WEAPON_FIELD_VIEW) {
    const b = next[key];
    if (cur) {
      const a = cur[key];
      if (a === b) continue;
      rows.push(`<div class="stat-line"><span>${label}</span>` +
        `<span class="v"><span class="from">${fmt(a)} →</span> ${fmt(b)}</span></div>`);
    } else if (b !== 0) {
      rows.push(`<div class="stat-line"><span>${label}</span><span class="v">${fmt(b)}</span></div>`);
    }
  }
  return rows.length > 0 ? `<div class="stat-preview">${rows.join('')}</div>` : '';
}

export class UI {
  private root: HTMLElement;
  private nav = new KbNav();
  save: SaveData;
  onStartRun: (charId: string, mapId: string) => void = () => {};
  onResumeRun: () => void = () => {};
  onSettingsChanged: () => void = () => {};
  /** Which screen is up — the main loop consults this while paused to route
   *  Esc/B: 'pause' resumes, 'settings' returns to the pause overview. */
  screenKind = '';

  constructor(root: HTMLElement, save: SaveData) {
    this.root = root;
    this.save = save;
  }

  hide(): void {
    this.nav.detach();
    this.root.innerHTML = '';
    this.screenKind = '';
  }

  // Gamepad → menu navigation (the main loop polls the pad and drives these).
  navMove(dx: number, dy: number): void { this.nav.move(dx, dy); }
  navActivate(): void { this.nav.activate(); }
  navBack(): void { this.nav.back(); }

  private screen(html: string, onBack: (() => void) | null = null): HTMLElement {
    this.screenKind = ''; // specific show* methods override after rendering
    this.root.innerHTML = `<div class="screen">${html}</div>`;
    const el = this.root.firstElementChild as HTMLElement;
    el.querySelectorAll('button').forEach((b) =>
      b.addEventListener('mousedown', () => sound.play('click')));
    this.nav.attach(el, onBack);
    return el;
  }

  private persist(): void {
    persistSave(this.save);
  }

  // ---------- NEW badges (unseen codex/shop entries) ----------

  /** Is this meta upgrade revealed? Purchased always counts; the two specials
   *  derive from objectives; the rest come from play (save.unlockedMeta). */
  private metaUnlocked(m: MetaUpgradeDef): boolean {
    if ((this.save.metaLevels[m.id] ?? 0) > 0) return true;
    if (this.save.unlockedMeta.includes(m.id)) return true;
    if (m.special === 'bossReward') return this.save.completedObjectives.includes('boss1');
    if (m.special === 'weaponSlot') return this.save.completedObjectives.includes('evolve');
    return false;
  }

  /** Everything the shop screen lists, as namespaced seen-ids. Locked "???"
   *  meta rows are excluded so they badge NEW when they actually reveal. */
  private shopIds(): string[] {
    return [
      ...META_UPGRADES.filter((m) => this.metaUnlocked(m)).map((m) => `meta:${m.id}`),
      ...SHOP_WEAPONS.map((w) => `wpn:${w.id}`),
    ];
  }

  /** Everything the codex lists. Progressive unlocks: bug/boss entries only
   *  count once ENCOUNTERED — locked (glitched) rows neither badge nor get
   *  marked seen. */
  private codexIds(): string[] {
    const enc = new Set(this.save.encountered);
    return [
      ...Object.keys(ENEMIES).map((id) => `bug:${id}`).filter((id) => enc.has(id)),
      ...Object.keys(BOSSES).map((id) => `boss:${id}`).filter((id) => enc.has(id)),
    ];
  }

  /** The objectives screen's ids. Completed objectives get a distinct id so
   *  finishing one shows NEW once even after the base entry was seen. */
  private objectiveIds(): string[] {
    return OBJECTIVES.map((o) => `obj:${o.id}${this.save.completedObjectives.includes(o.id) ? ':done' : ''}`);
  }

  /** Ids from the list not seen before — marked seen (persisted) right away;
   *  the returned set keeps the badges up for the rest of the visit. */
  private takeUnseen(ids: string[]): Set<string> {
    const seen = new Set(this.save.seenIds);
    const fresh = new Set(ids.filter((id) => !seen.has(id)));
    if (fresh.size > 0) {
      this.save.seenIds.push(...fresh);
      this.persist();
    }
    return fresh;
  }

  private anyUnseen(ids: string[]): boolean {
    const seen = new Set(this.save.seenIds);
    return ids.some((id) => !seen.has(id));
  }

  private static newBadge(fresh: Set<string>, id: string): string {
    return fresh.has(id) ? ' <span class="new-badge">NEW</span>' : '';
  }

  /** Deterministic glitch-scramble of codex copy (progressive unlocks):
   *  letters/digits become corruption glyphs, spaces and punctuation keep the
   *  text shape readable-as-text-but-not-as-words. Seeded by the entry id, so
   *  the garbage is stable across visits — it reads like a corrupted record,
   *  not a slot machine. */
  private static scramble(text: string, seedId: string): string {
    let h = 0;
    for (let i = 0; i < seedId.length; i++) h = (h * 31 + seedId.charCodeAt(i)) | 0;
    const rng = mulberry32(h);
    const glyphs = '▓▒░#@$%?!/\\|=+~^*'; // no <>& — this lands in innerHTML
    return text.replace(/[A-Za-z0-9]/g, () => glyphs[Math.floor(rng() * glyphs.length)]);
  }

  /** A locked (not yet encountered) codex row: dimmed, "?" thumb, glitched copy. */
  static lockedCodexRow(id: string, name: string, desc: string, boss: boolean): string {
    return `
      <div class="codex-entry with-thumb locked">
        <div class="codex-thumb locked-thumb${boss ? ' boss' : ''}">?</div>
        <div class="codex-body">
          <b class="glitch-text">${UI.scramble(name, id)}</b>
          <span class="glitch-text">${UI.scramble(desc, `${id}:desc`)}</span>
        </div>
      </div>`;
  }

  // ---------- main menu ----------

  showMainMenu(): void {
    const susp = this.save.suspendedRun;
    const suspChar = susp ? CHARACTERS[susp.charId]?.name ?? susp.charId : '';
    const resumeBtn = susp
      ? `<button class="btn primary" data-act="resumeRun">RESUME RUN — ${suspChar} @ ${formatTime(susp.time)}</button>`
      : '';
    const s = this.screen(`
      <div class="title" data-text="DEBUGGER">DEBUGGER<span class="cursor">_</span></div>
      <div class="subtitle">// the bugs are real. squash them all.</div>
      <div class="bits-display">⌬ ${this.save.bits} bits</div>
      <div class="menu-col">
        ${resumeBtn}
        <button class="btn ${susp ? '' : 'primary'}" data-act="start">START RUN</button>
        <button class="btn" data-act="chars">CHARACTERS</button>
        <button class="btn" data-act="maps">MAPS</button>
        <button class="btn" data-act="shop">UPGRADES${this.anyUnseen(this.shopIds()) ? '<span class="new-dot">●</span>' : ''}</button>
        <button class="btn" data-act="codex">BUG DATABASE${this.anyUnseen(this.codexIds()) ? '<span class="new-dot">●</span>' : ''}</button>
        <button class="btn" data-act="objectives">OBJECTIVES${this.anyUnseen(this.objectiveIds()) ? '<span class="new-dot">●</span>' : ''}</button>
        <button class="btn" data-act="whatsnew">WHAT'S NEW${this.notesUnseen() ? '<span class="new-dot">●</span>' : ''}</button>
        <button class="btn" data-act="settings">SETTINGS</button>
      </div>
      <div class="controls-hint"><kbd>WASD</kbd> move/navigate &nbsp; <kbd>ENTER</kbd> select &nbsp; <kbd>ESC</kbd> back/pause &nbsp; <kbd>🎮</kbd> gamepad works too &nbsp; auto-attack: just survive</div>
      <div class="version-tag">v${__APP_VERSION__}</div>
    `);
    s.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      if (!act) return;
      sound.unlock();
      if (act === 'start') this.onStartRun(this.save.lastCharacter, this.save.lastMap);
      else if (act === 'resumeRun') this.onResumeRun();
      else if (act === 'chars') this.showCharSelect();
      else if (act === 'maps') this.showMapSelect();
      else if (act === 'shop') this.showShop();
      else if (act === 'codex') this.showCodex();
      else if (act === 'objectives') this.showObjectives();
      else if (act === 'whatsnew') this.showWhatsNew();
      else if (act === 'settings') this.showSettings();
    });
  }

  // ---------- what's new (patch notes) ----------

  /** Newest notes entry not opened yet? ('' on fresh saves also badges —
   *  every player discovers the screen once.) */
  private notesUnseen(): boolean {
    return PATCH_NOTES.length > 0 && this.save.lastSeenVersion !== PATCH_NOTES[0].version;
  }

  showWhatsNew(): void {
    const unseen = this.notesUnseen();
    if (unseen) {
      this.save.lastSeenVersion = PATCH_NOTES[0].version;
      this.persist(); // badge clears for next visit; stays up while reading
    }
    const panels = PATCH_NOTES.map((n, i) => `
      <div class="codex-panel note-panel">
        <h3>v${n.version} — ${n.name}${i === 0 && unseen ? ' <span class="new-badge">NEW</span>' : ''}</h3>
        <div class="note-date">released ${n.date}</div>
        <ul class="note-list">${n.highlights.map((h) => `<li>${h}</li>`).join('')}</ul>
        ${n.flavor ? `<div class="note-flavor">${n.flavor}</div>` : ''}
      </div>`).join('');
    const s = this.screen(`
      <div class="screen-heading">git log --since=last_visit</div>
      <div class="notes-col">${panels}</div>
      <button class="btn" data-act="back">BACK</button>
    `, () => this.showMainMenu());
    s.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')?.dataset.act === 'back') this.showMainMenu();
    });
  }

  // ---------- character select ----------

  showCharSelect(): void {
    const cards = CHARACTER_LIST.map((c) => {
      const unlocked = this.save.unlockedCharacters.includes(c.id);
      const selected = this.save.lastCharacter === c.id;
      const weaponName = c.special === 'randomWeapon' ? 'Random weapon' : WEAPONS[c.weapon].name;
      return `
        <div class="select-card ${unlocked ? '' : 'locked'} ${selected ? 'selected' : ''}"
             data-id="${c.id}" style="--accent:${c.color}">
          ${selected ? '<span class="selected-tag">▶ SELECTED</span>' : ''}
          <div class="icon">${c.icon}</div>
          <h3>${c.name}</h3>
          <div class="arch">${c.archetype}</div>
          <p>${c.desc}</p>
          <div class="passive">⌁ ${weaponName}<br>★ ${c.passiveDesc}</div>
          ${unlocked ? '' : `<div class="cost">🔒 ${c.cost} bits</div>`}
        </div>`;
    }).join('');
    const s = this.screen(`
      <div class="screen-heading">git checkout --character</div>
      <div class="bits-display">⌬ ${this.save.bits} bits</div>
      <div class="grid">${cards}</div>
      <button class="btn" data-act="back">BACK</button>
    `, () => this.showMainMenu());
    s.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('button')?.dataset.act === 'back') { this.showMainMenu(); return; }
      const card = t.closest<HTMLElement>('.select-card');
      if (!card) return;
      const id = card.dataset.id!;
      const def = CHARACTERS[id];
      if (this.save.unlockedCharacters.includes(id)) {
        this.save.lastCharacter = id;
        this.persist();
        sound.play('click');
        this.showCharSelect();
      } else if (this.save.bits >= def.cost) {
        this.save.bits -= def.cost;
        this.save.unlockedCharacters.push(id);
        this.save.lastCharacter = id;
        this.persist();
        sound.play('buy');
        this.showCharSelect();
      } else {
        sound.play('hurt');
      }
    });
  }

  // ---------- map select ----------

  showMapSelect(): void {
    const cleared = (id: string) => (this.save.mapVictories[id] ?? 0) > 0;
    const cards = MAP_LIST.map((m, i) => {
      const unlocked = this.save.unlockedMaps.includes(m.id);
      // Gated discovery: a map is visible once owned, or once its predecessor
      // (list = cost order) has been cleared. Hidden = silhouetted "???" card,
      // no name/cost — same visual language as locked codex/meta rows.
      if (!unlocked && i > 0 && !cleared(MAP_LIST[i - 1].id)) {
        return `
        <div class="select-card locked undiscovered">
          <div class="icon">?</div>
          <h3>???</h3>
          <div class="arch">target not discovered</div>
          <p class="glitch-text">${UI.scramble(m.desc, `map:${m.id}`)}</p>
          <div class="passive">ship the previous deployment to reveal</div>
        </div>`;
      }
      const selected = this.save.lastMap === m.id;
      return `
        <div class="select-card ${unlocked ? '' : 'locked'} ${selected ? 'selected' : ''}"
             data-id="${m.id}" style="--accent:${m.palette.accent}">
          ${selected ? '<span class="selected-tag">▶ SELECTED</span>' : ''}
          <div class="icon">${m.icon}</div>
          <h3>${m.name}</h3>
          <div class="arch">bits ×${m.bitsMult.toFixed(2)}</div>
          <p>${m.desc}</p>
          ${unlocked ? '' : `<div class="cost">🔒 ${m.cost} bits</div>`}
        </div>`;
    }).join('');
    const s = this.screen(`
      <div class="screen-heading">select deployment target</div>
      <div class="bits-display">⌬ ${this.save.bits} bits</div>
      <div class="grid">${cards}</div>
      <button class="btn" data-act="back">BACK</button>
    `, () => this.showMainMenu());
    s.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('button')?.dataset.act === 'back') { this.showMainMenu(); return; }
      const card = t.closest<HTMLElement>('.select-card');
      if (!card?.dataset.id) return; // undiscovered "???" cards carry no id
      const id = card.dataset.id;
      const def = MAPS[id];
      if (this.save.unlockedMaps.includes(id)) {
        this.save.lastMap = id;
        this.persist();
        this.showMapSelect();
      } else if (this.save.bits >= def.cost) {
        this.save.bits -= def.cost;
        this.save.unlockedMaps.push(id);
        this.save.lastMap = id;
        this.persist();
        sound.play('buy');
        this.showMapSelect();
      } else {
        sound.play('hurt');
      }
    });
  }

  // ---------- meta shop ----------

  /** `fresh` carries the badge set through self re-renders (purchases), so
   *  NEW tags survive buying — they clear on the next visit. */
  showShop(fresh?: Set<string>): void {
    fresh ??= this.takeUnseen(this.shopIds());
    const metaRows = META_UPGRADES.map((m) => {
      if (!this.metaUnlocked(m)) {
        // progressive unlocks: silhouetted ??? row, cost hidden — discover it
        // by playing (matching stat card / mechanic use / objective)
        return `
        <div class="shop-row locked">
          <div class="icon">?</div>
          <div class="info"><h4>???</h4><p class="glitch-text">${UI.scramble(m.desc, `meta:${m.id}`)}</p></div>
          <div class="pips"></div>
          <button class="btn small" disabled>🔒</button>
        </div>`;
      }
      const lvl = this.save.metaLevels[m.id] ?? 0;
      const maxed = lvl >= m.maxLevel;
      const cost = metaCost(m, lvl);
      const pips = Array.from({ length: m.maxLevel }, (_, i) =>
        `<span class="pip ${i < lvl ? 'on' : ''}"></span>`).join('');
      return `
        <div class="shop-row">
          <div class="icon">${m.icon}</div>
          <div class="info"><h4>${m.name}${UI.newBadge(fresh!, `meta:${m.id}`)}</h4><p>${m.desc}</p></div>
          <div class="pips">${pips}</div>
          <button class="btn small" data-meta="${m.id}" ${maxed || this.save.bits < cost ? 'disabled' : ''}>
            ${maxed ? 'MAX' : `${cost} ⌬`}
          </button>
        </div>`;
    }).join('');

    const weaponRows = SHOP_WEAPONS.map(({ id, cost }) => {
      const w = WEAPONS[id];
      const owned = this.save.unlockedWeapons.includes(id);
      return `
        <div class="shop-row">
          <div class="icon" style="color:${w.color}">${w.icon}</div>
          <div class="info"><h4>${w.name}${UI.newBadge(fresh!, `wpn:${id}`)}</h4><p>${w.desc} Evolves into ${WEAPONS[w.evolveTo!].name}.</p></div>
          <button class="btn small" data-weapon="${id}" ${owned || this.save.bits < cost ? 'disabled' : ''}>
            ${owned ? 'OWNED' : `${cost} ⌬`}
          </button>
        </div>`;
    }).join('');

    const s = this.screen(`
      <div class="screen-heading">npm install --save permanent-upgrades</div>
      <div class="bits-display">⌬ ${this.save.bits} bits</div>
      <div class="shop-list">
        <div class="shop-section"># Stat upgrades</div>
        ${metaRows}
        <div class="shop-section"># Weapon licenses (adds to in-run card pool)</div>
        ${weaponRows}
      </div>
      <button class="btn" data-act="back">BACK</button>
    `, () => this.showMainMenu());
    s.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn) return;
      if (btn.dataset.act === 'back') { this.showMainMenu(); return; }
      if (btn.dataset.meta) {
        const m = META_UPGRADES.find((x) => x.id === btn.dataset.meta)!;
        const lvl = this.save.metaLevels[m.id] ?? 0;
        const cost = metaCost(m, lvl);
        if (lvl < m.maxLevel && this.save.bits >= cost) {
          this.save.bits -= cost;
          this.save.metaLevels[m.id] = lvl + 1;
          this.persist();
          sound.play('buy');
          this.showShop(fresh);
        }
      }
      if (btn.dataset.weapon) {
        const entry = SHOP_WEAPONS.find((x) => x.id === btn.dataset.weapon)!;
        if (!this.save.unlockedWeapons.includes(entry.id) && this.save.bits >= entry.cost) {
          this.save.bits -= entry.cost;
          this.save.unlockedWeapons.push(entry.id);
          this.persist();
          sound.play('buy');
          this.showShop(fresh);
        }
      }
    });
  }

  // ---------- codex ----------

  /** Entity sprite → data-URL thumbnail. The sprite canvases are baked once
   *  (render/sprites.ts cache); this adds a one-time toDataURL on top. */
  private static thumbCache = new Map<string, string>();
  private static entityThumb(def: EnemyDef | BossDef, isBoss: boolean): string {
    const key = `${isBoss ? 'boss' : 'bug'}:${def.id}`;
    let url = UI.thumbCache.get(key);
    if (!url) {
      const sprite = isBoss
        ? bossSprite(def.id, def.radius, (def as BossDef).color)
        : bugSprite((def as EnemyDef).shape, def.radius, (def as EnemyDef).color, false);
      url = sprite.toDataURL();
      UI.thumbCache.set(key, url);
    }
    return url;
  }

  showCodex(): void {
    const fresh = this.takeUnseen(this.codexIds());
    const lt = this.save.lifetime;
    const fav = Object.entries(lt.weaponDamage).sort((a, b) => b[1] - a[1])[0];
    const favWeapon = fav && WEAPONS[fav[0]] ? `${WEAPONS[fav[0]].icon} ${WEAPONS[fav[0]].name}` : '—';
    const stats = `
      <div class="codex-entry"><b>Runs compiled <span>${lt.runs}</span></b></div>
      <div class="codex-entry"><b>Bugs squashed <span>${lt.kills}</span></b></div>
      <div class="codex-entry"><b>Bosses resolved <span>${lt.bossKills}</span></b></div>
      <div class="codex-entry"><b>Stable releases <span>${lt.victories}</span></b></div>
      <div class="codex-entry"><b>Accumulated uptime <span>${formatDuration(lt.uptimeSec)}</span></b></div>
      <div class="codex-entry"><b>Best uptime <span>${formatTime(lt.bestTimeSec)}</span></b></div>
      <div class="codex-entry"><b>Highest level <span>${lt.bestLevel}</span></b></div>
      <div class="codex-entry"><b>Total bits earned <span>${lt.bitsEarned}</span></b></div>
      <div class="codex-entry"><b>Favorite weapon <span>${favWeapon}</span></b></div>`;

    const enc = new Set(this.save.encountered);
    const bugs = Object.values(ENEMIES).map((e) => {
      if (!enc.has(`bug:${e.id}`)) {
        // The Precipitate is a secret: not even a locked row until collected
        if (e.notABug && e.id === 'mushi') return '';
        return UI.lockedCodexRow(`bug:${e.id}`, e.name, e.codexDesc, false);
      }
      return `
      <div class="codex-entry with-thumb">
        <img class="codex-thumb" src="${UI.entityThumb(e, false)}" alt="">
        <div class="codex-body">
          <b>${e.name}${e.notABug ? ' <span class="codex-tag">NOT A BUG</span>' : ''}${UI.newBadge(fresh, `bug:${e.id}`)}</b>
          <span>${e.codexDesc}</span>
        </div>
      </div>`;
    }).join('');

    const bosses = Object.values(BOSSES).map((b) => {
      if (!enc.has(`boss:${b.id}`)) {
        return UI.lockedCodexRow(`boss:${b.id}`, b.name, `${b.codexDesc} ${b.mechanicDesc}`, true);
      }
      return `
      <div class="codex-entry with-thumb">
        <img class="codex-thumb boss" src="${UI.entityThumb(b, true)}" alt="">
        <div class="codex-body">
          <b>${b.name}${UI.newBadge(fresh, `boss:${b.id}`)}</b>
          <span>${b.codexDesc}<br>⚠ ${b.mechanicDesc}</span>
        </div>
      </div>`;
    }).join('');

    const s = this.screen(`
      <div class="screen-heading">SELECT * FROM bug_database</div>
      <div class="codex-cols">
        <div class="codex-panel"><h3>~/stats</h3>${stats}</div>
        <div class="codex-panel"><h3>~/known_bugs</h3>${bugs}</div>
        <div class="codex-panel"><h3>~/incidents</h3>${bosses}</div>
      </div>
      <button class="btn" data-act="back">BACK</button>
    `, () => this.showMainMenu());
    s.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')?.dataset.act === 'back') this.showMainMenu();
    });
  }

  /** Objectives moved out of the codex into their own menu (draft 2026-06-12). */
  showObjectives(): void {
    const fresh = this.takeUnseen(this.objectiveIds());
    const doneCount = this.save.completedObjectives.length;
    const rows = OBJECTIVES.map((o) => {
      const done = this.save.completedObjectives.includes(o.id);
      return `
        <div class="codex-entry">
          <b class="${done ? 'done' : 'undone'}">${done ? '☑' : '☐'} ${o.name} <span>+100 ⌬${UI.newBadge(fresh, `obj:${o.id}${done ? ':done' : ''}`)}</span></b>
          <span>${o.desc}</span>
        </div>`;
    }).join('');
    const s = this.screen(`
      <div class="screen-heading">cat TODO.md</div>
      <div class="codex-cols">
        <div class="codex-panel objectives-panel">
          <h3>~/objectives <span class="obj-count">${doneCount}/${OBJECTIVES.length}</span></h3>
          ${rows}
        </div>
      </div>
      <button class="btn" data-act="back">BACK</button>
    `, () => this.showMainMenu());
    s.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')?.dataset.act === 'back') this.showMainMenu();
    });
  }

  // ---------- settings ----------

  /** `onBack` set = opened from the pause screen: BACK returns there, Esc is
   *  handled by the main loop (kbnav stays out of it — same rule as the pause
   *  screen itself), and the save-wipe row is hidden (undefined mid-run). */
  showSettings(onBack?: () => void): void {
    const st = this.save.settings;
    const back = onBack ?? (() => this.showMainMenu());
    const s = this.screen(`
      <div class="screen-heading">~/.debuggerrc</div>
      <div class="settings-box">
        <div class="setting-row">
          <label>Master volume</label>
          <input type="range" id="master" min="0" max="100" value="${Math.round(st.master * 100)}">
        </div>
        <div class="setting-row">
          <label>SFX volume</label>
          <input type="range" id="sfx" min="0" max="100" value="${Math.round(st.sfx * 100)}">
        </div>
        <div class="setting-row">
          <label>Music volume</label>
          <input type="range" id="music" min="0" max="100" value="${Math.round(st.music * 100)}">
        </div>
        <div class="setting-row">
          <label>Screen shake</label>
          <button class="toggle ${st.shake ? '' : 'off'}" id="shake">${st.shake ? 'ON' : 'OFF'}</button>
        </div>
        <div class="setting-row">
          <label>Reduce flashing</label>
          <button class="toggle ${st.reduceFlash ? '' : 'off'}" id="reduceflash">${st.reduceFlash ? 'ON' : 'OFF'}</button>
        </div>
        <div class="setting-row">
          <label>Player health bar</label>
          <button class="toggle ${st.playerHpBar ? '' : 'off'}" id="hpbar">${st.playerHpBar ? 'ON' : 'OFF'}</button>
        </div>
        <div class="setting-row">
          <label>FPS counter</label>
          <button class="toggle ${st.fpsCounter ? '' : 'off'}" id="fps">${st.fpsCounter ? 'ON' : 'OFF'}</button>
        </div>
        ${BIND_ACTIONS.map(({ action, label }) => `
        <div class="setting-row">
          <label>${label}</label>
          <button class="toggle bindbtn" data-bind="${action}">${keyLabel(st.keys[action] ?? DEFAULT_BINDINGS[action])}</button>
        </div>`).join('')}
        <div class="setting-row keybind-hint">
          <label class="dimlabel">arrow keys & ESC are fixed fallbacks</label>
          ${Object.keys(st.keys).length > 0 ? '<button class="btn small" id="resetkeys">reset binds</button>' : ''}
        </div>
        ${onBack ? '' : `
        <div class="setting-row">
          <label>Save data</label>
          <button class="btn small danger" id="wipe">rm -rf save</button>
        </div>`}
      </div>
      <button class="btn" data-act="back">BACK</button>
    `, onBack ? null : back);
    this.screenKind = 'settings';
    const sync = () => {
      st.master = Number((s.querySelector('#master') as HTMLInputElement).value) / 100;
      st.sfx = Number((s.querySelector('#sfx') as HTMLInputElement).value) / 100;
      st.music = Number((s.querySelector('#music') as HTMLInputElement).value) / 100;
      this.persist();
      this.onSettingsChanged();
    };
    s.querySelector('#master')!.addEventListener('input', sync);
    s.querySelector('#sfx')!.addEventListener('input', sync);
    s.querySelector('#music')!.addEventListener('input', sync);
    s.querySelector('#shake')!.addEventListener('click', () => {
      st.shake = !st.shake;
      this.persist();
      this.onSettingsChanged();
      this.showSettings(onBack);
    });
    s.querySelector('#reduceflash')!.addEventListener('click', () => {
      st.reduceFlash = !st.reduceFlash;
      this.persist();
      this.onSettingsChanged();
      this.showSettings(onBack);
    });
    s.querySelector('#hpbar')!.addEventListener('click', () => {
      st.playerHpBar = !st.playerHpBar;
      this.persist();
      this.onSettingsChanged();
      this.showSettings(onBack);
    });
    s.querySelector('#fps')!.addEventListener('click', () => {
      st.fpsCounter = !st.fpsCounter;
      this.persist();
      this.onSettingsChanged();
      this.showSettings(onBack);
    });
    // Key rebinding: click arms a one-shot capture; the next keydown is taken
    // before kbnav/input see it. Esc cancels. A code bound elsewhere moves.
    for (const btn of Array.from(s.querySelectorAll<HTMLButtonElement>('.bindbtn'))) {
      btn.addEventListener('click', () => {
        btn.textContent = 'PRESS A KEY…';
        const action = btn.dataset.bind!;
        const capture = (e: KeyboardEvent): void => {
          e.preventDefault();
          e.stopImmediatePropagation();
          window.removeEventListener('keydown', capture, true);
          if (e.code !== 'Escape') {
            for (const a of Object.keys(st.keys)) if (st.keys[a] === e.code) delete st.keys[a];
            if (e.code === DEFAULT_BINDINGS[action as BindAction]) delete st.keys[action];
            else st.keys[action] = e.code;
            this.persist();
            this.onSettingsChanged();
          }
          this.showSettings(onBack);
        };
        window.addEventListener('keydown', capture, true);
      });
    }
    s.querySelector('#resetkeys')?.addEventListener('click', () => {
      st.keys = {};
      this.persist();
      this.onSettingsChanged();
      this.showSettings(onBack);
    });
    s.querySelector('#wipe')?.addEventListener('click', () => {
      if (confirm('Delete all progress? This cannot be undone.')) {
        const fresh = wipeSave();
        Object.assign(this.save, fresh);
        this.showMainMenu();
      }
    });
    s.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')?.dataset.act === 'back') back();
    });
  }

  // ---------- level-up modal ----------

  showLevelUp(run: Run, onDone: () => void): void {
    let banishMode = false;
    let offer = makeOffer(run);
    if (offer.length === 0) { onDone(); return; }

    // progressive meta unlocks: cards whose stat still hides a "???" shop row
    // get a small hint — the pick is also a discovery. Stats already picked
    // THIS run count as pending unlocks (they reveal at run end), so the hint
    // only ever shows on the first opportunity — repeating it was wrong
    // (sole inaccuracy left: a manually terminated run records nothing, by
    // design — no rewards, no unlocks on termination).
    const unlockHint = (item: OfferItem): string => {
      if (item.kind !== 'card') return '';
      const mods = CARD_BY_ID[item.id]?.mods ?? {};
      const pending = new Set<string>();
      for (const [cardId] of run.takenCards) {
        for (const k of Object.keys(CARD_BY_ID[cardId]?.mods ?? {})) pending.add(k);
      }
      const reveals = META_UPGRADES.some((m) => {
        if (this.metaUnlocked(m)) return false;
        const keys = Object.keys(m.modsPerLevel ?? {});
        return keys.some((k) => k in mods) && !keys.some((k) => pending.has(k));
      });
      return reveals ? '<div class="unlock-hint">🔓 unlocks a meta upgrade</div>' : '';
    };

    const render = () => {
      const cards = offer.map((item, i) => {
        const preview = item.kind === 'card'
          ? cardStatPreview(run, item.id)
          : { html: weaponStatPreview(run, item), fullyCapped: false };
        return `
        <div class="upgrade-card ${banishMode && item.banishable ? 'banish-mode' : ''} ${preview.fullyCapped ? 'capped-card' : ''}"
             data-i="${i}" style="--rarity:${item.color}">
          <div class="rarity">${item.rarityLabel}</div>
          <div class="icon">${item.icon}</div>
          <h3>${item.name}</h3>
          <div class="tagline">${item.tagline}</div>
          <div class="desc">${item.desc}</div>
          ${preview.fullyCapped ? '<div class="cap-warning">⚠ ALREADY AT CAP — NO EFFECT</div>' : ''}
          ${preview.html}
          ${unlockHint(item)}
          <div class="flavor">${item.flavor}</div>
        </div>`;
      }).join('');

      this.root.innerHTML = `
        <div class="levelup-wrap">
          <div class="levelup-title">⬆ LEVEL UP → ${run.level}</div>
          ${banishMode ? '<div class="banish-hint">SELECT A CARD TO BANISH FROM THIS RUN</div>' : ''}
          <div class="card-row">${cards}</div>
          <div class="levelup-actions">
            <button class="btn small" data-act="reroll" ${run.rerollsLeft <= 0 ? 'disabled' : ''}>REROLL ×${run.rerollsLeft}</button>
            <button class="btn small ${banishMode ? 'danger' : ''}" data-act="banish" ${run.banishesLeft <= 0 ? 'disabled' : ''}>BANISH ×${run.banishesLeft}</button>
            <button class="btn small" data-act="skip" title="Take no card; bank 20% of the next level's XP"
              ${run.skipsLeft <= 0 ? 'disabled' : ''}>DEFER +20% XP ×${run.skipsLeft}</button>
          </div>
        </div>`;

      const wrap = this.root.firstElementChild as HTMLElement;
      // Esc only cancels banish mode — there is no backing out of a level-up.
      this.nav.attach(wrap, () => {
        if (banishMode) {
          banishMode = false;
          render();
        }
      });
      wrap.addEventListener('click', (e) => {
        const t = e.target as HTMLElement;
        const act = t.closest('button')?.dataset.act;
        if (act === 'reroll' && run.rerollsLeft > 0) {
          run.rerollsLeft--;
          offer = makeOffer(run);
          sound.play('click');
          render();
          return;
        }
        if (act === 'banish' && run.banishesLeft > 0) {
          banishMode = !banishMode;
          sound.play('click');
          render();
          return;
        }
        if (act === 'skip' && run.deferLevel()) {
          sound.play('click');
          this.hide();
          onDone();
          return;
        }
        const card = t.closest<HTMLElement>('.upgrade-card');
        if (!card) return;
        const item: OfferItem = offer[Number(card.dataset.i)];
        if (banishMode) {
          if (!item.banishable) return;
          run.banished.add(item.id);
          run.banishesLeft--;
          banishMode = false;
          sound.play('kill');
          offer = makeOffer(run);
          render();
          return;
        }
        applyOffer(run, item);
        sound.play('levelup');
        this.hide();
        onDone();
      });
    };
    render();
  }

  // ---------- pause (current-run overview) ----------

  showPause(run: Run, onResume: () => void, onAbandon: () => void, onSuspend: () => void, onSettings: () => void): void {
    const st = run.stats;
    const row = (label: string, value: string) =>
      `<div class="prow"><span>${label}</span><span class="v">${value}</span></div>`;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const fmtDmg = (v: number) => v >= 10000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;

    // player stat sheet — resolved values, same source the sim uses
    const statRows = [
      row('HP', `${Math.ceil(run.hp)} / ${st.maxHp}`),
      row('Regen', `${st.regen.toFixed(1)} HP/s`),
      row('Armor', `${st.armor}`),
      row('Move speed', `${Math.round(st.moveSpeed)}`),
      row('Damage', `×${st.damageMult.toFixed(2)}`),
      row('Cooldown', `−${pct(1 - st.cooldownFactor)}`),
      row('Area', `×${st.areaMult.toFixed(2)}`),
      row('Projectiles', `+${st.projectiles}`),
      row('Crit', `${pct(st.critChance)} / ×${st.critMult.toFixed(2)}`),
      row('Pickup radius', `${Math.round(st.pickupRadius)}`),
      row('XP gain', `×${st.xpMult.toFixed(2)}`),
      row('Luck', `${st.luck}`),
    ].join('');

    // weapons inventory: desc + the resolved live stat sheet per weapon (the
    // same effective() values combat fires with — global mults applied, unlike
    // the raw-table weapon-card previews), plus total damage / DPS tallies
    const weaponRows = run.weapons.map((w) => {
      const dps = w.totalDamage / Math.max(1, run.time - w.acquiredAt);
      const lvl = w.def.isEvolution ? 'EVO' : `Lv ${w.level}`;
      const eff = effective(run, w);
      const stats = WEAPON_FIELD_VIEW
        .filter(([key]) => eff[key] !== 0)
        .map(([key, label, fmt]) =>
          `<span class="wstat"><span class="wl">${label}</span> ${fmt(eff[key])}</span>`)
        .join('');
      return `<div class="wpn">
        <div class="wpn-head">
          <span style="color:${w.def.color}">${w.def.icon} ${w.def.name}</span>
          <span class="dim">${lvl}</span>
          <span class="v">${fmtDmg(w.totalDamage)} <span class="dim">(${fmtDmg(dps)}/s)</span></span>
        </div>
        <div class="wpn-desc">${w.def.desc}</div>
        <div class="wpn-stats">${stats}</div>
      </div>`;
    }).join('') + (run.allyDamage > 0
      ? row(`<span class="dim">⚙ Allies</span>`, `${fmtDmg(run.allyDamage)}`)
      : '');

    // taken cards, highest rarity first, with stack counts
    const taken = [...run.takenCards.entries()]
      .map(([id, count]) => ({ card: CARD_BY_ID[id], count }))
      .filter((x) => x.card)
      .sort((a, b) =>
        RARITY_ORDER.indexOf(b.card.rarity) - RARITY_ORDER.indexOf(a.card.rarity) || b.count - a.count);
    const cardRows = taken.length > 0
      ? taken.map(({ card, count }) => row(
          `<span style="color:${RARITY_COLOR[card.rarity]}">${card.icon} ${card.name}</span>`,
          count > 1 ? `×${count}` : '',
        )).join('')
      : '<div class="prow"><span class="dim">no patches applied yet</span></div>';

    // live offer odds (per card slot, includes luck and banishes)
    const odds = offerOdds(run);
    const oddsRows = [
      row('Weapon card', pct(odds.weapon)),
      ...RARITY_ORDER.map((r) => row(
        `<span style="color:${RARITY_COLOR[r]}">${r.charAt(0).toUpperCase() + r.slice(1)}</span>`,
        odds.tiers[r] >= 0.005 ? pct(odds.tiers[r]) : `${(odds.tiers[r] * 100).toFixed(1)}%`,
      )),
      row('Rerolls / Banishes / Defers', `${run.rerollsLeft} / ${run.banishesLeft} / ${run.skipsLeft}`),
    ].join('');

    const s = this.screen(`
      <div class="screen-heading">execution paused</div>
      <div class="hint">breakpoint hit at ${formatTime(run.time)} — level ${run.level}, ${run.kills} bugs squashed</div>
      <div class="pause-actions">
        <button class="btn primary" data-act="resume">CONTINUE (ESC)</button>
        <button class="btn" data-act="settings">SETTINGS</button>
        <button class="btn" data-act="suspend" title="save the run and exit — resume from the main menu">SUSPEND PROCESS</button>
        <button class="btn danger" data-act="abandon">KILL PROCESS</button>
      </div>
      <div class="pause-cols">
        <div class="pause-panel"><h3>~/player</h3>${statRows}</div>
        <div class="pause-panel"><h3>~/weapons</h3>${weaponRows}</div>
        <div class="pause-panel"><h3>~/cards</h3>${cardRows}</div>
        <div class="pause-panel"><h3>~/card_odds</h3>${oddsRows}
          <div class="hint" style="margin-top:8px">chance per offered slot</div>
        </div>
      </div>
    `); // no kbnav onBack: the main loop owns Esc/P while paused (would double-toggle)
    this.screenKind = 'pause';

    // KILL PROCESS is two-step: first activate arms, second confirms. Mouse,
    // keyboard and gamepad all funnel through the button's click event (kbnav
    // activate() dispatches a real click), so one armed flag covers them all.
    const abandonBtn = s.querySelector<HTMLButtonElement>('[data-act="abandon"]')!;
    let armed = false;
    let disarmTimer = 0;
    const disarm = () => {
      if (!armed) return;
      armed = false;
      clearTimeout(disarmTimer);
      abandonBtn.textContent = 'KILL PROCESS';
      abandonBtn.classList.remove('armed');
    };
    // Focus moving away (kb/pad nav or mouse hover — all set .kb-focus) disarms.
    new MutationObserver(() => {
      if (!abandonBtn.classList.contains('kb-focus')) disarm();
    }).observe(abandonBtn, { attributes: true, attributeFilter: ['class'] });

    s.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      if (act === 'resume') onResume();
      else if (act === 'settings') onSettings();
      else if (act === 'suspend') onSuspend();
      else if (act === 'abandon') {
        if (!armed) {
          armed = true;
          abandonBtn.textContent = 'SIGKILL — ARE YOU SURE?';
          abandonBtn.classList.add('armed');
          disarmTimer = window.setTimeout(disarm, 2000);
        } else {
          onAbandon();
        }
      }
    });
  }

  // ---------- run summary ----------

  showSummary(results: RunResults, onContinue: () => void): void {
    const objs = results.newObjectives.length > 0
      ? `<div class="objective-done">☑ ${results.newObjectives
          .map((id) => OBJECTIVES.find((o) => o.id === id)?.name ?? id).join(' &nbsp;☑ ')}</div>`
      : '';
    const breakdown = results.bitsBreakdown
      .filter((b) => b.value > 0)
      .map((b) => `<div class="row"><span>${b.label}</span><span class="v">+${b.value}</span></div>`)
      .join('');

    // per-weapon damage, biggest contributor first (same tracking the pause overview uses)
    const fmtDmg = (v: number) => v >= 10000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;
    const dmgRows = [...results.weaponDamage]
      .sort((a, b) => b.damage - a.damage)
      .map((w) => `<div class="row wpn">
          <span style="color:${w.color}">${w.icon} ${w.name} <span class="dim">${w.isEvolution ? 'EVO' : `Lv ${w.level}`}</span></span>
          <span class="v">${fmtDmg(w.damage)} <span class="dim">(${fmtDmg(w.dps)}/s)</span></span>
        </div>`)
      .join('') + (results.allyDamage > 0
        ? `<div class="row wpn"><span class="dim">⚙ Allies</span><span class="v">${fmtDmg(results.allyDamage)}</span></div>`
        : '');
    const dmgBlock = dmgRows
      ? `<div class="summary-divider"><span>DAMAGE BY WEAPON</span></div>${dmgRows}`
      : '';

    const s = this.screen(`
      <div class="result-heading ${results.victory ? 'win' : 'lose'}">
        ${results.victory ? 'SYSTEM STABILIZED' : results.releaseFailed ? 'RELEASE SLIPPED' : 'SEGMENTATION FAULT'}
      </div>
      <div class="hint">${results.victory
        ? 'all critical bugs resolved — shipping to production'
        : results.releaseFailed
          ? 'a release blocker outlived crunch time — the deadline shipped without you'
          : `process terminated after ${formatTime(results.timeSec)} (core dumped)`}</div>
      <div class="summary-box">
        <div class="row"><span>Uptime</span><span class="v">${formatTime(results.timeSec)}</span></div>
        <div class="row"><span>Bugs squashed</span><span class="v">${results.kills}</span></div>
        <div class="row"><span>Bosses resolved</span><span class="v">${results.bossKills}</span></div>
        <div class="row"><span>Level reached</span><span class="v">${results.level}</span></div>
        ${objs}
        ${dmgBlock}
        <div class="summary-divider"><span>BITS BREAKDOWN</span></div>
        ${breakdown}
        <div class="row total"><span>BITS EARNED</span><span class="v">⌬ ${results.bits}</span></div>
      </div>
      <button class="btn primary" data-act="continue">CONTINUE</button>
    `, onContinue);
    s.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')?.dataset.act === 'continue') onContinue();
    });
  }
}
