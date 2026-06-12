import type { WeaponDef, WeaponLevelStats } from './types';

// Level tables are generated from a base + per-level growth description so the
// numbers stay easy to tune in one place. 8 levels per base weapon; evolutions
// are single-level super-forms granted via boss chest when the base is maxed.

interface Growth {
  damage?: number;     // +flat per level
  cooldown?: number;   // -flat seconds per level (clamped)
  count?: number[];    // levels (1-based) at which count increases by 1
  area?: number;       // +flat per level
  speed?: number;
  duration?: number;
  pierce?: number[];   // levels at which pierce +1
  slow?: number;       // +flat per level
}

function levels(base: WeaponLevelStats, g: Growth, n = 8): WeaponLevelStats[] {
  const out: WeaponLevelStats[] = [];
  for (let i = 0; i < n; i++) {
    const lvl = i + 1;
    out.push({
      damage: Math.round(base.damage + (g.damage ?? 0) * i),
      cooldown: Math.max(0.15, +(base.cooldown - (g.cooldown ?? 0) * i).toFixed(2)),
      count: base.count + (g.count?.filter((l) => l <= lvl).length ?? 0),
      area: base.area + (g.area ?? 0) * i,
      speed: base.speed + (g.speed ?? 0) * i,
      duration: base.duration + (g.duration ?? 0) * i,
      pierce: base.pierce + (g.pierce?.filter((l) => l <= lvl).length ?? 0),
      slow: Math.min(0.8, base.slow + (g.slow ?? 0) * i),
    });
  }
  return out;
}

const L = (
  damage: number, cooldown: number, count: number, area: number,
  speed = 0, duration = 0, pierce = 0, slow = 0,
): WeaponLevelStats => ({ damage, cooldown, count, area, speed, duration, pierce, slow });

