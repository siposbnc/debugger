import { UPGRADE_CARDS, CARD_BY_ID } from '../data/upgrades';
import { WEAPONS, MAX_WEAPON_LEVEL } from '../data/weapons';
import { RARITY_COLOR, type Rarity, type UpgradeCard } from '../data/types';
import { weightedIndex } from '../core/util';
import type { Run } from './run';

// Level-up offers: 3 picks drawn from weapon cards (new / level-up) and stat
// cards, rarity-weighted with luck shifting weight toward higher tiers.

export interface OfferItem {
  kind: 'newWeapon' | 'weaponUp' | 'card';
  id: string;             // weapon id or card id
  name: string;
  icon: string;
  color: string;          // rarity color (cards) or weapon color
  rarityLabel: string;
  tagline: string;        // "NEW WEAPON" / "Level 3 → 4" / category
  desc: string;
  flavor: string;
  banishable: boolean;
}

const RARITY_BASE: Record<Rarity, number> = {
  common: 50, uncommon: 28, rare: 13, epic: 5, legendary: 1.4,
};

// RARITY_BASE values are per-TIER rates (≈% of a card slot at luck 0). Each
// tier's weight is split across its currently-available cards, then scaled so
// the stat-card block keeps the same total weight vs weapon offers as before.
const STAT_BLOCK_SCALE = 3.85;

// Repeat-pick penalty (offer variety): every copy of a stat card already
// taken multiplies its weight by REPEAT_DECAY, floored at REPEAT_FLOOR of
// base so a build piece never quite vanishes. Weapon level-ups decay more
// gently per level — they must stay findable to reach max level + evolution.
const REPEAT_DECAY = 0.55;
const REPEAT_FLOOR = 0.08;
const WEAPON_LEVEL_DECAY = 0.85;

function rarityWeight(rarity: Rarity, luck: number): number {
  const base = RARITY_BASE[rarity];
  switch (rarity) {
    case 'common': return base / (1 + 0.18 * luck);
    case 'uncommon': return base;
    case 'rare': return base * (1 + 0.2 * luck);
    case 'epic': return base * (1 + 0.32 * luck);
    case 'legendary': return base * (1 + 0.5 * luck);
  }
}

interface Candidate {
  item: OfferItem;
  weight: number;
}

function candidates(run: Run, minRarity?: Rarity): Candidate[] {
  const out: Candidate[] = [];
  const rarityFloor: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
  const floor = minRarity ? rarityFloor[minRarity] : 0;

  // Weapon level-ups — weighted heavily so builds actually scale
  for (const w of run.weapons) {
    if (w.def.isEvolution || w.level >= MAX_WEAPON_LEVEL) continue;
    if (floor > 1) continue; // chest bonuses give stat cards, not weapon levels
    out.push({
      weight: 70 * Math.pow(WEAPON_LEVEL_DECAY, w.level),
      item: {
        kind: 'weaponUp', id: w.def.id, name: w.def.name, icon: w.def.icon,
        color: w.def.color, rarityLabel: 'WEAPON',
        tagline: `Level ${w.level} → ${w.level + 1}`,
        desc: w.def.desc, flavor: w.def.flavor, banishable: false,
      },
    });
  }

  // New weapons (if a slot is free)
  if (run.weapons.length < run.stats.weaponSlots && floor === 0) {
    const owned = new Set(run.weapons.map((w) => w.def.id));
    for (const id of run.weaponPool) {
      if (owned.has(id)) continue;
      const def = WEAPONS[id];
      // An evolved instance carries the evolution's id, not the base weapon's —
      // don't re-offer the base while its evolution is owned.
      if (def.evolveTo && owned.has(def.evolveTo)) continue;
      out.push({
        weight: 30,
        item: {
          kind: 'newWeapon', id, name: def.name, icon: def.icon,
          color: def.color, rarityLabel: 'NEW WEAPON',
          tagline: 'Adds a weapon slot attack',
          desc: def.desc, flavor: def.flavor, banishable: false,
        },
      });
    }
  }

  // Stat cards — tier weight divided by the tier's available-card count, so
  // tier rates match RARITY_BASE regardless of pool size/banishes/max stacks.
  const available = UPGRADE_CARDS.filter((card) =>
    !run.banished.has(card.id) &&
    rarityFloor[card.rarity] >= floor &&
    (run.takenCards.get(card.id) ?? 0) < (card.maxStacks ?? 5));
  const tierCount = new Map<Rarity, number>();
  for (const card of available) tierCount.set(card.rarity, (tierCount.get(card.rarity) ?? 0) + 1);
  for (const card of available) {
    const base = STAT_BLOCK_SCALE * rarityWeight(card.rarity, run.stats.luck) / tierCount.get(card.rarity)!;
    const picks = run.takenCards.get(card.id) ?? 0;
    out.push({
      weight: base * Math.max(Math.pow(REPEAT_DECAY, picks), REPEAT_FLOOR),
      item: {
        kind: 'card', id: card.id, name: card.name, icon: card.icon,
        color: RARITY_COLOR[card.rarity], rarityLabel: card.rarity.toUpperCase(),
        tagline: card.category,
        desc: card.desc, flavor: card.flavor, banishable: true,
      },
    });
  }
  return out;
}

/** Per-slot offer probabilities (first draw): weapon cards + each stat-card tier. */
export interface OfferOdds {
  weapon: number;
  tiers: Record<Rarity, number>;
}

export function offerOdds(run: Run): OfferOdds {
  const pool = candidates(run);
  const odds: OfferOdds = {
    weapon: 0,
    tiers: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
  };
  const total = pool.reduce((a, c) => a + c.weight, 0);
  if (total <= 0) return odds;
  for (const c of pool) {
    if (c.item.kind === 'card') odds.tiers[CARD_BY_ID[c.item.id].rarity] += c.weight / total;
    else odds.weapon += c.weight / total;
  }
  return odds;
}

export function makeOffer(run: Run, count = 3, minRarity?: Rarity): OfferItem[] {
  const pool = candidates(run, minRarity);
  const offer: OfferItem[] = [];
  while (offer.length < count && pool.length > 0) {
    const idx = weightedIndex(pool.map((c) => c.weight));
    offer.push(pool[idx].item);
    pool.splice(idx, 1);
  }
  return offer;
}

export function applyOffer(run: Run, item: OfferItem): void {
  if (item.kind === 'newWeapon') {
    run.addWeapon(item.id);
  } else if (item.kind === 'weaponUp') {
    const w = run.weapons.find((x) => x.def.id === item.id);
    if (w) w.level = Math.min(MAX_WEAPON_LEVEL, w.level + 1);
  } else {
    const card = CARD_BY_ID[item.id];
    if (card) run.applyCard(card);
  }
}

/** Boss chest with no evolution available: auto-grant a random rare+ card. */
export function grantChestCard(run: Run): UpgradeCard | null {
  const offer = makeOffer(run, 1, 'rare');
  if (offer.length === 0 || offer[0].kind !== 'card') return null;
  const card = CARD_BY_ID[offer[0].id];
  run.applyCard(card);
  return card;
}
