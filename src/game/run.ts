import type { BossDef, CharacterDef, EnemyDef, MapDef, RunStatsView, StatMods, UpgradeCard, WeaponDef } from '../data/types';
import { WEAPONS } from '../data/weapons';
import { RUN_DURATION } from '../data/maps';
import { OBJECTIVES, OBJECTIVE_BITS } from '../data/objectives';
import { BOSS_BITS } from '../data/bosses';
import { SpatialHash } from '../core/spatial';
import { moveVector } from '../core/input';
import { clamp, dist, mulberry32, pick, rand } from '../core/util';
import { computeStats, type ComputedStats } from './stats';
import { updateWeapons } from './combat';
import { updateSpawner, SPAWN_RADIUS } from './spawner';
import { updateBossSchedule, updateBossMechanics, crumblePillars } from './bossLogic';

// ---------- entities ----------

export interface Enemy {
  def: EnemyDef | BossDef;
  x: number; y: number;
  hp: number; maxHp: number;
  elite: boolean;
  isBoss: boolean;
  // status
  slowT: number; slowAmt: number;
  frozenT: number;
  hitFlash: number;
  matchMarkT: number;          // Perfect Match debuff: +25% damage taken
  knockX: number; knockY: number;
  // behavior state
  chargePhase: 0 | 1 | 2 | 3;  // 0 approach, 1 windup, 2 dash, 3 recover
  chargeT: number;
  dashX: number; dashY: number;
  jitterT: number; jitterAng: number;
  dupT: number;
  isCopy: boolean; copyT: number;
  // boss state
  bossTier: number;
  mechT: number;
  mechT2: number;
  burstPeriod: number;
  phase: 'armored' | 'exposed';
  phaseT: number;
  splitDone: boolean;
  // boss second-layer state (optional: absent on pre-rework suspended runs)
  armorMult?: number;     // damage-taken multiplier, set per-frame by bossLogic (1 = normal)
  enraged?: boolean;      // merge-conflict half under force-push (+damage, +speed)
  snapX?: number; snapY?: number; snapT?: number; // infinite-loop position snapshot + rewind countdown
  addsAlive?: number;     // last frame's live add count (stack frames / pillars) for drop detection
  popCdT?: number;        // stack-pop re-trigger cooldown
  stackFrame?: boolean;   // this enemy is a Stack Overflow stack frame (summoned mite)
  facing: number;              // for rendering
  // difficulty-scaled values stamped at spawn time
  scaledSpeed?: number;
  scaledDamage?: number;
}

export interface Projectile {
  x: number; y: number; vx: number; vy: number;
  damage: number; radius: number; pierce: number; life: number;
  slow: number; slowDur: number; freeze: number;
  color: string;
  kind: 'bolt' | 'arrow' | 'petbolt';
  hit: Set<Enemy>;
  source?: WeaponInstance;   // damage credit; undefined = ally (turret)
}

export interface EnemyShot {
  x: number; y: number; vx: number; vy: number;
  damage: number; radius: number; life: number; color: string;
}

export interface Pickup {
  kind: 'xp' | 'hp' | 'chest';
  x: number; y: number;
  value: number;
  magnet: boolean;
  vx: number; vy: number;
  bossTier?: number;
}

export interface GroundZone {
  kind: 'leak' | 'marsh';
  x: number; y: number;
  radius: number; maxRadius: number;
  life: number; maxLife: number;   // marsh + boss leak zones: life = Infinity
  dps: number;
  age?: number;                    // leak zones grow with age (life can be Infinity)
}

export interface Ally {
  kind: 'turret' | 'helper';
  x: number; y: number;
  life: number;
  shootT: number;
}

/** The Precipitate (easter egg): not an Enemy — it never enters run.enemies,
 *  so weapons, the spatial hash, the enemy cap, straggler recycling and kill
 *  stats all ignore it by construction. Purely functional: no side effects. */
export interface Mushi {
  x: number; y: number;
  t: number;                       // seconds until it evaporates
  jitterT: number; jitterAng: number; // Brownian-motion walk state
}

// Avogadro skeleton: ~25% of runs, precipitates around the 6:02 mark,
// evaporates after 23 s; collecting it yields 602 XP (+ a chest + 23 Bits).
export const MUSHI_CHANCE = 0.25;
export const MUSHI_AT_SEC = 362;
export const MUSHI_AT_JITTER = 60;
export const MUSHI_LIFE = 23;
export const MUSHI_XP = 602;       // dropped as 7 shards × 86
export const MUSHI_BITS = 23;
export const MUSHI_SPEED = 60;
export const MUSHI_RADIUS = 8;

