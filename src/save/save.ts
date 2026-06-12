// localStorage persistence: Bits, meta upgrades, unlocks, lifetime stats, settings.

import type { SuspendedRun } from '../game/runSave';

export interface LifetimeStats {
  runs: number;
  kills: number;
  bossKills: number;
  bitsEarned: number;
  bestTimeSec: number;
  bestLevel: number;
  victories: number;
  uptimeSec: number;                    // accumulated run time across all runs
  weaponDamage: Record<string, number>; // lifetime damage by weapon id (favorite weapon)
}

export interface SaveData {
  version: number;
  bits: number;
  metaLevels: Record<string, number>;
  unlockedCharacters: string[];
  unlockedMaps: string[];
  unlockedWeapons: string[];   // shop-bought weapons added to the in-run pool
  completedObjectives: string[];
  lastCharacter: string;
  lastMap: string;
  lifetime: LifetimeStats;
  settings: {
    master: number; sfx: number; music: number;
    shake: boolean; reduceFlash: boolean; playerHpBar: boolean; fpsCounter: boolean;
    /** Custom key bindings (action → KeyboardEvent.code); missing = default. */
    keys: Record<string, string>;
  };
  /** Namespaced codex/shop entry ids already shown to the player (NEW badges).
   *  Objectives use `obj:<id>:done` once completed so finishing one re-badges it. */
  seenIds: string[];
  /** Progressive codex unlocks: `bug:`/`boss:` ids the player has actually met
   *  in a run (spawned on their field). Unmet entries render locked/glitched;
   *  the Precipitate stays unlisted entirely until collected. */
  encountered: string[];
  /** Progressive meta-shop unlocks: upgrade ids revealed by play — taking a
   *  card of the matching stat, or using the matching mechanic (reroll/banish/
   *  defer) once. Purchased upgrades count as unlocked regardless; the two
   *  specials derive from objectives (boss1 → bossReward, evolve → weaponSlot). */
  unlockedMeta: string[];
  /** Newest patch-notes entry version the player has opened ('' = never) —
   *  drives the "What's new" menu badge. */
  lastSeenVersion: string;
  /** Mid-run snapshot from "suspend & exit" — consumed on resume. */
  suspendedRun: SuspendedRun | null;
}

const KEY = 'debugger-save-v1';

export const SAVE_VERSION = 1;

// Stepwise migrations for shape CHANGES (renames, moved fields, semantic
// changes). Purely ADDED fields need no entry — the defaults merge in
// loadSave covers those. MIGRATIONS[n] upgrades a version-n save to n+1,
// mutating the raw parsed object in place. When a content patch changes the
// save shape: bump SAVE_VERSION and add the matching step here.
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => void> = {
  // 1: (raw) => { raw.renamedField = raw.oldField; }   // example: 1 → 2
};

function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  let v = typeof raw.version === 'number' ? raw.version : 1;
  // A save from a NEWER build (downgrade) passes through untouched — the
  // spread merge keeps fields this build doesn't know about.
  while (v < SAVE_VERSION) {
    MIGRATIONS[v]?.(raw);
    v++;
  }
  raw.version = Math.max(v, SAVE_VERSION);
  return raw;
}

function defaults(): SaveData {
  return {
    version: SAVE_VERSION,
    bits: 0,
    metaLevels: {},
    unlockedCharacters: ['ada'],
    unlockedMaps: ['greenfield'],
    unlockedWeapons: [],
    completedObjectives: [],
    lastCharacter: 'ada',
    lastMap: 'greenfield',
    lifetime: { runs: 0, kills: 0, bossKills: 0, bitsEarned: 0, bestTimeSec: 0, bestLevel: 0, victories: 0, uptimeSec: 0, weaponDamage: {} },
    settings: { master: 1, sfx: 0.7, music: 0.5, shake: true, reduceFlash: false, playerHpBar: true, fpsCounter: false, keys: {} },
    seenIds: [],
    encountered: [],
    unlockedMeta: [],
    lastSeenVersion: '',
    suspendedRun: null,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const data = migrate(JSON.parse(raw) as Record<string, unknown>) as Partial<SaveData>;
    // Merge over defaults so new fields survive version drift.
    const d = defaults();
    const out = {
      ...d, ...data,
      lifetime: { ...d.lifetime, ...(data.lifetime ?? {}) },
      settings: { ...d.settings, ...(data.settings ?? {}) },
    };
    // Grandfather pre-progressive-codex saves: anything the player's codex has
    // already shown them (seenIds) counts as encountered, so veterans don't
    // see their whole bestiary re-lock. The Precipitate stays earned-only.
    if (!Array.isArray(data.encountered)) {
      out.encountered = out.seenIds.filter(
        (id) => (id.startsWith('bug:') || id.startsWith('boss:')) && id !== 'bug:mushi');
      if (out.completedObjectives.includes('mushiCatch')) out.encountered.push('bug:mushi');
    }
    return out;
  } catch {
    return defaults();
  }
}

export function persistSave(save: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Storage unavailable (private mode etc.) — play session-only.
  }
}

export function wipeSave(): SaveData {
  localStorage.removeItem(KEY);
  return defaults();
}
