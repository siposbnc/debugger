// The shared headless "player bot" used by simulate.ts and matrix.ts.
// Keep both scripts on this one implementation so matrix conclusions always
// reflect the same bot simulate.ts shows.
//
// Pick strategies:
//   'first'   — always takes offer[0]: the careless-player baseline.
//   'greedy'  — synergy build: rushes weapon levels toward evolution, then
//               offense-weighted stat cards (a competent player proxy).
// Movement:
//   invincible bots orbit the boss / kite a fixed circle (pacing measurements);
//   mortal bots use potential-field kiting (flee enemy pressure, dodge shots
//   and hazard zones, fetch heals when hurt) so survival is actually tested.

import { Run } from '../src/game/run';
import { makeOffer, applyOffer, grantChestCard, type OfferItem } from '../src/game/levelup';
import { CARD_BY_ID } from '../src/data/upgrades';
import type { StatMods } from '../src/data/types';

export const STEP = 1 / 60;

export type PickStrategy = 'first' | 'greedy';

export interface BotOptions {
  pick: PickStrategy;
  mortal: boolean;
  /** Mortal movement style. 'kite' (default) flees enemy pressure — correct for
   *  ranged weapons, but it faces away from the horde, so short-reach weapons
   *  (orbit/sweep/shockwave/wall) read ~zero DPS under it. 'brawl' holds the
   *  weapon's engagement range and strafes tangentially — how high-risk weapons
   *  are meant to be played (BALANCE.md §8). */
  style?: 'kite' | 'brawl';
  /** Brawl engagement distance (world units to the priority target). */
  engageR?: number;
}

export const DEFAULT_BOT: BotOptions = { pick: 'first', mortal: false };

// ---------- pick strategies ----------

/** Offense-leaning value per unit of each stat (mods are fractions/flats). */
const STAT_VALUE: Record<keyof StatMods, number> = {
  damage: 120, cooldown: 120, projectiles: 28, area: 70,
  critChance: 80, critMult: 40, speed: 45,
  maxHp: 0.18, regen: 5, armor: 4,
  pickupRadius: 0.02, xpGain: 30, luck: 5,
  rerolls: 1, banishes: 1, skips: 1,
  shield: 0.2, // every StatMods key MUST appear here — a missing key scores NaN
};

/** Mortal bots buy survivability too — a build that never lives to minute 12
 *  isn't a good build no matter its DPS. */
const MORTAL_STAT_VALUE: Partial<Record<keyof StatMods, number>> = {
  maxHp: 0.6, regen: 18, armor: 22, speed: 60, shield: 0.5,
};

function scoreOffer(run: Run, item: OfferItem, mortal: boolean): number {
  if (item.kind === 'weaponUp') {
    // pushing the highest weapon toward max level (and evolution) compounds best
    const w = run.weapons.find((x) => x.def.id === item.id);
    return 100 + (w ? w.level * 6 : 0);
  }
  if (item.kind === 'newWeapon') {
    // a competent player covers angles first (a lone narrow weapon dies to
    // encirclement), then focuses: 2nd weapon beats everything, 3rd/4th beat cards
    return run.weapons.length < 2 ? 130 : run.weapons.length < 4 ? 80 : 25;
  }
  const card = CARD_BY_ID[item.id];
  if (!card) return 0;
  let s = 0;
  for (const [k, v] of Object.entries(card.mods) as [keyof StatMods, number][]) {
    s += ((mortal && MORTAL_STAT_VALUE[k]) || STAT_VALUE[k]) * v;
  }
  return s;
}

export function pickOffer(run: Run, offer: OfferItem[], opts: BotOptions): OfferItem {
  if (opts.pick === 'first') return offer[0];
  let best = offer[0], bestScore = -Infinity;
  for (const item of offer) {
    const s = scoreOffer(run, item, opts.mortal);
    if (s > bestScore) { best = item; bestScore = s; }
  }
  return best;
}

// ---------- movement ----------

/** Move and update facing, mirroring what updatePlayer does with real input —
 *  sweep weapons aim along faceX/faceY, so a bot that never sets it would fire
 *  due-east all run (this was a real bug: every pre-2026-06-11 sim did exactly that). */
