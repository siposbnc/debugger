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

// ---------- the tree (§5) ----------
// Three branches, node ranks bought with Legacy Tokens. Node behaviors are
// resolved by treePerks() into a flat PrestigePerks record — the only shape
// src/game/ ever sees (same data-names-it / game-implements-it split as
// WeaponKind). Stage-4 endgame levers (Deployment Tiers, Over-Cap Shop,
// Overclocked Cooling, Critical Path) join this list when they land.

export type PrestigeBranch = 'momentum' | 'skills' | 'leverage';

export interface PrestigeNodeDef {
  id: string;
  name: string;
  icon: string;
  branch: PrestigeBranch;
  /** [M] new mechanic, [K] keep/compression, [E] economy (§5 node typing). */
  kind: 'M' | 'K' | 'E';
  desc: string;     // mechanical effect, plain language
  flavor: string;   // the joke
  /** Token cost per rank (finite nodes). Empty when `repeat` is set. */
  costs: number[];
  /** Infinite-tail pricing: cost(rank) = base + perRank × rank. */
  repeat?: { base: number; perRank: number };
}

// Severance Package: starting Bits per rank (0 = no ranks).
export const SEVERANCE_BITS = [0, 500, 1500, 3000];
// Compound Interest / Continuous Learning: +3% per rank (linear benefit vs
// linear-growing cost vs √ token income — the treadmill guard, §5-C).
export const COMPOUND_BITS_PER_RANK = 0.03;
export const LEARNING_XP_PER_RANK = 0.03;
// Time Dilation: selectable sim-speed ceiling per rank.
export const GAME_SPEEDS = [1, 1.25, 1.5];

// Dash Module (§5-B): a keybound burst with i-frames.
export const DASH_DISTANCE = 140;   // world units covered
export const DASH_TIME = 0.18;      // seconds of travel
export const DASH_BASE_CD = 4;      // seconds; −1 per cd rank
export const DASH_IFRAMES_BASE = 0.18;     // covers the dash itself
export const DASH_IFRAMES_PER_RANK = 0.12; // ranks 2–3 extend past the burst

// Restore Point (§5-B): revive on death.
export const REVIVE_HP_FRAC = 0.5;
export const REVIVE_IFRAMES = 2;

// Sudo Mode (§5-B, §9-Q6): root privileges on a long cooldown.
export const SUDO_DURATION = 3;       // +1 at rank 2
export const SUDO_BASE_CD = 75;       // −15 at rank 3
export const SUDO_DMG_MULT = 1.5;     // +50% damage while active
export const SUDO_CDR = 0.25;         // +25% cooldown reduction while active

export const PRESTIGE_NODES: PrestigeNodeDef[] = [
  // ---- A. Momentum — hit the ground running ----
  {
    id: 'warmBoot', name: 'Warm Boot', icon: '♨', branch: 'momentum', kind: 'K',
    desc: 'Runs start at level 2/3/4 per rank, with the matching card picks owed at spawn.',
    flavor: 'skip the POST — you know the hardware by now.',
    costs: [5, 10, 18],
  },
  {
    id: 'severance', name: 'Severance Package', icon: '💼', branch: 'momentum', kind: 'K',
    desc: 'Each new cycle starts with 500/1,500/3,000 Bits per rank.',
    flavor: 'thank you for your service. here is a small allocation.',
    costs: [5, 10, 20],
  },
  {
    id: 'persistentConfig', name: 'Persistent Config', icon: '💾', branch: 'momentum', kind: 'K',
    desc: 'Keep 1/2/3 chosen meta upgrades\' levels through every Rewrite (chosen at SHIP IT).',
    flavor: 'dotfiles survive everything.',
    costs: [12, 18, 25],
  },
  {
    id: 'preflight', name: 'Preflight Check', icon: '🛫', branch: 'momentum', kind: 'K',
    desc: 'Weapon evolutions become available at weapon level 7 instead of 8. The boss chest is still required.',
    flavor: 'the checklist was the bottleneck all along.',
    costs: [10],
  },
  // ---- B. Skills — the active-input layer ----
  {
    id: 'dash', name: 'Dash Module', icon: '💨', branch: 'skills', kind: 'M',
    desc: 'Unlock Dash (Space / pad B): a 140-unit burst with invulnerability frames, 4s cooldown. Ranks 2–3: longer i-frames. Ranks 4–5: −1s cooldown each.',
    flavor: 'the fastest code is the code that isn\'t there when the exception lands.',
    costs: [10, 6, 6, 8, 8],
  },
  {
    id: 'restorePoint', name: 'Restore Point', icon: '⏪', branch: 'skills', kind: 'M',
    desc: 'Revive on death at 50% HP with 2s of invulnerability and a magnet burst. Ranks = 1/2/3 revives per run.',
    flavor: 'have you tried turning yourself off and on again?',
    costs: [15, 20, 30],
  },
  {
    id: 'sudo', name: 'Sudo Mode', icon: '🔑', branch: 'skills', kind: 'M',
    desc: 'Unlock Sudo Mode (Shift / pad Y): 3s of invulnerability, +50% damage and +25% cooldown reduction, 75s cooldown. Rank 2: +1s duration. Rank 3: −15s cooldown.',
    flavor: 'with great privileges comes great blast radius.',
    costs: [15, 10, 10],
  },
  // ---- C. Leverage — economy & the repeatable tail ----
  {
    id: 'compoundInterest', name: 'Compound Interest', icon: '📈', branch: 'leverage', kind: 'E',
    desc: '+3% Bits per rank. No rank cap.',
    flavor: 'the eighth wonder of the codebase.',
    costs: [], repeat: { base: 5, perRank: 2 },
  },
  {
    id: 'continuousLearning', name: 'Continuous Learning', icon: '🎓', branch: 'leverage', kind: 'E',
    desc: '+3% XP per rank. No rank cap.',
    flavor: 'CI/CD: continuous introspection, continuous development.',
    costs: [], repeat: { base: 5, perRank: 2 },
  },
  {
    id: 'timeDilation', name: 'Time Dilation', icon: '⏩', branch: 'leverage', kind: 'E',
    desc: 'Unlock a 1.25× game-speed toggle; rank 2 adds 1.5×. Set it in Settings.',
    flavor: 'the sprint was always a time-compression exercise.',
    costs: [6, 10],
  },
];

