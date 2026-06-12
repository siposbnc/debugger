// The Precipitate (easter egg, src/game/run.ts updateMushi): scheduling odds,
// spawn-ring entry, Brownian wander, 23s evaporation, touch-collection rewards
// (chest + 602 XP + 23 Bits + objective) and suspend/resume round-trip.
//
//   npx esbuild scripts/mushiTest.ts --bundle --platform=node --outfile=scripts/mushiTest.cjs
//   node scripts/mushiTest.cjs

import { Run, MUSHI_CHANCE, MUSHI_LIFE, MUSHI_XP, MUSHI_BITS, type RunEvent } from '../src/game/run';
import { snapshotRun, restoreRun, type SuspendedRun } from '../src/game/runSave';
import { CHARACTERS } from '../src/data/characters';
import { MAPS } from '../src/data/maps';
import { DEFAULT_WEAPON_POOL } from '../src/data/weapons';

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}

const STEP = 1 / 60;
function freshRun(): Run {
  const run = new Run(CHARACTERS.ada, MAPS.greenfield, {},
    [...new Set([...DEFAULT_WEAPON_POOL, CHARACTERS.ada.weapon])], new Set());
  run.invincible = true;
  return run;
}
/** Step one frame, collecting events (drained like main.ts does). */
function step(run: Run, log: RunEvent[]): void {
  run.update(STEP);
  log.push(...run.events);
  run.events.length = 0;
  run.pendingLevelUps = 0;
}

// --- 1. scheduling odds ≈ MUSHI_CHANCE ---
{
  let scheduled = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) {
    if (Number.isFinite(new Run(CHARACTERS.ada, MAPS.greenfield, {}, ['syntaxWand'], new Set()).mushiAt)) scheduled++;
  }
  const rate = scheduled / N;
  check('schedule rate ≈ 25%', Math.abs(rate - MUSHI_CHANCE) < 0.03, `${(rate * 100).toFixed(1)}%`);
}

// --- 2. spawn on the ring + Brownian wander + evaporation ---
{
  const run = freshRun();
  run.mushiAt = 1;
  const log: RunEvent[] = [];
  for (let t = 0; t < 90 && !run.mushi; t++) step(run, log);
  check('precipitates at the scheduled time', run.mushi !== null, `t=${run.time.toFixed(2)}`);
  check('mushiSpawn event emitted', log.some((e) => e.type === 'mushiSpawn'));
  const m = run.mushi!;
  const d0 = Math.hypot(m.x - run.px, m.y - run.py);
  check('enters on the spawn ring', d0 > 650 && d0 < 900, `d=${d0.toFixed(0)}`);

  const x0 = m.x, y0 = m.y;
  for (let t = 0; t < 5 * 60 && run.mushi; t++) step(run, log);
  check('wanders (Brownian motion)', run.mushi !== null
    && Math.hypot(run.mushi.x - x0, run.mushi.y - y0) > 20,
    run.mushi ? `moved ${Math.hypot(run.mushi.x - x0, run.mushi.y - y0).toFixed(0)}u in 5s` : 'gone early');

  const chestsBefore = run.pickups.filter((p) => p.kind === 'chest').length;
  for (let t = 0; t < (MUSHI_LIFE + 2) * 60 && run.mushi; t++) step(run, log);
  check('evaporates after its lifetime', run.mushi === null, `t=${run.time.toFixed(1)}`);
  check('mushiGone event emitted', log.some((e) => e.type === 'mushiGone'));
  check('uncaught gives nothing', !run.mushiCaught
    && run.pickups.filter((p) => p.kind === 'chest').length === chestsBefore);
  check('no objective when uncaught', !run.objectivesThisRun.includes('mushiCatch'));
}

// --- 3. collection by touch ---
{
  const run = freshRun();
  run.mushiAt = 1;
  const log: RunEvent[] = [];
  for (let t = 0; t < 90 && !run.mushi; t++) step(run, log);
  check('precondition: present', run.mushi !== null);

  // suspend round-trip with it active, before catching
  const snap: SuspendedRun = JSON.parse(JSON.stringify(snapshotRun(run)));
  const r2 = restoreRun(snap, new Set());
  check('suspend keeps it alive', r2.mushi !== null
    && Math.abs(r2.mushi!.t - run.mushi!.t) < 1e-9
    && r2.mushi!.x === run.mushi!.x && r2.mushiAt === Infinity && !r2.mushiCaught);
  const legacy = { ...snap } as Partial<SuspendedRun>;
  delete legacy.mushi; delete legacy.mushiAt; delete legacy.mushiCaught;
  const r3 = restoreRun(legacy as SuspendedRun, new Set());
  check('pre-Precipitate snapshot restores clean', r3.mushi === null && r3.mushiAt === Infinity && !r3.mushiCaught);

  // walk into it
  run.px = run.mushi!.x; run.py = run.mushi!.y;
  step(run, log);
  check('collected by touch', run.mushi === null && run.mushiCaught);
  check('mushiCaught event emitted', log.some((e) => e.type === 'mushiCaught'));
  check('drops a chest (no boss tier)', run.pickups.some((p) => p.kind === 'chest' && p.bossTier === undefined));
  const shards = run.pickups.filter((p) => p.kind === 'xp' && Math.abs(p.value - MUSHI_XP / 7) < 1e-9);
  check('drops 602 XP in 7 shards', shards.length === 7,
    `${shards.length} × ${(MUSHI_XP / 7).toFixed(1)}`);
  check('statsView reports it', run.statsView().mushiCaught);
  const sample = run.computeBits().bitsBreakdown.find((b) => b.label === 'Field sample resolved');
  check(`+${MUSHI_BITS} Bits breakdown line`, sample !== undefined && sample.value === MUSHI_BITS);

  for (let t = 0; t < 90; t++) step(run, log); // objective tick is 1 Hz
  check('"Cabal of Two" objective fires', run.objectivesThisRun.includes('mushiCatch'));

  // caught state survives suspend
  const snap2: SuspendedRun = JSON.parse(JSON.stringify(snapshotRun(run)));
  const r4 = restoreRun(snap2, new Set());
  check('caught flag survives suspend', r4.mushiCaught && r4.mushi === null && r4.mushiAt === Infinity);
}

// --- 4. unscheduled runs stay clean ---
{
  const run = freshRun();
  run.mushiAt = Infinity;
  const log: RunEvent[] = [];
  for (let t = 0; t < 30 * 60; t++) step(run, log);
  check('Infinity schedule: never appears', run.mushi === null
    && !log.some((e) => e.type === 'mushiSpawn'));
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
