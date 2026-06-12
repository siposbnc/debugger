import type { Enemy, Run, WeaponInstance } from './run';
import type { WeaponLevelStats } from '../data/types';
import { dist } from '../core/util';

// Weapon behaviors. Each kind reads its level stats, applies global stat
// multipliers, and either spawns projectiles or deals instant damage with a
// visual event the renderer animates.

const TARGET_RANGE = 520; // max auto-aim distance

function effective(run: Run, w: WeaponInstance): WeaponLevelStats & { count: number } {
  const lvl = w.def.levels[w.level - 1];
  return {
    ...lvl,
    damage: lvl.damage * run.stats.damageMult,
    cooldown: lvl.cooldown * run.stats.cooldownFactor,
    area: lvl.area * run.stats.areaMult,
    count: lvl.count + run.stats.projectiles,
  };
}

/** Up to n nearest distinct living enemies within range of (x, y). */
function nearestN(run: Run, x: number, y: number, n: number, range: number): Enemy[] {
  const found: Enemy[] = [];
  run.grid.forEachInRadius(x, y, range, (e) => found.push(e));
  found.sort((a, b) => dist(x, y, a.x, a.y) - dist(x, y, b.x, b.y));
  return found.slice(0, n);
}

export function updateWeapons(run: Run, dt: number): void {
  for (const w of run.weapons) {
    const s = effective(run, w);
    switch (w.def.kind) {
      case 'orbit': updateOrbit(run, w, s, dt); continue;
      case 'pet': updatePet(run, w, s, dt); continue;
    }
    w.timer -= dt;
    if (w.timer > 0) continue;

    switch (w.def.kind) {
      case 'bolt': if (fireBolt(run, w, s)) w.timer = s.cooldown; break;
      case 'snipe': if (fireSnipe(run, w, s)) w.timer = s.cooldown; break;
      case 'shockwave': fireShockwave(run, w, s); w.timer = s.cooldown; break;
      case 'sweep': fireSweep(run, w, s); w.timer = s.cooldown; break;
      case 'chain': if (fireChain(run, w, s)) w.timer = s.cooldown; break;
      case 'column': if (fireColumn(run, w, s)) w.timer = s.cooldown; break;
      case 'bomb': if (fireBomb(run, w, s)) w.timer = s.cooldown; break;
      case 'wall': fireWall(run, w, s); w.timer = s.cooldown; break;
      case 'homing': if (fireHoming(run, w, s)) w.timer = s.cooldown; break;
      case 'smite': if (fireSmite(run, w, s)) w.timer = s.cooldown; break;
    }
  }
}

function fireBolt(run: Run, w: WeaponInstance, s: ReturnType<typeof effective>): boolean {
  const targets = nearestN(run, run.px, run.py, s.count, TARGET_RANGE);
  if (targets.length === 0) return false;
  for (let i = 0; i < s.count; i++) {
    const t = targets[i % targets.length];
    const d = dist(run.px, run.py, t.x, t.y) || 1;
    // Slight spread when several bolts share one target.
    const spread = i >= targets.length ? (Math.random() - 0.5) * 0.25 : 0;
    const ang = Math.atan2(t.y - run.py, t.x - run.px) + spread;
    run.projectiles.push({
      x: run.px, y: run.py,
      vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
      damage: s.damage, radius: s.area, pierce: s.pierce,
      life: 1.6, slow: 0, slowDur: 0, freeze: 0,
      color: w.def.color, kind: 'bolt', hit: new Set(), source: w,
    });
  }
  run.emit({ type: 'shoot' });
  return true;
}

function fireSnipe(run: Run, w: WeaponInstance, s: ReturnType<typeof effective>): boolean {
  const targets = nearestN(run, run.px, run.py, s.count, TARGET_RANGE + 160);
  if (targets.length === 0) return false;
  const isFreeze = w.def.id === 'timefreezeDebugger';
  for (let i = 0; i < s.count; i++) {
    const t = targets[i % targets.length];
    const ang = Math.atan2(t.y - run.py, t.x - run.px);
    run.projectiles.push({
      x: run.px, y: run.py,
      vx: Math.cos(ang) * s.speed, vy: Math.sin(ang) * s.speed,
      damage: s.damage, radius: s.area, pierce: s.pierce,
      life: 1.8,
      slow: isFreeze ? 0 : s.slow, slowDur: 2.2,
      freeze: isFreeze ? s.duration : 0,
      color: w.def.color, kind: 'arrow', hit: new Set(), source: w,
    });
  }
  run.emit({ type: 'shoot' });
  return true;
}

