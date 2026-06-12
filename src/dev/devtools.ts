// Browser dev console: window.dbg — manipulate the live run for testing.
// Loaded via dynamic import behind `if (__DEV_TOOLS__)` in main.ts, so the
// default prod build never emits this chunk (CI greps dist/ for the banner
// string below to prove it). This module may touch the DOM/console freely;
// it talks to the simulation only through Run's public methods.

import { WEAPONS, MAX_WEAPON_LEVEL } from '../data/weapons';
import { CARD_BY_ID } from '../data/upgrades';
import { ENEMIES } from '../data/enemies';
import { BOSSES } from '../data/bosses';
import { CHARACTERS } from '../data/characters';
import { MAPS } from '../data/maps';
import { persistSave, type SaveData } from '../save/save';
import type { Run } from '../game/run';
import type { ComputedStats } from '../game/stats';

const BANNER = 'Debugger dev console';

export interface DevContext {
  getRun(): Run | null;
  save: SaveData;
  /** main-loop sim-speed multiplier (tick rate) */
  getSpeed(): number;
  setSpeed(mult: number): void;
}

const CATALOGS: Record<string, Record<string, { name: string }>> = {
  weapons: WEAPONS,
  cards: CARD_BY_ID,
  enemies: ENEMIES,
  bosses: BOSSES,
  characters: CHARACTERS,
  maps: MAPS,
};

const HELP: [call: string, what: string][] = [
  ['dbg.list(kind?)', `ids by kind: ${Object.keys(CATALOGS).join(', ')}`],
  ['dbg.bits(n=1000)', 'add n Bits to the save (meta currency, persisted)'],
  ['dbg.xp(n=50)', 'grant n XP to the current run (xpMult applies)'],
  ['dbg.offer(...ids)', 'force the next level-up offer to these weapon/card ids (triggers a level-up; reroll falls back to a normal draw)'],
  ['dbg.give(id, n=1)', 'grant a weapon at level n (or apply a card n times) immediately'],
  ['dbg.level(id, n)', `set an owned weapon's level (1–${MAX_WEAPON_LEVEL}; grants it if missing)`],
  ['dbg.god(on?)', 'toggle invincibility'],
  ['dbg.stat(id?, value?)', 'no args: table of current stats · (id): read one · (id, n): override it (survives card pickups) · (id, null): clear the override'],
  ['dbg.time(min)', 'jump the run clock to minute min (bosses/spawn phases follow)'],
  ['dbg.speed(mult?)', 'sim speed / tick rate: 6 = turbo, 0.5 = slow-mo, 1 = normal; no args reads it'],
  ['dbg.mushi()', 'precipitate the very rare visitor now (spawns on the next sim frame)'],
  ['dbg.help()', 'this text'],
];

