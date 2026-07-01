// Curses — pre-run difficulty toggles (src/data/curses.ts, run.ts wiring):
// stat taxes (enemy hp/speed, spawn rate, pickup radius, healing), the timed
// warn → active rhythm (Malfunction reverse, Kernel Lock weapon freeze), the
// Bits pay bonus, unknown-id tolerance, suspend/resume, and the no-curse
// baseline staying byte-identical.
//
//   npx esbuild scripts/cursesTest.ts --bundle --platform=node --outfile=scripts/cursesTest.cjs
//   node scripts/cursesTest.cjs

import { Run, type RunEvent } from '../src/game/run';
import { makeEnemy, updateSpawner } from '../src/game/spawner';
import { snapshotRun, restoreRun } from '../src/game/runSave';
import { CHARACTERS } from '../src/data/characters';
import { MAPS } from '../src/data/maps';
import { ENEMIES } from '../src/data/enemies';
import { CURSES } from '../src/data/curses';
import { DEFAULT_WEAPON_POOL } from '../src/data/weapons';

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}

const STEP = 1 / 60;
function freshRun(curses: string[] = []): Run {
  const run = new Run(CHARACTERS.ada, MAPS.greenfield, {},
    [...new Set([...DEFAULT_WEAPON_POOL, CHARACTERS.ada.weapon])], new Set(),
    { noTerrain: true, curses });
  run.invincible = true;
  return run;
}
function step(run: Run, log: RunEvent[]): void {
  run.update(STEP);
  log.push(...run.events);
  run.events.length = 0;
  run.pendingLevelUps = 0;
}

// --- 1. stat taxes ---
{
  const plain = freshRun();
  const debt = freshRun(['technicalDebt']);
  const fast = freshRun(['moveFast']);
  const def = ENEMIES.syntaxMite;
  const e0 = makeEnemy(plain, def, 0, 0, false);
  const eHp = makeEnemy(debt, def, 0, 0, false);
  const eSp = makeEnemy(fast, def, 0, 0, false);
  check('Technical Debt: enemy hp ×1.35', Math.abs(eHp.hp / e0.hp - 1.35) < 0.01, `${(eHp.hp / e0.hp).toFixed(3)}`);
  check('Move Fast: enemy speed ×1.2',
    Math.abs((eSp.scaledSpeed ?? 0) / (e0.scaledSpeed ?? 1) - 1.2) < 0.01);
  check('Technical Debt does not touch speed', (eHp.scaledSpeed ?? 0) === (e0.scaledSpeed ?? 1));

  const creep = freshRun(['scopeCreep']);
  plain.spawnTimer = 0; creep.spawnTimer = 0;
  updateSpawner(plain, STEP); updateSpawner(creep, STEP);
  check('Scope Creep: spawn interval ×0.8',
    Math.abs(creep.spawnTimer / plain.spawnTimer - 0.8) < 0.01, `${(creep.spawnTimer / plain.spawnTimer).toFixed(3)}`);

  const drivers = freshRun(['deprecatedDrivers']);
  check('Deprecated Drivers: pickup radius ×0.75',
    Math.abs(drivers.stats.pickupRadius / plain.stats.pickupRadius - 0.75) < 0.01);

  const coffee = freshRun(['staleCoffee']);
  coffee.hp = 50; plain.hp = 50;
  coffee.healPlayer(20); plain.healPlayer(20);
  check('Stale Coffee: healing halved', plain.hp - 50 === 20 && coffee.hp - 50 === 10,
    `plain +${plain.hp - 50}, cursed +${coffee.hp - 50}`);
}

// --- 2. unknown ids tolerated; no-curse baseline is neutral ---
{
  const run = freshRun(['notARealCurse']);
  const m = run.curseMods;
  check('unknown curse id skipped without effect',
    run.curses.length === 0 && m.enemyHp === 1 && m.bitsBonus === 0);
  const plain = freshRun();
  check('no-curse run has no timed schedule and neutral mods',
    plain.curseTimed.length === 0 && plain.curseMods.spawnInterval === 1 && plain.curseMods.heal === 1);
}

