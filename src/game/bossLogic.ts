import { BOSSES, BOSS_INTERVAL, BOSS_WARNING_LEAD, BOSS_TIER_HP_MULT, BOSS_TIER_DMG_MULT } from '../data/bosses';
import { ENEMIES } from '../data/enemies';
import type { BossDef } from '../data/types';
import { rand } from '../core/util';
import { makeEnemy } from './spawner';
import type { Enemy, Run } from './run';

// Boss scheduling: one boss every BOSS_INTERVAL seconds, picked from the map's
// bossOrder (cycled with growing tier scaling once the list runs out).

export function updateBossSchedule(run: Run, _dt: number): void {
  const def = bossForIndex(run, run.bossIndex);

  if (!run.bossWarned && run.time >= run.nextBossAt - BOSS_WARNING_LEAD) {
    run.bossWarned = true;
    run.emit({ type: 'bossWarning', name: def.name });
  }
  if (run.time >= run.nextBossAt) {
    spawnBoss(run, def, run.bossIndex);
    run.bossIndex++;
    run.nextBossAt += BOSS_INTERVAL;
    run.bossWarned = false;
  }
}

function bossForIndex(run: Run, index: number): BossDef {
  const order = run.map.bossOrder;
  return BOSSES[order[index % order.length]];
}

export function spawnBoss(run: Run, def: BossDef, tier: number): void {
  const ang = Math.random() * Math.PI * 2;
  const x = run.px + Math.cos(ang) * 620;
  const y = run.py + Math.sin(ang) * 620;
  const hp = def.hp * (1 + tier * BOSS_TIER_HP_MULT);
  const boss: Enemy = {
    def, x, y,
    hp, maxHp: hp,
    elite: false, isBoss: true,
    slowT: 0, slowAmt: 0, frozenT: 0, hitFlash: 0, matchMarkT: 0,
    knockX: 0, knockY: 0,
    chargePhase: 0, chargeT: 0, dashX: 0, dashY: 0,
    jitterT: 0, jitterAng: 0, dupT: 0, isCopy: false, copyT: 0,
    bossTier: tier,
    mechT: 2, mechT2: 1.5,
    burstPeriod: 3.2,
    phase: 'exposed', phaseT: 4,
    splitDone: false,
    facing: 0,
    scaledSpeed: def.speed,
    scaledDamage: def.damage * (1 + tier * BOSS_TIER_DMG_MULT),
  };
  run.enemies.push(boss);
  run.emit({ type: 'bossSpawn', name: def.name });
}

export function updateBossMechanics(run: Run, e: Enemy, dt: number): void {
  const def = e.def as BossDef;
  switch (def.mechanic) {
    case 'split':
      if (!e.splitDone && e.hp <= e.maxHp * 0.5) {
        e.splitDone = true;
        const clone = run.makeEnemyFrom(e);
        clone.splitDone = true;
        clone.hp = e.maxHp * 0.35;
        clone.maxHp = e.maxHp * 0.35;
        e.hp = e.maxHp * 0.35;
        clone.x += rand(60, 120); clone.y += rand(-60, 60);
        run.enemies.push(clone);
        run.emit({ type: 'explosion', x: e.x, y: e.y, radius: 90, color: def.color });
      }
      break;

    case 'pools':
      e.mechT -= dt;
      if (e.mechT <= 0) {
        e.mechT = 4;
        run.zones.push({
          kind: 'leak', x: e.x, y: e.y,
          radius: 35, maxRadius: 110,
          life: 8, maxLife: 8,
          dps: 12 * (1 + e.bossTier * 0.3),
        });
      }
      break;

    case 'burst':
      e.mechT -= dt;
      if (e.mechT <= 0) {
        e.burstPeriod = Math.max(1.1, e.burstPeriod * 0.93);
        e.mechT = e.burstPeriod;
        const n = 10;
        const offset = Math.random() * Math.PI * 2;
        for (let i = 0; i < n; i++) {
          const a = offset + (Math.PI * 2 * i) / n;
          run.enemyShots.push({
            x: e.x, y: e.y,
            vx: Math.cos(a) * 185, vy: Math.sin(a) * 185,
            damage: 13 * (1 + e.bossTier * 0.25), radius: 9, life: 5, color: def.color,
          });
        }
      }
      break;

    case 'summon': {
      e.mechT -= dt;
      if (e.mechT <= 0) {
        e.mechT = 5;
        for (let i = 0; i < 5; i++) {
          const a = Math.random() * Math.PI * 2;
          run.enemies.push(makeEnemy(run, ENEMIES.syntaxMite, e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70, false));
        }
      }
      e.mechT2 -= dt;
      if (e.mechT2 <= 0) {
        e.mechT2 = 3;
        const base = Math.atan2(run.py - e.y, run.px - e.x);
        for (const spread of [-0.22, 0, 0.22]) {
          run.enemyShots.push({
            x: e.x, y: e.y,
            vx: Math.cos(base + spread) * 230, vy: Math.sin(base + spread) * 230,
            damage: 15 * (1 + e.bossTier * 0.25), radius: 10, life: 4.5, color: def.color,
          });
        }
      }
      break;
    }

    case 'phase':
      e.phaseT -= dt;
      if (e.phaseT <= 0) {
        if (e.phase === 'armored') { e.phase = 'exposed'; e.phaseT = 4; }
        else { e.phase = 'armored'; e.phaseT = 5; }
      }
      // armored phase crawls; exposed marches
      e.scaledSpeed = (e.def as BossDef).speed * (e.phase === 'armored' ? 0.6 : 1.1);
      break;
  }
}