function buildApi(ctx: DevContext) {
  const needRun = (): Run | null => {
    const run = ctx.getRun();
    if (!run) console.warn('[dbg] no active run — start one first');
    return run;
  };
  const known = (id: string): boolean => {
    if (WEAPONS[id] || CARD_BY_ID[id]) return true;
    console.warn(`[dbg] unknown id "${id}" — see dbg.list('weapons') / dbg.list('cards')`);
    return false;
  };
  // Console callers aren't type-checked: dbg.time('6:00') would put NaN into
  // the run clock and silently break time and audio. Coerce ('6' is fine) and
  // reject anything non-finite before it touches the run.
  const num = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const dbg = {
    // Prints (instead of returning) so the console renders real line breaks,
    // styled call names and aligned columns rather than one quoted "\n" string.
    help(): void {
      const pad = Math.max(...HELP.map(([call]) => call.length)) + 2;
      console.log(
        `%c${BANNER} — window.dbg\n\n` +
        HELP.map(([call, what]) => `%c${call.padEnd(pad)}%c${what}`).join('\n'),
        'color:#7fff7f;font-weight:bold',
        ...HELP.flatMap(() => ['color:#7fd4ff', 'color:inherit']),
      );
    },

    list(kind?: string): string {
      const kinds = kind ? [kind] : Object.keys(CATALOGS);
      for (const k of kinds) {
        const cat = CATALOGS[k];
        if (!cat) return `[dbg] unknown kind "${k}" — one of: ${Object.keys(CATALOGS).join(', ')}`;
        console.log(`%c${k}`, 'font-weight:bold');
        console.table(Object.entries(cat).map(([id, d]) => ({ id, name: d.name })));
      }
      return `${kinds.length} table(s) above`;
    },

    bits(n = 1000): string {
      const v = num(n);
      if (v === null) return '[dbg] usage: dbg.bits(n) — n must be a number';
      ctx.save.bits += v;
      persistSave(ctx.save);
      return `[dbg] +${v} ⌬ → ${ctx.save.bits} (persisted)`;
    },

    xp(n = 50): string {
      const run = needRun();
      if (!run) return '';
      const v = num(n);
      if (v === null) return '[dbg] usage: dbg.xp(n) — n must be a number';
      run.gainXp(v);
      return `[dbg] +${v} XP (×${run.stats.xpMult.toFixed(2)}) → level ${run.level}, ${run.pendingLevelUps} pending level-up(s)`;
    },

    offer(...ids: string[]): string {
      const run = needRun();
      if (!run) return '';
      if (ids.length === 0 || !ids.every(known)) return '[dbg] usage: dbg.offer("cardOrWeaponId", ...)';
      run.forcedOffer = ids;
      run.pendingLevelUps++;
      return `[dbg] next offer forced: ${ids.join(', ')} (opens on the next sim frame; resume if paused)`;
    },

    give(id: string, n = 1): string {
      const run = needRun();
      if (!run) return '';
      if (!known(id)) return '';
      const v = num(n);
      if (v === null) return '[dbg] usage: dbg.give(id, n) — n must be a number';
      n = Math.max(1, Math.round(v));
      if (WEAPONS[id]) {
        if (run.weapons.some((w) => w.def.id === id)) return `[dbg] ${id} already owned — dbg.level("${id}", n) to level it`;
        if (n > 1) return dbg.level(id, n); // grant at level n in one call
        run.addWeapon(id);
        return `[dbg] weapon granted: ${WEAPONS[id].name}`;
      }
      for (let i = 0; i < n; i++) run.applyCard(CARD_BY_ID[id]);
      return `[dbg] card applied: ${CARD_BY_ID[id].name} (×${run.takenCards.get(id)})`;
    },

    level(id: string, n: number): string {
      const run = needRun();
      if (!run) return '';
      if (!WEAPONS[id]) return `[dbg] unknown weapon "${id}" — see dbg.list('weapons')`;
      const v = num(n);
      if (v === null) return '[dbg] usage: dbg.level(id, n) — n must be a number';
      let w = run.weapons.find((x) => x.def.id === id);
      if (!w) { run.addWeapon(id); w = run.weapons[run.weapons.length - 1]; }
      w.level = Math.max(1, Math.min(MAX_WEAPON_LEVEL, Math.round(v)));
      return `[dbg] ${w.def.name} → level ${w.level}`;
    },

    mushi(): string {
      const run = needRun();
      if (!run) return '';
      if (run.mushi) return '[dbg] it is already here — look for the gold ? marker';
      run.mushiAt = run.time;
      return '[dbg] precipitating… (23s window; walk into it — weapons pass through)';
    },

    god(on?: boolean): string {
      const run = needRun();
      if (!run) return '';
      run.invincible = on ?? !run.invincible;
      return `[dbg] invincible: ${run.invincible}`;
    },

    stat(id?: string, value?: number | null): string {
      const run = needRun();
      if (!run) return '';
      if (id === undefined) {
        console.table(Object.fromEntries(
          (Object.keys(run.stats) as (keyof ComputedStats)[]).map((k) => [
            k, { value: run.stats[k], overridden: run.statOverrides?.[k] !== undefined ? '←' : '' },
          ]),
        ));
        return '[dbg] current stats above — dbg.stat(id, n) to override';
      }
      if (!(id in run.stats)) {
        return `[dbg] unknown stat "${id}" — one of: ${Object.keys(run.stats).join(', ')}`;
      }
      const key = id as keyof ComputedStats;
      if (value === undefined) return `[dbg] ${key} = ${run.stats[key]}`;
      if (value === null) {
        if (run.statOverrides) delete run.statOverrides[key];
        run.recompute();
        return `[dbg] ${key} override cleared → ${run.stats[key]}`;
      }
      const v = num(value);
      if (v === null) return '[dbg] usage: dbg.stat(id, n) — n must be a number (null clears)';
      (run.statOverrides ??= {})[key] = v;
      run.recompute();
      return `[dbg] ${key} → ${run.stats[key]} (override; dbg.stat("${key}", null) to clear)`;
    },

    time(min: number): string {
      const run = needRun();
      if (!run) return '';
      const m = num(min);
      if (m === null) return `[dbg] usage: dbg.time(minutes) — a number, e.g. dbg.time(6) (got ${JSON.stringify(min)})`;
      run.time = Math.max(0, m * 60);
      return `[dbg] run clock → ${m}:00 (boss timer + spawn phases follow on the next frame)`;
    },

    speed(mult?: number): string {
      if (mult === undefined) return `[dbg] sim speed: ${ctx.getSpeed()}×`;
      const v = num(mult);
      if (v === null || v <= 0) return '[dbg] usage: dbg.speed(mult) — a positive number, e.g. 0.5 / 1 / 6';
      const clamped = Math.min(20, Math.max(0.1, v));
      ctx.setSpeed(clamped);
      return `[dbg] sim speed → ${clamped}×${clamped !== v ? ' (clamped to 0.1–20)' : ''}${clamped > 6 ? ' — heavy: many sim steps per frame' : ''}`;
    },
  };

  return dbg;
}

export type DevApi = ReturnType<typeof buildApi>;

declare global {
  interface Window { dbg?: DevApi }
}

export function installDevTools(ctx: DevContext): void {
  window.dbg = buildApi(ctx);
  console.log(`%c${BANNER} ready — try dbg.help()`, 'color:#7fff7f;font-weight:bold');
}