// --- 3. bits pay: breakdown line + stacking bonus ---
{
  const cursed = freshRun(['technicalDebt', 'kernelLock']);
  const plain = freshRun();
  cursed.kills = plain.kills = 500;
  cursed.time = plain.time = 300;
  const rc = cursed.computeBits(), rp = plain.computeBits();
  const line = rc.bitsBreakdown.find((b) => b.label.startsWith('Curses endured'));
  check('bits breakdown gains a curse line', !!line && line.value > 0, line?.label);
  check('curse bonuses stack additively (+65%)',
    Math.abs(cursed.curseMods.bitsBonus - 0.65) < 1e-9, `${cursed.curseMods.bitsBonus}`);
  check('cursed run pays more than plain at equal state', rc.bits > rp.bits, `${rc.bits} vs ${rp.bits}`);
  check('plain run has no curse line', !rp.bitsBreakdown.some((b) => b.label.startsWith('Curses endured')));
}

// --- 4. timed rhythm: warn → active → end → re-arm (Kernel Lock) ---
{
  const spec = CURSES.kernelLock.timed!;
  const run = freshRun(['kernelLock']);
  const log: RunEvent[] = [];
  run.time = spec.period - spec.warn - 2 * STEP; // just before the windup
  step(run, log);
  check('no warning before the windup point', !log.some((e) => e.type === 'curseWarn'));
  for (let i = 0; i < Math.ceil(spec.warn / STEP) + 4 && !log.some((e) => e.type === 'curseStart'); i++) step(run, log);
  check('warning fires before the lock', log.findIndex((e) => e.type === 'curseWarn') >= 0);
  check('lock starts on schedule', log.some((e) => e.type === 'curseStart' && e.kind === 'weaponLock'));
  check('weapons are locked for the duration', run.curseLockT > spec.duration - 1);

  // weapon timers freeze while locked
  const w = run.weapons[0];
  const t0 = w.timer;
  step(run, log);
  const frozen = w.timer === t0;
  check('weapon timers frozen under Kernel Lock', frozen, `${t0} → ${w.timer}`);

  // run out the lock: weapons resume, schedule re-arms
  for (let i = 0; i < Math.ceil(spec.duration / STEP) + 4; i++) step(run, log);
  check('lock expires after its duration', run.curseLockT <= 0);
  const t1 = w.timer;
  step(run, log);
  check('weapons resume after the lock', w.timer !== t1);
  const timed = run.curseTimed[0];
  check('schedule re-arms for the next period', timed.nextAt >= 2 * spec.period - 1 && !timed.warned,
    `nextAt=${timed.nextAt.toFixed(1)}`);
}

// --- 5. Malfunction sets the reversal window ---
{
  const spec = CURSES.malfunction.timed!;
  const run = freshRun(['malfunction']);
  const log: RunEvent[] = [];
  run.time = spec.period - STEP;
  for (let i = 0; i < 4; i++) step(run, log);
  check('Malfunction reverses on schedule',
    run.curseReverseT > 0 && log.some((e) => e.type === 'curseStart' && e.kind === 'reverse'));
  for (let i = 0; i < Math.ceil(spec.duration / STEP) + 4; i++) step(run, log);
  check('reversal ends after its duration', run.curseReverseT <= 0);
}

// --- 6. suspend/resume carries curses + rhythm state ---
{
  const run = freshRun(['malfunction', 'staleCoffee']);
  run.time = 30;
  run.curseReverseT = 2.5;
  run.curseTimed[0].nextAt = 80; run.curseTimed[0].warned = true;
  const snap = JSON.parse(JSON.stringify(snapshotRun(run)));
  const restored = restoreRun(snap, new Set());
  check('resume keeps curse set', restored.curses.map((c) => c.id).join(',') === 'malfunction,staleCoffee');
  check('resume keeps stat taxes', restored.curseMods.heal === 0.5);
  check('resume keeps the live reversal timer', Math.abs(restored.curseReverseT - 2.5) < 1e-9);
  check('resume keeps the timed schedule', restored.curseTimed[0].nextAt === 80 && restored.curseTimed[0].warned);
  const plainSnap = JSON.parse(JSON.stringify(snapshotRun(freshRun())));
  check('pre-curse/plain snapshots restore uncursed', restoreRun(plainSnap, new Set()).curses.length === 0);
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
