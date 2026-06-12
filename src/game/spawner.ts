import { ENEMIES, ELITE, MAX_ENEMIES, difficulty } from '../data/enemies';
import type { EnemyDef, SpawnPhase } from '../data/types';
import { rand, weightedIndex } from '../core/util';
import type { Enemy, Run } from './run';

/** Distance from the player at which enemies pop in (just past screen edge). */
export const SPAWN_RADIUS = 760;

/** Past this distance an enemy has been outrun for good — teleport it back onto
 *  the spawn ring. Without this, running in one direction sheds the entire swarm
 *  (player 150 u/s outpaces every enemy at any difficulty) and survival needs no
 *  kill rate at all; with it, the horde encircles and the build is the defense. */
const RECYCLE_RADIUS = 1000;

/** While the player is in motion, most recycled stragglers land in a cone ahead
 *  of the heading: running away converts the swarm behind you into a wall in
 *  front of you. A player holding ground gets a uniform ring instead. */
const RECYCLE_AHEAD_CHANCE = 0.65;
const RECYCLE_AHEAD_SPREAD = 0.8; // radians each side of the heading

function currentPhase(run: Run): SpawnPhase {
  const minutes = run.time / 60;
  const plan = run.map.spawnPlan;
  let phase = plan[0];
  for (const p of plan) {
    if (minutes >= p.fromMin) phase = p;
  }
  return phase;
}

/** Weighted draw from the map's current spawn phase (also feeds the Legacy
 *  Monolith's bug-breeding aura). */
export function randomPhaseEnemyDef(run: Run): EnemyDef {
  const phase = currentPhase(run);
  const ids = Object.keys(phase.weights);
  return ENEMIES[ids[weightedIndex(ids.map((id) => phase.weights[id]))]];
}

/** Crunch Time severity escalation: at 15:00 the live backlog doesn't get
 *  descoped — every bug on the field (and anything hatched during overtime)
 *  is promoted to CRITICAL: harder-hitting, faster, visually flagged. */
export const CRITICAL_DMG_MULT = 1.5;
export const CRITICAL_SPEED_MULT = 1.3;

export function makeCritical(e: Enemy): void {
  if (e.critical || e.isBoss) return;
  e.critical = true;
  e.scaledDamage = (e.scaledDamage ?? e.def.damage) * CRITICAL_DMG_MULT;
  e.scaledSpeed = (e.scaledSpeed ?? e.def.speed) * CRITICAL_SPEED_MULT;
}

export function makeEnemy(run: Run, def: EnemyDef, x: number, y: number, elite: boolean): Enemy {
  const diff = difficulty(run.time / 60);
  const scale = run.map.enemyScale ?? 1; // per-map meta-gating multiplier
  const hp = def.hp * diff.hpMult * scale * (elite ? ELITE.hpMult : 1);
  const e: Enemy = {
    def, x, y,
    hp, maxHp: hp,
    elite, isBoss: false,
    slowT: 0, slowAmt: 0, frozenT: 0, hitFlash: 0, matchMarkT: 0,
    knockX: 0, knockY: 0,
    chargePhase: 0, chargeT: rand(0, 1), dashX: 0, dashY: 0,
    jitterT: 0, jitterAng: 0,
    dupT: rand(3, 7), isCopy: false, copyT: 0,
    bossTier: 0, mechT: 0, mechT2: 0, burstPeriod: 0,
    phase: 'exposed', phaseT: 0, splitDone: false,
    facing: 0,
    scaledSpeed: def.speed * diff.speedMult * (elite ? ELITE.speedMult : 1),
    scaledDamage: def.damage * diff.damageMult * scale * (elite ? ELITE.damageMult : 1),
  };
  // anything hatched during overtime (Monolith breeding, stack frames) is born critical
  if (run.crunchStarted) makeCritical(e);
  run.spawnedKinds.add(`bug:${def.id}`); // codex discovery (progressive unlocks)
  return e;
}

function recycleStragglers(run: Run): void {
  const hx = run.px - run.prevPx, hy = run.py - run.prevPy;
  run.prevPx = run.px; run.prevPy = run.py;
  const moving = hx * hx + hy * hy > 0.16; // ≈ 24 u/s at 60 fps
  const heading = Math.atan2(hy, hx);

  const r2 = RECYCLE_RADIUS * RECYCLE_RADIUS;
  for (const e of run.enemies) {
    if (e.isBoss) continue; // bosses keep their position (mechanics + edge arrow)
    if ((e.def as EnemyDef).stationary) continue; // pillars stay where the boss put them
    const dx = e.x - run.px, dy = e.y - run.py;
    if (dx * dx + dy * dy < r2) continue;
    const ang = moving && Math.random() < RECYCLE_AHEAD_CHANCE
      ? heading + rand(-RECYCLE_AHEAD_SPREAD, RECYCLE_AHEAD_SPREAD)
      : Math.random() * Math.PI * 2;
    const r = SPAWN_RADIUS + rand(0, 90);
    e.x = run.px + Math.cos(ang) * r;
    e.y = run.py + Math.sin(ang) * r;
    e.knockX = 0; e.knockY = 0;
  }
}

export function updateSpawner(run: Run, dt: number): void {
  recycleStragglers(run); // must run even (especially) when the cap is full
  // Crunch Time feature freeze: nothing NEW spawns during overtime, but
  // recycling above must keep running — the critical horde stays inescapable.
  if (run.crunchStarted) return;
  if (run.enemies.length >= MAX_ENEMIES) return;

  const minutes = run.time / 60;
  const phase = currentPhase(run);
  const diff = difficulty(minutes);

  run.spawnTimer -= dt;
  if (run.spawnTimer > 0) return;
  run.spawnTimer = phase.interval * diff.spawnRateMult;

  const def = randomPhaseEnemyDef(run);

  const eliteChance = minutes >= ELITE.fromMin
    ? ELITE.baseChance + ELITE.chancePerMin * (minutes - ELITE.fromMin)
    : 0;

  const count = def.cluster ?? 1;
  const baseAngle = Math.random() * Math.PI * 2;
  // Clusters share one elite roll so a whole tick swarm can't be elite-spammed.
  const elite = Math.random() < eliteChance;

  for (let i = 0; i < count; i++) {
    if (run.enemies.length >= MAX_ENEMIES) break;
    const ang = baseAngle + (count > 1 ? rand(-0.25, 0.25) : 0);
    const r = SPAWN_RADIUS + rand(0, 90);
    const x = run.px + Math.cos(ang) * r + (count > 1 ? rand(-40, 40) : 0);
    const y = run.py + Math.sin(ang) * r + (count > 1 ? rand(-40, 40) : 0);
    run.enemies.push(makeEnemy(run, def, x, y, elite && i === 0));
  }
}
