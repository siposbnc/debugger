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

const BANNER = 'Debugger dev console';

export interface DevContext {
  getRun(): Run | null;
  save: SaveData;
}

const CATALOGS: Record<string, Record<string, { name: string }>> = {
  weapons: WEAPONS,
  cards: CARD_BY_ID,
  enemies: ENEMIES,
  bosses: BOSSES,
  characters: CHARACTERS,
  maps: MAPS,
};

const HELP = `${BANNER} — window.dbg
  dbg.list(kind?)      ids by kind: ${Object.keys(CATALOGS).join(', ')}
  dbg.bits(n=1000)     add n Bits to the save (meta currency, persisted)
  dbg.xp(n=50)         grant n XP to the current run (xpMult applies)
  dbg.offer(...ids)    force the next level-up offer to these weapon/card ids
                       (triggers a level-up; reroll falls back to a normal draw)
  dbg.give(id)         grant a weapon (or apply a card) immediately
  dbg.level(id, n)     set an owned weapon's level (1–${MAX_WEAPON_LEVEL}; grants it if missing)
  dbg.god(on?)         toggle invincibility
  dbg.time(min)        jump the run clock to minute min (bosses/spawn phases follow)
  dbg.help()           this text`;

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

  const dbg = {
    help(): string { return HELP; },

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
      ctx.save.bits += n;
      persistSave(ctx.save);
      return `[dbg] +${n} ⌬ → ${ctx.save.bits} (persisted)`;
    },

    xp(n = 50): string {
      const run = needRun();
      if (!run) return '';
      run.gainXp(n);
      return `[dbg] +${n} XP (×${run.stats.xpMult.toFixed(2)}) → level ${run.level}, ${run.pendingLevelUps} pending level-up(s)`;
    },

    offer(...ids: string[]): string {
      const run = needRun();
      if (!run) return '';
      if (ids.length === 0 || !ids.every(known)) return '[dbg] usage: dbg.offer("cardOrWeaponId", ...)';
      run.forcedOffer = ids;
      run.pendingLevelUps++;
      return `[dbg] next offer forced: ${ids.join(', ')} (opens on the next sim frame; resume if paused)`;
    },

    give(id: string): string {
      const run = needRun();
      if (!run) return '';
      if (!known(id)) return '';
      if (WEAPONS[id]) {
        if (run.weapons.some((w) => w.def.id === id)) return `[dbg] ${id} already owned — dbg.level("${id}", n) to level it`;
        run.addWeapon(id);
        return `[dbg] weapon granted: ${WEAPONS[id].name}`;
      }
      run.applyCard(CARD_BY_ID[id]);
      return `[dbg] card applied: ${CARD_BY_ID[id].name} (×${run.takenCards.get(id)})`;
    },

    level(id: string, n: number): string {
      const run = needRun();
      if (!run) return '';
      if (!WEAPONS[id]) return `[dbg] unknown weapon "${id}" — see dbg.list('weapons')`;
      let w = run.weapons.find((x) => x.def.id === id);
      if (!w) { run.addWeapon(id); w = run.weapons[run.weapons.length - 1]; }
      w.level = Math.max(1, Math.min(MAX_WEAPON_LEVEL, Math.round(n)));
      return `[dbg] ${w.def.name} → level ${w.level}`;
    },

    god(on?: boolean): string {
      const run = needRun();
      if (!run) return '';
      run.invincible = on ?? !run.invincible;
      return `[dbg] invincible: ${run.invincible}`;
    },

    time(min: number): string {
      const run = needRun();
      if (!run) return '';
      run.time = Math.max(0, min * 60);
      return `[dbg] run clock → ${min}:00 (boss timer + spawn phases follow on the next frame)`;
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
