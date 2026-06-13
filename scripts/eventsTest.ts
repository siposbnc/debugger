// In-run field events (src/game/events.ts): noTerrain gating, spawn cadence
// and distance band, nest hatch + kill bounty, terminal stand-to-repair,
// ignore-despawn, crunch feature-freeze, and suspend/resume drop semantics.
//
//   npx esbuild scripts/eventsTest.ts --bundle --platform=node --outfile=scripts/eventsTest.cjs
//   node scripts/eventsTest.cjs

import { Run, type RunEvent } from '../src/game/run';
import {
  spawnFieldEvent, EVENT_FIRST_AT, EVENT_INTERVAL, EVENT_JITTER, EVENT_LIFE,
  EVENT_DIST_MIN, EVENT_DIST_MAX, NEST_HATCH_INTERVAL, TERMINAL_RADIUS, TERMINAL_REPAIR_TIME,
} from '../src/game/events';
import { snapshotRun, restoreRun } from '../src/game/runSave';
import { CHARACTERS } from '../src/data/characters';
import { MAPS } from '../src/data/maps';
import { DEFAULT_WEAPON_POOL } from '../src/data/weapons';

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}

const STEP = 1 / 60;
function freshRun(noTerrain = false): Run {
  const run = new Run(CHARACTERS.ada, MAPS.greenfield, {},
    [...new Set([...DEFAULT_WEAPON_POOL, CHARACTERS.ada.weapon])], new Set(),
    noTerrain ? { noTerrain: true } : {});
  run.invincible = true;
  return run;
}
function step(run: Run, log: RunEvent[]): void {
  run.update(STEP);
  log.push(...run.events);
  run.events.length = 0;
  run.pendingLevelUps = 0;
}
const chestCount = (run: Run) => run.pickups.filter((p) => p.kind === 'chest').length;

// --- 1. noTerrain (balance-sim policy): events never run ---
{
  const run = freshRun(true);
  const log: RunEvent[] = [];
  for (let t = 0; t < (EVENT_FIRST_AT + 30) * 60; t++) step(run, log);
  check('noTerrain: no event by first-spawn time + 30s',
    run.fieldEvent === null && !log.some((e) => e.type === 'eventSpawn'),
    `t=${run.time.toFixed(0)}s`);
}

// --- 2. natural spawn: cadence + distance band ---
{
  const run = freshRun();
  const log: RunEvent[] = [];
  for (let t = 0; t < (EVENT_FIRST_AT + 5) * 60 && !run.fieldEvent; t++) step(run, log);
  const spawn = log.find((e) => e.type === 'eventSpawn');
  check('first event spawns at the scheduled time', !!run.fieldEvent && !!spawn,
    `t=${run.time.toFixed(1)}s (expected ~${EVENT_FIRST_AT}s)`);
  const ev = run.fieldEvent!;
  const d = Math.hypot(ev.x - run.px, ev.y - run.py);
  check('spawns inside the distance band', d >= EVENT_DIST_MIN - 1 && d <= EVENT_DIST_MAX + 1,
    `d=${d.toFixed(0)} (band ${EVENT_DIST_MIN}–${EVENT_DIST_MAX})`);

  // --- 3. ignored events despawn unrewarded and re-arm the clock ---
  const chestsBefore = chestCount(run);
  for (let t = 0; t < (EVENT_LIFE + 2) * 60 && run.fieldEvent; t++) step(run, log);
  check('ignored event expires after EVENT_LIFE', run.fieldEvent === null
    && log.some((e) => e.type === 'eventExpired'));
  check('expiry pays nothing', chestCount(run) === chestsBefore
    && !log.some((e) => e.type === 'eventDone'));
  check('no nest left behind after expiry', !run.enemies.some((e) => e.def.id === 'bugNest'));
  const expected = run.time + EVENT_INTERVAL;
  check('next event re-armed ~EVENT_INTERVAL out',
    Number.isFinite(run.eventAt) && Math.abs(run.eventAt - expected) <= EVENT_JITTER + 2,
    `eventAt=${run.eventAt.toFixed(0)}s vs ~${expected.toFixed(0)}s`);
}

