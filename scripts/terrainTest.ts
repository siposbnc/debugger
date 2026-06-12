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
check('racks rolled (rejection sampling finds room)', run.obstacles.length >= spec.count - 2,
  `${run.obstacles.length}/${spec.count}`);
check('radii within spec', run.obstacles.every((o) => o.r >= spec.rMin && o.r <= spec.rMax));
check('player start clear', run.obstacles.every((o) => Math.hypot(o.x, o.y) > 280 - 1e-9));
let pairOk = true;
for (const a of run.obstacles) for (const b of run.obstacles) {
  if (a !== b && Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + 110 - 1e-9) pairOk = false;
}
check('aisles stay walkable (pairwise spacing ≥ 110)', pairOk);
check('no rack covers a vent center',
  run.obstacles.every((o) => run.zones.every((z) => Math.hypot(o.x - z.x, o.y - z.y) >= z.radius + o.r + 20 - 1e-9)));

// --- push-out ---
const o0 = run.obstacles[0];
const body = { x: o0.x + 1, y: o0.y }; // deep inside
run.resolveObstacles(body, 13);
check('body inside a rack is pushed to the edge',
  Math.hypot(body.x - o0.x, body.y - o0.y) >= o0.r + 13 - 1e-6,
  `d=${Math.hypot(body.x - o0.x, body.y - o0.y).toFixed(1)} vs ${(o0.r + 13).toFixed(1)}`);

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
const o2 = run.obstacles[0];
check('LOS blocked straight through a rack',
  !run.hasLOS(o2.x - o2.r - 50, o2.y, o2.x + o2.r + 50, o2.y));
check('LOS clear past the rack edge',
  run.hasLOS(o2.x - o2.r - 50, o2.y + o2.r + 30, o2.x + o2.r + 50, o2.y + o2.r + 30));
check('LOS trivially clear on featureless maps',
  new Run(CHARACTERS.ada, MAPS.greenfield, {}, pool, new Set()).hasLOS(0, 0, 1000, 0));

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

// --- balance-sim policy: noTerrain runs are terrain-free (user 2026-06-12) ---
const simRun = new Run(CHARACTERS.ada, MAPS.productionServer, {}, pool, new Set(), { noTerrain: true });
check('noTerrain run rolls no obstacles (sim policy)', simRun.obstacles.length === 0);
check('noTerrain keeps hazards (vents are difficulty, not terrain)', simRun.zones.length > 0);

// --- map isolation ---
const green = new Run(CHARACTERS.ada, MAPS.greenfield, {}, pool, new Set());
check('greenfield stays featureless (no obstacles)', green.obstacles.length === 0);

console.log(failures === 0 ? '\nAll terrain checks passed.' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
