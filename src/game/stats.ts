import type { CharacterDef, StatMods } from '../data/types';
import { META_BY_ID } from '../data/meta';
import { clamp } from '../core/util';

// Resolved player stats: base + character + meta levels + in-run cards.

export interface ComputedStats {
  maxHp: number;
  regen: number;
  armor: number;
  moveSpeed: number;      // world units / s
  damageMult: number;
  cooldownFactor: number; // multiply weapon cooldowns by this (1 = no reduction)
  areaMult: number;
  projectiles: number;    // flat bonus count
  critChance: number;
  critMult: number;
  pickupRadius: number;
  xpMult: number;
  luck: number;
  rerolls: number;
  banishes: number;
  skips: number;
  weaponSlots: number;
  bossRewardMult: number;
  /** Max shield: a recharging layer that absorbs damage before HP (0 = none). */
  shieldMax: number;
}

const BASE: ComputedStats = {
  maxHp: 100, regen: 0, armor: 0, moveSpeed: 150,
  damageMult: 1, cooldownFactor: 1, areaMult: 1, projectiles: 0,
  critChance: 0.05, critMult: 1.5, pickupRadius: 55, xpMult: 1, luck: 0,
  rerolls: 0, banishes: 0, skips: 0, weaponSlots: 4, bossRewardMult: 1,
  shieldMax: 0,
};

export function computeStats(
  character: CharacterDef,
  metaLevels: Record<string, number>,
  cardMods: StatMods[],
): ComputedStats {
  const all: StatMods[] = [character.mods];

  for (const [id, lvl] of Object.entries(metaLevels)) {
    const def = META_BY_ID[id];
    if (!def || lvl <= 0) continue;
    if (def.modsPerLevel) {
      for (let i = 0; i < lvl; i++) all.push(def.modsPerLevel);
    }
  }
  all.push(...cardMods);

  let hp = 0, regen = 0, armor = 0, speed = 0, dmg = 0, cdr = 0, area = 0;
  let proj = 0, crit = 0, critM = 0, pickup = 0, xp = 0, luck = 0;
  let rerolls = 0, banishes = 0, skips = 0, shield = 0;

  for (const m of all) {
    hp += m.maxHp ?? 0; regen += m.regen ?? 0; armor += m.armor ?? 0;
    speed += m.speed ?? 0; dmg += m.damage ?? 0; cdr += m.cooldown ?? 0;
    area += m.area ?? 0; proj += m.projectiles ?? 0;
    crit += m.critChance ?? 0; critM += m.critMult ?? 0;
    pickup += m.pickupRadius ?? 0; xp += m.xpGain ?? 0; luck += m.luck ?? 0;
    rerolls += m.rerolls ?? 0; banishes += m.banishes ?? 0; skips += m.skips ?? 0;
    shield += m.shield ?? 0;
  }

  return {
    maxHp: Math.max(10, BASE.maxHp + hp),
    regen: BASE.regen + regen,
    armor: BASE.armor + armor,
    moveSpeed: BASE.moveSpeed * (1 + speed),
    damageMult: Math.max(0.1, BASE.damageMult + dmg),
    cooldownFactor: 1 - clamp(cdr, 0, 0.6),
    areaMult: Math.max(0.3, BASE.areaMult + area),
    projectiles: BASE.projectiles + Math.round(proj),
    critChance: clamp(BASE.critChance + crit, 0, 1),
    critMult: BASE.critMult + critM,
    pickupRadius: BASE.pickupRadius + pickup,
    xpMult: Math.max(0.1, BASE.xpMult + xp),
    luck: BASE.luck + luck,
    rerolls: BASE.rerolls + rerolls,
    banishes: BASE.banishes + banishes,
    skips: BASE.skips + skips,
    weaponSlots: BASE.weaponSlots + ((metaLevels['weaponSlot'] ?? 0) > 0 ? 1 : 0),
    bossRewardMult: BASE.bossRewardMult + 0.25 * (metaLevels['bossReward'] ?? 0),
    shieldMax: Math.max(0, BASE.shieldMax + shield),
  };
}