function fireShockwave(run: Run, w: WeaponInstance, s: ReturnType<typeof effective>): void {
  const stun = w.def.id === 'releaseBreaker' ? s.duration : 0;
  const waves = w.def.levels[w.level - 1].count; // double wave for evolution
  for (let wave = 0; wave < waves; wave++) {
    const radius = s.area * (1 - wave * 0.35);
    run.grid.forEachInRadius(run.px, run.py, radius, (e) => {
      run.hitEnemy(e, s.damage, { knockFrom: { x: run.px, y: run.py }, knock: 240, source: w });
      if (stun > 0 && !e.isBoss) e.frozenT = Math.max(e.frozenT, stun);
    });
    run.emit({ type: 'shockwave', x: run.px, y: run.py, radius, color: w.def.color });
  }
}

function fireSweep(run: Run, w: WeaponInstance, s: ReturnType<typeof effective>): void {
  const full = w.def.id === 'heapPurifier';
  const facing = Math.atan2(run.faceY, run.faceX);
  const halfArc = full ? Math.PI : 0.95; // ~109° cone, or full circle evolved
  let absorbed = 0;
  run.grid.forEachInRadius(run.px, run.py, s.area, (e) => {
    if (!full) {
      const ang = Math.atan2(e.y - run.py, e.x - run.px);
      let delta = Math.abs(ang - facing);
      if (delta > Math.PI) delta = Math.PI * 2 - delta;
      if (delta > halfArc) return;
    }
    // Garbage collection: weakened small bugs get deleted outright.
    const small = !e.isBoss && !e.elite && e.def.radius <= 14;
    if (small && e.hp - s.damage < e.maxHp * 0.3) {
      run.hitEnemy(e, e.hp, { noCrit: true, source: w });
      absorbed++;
    } else {
      run.hitEnemy(e, s.damage, { knockFrom: { x: run.px, y: run.py }, knock: 130, source: w });
    }
  });
  if (full && absorbed > 0) run.healPlayer(absorbed);
  run.emit({ type: 'sweep', x: run.px, y: run.py, angle: facing, radius: s.area, full, color: w.def.color });
}

function fireChain(run: Run, w: WeaponInstance, s: ReturnType<typeof effective>): boolean {
  const first = run.grid.nearest(run.px, run.py, s.area);
  if (!first) return false;
  const isPerfect = w.def.id === 'perfectMatch';
  const points = [{ x: run.px, y: run.py }];
  const visited = new Set<Enemy>();
  let current = first;
  for (let i = 0; i < s.count; i++) {
    visited.add(current);
    points.push({ x: current.x, y: current.y });
    run.hitEnemy(current, s.damage, { source: w });
    if (isPerfect) current.matchMarkT = 4;
    const next = run.grid.nearest(current.x, current.y, 150, (e) => !visited.has(e));
    if (!next) break;
    current = next;
  }
  run.emit({ type: 'chain', points, color: w.def.color });
  run.emit({ type: 'shoot' });
  return true;
}

function fireColumn(run: Run, w: WeaponInstance, s: ReturnType<typeof effective>): boolean {
  const candidates = nearestN(run, run.px, run.py, s.count * 3, 300);
  if (candidates.length === 0) return false;
  const isSpire = w.def.id === 'overflowSpire';
  const struck: Enemy[] = [];
  for (let i = 0; i < s.count && candidates.length > 0; i++) {
    const idx = Math.floor(Math.random() * candidates.length);
    struck.push(candidates.splice(idx, 1)[0]);
  }
  for (const t of struck) {
    const hits = isSpire ? 3 : 1;
    const dirAng = Math.atan2(t.y - run.py, t.x - run.px);
    for (let h = 0; h < hits; h++) {
      const cx = t.x + Math.cos(dirAng) * h * s.area * 1.4;
      const cy = t.y + Math.sin(dirAng) * h * s.area * 1.4;
      run.grid.forEachInRadius(cx, cy, s.area, (e) => {
        run.hitEnemy(e, s.damage, { knockFrom: { x: cx, y: cy }, knock: 100, source: w });
      });
      run.emit({ type: 'column', x: cx, y: cy, radius: s.area, color: w.def.color });
    }
  }
  return true;
}

