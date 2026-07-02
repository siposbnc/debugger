// The Great Rewrite — prestige constants + the Legacy Token formula.
// Spec: docs/PRESTIGE.md (approved 2026-07-02). This module is pure data/math
// (headless-safe); the save surgery lives in src/save/prestige.ts and the UI
// in src/ui/menus.ts.

/** Ship Bonus per completed Rewrite (permanent, additive): the §6 pay rise. */
export const SHIP_BONUS_BITS_PER_REWRITE = 0.3;
export const SHIP_BONUS_XP_PER_REWRITE = 0.1;

/** Token formula constants (§3): 3×maps + √(cycleBits/150) + overtimeMin/3. */
export const TOKENS_PER_MAP = 3;
export const TOKEN_BITS_DIVISOR = 150;
export const TOKEN_OVERTIME_DIVISOR = 3; // minutes of summed best overtime per token

export interface TokenBreakdown {
  maps: number;      // unique maps first-cleared this cycle
  mapTokens: number;
  bitsTokens: number;
  overtimeTokens: number;
  total: number;
}

/** Legacy Tokens a Rewrite would grant right now — drives the live
 *  "tokens on rewrite: N" counter, so it must stay cheap and pure. */
export function legacyTokens(
  mapsClearedThisCycle: number,
  cycleBits: number,
  cycleOvertimeSecTotal: number,
): TokenBreakdown {
  const mapTokens = TOKENS_PER_MAP * mapsClearedThisCycle;
  const bitsTokens = Math.floor(Math.sqrt(Math.max(0, cycleBits) / TOKEN_BITS_DIVISOR));
  const overtimeTokens = Math.floor(cycleOvertimeSecTotal / 60 / TOKEN_OVERTIME_DIVISOR);
  return { maps: mapsClearedThisCycle, mapTokens, bitsTokens, overtimeTokens, total: mapTokens + bitsTokens + overtimeTokens };
}

/** Player-facing major version: fresh save = v1.0, N rewrites = v(N+1).0. */
export function playerVersion(rewrites: number): string {
  return `v${rewrites + 1}.0`;
}
