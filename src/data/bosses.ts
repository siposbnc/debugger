import type { BossDef } from './types';

// One boss every 120s. Map's bossOrder picks from these; after the list is
// exhausted the order cycles with higher tier scaling.

export const BOSSES: Record<string, BossDef> = {
  mergeConflict: {
    id: 'mergeConflict', name: 'The Merge Conflict',
    codexDesc: 'Two incompatible truths wearing one body. At half health it stops pretending.',
    hp: 600, speed: 52, damage: 22, radius: 34, color: '#ff9430',
    mechanic: 'split',
    mechanicDesc: 'Splits into <<< HEAD and >>> MAIN at 50% health. Both must die.',
  },
  memoryLeak: {
    id: 'memoryLeak', name: 'The Memory Leak',
    codexDesc: 'It does not attack you so much as it makes the world uninhabitable.',
    hp: 850, speed: 38, damage: 20, radius: 38, color: '#54e06b',
    mechanic: 'pools',
    mechanicDesc: 'Drips expanding pools of leaked memory. Standing in them hurts.',
  },
  infiniteLoop: {
    id: 'infiniteLoop', name: 'The Infinite Loop',
    codexDesc: 'Its attack pattern has no exit condition, and the iterations get faster.',
    hp: 1100, speed: 58, damage: 22, radius: 32, color: '#c45bff',
    mechanic: 'burst',
    mechanicDesc: 'Fires radial bursts of glitch bolts. Each cycle is faster than the last.',
  },
  stackOverflowBoss: {
    id: 'stackOverflowBoss', name: 'The Stack Overflow',
    codexDesc: 'A tower of recursion that summons its own call stack to fight for it.',
    hp: 1500, speed: 30, damage: 26, radius: 42, color: '#cf4f86',
    mechanic: 'summon',
    mechanicDesc: 'Summons waves of recursive mites and fires aimed triple shots.',
  },
  legacyMonolith: {
    id: 'legacyMonolith', name: 'The Legacy Monolith',
    codexDesc: 'Nobody knows how it works. It has been load-bearing since 1987.',
    hp: 2600, speed: 26, damage: 34, radius: 52, color: '#8d99ae',
    mechanic: 'phase',
    mechanicDesc: 'Alternates between an armored phase (75% damage resist) and an exposed core.',
  },
};

export const BOSS_INTERVAL = 120;            // seconds between bosses
export const BOSS_WARNING_LEAD = 5;          // warning banner seconds before spawn
export const BOSS_TIER_HP_MULT = 0.35;       // extra hp per tier index (hp * (1 + tier*this))
                                              // (boss base HP already escalates through the order)
export const BOSS_TIER_DMG_MULT = 0.15;
export const BOSS_XP = 60;                   // base xp drop, scaled by tier
export const BOSS_BITS = 50;                 // matches the Bits formula's boss term