/** Fork Bomb: lob bombs at random nearby bugs — they explode where they land
 *  (no contact damage in flight) and fork into scattering children. The Zip
 *  Bomb's children recurse one generation deeper. */
function fireBomb(run: Run, w: WeaponInstance, s: ReturnType<typeof effective>): boolean {
  const candidates = nearestN(run, run.px, run.py, s.count * 3, 360);
  if (candidates.length === 0) return false;
  const isZip = w.def.id === 'zipBomb';
  for (let i = 0; i < s.count; i++) {
    const t = candidates[Math.floor(Math.random() * candidates.length)];
    const tx = t.x + (Math.random() - 0.5) * 40, ty = t.y + (Math.random() - 0.5) * 40;
    const d = dist(run.px, run.py, tx, ty) || 1;
    const life = d / s.speed;
    run.projectiles.push({
      x: run.px, y: run.py,
      vx: ((tx - run.px) / d) * s.speed, vy: ((ty - run.py) / d) * s.speed,
      damage: s.damage, radius: 8, pierce: 0, life,
      slow: 0, slowDur: 0, freeze: 0,
      color: w.def.color, kind: 'bomb', hit: new Set(), source: w,
      bomb: { explodeRadius: s.area, split: isZip ? 4 : 3, gen: isZip ? 2 : 1, maxLife: life },
    });
  }
  run.emit({ type: 'shoot' });
  return true;
}

/** Firewall: a burning line dropped ahead of the player, perpendicular to the
 *  movement direction (area = half-length). The DMZ evolution drops a burning
 *  ring around the player instead (area = radius). Extra count (projectiles
 *  stat) fans more walls / stacks wider rings. */
function fireWall(run: Run, w: WeaponInstance, s: ReturnType<typeof effective>): void {
  const isRing = w.def.id === 'dmz';
  const facing = Math.atan2(run.faceY, run.faceX);
  for (let i = 0; i < s.count; i++) {
    if (isRing) {
      run.walls.push({
        x: run.px, y: run.py, ux: 0, uy: 0, halfLen: 0,
        ring: s.area + i * 45,
        life: s.duration, maxLife: s.duration, tickT: 0,
        damage: s.damage, color: w.def.color, source: w,
      });
    } else {
      // fan extra walls ±35° around the heading
      const dir = facing + (i === 0 ? 0 : (Math.ceil(i / 2) * 0.61) * (i % 2 === 1 ? 1 : -1));
      const cx = run.px + Math.cos(dir) * 80, cy = run.py + Math.sin(dir) * 80;
      run.walls.push({
        x: cx, y: cy,
        ux: -Math.sin(dir), uy: Math.cos(dir), // perpendicular to the heading
        halfLen: s.area, ring: 0,
        life: s.duration, maxLife: s.duration, tickT: 0,
        damage: s.damage, color: w.def.color, source: w,
      });
    }
  }
  run.emit({ type: 'shoot' });
}

/** Ping Storm: homing packets fired at RANDOM enemies in range (not nearest —
 *  storm, not focus). The DDoS evolution is simply a flood of them. */
function fireHoming(run: Run, w: WeaponInstance, s: ReturnType<typeof effective>): boolean {
  const candidates = nearestN(run, run.px, run.py, 24, TARGET_RANGE);
  if (candidates.length === 0) return false;
  for (let i = 0; i < s.count; i++) {
    const t = candidates[Math.floor(Math.random() * candidates.length)];
    // launch in a random direction — the steering brings it around (the swerve
    // is the weapon's look; a straight shot would just be a weaker bolt)
    const a = Math.random() * Math.PI * 2;
    run.projectiles.push({
      x: run.px, y: run.py,
      vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
      damage: s.damage, radius: s.area, pierce: s.pierce, life: 2.2,
      slow: 0, slowDur: 0, freeze: 0,
      color: w.def.color, kind: 'petbolt', hit: new Set(), source: w,
      homing: { target: t, turn: 6.5 },
    });
  }
  run.emit({ type: 'shoot' });
  return true;
}

/** Sudo Scroll: a rare, massive strike on the biggest thing in range (highest
 *  max HP; bosses first by construction). Root Access also EXECUTES non-boss
 *  enemies under 15% HP around the strike point. */
