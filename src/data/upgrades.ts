import type { Rarity, UpgradeCard } from './types';

// In-run upgrade cards. Rarity weights live in levelup.ts; luck shifts them.

const C = (
  id: string, name: string, rarity: Rarity, category: string, icon: string,
  desc: string, flavor: string, mods: UpgradeCard['mods'], maxStacks = 5,
): UpgradeCard => ({ id, name, rarity, category, icon, desc, flavor, mods, maxStacks });

export const UPGRADE_CARDS: UpgradeCard[] = [
  // ---- Common ----
  C('hotfix', 'Hotfix', 'common', 'Damage', '🩹',
    '+8% damage', 'Works on my machine. Now it works on theirs.', { damage: 0.08 }),
  C('autoformat', 'Autoformat', 'common', 'Attack Speed', '⚡',
    '+6% cooldown reduction', 'Prettier, faster, and slightly opinionated.', { cooldown: 0.06 }),
  C('coffeeBreak', 'Coffee Break', 'common', 'Health', '☕',
    '+15 max HP', 'The fifth cup is purely medicinal.', { maxHp: 15 }),
  C('asyncBoost', 'Async Boost', 'common', 'Movement', '🌀',
    '+6% movement speed', 'await nothing. Just go.', { speed: 0.06 }),
  C('nullCheck', 'Null Check', 'common', 'Armor', '🛡',
    '+1 armor', 'if (damage == null) return;', { armor: 1 }),
  C('cacheHit', 'Cache Hit', 'common', 'XP', '📦',
    '+8% XP gain', 'O(1) lookup, O(yes) satisfaction.', { xpGain: 0.08 }),
  C('magnetVar', 'Pointer Arithmetic', 'common', 'Pickup', '🧲',
    '+18 pickup radius', 'Everything is within reach if you cast wildly enough.', { pickupRadius: 18 }),
  C('inlineExpand', 'Inline Expansion', 'common', 'Area', '💠',
    '+8% effect area', 'Why call a function when you can BE the function?', { area: 0.08 }),
  C('tryCatch', 'Try/Catch Block', 'common', 'Shield', '🔰',
    '+12 shield (absorbs damage before HP; recharges after 6s without damage)',
    'The exception still happens. It just happens to someone else.', { shield: 12 }),
  C('codeReview', 'Code Review', 'common', 'Crit', '🔎',
    '+4% crit chance', 'Someone WILL find the flaw. It will be you. Violently.', { critChance: 0.04 }),
  C('wristRest', 'Ergonomic Wrist Rest', 'common', 'Health', '🪵',
    '+0.5 HP/s regeneration', 'Ergonomics is a long game. So is survival.', { regen: 0.5 }),

  // ---- Uncommon ----
  C('refactor', 'Refactor', 'uncommon', 'Damage', '🔧',
    '+14% damage', 'Same behavior. Somehow much more violent.', { damage: 0.14 }),
  C('unitTests', 'Unit Test Coverage', 'uncommon', 'Crit', '✅',
    '+6% crit chance', 'Every edge case is now a stabbing case.', { critChance: 0.06 }),
  C('memOptimize', 'Memory Optimization', 'uncommon', 'Health', '🧠',
    '+25 max HP, +0.5 HP/s regen', 'Freed 4 GB. Stored it in your bloodstream.', { maxHp: 25, regen: 0.5 }),
  C('hotReload', 'Hot Reload', 'uncommon', 'Attack Speed', '🔁',
    '+10% cooldown reduction', 'Changes apply instantly. Bugs disapply instantly.', { cooldown: 0.1 }),
  C('ciPipeline', 'CI Pipeline', 'uncommon', 'XP', '🚇',
    '+12% XP, +10 pickup radius', 'Continuous Integration of their remains.', { xpGain: 0.12, pickupRadius: 10 }),
  C('stackTrace', 'Stack Trace', 'uncommon', 'Area', '🪜',
    '+12% area, +4% damage', 'Now you can see exactly where it all went wrong.', { area: 0.12, damage: 0.04 }),
  C('linterRage', 'Linter Rage', 'uncommon', 'Crit', '📐',
    '+15% crit damage', 'Warning promoted to error. Error promoted to violence.', { critMult: 0.15 }),
  C('keyboardShortcuts', 'Keyboard Shortcuts', 'uncommon', 'Movement', '⌨',
    '+9% movement speed, +4% cooldown reduction', 'Never touch the mouse. Never touch the ground.', { speed: 0.09, cooldown: 0.04 }),
  C('sandboxEnv', 'Sandbox Environment', 'uncommon', 'Shield', '🏖',
    '+20 shield, +10 max HP', 'Whatever happens in staging stays in staging.', { shield: 20, maxHp: 10 }),
  C('pairProgramming', 'Pair Programming', 'uncommon', 'Projectiles', '🧑‍🤝‍🧑',
    '+1 projectile, -4% damage', 'Two keyboards. One bug tracker. Constant judgment.', { projectiles: 1, damage: -0.04 }),
  C('scopeCreep', 'Scope Creep', 'uncommon', 'Area', '🐙',
    '+14% effect area, -3% movement speed', 'The feature grew. The deadline did not move. Neither do you.', { area: 0.14, speed: -0.03 }),

  // ---- Rare ----
  // (rares stack ×3, epics ×2 — default-5 stacking on the high tiers was the
  //  "stupidly strong" outlier: e.g. 5× Compiler Blessing = +150% dmg +40% CDR)
  C('depInjection', 'Dependency Injection', 'rare', 'Projectiles', '💉',
    '+1 projectile', 'Your weapons now receive violence from a container.', { projectiles: 1 }, 2),
  C('rubberDuck', 'Rubber Duck Insight', 'rare', 'Luck', '🦆',
    '+1 luck, +10% XP', 'You explained the problem. The duck suggested murder.', { luck: 1, xpGain: 0.1 }, 3),
  C('garbageDay', 'Garbage Collector Tuning', 'rare', 'Damage', '🗑',
    '+18% damage', 'Aggressive collection. Generational. Personal.', { damage: 0.18 }, 3),
  C('segShield', 'Segmentation Shield', 'rare', 'Armor', '🧱',
    '+3 armor, +20 max HP', 'SIGSEGV? Sig-blocked.', { armor: 3, maxHp: 20 }, 3),
  C('breakpointTrap', 'Breakpoint Trap', 'rare', 'Attack Speed', '🔴',
    '+12% cooldown reduction', 'Execution pauses. Yours does not.', { cooldown: 0.12 }, 3),
  C('profiler', 'Profiler Flamegraph', 'rare', 'Crit', '🔥',
    '+8% crit chance, +25% crit damage', 'Found the hot path. It leads through their ribs.', { critChance: 0.08, critMult: 0.25 }, 3),
  C('observability', 'Observability Stack', 'rare', 'Pickup', '📡',
    '+45 pickup radius', 'You can now see — and yoink — everything.', { pickupRadius: 45 }, 3),
  C('fuzzTester', 'Fuzz Tester', 'rare', 'Crit', '🎰',
    '+7% crit chance, +20% crit damage', 'Random inputs. Predictable casualties.', { critChance: 0.07, critMult: 0.2 }, 3),
  C('defenseInDepth', 'Defense in Depth', 'rare', 'Shield', '🧅',
    '+25 shield, +2 armor', 'Layers. It is always layers.', { shield: 25, armor: 2 }, 3),

  // ---- Epic ----
  C('compilerBlessing', 'Compiler Blessing', 'epic', 'Damage', '✨',
    '+25% damage, +8% cooldown reduction', '-O3 -funroll-bugs -march=violence', { damage: 0.25, cooldown: 0.08 }, 2),
  C('raceCondition', 'Race Condition', 'epic', 'Attack Speed', '🏁',
    '+16% cooldown reduction, +8% move speed', 'Your attacks now arrive before they are fired.', { cooldown: 0.16, speed: 0.08 }, 2),
  C('infiniteLoopCard', 'Infinite Loop', 'epic', 'Projectiles', '♾',
    '+2 projectiles, -12% damage', 'while(true) { fire(); } // TODO: fix later', { projectiles: 2, damage: -0.12 }, 2),
  C('mergeConflictCard', 'Merge Conflict', 'epic', 'Chaos', '⚔',
    '+40% damage, -25 max HP', 'Take both changes. Resolve nothing.', { damage: 0.4, maxHp: -25 }, 2),
  C('zeroDowntime', 'Zero-Downtime Deploy', 'epic', 'Health', '🟢',
    '+50 max HP, +1.5 HP/s regen', 'Five nines of you remain available.', { maxHp: 50, regen: 1.5 }, 2),
  C('grepMastery', 'Grep Mastery', 'epic', 'Luck', '🔍',
    '+2 luck', 'You always find what you are looking for. It cannot hide.', { luck: 2 }, 2),
  C('microservices', 'Microservices', 'epic', 'Projectiles', '📦',
    '+2 projectiles, -8% effect area', 'Split the monolith. Spray the pieces.', { projectiles: 2, area: -0.08 }, 2),
  C('techDebt', 'Tech Debt', 'epic', 'XP', '💳',
    '+30% XP gain, -8% damage', 'Borrow now. Pay later. Later is mid-boss.', { xpGain: 0.3, damage: -0.08 }, 2),

  // ---- Legendary ----
  C('rootAccess', 'Root Access', 'legendary', 'Damage', '👑',
    '+50% damage, +10% crit chance', 'sudo rm -rf /bugs --no-preserve-anything', { damage: 0.5, critChance: 0.1 }, 1),
  C('quantumBuild', 'Quantum Build Server', 'legendary', 'Attack Speed', '⚛',
    '+30% cooldown reduction, +1 projectile', 'Compiles all branches simultaneously. All of them hit.', { cooldown: 0.3, projectiles: 1 }, 1),
  C('tenXDeveloper', 'The 10x Developer', 'legendary', 'Everything', '🚀',
    '+10% to damage, speed, area, XP and cooldown', 'Mythical. Caffeinated. Real, briefly: you.', { damage: 0.1, speed: 0.1, area: 0.1, xpGain: 0.1, cooldown: 0.1 }, 1),
  C('pairProgrammer', 'AI Pair Programmer', 'legendary', 'Survivability', '🤖',
    '+60 max HP, +3 armor, +2 HP/s regen', 'It hallucinates a world where you cannot die.', { maxHp: 60, armor: 3, regen: 2 }, 1),
];

export const CARD_BY_ID: Record<string, UpgradeCard> =
  Object.fromEntries(UPGRADE_CARDS.map((c) => [c.id, c]));