export const WEAPONS: Record<string, WeaponDef> = {
  syntaxWand: {
    id: 'syntaxWand', name: 'Syntax Wand', kind: 'bolt', icon: '⌁', color: '#53e8a8',
    desc: 'Fires bolts of executable code at the nearest bug.',
    flavor: 'Speak friend, and compile.',
    evolveTo: 'compilersScepter',
    // Base pierce 1 + early pierce step: the wand is the only single-target
    // starter — without it ada falls behind the minute 3–6 swarm (matrix-verified).
    // Count steps end at lv 5: the v0.3 sweep had solo wand dominating the late
    // checkpoint at zero meta (4/8 wins vs next 2/8, §8) — its tail, not its
    // floor, was the outlier; the 4th bolt belongs to the evolution. (A first
    // trim also dropped the lv-5 step and collapsed the mid-game floor — the
    // lv 1–6 rows are §1-watchlist territory, don't touch them.)
    levels: levels(L(14, 0.85, 1, 7, 420, 0, 1), { damage: 5, cooldown: 0.06, count: [3, 5], pierce: [3, 6] }),
  },
  compilersScepter: {
    id: 'compilersScepter', name: "Compiler's Scepter", kind: 'bolt', icon: '⌬', color: '#7dffce',
    desc: 'Optimized bolts: more, faster, and they pierce whole call stacks.',
    flavor: 'Zero warnings. Zero survivors.',
    isEvolution: true,
    levels: [L(34, 0.42, 5, 10, 560, 0, 3)],
  },

  deployHammer: {
    id: 'deployHammer', name: 'Deployment Hammer', kind: 'shockwave', icon: '◎', color: '#ffb347',
    desc: 'Slams the ground, sending a shockwave through nearby enemies.',
    flavor: 'Ship it. Directly into their faces.',
    evolveTo: 'releaseBreaker',
    levels: levels(L(22, 2.1, 1, 115), { damage: 8, cooldown: 0.14, area: 14 }),
  },
  releaseBreaker: {
    id: 'releaseBreaker', name: 'Release Breaker', kind: 'shockwave', icon: '◉', color: '#ffd27a',
    desc: 'A double shockwave that stuns everything it touches.',
    flavor: 'It is Friday, 16:58. Deploy anyway.',
    isEvolution: true,
    levels: [L(64, 1.5, 2, 230, 0, 0.8)], // duration = stun seconds
  },

  assertBlades: {
    id: 'assertBlades', name: 'Assertion Blades', kind: 'orbit', icon: '✻', color: '#6db9ff',
    desc: 'Blades orbit you, slicing any bug that fails the check.',
    flavor: 'assert(bug.isAlive == false)',
    evolveTo: 'testHalo',
    // v0.3 sweep: the high-risk-late profile stalled (0/8 scaled wins, evo 2/8,
    // kills 58% of lane) while same-lane firewall bloomed — growth bumped so the
    // bloom is reachable. CDR-sensitive: re-run blades-cdr after ANY touch here.
    levels: levels(L(12, 0, 2, 80, 2.4), { damage: 5, count: [2, 4, 6, 8], area: 5, speed: 0.15 }),
  },
  testHalo: {
    id: 'testHalo', name: 'Test Suite Halo', kind: 'orbit', icon: '❂', color: '#a8d6ff',
    desc: 'A wide halo of relentless blades. 100% coverage.',
    flavor: 'All 7 tests passed. The 8th is you.',
    isEvolution: true,
    // §8 round 2: the bloom itself was the laggard — blades evolved (6/8 scaled)
    // but the halo couldn't close runs (0/8 wins, kills 58% of lane). Halo-side
    // buffs don't touch the blades-cdr tripwire (it runs unevolved lv-8 blades).
    levels: [L(36, 0, 8, 135, 3.8)],
  },

  garbageCollector: {
    id: 'garbageCollector', name: 'Garbage Collector', kind: 'sweep', icon: '⌫', color: '#9be564',
    desc: 'Sweeps an arc ahead of you. Instantly deletes weakened small bugs.',
    flavor: 'Unreachable objects will be reclaimed.',
    evolveTo: 'heapPurifier',
    // v0.3 sweep: outlier-low at BOTH scalings within the high-risk lane
    // (686 kills scaled vs hammer 4265, dead by 2:34 at zero meta) — floor,
    // growth AND reach buffed: a strafing brawler keeps most contacts outside
    // a narrow front cone, so area (cone radius) is the lever that actually
    // moves its measured kills; raw damage alone barely did (94 vs 70), §8
    levels: levels(L(24, 1.35, 1, 125), { damage: 9, cooldown: 0.09, area: 11 }),
  },
  heapPurifier: {
    id: 'heapPurifier', name: 'Heap Purifier', kind: 'sweep', icon: '♻', color: '#c2ff8a',
    desc: 'A full-circle purge. Deleting bugs restores 1 HP.',
    flavor: 'Stop the world. Then end it.',
    isEvolution: true,
    levels: [L(64, 0.9, 1, 170)], // buffed with the base (v0.3 §8) — the evolution must stay the upgrade
  },

  regexGrimoire: {
    id: 'regexGrimoire', name: 'Regex Grimoire', kind: 'chain', icon: '§', color: '#e36dff',
    desc: 'A pattern-beam matches the nearest bug, then greedily chains onward.',
    flavor: 'Now you have two problems. They have more.',
    evolveTo: 'perfectMatch',
    // v0.3 sweep: outlier-low in the low-risk lane (387 kills zero / 1337
    // scaled vs lane 2300–4300, 0 wins anywhere) — damage floor + growth up, §8
    // (round 2: growth 5 → 6; floor fixed, the mid-late tail still died ~8:46
    // scaled before evolving)
    levels: levels(L(15, 1.7, 3, 170), { damage: 6, cooldown: 0.1, count: [2, 4, 6, 8], area: 10 }),
  },
  perfectMatch: {
    id: 'perfectMatch', name: 'The Perfect Match', kind: 'chain', icon: '✒', color: '#f4a4ff',
    desc: 'Chains far and wide; matched bugs take 25% more damage from everything.',
    flavor: '/^bug$/ — matched. Replaced with nothing.',
    isEvolution: true,
    levels: [L(46, 1.0, 9, 230)], // buffed with the base (v0.3 §8, round 2)
  },

  stackStaff: {
    id: 'stackStaff', name: 'Stack Staff', kind: 'column', icon: '⫶', color: '#54d5e0',
    desc: 'Calls down columns of force on random nearby bugs.',
    flavor: 'push(); push(); push(); never pop.',
    evolveTo: 'overflowSpire',
    levels: levels(L(18, 2.0, 1, 55), { damage: 6, cooldown: 0.12, count: [3, 5, 7], area: 5 }),
  },
  overflowSpire: {
    id: 'overflowSpire', name: 'Overflow Spire', kind: 'column', icon: '⟰', color: '#8aeef7',
    desc: 'Each column overflows into a recursive line of three eruptions.',
    flavor: 'Maximum recursion depth: yes.',
    isEvolution: true,
    levels: [L(46, 1.2, 4, 75)],
  },

  daemonFamiliar: {
    id: 'daemonFamiliar', name: 'Daemon Familiar', kind: 'pet', icon: '◈', color: '#ff7d9c',
    desc: 'A loyal background process orbits you, shooting at bugs.',
    flavor: 'Runs even when you are not looking. Especially then.',
    evolveTo: 'processLegion',
    // v0.3 sweep: zero-meta floor was non-functional (134 kills vs lane
    // 387–617) — pet damage floor up, pets arrive a level earlier. Late
    // profile (the legion is untouched), §8 (round 2: growth 3 → 4; the
    // mid-late tail still couldn't reach its bloom, evo 1/8 scaled)
    levels: levels(L(11, 0.9, 1, 0, 460), { damage: 4, cooldown: 0.06, count: [3, 6] }),
  },
  processLegion: {
    id: 'processLegion', name: 'Process Legion', kind: 'pet', icon: '⛬', color: '#ffa9bf',
    desc: 'forkbomb.exe — a swarm of daemons with rapid fire.',
    flavor: ':(){ :|:& };:',
    isEvolution: true,
    levels: [L(16, 0.32, 5, 0, 560)],
  },

  breakpointBow: {
    id: 'breakpointBow', name: 'Breakpoint Bow', kind: 'snipe', icon: '➳', color: '#ff5e5e',
    desc: 'A piercing shot that pauses execution — heavily slowing what it hits.',
    flavor: 'The bug stops exactly where you told it to.',
    evolveTo: 'timefreezeDebugger',
    levels: levels(L(22, 1.8, 1, 9, 620, 2.0, 3, 0.4), { damage: 8, cooldown: 0.11, count: [4, 7], slow: 0.03 }),
  },
  timefreezeDebugger: {
    id: 'timefreezeDebugger', name: 'Timefreeze Debugger', kind: 'snipe', icon: '⏸', color: '#ff9c9c',
    desc: 'Shots pierce everything and freeze bugs solid for a second.',
    flavor: 'Step over. Step over. Step on.',
    isEvolution: true,
    levels: [L(70, 1.1, 3, 12, 760, 1.0, 999, 1.0)], // slow=1.0 → full freeze, duration = freeze time
  },
  forkBomb: {
    id: 'forkBomb', name: 'Fork Bomb', kind: 'bomb', icon: '⑂', color: '#ffaa4d',
    desc: 'Lobs a bomb that explodes and forks into three smaller bombs.',
    flavor: 'One process becomes three. Three become a problem.',
    evolveTo: 'zipBomb',
    // area = explosion radius; children deal 60% at 70% radius (combat.ts)
    levels: levels(L(20, 2.7, 1, 68, 330), { damage: 6, cooldown: 0.16, count: [5], area: 4 }),
  },
  zipBomb: {
    id: 'zipBomb', name: 'Zip Bomb', kind: 'bomb', icon: '⧉', color: '#ffc97a',
    desc: 'Forks four ways, and the forks fork again. Recursion as a weapon.',
    flavor: '42.zip — handle with care.',
    isEvolution: true,
    levels: [L(46, 2.0, 2, 84, 360)],
  },

  firewall: {
    id: 'firewall', name: 'Firewall', kind: 'wall', icon: '𝍕', color: '#ff6b4d',
    desc: 'Raises a burning wall across your heading. Bugs crossing it cook.',
    flavor: 'DENY ALL. Especially them.',
    evolveTo: 'dmz',
    // area = wall half-length; damage is per 0.45s tick on crossers
    levels: levels(L(9, 3.0, 1, 95, 0, 2.6), { damage: 3, cooldown: 0.13, area: 8, duration: 0.22 }),
  },
  dmz: {
    id: 'dmz', name: 'DMZ', kind: 'wall', icon: '◍', color: '#ff9b6b',
    desc: 'A full burning perimeter. Nothing enters the demilitarized zone.',
    flavor: 'Trust nothing. Toast everything.',
    isEvolution: true,
    levels: [L(22, 2.5, 1, 135, 0, 4.0)],
  },

  pingStorm: {
    id: 'pingStorm', name: 'Ping Storm', kind: 'homing', icon: '⇝', color: '#5fd7ff',
    desc: 'Fires homing packets at random bugs. They always find a route.',
    flavor: '64 bytes from bug: icmp_seq=1 ttl=0',
    evolveTo: 'ddos',
    // Base pierce 1 + a real lv-1 punch: random targeting spreads damage thin,
    // so without kill concentration the dana starter capped the field by min 4
    // and stalled her XP passive entirely (sim-caught — the syntaxWand pierce
    // lesson again: the early window has a floor even for late bloomers).
    levels: levels(L(13, 1.2, 2, 6, 340, 0, 1), { damage: 4, cooldown: 0.07, count: [3, 5, 7], speed: 12 }),
  },
  ddos: {
    id: 'ddos', name: 'DDoS', kind: 'homing', icon: '⇶', color: '#9be6ff',
    desc: 'A distributed flood of packets. The swarm gets denied service.',
    flavor: 'Your traffic is important to us.',
    isEvolution: true,
    levels: [L(16, 0.5, 6, 6, 430, 0, 1)],
  },

  sudoScroll: {
    id: 'sudoScroll', name: 'Sudo Scroll', kind: 'smite', icon: '⌥', color: '#ffc12e',
    desc: 'Rarely, strikes the biggest bug in range with root privileges.',
    flavor: 'bug is not in the sudoers file. This incident will be reported.',
    evolveTo: 'rootShell',
    // area = strike visual radius (and the root-shell execute zone basis)
    levels: levels(L(85, 5.6, 1, 60), { damage: 32, cooldown: 0.34 }),
  },
  // id/name deliberately NOT "rootAccess": that's a legendary CARD — sharing
  // an id collides in banish sets / dbg.give, and two entities with one name
  // confuses players.
  rootShell: {
    id: 'rootShell', name: 'Root Shell', kind: 'smite', icon: '#', color: '#ffd75e',
    desc: 'The strike also executes weakened lesser bugs around it (<15% HP).',
    flavor: 'uid=0(root). Everything is a file. Files can be deleted.',
    isEvolution: true,
    levels: [L(360, 3.4, 1, 100)],
  },
};

/** Base (non-evolution) weapons, in display order. */
export const BASE_WEAPONS: WeaponDef[] = Object.values(WEAPONS).filter((w) => !w.isEvolution);

/** Weapons available in the level-up pool without any meta purchase. */
export const DEFAULT_WEAPON_POOL = ['syntaxWand', 'deployHammer', 'assertBlades', 'garbageCollector'];

/** Weapons unlockable in the meta shop. */
export const SHOP_WEAPONS: { id: string; cost: number }[] = [
  { id: 'regexGrimoire', cost: 200 },
  { id: 'stackStaff', cost: 300 },
  { id: 'daemonFamiliar', cost: 450 },
  { id: 'breakpointBow', cost: 600 },
  { id: 'firewall', cost: 700 },
  { id: 'forkBomb', cost: 800 },
  { id: 'pingStorm', cost: 900 },
  { id: 'sudoScroll', cost: 1100 },
];

export const MAX_WEAPON_LEVEL = 8;