export interface WeaponInstance {
  def: WeaponDef;
  level: number;             // 1-based
  timer: number;
  orbitAngle: number;
  petTimers: number[];
  hitMemo: Map<Enemy, number>;  // last hit time, for orbit contact damage
  totalDamage: number;       // damage dealt, carries through evolution
  acquiredAt: number;        // run.time when added (DPS denominator)
}

export type RunEvent =
  | { type: 'kill'; x: number; y: number; color: string; big: boolean }
  | { type: 'damage'; x: number; y: number; value: number; crit: boolean }
  | { type: 'shockwave'; x: number; y: number; radius: number; color: string }
  | { type: 'sweep'; x: number; y: number; angle: number; radius: number; full: boolean; color: string }
  | { type: 'chain'; points: { x: number; y: number }[]; color: string }
  | { type: 'column'; x: number; y: number; radius: number; color: string }
  | { type: 'explosion'; x: number; y: number; radius: number; color: string }
  | { type: 'shoot' }
  | { type: 'hurt' }
  | { type: 'heal'; x: number; y: number; amount: number }
  | { type: 'pickupXp' }
  | { type: 'pickupHp' }
  | { type: 'levelup' }
  | { type: 'bossWarning'; name: string }
  | { type: 'bossSpawn'; name: string }
  | { type: 'bossDie'; x: number; y: number; name: string }
  | { type: 'snapshot'; x: number; y: number }                  // infinite loop marks the rewind point
  | { type: 'rewind'; x: number; y: number }                    // player yanked back to the snapshot
  | { type: 'forcePush'; x: number; y: number }                 // merge-conflict half enrages (HP gap)
  | { type: 'stackPop'; x: number; y: number }                  // stack overflow stunned (frames cleared)
  | { type: 'coreExposed'; x: number; y: number }               // monolith armor broken early (pillar down)
  | { type: 'memoryFreed'; pools: { x: number; y: number }[] }  // memory leak died; pools reclaimed
  | { type: 'crunch' }                                          // 15:00 with bosses alive: crunch time
  | { type: 'chest'; x: number; y: number }
  | { type: 'mushiSpawn'; x: number; y: number }
  | { type: 'mushiCaught'; x: number; y: number }
  | { type: 'mushiGone'; x: number; y: number }
  | { type: 'evolve'; weaponName: string; evolvedName: string }
  | { type: 'bonusCard'; cardName: string }
  | { type: 'objective'; name: string }
  | { type: 'victory' }
  | { type: 'death' };

export interface RunResults {
  timeSec: number;
  kills: number;
  level: number;
  bossKills: number;
  victory: boolean;
  releaseFailed: boolean; // defeat flavor: blockers outlived crunch time (not a death)
  newObjectives: string[];
  bits: number;
  bitsBreakdown: { label: string; value: number }[];
  weaponDamage: { icon: string; name: string; color: string; level: number; isEvolution: boolean; damage: number; dps: number }[];
  allyDamage: number;
}

// ---------- the run ----------

/** Crunch Time: overtime seconds granted at 15:00 to resolve live release blockers. */
export const CRUNCH_DURATION = 30;
/** Crunch adrenaline: player damage / move-speed multipliers while crunching. */
export const CRUNCH_DMG_MULT = 1.5;
export const CRUNCH_SPEED_MULT = 1.15;

export class Run {
  time = 0;
  over = false;
  victory = false;
  // Crunch Time: the release ships at 15:00 — bosses still alive then are
  // release blockers. The run gets CRUNCH_DURATION seconds of overtime (trash
  // descoped, spawner frozen, crunch buffs); blockers outliving it fail the run.
  crunchStarted = false;
  crunchT = 0;          // remaining overtime; > 0 while crunching
  releaseFailed = false;

  // player
  px = 0; py = 0;
  prevPx = 0; prevPy = 0; // last frame's position — spawner reads it for recycle heading bias
  hp: number;
  faceX = 1; faceY = 0;
  hurtFlash = 0;
  healAccum = 0; // sub-1HP heals (regen ticks) pool here until a whole point is shown
  playerSlow = 1;     // recomputed each frame (scarab aura, marsh pools)
  invincible = false; // turbo/debug
  // State-injection hook (dev console, future sim scenarios): weapon/card ids
  // that makeOffer() returns verbatim — instead of drawing — then clears.
  forcedOffer: string[] | null = null;

  stats: ComputedStats;
  cardMods: StatMods[] = [];
  takenCards = new Map<string, number>();
  banished = new Set<string>();
  rerollsLeft: number;
  banishesLeft: number;
  skipsLeft: number;

