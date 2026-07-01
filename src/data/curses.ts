import type { CurseDef } from './types';

// Curses — pre-run difficulty toggles (map select, revealed after the first
// victory). Each adds a Bits pay bonus; stacking allowed. Balance is
// curse-scoped: the baseline sims never enable them, exactly like Endless.
// The timed pair (Malfunction, Kernel Lock) punishes on a telegraphed rhythm
// rather than a flat tax — banner + windup, never a silent gotcha. The same
// effects are designed to be boss/affix-inflictable later (ROADMAP).

export const CURSES: Record<string, CurseDef> = {
  technicalDebt: {
    id: 'technicalDebt', name: 'Technical Debt', icon: '🧾',
    desc: 'Enemies have +35% HP.',
    flavor: 'Every shortcut you ever took, with compound interest.',
    bitsBonus: 0.25,
    enemyHpMult: 1.35,
  },
  scopeCreep: {
    id: 'scopeCreep', name: 'Scope Creep', icon: '📈',
    desc: 'Enemies spawn 25% more often.',
    flavor: 'Just one more small feature. And another. And another.',
    bitsBonus: 0.25,
    spawnIntervalMult: 0.8,
  },
  moveFast: {
    id: 'moveFast', name: 'Move Fast', icon: '🏎️',
    desc: 'Enemies are 20% faster.',
    flavor: 'And break things. The things are you.',
    bitsBonus: 0.2,
    enemySpeedMult: 1.2,
  },
  deprecatedDrivers: {
    id: 'deprecatedDrivers', name: 'Deprecated Drivers', icon: '🧲',
    desc: '−25% pickup radius.',
    flavor: 'The magnet peripheral lost vendor support years ago.',
    bitsBonus: 0.15,
    pickupRadiusMult: 0.75,
  },
  staleCoffee: {
    id: 'staleCoffee', name: 'Stale Coffee', icon: '☕',
    desc: 'All healing is halved.',
    flavor: 'Brewed last sprint. Technically still coffee.',
    bitsBonus: 0.2,
    healMult: 0.5,
  },
  malfunction: {
    id: 'malfunction', name: 'Malfunction', icon: '🔀',
    desc: 'Every ~40s your movement reverses for 4s (telegraphed).',
    flavor: 'The input handler swaps sign intermittently. Cannot reproduce.',
    bitsBonus: 0.35,
    timed: { kind: 'reverse', period: 40, duration: 4, warn: 3 },
  },
  kernelLock: {
    id: 'kernelLock', name: 'Kernel Lock', icon: '🔒',
    desc: 'Every ~90s your weapons lock up for 15s (telegraphed).',
    flavor: 'The kernel takes the global interrupt lock. Everything waits. Run.',
    bitsBonus: 0.4,
    timed: { kind: 'weaponLock', period: 90, duration: 15, warn: 3 },
  },
};

export const CURSE_LIST = Object.values(CURSES);
