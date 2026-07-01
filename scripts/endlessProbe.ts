// Endless overtime collapse probe: how long does a run survive past the 8:00
// workday? The design promise is that EVERY endless run ends (overtimeMult's
// exponential term) — this measures where, for tuning the ramp.
//
//   npx esbuild scripts/endlessProbe.ts --bundle --platform=node --outfile=scripts/endlessProbe.cjs
//   node scripts/endlessProbe.cjs [samples=4] [charId=ada] [mapId=greenfield] [--meta=max]
//
// Mortal greedy bot (the competent-player proxy). Terrain-free like all
// balance sims. Hard-capped at 60 minutes: if the bot is still alive there,
// the ramp is too soft — that's a finding, not a hang.

import { Run } from '../src/game/run';
import { CHARACTERS } from '../src/data/characters';
import { MAPS, WORKDAY_DURATION } from '../src/data/maps';
import { DEFAULT_WEAPON_POOL } from '../src/data/weapons';
import { META_UPGRADES } from '../src/data/meta';
import { formatTime } from '../src/core/util';
import { STEP, botStep } from './simBot';

const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const samples = Number(pos[0] ?? 4);
const charId = pos[1] ?? 'ada';
const mapId = pos[2] ?? 'greenfield';
const metaLevels: Record<string, number> = flags.includes('--meta=max')
  ? Object.fromEntries(META_UPGRADES.map((m) => [m.id, m.maxLevel]))
  : {};

const CAP_MIN = 60;
const deaths: number[] = [];
for (let i = 0; i < samples; i++) {
  const run = new Run(CHARACTERS[charId], MAPS[mapId], metaLevels,
    [...new Set([...DEFAULT_WEAPON_POOL, CHARACTERS[charId].weapon])], new Set(),
    { noTerrain: true, endless: true });
  while (!run.over && run.time < CAP_MIN * 60) {
    run.update(STEP);
    botStep(run, { pick: 'greedy', mortal: true });
    run.events.length = 0;
  }
  const banked = run.banked;
  const bits = run.computeBits().bits;
  deaths.push(run.time);
  console.log(`run ${i + 1}: ${run.over ? 'died' : 'ALIVE AT CAP'} at ${formatTime(run.time)}`
    + ` (overtime ${banked ? '+' + formatTime(Math.max(0, run.time - WORKDAY_DURATION)) : 'not reached'},`
    + ` lv ${run.level}, ${bits} bits)`);
}
deaths.sort((a, b) => a - b);
const med = deaths[Math.floor(deaths.length / 2)];
console.log(`\nmedian end: ${formatTime(med)} (workday 8:00 + ${formatTime(Math.max(0, med - WORKDAY_DURATION))} overtime)`);
