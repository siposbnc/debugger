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
  tracerBug: {
    id: 'tracerBug', name: 'Tracer Bug',
    codexDesc: 'Logs your position from a polite distance, then posts the results '
      + 'directly to you. Closing the distance closes the ticket.',
    hp: 22, speed: 70, damage: 8, radius: 11, xp: 3, bits: 2,
    color: '#ff8fd0', shape: 'tracer', behavior: 'ranged',
  },
  checksumCrab: {
    id: 'checksumCrab', name: 'Checksum Crab',
    codexDesc: 'Validates everything that approaches head-on and rejects it. '
      + 'The hash function has a blind spot: behind it.',
    hp: 60, speed: 44, damage: 11, radius: 15, xp: 4, bits: 3,
    color: '#67e8c8', shape: 'crab', behavior: 'chase', frontShield: true,
  },
  // Field-event structure — spawned only by in-run events (game/events.ts),
  // never in spawn plans. A stationary hatcher: breeds bugs from the map's
  // current spawn phase every few seconds until destroyed. The kill pays the
  // usual xp/bits; the bounty chest comes from the event resolution.
  bugNest: {
    id: 'bugNest', name: 'Bug Nest',
    codexDesc: '99 little bugs in the code. Take one down, patch it around — '
      + 'the nest files new ones faster than you can read them. Torch it at '
      + 'the source and collect the bounty.',
    hp: 90, speed: 0, damage: 0, radius: 22, xp: 6, bits: 4,
    color: '#d65a3c', shape: 'nest', behavior: 'chase', stationary: true,
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
    // 10:00 debut → ~135 hp each); armor holds until all three die, so the set
    // must fall to incidental AoE within seconds once the orbit reaches the player
    hp: 28, speed: 0, damage: 0, radius: 18, xp: 0, bits: 0,
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

// ---------- Map-identity variants (v0.4) ----------
// A variant inherits a base archetype's behavior and flags, then overrides a
// palette colour, some stats and (at most) one flag. Most also override the
// SHAPE with a map-native bespoke sprite (user ruling 2026-06-17: reskins are
// fine for some, but most of a roster should look tailored to its map) — the
// behavior stays inherited so game/ is untouched. Gives each map its own
// roster so no two maps field the exact same enemy id. See ROADMAP
// "Per-map enemy pools".

/** Build a variant of `baseId`, inheriting everything not overridden. */
function variant(baseId: string, over: Partial<EnemyDef> & Pick<EnemyDef, 'id' | 'name' | 'codexDesc' | 'color'>): EnemyDef {
  return { ...ENEMIES[baseId], ...over, variantOf: baseId };
}

// Memory Marsh — leaked, decaying swamp life. Murky-green palette; everything
// here is a touch SLOWER than its Greenfield cousin (the waterlogged feel) but
// HP stays at base — tankier bodies sink boss-window DPS and dropped the maxed-
// meta cert below the §5 floor (the recurring "durable bodies eat the boss
// budget" lesson). The map's identity is its roster (drain-heavy, no explosion
// or shield types) + the ×1.2 enemyScale, not per-enemy bulk.
const MARSH_VARIANTS: EnemyDef[] = [
  variant('syntaxMite', {
    id: 'bogMite', name: 'Bog Mite', color: '#6f9e4a',
    codexDesc: 'A typo that fell in the swamp and waterlogged. Slower than the original, '
      + 'soggier, and it brought friends that also fell in.',
    speed: 52,
  }),
  variant('cacheTick', {
    id: 'dripTick', name: 'Drip Tick', color: '#9aa83c', shape: 'droplet',
    codexDesc: 'Leaks one stale byte at a time, in identical drips. The puddle is the problem.',
    speed: 66,
  }),
  variant('nullWasp', {
    id: 'mireWasp', name: 'Mire Wasp', color: '#7fa86a', shape: 'mosquito',
    codexDesc: 'Dereferences out of the reeds in heavy, waterlogged charges. '
      + 'Points at nothing; lands in muck.',
    speed: 86,
  }),
  variant('memoryLeech', {
    id: 'heapLeech', name: 'Heap Leech', color: '#5fbf6b', shape: 'slug',
    codexDesc: 'The marsh native. Sits in the leaked allocations it caused and drinks '
      + 'your health to grow its own — right at home in the swamp it made.',
    speed: 32,
  }),
  variant('raceSpider', {
    id: 'forkSpider', name: 'Fork Spider', color: '#b6c24b', shape: 'forked',
    codexDesc: 'Forks a copy whenever you blink. In the fog you can never be sure how '
      + 'many there really are.',
    speed: 80,
  }),
  variant('deadlockScarab', {
    id: 'sludgeScarab', name: 'Sludge Scarab', color: '#4f7d5b', shape: 'dome',
    codexDesc: 'Holds a lock on the mud itself. Everything near it wades; you most of all.',
    speed: 36,
  }),
  variant('stackCentipede', {
    id: 'rotCentipede', name: 'Rot Centipede', color: '#7e8f3a',
    codexDesc: 'A recursion that decomposed mid-call and kept calling. Each rotting '
      + 'segment invokes the next; there is no base case, only compost.',
    speed: 42,
  }),
];

for (const v of MARSH_VARIANTS) ENEMIES[v.id] = v;

// Production Server — industrial heat: crashes, deadlocks, monitoring. Most of
// the roster is map-NATIVE (bespoke silhouettes, not reskins): bolts, drones,
// pressure canisters, padlocks, camera sentries. Warm rust/amber palette;
// stats stay at base (the ×1.4 enemyScale + composition is the difficulty),
// except the Panic Beetle's deliberately bigger blast.
const PRODUCTION_VARIANTS: EnemyDef[] = [
  variant('syntaxMite', {
    id: 'crashMite', name: 'Crash Mite', color: '#e07b3a',
    codexDesc: 'A typo that shipped to prod. Multiplies under load — each one is a ticket, '
      + 'and they never arrive one at a time.',
  }),
  variant('cacheTick', {
    id: 'threadTick', name: 'Thread Tick', color: '#d6a23f', shape: 'bolt',
    codexDesc: 'A worker thread that never joined, ticking in the pool. Spawns in batches '
      + 'the scheduler can no longer drain.',
  }),
  variant('nullWasp', {
    id: 'segfaultWasp', name: 'Segfault Drone', color: '#ff8c5a', shape: 'drone',
    codexDesc: 'Dereferences a bad address at full throttle. Reads from nothing and writes '
      + 'the fault straight into you.',
  }),
  variant('exceptionBeetle', {
    id: 'panicBeetle', name: 'Panic Beetle', color: '#ff6a2c', shape: 'canister',
    codexDesc: 'An uncaught exception under pressure. Reaches a bad state and detonates in a '
      + 'wider blast than anything in greenfield — give it room or kill it from range.',
    explodeRadius: 100,
  }),
  variant('deadlockScarab', {
    id: 'mutexScarab', name: 'Mutex Scarab', color: '#c98a3e', shape: 'lock',
    codexDesc: 'Took the lock and will not release it. Everything waiting on the mutex grinds '
      + 'to a crawl — you most of all.',
  }),
  variant('tracerBug', {
    id: 'telemetrySentry', name: 'Telemetry Sentry', color: '#e8a14d', shape: 'sentry',
    codexDesc: 'Monitors you from a safe distance and posts the metrics straight to your health '
      + 'bar. Closing the distance closes the dashboard.',
  }),
];

for (const v of PRODUCTION_VARIANTS) ENEMIES[v.id] = v;

// Cyber Glacier — processes frozen mid-execution. Pale ice palette; the roster
// identity is TANK + CHILL + SHIELD (slow auras stack with the map's latency
// fields, heavyweights soak, the ICE crab blocks head-on) with moth charges so
// lagged dodges still cost something. No explosion (production's), no drain
// (marsh's), no duplicators. Most of the roster is map-native (crystalline
// silhouettes); stats stay at BASE like production's — a first draft that
// bumped the tank's hp and slowed the whole roster dropped the §5 maxed-meta
// arm from 31% to 16% (sim-caught): bulk eats the boss budget, and slower
// bodies cut kill/XP throughput so the build is underleveled by the finale.
// The ×1.35 enemyScale + composition is the difficulty.
const GLACIER_VARIANTS: EnemyDef[] = [
  variant('syntaxMite', {
    id: 'frostMite', name: 'Frost Mite', color: '#7fc4de',
    codexDesc: 'A typo that never got warm enough to run. Slower than the original, '
      + 'colder, and permafrost preserves everything — including the swarm.',
    speed: 54,
  }),
  variant('cacheTick', {
    id: 'lagSpike', name: 'Lag Spike', color: '#a8e4f0', shape: 'shard',
    codexDesc: 'Arrives in sudden identical clusters, exactly when you least need it. '
      + 'The frame you lost is embedded in the ice.',
    speed: 84,
  }),
  variant('nullWasp', {
    id: 'thrashMoth', name: 'Thrash Moth', color: '#9db8e8', shape: 'moth',
    codexDesc: 'Swaps in, swaps out, swaps in again — furious paging charges that '
      + 'never let anything actually load. Drawn to whatever you were working on.',
  }),
  variant('memoryLeech', {
    id: 'zombieProcess', name: 'Zombie Process', color: '#8ccfc4', shape: 'ghost',
    // one flag tweak: drain OFF — the glacier tank threatens by refusing to
    // die, not by feeding. hp stays at BASE: an hp bump here (68 in the first
    // draft) halved the §5 maxed-meta arm on its own weight-5/6 slot — the
    // marsh/Monolith lesson again, durable bodies eat the boss budget.
    codexDesc: 'Exited years ago; nobody collected it. It shambles on in the process '
      + 'table, unkillable by anything short of doing it properly.',
    drain: false,
  }),
  variant('deadlockScarab', {
    id: 'semaphoreScarab', name: 'Semaphore Scarab', color: '#6fc6e0', shape: 'crystal',
    codexDesc: 'A signal frozen at red. Everything near it queues politely, forever — '
      + 'you most of all.',
  }),
  variant('stackCentipede', {
    id: 'coldpathCentipede', name: 'Coldpath Centipede', color: '#7e9fd4',
    codexDesc: 'The branch nobody profiled, recursing where no optimizer has ever '
      + 'looked. Each frozen segment calls the next. There is no base case in the ice.',
  }),
  variant('checksumCrab', {
    id: 'blackIceCrab', name: 'Black ICE Crab', color: '#4d7ea8', shape: 'floe',
    codexDesc: 'Intrusion Countermeasures, entombed but still on duty. Rejects '
      + 'everything arriving head-on; the audit has a blind spot: behind it.',
  }),
];

for (const v of GLACIER_VARIANTS) ENEMIES[v.id] = v;

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
