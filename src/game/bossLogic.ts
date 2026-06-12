import { BOSSES, BOSS_INTERVAL, BOSS_WARNING_LEAD, BOSS_TIER_HP_MULT, BOSS_TIER_DMG_MULT } from '../data/bosses';
import { ENEMIES } from '../data/enemies';
import type { BossDef } from '../data/types';
import { clamp, dist, rand } from '../core/util';
import { makeEnemy, randomPhaseEnemyDef } from './spawner';
import type { Enemy, GroundZone, Run } from './run';

// Boss scheduling (tier system): one boss every BOSS_INTERVAL seconds. The
// 2-minute slots draw STANDARD bosses from the map's weighted bossPool —
// random, no immediate repeat, and the 2:00 opener only draws light bosses.
// The fixed UNIQUE_SLOT (12:00) always spawns the map's unique finale.
// Escalation comes from the per-slot tier multiplier (bossIndex), not the
// draw order. The draw for each slot happens once (run.nextBossId) so the
// warning banner and the spawn always agree.
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
// race condition (teleport)
const TP_PERIOD = 4.2;            // seconds between blinks
const TP_RANGE = [170, 300] as const; // arrival distance from the player
const TP_FAN = [-0.3, -0.1, 0.1, 0.3]; // aimed arrival volley spreads
const TP_SHOT_SPEED = 215;
const TP_SHOT_DMG = 12;           // (scaled by tier)
const IMAGE_LIFE = 4.2;           // afterimage fuse — kill it before this runs out
const IMAGE_HP = 0.03;            // fragile ghost: any real hit resolves the race in
                                  // the player's favor — the cost is attention/aim,
                                  // not DPS (at 0.07 a kiting build that never faced
                                  // the image stalled the fight on heals — sim-caught)
const IMAGE_DMG = 0.6;            // afterimage contact dps, fraction of the boss's
const RACE_HEAL = 0.03;           // boss heal per race lost (fraction of max HP) —
                                  // sustain, not a wall: a player who ignores every
                                  // image must still be able to grind it down
// critical exception (slam)
const SLAM_PERIOD_HI = 3.4;       // cast cadence at full HP…
const SLAM_PERIOD_LO = 1.7;       // …accelerating linearly to this at 0 HP
const SLAM_TELEGRAPH = 1.25;      // dodge window
const SLAM_RADIUS = 130;
const SLAM_DMG = 32;              // (scaled by tier); shards deal 35% of it
const SLAM_SHARDS = 7;
const SLAM_DOUBLE_BELOW = 0.5;    // HP fraction under which every cast is a double
const SLAM_LEAD = 110;            // second slam leads the player's heading by this
// production incident (pools + frame guard)
const INC_POOL_PERIOD = 4.5;      // slower drip than the Leak's (it has two jobs)
const INC_FAN_PERIOD = 3.4;
const INC_FAN = [-0.33, -0.11, 0.11, 0.33];
const INC_SUMMON_PERIOD = 12;     // longer guard downtime than the Overflow's 5s —
const INC_SUMMON_N = 3;           // the incident has two other jobs running
// kernel panic (chill rings + hard-freeze rhythm)
const RING_PERIOD = 3.0;
const RING_N = 14;
const RING_SPEED = 165;           // slow, readable expanding ring
const RING_DMG = 12;              // (scaled by tier)
const CHILL_DUR = 1.6;            // player lag (CHILL_SLOW in run.ts) per shard hit
const PANIC_THRESHOLDS = [0.7, 0.35]; // HP fractions that trigger a hard freeze
const FREEZE_T = 4;               // locked up: heavy armor, blizzard volleys
const FREEZE_ARMOR = 0.15;
const FREEZE_RING_MULT = 0.45;    // ring period multiplier while frozen
const THAW_T = 4;                 // vulnerable window after the freeze
const THAW_ARMOR = 1.5;           // damage-taken multiplier — strike the thaw

const UNIQUE_SLOT = 5;            // 2:00 + 5×120s = 12:00 — the finale slot
const LIGHT_SLOT_MAX_HP = 800;    // the 2:00 opener (no build yet) AND every
                                  // post-finale slot (feature freeze: the 14:00
                                  // boss has ~60s + crunch to die — a tier-6
                                  // Stack Overflow there was an auto-slip,
                                  // sim-caught) draw only light bosses

