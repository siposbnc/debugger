// Endless mode ("Normal Work Hours & overtime") — the 8:00 bank (victory
// banks, run continues, one workday event), no 15:00 ship date, exponential
// overtime scaling on enemies AND bosses, the overtime Bits/credit reward
// ramp, boss-pool reshuffle (unique finale joins the overtime pool), death
// semantics (banked victory survives an overtime death; a pre-bank death is
// still a plain loss), suspend/resume, and normal-run non-interference.
//
//   npx esbuild scripts/endlessTest.ts --bundle --platform=node --outfile=scripts/endlessTest.cjs
//   node scripts/endlessTest.cjs

import { Run, type RunEvent, OVERTIME_BITS_PER_MIN } from '../src/game/run';
import { makeEnemy, updateSpawner } from '../src/game/spawner';
import { updateBossSchedule, spawnBoss } from '../src/game/bossLogic';
import { snapshotRun, restoreRun } from '../src/game/runSave';
import { CHARACTERS } from '../src/data/characters';
import { MAPS, RUN_DURATION, WORKDAY_DURATION } from '../src/data/maps';
import { ENEMIES, overtimeMult } from '../src/data/enemies';
import { BOSSES } from '../src/data/bosses';
import { DEFAULT_WEAPON_POOL } from '../src/data/weapons';

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}

const STEP = 1 / 60;
function freshRun(endless: boolean): Run {
  const run = new Run(CHARACTERS.ada, MAPS.greenfield, {},
    [...new Set([...DEFAULT_WEAPON_POOL, CHARACTERS.ada.weapon])], new Set(),
    endless ? { endless: true, noTerrain: true } : { noTerrain: true });
  run.invincible = true;
  return run;
}
function step(run: Run, log: RunEvent[]): void {
  run.update(STEP);
  log.push(...run.events);
  run.events.length = 0;
  run.pendingLevelUps = 0;
}

// --- 1. the 8:00 bank: victory banks, the run continues, one workday event ---
{
  const run = freshRun(true);
  const log: RunEvent[] = [];
  run.time = WORKDAY_DURATION - 2 * STEP;
  for (let i = 0; i < 10; i++) step(run, log);
  const workdays = log.filter((e) => e.type === 'workday').length;
  const victories = log.filter((e) => e.type === 'victory').length;
  check('workday event fires exactly once at 8:00', workdays === 1, `${workdays}`);
  check('no victory event at the bank (the run is not over)', victories === 0, `${victories}`);
  check('victory banked', run.banked && run.victory, `banked=${run.banked} victory=${run.victory}`);
  check('run continues past the bank', !run.over);
}

// --- 2. no 15:00 ship date in endless: no crunch, no victory-finish ---
{
  const run = freshRun(true);
  const log: RunEvent[] = [];
  run.time = RUN_DURATION - 2 * STEP;
  run.banked = true; run.victory = true; // as if banked at 8:00
  for (let i = 0; i < 10; i++) step(run, log);
  check('endless run does not end at 15:00', !run.over && !run.crunchStarted,
    `over=${run.over} crunch=${run.crunchStarted}`);
}

// --- 3. normal runs untouched: victory at 15:00, no banking field effects ---
{
  const run = freshRun(false);
  const log: RunEvent[] = [];
  run.time = WORKDAY_DURATION - 2 * STEP;
  for (let i = 0; i < 10; i++) step(run, log);
  check('normal run does not bank at 8:00', !run.banked && !run.victory && log.every((e) => e.type !== 'workday'));
  run.time = RUN_DURATION - 2 * STEP;
  run.enemies.length = 0;              // no blockers → clean victory
  run.nextBossAt = run.time + 999;     // keep the scheduler from spawning one mid-test
  for (let i = 0; i < 10 && !run.over; i++) step(run, log);
  check('normal run still wins at 15:00', run.over && run.victory && log.some((e) => e.type === 'victory'));
  check('normal-run results carry no overtime', run.computeBits().overtimeSec === 0 && !run.computeBits().endless);
}

