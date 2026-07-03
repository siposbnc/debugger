import { CHARACTERS } from '../data/characters';
import { MAPS } from '../data/maps';
import { WEAPONS } from '../data/weapons';
import { ENEMIES } from '../data/enemies';
import { BOSSES } from '../data/bosses';
import { CARD_BY_ID } from '../data/upgrades';
import type { PrestigePerks } from '../data/prestige';
import { Run, type Enemy, type Pickup, type GroundZone, type Obstacle, type TerrainPatch, type Ally, type Mushi, type Slam } from './run';

// Suspend & resume: a full-fidelity snapshot of a live run, stored inside
// SaveData (suspendedRun) so a run survives closing the browser. Projectiles
// and enemy shots are deliberately dropped (sub-second transients holding
// entity references); everything the next minute of play depends on is kept.
// The snapshot is consumed on resume — death cannot be undone by reloading.
// Restore throws on any unknown id (content drift across versions): callers
// catch and discard the snapshot instead of resuming a corrupt state.

/** Enemy with the def reference flattened to its id. All other fields are plain. */
type EnemySnap = Omit<Enemy, 'def'> & { defId: string };

/** GroundZone with Infinity (marsh pools) made JSON-safe. */
type ZoneSnap = Omit<GroundZone, 'life' | 'maxLife'> & { life: number | null; maxLife: number | null };

export interface SuspendedRun {
  charId: string;
  mapId: string;
  metaLevels: Record<string, number>;
  weaponPool: string[];
  time: number;
  // player
  px: number; py: number;
  hp: number;
  faceX: number; faceY: number;
  // progression
  level: number; xp: number; xpCollected: number; pendingLevelUps: number;
  // cards
  takenCards: [string, number][];
  banished: string[];
  rerollsLeft: number; banishesLeft: number; skipsLeft: number;
  // weapons
  weapons: { id: string; level: number; totalDamage: number; acquiredAt: number }[];
  evolvedCount: number;
  // scoring
  kills: number; bossKills: number; allyDamage: number;
  objectivesThisRun: string[];
  chestBonus: boolean;
  // spawning / boss schedule
  spawnTimer: number; nextBossAt: number; bossIndex: number; bossWarned: boolean;
  // boss tier system — optional: older snapshots redraw the slot on resume
  nextBossId?: string | null; lastBossId?: string | null;
  // boss-mechanic transients — optional: default to none active
  slams?: Slam[]; chillT?: number;
  // shield — optional: pre-shield snapshots restore at full charge
  shield?: number; shieldHitT?: number;
  // crunch time — optional: snapshots from before the mechanic existed restore inactive
  crunchStarted?: boolean; crunchT?: number;
  // endless mode — optional: pre-endless snapshots restore as normal runs
  endless?: boolean; banked?: boolean;
  // curses — optional: pre-curse snapshots restore uncursed
  curses?: string[];
  curseReverseT?: number; curseLockT?: number;
  curseTimed?: { id: string; nextAt: number; warned: boolean }[];
  // prestige Ship Bonus — optional: pre-prestige snapshots restore at 0
  rewrites?: number;
  /** resolved prestige tree perks — optional: pre-tree snapshots restore
   *  neutral. Stored resolved (not as node ranks) so a tree bought AFTER
   *  suspending can't retroactively buff a mid-flight run. */
  perks?: PrestigePerks;
  // character specials
  turretT: number; helperT: number;
  // entities
  enemies: EnemySnap[];
  pickups: Pickup[];
  zones: ZoneSnap[];
  /** terrain blockers — optional: pre-terrain snapshots restore rackless */
  obstacles?: Obstacle[];
  /** terrain patches — optional: pre-patch snapshots restore patchless */
  patches?: TerrainPatch[];
  allies: Ally[];
  // The Precipitate (easter egg) — optional: snapshots from before it existed
  // restore with the default "not this run" state. mushiAt Infinity → null (JSON).
  mushi?: Mushi | null;
  mushiAt?: number | null;
  mushiCaught?: boolean;
  /** field-event spawn clock — optional: pre-events snapshots re-arm on resume.
   *  Infinity (= an event was live; it isn't serialized) → null (JSON). */
  eventAt?: number | null;
  /** credits in the wallet — the live registry terminal and buff timers are
   *  deliberately NOT serialized (suspend drops them, like field events) */
  credits?: number;
}

