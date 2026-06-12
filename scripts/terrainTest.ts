// Headless assertions for the terrain-blocker slice (production server racks):
// layout constraints, push-out collision, slide-along, and map isolation.
//   npx esbuild scripts/terrainTest.ts --bundle --platform=node --outfile=scripts/terrainTest.cjs && node scripts/terrainTest.cjs
import { Run } from '../src/game/run';
import { CHARACTERS } from '../src/data/characters';
import { MAPS } from '../src/data/maps';
import { DEFAULT_WEAPON_POOL } from '../src/data/weapons';
import { BOSSES } from '../src/data/bosses';
import { spawnBoss } from '../src/game/bossLogic';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const pool = [...new Set([...DEFAULT_WEAPON_POOL, CHARACTERS.ada.weapon])];
const run = new Run(CHARACTERS.ada, MAPS.productionServer, {}, pool, new Set());
const spec = MAPS.productionServer.obstacles!;

// --- layout ---
check('racks rolled (rejection sampling finds room)', run.obstacles.length >= spec.count - 4,
  `${run.obstacles.length}/${spec.count}`);
check('radii within spec', run.obstacles.every((o) => o.r >= spec.rMin && o.r <= spec.rMax));
check('player start clear', run.obstacles.every((o) => Math.hypot(o.x, o.y) > 280 - 1e-9));

// rows layout: cluster by adjacency → every cluster is an axis-aligned row of
// ≤4 same-size racks, and separate rows keep ≥170 corridors between them
{
  const groups: number[] = run.obstacles.map((_, i) => i);
  const find = (i: number): number => (groups[i] === i ? i : (groups[i] = find(groups[i])));
  run.obstacles.forEach((a, i) => run.obstacles.forEach((b, j) => {
    if (i < j && Math.hypot(a.x - b.x, a.y - b.y) <= a.r + b.r + 20) groups[find(i)] = find(j);
  }));
  const rows = new Map<number, number[]>();
  run.obstacles.forEach((_, i) => {
    const g = find(i);
    rows.set(g, [...(rows.get(g) ?? []), i]);
  });
  const rowList = [...rows.values()];
  check('racks form rows (some multi-rack walls exist)', rowList.some((r) => r.length >= 2),
    `${rowList.length} rows for ${run.obstacles.length} racks`);
  check('rows are axis-aligned and ≤4 long', rowList.every((r) => {
    if (r.length > 4) return false;
    const xs = r.map((i) => run.obstacles[i].x), ys = r.map((i) => run.obstacles[i].y);
    return Math.max(...xs) - Math.min(...xs) < 1 || Math.max(...ys) - Math.min(...ys) < 1;
  }));
  let corridorsOk = true;
  rowList.forEach((ra, i) => rowList.forEach((rb, j) => {
    if (i >= j) return;
    for (const ia of ra) for (const ib of rb) {
      const a = run.obstacles[ia], b = run.obstacles[ib];
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + 170 - 1e-9) corridorsOk = false;
    }
  }));
  check('corridors between rows stay ≥ 170', corridorsOk);
}
check('no rack covers a vent center',
  run.obstacles.every((o) => run.zones.every((z) => Math.hypot(o.x - z.x, o.y - z.y) >= z.radius + o.r + 20 - 1e-9)));

// --- push-out ---
// off-axis interior start: a body EXACTLY on a row's axis line ping-pongs
// between row-mates (all pushes stay collinear — measure-zero geometry that
// real movement never produces; the 60s sim below asserts the per-frame
// invariant). Any lateral offset converges out the wall's side.
const o0 = run.obstacles[0];
const body = { x: o0.x + 5, y: o0.y + 7 }; // diagonal: lateral to either row axis
run.resolveObstacles(body, 13);
check('body inside a wall is pushed fully out (multi-pass converges)',
  !run.obstacleAt(body.x, body.y, 13 - 1e-6),
  `at (${body.x.toFixed(0)}, ${body.y.toFixed(0)})`);

// --- slide-along: a body moving at 45° into the rack must keep its tangential
// progress (push-out removes only the penetration component). Synthetic fixed
// circle: the rolled layouts vary rack radii, and the expected progress is
// geometry-dependent (a fatter rack means a longer arc to round) ---
const slideRun = new Run(CHARACTERS.ada, MAPS.greenfield, {}, pool, new Set());
slideRun.obstacles.push({ x: 0, y: 0, r: 30 });
const start = { x: -43.5, y: -60 };
const slider = { ...start };
for (let i = 0; i < 120; i++) {
  slider.x += 1.2; slider.y += 1.2; // diagonal step into the rack
  slideRun.resolveObstacles(slider, 13);
}
check('slide-along: tangential progress survives', slider.y > start.y + 80,
  `Δy=${(slider.y - start.y).toFixed(0)}`);
