import { BOSSES, BOSS_INTERVAL, BOSS_WARNING_LEAD, BOSS_TIER_HP_MULT, BOSS_TIER_DMG_MULT } from '../data/bosses';
import { ENEMIES } from '../data/enemies';
import type { BossDef } from '../data/types';
import { clamp, dist, rand } from '../core/util';
import { makeEnemy, randomPhaseEnemyDef } from './spawner';
import type { Enemy, GroundZone, Run } from './run';

// Boss scheduling: one boss every BOSS_INTERVAL seconds, picked from the map's
// bossOrder (cycled with growing tier scaling once the list runs out).
//
// Every boss has two layers: the original attack pattern (movement check) and a
// rule-bending layer that tests the build — DPS checks, soft enrages, interrupt
// thresholds (ROADMAP "Boss mechanics pass"). Numbers live in the constants below.

// --- second-layer tuning ---
const TETHER_WIDTH = 26;          // half-width of the merge-conflict diff beam
const TETHER_DPS = 14;            // (scaled by tier)
const SPLIT_HP = 0.55;            // each half's bar as a fraction of the original pool
                                  // (0.35 made the halves die before enrage could ever
                                  // matter — post-split is now the LONGER part of the fight)
const ENRAGE_GAP_ON = 0.25;       // HP gap (fraction of half-max) that triggers force-push
const ENRAGE_GAP_OFF = 0.12;      // gap at which the enrage releases (hysteresis)
const ENRAGE_SPEED = 1.6;         // (the ×1.5 contact-damage half lives in run.ts updateEnemies)
const HUNK_VOLLEY = 3.0;          // seconds between diff-hunk volleys (each half has its own
                                  // clock post-split; an enraged half fires at ×0.55 period)
const HUNK_SPEED = 200;
const HUNK_DMG = 11;              // (scaled by tier)
const POOL_PERIOD = 3.5;          // leak drip interval (was 4 with expiring pools)
const POOL_CAP = 28;              // perf/readability cap; oldest pool gets paged out
const GLOB_PERIOD = 4.0;          // heap-glob volley interval (bullet layer)
const GLOB_SPEED = 150;           // slow, readable lobs — the dodge is easy, the
                                  // area denial where you WERE standing is the point
const GLOB_DMG = 10;              // direct hit (scaled by tier)
const GLOB_SPLASH = 55;           // splash puddle radius
const GLOB_SPLASH_LIFE = 4;       // splash puddles are short-lived (≠ permanent pools)
const SNAP_PERIOD = 7;            // seconds between position snapshots
const SNAP_DELAY = 2.5;           // marker shown this long before the rewind fires
const POP_STUN = 2.5;             // stack-pop stun duration
const POP_COOLDOWN = 10;          // min seconds between pops (no perma-stun from AoE)
const FRAMES_ARMOR = 0.5;         // damage taken while stack frames live
const PILLAR_COUNT = 3;
const PILLAR_RING = 170;          // pillar orbit distance — wide, so pillars enter the
                                  // player's weapon envelope well before the boss core does
const PILLAR_SPIN = 0.4;          // pillar orbit speed (rad/s) — they travel with the boss
const EXPOSED_T = 5;              // exposed-core seconds once every pillar is down
const LEGACY_BUG_PERIOD = 8;      // legacy code breeds: extra bug pair every N s —
                                  // pressure, not a meat shield: at 4.5s the bred swarm
                                  // absorbed all auto-aim and the boss never died (sim)
const LEGACY_BUG_CEILING = 300;   // stop breeding while the field is this crowded
                                  // (never let the monolith pin the global enemy cap)