// --- 4. overtime scaling: enemies and bosses gain the exponential term ---
{
  const otMin = 10;
  const normal = freshRun(false);
  const endless = freshRun(true);
  normal.time = endless.time = WORKDAY_DURATION + otMin * 60;
  endless.banked = true;
  const def = ENEMIES.syntaxMite;
  const eN = makeEnemy(normal, def, 0, 0, false);
  const eE = makeEnemy(endless, def, 0, 0, false);
  const expected = overtimeMult(otMin);
  check(`overtime enemy hp ×${expected.toFixed(2)} at +${otMin}m`,
    Math.abs(eE.hp / eN.hp - expected) < 0.01, `${(eE.hp / eN.hp).toFixed(3)}`);
  check('overtime enemy damage scales the same',
    Math.abs((eE.scaledDamage ?? 0) / (eN.scaledDamage ?? 1) - expected) < 0.01);
  const bossDef = BOSSES[MAPS.greenfield.uniqueBoss];
  spawnBoss(normal, bossDef, 6);
  spawnBoss(endless, bossDef, 6);
  const bN = normal.enemies.find((e) => e.isBoss)!;
  const bE = endless.enemies.find((e) => e.isBoss)!;
  check('overtime boss hp scales too', Math.abs(bE.hp / bN.hp - expected) < 0.01,
    `${(bE.hp / bN.hp).toFixed(3)}`);
  check('pre-8:00 endless has no overtime term', freshRun(true).overtimeMinutes() === 0);
}

// --- 5. overtime rewards: the Bits line + the credit/reward multiplier ---
{
  const run = freshRun(true);
  run.banked = true; run.victory = true;
  run.time = WORKDAY_DURATION + 5 * 60;
  run.kills = 500; // give the formula something to multiply
  const results = run.computeBits();
  const otLine = results.bitsBreakdown.find((b) => b.label.startsWith('Overtime'));
  check('bits breakdown gains an overtime line', !!otLine && otLine.value > 0, `${otLine?.value}`);
  check('results report endless + overtime seconds',
    results.endless && Math.abs(results.overtimeSec - 300) < 1, `${results.overtimeSec}`);
  const expectedMult = 1 + OVERTIME_BITS_PER_MIN * 5;
  check('reward multiplier ramps with the overtime minute',
    Math.abs(run.overtimeRewardMult() - expectedMult) < 1e-9, `${run.overtimeRewardMult()}`);
  check('normal runs have reward multiplier 1', freshRun(false).overtimeRewardMult() === 1);
}

// --- 6. death semantics: banked survives, pre-bank does not ---
{
  const run = freshRun(true);
  run.banked = true; run.victory = true;
  run.time = WORKDAY_DURATION + 60;
  run.invincible = false;
  run.hurtPlayer(99999);
  check('overtime death keeps the banked victory', run.over && run.victory);
  check('overtime death is not a release slip', !run.releaseFailed);
}
{
  const run = freshRun(true);
  run.time = 200; // pre-bank
  run.invincible = false;
  run.hurtPlayer(99999);
  check('pre-bank endless death is a plain loss', run.over && !run.victory);
}

// --- 7. overtime boss reshuffle: pool + unique finale, no fixed slots ---
{
  const run = freshRun(true);
  run.banked = true;
  run.time = WORKDAY_DURATION + 30;
  run.bossIndex = 5; // the slot that is the fixed unique finale in normal runs
  run.nextBossAt = run.time + 60; // future: schedule only draws, never spawns
  const drawn = new Set<string>();
  for (let i = 0; i < 300; i++) {
    run.nextBossId = null;
    run.bossWarned = true; // silence warnings
    updateBossSchedule(run, 0);
    drawn.add(run.nextBossId!);
    run.lastBossId = null;
  }
  const poolIds = Object.keys(MAPS.greenfield.bossPool);
  check('overtime draws include the unique finale', drawn.has(MAPS.greenfield.uniqueBoss),
    [...drawn].join(','));
  check('overtime draws include standard bosses', poolIds.some((id) => drawn.has(id)));
  check('overtime slot is not FIXED to the unique (reshuffled)', drawn.size > 1);
}

// --- 8. overtime spawning continues (no feature freeze in endless) ---
{
  const run = freshRun(true);
  run.banked = true; run.victory = true;
  run.time = RUN_DURATION + 120; // deep past the normal ship date
  run.spawnTimer = 0;
  const before = run.enemies.length;
  updateSpawner(run, STEP);
  check('spawner keeps spawning deep into overtime', run.enemies.length > before,
    `${before} → ${run.enemies.length}`);
}

// --- 9. suspend/resume carries endless + banked ---
{
  const run = freshRun(true);
  run.banked = true; run.victory = true;
  run.time = WORKDAY_DURATION + 90;
  const snap = snapshotRun(run);
  const restored = restoreRun(JSON.parse(JSON.stringify(snap)), new Set());
  check('resume keeps endless mode', restored.endless);
  check('resume keeps the banked victory', restored.banked && restored.victory);
  const normalSnap = snapshotRun(freshRun(false));
  check('normal-run snapshots restore non-endless',
    !restoreRun(JSON.parse(JSON.stringify(normalSnap)), new Set()).endless);
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