check('slide-along: never inside the rack',
  Math.hypot(slider.x, slider.y) >= 30 + 13 - 1e-6);

// --- projectile blocking (user ruling: racks stop flat-flying shots) ---
const o1 = run.obstacles[0];
run.projectiles.push({
  x: o1.x - o1.r - 30, y: o1.y, vx: 600, vy: 0, // flying straight at the rack
  damage: 10, radius: 4, pierce: 1, life: 5, slow: 0, slowDur: 0, freeze: 0,
  color: '#fff', kind: 'bolt', hit: new Set(),
});
run.projectiles.push({
  x: o1.x - o1.r - 30, y: o1.y, vx: 600, vy: 0, // lobbed bomb on the same path
  damage: 10, radius: 4, pierce: 1, life: 5, slow: 0, slowDur: 0, freeze: 0,
  color: '#fff', kind: 'bomb', hit: new Set(),
  bomb: { explodeRadius: 60, split: 0, gen: 0, maxLife: 5 },
});
run.enemyShots.push({
  x: o1.x + o1.r + 30, y: o1.y, vx: -500, vy: 0, // enemy shot from the far side
  damage: 5, radius: 5, life: 5, color: '#f00',
});
run.enemyShots.push({
  x: o1.x + o1.r + 30, y: o1.y, vx: -500, vy: 0, // lobbed splash glob, same path
  damage: 5, radius: 5, life: 5, color: '#f00',
  splash: { radius: 40, dps: 5, life: 3 },
});
for (let t = 0; t < 30; t++) run.update(1 / 60); // 0.5s: enough to cross the rack
check('flat player shot stopped by the rack',
  !run.projectiles.some((p) => p.kind === 'bolt' && p.life > 4));
check('lobbed bomb arcs over the rack',
  run.projectiles.some((p) => p.bomb && p.x > o1.x + o1.r));
check('flat enemy shot stopped by the rack',
  !run.enemyShots.some((s) => !s.splash && s.life > 4));
check('lobbed splash glob arcs over the rack',
  run.enemyShots.some((s) => s.splash && s.x < o1.x - o1.r));
run.projectiles.length = 0; run.enemyShots.length = 0; run.events.length = 0;

// --- simulation: a minute of production with racks, nothing tunnels ---
run.invincible = true;
for (let t = 0; t < 60 * 60; t++) {
  run.update(1 / 60);
  run.events.length = 0;
  run.pendingLevelUps = 0;
}
const inside = run.enemies.filter((e) =>
  !e.isBoss && run.obstacles.some((o) => Math.hypot(e.x - o.x, e.y - o.y) < o.r - 2)).length;
check('no regular enemy ends a frame inside a rack', inside === 0, `${inside} inside`);
check('player not inside a rack',
  run.obstacles.every((o) => Math.hypot(run.px - o.x, run.py - o.y) >= o.r + 13 - 1e-6));

// --- LOS targeting (user ruling: auto-aim skips covered targets) ---
// synthetic isolated circle: rolled layouts have row-mates near any rack,
// so "past the edge" paths through the real field aren't reliably clear
const losRun = new Run(CHARACTERS.ada, MAPS.greenfield, {}, pool, new Set());
check('LOS trivially clear on featureless maps', losRun.hasLOS(0, 0, 1000, 0));
losRun.obstacles.push({ x: 0, y: 0, r: 30 });
check('LOS blocked straight through a blocker', !losRun.hasLOS(-80, 0, 80, 0));
check('LOS clear past the blocker edge', losRun.hasLOS(-80, 60, 80, 60));

// --- boss crush (user ruling: bosses destroy racks they plow into) ---
const racksBefore = run.obstacles.length;
spawnBoss(run, BOSSES.mergeConflict, 1);
const boss = run.enemies.find((e) => e.isBoss)!;
const oc = run.obstacles[0];
boss.x = oc.x; boss.y = oc.y; // teleport the boss onto a rack
run.update(1 / 60);
check('boss crushes the rack it stands in', run.obstacles.length === racksBefore - 1,
  `${run.obstacles.length} vs ${racksBefore}`);
check('crush event emitted', run.events.some((ev) => ev.type === 'crush'));
run.events.length = 0;

// --- terrain patches: Data Bus (production) ---
check('production rolls data-bus lanes', run.patches.length >= 3 && run.patches.every((p) => p.kind === 'bus'),
  `${run.patches.length}`);
const bus = run.patches[0];
const rider = { x: bus.x, y: bus.y };
for (let i = 0; i < 60; i++) run.applyPatches(rider, 1 / 60); // one second on the belt
const carried = (rider.x - bus.x) * bus.ux + (rider.y - bus.y) * bus.uy;
check('bus carries a rider along the lane', Math.abs(carried - bus.strength) < 1,
  `${carried.toFixed(1)} u/s vs ${bus.strength}`);
