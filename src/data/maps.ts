import type { MapDef } from './types';

export const MAPS: Record<string, MapDef> = {
  greenfield: {
    id: 'greenfield', name: 'Greenfield Repository',
    desc: 'A fresh meadow of clean code — already sprouting bug nests, broken terminals and buried cables. They grow up so fast.',
    icon: '🌱', bitsMult: 1.0, cost: 0,
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
      { fromMin: 8, interval: 0.62, weights: { cacheTick: 5, nullWasp: 5, exceptionBeetle: 4, memoryLeech: 4, raceSpider: 4, deadlockScarab: 3, tracerBug: 2 } },
      { fromMin: 10, interval: 0.55, weights: { nullWasp: 5, exceptionBeetle: 5, memoryLeech: 4, raceSpider: 5, deadlockScarab: 4, stackCentipede: 2, tracerBug: 3 } },
      { fromMin: 12, interval: 0.48, weights: { nullWasp: 5, exceptionBeetle: 5, raceSpider: 5, deadlockScarab: 5, stackCentipede: 4, tracerBug: 3 } },
    ],
    // starter map keeps its iconic Merge Conflict opener most of the time
    bossPool: { mergeConflict: 3, memoryLeak: 2, raceCondition: 2, infiniteLoop: 2, stackOverflowBoss: 1 },
    uniqueBoss: 'legacyMonolith',
  },

  memoryMarsh: {
    id: 'memoryMarsh', name: 'Memory Marsh',
    desc: 'A swamp of leaked allocations. Toxic heap-pools slow your step, swap-space sinkholes drag everything toward their centers, and everything here hits harder. ×1.25 Bits.',
    icon: '🪵', bitsMult: 1.25, cost: 500,
    palette: {
      ground1: '#1f2b33', ground2: '#26343d',
      grid: '#33505c', accent: '#54e06b', fog: '#0a1014',
    },
    hazardPools: true,
    // Terrain (v0.3): swap-space gravity wells — drag EVERYTHING toward their
    // centers; bait the horde through one to bunch it for AoE, at the cost of
    // pools pairing nastily with the pull. Dead process trees are the marsh's
    // blockers: petrified parents of long-defunct children.
    obstacles: { kind: 'stump', count: 10, rMin: 24, rMax: 36 },
    patches: { kind: 'swap', count: 6 },
    enemyScale: 1.2,  // meta-gating: a fresh save shouldn't clear this on build alone
    spawnPlan: [
      { fromMin: 0, interval: 1.2, weights: { syntaxMite: 8, memoryLeech: 4 } },
      { fromMin: 1, interval: 1.0, weights: { syntaxMite: 8, memoryLeech: 5, cacheTick: 4 } },
      { fromMin: 3, interval: 0.75, weights: { syntaxMite: 6, memoryLeech: 6, cacheTick: 4, nullWasp: 4, exceptionBeetle: 3 } },
      { fromMin: 5, interval: 0.68, weights: { memoryLeech: 6, cacheTick: 4, nullWasp: 5, exceptionBeetle: 4, raceSpider: 4 } },
      { fromMin: 7, interval: 0.6, weights: { memoryLeech: 6, nullWasp: 5, exceptionBeetle: 5, raceSpider: 4, deadlockScarab: 4 } },
      { fromMin: 9, interval: 0.52, weights: { memoryLeech: 5, nullWasp: 5, exceptionBeetle: 5, raceSpider: 5, deadlockScarab: 5, stackCentipede: 3, checksumCrab: 3 } },
      { fromMin: 11, interval: 0.45, weights: { nullWasp: 5, exceptionBeetle: 6, raceSpider: 5, deadlockScarab: 5, stackCentipede: 5, checksumCrab: 3 } },
    ],
    // leak country: the Memory Leak haunts its own swamp
    bossPool: { memoryLeak: 3, mergeConflict: 2, raceCondition: 2, infiniteLoop: 2, stackOverflowBoss: 2 },
    uniqueBoss: 'criticalException',
  },

  productionServer: {
    id: 'productionServer', name: 'Production Server',
    desc: 'The room nobody enters without a change ticket. Floor vents cycle from warm to incandescent — step off the glow before it blows — and the racks themselves block the aisles. ×1.5 Bits.',
    icon: '🏭', bitsMult: 1.5, cost: 1200,
    palette: {
      ground1: '#241f22', ground2: '#2b2528',
      grid: '#4a3835', accent: '#ff9b3d', fog: '#120d0e',
    },
    hazardVents: true,
    // Terrain (v0.3): server-rack AISLES (rows of 2–4 racks forming corridor
    // walls) — bosses crush past, bullets fly over. Data-bus conveyor lanes
    // run between the aisles (ride to escape, fight upstream, lure the horde
    // onto an away-flowing lane).
    obstacles: { kind: 'rack', count: 14, rMin: 26, rMax: 40, layout: 'rows' },
    patches: { kind: 'bus', count: 5 },
    // meta-gating: near-impossible without serious meta investment. 1.35 → 1.4
    // after the v0.3 weapon equalization lifted the zero-meta ceiling here to
    // ~12.5% (inverting the ladder vs marsh's 0%) — §5 re-certed at 1.4
    enemyScale: 1.4,
    // Skew: exception beetles from minute 0, deadlock scarabs early — uptime
    // pressure (explosions to dodge, locks slowing the escape) on hot floors.
    // Late beetle weight stays ≤5: explosion stacking past min 10 is a known
    // watchlist concern (Backlog), don't feed it.
    spawnPlan: [
      { fromMin: 0, interval: 1.2, weights: { syntaxMite: 8, exceptionBeetle: 3 } },
      { fromMin: 1, interval: 1.0, weights: { syntaxMite: 8, exceptionBeetle: 4, cacheTick: 4 } },
      { fromMin: 3, interval: 0.75, weights: { syntaxMite: 6, exceptionBeetle: 5, cacheTick: 4, nullWasp: 4, deadlockScarab: 2 } },
      { fromMin: 5, interval: 0.65, weights: { exceptionBeetle: 5, cacheTick: 4, nullWasp: 5, deadlockScarab: 4, raceSpider: 3 } },
      { fromMin: 7, interval: 0.58, weights: { exceptionBeetle: 5, nullWasp: 5, deadlockScarab: 5, raceSpider: 4, memoryLeech: 3 } },
      { fromMin: 9, interval: 0.5, weights: { exceptionBeetle: 5, nullWasp: 5, deadlockScarab: 5, raceSpider: 5, stackCentipede: 3, tracerBug: 3 } },
      { fromMin: 11, interval: 0.44, weights: { exceptionBeetle: 5, nullWasp: 5, deadlockScarab: 6, raceSpider: 5, stackCentipede: 5, tracerBug: 3 } },
    ],
    // prod is where races and stack blowups page you at 3am (overflow weight
    // capped at 2: the two stall-heaviest standards both at 3 queued bosses
    // into crunch on the maxed-meta cert)
    bossPool: { stackOverflowBoss: 2, raceCondition: 3, mergeConflict: 2, infiniteLoop: 2, memoryLeak: 1 },
    uniqueBoss: 'productionIncident',
  },
  cyberGlacier: {
    id: 'cyberGlacier', name: 'Cyber Glacier',
    desc: 'Processes frozen mid-execution, drifting in the permafrost. Latency fields lag everything caught inside — your inputs included — and the ice columns hold what never got to exit. ×1.5 Bits.',
    icon: '🧊', bitsMult: 1.5, cost: 2000,
    palette: {
      ground1: '#1c2a3c', ground2: '#223349',
      grid: '#3a567a', accent: '#7adcff', fog: '#0a101c',
    },
    hazardLatency: true,
    // Terrain (v0.3): frozen-process ice columns — processes that never got to
    // exit, entombed standing. Static cover among the latency fields.
    obstacles: { kind: 'ice', count: 12, rMin: 28, rMax: 42 },
    // meta-gating: deepest map. Was 1.4 at map ship (certified 47% maxed-meta);
    // the v0.3 card-pool growth diluted bot build quality just enough to sink
    // the cert below the 40% floor ONLY here (greenfield held exactly) — the
    // map sits closest to the finale DPS cliff. 1.35 = production parity;
    // glacier's extra difficulty stays in the latency fields, tank skew and
    // the heaviest finale (Kernel Panic 2200 + freeze phases).
    enemyScale: 1.35,
    // Skew: tanks — leeches from minute 0, scarabs early (slow aura on top of
    // latency lag), centipedes from min 5 and heavy late. Beetle weight stays
    // ≤4 (explosion-stacking Backlog concern); wasps keep charge pressure so
    // lagged dodges actually cost something.
    spawnPlan: [
      { fromMin: 0, interval: 1.25, weights: { syntaxMite: 8, memoryLeech: 3 } },
      { fromMin: 1, interval: 1.05, weights: { syntaxMite: 7, memoryLeech: 5, deadlockScarab: 2 } },
      { fromMin: 3, interval: 0.8, weights: { syntaxMite: 5, memoryLeech: 6, deadlockScarab: 4, cacheTick: 4 } },
      { fromMin: 5, interval: 0.7, weights: { memoryLeech: 6, deadlockScarab: 5, cacheTick: 4, nullWasp: 4, stackCentipede: 2 } },
      { fromMin: 7, interval: 0.6, weights: { memoryLeech: 5, deadlockScarab: 6, nullWasp: 5, stackCentipede: 3, exceptionBeetle: 3 } },
      // crab weight stays LOW here: glacier is already the tank map, and a
      // frontal-blocking shot-soak arriving in the finale's DPS window dropped
      // the maxed-meta cert below the 40% floor at weight 3/4 (sim-caught —
      // the Monolith-pillar lesson again: durable bodies eat the boss budget)
      { fromMin: 9, interval: 0.52, weights: { memoryLeech: 5, deadlockScarab: 6, nullWasp: 5, stackCentipede: 4, exceptionBeetle: 4, raceSpider: 4, checksumCrab: 2 } },
      { fromMin: 11, interval: 0.46, weights: { deadlockScarab: 6, nullWasp: 5, stackCentipede: 6, exceptionBeetle: 4, raceSpider: 5, checksumCrab: 2 } },
    ],
    // frozen processes: the slow heavyweights rule the glacier
    bossPool: { stackOverflowBoss: 3, infiniteLoop: 3, memoryLeak: 2, mergeConflict: 2, raceCondition: 2 },
    uniqueBoss: 'kernelPanic',
  },
};

export const MAP_LIST = Object.values(MAPS);

/** Run is won when the player survives this long (seconds). */
export const RUN_DURATION = 15 * 60;
