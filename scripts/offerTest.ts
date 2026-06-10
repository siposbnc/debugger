// Quick distribution check on level-up offers.
import { Run } from '../src/game/run';
import { makeOffer } from '../src/game/levelup';
import { CHARACTERS } from '../src/data/characters';
import { MAPS } from '../src/data/maps';
import { DEFAULT_WEAPON_POOL } from '../src/data/weapons';

const run = new Run(CHARACTERS.ada, MAPS.greenfield, {}, [...DEFAULT_WEAPON_POOL], new Set());
run.addWeapon('deployHammer');
run.addWeapon('assertBlades');

const counts: Record<string, number> = {};
for (let i = 0; i < 3000; i++) {
  const offer = makeOffer(run);
  const first = offer[0];
  counts[first.kind] = (counts[first.kind] ?? 0) + 1;
}
console.log('offer[0] kind distribution over 3000 samples (3 weapons owned):');
console.log(counts);