const bystander = { x: bus.x - bus.uy * (bus.halfWidth + 40), y: bus.y + bus.ux * (bus.halfWidth + 40) };
const b0 = { ...bystander };
run.applyPatches(bystander, 1);
check('off-lane bystander unaffected', bystander.x === b0.x && bystander.y === b0.y);

// --- per-map blockers: marsh stumps + glacier ice (scatter layout) ---
const marshRun = new Run(CHARACTERS.ada, MAPS.memoryMarsh, {}, pool, new Set());
check('marsh rolls dead-process stumps', marshRun.obstacles.length >= MAPS.memoryMarsh.obstacles!.count - 3,
  `${marshRun.obstacles.length}/${MAPS.memoryMarsh.obstacles!.count}`);
let marshScatterOk = true;
for (const a of marshRun.obstacles) for (const b of marshRun.obstacles) {
  if (a !== b && Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + 110 - 1e-9) marshScatterOk = false;
}
check('marsh scatter stays walkable (pairwise ≥ 110)', marshScatterOk);
check('no stump covers a pool center',
  marshRun.obstacles.every((o) => marshRun.zones.every((z) => Math.hypot(o.x - z.x, o.y - z.y) >= z.radius + o.r + 20 - 1e-9)));
const glacierRun = new Run(CHARACTERS.ada, MAPS.cyberGlacier, {}, pool, new Set());
check('glacier rolls frozen-process columns', glacierRun.obstacles.length >= MAPS.cyberGlacier.obstacles!.count - 3,
  `${glacierRun.obstacles.length}/${MAPS.cyberGlacier.obstacles!.count}`);

// --- terrain patches: Swap Space (marsh) ---
check('marsh rolls swap wells', marshRun.patches.length >= 4 && marshRun.patches.every((p) => p.kind === 'swap'),
  `${marshRun.patches.length}`);
check('well hearts clear of stump bodies',
  marshRun.patches.every((p) => marshRun.obstacles.every((o) => Math.hypot(p.x - o.x, p.y - o.y) >= o.r + 50 - 1e-9)));
const well = marshRun.patches[0];
const sucked = { x: well.x + well.radius * 0.6, y: well.y };
const d0 = well.radius * 0.6;
for (let i = 0; i < 60; i++) marshRun.applyPatches(sucked, 1 / 60);
const d1 = Math.hypot(sucked.x - well.x, sucked.y - well.y);
check('well pulls a body toward its center', d1 < d0 - 20, `d ${d0.toFixed(0)} → ${d1.toFixed(0)}`);

// integration: a frozen bug in a well still gets paged inward (drift is
// physical, not behavioral — frozen skips moveEnemy, never the terrain)
for (let t = 0; t < 5 * 60 && marshRun.enemies.length === 0; t++) { marshRun.update(1 / 60); marshRun.events.length = 0; marshRun.pendingLevelUps = 0; }
const bug = marshRun.enemies.find((e) => !e.isBoss);
check('precondition: marsh bug spawned', !!bug);
if (bug) {
  // park the player next to the well: a bug >1000u from the player gets
  // straggler-recycled to the spawn ring before the drift can be measured
  marshRun.px = well.x - 250; marshRun.py = well.y;
  bug.frozenT = 10; bug.knockX = 0; bug.knockY = 0;
  bug.x = well.x + well.radius * 0.7; bug.y = well.y;
  const bd0 = Math.hypot(bug.x - well.x, bug.y - well.y);
  for (let t = 0; t < 30; t++) { marshRun.update(1 / 60); marshRun.events.length = 0; marshRun.pendingLevelUps = 0; }
  const bd1 = Math.hypot(bug.x - well.x, bug.y - well.y);
  check('frozen bug drifts into the well', bd1 < bd0 - 5, `d ${bd0.toFixed(0)} → ${bd1.toFixed(0)}`);
}

// --- balance-sim policy: noTerrain runs are terrain-free (user 2026-06-12) ---
const simRun = new Run(CHARACTERS.ada, MAPS.productionServer, {}, pool, new Set(), { noTerrain: true });
check('noTerrain run rolls no obstacles (sim policy)', simRun.obstacles.length === 0);
check('noTerrain rolls no patches either', simRun.patches.length === 0);
check('noTerrain keeps hazards (vents are difficulty, not terrain)', simRun.zones.length > 0);

// --- map isolation ---
const green = new Run(CHARACTERS.ada, MAPS.greenfield, {}, pool, new Set());
check('greenfield stays featureless (no obstacles)', green.obstacles.length === 0);

console.log(failures === 0 ? '\nAll terrain checks passed.' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