function snapEnemy(e: Enemy): EnemySnap {
  const { def, ...rest } = e;
  return { ...rest, defId: def.id };
}

function restoreEnemy(s: EnemySnap): Enemy {
  const { defId, ...rest } = s;
  // race-condition afterimages are non-boss enemies wearing a boss def
  const def = s.isBoss || s.raceImage ? BOSSES[defId] : ENEMIES[defId];
  if (!def) fail(s.isBoss ? 'boss' : 'enemy', defId);
  return { ...rest, def };
}

function fail(what: string, id: string): never {
  throw new Error(`suspended run: unknown ${what} "${id}" — content changed since the run was saved`);
}

export function snapshotRun(run: Run): SuspendedRun {
  return {
    charId: run.character.id,
    mapId: run.map.id,
    metaLevels: { ...run.metaLevels },
    weaponPool: [...run.weaponPool],
    time: run.time,
    px: run.px, py: run.py,
    hp: run.hp,
    shield: run.shield, shieldHitT: run.shieldHitT,
    faceX: run.faceX, faceY: run.faceY,
    level: run.level, xp: run.xp, xpCollected: run.xpCollected, pendingLevelUps: run.pendingLevelUps,
    takenCards: [...run.takenCards.entries()],
    banished: [...run.banished],
    rerollsLeft: run.rerollsLeft, banishesLeft: run.banishesLeft, skipsLeft: run.skipsLeft,
    weapons: run.weapons.map((w) => ({
      id: w.def.id, level: w.level, totalDamage: w.totalDamage, acquiredAt: w.acquiredAt,
    })),
    evolvedCount: run.evolvedCount,
    kills: run.kills, bossKills: run.bossKills, allyDamage: run.allyDamage,
    objectivesThisRun: [...run.objectivesThisRun],
    chestBonus: run.chestBonus,
    spawnTimer: run.spawnTimer, nextBossAt: run.nextBossAt, bossIndex: run.bossIndex, bossWarned: run.bossWarned,
    nextBossId: run.nextBossId, lastBossId: run.lastBossId,
    slams: run.slams.map((s) => ({ ...s })), chillT: run.chillT,
    crunchStarted: run.crunchStarted, crunchT: run.crunchT,
    endless: run.endless, banked: run.banked,
    curses: run.curses.map((c) => c.id),
    rewrites: run.rewrites,
    perks: { ...run.perks },
    curseReverseT: run.curseReverseT, curseLockT: run.curseLockT,
    curseTimed: run.curseTimed.map((t) => ({ id: t.def.id, nextAt: t.nextAt, warned: t.warned })),
    turretT: run.turretT, helperT: run.helperT,
    // a live field event is dropped wholesale (its nest with it): resuming
    // re-arms the spawn clock instead — simpler than serializing the entity ref
    enemies: run.enemies.filter((e) => e !== run.fieldEvent?.nest).map(snapEnemy),
    pickups: run.pickups.map((p) => ({ ...p })),
    obstacles: run.obstacles.map((o) => ({ ...o })),
    patches: run.patches.map((p) => ({ ...p })),
    zones: run.zones.map((z) => ({
      ...z,
      life: Number.isFinite(z.life) ? z.life : null,
      maxLife: Number.isFinite(z.maxLife) ? z.maxLife : null,
    })),
    allies: run.allies.map((a) => ({ ...a })),
    mushi: run.mushi ? { ...run.mushi } : null,
    mushiAt: Number.isFinite(run.mushiAt) ? run.mushiAt : null,
    mushiCaught: run.mushiCaught,
    eventAt: Number.isFinite(run.eventAt) ? run.eventAt : null,
    credits: run.credits,
  };
}

