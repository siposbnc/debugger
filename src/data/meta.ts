import type { MetaUpgradeDef } from './types';

// Permanent upgrades bought with Bits. cost(level) = baseCost * costGrowth^level.

export const META_UPGRADES: MetaUpgradeDef[] = [
  {
    id: 'hp', name: 'Hardened Hardware', icon: '❤',
    desc: '+10 starting max HP per level.',
    maxLevel: 5, baseCost: 60, costGrowth: 1.6,
    modsPerLevel: { maxHp: 10 },
  },
  {
    id: 'damage', name: 'Sharper Semicolons', icon: '🗡',
    desc: '+5% damage per level.',
    maxLevel: 5, baseCost: 80, costGrowth: 1.6,
    modsPerLevel: { damage: 0.05 },
  },
  {
    id: 'speed', name: 'Mechanical Keyboard', icon: '👟',
    desc: '+4% movement speed per level.',
    maxLevel: 4, baseCost: 70, costGrowth: 1.6,
    modsPerLevel: { speed: 0.04 },
  },
  {
    id: 'pickup', name: 'Wider Monitor', icon: '🧲',
    desc: '+15 pickup radius per level.',
    maxLevel: 4, baseCost: 50, costGrowth: 1.55,
    modsPerLevel: { pickupRadius: 15 },
  },
  {
    id: 'xp', name: 'Documentation Reader', icon: '📚',
    desc: '+6% XP gain per level.',
    maxLevel: 5, baseCost: 70, costGrowth: 1.6,
    modsPerLevel: { xpGain: 0.06 },
  },
  {
    id: 'regen', name: 'Standing Desk', icon: '💆',
    desc: '+0.4 HP/s regeneration per level.',
    maxLevel: 3, baseCost: 90, costGrowth: 1.7,
    modsPerLevel: { regen: 0.4 },
  },
  {
    id: 'armor', name: 'Rubber Keyboard Cover', icon: '🛡',
    desc: '+1 armor per level.',
    maxLevel: 3, baseCost: 100, costGrowth: 1.8,
    modsPerLevel: { armor: 1 },
  },
  {
    id: 'luck', name: 'Lucky Commit Hash', icon: '🍀',
    desc: '+1 luck per level (better card rarities).',
    maxLevel: 3, baseCost: 120, costGrowth: 1.9,
    modsPerLevel: { luck: 1 },
  },
  {
    id: 'reroll', name: 'Second Opinion', icon: '🎲',
    desc: '+1 card reroll per run, per level.',
    maxLevel: 3, baseCost: 110, costGrowth: 1.8,
    modsPerLevel: { rerolls: 1 },
  },
  {
    id: 'banish', name: 'Code Review Veto', icon: '🚫',
    desc: '+1 card banish per run, per level (remove a card from the run pool).',
    maxLevel: 3, baseCost: 110, costGrowth: 1.8,
    modsPerLevel: { banishes: 1 },
  },
  {
    id: 'skip', name: 'Snooze Notification', icon: '⏭',
    desc: '+1 level-up skip per run, per level.',
    maxLevel: 2, baseCost: 60, costGrowth: 1.8,
    modsPerLevel: { skips: 1 },
  },
  {
    id: 'weaponSlot', name: 'Extra Dev Environment', icon: '🧰',
    desc: '+1 weapon slot (4 → 5).',
    maxLevel: 1, baseCost: 800, costGrowth: 1,
    special: 'weaponSlot',
  },
  {
    id: 'bossReward', name: 'Bug Bounty Program', icon: '💰',
    desc: '+25% Bits from bosses per level.',
    maxLevel: 3, baseCost: 150, costGrowth: 1.7,
    special: 'bossReward',
  },
];

export const META_BY_ID: Record<string, MetaUpgradeDef> =
  Object.fromEntries(META_UPGRADES.map((m) => [m.id, m]));

export function metaCost(def: MetaUpgradeDef, currentLevel: number): number {
  return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel));
}
