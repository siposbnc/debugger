import type { BossDef } from './types';

// One boss every 120s. STANDARD bosses fill the 2-minute slots, drawn from the
// map's weighted bossPool (bossLogic.ts; no immediate repeat, light bosses only
// in the 2:00 opener slot). Each map's UNIQUE finale spawns at the fixed 12:00
// slot. Standard base HP sits in a narrow 650–1000 band on purpose: slots are
// random now, so escalation comes from the per-slot tier multiplier — the old
// 600–1500 spread encoded a fixed order that no longer exists.

export const BOSSES: Record<string, BossDef> = {
  mergeConflict: {
    id: 'mergeConflict', name: 'The Merge Conflict', tier: 'standard',
    codexDesc: 'Two incompatible truths wearing one body. At half health it stops pretending.',
    hp: 650, speed: 52, damage: 22, radius: 34, color: '#ff9430',
    mechanic: 'split',
    mechanicDesc: 'Sprays aimed diff-hunk volleys, and splits into <<< HEAD and >>> MAIN at 50% '
      + 'health, linked by a damaging diff. Keep their health even — a large gap '
      + 'force-push enrages the stronger half (faster, harder, denser volleys).',
  },
  memoryLeak: {
    id: 'memoryLeak', name: 'The Memory Leak', tier: 'standard',
    codexDesc: 'It does not attack you so much as it makes the world uninhabitable.',
    hp: 800, speed: 38, damage: 20, radius: 38, color: '#54e06b',
    mechanic: 'pools',
    mechanicDesc: 'Drips pools of leaked memory that never expire while it lives, and lobs '
      + 'globs of heap at your feet that splash into short-lived puddles. '
      + 'Kill it fast — or drown in your own arena. Death frees every allocation at once.',
  },
  raceCondition: {
    id: 'raceCondition', name: 'The Race Condition', tier: 'standard',
    codexDesc: 'It was here. It is now there. The order of events depends on whether '
      + 'you were watching.',
    hp: 800, speed: 70, damage: 20, radius: 30, color: '#e0d24b',
    mechanic: 'teleport',
    mechanicDesc: 'Teleports unpredictably, firing a volley on arrival and leaving a damaging '
      + 'afterimage behind. Destroy the afterimage before it expires — every race that '
      + 'resolves in its favor heals it.',
  },
  infiniteLoop: {
    id: 'infiniteLoop', name: 'The Infinite Loop', tier: 'standard',
    codexDesc: 'Its attack pattern has no exit condition, and the iterations get faster.',
    hp: 900, speed: 58, damage: 22, radius: 32, color: '#c45bff',
    mechanic: 'burst',
    mechanicDesc: 'Fires radial bursts of glitch bolts, each cycle faster than the last. '
      + 'Periodically snapshots your position and rewinds you to it — plan ahead.',
  },
  stackOverflowBoss: {
    id: 'stackOverflowBoss', name: 'The Stack Overflow', tier: 'standard',
    codexDesc: 'A tower of recursion that summons its own call stack to fight for it.',
    hp: 1000, speed: 30, damage: 26, radius: 42, color: '#cf4f86',
    mechanic: 'summon',
    mechanicDesc: 'Summoned mites are stack frames: while any live it takes half damage. '
      + 'Clear the whole stack to pop it — a long stun at full vulnerability.',
  },

  // ---- unique finales (one per map, fixed 12:00 slot) ----

  legacyMonolith: {
    id: 'legacyMonolith', name: 'The Legacy Monolith', tier: 'unique',
    codexDesc: 'Nobody knows how it works. It has been load-bearing since 1987, and every '
      + 'attempt to touch it introduces new bugs.',
    hp: 2600, speed: 26, damage: 34, radius: 52, color: '#8d99ae',
    mechanic: 'phase',
    mechanicDesc: 'Its armor (75% damage resist) holds until every Deprecated Dependency '
      + 'propping it up is destroyed. Bugs hatch continuously around it — it is legacy code.',
  },
  criticalException: {
    id: 'criticalException', name: 'The Critical Exception', tier: 'unique',
    codexDesc: 'An error so unhandled it takes the whole heap down with it. You have '
      + 'exactly one job: do not be where it lands.',
    hp: 2800, speed: 36, damage: 30, radius: 44, color: '#ff4d4d',
    mechanic: 'slam',
    mechanicDesc: 'Telegraphs huge ground slams — leave the circle before impact. Every impact '
      + 'scatters shards, the slams come faster as its health drops, and below half '
      + 'health it throws two at once.',
  },
  productionIncident: {
    id: 'productionIncident', name: 'The Production Incident', tier: 'unique',
    codexDesc: 'Every alarm at once: memory leaking, stack growing, pager screaming. The '
      + 'post-mortem writes itself, if anyone survives to write it.',
    hp: 3000, speed: 32, damage: 30, radius: 46, color: '#ff6b35',
    mechanic: 'incident',
    mechanicDesc: 'Two incidents in one: leaks permanent memory pools AND hides behind summoned '
      + 'stack frames (half damage while any live; clearing the stack stuns it). Aimed '
      + 'volleys throughout. Killing it reclaims the arena.',
  },
  kernelPanic: {
    id: 'kernelPanic', name: 'The Kernel Panic', tier: 'unique',
    codexDesc: 'The whole system halts to print one final complaint. Everything it touches '
      + 'freezes with it.',
    hp: 3200, speed: 42, damage: 28, radius: 44, color: '#7adcff',
    mechanic: 'panic',
    mechanicDesc: 'Fires expanding rings of chill shards that lag your movement. At health '
      + 'thresholds it hard-freezes — heavily armored while the blizzard intensifies — '
      + 'then thaws, briefly taking extra damage. Strike the thaw.',
  },
};

export const BOSS_INTERVAL = 120;            // seconds between bosses
export const BOSS_WARNING_LEAD = 5;          // warning banner seconds before spawn
export const BOSS_TIER_HP_MULT = 0.35;       // extra hp per slot index (hp * (1 + tier*this))
export const BOSS_TIER_DMG_MULT = 0.15;
export const BOSS_XP = 60;                   // base xp drop, scaled by tier
export const BOSS_BITS = 50;                 // matches the Bits formula's boss term
