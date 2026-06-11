// Balance matrix: every character × every map, N samples each, 15 min headless.
// Records per-minute kill rate vs spawn rate (spawns derived as Δkills + Δalive —
// exact for all sources incl. duplicators/splits), first-boss TTK, and run results,
// then checks them against docs/BALANCE.md.
//
//   npx esbuild scripts/matrix.ts --bundle --platform=node --outfile=scripts/matrix.cjs
//   node scripts/matrix.cjs [samples=5] [maxMinutes=15] [charId] [--mortal] [--pick=first|greedy]
//   node scripts/matrix.cjs [samples] --scenario=<name|path> [--map=<id>] [--pick=...]
//
// Default is the invincible pacing bot (pick=first). --mortal turns death on and
// switches to survival kiting; combine with --pick=greedy for the competent-player
// proxy. Win-rate targets per strategy live in BALANCE.md.
//
// --scenario replaces the char × map sweep with N samples of one preconfigured
// mid-run state (see src/game/scenario.ts) — bot behavior comes from the
// scenario, overridable by --pick / --map (e.g. the build-quality A/B presets
// in scripts/scenarios/build-*.json, BALANCE.md §5).

import { readFileSync } from 'node:fs';
import { Run } from '../src/game/run';
import { CHARACTERS } from '../src/data/characters';
import { MAPS } from '../src/data/maps';
import { DEFAULT_WEAPON_POOL } from '../src/data/weapons';
import { MAX_ENEMIES } from '../src/data/enemies';
import { META_UPGRADES } from '../src/data/meta';
import { createScenarioRun, type Scenario } from '../src/game/scenario';
import { STEP, botStep, type BotOptions, type PickStrategy } from './simBot';

const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const samples = Number(pos[0] ?? 5);

const scenarioArg = flags.find((f) => f.startsWith('--scenario='))?.slice(11);
let scenario: Scenario | null = null;
if (scenarioArg) {
  const path = /[\\/.]/.test(scenarioArg) ? scenarioArg : `scripts/scenarios/${scenarioArg}.json`;
  scenario = JSON.parse(readFileSync(path, 'utf-8')) as Scenario;
  const mapOverride = flags.find((f) => f.startsWith('--map='))?.slice(6);
  if (mapOverride) scenario.map = mapOverride;
}

const maxMinutes = scenario?.maxMinutes ?? Number(pos[1] ?? 15);
const charFilter = pos[2]; // optional: limit to one character
const pickFlag = flags.find((f) => f.startsWith('--pick='))?.slice(7) as PickStrategy | undefined;
const mortal = scenario ? (scenario.bot?.mortal ?? false) : flags.includes('--mortal');
const pick: PickStrategy = pickFlag ?? scenario?.bot?.pick ?? 'first';
const metaMax = flags.includes('--meta=max'); // fully bought shop = end-of-progression power
const bot: BotOptions = { pick, mortal };
const metaLevels: Record<string, number> = metaMax
  ? Object.fromEntries(META_UPGRADES.map((m) => [m.id, m.maxLevel]))
  : {};

interface Sample {
  bits: number; level: number; bossKills: number; victory: boolean;
  deathAt: number | null; // seconds (mortal runs)
  killsAt: number[]; aliveAt: number[]; levelAt: number[]; // index = whole minute
  firstBossTTK: number | null; // s from first spawn to first boss death (null = never)
}

