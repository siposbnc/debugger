// Credits — the in-run currency (v0.4). Dropped by field events and elites,
// spent at the Package Registry terminal that comes online after each boss.
// A third economy beside Bits (meta, persists) and XP (leveling): unspent
// credits expire with the process. Effects are KEYED ENUMS handled in
// game/run.ts (buyRegistryItem) — this file stays pure data.

export const CREDITS = {
  /** credits paid out by a resolved field event (+ creditAmount meta) */
  eventDrop: 3,
  /** base chance an elite kill drops credits */
  eliteChance: 0.3,
  /** + chance per 'creditRate' meta level */
  eliteChancePerRate: 0.15,
  /** credits per elite drop (+ creditAmount meta) */
  eliteDrop: 1,
  /** registry terminal lifetime on the field (s) */
  registryLife: 60,
  /** walk-within range that opens the registry (world units) */
  registryRadius: 70,
  /** timed-buff strength + duration per purchase */
  dmgBuffMult: 1.25,
  speedBuffMult: 1.2,
  buffDuration: 60,
} as const;

export type RegistryEffect = 'heal' | 'magnet' | 'reroll' | 'banish' | 'dmgBuff' | 'speedBuff';

export interface RegistryItemDef {
  id: string;
  name: string;
  icon: string;
  desc: string;     // mechanical, literal
  cost: number;     // credits
  effect: RegistryEffect;
}

export const REGISTRY_ITEMS: RegistryItemDef[] = [
  {
    id: 'hotfix', name: 'Hotfix Patch', icon: '🩹',
    desc: 'Restores 50% of max HP instantly.',
    cost: 4, effect: 'heal',
  },
  {
    id: 'gcSweep', name: 'Garbage Collect', icon: '🧹',
    desc: 'Pulls every XP shard on the field to you.',
    cost: 3, effect: 'magnet',
  },
  {
    id: 'spareCi', name: 'Spare CI Run', icon: '🎲',
    desc: '+1 card reroll for this run.',
    cost: 2, effect: 'reroll',
  },
  {
    id: 'emergencyVeto', name: 'Emergency Veto', icon: '🚫',
    desc: '+1 card banish for this run.',
    cost: 2, effect: 'banish',
  },
  {
    id: 'overclock', name: 'Overclock', icon: '⚡',
    desc: `+25% damage for ${CREDITS.buffDuration}s (stacks duration).`,
    cost: 3, effect: 'dmgBuff',
  },
  {
    id: 'hotReload', name: 'Hot Reload', icon: '💨',
    desc: `+20% move speed for ${CREDITS.buffDuration}s (stacks duration).`,
    cost: 2, effect: 'speedBuff',
  },
];

export const REGISTRY_BY_ID: Record<string, RegistryItemDef> =
  Object.fromEntries(REGISTRY_ITEMS.map((it) => [it.id, it]));