  weapons: WeaponInstance[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  enemyShots: EnemyShot[] = [];
  pickups: Pickup[] = [];
  zones: GroundZone[] = [];
  allies: Ally[] = [];
  grid = new SpatialHash<Enemy>(80);
  events: RunEvent[] = [];

  // progression
  level = 1;
  xp = 0;
  xpCollected = 0;
  pendingLevelUps = 0;

  // scoring
  kills = 0;
  bossKills = 0;
  allyDamage = 0;            // turret/helper damage (character specials)
  evolvedCount = 0;
  objectivesThisRun: string[] = [];

  // spawning
  spawnTimer = 0;
  nextBossAt = 120;
  bossIndex = 0;
  bossWarned = false;

  // character specials
  turretT = 6;
  helperT = 8;

  // The Precipitate: scheduled (or not) at construction; Infinity = not this run.
  mushi: Mushi | null = null;
  mushiAt = Math.random() < MUSHI_CHANCE
    ? MUSHI_AT_SEC + rand(-MUSHI_AT_JITTER, MUSHI_AT_JITTER)
    : Infinity;
  mushiCaught = false;

  objectiveCheckT = 0;
  rng = mulberry32(Date.now() & 0xffffffff);

  constructor(
    public character: CharacterDef,
    public map: MapDef,
    public metaLevels: Record<string, number>,
    public weaponPool: string[],                 // ids offerable this run
    public doneObjectives: Set<string>,          // lifetime-completed (excluded)
  ) {
    this.stats = computeStats(character, metaLevels, this.cardMods);
    this.hp = this.stats.maxHp;
    this.rerollsLeft = this.stats.rerolls;
    this.banishesLeft = this.stats.banishes;
    this.skipsLeft = this.stats.skips;
    // randomWeapon special (Rex): draw the starter from this run's offerable
    // pool (base weapons only) instead of the fixed character weapon.
    this.addWeapon(character.special === 'randomWeapon'
      ? pick(this.weaponPool.filter((id) => !WEAPONS[id]?.isEvolution))
      : character.weapon);

    if (map.hazardPools) {
      for (let i = 0; i < 26; i++) {
        const a = this.rng() * Math.PI * 2;
        const d = 240 + this.rng() * 1400;
        const r = 70 + this.rng() * 70;
        this.zones.push({
          kind: 'marsh', x: Math.cos(a) * d, y: Math.sin(a) * d,
          radius: r, maxRadius: r, life: Infinity, maxLife: Infinity, dps: 3,
        });
      }
    }
  }

  emit(e: RunEvent): void { this.events.push(e); }

  recompute(): void {
    const hpFrac = this.hp / this.stats.maxHp;
    this.stats = computeStats(this.character, this.metaLevels, this.cardMods);
    this.hp = clamp(hpFrac * this.stats.maxHp, 1, this.stats.maxHp);
  }

  addWeapon(id: string): void {
    const def = WEAPONS[id];
    this.weapons.push({
      def, level: 1, timer: 0.4, orbitAngle: 0,
      petTimers: [], hitMemo: new Map(),
      totalDamage: 0, acquiredAt: this.time,
    });
  }

  applyCard(card: UpgradeCard): void {
    this.cardMods.push(card.mods);
    this.takenCards.set(card.id, (this.takenCards.get(card.id) ?? 0) + 1);
    this.recompute();
  }

  evolveWeapon(w: WeaponInstance): void {
    const evolved = WEAPONS[w.def.evolveTo!];
    this.emit({ type: 'evolve', weaponName: w.def.name, evolvedName: evolved.name });
    w.def = evolved;
    w.level = 1;
    w.hitMemo.clear();
    this.evolvedCount++;
  }

  xpForLevel(l: number): number {
    return Math.round(10 + (l - 1) * 7 + Math.pow(l - 1, 1.9));
  }

  gainXp(v: number): void {
    const gained = v * this.stats.xpMult;
    this.xpCollected += gained;
    this.addXp(gained);
  }

  /** Skip = "Defer": bank 20% of the next level's XP requirement instead of taking a card.
   *  Banked XP is progression momentum only — it does not count as collected (no Bits). */
  deferLevel(): boolean {
    if (this.skipsLeft <= 0) return false;
    this.skipsLeft--;
    this.addXp(this.xpForLevel(this.level) * 0.2);
    return true;
  }

  private addXp(amount: number): void {
    this.xp += amount;
    while (this.xp >= this.xpForLevel(this.level)) {
      this.xp -= this.xpForLevel(this.level);
      this.level++;
      this.pendingLevelUps++;
      this.emit({ type: 'levelup' });
    }
  }

  private finishVictory(): void {
    this.over = true;
    this.victory = true;
    this.checkObjectives();
    this.emit({ type: 'victory' });
  }

  hurtPlayer(amount: number): void {
    if (this.invincible || this.over) return;
    const dmg = Math.max(0.5, amount - this.stats.armor);
    this.hp -= dmg;
    this.hurtFlash = 0.25;
    this.emit({ type: 'hurt' });
    if (this.hp <= 0) {
      this.hp = 0;
      this.over = true;
      this.victory = false;
      this.emit({ type: 'death' });
    }
  }

  healPlayer(amount: number): void {
    const healed = Math.min(amount, this.stats.maxHp - this.hp);
    if (healed <= 0 || this.over) return; // full HP / dead: no heal, no feedback
    this.hp += healed;
    this.healAccum += healed;
    if (this.healAccum >= 1) {
      const shown = Math.floor(this.healAccum);
      this.healAccum -= shown;
      this.emit({ type: 'heal', x: this.px, y: this.py, amount: shown });
    }
  }

  statsView(): RunStatsView {
    return {
      timeSec: this.time,
      kills: this.kills,
      level: this.level,
      bossKills: this.bossKills,
      xpCollected: this.xpCollected,
      evolvedWeapons: this.evolvedCount,
      victory: this.victory,
      characterId: this.character.id,
      mapId: this.map.id,
      mushiCaught: this.mushiCaught,
    };
  }

  // ---------- main update (fixed dt) ----------

  update(dt: number): void {
    if (this.over) return;
    this.time += dt;

    if (this.time >= RUN_DURATION) {
      const blockers = this.enemies.some((e) => e.isBoss);
      if (!this.crunchStarted) {
        if (!blockers) { this.finishVictory(); return; }
        // ship date reached with bosses alive: crunch time. Feature freeze —
        // the trash is descoped (no rewards), only the blockers (and the
        // Monolith's props) remain; the spawner stays frozen for the overtime.
        this.crunchStarted = true;
        this.crunchT = CRUNCH_DURATION;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          if (!e.isBoss && !(e.def as EnemyDef).stationary) this.removeEnemy(i);
        }
        this.emit({ type: 'crunch' });
      } else {
        this.crunchT -= dt;
        if (!blockers) { this.finishVictory(); return; }
        if (this.crunchT <= 0) {
          // blockers outlived the deadline — the release slips
          this.over = true;
          this.victory = false;
          this.releaseFailed = true;
          this.emit({ type: 'death' });
          return;
        }
      }
    }

    this.updatePlayer(dt);

    this.grid.clear();
    for (const e of this.enemies) this.grid.insert(e);

    if (!this.crunchStarted) updateSpawner(this, dt);
    updateBossSchedule(this, dt);
    this.updateEnemies(dt);
    updateWeapons(this, dt);
    this.updateProjectiles(dt);
    this.updateEnemyShots(dt);
    this.updateAllies(dt);
    this.updateZones(dt);
    this.updatePickups(dt);
    this.updateMushi(dt);

    // regen
    if (this.stats.regen > 0) this.healPlayer(this.stats.regen * dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    this.objectiveCheckT -= dt;
    if (this.objectiveCheckT <= 0) {
      this.objectiveCheckT = 1;
      this.checkObjectives();
    }
  }

  private updatePlayer(dt: number): void {
    const mv = moveVector();
    // Rotate screen-space input 45° into world space so keys match the screen.
    const inv = 1 / Math.SQRT2;
    let wx = (mv.x + mv.y) * inv;
    let wy = (mv.y - mv.x) * inv;

    // slow factors: deadlock scarab aura + marsh pools
    this.playerSlow = 1;
    this.grid.forEachInRadius(this.px, this.py, 150, (e) => {
      if (!e.isBoss && (e.def as EnemyDef).slowAura && e.frozenT <= 0) this.playerSlow = 0.55;
    });
    for (const z of this.zones) {
      if (z.kind === 'marsh' && dist(this.px, this.py, z.x, z.y) < z.radius) {
        this.playerSlow = Math.min(this.playerSlow, 0.6);
      }
    }

    const sp = this.stats.moveSpeed * this.playerSlow * (this.crunchT > 0 ? CRUNCH_SPEED_MULT : 1);
    this.px += wx * sp * dt;
    this.py += wy * sp * dt;
    if (wx !== 0 || wy !== 0) {
      this.faceX = wx; this.faceY = wy;
    }
  }

  private updateEnemies(dt: number): void {
    const pr = 14; // player body radius
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const def = e.def;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.matchMarkT = Math.max(0, e.matchMarkT - dt);

      if (e.isCopy) {
        e.copyT -= dt;
        if (e.copyT <= 0) { this.removeEnemy(i); continue; }
      }

      // knockback decay
      e.x += e.knockX * dt; e.y += e.knockY * dt;
      e.knockX *= Math.pow(0.001, dt); e.knockY *= Math.pow(0.001, dt);

      if (e.frozenT > 0) {
        e.frozenT -= dt;
      } else {
        this.moveEnemy(e, dt);
      }

      if (e.isBoss) updateBossMechanics(this, e, dt);

      // status decay
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowAmt = 0; }

      // contact damage
      const d = dist(e.x, e.y, this.px, this.py);
      if (d < def.radius + pr) {
        let dps = e.scaledDamage ?? def.damage;
        if (e.enraged) dps *= 1.5; // merge-conflict force-push
        if (!e.isBoss && (def as EnemyDef).drain && e.frozenT <= 0) {
          dps *= 1.5;
          e.hp = Math.min(e.maxHp, e.hp + 6 * dt); // leech heals itself
        }
        this.hurtPlayer(dps * dt);
      }

      // race condition spider duplication
      if (!e.isBoss && (def as EnemyDef).duplicates && !e.isCopy) {
        e.dupT -= dt;
        if (e.dupT <= 0) {
          e.dupT = 6 + rand(0, 2);
          const copy = this.makeEnemyFrom(e);
          copy.isCopy = true;
          copy.copyT = 3.5;
          copy.hp = e.maxHp * 0.25;
          copy.x += rand(-30, 30); copy.y += rand(-30, 30);
          this.enemies.push(copy);
        }
      }
    }
  }

  /** speed multiplier from difficulty is baked into scaledSpeed at spawn time */
  private moveEnemy(e: Enemy, dt: number): void {
    const def = e.def;
    const slow = 1 - e.slowAmt;
    const speed = (e.scaledSpeed ?? def.speed) * slow;
    const dx = this.px - e.x, dy = this.py - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;

    const behavior = e.isBoss ? 'chase' : (def as EnemyDef).behavior;
    if (behavior === 'chase') {
      e.x += (dx / d) * speed * dt;
      e.y += (dy / d) * speed * dt;
      e.facing = Math.atan2(dy, dx);
    } else if (behavior === 'jitter') {
      e.jitterT -= dt;
      if (e.jitterT <= 0) {
        e.jitterT = 0.35;
        e.jitterAng = Math.atan2(dy, dx) + rand(-1.2, 1.2);
      }
      e.x += Math.cos(e.jitterAng) * speed * dt;
      e.y += Math.sin(e.jitterAng) * speed * dt;
      e.facing = e.jitterAng;
    } else if (behavior === 'charge') {
      e.chargeT -= dt;
      if (e.chargePhase === 0) {
        e.x += (dx / d) * speed * dt;
        e.y += (dy / d) * speed * dt;
        e.facing = Math.atan2(dy, dx);
        if (d < 240 && e.chargeT <= 0) {
          e.chargePhase = 1; e.chargeT = 0.5;
        }
      } else if (e.chargePhase === 1) {
        if (e.chargeT <= 0) {
          e.chargePhase = 2; e.chargeT = 0.4;
          e.dashX = dx / d; e.dashY = dy / d;
        }
      } else if (e.chargePhase === 2) {
        e.x += e.dashX * speed * 3.2 * dt;
        e.y += e.dashY * speed * 3.2 * dt;
        if (e.chargeT <= 0) { e.chargePhase = 3; e.chargeT = 1.2; }
      } else {
        e.x += (dx / d) * speed * 0.5 * dt;
        e.y += (dy / d) * speed * 0.5 * dt;
        if (e.chargeT <= 0) { e.chargePhase = 0; e.chargeT = 0.3; }
      }
    }
  }

  makeEnemyFrom(src: Enemy): Enemy {
    return { ...src, knockX: 0, knockY: 0, hitFlash: 0 };
  }

  removeEnemy(index: number): void {
    this.enemies[index] = this.enemies[this.enemies.length - 1];
    this.enemies.pop();
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) { this.projectiles[i] = this.projectiles[this.projectiles.length - 1]; this.projectiles.pop(); continue; }

      let dead = false;
      this.grid.forEachInRadius(p.x, p.y, p.radius + 26, (e) => {
        if (dead || p.hit.has(e)) return;
        if (dist(p.x, p.y, e.x, e.y) > p.radius + e.def.radius) return;
        p.hit.add(e);
        this.hitEnemy(e, p.damage, { knockFrom: { x: p.x, y: p.y }, knock: 90, source: p.source ?? 'ally' });
        if (p.slow > 0) { e.slowAmt = Math.max(e.slowAmt, p.slow); e.slowT = Math.max(e.slowT, p.slowDur); }
        if (p.freeze > 0 && !e.isBoss) e.frozenT = Math.max(e.frozenT, p.freeze);
        if (p.pierce <= 0) dead = true;
        else p.pierce--;
      });
      if (dead) { this.projectiles[i] = this.projectiles[this.projectiles.length - 1]; this.projectiles.pop(); }
    }
  }

  private updateEnemyShots(dt: number): void {
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const s = this.enemyShots[i];
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.life -= dt;
      let remove = s.life <= 0;
      if (!remove && dist(s.x, s.y, this.px, this.py) < s.radius + 14) {
        this.hurtPlayer(s.damage);
        remove = true;
      }
      if (remove) { this.enemyShots[i] = this.enemyShots[this.enemyShots.length - 1]; this.enemyShots.pop(); }
    }
  }

  private updateAllies(dt: number): void {
    // character specials spawn allies
    if (this.character.special === 'turrets') {
      this.turretT -= dt;
      if (this.turretT <= 0) {
        this.turretT = 12;
        // 7s life (58% uptime, was 10s/83%): the free-DPS floor alone shouldn't
        // carry a pickless run — mortal-bot data had max winning 9/12 at lv 7.
        // Scaling via +projectiles (user ruling) is untouched and still rewards builds.
        this.allies.push({ kind: 'turret', x: this.px + rand(-50, 50), y: this.py + rand(-50, 50), life: 7, shootT: 0.3 });
      }
    }
    if (this.character.special === 'helpers') {
      this.helperT -= dt;
      if (this.helperT <= 0) {
        this.helperT = 16;
        this.allies.push({ kind: 'helper', x: this.px, y: this.py, life: 9, shootT: 0.5 });
      }
    }

    for (let i = this.allies.length - 1; i >= 0; i--) {
      const a = this.allies[i];
      a.life -= dt;
      if (a.life <= 0) { this.allies[i] = this.allies[this.allies.length - 1]; this.allies.pop(); continue; }
      a.shootT -= dt;
      if (a.kind === 'turret') {
        if (a.shootT <= 0) {
          const target = this.grid.nearest(a.x, a.y, 380);
          if (target) {
            a.shootT = 0.55;
            const base = Math.atan2(target.y - a.y, target.x - a.x);
            const n = 1 + this.stats.projectiles;
            for (let j = 0; j < n; j++) {
              // Slight spread when several bolts share one target (as fireBolt).
              const ang = base + (j === 0 ? 0 : (Math.random() - 0.5) * 0.25);
              this.projectiles.push({
                x: a.x, y: a.y,
                vx: Math.cos(ang) * 430, vy: Math.sin(ang) * 430,
                damage: 9 * this.stats.damageMult, radius: 7, pierce: 0, life: 1.4,
                slow: 0, slowDur: 0, freeze: 0, color: '#ffb347', kind: 'petbolt', hit: new Set(),
              });
            }
            this.emit({ type: 'shoot' });
          }
        }
      } else {
        // helper: chases nearest enemy, pulses melee damage
        const target = this.grid.nearest(a.x, a.y, 500);
        if (target) {
          const d = dist(a.x, a.y, target.x, target.y) || 1;
          a.x += ((target.x - a.x) / d) * 130 * dt;
          a.y += ((target.y - a.y) / d) * 130 * dt;
        }
        if (a.shootT <= 0) {
          a.shootT = 0.8;
          let any = false;
          this.grid.forEachInRadius(a.x, a.y, 55, (e) => {
            this.hitEnemy(e, 11 * this.stats.damageMult, { source: 'ally' });
            any = true;
          });
          if (any) this.emit({ type: 'sweep', x: a.x, y: a.y, angle: 0, radius: 55, full: true, color: '#9be564' });
        }
      }
    }
  }

  private updateZones(dt: number): void {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      if (z.kind === 'leak') {
        z.age = (z.age ?? 0) + dt;
        if (Number.isFinite(z.life)) {
          z.life -= dt;
          if (z.life <= 0) { this.zones[i] = this.zones[this.zones.length - 1]; this.zones.pop(); continue; }
        }
        // grow to full size over ~6s of age (boss pools are permanent: life = Infinity)
        z.radius = z.maxRadius * Math.min(1, 0.35 + 0.65 * (z.age / 6));
      }
      if (dist(this.px, this.py, z.x, z.y) < z.radius) {
        this.hurtPlayer(z.dps * dt);
      }
    }
  }

  private updatePickups(dt: number): void {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      const d = dist(p.x, p.y, this.px, this.py);
      const magnetR = p.kind === 'xp' ? this.stats.pickupRadius : 40;
      if (!p.magnet && d < magnetR) p.magnet = true;
      if (p.magnet) {
        const pull = 480 + (magnetR - d) * 4;
        p.vx = ((this.px - p.x) / (d || 1)) * pull;
        p.vy = ((this.py - p.y) / (d || 1)) * pull;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      if (d < 26) {
        this.collectPickup(p);
        this.pickups[i] = this.pickups[this.pickups.length - 1];
        this.pickups.pop();
      }
    }
  }

  private updateMushi(dt: number): void {
    if (this.time >= this.mushiAt) {
      // precipitates out of solution on the spawn ring, like any pop-in
      this.mushiAt = Infinity;
      const a = Math.random() * Math.PI * 2;
      this.mushi = {
        x: this.px + Math.cos(a) * SPAWN_RADIUS,
        y: this.py + Math.sin(a) * SPAWN_RADIUS,
        t: MUSHI_LIFE, jitterT: 0, jitterAng: a + Math.PI,
      };
      this.emit({ type: 'mushiSpawn', x: this.mushi.x, y: this.mushi.y });
    }
    const m = this.mushi;
    if (!m) return;

    m.t -= dt;
    if (m.t <= 0) {
      // evaporates uncaught — the renderer gives it its dramatic send-off
      this.mushi = null;
      this.emit({ type: 'mushiGone', x: m.x, y: m.y });
      return;
    }

    // Brownian motion: frequent small random redirections, chases nothing
    m.jitterT -= dt;
    if (m.jitterT <= 0) {
      m.jitterT = rand(0.15, 0.4);
      m.jitterAng += rand(-1.6, 1.6);
    }
    m.x += Math.cos(m.jitterAng) * MUSHI_SPEED * dt;
    m.y += Math.sin(m.jitterAng) * MUSHI_SPEED * dt;

    // collected by touch (it can't be hit — it isn't a defect)
    if (dist(m.x, m.y, this.px, this.py) < MUSHI_RADIUS + 14) {
      this.mushi = null;
      this.mushiCaught = true;
      this.emit({ type: 'mushiCaught', x: m.x, y: m.y });
      for (let i = 0; i < 7; i++) {
        this.dropXp(m.x + rand(-40, 40), m.y + rand(-40, 40), MUSHI_XP / 7);
      }
      this.pickups.push({ kind: 'chest', x: m.x, y: m.y, value: 0, magnet: false, vx: 0, vy: 0 });
    }
  }

  private collectPickup(p: Pickup): void {
    if (p.kind === 'xp') {
      this.gainXp(p.value);
      this.emit({ type: 'pickupXp' });
    } else if (p.kind === 'hp') {
      this.healPlayer(p.value);
      this.emit({ type: 'pickupHp' });
    } else {
      // chest: evolve a maxed weapon if possible, else bonus
      this.emit({ type: 'chest', x: p.x, y: p.y });
      const evolvable = this.weapons.find((w) => !w.def.isEvolution && w.def.evolveTo && w.level >= w.def.levels.length);
      if (evolvable) {
        this.evolveWeapon(evolvable);
      } else {
        this.chestBonus = true; // main run loop grants a free rare+ card via levelup system
      }
    }
  }

  /** Set when a chest had no evolution to give; consumed by main (free card). */
  chestBonus = false;

  dropXp(x: number, y: number, value: number): void {
    // Cap pickups: merge into a random existing gem when the field is saturated.
    if (this.pickups.length > 320) {
      const gem = this.pickups.find((p) => p.kind === 'xp');
      if (gem) { gem.value += value; return; }
    }
    this.pickups.push({ kind: 'xp', x: x + rand(-8, 8), y: y + rand(-8, 8), value, magnet: false, vx: 0, vy: 0 });
  }

  /** Central enemy damage entry — crits, marks, boss phases, death. */
  hitEnemy(
    e: Enemy,
    rawDamage: number,
    opts: {
      knockFrom?: { x: number; y: number }; knock?: number; noCrit?: boolean; absorb?: boolean;
      source?: WeaponInstance | 'ally';
    },
  ): void {
    if (e.hp <= 0) return;
    let dmg = rawDamage;

    let critChance = this.stats.critChance;
    if (this.character.special === 'eliteCrit' && (e.elite || e.isBoss)) critChance += 0.25;
    const crit = !opts.noCrit && Math.random() < critChance;
    if (crit) dmg *= this.stats.critMult;

    if (e.matchMarkT > 0) dmg *= 1.25;
    // unified boss resist: bossLogic sets armorMult per frame (monolith armor 0.25,
    // stack overflow with live frames 0.5)
    if (e.isBoss && e.armorMult !== undefined) dmg *= e.armorMult;
    if (this.crunchT > 0) dmg *= CRUNCH_DMG_MULT; // crunch adrenaline

    e.hp -= dmg;
    e.hitFlash = 0.12;
    if (opts.source) {
      if (opts.source === 'ally') this.allyDamage += dmg;
      else opts.source.totalDamage += dmg;
    }
    this.emit({ type: 'damage', x: e.x, y: e.y - e.def.radius, value: Math.round(dmg), crit });

    if (opts.knockFrom && opts.knock && !e.isBoss && !(e.def as EnemyDef).stationary) {
      const d = dist(opts.knockFrom.x, opts.knockFrom.y, e.x, e.y) || 1;
      e.knockX += ((e.x - opts.knockFrom.x) / d) * opts.knock;
      e.knockY += ((e.y - opts.knockFrom.y) / d) * opts.knock;
    }

    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e: Enemy): void {
    const idx = this.enemies.indexOf(e);
    if (idx === -1) return;
    this.removeEnemy(idx);

    if (e.isBoss) {
      const boss = e.def as BossDef;
      this.kills++;
      // Each split half showers XP, but one boss = one boss kill: the chest,
      // bossKills credit and death fanfare come only from the last-killed half.
      const xpTotal = 60 * (1 + e.bossTier * 0.5);
      for (let i = 0; i < 8; i++) this.dropXp(e.x + rand(-40, 40), e.y + rand(-40, 40), Math.ceil(xpTotal / 8));
      const twinAlive = boss.mechanic === 'split' && e.splitDone &&
        this.enemies.some((o) => o.isBoss && o.def === e.def && o.splitDone);
      if (twinAlive) {
        this.emit({ type: 'kill', x: e.x, y: e.y, color: boss.color, big: true });
        return;
      }
      this.bossKills++;
      this.emit({ type: 'bossDie', x: e.x, y: e.y, name: boss.name });
      if (boss.mechanic === 'phase') crumblePillars(this); // died mid-armor: props fall with it
      if (boss.mechanic === 'pools') {
        // death frees all memory at once: every leak pool is reclaimed
        const pools = this.zones.filter((z) => z.kind === 'leak').map((z) => ({ x: z.x, y: z.y }));
        if (pools.length) {
          this.zones = this.zones.filter((z) => z.kind !== 'leak');
          this.emit({ type: 'memoryFreed', pools });
        }
      }
      this.pickups.push({ kind: 'chest', x: e.x, y: e.y, value: 0, magnet: false, vx: 0, vy: 0, bossTier: e.bossTier });
      return;
    }

    const def = e.def as EnemyDef;
    this.kills++;
    this.emit({ type: 'kill', x: e.x, y: e.y, color: def.color, big: e.elite });

    if (def.explodeOnDeath) {
      const r = 75;
      this.emit({ type: 'explosion', x: e.x, y: e.y, radius: r, color: '#ff7438' });
      if (dist(e.x, e.y, this.px, this.py) < r + 14) {
        this.hurtPlayer(14 * (e.scaledDamage ?? def.damage) / def.damage);
      }
    }

    if (!e.isCopy && def.xp > 0) {
      this.dropXp(e.x, e.y, def.xp * (e.elite ? 10 : 1));
      if (e.elite && Math.random() < 0.6) {
        this.pickups.push({ kind: 'hp', x: e.x, y: e.y, value: 25, magnet: false, vx: 0, vy: 0 });
      }
    }
  }

  private checkObjectives(): void {
    const view = this.statsView();
    for (const obj of OBJECTIVES) {
      if (this.doneObjectives.has(obj.id)) continue;
      if (this.objectivesThisRun.includes(obj.id)) continue;
      if (obj.check(view)) {
        this.objectivesThisRun.push(obj.id);
        this.emit({ type: 'objective', name: obj.name });
      }
    }
  }

  /** Live Bits preview + final results (brief formula). */
  computeBits(): RunResults {
    const minutes = this.time / 60;
    const breakdown = [
      { label: 'Time survived', value: minutes * 10 },
      { label: 'Bugs squashed', value: this.kills * 0.1 },
      { label: 'Bosses defeated', value: this.bossKills * BOSS_BITS * this.stats.bossRewardMult },
      { label: 'Level reached', value: this.level * 5 },
      { label: 'Objectives completed', value: this.objectivesThisRun.length * OBJECTIVE_BITS },
    ];
    if (this.mushiCaught) breakdown.push({ label: 'Field sample resolved', value: MUSHI_BITS });
    const base = breakdown.reduce((a, b) => a + b.value, 0);
    const bits = Math.floor(base * this.map.bitsMult);
    return {
      timeSec: this.time,
      kills: this.kills,
      level: this.level,
      bossKills: this.bossKills,
      victory: this.victory,
      releaseFailed: this.releaseFailed,
      newObjectives: [...this.objectivesThisRun],
      bits,
      bitsBreakdown: breakdown.map((b) => ({ label: b.label, value: Math.floor(b.value) })),
      weaponDamage: this.weapons.map((w) => ({
        icon: w.def.icon, name: w.def.name, color: w.def.color,
        level: w.level, isEvolution: !!w.def.isEvolution,
        damage: Math.round(w.totalDamage),
        dps: w.totalDamage / Math.max(1, this.time - w.acquiredAt),
      })),
      allyDamage: Math.round(this.allyDamage),
    };
  }
}
