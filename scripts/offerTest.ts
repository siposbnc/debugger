// Distribution checks on level-up offers.
//
// 1. Kind mix (weapon-up / new-weapon / stat-card) — informational.
// 2. Rarity rates among stat-card slots at luck 0 — asserted against
//    RARITY_BASE in levelup.ts (legendary ≈ 1.4% per card slot).
import { Run } from '../src/game/run';
import { makeOffer } from '../src/game/levelup';
import { CARD_BY_ID } from '../src/data/upgrades';
import { CHARACTERS } from '../src/data/characters';
import { MAPS } from '../src/data/maps';
import { DEFAULT_WEAPON_POOL } from '../src/data/weapons';

const run = new Run(CHARACTERS.ada, MAPS.greenfield, {}, [...DEFAULT_WEAPON_POOL], new Set());
run.addWeapon('deployHammer');
run.addWeapon('assertBlades');

const OFFERS = 10_000;
const kinds: Record<string, number> = {};
const rarities: Record<string, number> = {};
let cardSlots = 0;

for (let i = 0; i < OFFERS; i++) {
  for (const item of makeOffer(run)) {
    kinds[item.kind] = (kinds[item.kind] ?? 0) + 1;
    if (item.kind === 'card') {
      cardSlots++;
      const r = CARD_BY_ID[item.id].rarity;
      rarities[r] = (rarities[r] ?? 0) + 1;
    }
  }
}

console.log(`luck = ${run.stats.luck} (assertions assume 0)`);
console.log(`slot kind distribution over ${OFFERS} offers (3 weapons owned):`);
console.log(kinds);
console.log(`\nrarity rates among ${cardSlots} stat-card slots:`);
for (const [r, n] of Object.entries(rarities)) {
  console.log(`  ${r.padEnd(10)} ${((100 * n) / cardSlots).toFixed(2)}%`);
}

// Expected per-tier rates at luck 0 (RARITY_BASE normalized to 100%):
// common 51.3 / uncommon 28.7 / rare 13.3 / epic 5.1 / legendary 1.4.
// Tolerances allow for sampling noise + no-replacement draw distortion.
const expect: Record<string, [number, number]> = {
  common: [48, 55], uncommon: [26, 32], rare: [11, 16], epic: [4, 6.5], legendary: [1.0, 1.9],
};
let failed = false;
for (const [r, [lo, hi]] of Object.entries(expect)) {
  const pct = (100 * (rarities[r] ?? 0)) / cardSlots;
  if (pct < lo || pct > hi) {
    console.error(`FAIL: ${r} rate ${pct.toFixed(2)}% outside [${lo}, ${hi}]%`);
    failed = true;
  }
}
console.log(failed ? '\nRARITY CHECK FAILED' : '\nrarity check OK');
process.exit(failed ? 1 : 0);
