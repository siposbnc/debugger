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
    damageMult: 1 + 0.11 * minutes,
    speedMult: Math.min(1.35, 1 + 0.013 * minutes),
    spawnRateMult: Math.pow(0.915, minutes), // multiplies spawn interval (lower = faster)
    bossHpMult: 1 + 0.5 * minutes * 0.5,
  };
}

export const MAX_ENEMIES = 380;