const LEGACY_BUG_RING = [120, 220] as const; // …this far around the monolith

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
  const scale = run.map.enemyScale ?? 1; // per-map meta-gating multiplier
  const hp = def.hp * scale * (1 + tier * BOSS_TIER_HP_MULT);
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
    scaledDamage: def.damage * scale * (1 + tier * BOSS_TIER_DMG_MULT),
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
        // both halves start at a full bar (SPLIT_HP of the original pool each);
        // equal maxHp also keeps the enrage-gap threshold symmetric
        const half = e.maxHp * SPLIT_HP;
        const clone = run.makeEnemyFrom(e);
        clone.splitDone = true;
        clone.hp = half; clone.maxHp = half;
        e.hp = half; e.maxHp = half;
        clone.x += rand(60, 120); clone.y += rand(-60, 60);
        // stagger the halves' volley clocks so the hunks arrive as a stream
        e.mechT = HUNK_VOLLEY; clone.mechT = HUNK_VOLLEY * 0.5;
        run.enemies.push(clone);
        run.emit({ type: 'explosion', x: e.x, y: e.y, radius: 90, color: def.color });
      }
      // bullet layer: aimed diff-hunk fans — 3 shots whole, 4 per half once
      // split (and faster while force-push enraged)
      e.mechT -= dt;
      if (e.mechT <= 0) {
        e.mechT = HUNK_VOLLEY * (e.enraged ? 0.55 : 1);
        const base = Math.atan2(run.py - e.y, run.px - e.x);
        const spreads = e.splitDone ? [-0.33, -0.11, 0.11, 0.33] : [-0.25, 0, 0.25];
        for (const spread of spreads) {
          run.enemyShots.push({
            x: e.x, y: e.y,
            vx: Math.cos(base + spread) * HUNK_SPEED, vy: Math.sin(base + spread) * HUNK_SPEED,
            damage: HUNK_DMG * (1 + e.bossTier * 0.25), radius: 8, life: 4.5, color: def.color,
          });
        }
      }
      if (e.splitDone) updateDiffTether(run, e, dt);
      break;

    case 'pools': {
      e.mechT -= dt;
      if (e.mechT <= 0) {
        e.mechT = POOL_PERIOD;
        // pools never free while it lives — only the cap recycles the oldest
        // one (the OS pages it out). Death reclaims them all (run.killEnemy).
        let count = 0;
        let oldest: GroundZone | null = null;
        for (const z of run.zones) {
          // finite-life zones are glob splashes — they expire on their own and
          // must neither count toward nor page out the permanent pools
          if (z.kind !== 'leak' || Number.isFinite(z.life)) continue;
          count++;
          if (!oldest || (z.age ?? 0) > (oldest.age ?? 0)) oldest = z;
        }
        if (count >= POOL_CAP && oldest) run.zones.splice(run.zones.indexOf(oldest), 1);
        run.zones.push({
          kind: 'leak', x: e.x, y: e.y,
          radius: 35, maxRadius: 110,
          life: Infinity, maxLife: Infinity, age: 0,
          dps: 12 * (1 + e.bossTier * 0.3),
        });
      }
      // bullet layer: lob heap globs at (around) the player — slow projectiles
      // that splash short-lived puddles where they land, denying the ground
      // you're kiting across in addition to the permanent pools
      e.mechT2 -= dt;
      if (e.mechT2 <= 0) {
        e.mechT2 = GLOB_PERIOD;
        for (let i = 0; i < 3; i++) {
          const tx = run.px + rand(-70, 70), ty = run.py + rand(-70, 70);
          const a = Math.atan2(ty - e.y, tx - e.x);
          run.enemyShots.push({
            x: e.x, y: e.y,
            vx: Math.cos(a) * GLOB_SPEED, vy: Math.sin(a) * GLOB_SPEED,
            damage: GLOB_DMG * (1 + e.bossTier * 0.25), radius: 10,
            // life = flight time to the target point: the glob "lands" there
            life: clamp(dist(e.x, e.y, tx, ty) / GLOB_SPEED, 0.8, 3.2),
            color: def.color,
            splash: { radius: GLOB_SPLASH, dps: 10 * (1 + e.bossTier * 0.3), life: GLOB_SPLASH_LIFE },
          });
        }
      }
      break;
    }

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
      // second layer: snapshot the player's position, rewind them to it later —
      // wherever you stand now, you must survive standing again in SNAP_DELAY s
      if ((e.snapT ?? 0) > 0) {
        e.snapT = e.snapT! - dt;
        if (e.snapT <= 0) {
          run.px = e.snapX!; run.py = e.snapY!;
          run.emit({ type: 'rewind', x: run.px, y: run.py });
          e.mechT2 = SNAP_PERIOD;
        }
      } else {
        e.mechT2 -= dt;
        if (e.mechT2 <= 0) {
          e.snapX = run.px; e.snapY = run.py; e.snapT = SNAP_DELAY;
          run.emit({ type: 'snapshot', x: run.px, y: run.py });
        }
      }
      break;

    case 'summon': {
      e.mechT -= dt;
      if (e.mechT <= 0) {
        e.mechT = 5;
        for (let i = 0; i < 5; i++) {
          const a = Math.random() * Math.PI * 2;
          const mite = makeEnemy(run, ENEMIES.syntaxMite, e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70, false);
          mite.stackFrame = true;
          run.enemies.push(mite);
        }
      }
      e.mechT2 -= dt;
      if (e.mechT2 <= 0) {
        e.mechT2 = 3;
        const base = Math.atan2(run.py - e.y, run.px - e.x);
        for (const spread of [-0.44, -0.22, 0, 0.22, 0.44]) {
          run.enemyShots.push({
            x: e.x, y: e.y,
            vx: Math.cos(base + spread) * 230, vy: Math.sin(base + spread) * 230,
            damage: 15 * (1 + e.bossTier * 0.25), radius: 10, life: 4.5, color: def.color,
          });
        }
      }
      // second layer: live frames guard it; clearing the whole stack pops it
      let frames = 0;
      for (const o of run.enemies) if (o.stackFrame) frames++;
      e.armorMult = frames > 0 ? FRAMES_ARMOR : 1;
      e.popCdT = Math.max(0, (e.popCdT ?? 0) - dt);
      if (frames === 0 && (e.addsAlive ?? 0) > 0 && e.popCdT === 0) {
        e.frozenT = Math.max(e.frozenT, POP_STUN);
        e.mechT = Math.max(e.mechT, POP_STUN + 1);  // no resummon during the burst window
        e.mechT2 = Math.max(e.mechT2, POP_STUN);    // and no shots while stunned
        e.popCdT = POP_COOLDOWN;
        run.emit({ type: 'stackPop', x: e.x, y: e.y });
      }
      e.addsAlive = frames;
      break;
    }

    case 'phase': {
      if (e.phase === 'armored') {
        // second layer: the armor holds until EVERY propping pillar is destroyed
        // — no timer out. Pillars orbit the monolith (slot angle parked in
        // jitterAng at spawn) so they travel with it: the boss closing in is
        // also what brings its dependencies into weapon range — without this,
        // kiting leaves the stationary pillars behind and melee/orbit builds
        // could never break the armor (sim-verified failure mode).
        let pillars = 0;
        for (const o of run.enemies) {
          if (o.def !== ENEMIES.deprecatedDependency) continue;
          pillars++;
          const a = o.jitterAng + run.time * PILLAR_SPIN;
          o.x = e.x + Math.cos(a) * PILLAR_RING;
          o.y = e.y + Math.sin(a) * PILLAR_RING;
        }
        e.addsAlive = pillars;
        if (pillars === 0) {
          e.phase = 'exposed'; e.phaseT = EXPOSED_T;
          run.emit({ type: 'coreExposed', x: e.x, y: e.y });
        }
      } else {
        e.phaseT -= dt;
        if (e.phaseT <= 0) {
          e.phase = 'armored';
          spawnPillars(run, e);
        }
      }
      // legacy code breeds bugs: the longer it stands, the more crawl out of it
      e.mechT -= dt;
      if (e.mechT <= 0 && run.enemies.length < LEGACY_BUG_CEILING) {
        e.mechT = LEGACY_BUG_PERIOD;
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = rand(LEGACY_BUG_RING[0], LEGACY_BUG_RING[1]);
          run.enemies.push(makeEnemy(run, randomPhaseEnemyDef(run), e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, false));
        }
      }
      e.armorMult = e.phase === 'armored' ? 0.25 : 1;
      // armored: near-full advance — the shield wall must actually reach a
      // kiting player or the pillars never enter weapon range (sim-verified:
      // at 0.75× the bot outran the boss for 5 straight minutes); exposed: march
      e.scaledSpeed = def.speed * (e.phase === 'armored' ? 0.95 : 1.1);
      break;
    }
  }
}