// --- 4. bug nest: hatches while standing, kill pays kill + bounty chest ---
{
  const run = freshRun();
  const log: RunEvent[] = [];
  step(run, log); // settle one frame
  spawnFieldEvent(run, 'nest');
  const nest = run.fieldEvent!.nest!;
  check('nest is a live enemy on the field', run.enemies.includes(nest) && nest.hp > 0);

  // with the spawner muted, the only additions are hatchlings — but the
  // player's weapon still kills strays, so count additions as Δalive + Δkills
  const before = run.enemies.length, killsBefore = run.kills;
  for (let t = 0; t < (NEST_HATCH_INTERVAL * 3 + 1) * 60; t++) {
    run.spawnTimer = 999; // mute the regular spawner
    step(run, log);
  }
  const hatched = (run.enemies.length - before) + (run.kills - killsBefore);
  check('nest hatches ~1 bug per interval', hatched >= 2 && hatched <= 4, `+${hatched} in 3 intervals`);

  const kills = run.kills, chests = chestCount(run);
  run.hitEnemy(nest, 1e9, { noCrit: true });
  step(run, log);
  check('killing the nest resolves the event', run.fieldEvent === null
    && log.some((e) => e.type === 'eventDone' && e.kind === 'nest'));
  check('nest kill pays kill credit + bounty chest',
    run.kills === kills + 1 && chestCount(run) === chests + 1);
}

// --- 5. hung terminal: stand in the ring to reboot ---
{
  const run = freshRun();
  const log: RunEvent[] = [];
  step(run, log);
  spawnFieldEvent(run, 'terminal');
  const ev = run.fieldEvent!;

  // out of range: no progress accrues
  for (let t = 0; t < 60; t++) step(run, log);
  check('no reboot progress from afar', ev.progress === 0);

  // park inside the ring (recycling tracks prevP, so pin both)
  run.px = ev.x + TERMINAL_RADIUS * 0.3; run.py = ev.y;
  run.prevPx = run.px; run.prevPy = run.py;
  let frames = 0;
  for (; frames < (TERMINAL_REPAIR_TIME + 2) * 60 && run.fieldEvent; frames++) step(run, log);
  check('reboot completes after ~TERMINAL_REPAIR_TIME in range',
    run.fieldEvent === null && log.some((e) => e.type === 'eventDone' && e.kind === 'terminal'),
    `${(frames / 60).toFixed(1)}s`);
  check('terminal pays a bounty chest', chestCount(run) >= 1);
}

// --- 6. crunch feature-freeze: no new events in overtime ---
{
  const run = freshRun();
  const log: RunEvent[] = [];
  run.crunchStarted = true;
  run.eventAt = 0.05;
  for (let t = 0; t < 120; t++) step(run, log);
  check('crunch: no new events spawn', run.fieldEvent === null
    && !log.some((e) => e.type === 'eventSpawn'));
}

// --- 7. suspend/resume: live event dropped, clock re-armed, no orphan nest ---
{
  const run = freshRun();
  const log: RunEvent[] = [];
  step(run, log);
  spawnFieldEvent(run, 'nest');
  const snap = snapshotRun(run, 'test');
  check('snapshot drops the nest entity', !snap.enemies.some((e) => e.defId === 'bugNest'));
  const restored = restoreRun(snap, new Set());
  check('resume: no live event, clock re-armed nearby',
    restored.fieldEvent === null && Number.isFinite(restored.eventAt)
    && restored.eventAt > restored.time && restored.eventAt < restored.time + EVENT_INTERVAL,
    `eventAt=${restored.eventAt.toFixed(1)}s @ time=${restored.time.toFixed(1)}s`);
}

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
