// Round-trip check for suspend & resume (src/game/runSave.ts): a mid-run
// snapshot serialized through JSON and restored must reproduce the run state
// (progression, build, entities, boss schedule), keep simulating cleanly,
// and refuse snapshots whose content ids no longer exist.
//
//   npx esbuild scripts/suspendTest.ts --bundle --platform=node --outfile=scripts/suspendTest.cjs
//   node scripts/suspendTest.cjs

import { Run } from '../src/game/run';
import { snapshotRun, restoreRun, type SuspendedRun } from '../src/game/runSave';
import { CHARACTERS } from '../src/data/characters';
import { MAPS } from '../src/data/maps';
import { DEFAULT_WEAPON_POOL } from '../src/data/weapons';
import { CARD_BY_ID } from '../src/data/upgrades';

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}

// Build a representative mid-run state: memoryMarsh (Infinity-life hazard
// pools exercise the JSON null mapping), 3 sim-minutes (first boss is in),
// a few cards and a second weapon.
const run = new Run(CHARACTERS.ada, MAPS.memoryMarsh, { regen: 2 },
  [...new Set([...DEFAULT_WEAPON_POOL, CHARACTERS.ada.weapon])], new Set());
run.invincible = true; // stationary player must survive 3 minutes
run.applyCard(CARD_BY_ID.coffeeBreak);
run.applyCard(CARD_BY_ID.memOptimize);
run.applyCard(CARD_BY_ID.memOptimize);
run.addWeapon(DEFAULT_WEAPON_POOL.find((id) => id !== CHARACTERS.ada.weapon)!);
const STEP = 1 / 60;
for (let t = 0; t < 180 * 60; t++) {
  run.update(STEP);
  run.events.length = 0; // drain like main.ts does, keep memory flat
  // auto-resolve level-ups by deferring nothing — just clear the queue
  run.pendingLevelUps = 0;
}
run.hp = Math.min(run.hp, run.stats.maxHp * 0.6); // a non-trivial hp fraction

check('precondition: enemies alive', run.enemies.length > 20, `${run.enemies.length}`);
check('precondition: boss schedule advanced', run.bossIndex >= 1, `bossIndex=${run.bossIndex}`);
check('precondition: pickups on the ground', run.pickups.length > 0, `${run.pickups.length}`);
check('precondition: marsh pools present', run.zones.some((z) => z.life === Infinity));

// --- 1. snapshot → JSON → restore fidelity ---
const snap: SuspendedRun = JSON.parse(JSON.stringify(snapshotRun(run)));
const r2 = restoreRun(snap, new Set());

check('time preserved', r2.time === run.time, `${r2.time}`);
check('position preserved', r2.px === run.px && r2.py === run.py);
check('hp preserved', Math.abs(r2.hp - run.hp) < 1e-9, `${r2.hp} vs ${run.hp}`);
check('level/xp preserved', r2.level === run.level && Math.abs(r2.xp - run.xp) < 1e-9,
  `lv ${r2.level}, xp ${r2.xp}`);
check('xpCollected preserved', Math.abs(r2.xpCollected - run.xpCollected) < 1e-9);
check('kills/bossKills preserved', r2.kills === run.kills && r2.bossKills === run.bossKills,
  `${r2.kills}/${r2.bossKills}`);
check('taken cards preserved',
  JSON.stringify([...r2.takenCards.entries()].sort()) === JSON.stringify([...run.takenCards.entries()].sort()));
check('stats recomputed identically', r2.stats.maxHp === run.stats.maxHp && r2.stats.regen === run.stats.regen,
  `maxHp ${r2.stats.maxHp} vs ${run.stats.maxHp}`);
check('weapons preserved (id+level+damage)',
  r2.weapons.length === run.weapons.length &&
  r2.weapons.every((w, i) => w.def.id === run.weapons[i].def.id &&
    w.level === run.weapons[i].level &&
    Math.abs(w.totalDamage - run.weapons[i].totalDamage) < 1e-6));
