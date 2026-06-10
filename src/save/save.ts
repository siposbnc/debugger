// localStorage persistence: Bits, meta upgrades, unlocks, lifetime stats, settings.

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
  version: 1;
  bits: number;
  metaLevels: Record<string, number>;
  unlockedCharacters: string[];
  unlockedMaps: string[];
  unlockedWeapons: string[];   // shop-bought weapons added to the in-run pool
  completedObjectives: string[];
  lastCharacter: string;
  lastMap: string;
  lifetime: LifetimeStats;
  settings: { sfx: number; music: number; shake: boolean };
}

const KEY = 'debugger-save-v1';

function defaults(): SaveData {
  return {
    version: 1,
    bits: 0,
    metaLevels: {},
    unlockedCharacters: ['ada'],
    unlockedMaps: ['greenfield'],
    unlockedWeapons: [],
    completedObjectives: [],
    lastCharacter: 'ada',
    lastMap: 'greenfield',
    lifetime: { runs: 0, kills: 0, bossKills: 0, bitsEarned: 0, bestTimeSec: 0, bestLevel: 0, victories: 0 },
    settings: { sfx: 0.7, music: 0.5, shake: true },
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const data = JSON.parse(raw) as Partial<SaveData>;
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