export function updateBossSchedule(run: Run, _dt: number): void {
  if (run.nextBossId === null || !BOSSES[run.nextBossId]) {
    run.nextBossId = drawBossId(run, run.bossIndex);
  }
  const def = BOSSES[run.nextBossId];

  if (!run.bossWarned && run.time >= run.nextBossAt - BOSS_WARNING_LEAD) {
    run.bossWarned = true;
    run.emit({ type: 'bossWarning', name: def.name });
  }
  if (run.time >= run.nextBossAt) {
    spawnBoss(run, def, run.bossIndex);
    run.lastBossId = run.nextBossId;
    run.nextBossId = null;
    run.bossIndex++;
    run.nextBossAt += BOSS_INTERVAL;
    run.bossWarned = false;
  }
}

/** Weighted draw from the map's standard pool (unique finale at its fixed
 *  slot). No immediate repeats; the opener slot filters to light bosses. */
function drawBossId(run: Run, index: number): string {
  if (index === UNIQUE_SLOT) return run.map.uniqueBoss;
  let entries = Object.entries(run.map.bossPool);
  if (index === 0 || index > UNIQUE_SLOT) {
    const light = entries.filter(([id]) => BOSSES[id].hp <= LIGHT_SLOT_MAX_HP);
    if (light.length) entries = light;
  }
  const fresh = entries.filter(([id]) => id !== run.lastBossId);
  if (fresh.length) entries = fresh;
  let total = 0;
  for (const [, w] of entries) total += w;
  let roll = Math.random() * total;
  for (const [id, w] of entries) {
    roll -= w;
    if (roll <= 0) return id;
  }
  return entries[entries.length - 1][0];
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
    mechT: 2, mechT2: 1.5, mechT3: 2.5,
    burstPeriod: 3.2,
    phase: 'exposed', phaseT: 4,
    splitDone: false,
    facing: 0,
    scaledSpeed: def.speed,
    scaledDamage: def.damage * scale * (1 + tier * BOSS_TIER_DMG_MULT),
  };
  run.enemies.push(boss);
  run.spawnedKinds.add(`boss:${def.id}`); // codex discovery (progressive unlocks)
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
        dripLeakPool(run, e);
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
        // 6s (was 5): frame HP difficulty-scales, so late-slot Overflows kept
        // the guard up near-permanently and stalled the whole boss queue
        e.mechT = 6;
        summonStackFrames(run, e, 5);
      }
      e.mechT2 -= dt;
      if (e.mechT2 <= 0) {
        e.mechT2 = 3;
        aimedFan(run, e, [-0.44, -0.22, 0, 0.22, 0.44], 230, 15);
      }
      // second layer: live frames guard it; clearing the whole stack pops it
      if (updateFrameGuard(run, e, dt)) {
        e.mechT = Math.max(e.mechT, POP_STUN + 1);  // no resummon during the burst window
        e.mechT2 = Math.max(e.mechT2, POP_STUN);    // and no shots while stunned
      }
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

    case 'teleport': {
      e.mechT -= dt;
      if (e.mechT <= 0) {
        e.mechT = TP_PERIOD;
        // the afterimage stays where it was — a race the player must win
        const img = run.makeEnemyFrom(e);
        img.isBoss = false;
        img.raceImage = true;
        img.copyT = IMAGE_LIFE;
        img.hp = e.maxHp * IMAGE_HP; img.maxHp = img.hp;
        img.scaledDamage = (e.scaledDamage ?? def.damage) * IMAGE_DMG;
        img.armorMult = undefined; img.enraged = false;
        run.enemies.push(img);
        // blink to a random bearing at mid range and fire on arrival
        const a = Math.random() * Math.PI * 2;
        const d = rand(TP_RANGE[0], TP_RANGE[1]);
        e.x = run.px + Math.cos(a) * d;
        e.y = run.py + Math.sin(a) * d;
        run.emit({ type: 'teleport', x: e.x, y: e.y });
        aimedFan(run, e, TP_FAN, TP_SHOT_SPEED, TP_SHOT_DMG);
      }
      // own the afterimages (first teleport boss only, if several ever stack):
      // an image expiring unkilled resolves the race in the boss's favor
      const owner = run.enemies.find((o) => o.isBoss && (o.def as BossDef).mechanic === 'teleport');
      if (owner !== e) break;
      for (let i = run.enemies.length - 1; i >= 0; i--) {
        const img = run.enemies[i];
        if (!img.raceImage) continue;
        img.copyT -= dt;
        if (img.copyT <= 0) {
          run.removeEnemy(i);
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * RACE_HEAL);
          run.emit({ type: 'raceResolved', x: e.x, y: e.y });
        }
      }
      break;
    }

    case 'slam': {
      e.mechT -= dt;
      if (e.mechT <= 0) {
        // cadence accelerates as its health drops — the dodge-window boss
        // becomes a DPS race: end it before the floor is all telegraphs
        const frac = clamp(e.hp / e.maxHp, 0, 1);
        e.mechT = SLAM_PERIOD_LO + (SLAM_PERIOD_HI - SLAM_PERIOD_LO) * frac;
        const dmg = SLAM_DMG * (1 + e.bossTier * 0.25);
        const casts = frac < SLAM_DOUBLE_BELOW ? 2 : 1;
        for (let i = 0; i < casts; i++) {
          // first slam on the player; the second leads the escape heading
          const hx = run.px - run.prevPx, hy = run.py - run.prevPy;
          const hl = Math.hypot(hx, hy) || 1;
          const lead = i === 0 ? 0 : SLAM_LEAD;
          run.slams.push({
            x: run.px + (hx / hl) * lead + rand(-30, 30),
            y: run.py + (hy / hl) * lead + rand(-30, 30),
            radius: SLAM_RADIUS, t: SLAM_TELEGRAPH, maxT: SLAM_TELEGRAPH,
            damage: dmg, shards: SLAM_SHARDS, color: def.color,
          });
        }
      }
      break;
    }

    case 'incident': {
      // two incidents at once: the Leak's permanent pools + the Overflow's
      // frame guard (shared stackFrame flag — a concurrent Stack Overflow
      // sharing frames is thematic, not a bug), plus aimed volleys
      e.mechT -= dt;
      if (e.mechT <= 0) {
        e.mechT = INC_POOL_PERIOD;
        dripLeakPool(run, e);
      }
      e.mechT2 -= dt;
      if (e.mechT2 <= 0) {
        e.mechT2 = INC_FAN_PERIOD;
        aimedFan(run, e, INC_FAN, 220, 14);
      }
      e.mechT3 = (e.mechT3 ?? 2.5) - dt;
      if (e.mechT3 <= 0) {
        e.mechT3 = INC_SUMMON_PERIOD;
        summonStackFrames(run, e, INC_SUMMON_N);
      }
      if (updateFrameGuard(run, e, dt)) {
        e.mechT2 = Math.max(e.mechT2, POP_STUN);     // no volleys while stunned
        e.mechT3 = Math.max(e.mechT3, POP_STUN + 1); // no resummon during the burst window
      }
      break;
    }

    case 'panic': {
      // hard-freeze rhythm: HP thresholds lock it up (heavy armor, blizzard),
      // then it thaws into a vulnerable burst window — an interrupt-less
      // interrupt fight: the build test is hitting hard WHEN it lets you
      const state = e.panicState ?? 'normal';
      if (state === 'normal') {
        e.armorMult = 1;
        e.scaledSpeed = def.speed;
        const stage = e.panicStage ?? 0;
        if (stage < PANIC_THRESHOLDS.length && e.hp <= e.maxHp * PANIC_THRESHOLDS[stage]) {
          e.panicStage = stage + 1;
          e.panicState = 'frozen';
          e.panicT = FREEZE_T;
          run.emit({ type: 'hardFreeze', x: e.x, y: e.y });
        }
      } else {
        e.panicT = (e.panicT ?? 0) - dt;
        if (state === 'frozen') {
          e.armorMult = FREEZE_ARMOR;
          e.scaledSpeed = 0; // locked up solid
          if (e.panicT <= 0) {
            e.panicState = 'thaw';
            e.panicT = THAW_T;
            run.emit({ type: 'thaw', x: e.x, y: e.y });
          }
        } else {
          e.armorMult = THAW_ARMOR; // takes extra damage — strike now
          e.scaledSpeed = def.speed;
          if (e.panicT <= 0) {
            e.panicState = 'normal';
            e.armorMult = 1;
          }
        }
      }
      // bullet layer: expanding chill-shard rings, a blizzard while frozen
      e.mechT -= dt;
      if (e.mechT <= 0) {
        e.mechT = RING_PERIOD * (e.panicState === 'frozen' ? FREEZE_RING_MULT : 1);
        const offset = Math.random() * Math.PI * 2;
        for (let i = 0; i < RING_N; i++) {
          const a = offset + (Math.PI * 2 * i) / RING_N;
          run.enemyShots.push({
            x: e.x, y: e.y,
            vx: Math.cos(a) * RING_SPEED, vy: Math.sin(a) * RING_SPEED,
            damage: RING_DMG * (1 + e.bossTier * 0.25), radius: 9, life: 5,
            color: def.color, chillDur: CHILL_DUR,
          });
        }
      }
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

/** Drip one permanent leak pool at the boss (Memory Leak + Production
 *  Incident). Pools never free while the owner lives — only the cap recycles
 *  the oldest one (the OS pages it out). Death reclaims them all
 *  (run.killEnemy). Finite-life zones are glob splashes and must neither
 *  count toward nor page out the permanent pools. */
function dripLeakPool(run: Run, e: Enemy): void {
  let count = 0;
  let oldest: GroundZone | null = null;
  for (const z of run.zones) {
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

/** Aimed fan volley at the player (tier-scaled damage). */
function aimedFan(run: Run, e: Enemy, spreads: readonly number[], speed: number, dmg: number): void {
  const base = Math.atan2(run.py - e.y, run.px - e.x);
  for (const spread of spreads) {
    run.enemyShots.push({
      x: e.x, y: e.y,
      vx: Math.cos(base + spread) * speed, vy: Math.sin(base + spread) * speed,
      damage: dmg * (1 + e.bossTier * 0.25), radius: 10, life: 4.5,
      color: (e.def as BossDef).color,
    });
  }
}

/** Summon n stack-frame mites around the boss (Stack Overflow + Incident). */
function summonStackFrames(run: Run, e: Enemy, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const mite = makeEnemy(run, ENEMIES.syntaxMite, e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70, false);
    mite.stackFrame = true;
    run.enemies.push(mite);
  }
}

/** Frame-guard layer: live stack frames halve damage taken; clearing the
 *  whole stack pops the boss (stun at full vulnerability, cooldown-gated).
 *  Returns true on the frame a pop fires so the caller can push its own
 *  mechanic clocks past the stun. */
function updateFrameGuard(run: Run, e: Enemy, dt: number): boolean {
  let frames = 0;
  for (const o of run.enemies) if (o.stackFrame) frames++;
  e.armorMult = frames > 0 ? FRAMES_ARMOR : 1;
  e.popCdT = Math.max(0, (e.popCdT ?? 0) - dt);
  let popped = false;
  if (frames === 0 && (e.addsAlive ?? 0) > 0 && e.popCdT === 0) {
    e.frozenT = Math.max(e.frozenT, POP_STUN);
    e.popCdT = POP_COOLDOWN;
    popped = true;
    run.emit({ type: 'stackPop', x: e.x, y: e.y });
  }
  e.addsAlive = frames;
  return popped;
}

/** Remove every race-condition afterimage (the boss died — every pending
 *  race resolves in the player's favor). */
export function fadeRaceImages(run: Run): void {
  for (let i = run.enemies.length - 1; i >= 0; i--) {
    const o = run.enemies[i];
    if (o.raceImage) {
      run.emit({ type: 'kill', x: o.x, y: o.y, color: o.def.color, big: false });
      run.removeEnemy(i);
    }
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
