// Credits — the in-run currency (src/data/registry.ts, run.ts wiring): event
// + elite drops, the post-boss Package Registry (spawn / prompt latch /
// expiry), buying items (affordability, effects, buffs), the first-credit
// meta reveal, noTerrain gating, and suspend/resume (wallet survives, live
// registry + buffs drop).
//
//   npx esbuild scripts/creditsTest.ts --bundle --platform=node --outfile=scripts/creditsTest.cjs
//   node scripts/creditsTest.cjs

import { Run, type RunEvent } from '../src/game/run';
import { spawnFieldEvent, EVENT_LIFE, TERMINAL_RADIUS, TERMINAL_REPAIR_TIME } from '../src/game/events';
import { spawnBoss } from '../src/game/bossLogic';
import { CREDITS, rollStatBoosts } from '../src/data/registry';
import { snapshotRun, restoreRun } from '../src/game/runSave';
import { CHARACTERS } from '../src/data/characters';
import { MAPS } from '../src/data/maps';
import { BOSSES } from '../src/data/bosses';
import { DEFAULT_WEAPON_POOL } from '../src/data/weapons';

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}

const STEP = 1 / 60;
function freshRun(meta: Record<string, number> = {}, noTerrain = false): Run {
  const run = new Run(CHARACTERS.ada, MAPS.greenfield, meta,
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
const creditPickups = (run: Run) => run.pickups.filter((p) => p.kind === 'credit');

// --- 1. resolving a field event drops a credit pickup (+ creditAmount meta) ---
{
  const run = freshRun();
  const log: RunEvent[] = [];
  step(run, log);
  spawnFieldEvent(run, 'terminal');
  const ev = run.fieldEvent!;
  run.px = ev.x; run.py = ev.y; run.prevPx = run.px; run.prevPy = run.py;
  for (let t = 0; t < (TERMINAL_REPAIR_TIME + 1) * 60 && run.fieldEvent; t++) step(run, log);
  const drops = creditPickups(run);
  check('event resolution drops one credit pickup', drops.length === 1, `${drops.length}`);
  check('credit value = base eventDrop', drops[0]?.value === CREDITS.eventDrop, `${drops[0]?.value}`);
}
{
  const run = freshRun({ creditAmount: 2 });
  const log: RunEvent[] = [];
  step(run, log);
  spawnFieldEvent(run, 'terminal');
  const ev = run.fieldEvent!;
  run.px = ev.x; run.py = ev.y; run.prevPx = run.px; run.prevPy = run.py;
  for (let t = 0; t < (TERMINAL_REPAIR_TIME + 1) * 60 && run.fieldEvent; t++) step(run, log);
  check('creditAmount meta raises drop value',
    creditPickups(run)[0]?.value === CREDITS.eventDrop + 2, `${creditPickups(run)[0]?.value}`);
}

// --- 2. collecting a credit fills the wallet + emits creditPickup ---
{
  const run = freshRun();
  const log: RunEvent[] = [];
  run.pickups.push({ kind: 'credit', x: run.px, y: run.py, value: 5, magnet: true, vx: 0, vy: 0 });
  for (let t = 0; t < 30 && creditPickups(run).length > 0; t++) step(run, log);
  check('collecting a credit fills the wallet', run.credits === 5, `credits=${run.credits}`);
  check('creditsCollected tracks lifetime', run.creditsCollected === 5);
  check('creditPickup event emitted', log.some((e) => e.type === 'creditPickup'));
}

// --- 3. Package Registry: spawns after a boss, prompts on entry, expires ---
{
  const run = freshRun();
  const log: RunEvent[] = [];
  spawnBoss(run, BOSSES.mergeConflict, 1);
  const boss = run.enemies.find((e) => e.isBoss)!;
  run.killEnemy(boss);
  check('boss kill brings the registry online', run.registry !== null
    && log.concat(run.events).length >= 0); // registrySpawn drained below
  step(run, log);
  check('registrySpawn event emitted', log.some((e) => e.type === 'registrySpawn'));
  const reg = run.registry!;
  const d = Math.hypot(reg.x - run.px, reg.y - run.py);
  check('registry placed a short trek out', d >= 380 && d <= 620, `d=${d.toFixed(0)}`);

  // walk in → exactly one prompt; staying inside doesn't re-fire
  run.px = reg.x; run.py = reg.y; run.prevPx = run.px; run.prevPy = run.py;
  step(run, log);
  let prompts = log.filter((e) => e.type === 'registryPrompt').length;
  for (let t = 0; t < 60; t++) step(run, log);
  prompts = log.filter((e) => e.type === 'registryPrompt').length;
  check('one prompt per ring entry (latch holds while inside)', prompts === 1, `${prompts}`);
}
{
  // ignored registry expires after registryLife
  const run = freshRun();
  const log: RunEvent[] = [];
  spawnBoss(run, BOSSES.mergeConflict, 1);
  run.killEnemy(run.enemies.find((e) => e.isBoss)!);
  const reg = run.registry!;
  run.px = reg.x + 5000; run.py = reg.y; run.prevPx = run.px; run.prevPy = run.py; // far away
  for (let t = 0; t < (CREDITS.registryLife + 2) * 60 && run.registry; t++) step(run, log);
  check('ignored registry expires', run.registry === null
    && log.some((e) => e.type === 'registryGone'));
}

// --- 4. buying: affordability, effects, credit deduction ---
{
  const run = freshRun();
  run.credits = 10;
  run.hp = 1;
  const ok = run.buyRegistryItem('hotfix'); // heal to full + shield, cost 4
  check('hotfix purchase succeeds', ok && run.credits === 6, `credits=${run.credits}`);
  check('hotfix heals to full', Math.abs(run.hp - run.stats.maxHp) < 0.5, `hp=${run.hp.toFixed(0)}/${run.stats.maxHp}`);

  const rerolls = run.rerollsLeft;
  run.buyRegistryItem('spareCi'); // +1 reroll, cost 2
  check('spareCi grants a reroll', run.rerollsLeft === rerolls + 1 && run.credits === 4);

  run.buyRegistryItem('overclock'); // dmg buff, cost 3
  check('overclock arms the damage buff', run.buffDmgT > 0 && run.credits === 1);

  check('unaffordable purchase refused', !run.buyRegistryItem('hotfix') && run.credits === 1);
  check('unknown item refused', !run.buyRegistryItem('nonsense'));
}

// --- 4b. Lint Pass: randomStat deducts but defers; stat boosts apply ---
{
  const run = freshRun();
  run.credits = 5;
  const ok = run.buyRegistryItem('randomStat'); // cost 3, no immediate effect
  check('randomStat deducts credits, no immediate stat change', ok && run.credits === 2);

  const boosts = rollStatBoosts(run.stats.luck);
  check('rollStatBoosts returns 3 options', boosts.length === 3, `${boosts.length}`);
  check('3 distinct stats', new Set(boosts.map((b) => b.stat)).size === 3);
  check('each option carries a single mod + desc', boosts.every((b) =>
    Object.keys(b.mods).length === 1 && b.desc.length > 0 && !!b.rarity));

  const dmg0 = run.stats.damageMult;
  run.applyStatBoost({ damage: 0.05 });
  check('applyStatBoost raises the resolved stat', run.stats.damageMult > dmg0,
    `${dmg0.toFixed(3)} → ${run.stats.damageMult.toFixed(3)}`);
  check('stat boost is NOT tracked as a card', run.takenCards.size === 0);
}

// --- 4c. one visit: distinct items buyable once each, Lint Pass repeatable;
// buying marks `used` but doesn't consume the registry (close does, UI-side) ---
{
  const run = freshRun();
  spawnBoss(run, BOSSES.mergeConflict, 1);
  run.killEnemy(run.enemies.find((e) => e.isBoss)!);
  run.credits = 30;
  check('distinct items buy in one visit', run.buyRegistryItem('spareCi') && run.buyRegistryItem('hotReload'));
  check('same item refused a second time this visit', !run.buyRegistryItem('spareCi'));
  check('Lint Pass is repeatable', run.buyRegistryItem('randomStat') && run.buyRegistryItem('randomStat'));
  check('registry survives purchases (consumed only on close)', run.registry !== null);
  check('purchase marks the registry used', run.registry?.used === true);
}

// --- 5. buffs tick down over time ---
{
  const run = freshRun();
  run.credits = 99;
  run.buyRegistryItem('hotReload'); // speed buff
  const t0 = run.buffSpeedT;
  const log: RunEvent[] = [];
  for (let t = 0; t < 60; t++) step(run, log);
  check('speed buff ticks down', run.buffSpeedT < t0 && run.buffSpeedT > 0,
    `${t0.toFixed(0)}s → ${run.buffSpeedT.toFixed(0)}s`);
}

// --- 6. noTerrain gating: no elite drops, no registry (balance-sim policy) ---
{
  const run = freshRun({}, true);
  const log: RunEvent[] = [];
  spawnBoss(run, BOSSES.mergeConflict, 1);
  run.killEnemy(run.enemies.find((e) => e.isBoss)!);
  check('noTerrain: boss kill brings NO registry online', run.registry === null);
  // resolve an event manually-spawned? spawnFieldEvent still works, but natural
  // drops are what's gated — assert the elite-drop path is gated by eventsEnabled
  check('noTerrain: eventsEnabled is false', run.eventsEnabled === false);
}

// --- 7. suspend/resume: wallet survives, live registry + buffs drop ---
{
  const run = freshRun();
  run.credits = 7; run.creditsCollected = 7;
  run.buffDmgT = 30;
  spawnBoss(run, BOSSES.mergeConflict, 1);
  run.killEnemy(run.enemies.find((e) => e.isBoss)!); // registry now live
  const snap = snapshotRun(run, 'test');
  const restored = restoreRun(snap, new Set());
  check('credits survive suspend/resume', restored.credits === 7, `${restored.credits}`);
  check('live registry dropped on resume', restored.registry === null);
  check('buffs dropped on resume', restored.buffDmgT === 0 && restored.buffSpeedT === 0);
}

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
