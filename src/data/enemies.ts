import type { EnemyDef } from './types';

// Contact damage is per second while overlapping the player.
// hp/damage/speed are minute-0 baselines; the difficulty director scales them.

export const ENEMIES: Record<string, EnemyDef> = {
  syntaxMite: {
    id: 'syntaxMite', name: 'Syntax Mite',
    codexDesc: 'The common typo, given legs. Alone it is harmless. It is never alone.',
    hp: 12, speed: 62, damage: 8, radius: 11, xp: 1, bits: 1,
    color: '#c84f4f', shape: 'mite', behavior: 'chase',
  },
  cacheTick: {
    id: 'cacheTick', name: 'Cache Tick',
    codexDesc: 'Appears in sudden identical clusters. Invalidating them is the hard part.',
    hp: 8, speed: 78, damage: 6, radius: 9, xp: 1, bits: 1,
    color: '#d8893b', shape: 'tick', behavior: 'chase', cluster: 6,
  },
  nullWasp: {
    id: 'nullWasp', name: 'Null Pointer Wasp',
    codexDesc: 'Dereferences you in short, furious charges. Points at nothing, stings everything.',
    hp: 18, speed: 95, damage: 12, radius: 11, xp: 2, bits: 1,
    color: '#b65bdd', shape: 'wasp', behavior: 'charge',
  },
  memoryLeech: {
    id: 'memoryLeech', name: 'Memory Leech',
    codexDesc: 'Slow, patient, and impossible to free. Drains your health to grow its own.',
    hp: 55, speed: 34, damage: 10, radius: 16, xp: 3, bits: 2,
    color: '#69d96b', shape: 'leech', behavior: 'chase', drain: true,
  },
  raceSpider: {
    id: 'raceSpider', name: 'Race Condition Spider',
    codexDesc: 'Where it is depends on when you look. Sometimes there are briefly two.',
    hp: 26, speed: 88, damage: 11, radius: 12, xp: 3, bits: 2,
    color: '#e0d24b', shape: 'spider', behavior: 'jitter', duplicates: true,
  },
  exceptionBeetle: {
    id: 'exceptionBeetle', name: 'Exception Beetle',
    codexDesc: 'Unstable and uncaught. Handle it from a distance or it handles you.',
    hp: 30, speed: 55, damage: 9, radius: 14, xp: 3, bits: 2,
    color: '#ff7438', shape: 'beetle', behavior: 'chase', explodeOnDeath: true,
  },
  deadlockScarab: {
    id: 'deadlockScarab', name: 'Deadlock Scarab',
    codexDesc: 'Holds a lock on the very ground you walk on. Everything near it waits.',
    hp: 70, speed: 40, damage: 12, radius: 16, xp: 4, bits: 3,
    color: '#5b7ddd', shape: 'scarab', behavior: 'chase', slowAura: true,
  },
  stackCentipede: {
    id: 'stackCentipede', name: 'Stack Overflow Centipede',
    codexDesc: 'A recursive horror. Each segment calls the next. There is no base case.',
    hp: 160, speed: 46, damage: 16, radius: 20, xp: 8, bits: 5,
    color: '#cf4f86', shape: 'centipede', behavior: 'chase',
  },
  // Boss adjunct — spawned only by the Legacy Monolith's armored phase, never in
  // spawn plans. Inert (0 contact damage) shot-soak: auto-aim and projectiles hit
  // it like any enemy, which is exactly the mechanic. Destroying one mid-armor
  // exposes the Monolith's core early (bossLogic.ts).
  deprecatedDependency: {
    id: 'deprecatedDependency', name: 'Deprecated Dependency',
    codexDesc: 'Unmaintained since before the Monolith could walk, yet somehow still '
      + 'load-bearing. It does nothing but stand there absorbing hits — remove it and '
      + 'watch what it was holding up fall open.',
    // base hp is low: makeEnemy() difficulty-scales it (~×5 at the Monolith's
    // 10:00 debut → ~200 hp), and it must be breakable inside one 5s armor window
    hp: 40, speed: 0, damage: 0, radius: 15, xp: 0, bits: 0,
    color: '#8d99ae', shape: 'pillar', behavior: 'chase', stationary: true, notABug: true,
  },
  // Easter egg — kept last so the codex lists it after every real bug.
  // Not in any spawnPlan and never enters run.enemies: run.ts drives it as its
  // own entity (untargetable, harmless, collected by touch). hp/damage/xp/bits
  // are nominal; the reward is granted by the collection code.
  mushi: {
    id: 'mushi', name: 'The Precipitate',
    codexDesc: 'Wrong phylum entirely. Wandered in from the wet lab; keeps trying to '
      + 'titrate the memory pools. Purely functional — no side effects — so nothing '
      + 'here can touch it. Known member of a cabal of exactly two; recruitment closed '
      + 'years ago. Filed the littlest issue on record on its way out.',
    hp: 1, speed: 60, damage: 0, radius: 8, xp: 0, bits: 0,
    color: '#9fe8dc', shape: 'flask', behavior: 'jitter', notABug: true,
  },
};

export const ELITE = {
  /** chance per spawn = base + perMin * minutes, after eliteFromMin */
  fromMin: 4,
  baseChance: 0.015,
  chancePerMin: 0.008,
  hpMult: 9,
  damageMult: 1.6,
  radiusMult: 1.45,
  xpMult: 10,
  bitsMult: 8,
  speedMult: 0.9,
  healthDropChance: 0.6,
};

/** Difficulty director: per-minute global enemy scaling. */
export function difficulty(minutes: number) {
  return {
    hpMult: 1 + 0.24 * minutes + 0.015 * minutes * minutes,
    // Quadratic late term: an uncleaned full-density horde must become lethal
    // past ~min 8 — without it, brushing through the wall stays survivable and
    // movement alone beats the game (mortal-bot win targets in BALANCE.md §5).
    damageMult: 1 + 0.11 * minutes + 0.006 * minutes * minutes,
    speedMult: Math.min(1.35, 1 + 0.013 * minutes),
    spawnRateMult: Math.pow(0.915, minutes), // multiplies spawn interval (lower = faster)
    bossHpMult: 1 + 0.5 * minutes * 0.5,
  };
}

export const MAX_ENEMIES = 380;