check('enemy count preserved', r2.enemies.length === run.enemies.length,
  `${r2.enemies.length} vs ${run.enemies.length}`);
const bossA = run.enemies.find((e) => e.isBoss);
const bossB = r2.enemies.find((e) => e.isBoss);
check('boss restored with state', !!bossA === !!bossB &&
  (!bossA || (bossB!.def.id === bossA.def.id && bossB!.hp === bossA.hp && bossB!.bossTier === bossA.bossTier)));
const scaled = run.enemies.find((e) => e.scaledSpeed !== undefined);
const scaledB = scaled && r2.enemies.find((e) => e.x === scaled.x && e.y === scaled.y);
check('difficulty-scaled spawn values survive', !scaled || (
  !!scaledB && scaledB.scaledSpeed === scaled.scaledSpeed && scaledB.scaledDamage === scaled.scaledDamage));
check('pickups preserved', r2.pickups.length === run.pickups.length);
check('marsh pools restored to Infinity', r2.zones.filter((z) => z.life === Infinity).length ===
  run.zones.filter((z) => z.life === Infinity).length);
check('boss schedule preserved', r2.nextBossAt === run.nextBossAt && r2.bossIndex === run.bossIndex);
check('rerolls/banishes/skips preserved', r2.rerollsLeft === run.rerollsLeft &&
  r2.banishesLeft === run.banishesLeft && r2.skipsLeft === run.skipsLeft);

// --- 2. the restored run keeps simulating ---
r2.invincible = true;
const t0 = r2.time, k0 = r2.kills;
for (let t = 0; t < 30 * 60; t++) {
  r2.update(STEP);
  r2.events.length = 0;
  r2.pendingLevelUps = 0;
}
check('restored run simulates 30s without errors', Math.abs(r2.time - (t0 + 30)) < 0.01, `t=${r2.time}`);
check('restored run still fights (kills advance)', r2.kills > k0, `${k0} → ${r2.kills}`);

// --- 3. terrain blockers (production server racks) round-trip ---
const prodRun = new Run(CHARACTERS.ada, MAPS.productionServer, {},
  [...new Set([...DEFAULT_WEAPON_POOL, CHARACTERS.ada.weapon])], new Set());
check('precondition: racks rolled', prodRun.obstacles.length > 0, `${prodRun.obstacles.length}`);
check('precondition: bus lanes rolled', prodRun.patches.length > 0, `${prodRun.patches.length}`);
const psnap: SuspendedRun = JSON.parse(JSON.stringify(snapshotRun(prodRun)));
const pr = restoreRun(psnap, new Set());
check('obstacles restored exactly (not re-rolled)',
  JSON.stringify(pr.obstacles) === JSON.stringify(prodRun.obstacles));
check('patches restored exactly (not re-rolled)',
  JSON.stringify(pr.patches) === JSON.stringify(prodRun.patches));
delete psnap.obstacles;
delete psnap.patches;
const prLegacy = restoreRun(psnap, new Set());
check('pre-terrain snapshot restores rackless', prLegacy.obstacles.length === 0);
check('pre-patch snapshot restores patchless', prLegacy.patches.length === 0);

// --- 3. content drift is rejected, not resumed ---
const bad: SuspendedRun = JSON.parse(JSON.stringify(snap));
bad.weapons[0].id = 'deletedWeapon';
let threw = false;
try { restoreRun(bad, new Set()); } catch { threw = true; }
check('unknown weapon id throws (snapshot discarded by caller)', threw);

const badEnemy: SuspendedRun = JSON.parse(JSON.stringify(snap));
if (badEnemy.enemies.length > 0) badEnemy.enemies[0].defId = 'deletedBug';
threw = false;
try { restoreRun(badEnemy, new Set()); } catch { threw = true; }
check('unknown enemy id throws', threw);

console.log(failures === 0 ? '\nAll suspend/resume checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
