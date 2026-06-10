import { ENEMIES, ELITE, MAX_ENEMIES, difficulty } from '../data/enemies';
import type { EnemyDef, SpawnPhase } from '../data/types';
import { rand, weightedIndex } from '../core/util';
import type { Enemy, Run } from './run';

/** Distance from the player at which enemies pop in (just past screen edge). */
const SPAWN_RADIUS = 760;

function currentPhase(run: Run): SpawnPhase {
  const minutes = run.time / 60;
  const plan = run.map.spawnPlan;
  let phase = plan[0];
  for (const p of plan) {
    if (minutes >= p.fromMin) phase = p;
  }
  return phase;
}

export function makeEnemy(run: Run, def: EnemyDef, x: number, y: number, elite: boolean): Enemy {
  const diff = difficulty(run.time / 60);
  return {
    def, x, y,
    hp: def.hp * diff.hpMult * (elite ? ELITE.hpMult : 1),
    maxHp: def.hp * diff.hpMult * (elite ? ELITE.hpMult : 1),
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
    scaledDamage: def.damage * diff.damageMult * (elite ? ELITE.damageMult : 1),
  };
}

export function updateSpawner(run: Run, dt: number): void {
  if (run.enemies.length >= MAX_ENEMIES) return;

  const minutes = run.time / 60;
  const phase = currentPhase(run);
  const diff = difficulty(minutes);

  run.spawnTimer -= dt;
  if (run.spawnTimer > 0) return;
  run.spawnTimer = phase.interval * diff.spawnRateMult;

  const ids = Object.keys(phase.weights);
  const weights = ids.map((id) => phase.weights[id]);
  const def = ENEMIES[ids[weightedIndex(weights)]];

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
