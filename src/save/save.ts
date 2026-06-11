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
  settings: { sfx: number; music: number; shake: boolean; playerHpBar: boolean };
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
    lifetime: { runs: 0, kills: 0, bossKills: 0, bitsEarned: 0, bestTimeSec: 0, bestLevel: 0, victories: 0 },
    settings: { sfx: 0.7, music: 0.5, shake: true, playerHpBar: true },
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
    return {
      ...d, ...data,
      lifetime: { ...d.lifetime, ...(data.lifetime ?? {}) },
      settings: { ...d.settings, ...(data.settings ?? {}) },
    };
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
