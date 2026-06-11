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
import { RARITY_COLOR, RARITY_ORDER } from '../data/types';
import { formatTime } from '../core/util';
import { sound } from '../audio/sound';
import { makeOffer, applyOffer, offerOdds, type OfferItem } from '../game/levelup';
import type { Run, RunResults } from '../game/run';

// All DOM UI: menus, shop, codex, settings, level-up modal, pause, summary.
// Mutates the shared SaveData for purchases and persists immediately.

export class UI {
  private root: HTMLElement;
  save: SaveData;
  onStartRun: (charId: string, mapId: string) => void = () => {};
  onSettingsChanged: () => void = () => {};

  constructor(root: HTMLElement, save: SaveData) {
    this.root = root;
    this.save = save;
  }

  hide(): void {
    this.root.innerHTML = '';
  }

  private screen(html: string): HTMLElement {
    this.root.innerHTML = `<div class="screen">${html}</div>`;
    const el = this.root.firstElementChild as HTMLElement;
    el.querySelectorAll('button').forEach((b) =>
      b.addEventListener('mousedown', () => sound.play('click')));
    return el;
  }

  private persist(): void {
    persistSave(this.save);
  }

  // ---------- main menu ----------

  showMainMenu(): void {
    const s = this.screen(`
      <div class="title" data-text="DEBUGGER">DEBUGGER<span class="cursor">_</span></div>
      <div class="subtitle">// the bugs are real. squash them all.</div>
      <div class="bits-display">⌬ ${this.save.bits} bits</div>
      <div class="menu-col">
        <button class="btn primary" data-act="start">START RUN</button>
        <button class="btn" data-act="chars">CHARACTERS</button>
        <button class="btn" data-act="maps">MAPS</button>
        <button class="btn" data-act="shop">UPGRADES</button>
        <button class="btn" data-act="codex">BUG DATABASE</button>
        <button class="btn" data-act="settings">SETTINGS</button>
      </div>
      <div class="controls-hint"><kbd>WASD</kbd> move &nbsp; <kbd>ESC</kbd> pause &nbsp; auto-attack: just survive</div>
      <div class="version-tag">v${__APP_VERSION__}</div>
    `);
    s.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      if (!act) return;
      sound.unlock();
      if (act === 'start') this.onStartRun(this.save.lastCharacter, this.save.lastMap);
      else if (act === 'chars') this.showCharSelect();
      else if (act === 'maps') this.showMapSelect();
      else if (act === 'shop') this.showShop();
      else if (act === 'codex') this.showCodex();
      else if (act === 'settings') this.showSettings();
    });
  }

  // ---------- character select ----------

  showCharSelect(): void {
    const cards = CHARACTER_LIST.map((c) => {
      const unlocked = this.save.unlockedCharacters.includes(c.id);
      const selected = this.save.lastCharacter === c.id;
      const weapon = WEAPONS[c.weapon];
      return `
        <div class="select-card ${unlocked ? '' : 'locked'} ${selected ? 'selected' : ''}"
             data-id="${c.id}" style="--accent:${c.color}">
          ${selected ? '<span class="selected-tag">▶ SELECTED</span>' : ''}
          <div class="icon">${c.icon}</div>
          <h3>${c.name}</h3>
          <div class="arch">${c.archetype}</div>
          <p>${c.desc}</p>
          <div class="passive">⌁ ${weapon.name}<br>★ ${c.passiveDesc}</div>
          ${unlocked ? '' : `<div class="cost">🔒 ${c.cost} bits</div>`}
        </div>`;
    }).join('');
    const s = this.screen(`
      <div class="screen-heading">git checkout --character</div>
      <div class="bits-display">⌬ ${this.save.bits} bits</div>
      <div class="grid">${cards}</div>
      <button class="btn" data-act="back">BACK</button>
    `);
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
    const cards = MAP_LIST.map((m) => {
      const unlocked = this.save.unlockedMaps.includes(m.id);
      const selected = this.save.lastMap === m.id;
      return `
        <div class="select-card ${unlocked ? '' : 'locked'} ${selected ? 'selected' : ''}"
             data-id="${m.id}" style="--accent:${m.palette.accent}">
          ${selected ? '<span class="selected-tag">▶ SELECTED</span>' : ''}
          <div class="icon">${m.id === 'greenfield' ? '🌱' : '🪵'}</div>
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
    `);
    s.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('button')?.dataset.act === 'back') { this.showMainMenu(); return; }
      const card = t.closest<HTMLElement>('.select-card');
      if (!card) return;
      const id = card.dataset.id!;
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

  showShop(): void {
    const metaRows = META_UPGRADES.map((m) => {
      const lvl = this.save.metaLevels[m.id] ?? 0;
      const maxed = lvl >= m.maxLevel;
      const cost = metaCost(m, lvl);
      const pips = Array.from({ length: m.maxLevel }, (_, i) =>
        `<span class="pip ${i < lvl ? 'on' : ''}"></span>`).join('');
      return `
        <div class="shop-row">
          <div class="icon">${m.icon}</div>
          <div class="info"><h4>${m.name}</h4><p>${m.desc}</p></div>
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
          <div class="info"><h4>${w.name}</h4><p>${w.desc} Evolves into ${WEAPONS[w.evolveTo!].name}.</p></div>
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
    `);
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
          this.showShop();
        }
      }
      if (btn.dataset.weapon) {
        const entry = SHOP_WEAPONS.find((x) => x.id === btn.dataset.weapon)!;
        if (!this.save.unlockedWeapons.includes(entry.id) && this.save.bits >= entry.cost) {
          this.save.bits -= entry.cost;
          this.save.unlockedWeapons.push(entry.id);
          this.persist();
          sound.play('buy');
          this.showShop();
        }
      }
    });
  }

  // ---------- codex ----------

  showCodex(): void {
    const lt = this.save.lifetime;
    const stats = `
      <div class="codex-entry"><b>Runs compiled <span>${lt.runs}</span></b></div>
      <div class="codex-entry"><b>Bugs squashed <span>${lt.kills}</span></b></div>
      <div class="codex-entry"><b>Bosses resolved <span>${lt.bossKills}</span></b></div>
      <div class="codex-entry"><b>Stable releases <span>${lt.victories}</span></b></div>
      <div class="codex-entry"><b>Best uptime <span>${formatTime(lt.bestTimeSec)}</span></b></div>
      <div class="codex-entry"><b>Highest level <span>${lt.bestLevel}</span></b></div>
      <div class="codex-entry"><b>Total bits earned <span>${lt.bitsEarned}</span></b></div>`;

    const bugs = Object.values(ENEMIES).map((e) => `
      <div class="codex-entry">
        <b>${e.name}</b>
        <span>${e.codexDesc}</span>
      </div>`).join('');

    const bosses = Object.values(BOSSES).map((b) => `
      <div class="codex-entry">
        <b>${b.name}</b>
        <span>${b.codexDesc}<br>⚠ ${b.mechanicDesc}</span>
      </div>`).join('');

    const objectives = OBJECTIVES.map((o) => {
      const done = this.save.completedObjectives.includes(o.id);
      return `
        <div class="codex-entry">
          <b class="${done ? 'done' : 'undone'}">${done ? '☑' : '☐'} ${o.name} <span>+100 ⌬</span></b>
          <span>${o.desc}</span>
        </div>`;
    }).join('');

    const s = this.screen(`
      <div class="screen-heading">SELECT * FROM bug_database</div>
      <div class="codex-cols">
        <div class="codex-panel"><h3>~/stats</h3>${stats}</div>
        <div class="codex-panel"><h3>~/known_bugs</h3>${bugs}</div>
        <div class="codex-panel"><h3>~/incidents</h3>${bosses}</div>
        <div class="codex-panel"><h3>~/objectives</h3>${objectives}</div>
      </div>
      <button class="btn" data-act="back">BACK</button>
    `);
    s.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')?.dataset.act === 'back') this.showMainMenu();
    });
  }

  // ---------- settings ----------

  showSettings(): void {
    const st = this.save.settings;
    const s = this.screen(`
      <div class="screen-heading">~/.debuggerrc</div>
      <div class="settings-box">
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
          <label>Save data</label>
          <button class="btn small danger" id="wipe">rm -rf save</button>
        </div>
      </div>
      <button class="btn" data-act="back">BACK</button>
    `);
    const sync = () => {
      st.sfx = Number((s.querySelector('#sfx') as HTMLInputElement).value) / 100;
      st.music = Number((s.querySelector('#music') as HTMLInputElement).value) / 100;
      this.persist();
      this.onSettingsChanged();
    };
    s.querySelector('#sfx')!.addEventListener('input', sync);
    s.querySelector('#music')!.addEventListener('input', sync);
    s.querySelector('#shake')!.addEventListener('click', () => {
      st.shake = !st.shake;
      this.persist();
      this.onSettingsChanged();
      this.showSettings();
    });
    s.querySelector('#wipe')!.addEventListener('click', () => {
      if (confirm('Delete all progress? This cannot be undone.')) {
        const fresh = wipeSave();
        Object.assign(this.save, fresh);
        this.showMainMenu();
      }
    });
    s.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')?.dataset.act === 'back') this.showMainMenu();
    });
  }

  // ---------- level-up modal ----------

  showLevelUp(run: Run, onDone: () => void): void {
    let banishMode = false;
    let offer = makeOffer(run);
    if (offer.length === 0) { onDone(); return; }

    const render = () => {
      const cards = offer.map((item, i) => `
        <div class="upgrade-card ${banishMode && item.banishable ? 'banish-mode' : ''}"
             data-i="${i}" style="--rarity:${item.color}">
          <div class="rarity">${item.rarityLabel}</div>
          <div class="icon">${item.icon}</div>
          <h3>${item.name}</h3>
          <div class="tagline">${item.tagline}</div>
          <div class="desc">${item.desc}</div>
          <div class="flavor">${item.flavor}</div>
        </div>`).join('');

      this.root.innerHTML = `
        <div class="levelup-wrap">
          <div class="levelup-title">⬆ LEVEL UP → ${run.level}</div>
          ${banishMode ? '<div class="banish-hint">SELECT A CARD TO BANISH FROM THIS RUN</div>' : ''}
          <div class="card-row">${cards}</div>
          <div class="levelup-actions">
            <button class="btn small" data-act="reroll" ${run.rerollsLeft <= 0 ? 'disabled' : ''}>REROLL ×${run.rerollsLeft}</button>
            <button class="btn small ${banishMode ? 'danger' : ''}" data-act="banish" ${run.banishesLeft <= 0 ? 'disabled' : ''}>BANISH ×${run.banishesLeft}</button>
            <button class="btn small" data-act="skip" ${run.skipsLeft <= 0 ? 'disabled' : ''}>SKIP ×${run.skipsLeft}</button>
          </div>
        </div>`;

      const wrap = this.root.firstElementChild as HTMLElement;
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
        if (act === 'skip' && run.skipsLeft > 0) {
          run.skipsLeft--;
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

  showPause(run: Run, onResume: () => void, onAbandon: () => void): void {
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

    // weapons: total damage + DPS since acquired
    const weaponRows = run.weapons.map((w) => {
      const dps = w.totalDamage / Math.max(1, run.time - w.acquiredAt);
      const lvl = w.def.isEvolution ? 'EVO' : `Lv ${w.level}`;
      return row(
        `<span style="color:${w.def.color}">${w.def.icon} ${w.def.name}</span> <span class="dim">${lvl}</span>`,
        `${fmtDmg(w.totalDamage)} <span class="dim">(${fmtDmg(dps)}/s)</span>`,
      );
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
      row('Rerolls / Banishes / Skips', `${run.rerollsLeft} / ${run.banishesLeft} / ${run.skipsLeft}`),
    ].join('');

    const s = this.screen(`
      <div class="screen-heading">execution paused</div>
      <div class="hint">breakpoint hit at ${formatTime(run.time)} — level ${run.level}, ${run.kills} bugs squashed</div>
      <div class="pause-actions">
        <button class="btn primary" data-act="resume">CONTINUE (ESC)</button>
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
    `);
    s.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      if (act === 'resume') onResume();
      else if (act === 'abandon') onAbandon();
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

    const s = this.screen(`
      <div class="result-heading ${results.victory ? 'win' : 'lose'}">
        ${results.victory ? 'SYSTEM STABILIZED' : 'SEGMENTATION FAULT'}
      </div>
      <div class="hint">${results.victory
        ? 'all critical bugs resolved — shipping to production'
        : `process terminated after ${formatTime(results.timeSec)} (core dumped)`}</div>
      <div class="summary-box">
        <div class="row"><span>Uptime</span><span class="v">${formatTime(results.timeSec)}</span></div>
        <div class="row"><span>Bugs squashed</span><span class="v">${results.kills}</span></div>
        <div class="row"><span>Bosses resolved</span><span class="v">${results.bossKills}</span></div>
        <div class="row"><span>Level reached</span><span class="v">${results.level}</span></div>
        ${objs}
        ${breakdown}
        <div class="row total"><span>BITS EARNED</span><span class="v">⌬ ${results.bits}</span></div>
      </div>
      <button class="btn primary" data-act="continue">CONTINUE</button>
    `);
    s.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')?.dataset.act === 'continue') onContinue();
    });
  }
}