export const PRESTIGE_NODE_BY_ID: Record<string, PrestigeNodeDef> =
  Object.fromEntries(PRESTIGE_NODES.map((n) => [n.id, n]));

/** Token cost of the NEXT rank of a node (currentRank ranks owned). Null when maxed. */
export function nodeCost(def: PrestigeNodeDef, currentRank: number): number | null {
  if (def.repeat) return def.repeat.base + def.repeat.perRank * currentRank;
  return currentRank < def.costs.length ? def.costs[currentRank] : null;
}

/** A node's rank cap (Infinity for the repeatable tail). */
export function nodeMaxRank(def: PrestigeNodeDef): number {
  return def.repeat ? Infinity : def.costs.length;
}

/** The tree resolved into flat perks — the only prestige shape src/game/,
 *  main.ts and the ship flow consume. All-neutral at an empty tree. */
export interface PrestigePerks {
  startLevel: number;                  // Warm Boot: 1 + rank
  startBits: number;                   // Severance Package (applied by shipRewrite)
  keptMetaSlots: number;               // Persistent Config picks allowed at SHIP IT
  evolveEarly: number;                 // Preflight Check: weapon levels shaved off the evolution gate
  bitsMult: number;                    // Compound Interest (≥ 1)
  xpMult: number;                      // Continuous Learning (≥ 1)
  maxGameSpeed: number;                // Time Dilation ceiling (1 / 1.25 / 1.5)
  dash: { cooldown: number; iframes: number } | null;
  revives: number;                     // Restore Point revives per run
  sudo: { duration: number; cooldown: number } | null;
}

export function treePerks(tree: Record<string, number>): PrestigePerks {
  const r = (id: string) => Math.max(0, tree[id] ?? 0);
  const dashRank = Math.min(5, r('dash'));
  const sudoRank = Math.min(3, r('sudo'));
  return {
    startLevel: 1 + Math.min(3, r('warmBoot')),
    startBits: SEVERANCE_BITS[Math.min(3, r('severance'))],
    keptMetaSlots: Math.min(3, r('persistentConfig')),
    evolveEarly: Math.min(1, r('preflight')),
    bitsMult: 1 + COMPOUND_BITS_PER_RANK * r('compoundInterest'),
    xpMult: 1 + LEARNING_XP_PER_RANK * r('continuousLearning'),
    maxGameSpeed: GAME_SPEEDS[Math.min(2, r('timeDilation'))],
    dash: dashRank > 0
      ? {
          cooldown: DASH_BASE_CD - Math.max(0, dashRank - 3),          // ranks 4–5
          iframes: DASH_IFRAMES_BASE + DASH_IFRAMES_PER_RANK * Math.min(2, dashRank - 1), // ranks 2–3
        }
      : null,
    revives: Math.min(3, r('restorePoint')),
    sudo: sudoRank > 0
      ? {
          duration: SUDO_DURATION + (sudoRank >= 2 ? 1 : 0),
          cooldown: SUDO_BASE_CD - (sudoRank >= 3 ? 15 : 0),
        }
      : null,
  };
}

/** Neutral perks (empty tree) — the default for sims and fresh saves. */
export const NO_PERKS: PrestigePerks = treePerks({});
