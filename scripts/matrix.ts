// Balance matrix: every character × every map, N samples each, 15 min headless.
// Records per-minute kill rate vs spawn rate (spawns derived as Δkills + Δalive —
// exact for all sources incl. duplicators/splits), first-boss TTK, and run results,
// then checks them against docs/BALANCE.md.
//
//   npx esbuild scripts/matrix.ts --bundle --platform=node --outfile=scripts/matrix.cjs
//   node scripts/matrix.cjs [samples=5] [maxMinutes=15] [charId]

import { Run } from '../src/game/run';
import { CHARACTERS } from '../src/data/characters';
import { MAPS } from '../src/data/maps';
import { DEFAULT_WEAPON_POOL } from '../src/data/weapons';
import { MAX_ENEMIES } from '../src/data/enemies';
import { STEP, botStep } from './simBot';

const samples = Number(process.argv[2] ?? 5);
const maxMinutes = Number(process.argv[3] ?? 15);
const charFilter = process.argv[4]; // optional: limit to one character

interface Sample {
  bits: number; level: number; bossKills: number; victory: boolean;
  killsAt: number[]; aliveAt: number[]; levelAt: number[]; // index = whole minute
  firstBossTTK: number | null; // s from first spawn to first boss death (null = never)
}

function simulateOne(charId: string, mapId: string): Sample {
  const run = new Run(CHARACTERS[charId], MAPS[mapId], {},
    [...new Set([...DEFAULT_WEAPON_POOL, CHARACTERS[charId].weapon])], new Set());
  run.invincible = true;

  const killsAt = [0], aliveAt = [0], levelAt = [1];
  let firstSpawnT: number | null = null, firstDieT: number | null = null;
  let lastMin = 0;

  while (!run.over && run.time < maxMinutes * 60) {
    run.update(STEP);
    botStep(run);
    for (const ev of run.events) {
      if (ev.type === 'bossSpawn' && firstSpawnT === null) firstSpawnT = run.time;
      if (ev.type === 'bossDie' && firstDieT === null) firstDieT = run.time;
    }
    run.events.length = 0;
    const min = Math.floor(run.time / 60);
    if (min !== lastMin) {
      lastMin = min;
      killsAt[min] = run.kills; aliveAt[min] = run.enemies.length; levelAt[min] = run.level;
    }
  }
  const r = run.computeBits();
  return {
    bits: r.bits, level: r.level, bossKills: r.bossKills, victory: r.victory,
    killsAt, aliveAt, levelAt,
    firstBossTTK: firstSpawnT !== null && firstDieT !== null ? firstDieT - firstSpawnT : null,
  };
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const fmtList = (xs: (number | null)[], unit = '') =>
  xs.map((x) => (x === null ? '—' : `${Math.round(x)}${unit}`)).join(',');

interface Flag { config: string; msg: string }
const flags: Flag[] = [];

for (const charId of Object.keys(CHARACTERS).filter((c) => !charFilter || c === charFilter)) {
  for (const mapId of Object.keys(MAPS)) {
    const config = `${charId} × ${mapId}`;
    const runs: Sample[] = [];
    for (let i = 0; i < samples; i++) runs.push(simulateOne(charId, mapId));

    const bits = runs.map((r) => r.bits);
    const bosses = runs.map((r) => r.bossKills);
    const ttks = runs.map((r) => r.firstBossTTK);
    const zeroBoss = bosses.filter((b) => b === 0).length;

    // pacing: minute where kill rate first falls behind spawn rate for good
    // (alive count growing) and whether alive pins at the enemy cap by 6:00
    const pinned = runs.filter((r) =>
      r.aliveAt.slice(0, 7).some((a) => a >= MAX_ENEMIES - 10)).length;
    const aliveMed = [2, 3, 4, 5, 6].map((m) => median(runs.map((r) => r.aliveAt[m] ?? 0)));
    const lvMed = [5, 10, 15].map((m) => median(runs.map((r) => r.levelAt[Math.min(m, r.levelAt.length - 1)] ?? 0)));

    console.log(`\n=== ${config}  (${samples} samples) ===`);
    console.log(`bits    min/med/max: ${Math.min(...bits)}/${median(bits)}/${Math.max(...bits)}   victories: ${runs.filter((r) => r.victory).length}/${samples}`);
    console.log(`bosses  per sample: ${fmtList(bosses)}   first-boss TTK: ${fmtList(ttks, 's')}  (— = never killed; >120s = bosses stacked)`);
    console.log(`alive   median @2:00..6:00: ${aliveMed.join(' / ')}   pinned at cap ≤6:00: ${pinned}/${samples}`);
    console.log(`level   median @5/10/15min: ${lvMed.join(' / ')}`);

    // --- checks vs docs/BALANCE.md ---
    if (pinned > 0)
      flags.push({ config, msg: `kill rate < spawn rate before 6:00 (alive pinned at cap in ${pinned}/${samples} samples)` });
    const ttkKilled = ttks.filter((t): t is number => t !== null);
    if (ttkKilled.length && median(ttkKilled) > 100)
      flags.push({ config, msg: `first-boss TTK median ${Math.round(median(ttkKilled))}s (target 60–100s)` });
    if (zeroBoss * 2 >= samples)
      flags.push({ config, msg: `0 bosses killed in ${zeroBoss}/${samples} samples (red flag per BALANCE.md §5)` });
    if (lvMed[2] < 20)
      flags.push({ config, msg: `median level ${lvMed[2]} at 15:00 (provisional target ≥20)` });
  }
}

console.log('\n=== VERDICT ===');
if (flags.length === 0) {
  console.log('all configs within BALANCE.md targets');
} else {
  for (const f of flags) console.log(`FLAG  ${f.config}: ${f.msg}`);
}