function simulateOne(charId: string, mapId: string): Sample {
  const run = scenario
    ? createScenarioRun(scenario)
    : new Run(CHARACTERS[charId], MAPS[mapId], metaLevels,
        [...new Set([...DEFAULT_WEAPON_POOL, CHARACTERS[charId].weapon])], new Set());
  run.invincible = !mortal;

  const killsAt = [0], aliveAt = [0], levelAt = [run.level];
  let firstSpawnT: number | null = null, firstDieT: number | null = null;
  let lastMin = Math.floor(run.time / 60);

  while (!run.over && run.time < maxMinutes * 60) {
    run.update(STEP);
    botStep(run, bot);
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
    deathAt: run.over && !run.victory ? run.time : null,
    killsAt, aliveAt, levelAt,
    firstBossTTK: firstSpawnT !== null && firstDieT !== null ? firstDieT - firstSpawnT : null,
  };
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const fmtList = (xs: (number | null)[], unit = '') =>
  xs.map((x) => (x === null ? '—' : `${Math.round(x)}${unit}`)).join(',');
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

interface Flag { config: string; msg: string }
const verdicts: Flag[] = [];

console.log(`bot: ${mortal ? 'MORTAL' : 'invincible'}, pick=${pick}, meta=${metaMax ? 'max' : 'zero'}`);
if (scenario) {
  console.log(`scenario: ${scenario.name ?? scenarioArg} — start lv ${scenario.level ?? 1} @ ${scenario.startMin ?? 0}:00`);
}

const configs: { charId: string; mapId: string }[] = scenario
  ? [{ charId: scenario.char ?? 'ada', mapId: scenario.map ?? 'greenfield' }]
  : Object.keys(CHARACTERS).filter((c) => !charFilter || c === charFilter)
      .flatMap((charId) => Object.keys(MAPS).map((mapId) => ({ charId, mapId })));

for (const { charId, mapId } of configs) {
  {
    const config = `${charId} × ${mapId}`;
    const runs: Sample[] = [];
    for (let i = 0; i < samples; i++) runs.push(simulateOne(charId, mapId));

    const bits = runs.map((r) => r.bits);
    const bosses = runs.map((r) => r.bossKills);
    const ttks = runs.map((r) => r.firstBossTTK);
    const wins = runs.filter((r) => r.victory).length;
    const zeroBoss = bosses.filter((b) => b === 0).length;
    const deaths = runs.map((r) => r.deathAt).filter((d): d is number => d !== null);

    const pinned = runs.filter((r) =>
      r.aliveAt.slice(0, 7).some((a) => a >= MAX_ENEMIES - 10)).length;
    const aliveMed = [2, 3, 4, 5, 6].map((m) => median(runs.map((r) => r.aliveAt[m] ?? 0)));
    const lvMed = [5, 10, 15].map((m) => median(runs.map((r) => r.levelAt[Math.min(m, r.levelAt.length - 1)] ?? 0)));

    console.log(`\n=== ${config}  (${samples} samples) ===`);
    console.log(`bits    min/med/max: ${Math.min(...bits)}/${median(bits)}/${Math.max(...bits)}   victories: ${wins}/${samples}${deaths.length ? `   deaths at: ${deaths.map(fmtTime).join(', ')}` : ''}`);
    console.log(`bosses  per sample: ${fmtList(bosses)}   first-boss TTK: ${fmtList(ttks, 's')}  (— = never killed; >120s = bosses stacked)`);
    console.log(`alive   median @2:00..6:00: ${aliveMed.join(' / ')}   pinned at cap ≤6:00: ${pinned}/${samples}`);
    console.log(`level   median @5/10/15min: ${lvMed.join(' / ')}`);

    // --- checks vs docs/BALANCE.md ---
    if (mortal || scenario) {
      // mortal/scenario runs measure difficulty: win-rate targets per strategy
      verdicts.push({ config, msg: `win rate ${wins}/${samples} (${scenario ? scenarioArg : pick})` });
      continue;
    }
    if (pinned > 0)
      verdicts.push({ config, msg: `FLAG kill rate < spawn rate before 6:00 (alive pinned at cap in ${pinned}/${samples} samples)` });
    const ttkKilled = ttks.filter((t): t is number => t !== null);
    if (ttkKilled.length && median(ttkKilled) > 100)
      verdicts.push({ config, msg: `FLAG first-boss TTK median ${Math.round(median(ttkKilled))}s (target 60–100s)` });
    if (zeroBoss * 2 >= samples)
      verdicts.push({ config, msg: `FLAG 0 bosses killed in ${zeroBoss}/${samples} samples (red flag per BALANCE.md §6)` });
    if (lvMed[2] < 20)
      verdicts.push({ config, msg: `FLAG median level ${lvMed[2]} at 15:00 (provisional target ≥20)` });
  }
}

console.log('\n=== VERDICT ===');
if (verdicts.length === 0) {
  console.log('all configs within BALANCE.md targets');
} else {
  for (const f of verdicts) console.log(`${f.config}: ${f.msg}`);
}