function moveTowards(run: Run, tx: number, ty: number, speed: number): void {
  const dx = tx - run.px, dy = ty - run.py;
  const d = Math.hypot(dx, dy) || 1;
  const step = Math.min(d, speed * STEP);
  run.px += (dx / d) * step;
  run.py += (dy / d) * step;
  if (step > 0.01) { run.faceX = dx / d; run.faceY = dy / d; }
}

/** Original invincible-bot movement: chests first, else orbit boss / kite a circle. */
function orbitMovement(run: Run): void {
  const speed = run.stats.moveSpeed * run.playerSlow;
  const chest = run.pickups.find((p) => p.kind === 'chest');
  if (chest) { moveTowards(run, chest.x, chest.y, speed); return; }
  const boss = run.enemies.find((e) => e.isBoss);
  const ang = (run.time / 14) * Math.PI * 2; // one lap every 14s
  const cx = boss ? boss.x : 0, cy = boss ? boss.y : 0;
  const r = boss ? 190 : 280;
  moveTowards(run, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, speed);
}

/** Shared hard-avoidance field: shots, slam telegraphs, hazard zones.
 *  Both mortal styles must respect these — dodging is not optional play. */
function avoidanceField(run: Run): { fx: number; fy: number } {
  let fx = 0, fy = 0;
  // incoming enemy shots
  for (const s of run.enemyShots) {
    const dx = run.px - s.x, dy = run.py - s.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 110) continue;
    const w = ((110 - d) / 110) * 2;
    fx += (dx / d) * w; fy += (dy / d) * w;
  }
  // telegraphed slams: leave the circle before it fills — this IS the
  // critical-exception mechanic, and a bot that face-tanks every slam
  // measures a dodge boss as a pure DPS check (marsh cert collapsed to 3%)
  for (const s of run.slams) {
    const dx = run.px - s.x, dy = run.py - s.y;
    const d = Math.hypot(dx, dy) || 1;
    const reach = s.radius + 40;
    if (d > reach) continue;
    // slams spawn centered on the player: at the degenerate center, flee
    // along the current heading instead of standing on the bullseye
    let ux = dx / d, uy = dy / d;
    if (d < 20) { ux = run.faceX || 1; uy = run.faceY; }
    const urgency = 1 - s.t / s.maxT;
    const w = ((reach - d) / reach + 0.5) * (2.5 + 3 * urgency);
    fx += ux * w; fy += uy * w;
  }
  // hazard zones (marsh pools, boss leftovers)
  for (const z of run.zones) {
    if (z.dps <= 0) continue;
    const dx = run.px - z.x, dy = run.py - z.y;
    const d = Math.hypot(dx, dy) || 1;
    const reach = z.radius + 50;
    if (d > reach) continue;
    const w = ((reach - d) / reach) * 2.5;
    fx += (dx / d) * w; fy += (dy / d) * w;
  }
  return { fx, fy };
}

/** Shared weak goal field: heals when hurt, chests, XP gems — threat dominates. */
function goalField(run: Run): { ox: number; oy: number } {
  let ox = 0, oy = 0;
  const hurt = run.hp < run.stats.maxHp * 0.65;
  const heal = hurt ? run.pickups.find((p) => p.kind === 'hp') : undefined;
  const chest = run.pickups.find((p) => p.kind === 'chest');
  let goal = heal ?? chest, goalW = heal ? 0.7 : 0.45;
  if (!goal) {
    // sweep up dropped XP — a player who never collects gems has no build at
    // all (kiting alone starved bots to ~lv 11 by 15:00); nearest gem wins
    let bestD = 420;
    for (const p of run.pickups) {
      if (p.kind !== 'xp') continue;
      const d = Math.hypot(p.x - run.px, p.y - run.py);
      if (d < bestD) { bestD = d; goal = p; }
    }
    goalW = 0.5;
  }
  if (goal) {
    const dx = goal.x - run.px, dy = goal.y - run.py;
    const d = Math.hypot(dx, dy) || 1;
    ox = (dx / d) * goalW; oy = (dy / d) * goalW;
  }
  return { ox, oy };
}