function fireSmite(run: Run, w: WeaponInstance, s: ReturnType<typeof effective>): boolean {
  const candidates = nearestN(run, run.px, run.py, 40, 440);
  if (candidates.length === 0) return false;
  const isRoot = w.def.id === 'rootAccess';
  for (let i = 0; i < s.count; i++) {
    let target: Enemy | null = null;
    for (const e of candidates) {
      if (e.hp <= 0) continue;
      if (!target || e.maxHp > target.maxHp) target = e;
    }
    if (!target) break;
    run.hitEnemy(target, s.damage, { source: w });
    run.emit({ type: 'column', x: target.x, y: target.y, radius: s.area, color: w.def.color });
    if (isRoot) {
      run.grid.forEachInRadius(target.x, target.y, s.area * 1.6, (e) => {
        if (e.isBoss || e.hp <= 0) return;
        if (e.hp < e.maxHp * 0.15) run.hitEnemy(e, e.hp, { noCrit: true, source: w });
      });
    }
    candidates.splice(candidates.indexOf(target), 1);
  }
  run.emit({ type: 'shoot' });
  return true;
}

function updateOrbit(run: Run, w: WeaponInstance, s: ReturnType<typeof effective>, dt: number): void {
  w.orbitAngle += s.speed * dt;
  const bladeR = 17 * run.stats.areaMult;
  const HIT_INTERVAL = 0.45;
  for (let i = 0; i < s.count; i++) {
    const ang = w.orbitAngle + (Math.PI * 2 * i) / s.count;
    const bx = run.px + Math.cos(ang) * s.area;
    const by = run.py + Math.sin(ang) * s.area;
    run.grid.forEachInRadius(bx, by, bladeR + 16, (e) => {
      if (dist(bx, by, e.x, e.y) > bladeR + e.def.radius) return;
      const last = w.hitMemo.get(e) ?? -1;
      if (run.time - last < HIT_INTERVAL) return;
      w.hitMemo.set(e, run.time);
      run.hitEnemy(e, s.damage, { knockFrom: { x: run.px, y: run.py }, knock: 60, source: w });
    });
  }
  if (w.hitMemo.size > 400) w.hitMemo.clear();
}

function updatePet(run: Run, w: WeaponInstance, s: ReturnType<typeof effective>, dt: number): void {
  while (w.petTimers.length < s.count) w.petTimers.push(Math.random() * s.cooldown);
  w.petTimers.length = s.count;
  w.orbitAngle += 0.9 * dt;

  for (let i = 0; i < s.count; i++) {
    w.petTimers[i] -= dt;
    if (w.petTimers[i] > 0) continue;
    const ang = w.orbitAngle + (Math.PI * 2 * i) / s.count;
    const px = run.px + Math.cos(ang) * 52;
    const py = run.py + Math.sin(ang) * 52;
    const target = run.grid.nearest(px, py, 440);
    if (!target) continue;
    w.petTimers[i] = s.cooldown;
    const d = dist(px, py, target.x, target.y) || 1;
    run.projectiles.push({
      x: px, y: py,
      vx: ((target.x - px) / d) * s.speed, vy: ((target.y - py) / d) * s.speed,
      damage: s.damage, radius: 6, pierce: 0, life: 1.3,
      slow: 0, slowDur: 0, freeze: 0,
      color: w.def.color, kind: 'petbolt', hit: new Set(), source: w,
    });
  }
}

/** Pet positions for rendering (daemon familiars orbit the player). */
export function petPositions(run: Run): { x: number; y: number; color: string }[] {
  const out: { x: number; y: number; color: string }[] = [];
  for (const w of run.weapons) {
    if (w.def.kind !== 'pet') continue;
    const s = effective(run, w);
    for (let i = 0; i < s.count; i++) {
      const ang = w.orbitAngle + (Math.PI * 2 * i) / s.count;
      out.push({ x: run.px + Math.cos(ang) * 52, y: run.py + Math.sin(ang) * 52, color: w.def.color });
    }
  }
  return out;
}

/** Orbit blade positions for rendering. */
export function bladePositions(run: Run): { x: number; y: number; color: string; r: number }[] {
  const out: { x: number; y: number; color: string; r: number }[] = [];
  for (const w of run.weapons) {
    if (w.def.kind !== 'orbit') continue;
    const s = effective(run, w);
    for (let i = 0; i < s.count; i++) {
      const ang = w.orbitAngle + (Math.PI * 2 * i) / s.count;
      out.push({
        x: run.px + Math.cos(ang) * s.area,
        y: run.py + Math.sin(ang) * s.area,
        color: w.def.color,
        r: 17 * run.stats.areaMult,
      });
    }
  }
  return out;
}