export function restoreRun(snap: SuspendedRun, doneObjectives: Set<string>): Run {
  const character = CHARACTERS[snap.charId] ?? fail('character', snap.charId);
  const map = MAPS[snap.mapId] ?? fail('map', snap.mapId);
  const run = new Run(character, map, { ...snap.metaLevels }, [...snap.weaponPool], doneObjectives,
    { endless: snap.endless, curses: snap.curses, rewrites: snap.rewrites, perks: snap.perks });

  // cards first: applyCard() rebuilds cardMods + takenCards and recomputes stats
  for (const [id, count] of snap.takenCards) {
    const card = CARD_BY_ID[id] ?? fail('card', id);
    for (let i = 0; i < count; i++) run.applyCard(card);
  }
  run.banished = new Set(snap.banished);
  run.rerollsLeft = snap.rerollsLeft;
  run.banishesLeft = snap.banishesLeft;
  run.skipsLeft = snap.skipsLeft;

  // weapons: replace the constructor-granted starter with the snapshot loadout
  run.weapons.length = 0;
  for (const w of snap.weapons) {
    if (!WEAPONS[w.id]) fail('weapon', w.id);
    run.addWeapon(w.id);
    const inst = run.weapons[run.weapons.length - 1];
    inst.level = w.level;
    inst.totalDamage = w.totalDamage;
    inst.acquiredAt = w.acquiredAt;
  }
  run.evolvedCount = snap.evolvedCount;

  run.time = snap.time;
  run.px = snap.px; run.py = snap.py;
  run.prevPx = snap.px; run.prevPy = snap.py;
  run.faceX = snap.faceX; run.faceY = snap.faceY;
  run.level = snap.level; run.xp = snap.xp;
  run.xpCollected = snap.xpCollected;
  run.pendingLevelUps = snap.pendingLevelUps;
  run.kills = snap.kills; run.bossKills = snap.bossKills; run.allyDamage = snap.allyDamage;
  run.objectivesThisRun = [...snap.objectivesThisRun];
  run.chestBonus = snap.chestBonus;
  run.spawnTimer = snap.spawnTimer;
  run.nextBossAt = snap.nextBossAt;
  run.bossIndex = snap.bossIndex;
  run.bossWarned = snap.bossWarned;
  // unknown stored boss id (content drift) is tolerated: the scheduler
  // validates and redraws the slot instead of failing the whole snapshot
  run.nextBossId = snap.nextBossId ?? null;
  run.lastBossId = snap.lastBossId ?? null;
  run.slams = (snap.slams ?? []).map((s) => ({ ...s }));
  run.chillT = snap.chillT ?? 0;
  run.crunchStarted = snap.crunchStarted ?? false;
  run.crunchT = snap.crunchT ?? 0;
  run.banked = snap.banked ?? false;
  if (run.banked) run.victory = true; // the banked workday survives suspend too
  // timed-curse rhythm: restore each schedule by id (constructor re-armed
  // them fresh); unknown ids were already dropped by the constructor
  run.curseReverseT = snap.curseReverseT ?? 0;
  run.curseLockT = snap.curseLockT ?? 0;
  for (const t of snap.curseTimed ?? []) {
    const live = run.curseTimed.find((x) => x.def.id === t.id);
    if (live) { live.nextAt = t.nextAt; live.warned = t.warned; }
  }
  run.turretT = snap.turretT; run.helperT = snap.helperT;

  run.enemies = snap.enemies.map(restoreEnemy);
  run.pickups = snap.pickups.map((p) => ({ ...p }));
  run.zones = snap.zones.map((z) => ({ ...z, life: z.life ?? Infinity, maxLife: z.maxLife ?? Infinity }));
  // the fresh Run constructor rolled its own terrain — replace with the snapshot's
  // (pre-terrain snapshots restore terrainless rather than re-rolling a new layout)
  run.obstacles = (snap.obstacles ?? []).map((o) => ({ ...o }));
  run.patches = (snap.patches ?? []).map((p) => ({ ...p }));
  run.allies = snap.allies.map((a) => ({ ...a }));
  run.mushi = snap.mushi ? { ...snap.mushi } : null;
  run.mushiAt = snap.mushiAt ?? Infinity; // pre-Precipitate snapshot: don't re-roll mid-run
  run.mushiCaught = snap.mushiCaught ?? false;
  // eventAt was Infinity iff an event was live at suspend (it was dropped from
  // the snapshot) — re-arm a fresh spawn a beat after resuming. Pre-events
  // snapshots get the same treatment.
  run.eventAt = snap.eventAt ?? run.time + 30;
  run.credits = snap.credits ?? 0;
  run.creditsCollected = snap.credits ?? 0; // close enough for the meta reveal

  run.hp = Math.min(snap.hp, run.stats.maxHp);
  run.shield = Math.min(snap.shield ?? run.stats.shieldMax, run.stats.shieldMax);
  run.shieldHitT = snap.shieldHitT ?? 0;
  return run;
}
