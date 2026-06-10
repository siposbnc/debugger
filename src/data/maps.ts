import type { MapDef } from './types';

export const MAPS: Record<string, MapDef> = {
  greenfield: {
    id: 'greenfield', name: 'Greenfield Repository',
    desc: 'A fresh meadow of clean code — already sprouting bug nests, broken terminals and buried cables. They grow up so fast.',
    bitsMult: 1.0, cost: 0,
    palette: {
      ground1: '#1d3324', ground2: '#22402b',
      grid: '#2f5538', accent: '#53e8a8', fog: '#0a1410',
    },
    spawnPlan: [
      { fromMin: 0, interval: 1.35, weights: { syntaxMite: 10 } },
      { fromMin: 1, interval: 1.15, weights: { syntaxMite: 10, cacheTick: 4 } },
      { fromMin: 2, interval: 1.0, weights: { syntaxMite: 9, cacheTick: 5, nullWasp: 4 } },
      { fromMin: 4, interval: 0.85, weights: { syntaxMite: 7, cacheTick: 5, nullWasp: 5, exceptionBeetle: 3, memoryLeech: 3 } },
      { fromMin: 6, interval: 0.7, weights: { syntaxMite: 5, cacheTick: 5, nullWasp: 5, exceptionBeetle: 4, memoryLeech: 4, raceSpider: 4 } },
      { fromMin: 8, interval: 0.62, weights: { cacheTick: 5, nullWasp: 5, exceptionBeetle: 4, memoryLeech: 4, raceSpider: 4, deadlockScarab: 3 } },
      { fromMin: 10, interval: 0.55, weights: { nullWasp: 5, exceptionBeetle: 5, memoryLeech: 4, raceSpider: 5, deadlockScarab: 4, stackCentipede: 2 } },
      { fromMin: 12, interval: 0.48, weights: { nullWasp: 5, exceptionBeetle: 5, raceSpider: 5, deadlockScarab: 5, stackCentipede: 4 } },
    ],
    bossOrder: ['mergeConflict', 'memoryLeak', 'infiniteLoop', 'stackOverflowBoss', 'legacyMonolith'],
  },

  memoryMarsh: {
    id: 'memoryMarsh', name: 'Memory Marsh',
    desc: 'A swamp of leaked allocations. Toxic heap-pools slow your step, and everything here hits harder. ×1.25 Bits.',
    bitsMult: 1.25, cost: 500,
    palette: {
      ground1: '#1f2b33', ground2: '#26343d',
      grid: '#33505c', accent: '#54e06b', fog: '#0a1014',
    },
    hazardPools: true,
    spawnPlan: [
      { fromMin: 0, interval: 1.2, weights: { syntaxMite: 8, memoryLeech: 4 } },
      { fromMin: 1, interval: 1.0, weights: { syntaxMite: 8, memoryLeech: 5, cacheTick: 4 } },
      { fromMin: 3, interval: 0.75, weights: { syntaxMite: 6, memoryLeech: 6, cacheTick: 4, nullWasp: 4, exceptionBeetle: 3 } },
      { fromMin: 5, interval: 0.68, weights: { memoryLeech: 6, cacheTick: 4, nullWasp: 5, exceptionBeetle: 4, raceSpider: 4 } },
      { fromMin: 7, interval: 0.6, weights: { memoryLeech: 6, nullWasp: 5, exceptionBeetle: 5, raceSpider: 4, deadlockScarab: 4 } },
      { fromMin: 9, interval: 0.52, weights: { memoryLeech: 5, nullWasp: 5, exceptionBeetle: 5, raceSpider: 5, deadlockScarab: 5, stackCentipede: 3 } },
      { fromMin: 11, interval: 0.45, weights: { nullWasp: 5, exceptionBeetle: 6, raceSpider: 5, deadlockScarab: 5, stackCentipede: 5 } },
    ],
    bossOrder: ['memoryLeak', 'mergeConflict', 'stackOverflowBoss', 'infiniteLoop', 'legacyMonolith'],
  },
};

export const MAP_LIST = Object.values(MAPS);

/** Run is won when the player survives this long (seconds). */
export const RUN_DURATION = 15 * 60;
