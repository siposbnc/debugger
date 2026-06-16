// Credits — the in-run currency (v0.4). Dropped by field events and elites,
// spent at the Package Registry terminal that comes online after each boss.
// A third economy beside Bits (meta, persists) and XP (leveling): unspent
// credits expire with the process. Effects are KEYED ENUMS handled in
// game/run.ts (buyRegistryItem) — this file stays pure data.

import type { Rarity, StatMods } from './types';
import { RARITY_ORDER } from './types';

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

export type RegistryEffect = 'heal' | 'magnet' | 'reroll' | 'banish' | 'dmgBuff' | 'speedBuff'
  | 'randomStat'; // opens a 3-option stat-upgrade pick (resolved by the UI)

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
    id: 'randomStat', name: 'Lint Pass', icon: '✨',
    desc: 'Offers 3 random stat upgrades — pick one. Small boosts; buy it repeatedly.',
    cost: 3, effect: 'randomStat',
  },
  {
    id: 'hotfix', name: 'Hotfix Patch', icon: '🩹',
    desc: 'Restores all HP and recharges shield to full.',
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

// ---------- Lint Pass: random stat-upgrade offers ----------
// One purchase rolls 3 options at independent rarities; the player keeps one.
// Magnitudes are deliberately SMALL (a few % each) — these are meant to be
// collected over many registries, not a single power spike. Indices map to
// RARITY_ORDER (0 common … 4 legendary).

/** A generated, pickable stat upgrade (not a card — applied as a raw boost). */
export interface StatBoost {
  stat: keyof StatMods;
  name: string;
  icon: string;
  rarity: Rarity;
  mods: StatMods;
  desc: string;
}

interface BoostTemplate {
  stat: keyof StatMods;
  name: string;
  icon: string;
  mag: [number, number, number, number, number]; // per rarity
  fmt: (v: number) => string;
}

const pctFmt = (label: string) => (v: number) => `+${Math.round(v * 100)}% ${label}`;

const BOOST_TEMPLATES: BoostTemplate[] = [
  { stat: 'damage', name: 'Tighter Loops', icon: '🗡', mag: [0.02, 0.03, 0.04, 0.06, 0.08], fmt: pctFmt('damage') },
  { stat: 'maxHp', name: 'Bigger Heap', icon: '❤', mag: [4, 6, 9, 13, 18], fmt: (v) => `+${v} max HP` },
  { stat: 'speed', name: 'Lower Latency', icon: '👟', mag: [0.01, 0.02, 0.03, 0.04, 0.05], fmt: pctFmt('move speed') },
  { stat: 'cooldown', name: 'Async I/O', icon: '⏱', mag: [0.02, 0.03, 0.04, 0.05, 0.06], fmt: (v) => `−${Math.round(v * 100)}% cooldown` },
  { stat: 'area', name: 'Wider Scope', icon: '◎', mag: [0.02, 0.03, 0.04, 0.06, 0.08], fmt: pctFmt('area') },
  { stat: 'critChance', name: 'Edge Cases', icon: '🎯', mag: [0.01, 0.02, 0.03, 0.04, 0.06], fmt: pctFmt('crit chance') },
  { stat: 'pickupRadius', name: 'Eager Fetch', icon: '🧲', mag: [4, 6, 9, 13, 18], fmt: (v) => `+${v} pickup radius` },
  { stat: 'xpGain', name: 'Verbose Logs', icon: '📚', mag: [0.02, 0.03, 0.04, 0.06, 0.08], fmt: pctFmt('XP gain') },
  { stat: 'regen', name: 'Self-Healing', icon: '💆', mag: [0.1, 0.15, 0.2, 0.3, 0.4], fmt: (v) => `+${v.toFixed(2)} HP/s` },
];

const RARITY_WEIGHTS = [50, 28, 14, 6, 2];

function rollRarity(luck: number): number {
  // luck nudges weight toward higher tiers (each point favors rarer rolls)
  const w = RARITY_WEIGHTS.map((x, i) => Math.max(0, x + luck * i * 1.5 - (i === 0 ? luck * 3 : 0)));
  const total = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < w.length; i++) if ((r -= w[i]) < 0) return i;
  return 0;
}

/** Roll 3 distinct stat upgrades for the Lint Pass picker (DOM-free). */
export function rollStatBoosts(luck: number): StatBoost[] {
  const pool = [...BOOST_TEMPLATES];
  const out: StatBoost[] = [];
  for (let n = 0; n < 3 && pool.length > 0; n++) {
    const t = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const ri = rollRarity(luck);
    out.push({
      stat: t.stat, name: t.name, icon: t.icon,
      rarity: RARITY_ORDER[ri], mods: { [t.stat]: t.mag[ri] }, desc: t.fmt(t.mag[ri]),
    });
  }
  return out;
}
