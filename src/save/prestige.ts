// The Rewrite itself: token grant + the reset/persist surgery on SaveData.
// DOM-free (testable headless); the SHIP IT screen in ui/menus.ts calls this.
// Spec: docs/PRESTIGE.md §2–4 — full reset (user ruling §9-Q1): shop, wallet,
// licenses, maps, characters and per-map wins reset; knowledge (codex,
// objectives, records, reveals) and everything prestige persist.

import type { SaveData } from './save';
import { legacyTokens, type TokenBreakdown } from '../data/prestige';

/** Tokens a Rewrite would grant right now (the live counter + preview). */
export function tokensOnRewrite(save: SaveData): TokenBreakdown {
  const maps = Object.keys(save.mapVictories).filter((id) => (save.mapVictories[id] ?? 0) > 0).length;
  const overtimeSec = Object.values(save.cycleOvertimeBest).reduce((a, b) => a + b, 0);
  return legacyTokens(maps, save.cycleBits, overtimeSec);
}

/** SHIP IT is offered once the last map is cleared this cycle (§2). The UI
 *  additionally blocks shipping while a run is suspended. */
export function shipAvailable(save: SaveData): boolean {
  return (save.mapVictories['cyberGlacier'] ?? 0) > 0;
}

export interface RewriteReceipt {
  tokens: TokenBreakdown;
  /** the shipped version, e.g. 'v2.0' after the first Rewrite */
  version: string;
  cycleRuns: number;
  cycleBits: number;
}

/** Perform the Rewrite. Mutates `save` in place; caller persists + re-renders.
 *  Caller must have verified shipAvailable() and no suspended run. */
export function shipRewrite(save: SaveData): RewriteReceipt {
  const tokens = tokensOnRewrite(save);
  const receipt: RewriteReceipt = {
    tokens,
    version: `v${save.rewrites + 2}.0`, // the version being shipped
    cycleRuns: save.cycleRuns,
    cycleBits: save.cycleBits,
  };

  save.rewrites++;
  save.legacyTokens += tokens.total;

  // resets (PRESTIGE.md §4, left column) — keptMeta (Persistent Config picks)
  // survive the shop wipe
  const kept: Record<string, number> = {};
  for (const id of save.keptMeta) {
    if (save.metaLevels[id]) kept[id] = save.metaLevels[id];
  }
  save.metaLevels = kept;
  save.bits = 0;
  save.unlockedWeapons = [];
  save.unlockedMaps = ['greenfield'];
  save.unlockedCharacters = ['ada'];
  save.lastCharacter = 'ada';
  save.lastMap = 'greenfield';
  save.mapVictories = {};
  save.endlessMode = false;
  save.curses = [];
  save.cycleBits = 0;
  save.cycleRuns = 0;
  save.cycleOvertimeBest = {};

  // everything else — codex, objectives, lifetime records, endlessBest,
  // unlockedMeta reveals, settings, tree/tokens — persists by not being touched
  return receipt;
}