/** Merge Conflict post-split: a damaging diff beam links the halves, and an HP
 *  gap beyond ENRAGE_GAP_ON force-push enrages the healthier half (contact
 *  damage ×1.5 in run.ts, speed ×ENRAGE_SPEED here) until the gap closes
 *  below ENRAGE_GAP_OFF. Spread your damage. */
function updateDiffTether(run: Run, e: Enemy, dt: number): void {
  const twin = run.enemies.find((o) => o !== e && o.isBoss && o.def === e.def && o.splitDone);
  if (!twin) { e.enraged = false; e.scaledSpeed = (e.def as BossDef).speed; return; }
  // the pair reaches here twice per frame — the lower-index half owns the update
  if (run.enemies.indexOf(e) > run.enemies.indexOf(twin)) return;

  if (segDist(run.px, run.py, e.x, e.y, twin.x, twin.y) < TETHER_WIDTH) {
    run.hurtPlayer(TETHER_DPS * (1 + e.bossTier * 0.25) * dt);
  }

  const gap = Math.abs(e.hp - twin.hp);
  const strong = e.hp >= twin.hp ? e : twin;
  const weak = strong === e ? twin : e;
  if (gap > e.maxHp * ENRAGE_GAP_ON && !strong.enraged) {
    strong.enraged = true;
    run.emit({ type: 'forcePush', x: strong.x, y: strong.y });
  } else if (gap < e.maxHp * ENRAGE_GAP_OFF) {
    strong.enraged = false;
  }
  weak.enraged = false;
  for (const half of [e, twin]) {
    half.scaledSpeed = (half.def as BossDef).speed * (half.enraged ? ENRAGE_SPEED : 1);
  }
}