/** Mortal-bot movement: potential field — survival first, objectives when safe. */
function kiteMovement(run: Run): void {
  const speed = run.stats.moveSpeed * run.playerSlow;
  let { fx, fy } = avoidanceField(run);

  // enemy pressure (closer + bigger + boss = stronger push away)
  const THREAT_R = 180;
  for (const e of run.enemies) {
    const dx = run.px - e.x, dy = run.py - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const reach = THREAT_R + e.def.radius;
    if (d > reach) continue;
    const w = ((reach - d) / reach) * (e.isBoss ? 3 : e.elite ? 1.8 : 1);
    fx += (dx / d) * w; fy += (dy / d) * w;
  }

  // objectives, weakly weighted so threat always dominates
  let { ox, oy } = goalField(run);
  if (ox === 0 && oy === 0) {
    // drift along a wide circle instead of standing still
    const ang = (run.time / 16) * Math.PI * 2;
    const tx = Math.cos(ang) * 320, ty = Math.sin(ang) * 320;
    const dx = tx - run.px, dy = ty - run.py;
    const d = Math.hypot(dx, dy) || 1;
    ox = (dx / d) * 0.3; oy = (dy / d) * 0.3;
  }

  const mx = fx + ox, my = fy + oy;
  const m = Math.hypot(mx, my);
  if (m < 0.05) return; // safe and at goal: stand and shoot
  run.px += (mx / m) * speed * STEP;
  run.py += (my / m) * speed * STEP;
  run.faceX = mx / m; run.faceY = my / m;
}

/** Brawl movement: hold the weapon's engagement range on the priority target
 *  (boss > nearest bug) and strafe tangentially, so contact-range weapons
 *  (orbit/sweep/shockwave/wall) actually drag through the pack. Hard avoidance
 *  (shots/slams/zones) still dominates; badly hurt backs out to recover. */
function brawlMovement(run: Run, engageR: number): void {
  const speed = run.stats.moveSpeed * run.playerSlow;
  let { fx, fy } = avoidanceField(run);

  let target = run.enemies.find((e) => e.isBoss) ?? null;
  if (!target) {
    let bestD = Infinity;
    for (const e of run.enemies) {
      const d = Math.hypot(e.x - run.px, e.y - run.py);
      if (d < bestD) { bestD = d; target = e; }
    }
  }
  // never stand in contact range — brawl hugs the pack edge, it doesn't melt
  // inside it (contact dps is per-second; touching three bugs kills in seconds)
  for (const e of run.enemies) {
    const dx = run.px - e.x, dy = run.py - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const reach = e.def.radius + 34;
    if (d > reach) continue;
    const w = ((reach - d) / reach) * 2.4 * (e.isBoss ? 2 : 1);
    fx += (dx / d) * w; fy += (dy / d) * w;
  }

  if (target) {
    const dx = target.x - run.px, dy = target.y - run.py;
    const d = Math.hypot(dx, dy) || 1;
    const hurt = run.hp < run.stats.maxHp * 0.55;
    // radial: close in when too far, ease out when too close or hurt — backing
    // out at 55% HP (not 35%) is what keeps a brawler alive: by the time a
    // third of the bar is left inside a pack, no retreat saves it
    const err = (d - engageR) / engageR;
    const radial = hurt ? -1.8 : Math.max(-1.5, Math.min(1.2, err * 2));
    fx += (dx / d) * radial; fy += (dy / d) * radial;
    // tangential strafe — orbit the pack instead of standing in it
    fx += (-dy / d) * (hurt ? 0.5 : 0.8); fy += (dx / d) * (hurt ? 0.5 : 0.8);
  }

  const { ox, oy } = goalField(run);
  const mx = fx + ox, my = fy + oy;
  const m = Math.hypot(mx, my);
  if (m < 0.05) return;
  run.px += (mx / m) * speed * STEP;
  run.py += (my / m) * speed * STEP;
  run.faceX = mx / m; run.faceY = my / m;
}

// ---------- frame step ----------

/** One bot frame (call after run.update). Returns a granted chest-card name, if any. */
export function botStep(run: Run, opts: BotOptions = DEFAULT_BOT): string | null {
  let chestCard: string | null = null;

  while (run.pendingLevelUps > 0) {
    const offer = makeOffer(run);
    if (offer.length === 0) { run.pendingLevelUps = 0; break; }
    applyOffer(run, pickOffer(run, offer, opts));
    run.pendingLevelUps--;
  }
  if (run.chestBonus) {
    run.chestBonus = false;
    const card = grantChestCard(run);
    if (card) chestCard = card.name;
  }

  if (opts.mortal) {
    if (opts.style === 'brawl') brawlMovement(run, opts.engageR ?? 80);
    else kiteMovement(run);
  } else {
    orbitMovement(run);
  }
  return chestCard;
}
