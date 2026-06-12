// Headless balance/system verification: runs a full game run in Node.
// Bundled with esbuild (no DOM access in game logic). The default "bot" is
// invincible and drifts toward chests so reward flow can be observed.
//
//   npx esbuild scripts/simulate.ts --bundle --platform=node --outfile=scripts/simulate.cjs
//   node scripts/simulate.cjs [characterId] [mapId] [maxMinutes] [--scenario=<name|path>]
//
// --scenario starts the run from a preconfigured mid-run state (build, level,
// clock, bot behavior) instead of fresh — for bug reports and specific builds.
// A bare name resolves to scripts/scenarios/<name>.json; schema + injection
// live in src/game/scenario.ts. Positional args override scenario fields.
//
// Bot behavior (auto-pick, chests, movement) lives in simBot.ts, shared with matrix.ts.

import { readFileSync } from 'node:fs';
import { Run } from '../src/game/run';
import { CHARACTERS } from '../src/data/characters';
import { MAPS } from '../src/data/maps';
import { DEFAULT_WEAPON_POOL } from '../src/data/weapons';
import { formatTime } from '../src/core/util';
import { createScenarioRun, type Scenario } from '../src/game/scenario';
import { STEP, botStep, DEFAULT_BOT, type BotOptions } from './simBot';

const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const scenarioArg = flags.find((f) => f.startsWith('--scenario='))?.slice(11);
let scenario: Scenario | null = null;
if (scenarioArg) {
  const path = /[\\/.]/.test(scenarioArg) ? scenarioArg : `scripts/scenarios/${scenarioArg}.json`;
  scenario = JSON.parse(readFileSync(path, 'utf-8')) as Scenario;
  if (pos[0]) scenario.char = pos[0];
  if (pos[1]) scenario.map = pos[1];
  if (pos[2]) scenario.maxMinutes = Number(pos[2]);
}

const charId = scenario?.char ?? pos[0] ?? 'ada';
const mapId = scenario?.map ?? pos[1] ?? 'greenfield';
const maxMinutes = scenario?.maxMinutes ?? Number(pos[2] ?? 15);
const bot: BotOptions = scenario?.bot
  ? { ...DEFAULT_BOT, ...scenario.bot }
  : DEFAULT_BOT;

console.log(`=== simulating ${charId} on ${mapId} (${maxMinutes} min cap) ===`);
// Balance-sim policy (user 2026-06-12): sims run terrain-free (see matrix.ts).
const NO_TERRAIN = { noTerrain: true };
let run: Run;
if (scenario) {
  run = createScenarioRun(scenario, NO_TERRAIN);
  console.log(`scenario: ${scenario.name ?? scenarioArg}`);
  console.log(`  start: lv ${run.level}, ${formatTime(run.time)}, bot ${bot.mortal ? 'mortal' : 'invincible'}/${bot.pick}`);
  console.log(`  weapons: ${run.weapons.map((w) => `${w.def.id}:${w.level}`).join(', ')}`);
  if (run.takenCards.size > 0) {
    console.log(`  cards: ${[...run.takenCards.entries()].map(([id, n]) => `${id}×${n}`).join(', ')}`);
  }
} else {
  run = new Run(CHARACTERS[charId], MAPS[mapId], {},
    [...new Set([...DEFAULT_WEAPON_POOL, CHARACTERS[charId].weapon])], new Set(), NO_TERRAIN);
}
run.invincible = !bot.mortal;

let lastLogMin = -1;
let damageTaken = 0;
const originalHurt = run.hurtPlayer.bind(run);
run.hurtPlayer = (amount: number) => { damageTaken += amount; originalHurt(amount); };

// crunchT > 0: crunch-time overtime runs past the minute cap until it resolves
// (victory, death, or the release slipping) — at most CRUNCH_DURATION seconds.
while (!run.over && (run.time < maxMinutes * 60 || run.crunchT > 0)) {
  run.update(STEP);

  const chestCard = botStep(run, bot);
  if (chestCard) console.log(`  [${formatTime(run.time)}] chest bonus card: ${chestCard}`);

  for (const ev of run.events) {
    if (ev.type === 'bossSpawn') console.log(`  [${formatTime(run.time)}] BOSS SPAWN: ${ev.name}`);
    if (ev.type === 'bossDie') console.log(`  [${formatTime(run.time)}] BOSS DOWN:  ${ev.name}`);
    if (ev.type === 'evolve') console.log(`  [${formatTime(run.time)}] EVOLVED: ${ev.weaponName} → ${ev.evolvedName}`);
    if (ev.type === 'objective') console.log(`  [${formatTime(run.time)}] OBJECTIVE: ${ev.name}`);
    if (ev.type === 'crunch') console.log(`  [${formatTime(run.time)}] CRUNCH TIME: release blockers alive at ship date — 30s overtime`);
  }
  run.events.length = 0;

  const min = Math.floor(run.time / 60);
  if (min !== lastLogMin) {
    lastLogMin = min;
    console.log(
      `${formatTime(run.time).padStart(5)} | lv ${String(run.level).padStart(2)} | kills ${String(run.kills).padStart(5)} | ` +
      `alive ${String(run.enemies.length).padStart(3)} | dmg taken ${Math.round(damageTaken).toString().padStart(5)} | ` +
      `weapons ${run.weapons.map((w) => `${w.def.id}:${w.level}${w.def.isEvolution ? '*' : ''}`).join(', ')}`,
    );
  }
}

const results = run.computeBits();
console.log('\n=== RUN COMPLETE ===');
console.log(`victory: ${results.victory}${run.releaseFailed ? ' (RELEASE SLIPPED: blocker outlived crunch time)' : ''}, time: ${formatTime(results.timeSec)}`);
console.log(`kills: ${results.kills}, level: ${results.level}, bosses: ${results.bossKills}`);
console.log(`objectives: ${results.newObjectives.join(', ')}`);
for (const b of results.bitsBreakdown) console.log(`  ${b.label}: +${b.value}`);
console.log(`TOTAL BITS: ${results.bits}`);
console.log(`total damage taken (would-be): ${Math.round(damageTaken)} vs pool ~${Math.round(run.stats.maxHp)} HP`);
console.log('damage by weapon:');
for (const w of run.weapons) {
  const dps = w.totalDamage / Math.max(1, run.time - w.acquiredAt);
  console.log(`  ${w.def.name.padEnd(22)} lv ${w.level}${w.def.isEvolution ? '*' : ' '} ${Math.round(w.totalDamage).toString().padStart(8)} (${Math.round(dps)}/s)`);
}
if (run.allyDamage > 0) console.log(`  ${'(allies)'.padEnd(22)}      ${Math.round(run.allyDamage).toString().padStart(8)}`);