/** Distance from point (px,py) to the segment (ax,ay)–(bx,by). */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return dist(px, py, ax + dx * t, ay + dy * t);
}

function spawnPillars(run: Run, boss: Enemy): void {
  const base = Math.random() * Math.PI * 2;
  for (let i = 0; i < PILLAR_COUNT; i++) {
    const a = base + (i * Math.PI * 2) / PILLAR_COUNT;
    const p = makeEnemy(
      run, ENEMIES.deprecatedDependency,
      boss.x + Math.cos(a) * PILLAR_RING, boss.y + Math.sin(a) * PILLAR_RING, false,
    );
    // orbit slot (the armored monolith drives positions from this); offset by
    // spawn time so slot + time*spin starts exactly at the placement angle
    p.jitterAng = a - run.time * PILLAR_SPIN;
    run.enemies.push(p);
  }
  boss.addsAlive = PILLAR_COUNT;
}

/** Remove every pillar (the monolith died mid-armor — nothing left to prop). */
export function crumblePillars(run: Run): void {
  for (let i = run.enemies.length - 1; i >= 0; i--) {
    const o = run.enemies[i];
    if (o.def === ENEMIES.deprecatedDependency) {
      run.emit({ type: 'kill', x: o.x, y: o.y, color: o.def.color, big: false });
      run.removeEnemy(i);
    }
  }
}
