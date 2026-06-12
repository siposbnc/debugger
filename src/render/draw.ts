import type { Run, RunEvent } from '../game/run';
import { ENEMIES } from '../data/enemies';
import type { BossDef, EnemyDef, MapDef } from '../data/types';
import { bladePositions, petPositions } from '../game/combat';
import { hash2, clamp, formatTime, lerp, rand } from '../core/util';
import { touchStick } from '../core/input';
import {
  bugSprite, bossSprite, playerSprite, gemSprite, coffeeSprite,
  chestSprite, turretSprite, helperSprite, propSprite,
} from './sprites';

// Isometric projection: sx = x - y, sy = (x + y) / 2.
// World is simulated on a flat 2D plane; this skews it into a 2:1 diamond view.

const TILE = 56;

interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; maxLife: number; color: string; size: number; }
interface DamageNum { x: number; y: number; value: number; life: number; crit: boolean; heal?: boolean; }
interface Ring { x: number; y: number; radius: number; t: number; dur: number; color: string; }
interface Arc { x: number; y: number; angle: number; radius: number; full: boolean; t: number; dur: number; color: string; }
interface Beam { points: { x: number; y: number }[]; t: number; dur: number; color: string; }
interface Column { x: number; y: number; radius: number; t: number; dur: number; color: string; }

export class Renderer {
  ctx: CanvasRenderingContext2D;
  // Banners draw on a separate canvas stacked above the DOM UI layer, so
  // screen overlays (level-up/pause blur) never make them unreadable.
  bannerCtx: CanvasRenderingContext2D;
  w = 0; h = 0; dpr = 1;
  camX = 0; camY = 0;
  t = 0; // render clock for HUD pulses
  shakeMag = 0;
  shakeEnabled = true;
  reduceFlashEnabled = false; // photosensitivity: attenuates full-screen flashes + shake
  playerHpBarEnabled = true;
  fpsCounterEnabled = false;
  // FPS counter: EMA of the rAF delta, snapshotted to the display 4×/s so the
  // text is readable. dt is main-loop-clamped at 100ms — irrelevant above 10fps.
  private frameMs = 0;
  private fpsDispMs = 0;
  private fpsDispT = 0;
  flash = 0; // screen flash on level up
  healGlow = 0; // green player glow while HP restores
  // FPS safeguard: particle spawn probability, backed off while frame time
  // exceeds the 20ms budget, recovered slowly once comfortably under it.
  particleDensity = 1;

  particles: Particle[] = [];
  damageNums: DamageNum[] = [];
  rings: Ring[] = [];
  arcs: Arc[] = [];
  beams: Beam[] = [];
  columns: Column[] = [];
  banners: { text: string; sub: string; t: number; dur: number; color: string }[] = [];
  // Infinite Loop snapshot marker: where the player will be rewound to (≤1 active)
  rewindMark: { x: number; y: number; t: number; dur: number } | null = null;

  constructor(public canvas: HTMLCanvasElement, public bannerCanvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.bannerCtx = bannerCanvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    for (const c of [this.canvas, this.bannerCanvas]) {
      c.width = this.w * this.dpr;
      c.height = this.h * this.dpr;
      c.style.width = `${this.w}px`;
      c.style.height = `${this.h}px`;
    }
  }

  proj(x: number, y: number): { x: number; y: number } {
    return { x: x - y, y: (x + y) / 2 };
  }

  banner(text: string, sub: string, color = '#7df9ff', dur = 3): void {
    this.banners.push({ text, sub, t: 0, dur, color });
  }

  shake(mag: number): void {
    if (this.shakeEnabled) this.shakeMag = Math.min(18, this.shakeMag + mag);
  }

  /** FPS safeguard: all particle spawns route through here so density can
   *  back off when the frame budget is blown (never the enemy cap — that's
   *  difficulty balance, not rendering). */
  private spawnParticle(p: Particle): void {
    if (this.particles.length >= 900) return;
    if (this.particleDensity < 1 && Math.random() > this.particleDensity) return;
    this.particles.push(p);
  }

  /** Jump the camera straight to a world position (resuming a suspended run). */
  snapCamera(wx: number, wy: number): void {
    const t = this.proj(wx, wy);
    this.camX = t.x;
    this.camY = t.y;
  }

  // ---------- event → visuals ----------

  handleEvent(ev: RunEvent): void {
    switch (ev.type) {
      case 'kill': {
        const n = ev.big ? 18 : 7;
        for (let i = 0; i < n; i++) {
          this.spawnParticle({
            x: ev.x, y: ev.y, z: 10,
            vx: rand(-120, 120), vy: rand(-120, 120), vz: rand(40, 200),
            life: rand(0.3, 0.7), maxLife: 0.7,
            color: Math.random() < 0.3 ? '#7df9ff' : ev.color,
            size: ev.big ? rand(3, 6) : rand(2, 4),
          });
        }
        if (ev.big) this.shake(4);
        break;
      }
      case 'damage':
        // Legibility cap: past 40 numbers, merge into the nearest live one
        // (accumulating its value) instead of stacking more text.
        if (this.damageNums.length >= 40) {
          let best: DamageNum | null = null;
          let bestD = 120;
          for (const d of this.damageNums) {
            if (d.heal) continue; // never fold enemy damage into a heal number
            const dd = Math.abs(d.x - ev.x) + Math.abs(d.y - ev.y);
            if (dd < bestD) { best = d; bestD = dd; }
          }
          if (best) {
            best.value += ev.value;
            best.crit ||= ev.crit;
            best.life = Math.max(best.life, 0.45);
          } else {
            this.damageNums.shift(); // nothing nearby: recycle the oldest slot
            this.damageNums.push({ x: ev.x + rand(-8, 8), y: ev.y, value: ev.value, life: 0.7, crit: ev.crit });
          }
        } else {
          this.damageNums.push({ x: ev.x + rand(-8, 8), y: ev.y, value: ev.value, life: 0.7, crit: ev.crit });
        }
        break;
      case 'shockwave':
        this.rings.push({ x: ev.x, y: ev.y, radius: ev.radius, t: 0, dur: 0.4, color: ev.color });
        this.shake(3);
        break;
      case 'sweep':
        this.arcs.push({ x: ev.x, y: ev.y, angle: ev.angle, radius: ev.radius, full: ev.full, t: 0, dur: 0.25, color: ev.color });
        break;
      case 'chain':
        this.beams.push({ points: ev.points, t: 0, dur: 0.22, color: ev.color });
        break;
      case 'column':
        this.columns.push({ x: ev.x, y: ev.y, radius: ev.radius, t: 0, dur: 0.4, color: ev.color });
        break;
      case 'explosion':
        this.rings.push({ x: ev.x, y: ev.y, radius: ev.radius, t: 0, dur: 0.45, color: ev.color });
        for (let i = 0; i < 14; i++) {
          this.spawnParticle({
            x: ev.x, y: ev.y, z: 8,
            vx: rand(-180, 180), vy: rand(-180, 180), vz: rand(60, 240),
            life: rand(0.3, 0.6), maxLife: 0.6, color: ev.color, size: rand(2, 5),
          });
        }
        this.shake(3);
        break;
      case 'hurt': this.shake(2.5); break;
      case 'heal':
        // Rare (≤ ~1/s) so it bypasses the 40-number merge cap.
        this.damageNums.push({ x: ev.x, y: ev.y, value: ev.amount, life: 0.8, crit: false, heal: true });
        this.healGlow = 0.35;
        break;
      case 'levelup': this.flash = 0.35; break;
      case 'bossWarning':
        this.banner('⚠ BOSS INCOMING ⚠', ev.name, '#ff5e5e', 4);
        break;
      case 'bossSpawn':
        this.shake(8);
        break;
      case 'snapshot':
        this.rewindMark = { x: ev.x, y: ev.y, t: 0, dur: 2.5 };
        break;
      case 'rewind':
        this.rewindMark = null;
        this.rings.push({ x: ev.x, y: ev.y, radius: 70, t: 0, dur: 0.45, color: '#c45bff' });
        for (let i = 0; i < 12; i++) {
          this.spawnParticle({
            x: ev.x, y: ev.y, z: 8,
            vx: rand(-140, 140), vy: rand(-140, 140), vz: rand(60, 220),
            life: rand(0.3, 0.6), maxLife: 0.6, color: '#c45bff', size: rand(2, 4),
          });
        }
        this.shake(4);
        break;
      case 'forcePush':
        this.banner('⚠ FORCE PUSH', 'uneven damage — the stronger half enrages', '#ff9430', 2.5);
        this.rings.push({ x: ev.x, y: ev.y, radius: 90, t: 0, dur: 0.5, color: '#ff9430' });
        this.shake(4);
        break;
      case 'stackPop':
        this.banner('STACK POPPED', 'frames cleared — it is stunned', '#7df9ff', 2.5);
        this.rings.push({ x: ev.x, y: ev.y, radius: 120, t: 0, dur: 0.5, color: '#7df9ff' });
        this.shake(5);
        break;
      case 'coreExposed':
        this.banner('CORE EXPOSED', 'dependencies removed — armor down', '#41d97f', 2.5);
        this.rings.push({ x: ev.x, y: ev.y, radius: 110, t: 0, dur: 0.5, color: '#41d97f' });
        this.shake(5);
        break;
      case 'memoryFreed':
        this.banner('MEMORY FREED', 'every leaked allocation reclaimed', '#54e06b', 3);
        for (const p of ev.pools) {
          this.rings.push({ x: p.x, y: p.y, radius: 60, t: 0, dur: 0.6, color: '#54e06b' });
        }
        break;
      case 'crunch':
        this.banner('🚨 CRUNCH TIME', 'ship date reached — resolve all release blockers in 30s', '#ff5e5e', 5);
        this.shake(8);
        break;
      case 'bossDie':
        this.banner('BUG RESOLVED', `${ev.name} — closed as fixed`, '#41d97f', 3);
        this.rewindMark = null; // loop terminated: a pending rewind dies with it
        this.shake(10);
        for (let i = 0; i < 40; i++) {
          this.spawnParticle({
            x: ev.x, y: ev.y, z: 14,
            vx: rand(-260, 260), vy: rand(-260, 260), vz: rand(80, 320),
            life: rand(0.5, 1.1), maxLife: 1.1,
            color: Math.random() < 0.5 ? '#ffc12e' : '#7df9ff', size: rand(3, 7),
          });
        }
        break;
      case 'mushiSpawn':
        // precipitates out of solution: a soft teal fizz at the pop-in point
        this.rings.push({ x: ev.x, y: ev.y, radius: 50, t: 0, dur: 0.6, color: '#9fe8dc' });
        for (let i = 0; i < 10; i++) {
          this.spawnParticle({
            x: ev.x + rand(-14, 14), y: ev.y + rand(-14, 14), z: 4,
            vx: rand(-20, 20), vy: rand(-20, 20), vz: rand(30, 80),
            life: rand(0.5, 1.0), maxLife: 1.0, color: '#cfeee8', size: rand(1.5, 3),
          });
        }
        break;
      case 'mushiCaught':
        this.banner('DEPENDENCY RESOLVED', 'field sample secured — a cabal of two', '#ffc12e', 4);
        // crystallization burst: the sample comes out of solution all at once
        this.rings.push({ x: ev.x, y: ev.y, radius: 90, t: 0, dur: 0.5, color: '#9fe8dc' });
        for (let i = 0; i < 28; i++) {
          this.spawnParticle({
            x: ev.x, y: ev.y, z: 10,
            vx: rand(-160, 160), vy: rand(-160, 160), vz: rand(60, 260),
            life: rand(0.4, 0.9), maxLife: 0.9,
            color: Math.random() < 0.5 ? '#ffc12e' : '#9fe8dc', size: rand(2, 5),
          });
        }
        break;
      case 'mushiGone':
        // uncaught: one brief, inexplicably dramatic golden battle aura — then vapor
        this.columns.push({ x: ev.x, y: ev.y, radius: 46, t: 0, dur: 0.8, color: '#ffc12e' });
        this.rings.push({ x: ev.x, y: ev.y, radius: 70, t: 0, dur: 0.7, color: '#ffc12e' });
        for (let i = 0; i < 16; i++) {
          this.spawnParticle({
            x: ev.x + rand(-10, 10), y: ev.y + rand(-10, 10), z: 6,
            vx: rand(-25, 25), vy: rand(-25, 25), vz: rand(60, 140),
            life: rand(0.6, 1.2), maxLife: 1.2,
            color: Math.random() < 0.4 ? '#ffc12e' : 'rgba(228,245,242,0.9)', size: rand(2, 4),
          });
        }
        break;
      case 'evolve':
        this.banner('⬆ WEAPON EVOLVED', `${ev.weaponName} → ${ev.evolvedName}`, '#ffc12e', 4);
        this.flash = 0.4;
        break;
      case 'bonusCard':
        this.banner('BONUS PATCH', ev.cardName, '#c45bff', 3);
        break;
      case 'objective':
        this.banner('OBJECTIVE COMPLETE', ev.name, '#ffc12e', 3);
        break;
      case 'victory':
        this.flash = 0.6;
        break;
      default:
        break;
    }
  }

  // ---------- frame ----------

  update(dt: number): void {
    this.t += dt;
    this.frameMs = this.frameMs === 0 ? dt * 1000 : lerp(this.frameMs, dt * 1000, 0.08);
    this.fpsDispT -= dt;
    if (this.fpsDispT <= 0) {
      this.fpsDispT = 0.25;
      this.fpsDispMs = this.frameMs;
    }
    // FPS safeguard: shed particle density fast over budget, recover slowly.
    if (this.frameMs > 20) this.particleDensity = Math.max(0.15, this.particleDensity - dt * 0.5);
    else if (this.frameMs < 15) this.particleDensity = Math.min(1, this.particleDensity + dt * 0.08);
    this.shakeMag *= Math.pow(0.0001, dt);
    this.flash = Math.max(0, this.flash - dt * 1.6);
    this.healGlow = Math.max(0, this.healGlow - dt);
    for (const list of [this.rings, this.arcs, this.beams, this.columns] as { t: number; dur: number }[][]) {
      for (let i = list.length - 1; i >= 0; i--) {
        list[i].t += dt;
        if (list[i].t >= list[i].dur) list.splice(i, 1);
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.z += p.vz * dt; p.vz -= 600 * dt;
      if (p.z < 0) { p.z = 0; p.vz *= -0.4; }
    }
    for (let i = this.damageNums.length - 1; i >= 0; i--) {
      const d = this.damageNums[i];
      d.life -= dt;
      d.y -= 50 * dt;
      if (d.life <= 0) this.damageNums.splice(i, 1);
    }
    for (let i = this.banners.length - 1; i >= 0; i--) {
      this.banners[i].t += dt;
      if (this.banners[i].t >= this.banners[i].dur) this.banners.splice(i, 1);
    }
    if (this.rewindMark) {
      this.rewindMark.t += dt;
      if (this.rewindMark.t >= this.rewindMark.dur) this.rewindMark = null;
    }
  }

  render(run: Run | null, map: MapDef, menuDrift = false): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // camera follows player (or drifts on the menu background)
    if (run) {
      const target = this.proj(run.px, run.py);
      this.camX = lerp(this.camX, target.x, 0.12);
      this.camY = lerp(this.camY, target.y, 0.12);
    } else if (menuDrift) {
      this.camX += 0.3; this.camY += 0.15;
    }

    const shMag = this.reduceFlashEnabled ? this.shakeMag * 0.35 : this.shakeMag;
    const shX = shMag > 0.2 ? rand(-shMag, shMag) : 0;
    const shY = shMag > 0.2 ? rand(-shMag, shMag) : 0;
    const ox = this.w / 2 - this.camX + shX;
    const oy = this.h / 2 - this.camY + shY;

    // background fog color
    ctx.fillStyle = map.palette.fog;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.translate(ox, oy);
    this.drawFloor(map);
    if (run) this.drawWorld(run);
    ctx.translate(-ox, -oy);

    if (run) {
      this.drawHud(run);
      this.drawBossIndicators(run);
      this.drawTouchStick();
    }
    if (this.fpsCounterEnabled) this.drawFpsCounter();
    this.drawBanners();

    // Full-screen overlays are the photosensitivity risk — reduce-flash cuts
    // their intensity hard but keeps a faint cue so the feedback isn't lost.
    const flashScale = this.reduceFlashEnabled ? 0.25 : 1;
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(125, 249, 255, ${this.flash * 0.35 * flashScale})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (run && run.hurtFlash > 0) {
      ctx.fillStyle = `rgba(255, 60, 60, ${run.hurtFlash * 0.6 * flashScale})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    // vignette
    const grad = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.45, this.w / 2, this.h / 2, this.h * 0.95);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.restore();
  }

  private drawFloor(map: MapDef): void {
    const ctx = this.ctx;
    // visible world-rect from screen corners (inverse projection)
    const inv = (sx: number, sy: number) => ({ x: sx / 2 + sy, y: sy - sx / 2 });
    const corners = [
      inv(this.camX - this.w / 2 - TILE * 2, this.camY - this.h / 2 - TILE * 2),
      inv(this.camX + this.w / 2 + TILE * 2, this.camY - this.h / 2 - TILE * 2),
      inv(this.camX - this.w / 2 - TILE * 2, this.camY + this.h / 2 + TILE * 2),
      inv(this.camX + this.w / 2 + TILE * 2, this.camY + this.h / 2 + TILE * 2),
    ];
    const minTx = Math.floor(Math.min(...corners.map((c) => c.x)) / TILE);
    const maxTx = Math.ceil(Math.max(...corners.map((c) => c.x)) / TILE);
    const minTy = Math.floor(Math.min(...corners.map((c) => c.y)) / TILE);
    const maxTy = Math.ceil(Math.max(...corners.map((c) => c.y)) / TILE);

    const p = map.palette;
    for (let tx = minTx; tx <= maxTx; tx++) {
      for (let ty = minTy; ty <= maxTy; ty++) {
        const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
        const s = this.proj(cx, cy);
        if (s.x < this.camX - this.w / 2 - TILE * 2 || s.x > this.camX + this.w / 2 + TILE * 2) continue;
        if (s.y < this.camY - this.h / 2 - TILE || s.y > this.camY + this.h / 2 + TILE) continue;

        const h = hash2(tx, ty);
        ctx.fillStyle = (tx + ty) % 2 === 0 ? p.ground1 : p.ground2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - TILE / 2);
        ctx.lineTo(s.x + TILE, s.y);
        ctx.lineTo(s.x, s.y + TILE / 2);
        ctx.lineTo(s.x - TILE, s.y);
        ctx.closePath();
        ctx.fill();

        // circuit traces on some tiles
        if (h > 0.82) {
          ctx.strokeStyle = p.grid;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(s.x - TILE * 0.5, s.y);
          ctx.lineTo(s.x, s.y + (h > 0.91 ? -TILE * 0.25 : TILE * 0.25));
          ctx.lineTo(s.x + TILE * 0.5, s.y);
          ctx.stroke();
        }
        // corruption glow patches
        if (h < 0.035) {
          ctx.fillStyle = `${p.accent}22`;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - TILE / 2);
          ctx.lineTo(s.x + TILE, s.y);
          ctx.lineTo(s.x, s.y + TILE / 2);
          ctx.lineTo(s.x - TILE, s.y);
          ctx.closePath();
          ctx.fill();
        }
        // props
        if (h > 0.035 && h < 0.043) {
          const sprite = propSprite(h < 0.038 ? 'terminal' : h < 0.041 ? 'shard' : 'nest');
          ctx.drawImage(sprite, s.x - sprite.width / 4, s.y - sprite.height / 2 - 8, sprite.width / 2, sprite.height / 2);
        }
      }
    }
  }

  private drawWorld(run: Run): void {
    const ctx = this.ctx;

    // ground zones
    for (const z of run.zones) {
      const s = this.proj(z.x, z.y);
      const alpha = z.kind === 'marsh' ? 0.3 : 0.4 * clamp(z.life / 2, 0.3, 1);
      ctx.fillStyle = z.kind === 'marsh' ? `rgba(60, 140, 90, ${alpha})` : `rgba(84, 224, 107, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, z.radius, z.radius / 2, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = z.kind === 'marsh' ? 'rgba(90, 190, 120, 0.35)' : 'rgba(120, 255, 150, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // merge-conflict diff tether: a marching-dash beam between the split halves
    const halves: { x: number; y: number }[] = [];
    for (const e of run.enemies) {
      if (e.isBoss && e.splitDone && (e.def as BossDef).mechanic === 'split') halves.push(e);
    }
    if (halves.length === 2) {
      const a = this.proj(halves[0].x, halves[0].y);
      const b = this.proj(halves[1].x, halves[1].y);
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 148, 48, 0.25)';
      ctx.lineWidth = 13;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 148, 48, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([12, 8]);
      ctx.lineDashOffset = -this.t * 70;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
    }

    // infinite-loop rewind marker: you will be yanked back to this spot
    if (this.rewindMark) {
      const m = this.rewindMark;
      const s = this.proj(m.x, m.y);
      const pulse = 1 + 0.12 * Math.sin(this.t * 9);
      const left = 1 - m.t / m.dur; // fraction of the countdown remaining
      ctx.strokeStyle = 'rgba(196, 91, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, 26 * pulse, 13 * pulse, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(196, 91, 255, 0.3)';
      ctx.beginPath(); ctx.ellipse(s.x, s.y, 26 * left, 13 * left, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#c45bff';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⟲', s.x, s.y - 16);
    }

    // xp gems + pickups (on the ground, under entities)
    for (const p of run.pickups) {
      const s = this.proj(p.x, p.y);
      let sprite: HTMLCanvasElement;
      if (p.kind === 'xp') sprite = gemSprite(p.value >= 20 ? 2 : p.value >= 5 ? 1 : 0);
      else if (p.kind === 'hp') sprite = coffeeSprite();
      else sprite = chestSprite();
      const bob = Math.sin(performance.now() / 300 + p.x) * 3;
      ctx.drawImage(sprite, s.x - sprite.width / 4, s.y - sprite.height / 4 + bob - 6, sprite.width / 2, sprite.height / 2);
    }

    // depth-sorted billboards
    interface Drawable { depth: number; draw: () => void; }
    const drawables: Drawable[] = [];

    for (const e of run.enemies) {
      const s = this.proj(e.x, e.y);
      drawables.push({
        depth: e.x + e.y,
        draw: () => {
          // shadow
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath();
          ctx.ellipse(s.x, s.y, e.def.radius * (e.elite ? 1.4 : 1), e.def.radius / 2, 0, 0, 7);
          ctx.fill();

          const sprite = e.isBoss
            ? bossSprite(e.def.id, e.def.radius, (e.def as BossDef).color)
            : bugSprite((e.def as EnemyDef).shape, e.def.radius, (e.def as EnemyDef).color, e.elite);
          const w = sprite.width / 2, h = sprite.height / 2;

          // centipede body segments behind the head
          if (!e.isBoss && (e.def as EnemyDef).shape === 'centipede') {
            for (let i = 1; i <= 3; i++) {
              const bx = e.x - Math.cos(e.facing) * i * e.def.radius * 1.3;
              const by = e.y - Math.sin(e.facing) * i * e.def.radius * 1.3;
              const bs = this.proj(bx, by);
              ctx.fillStyle = (e.def as EnemyDef).color;
              ctx.globalAlpha = 0.85 - i * 0.15;
              ctx.beginPath();
              ctx.arc(bs.x, bs.y - 8, e.def.radius * (1 - i * 0.12), 0, 7);
              ctx.fill();
              ctx.globalAlpha = 1;
            }
          }

          // force-push enrage: pulsing red threat ring under the sprite
          if (e.enraged) {
            ctx.strokeStyle = 'rgba(255, 94, 94, 0.85)';
            ctx.lineWidth = 4;
            const pr2 = e.def.radius * (1.5 + 0.12 * Math.sin(this.t * 10));
            ctx.beginPath(); ctx.ellipse(s.x, s.y, pr2, pr2 / 2, 0, 0, 7); ctx.stroke();
          }
          // resistant right now (monolith armor, stack-overflow frames):
          // rotating dashed shield ring so the state is unmistakable
          if (e.isBoss && (e.armorMult ?? 1) < 1) {
            ctx.save();
            ctx.strokeStyle = 'rgba(157, 178, 199, 0.9)';
            ctx.lineWidth = 3;
            ctx.setLineDash([11, 7]);
            ctx.lineDashOffset = -this.t * 45;
            const sr = e.def.radius * 1.75;
            ctx.beginPath(); ctx.ellipse(s.x, s.y, sr, sr / 2, 0, 0, 7); ctx.stroke();
            ctx.restore();
          }
          ctx.save();
          if (e.hitFlash > 0) ctx.filter = 'brightness(2.2)';
          if (e.frozenT > 0) ctx.filter = 'saturate(0.2) brightness(1.4)';
          if (e.isBoss && (e.armorMult ?? 1) < 1) {
            // resistant right now (monolith armor, stack-overflow frames): dimmed
            ctx.filter = e.armorMult! <= 0.25 ? 'saturate(0.3) brightness(0.8)' : 'saturate(0.55) brightness(0.9)';
          }
          if (e.enraged && e.hitFlash <= 0) ctx.filter = 'brightness(1.35) saturate(1.5)';
          if (e.isCopy) ctx.globalAlpha = 0.55;
          ctx.drawImage(sprite, s.x - w / 2, s.y - h + e.def.radius / 2, w, h);
          ctx.restore();

          // boss / elite hp bar above
          if (e.isBoss || e.elite) {
            const bw = e.def.radius * 2.2;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(s.x - bw / 2, s.y - h - 4, bw, 5);
            ctx.fillStyle = e.isBoss ? '#ff5e5e' : '#ffc12e';
            ctx.fillRect(s.x - bw / 2, s.y - h - 4, bw * clamp(e.hp / e.maxHp, 0, 1), 5);
            // stack overflow: one pip per live stack frame guarding it
            if (e.isBoss && (e.def as BossDef).mechanic === 'summon' && (e.addsAlive ?? 0) > 0) {
              ctx.fillStyle = '#9db2c7';
              const n = Math.min(12, e.addsAlive!);
              for (let i = 0; i < n; i++) {
                ctx.fillRect(s.x - bw / 2 + i * 9, s.y - h - 13, 6, 6);
              }
            }
            // force-push enrage callout
            if (e.enraged) {
              ctx.fillStyle = '#ff5e5e';
              ctx.font = 'bold 14px monospace';
              ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
              ctx.fillText('!!', s.x, s.y - h - 8);
            }
          }
        },
      });
    }

    // allies
    for (const a of run.allies) {
      const s = this.proj(a.x, a.y);
      drawables.push({
        depth: a.x + a.y,
        draw: () => {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath(); ctx.ellipse(s.x, s.y, 12, 6, 0, 0, 7); ctx.fill();
          const sprite = a.kind === 'turret' ? turretSprite() : helperSprite();
          ctx.drawImage(sprite, s.x - sprite.width / 4, s.y - sprite.height / 2, sprite.width / 2, sprite.height / 2);
        },
      });
    }

    // pets
    for (const pet of petPositions(run)) {
      const s = this.proj(pet.x, pet.y);
      drawables.push({
        depth: pet.x + pet.y,
        draw: () => {
          const bob = Math.sin(performance.now() / 250 + pet.x) * 3;
          ctx.save();
          ctx.shadowColor = pet.color; ctx.shadowBlur = 8;
          ctx.fillStyle = pet.color;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - 26 + bob);
          ctx.lineTo(s.x + 8, s.y - 18 + bob);
          ctx.lineTo(s.x, s.y - 10 + bob);
          ctx.lineTo(s.x - 8, s.y - 18 + bob);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        },
      });
    }

    // The Precipitate (easter egg): wanders obliviously among the bugs
    if (run.mushi) {
      const m = run.mushi;
      const def = ENEMIES.mushi;
      const s = this.proj(m.x, m.y);
      drawables.push({
        depth: m.x + m.y,
        draw: () => {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.ellipse(s.x, s.y, def.radius, def.radius / 2, 0, 0, 7);
          ctx.fill();
          const sprite = bugSprite(def.shape, def.radius, def.color, false);
          const w = sprite.width / 2, h = sprite.height / 2;
          ctx.save();
          // fading in the last few seconds before it evaporates
          if (m.t < 5) ctx.globalAlpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.t * 9));
          const bob = Math.sin(this.t * 6 + m.x) * 1.5;
          ctx.drawImage(sprite, s.x - w / 2, s.y - h + def.radius / 2 + bob, w, h);
          ctx.restore();
        },
      });
      // ambient bubble trail
      if (Math.random() < 0.25) {
        this.spawnParticle({
          x: m.x + rand(-6, 6), y: m.y + rand(-6, 6), z: 6,
          vx: rand(-8, 8), vy: rand(-8, 8), vz: rand(25, 55),
          life: rand(0.4, 0.8), maxLife: 0.8, color: '#cfeee8', size: rand(1, 2.5),
        });
      }
    }

    // player
    {
      const s = this.proj(run.px, run.py);
      drawables.push({
        depth: run.px + run.py,
        draw: () => {
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.beginPath(); ctx.ellipse(s.x, s.y, 14, 7, 0, 0, 7); ctx.fill();
          const sprite = playerSprite(run.character.color);
          ctx.save();
          if (run.hurtFlash > 0.1) {
            ctx.filter = 'brightness(1.8) sepia(0.5) hue-rotate(-50deg)';
          } else if (this.healGlow > 0.05) {
            // sepia pushes hue to ~40°, +80° lands on green — mirror of the hurt tint
            ctx.filter = 'brightness(1.4) sepia(0.4) hue-rotate(80deg)';
            ctx.shadowColor = '#41d97f';
            ctx.shadowBlur = 18 * (this.healGlow / 0.35);
          }
          const flip = run.faceX - run.faceY < 0; // facing screen-left
          if (flip) { ctx.translate(s.x, 0); ctx.scale(-1, 1); ctx.translate(-s.x, 0); }
          ctx.drawImage(sprite, s.x - sprite.width / 4, s.y - sprite.height / 2 - 6, sprite.width / 2, sprite.height / 2);
          ctx.restore();

          if (this.playerHpBarEnabled) {
            const bw = 34;
            const by = s.y - sprite.height / 2 - 14;
            const frac = clamp(run.hp / run.stats.maxHp, 0, 1);
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(s.x - bw / 2, by, bw, 5);
            ctx.fillStyle = frac > 0.35 ? '#41d97f' : '#ff5e5e';
            ctx.fillRect(s.x - bw / 2, by, bw * frac, 5);
          }
        },
      });
    }

    drawables.sort((a, b) => a.depth - b.depth);
    for (const d of drawables) d.draw();

    // orbit blades (over entities)
    for (const b of bladePositions(run)) {
      const s = this.proj(b.x, b.y);
      ctx.save();
      ctx.shadowColor = b.color; ctx.shadowBlur = 10;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - b.r - 8);
      ctx.lineTo(s.x + b.r * 0.5, s.y - 8);
      ctx.lineTo(s.x, s.y + b.r * 0.6 - 8);
      ctx.lineTo(s.x - b.r * 0.5, s.y - 8);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // projectiles
    for (const p of run.projectiles) {
      const s = this.proj(p.x, p.y);
      ctx.save();
      ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.fillStyle = p.color;
      if (p.kind === 'arrow') {
        const ang = Math.atan2((p.vx + p.vy) / 2, p.vx - p.vy); // screen-space angle
        ctx.translate(s.x, s.y - 10);
        ctx.rotate(ang);
        ctx.fillRect(-10, -2, 20, 4);
        ctx.beginPath(); ctx.moveTo(10, -5); ctx.lineTo(16, 0); ctx.lineTo(10, 5); ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(s.x, s.y - 10, p.kind === 'petbolt' ? 4 : 6, 0, 7);
        ctx.fill();
      }
      ctx.restore();
    }

    // enemy shots
    for (const sh of run.enemyShots) {
      const s = this.proj(sh.x, sh.y);
      ctx.save();
      ctx.shadowColor = sh.color; ctx.shadowBlur = 10;
      ctx.fillStyle = sh.color;
      ctx.beginPath(); ctx.arc(s.x, s.y - 8, sh.radius * 0.8, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(s.x, s.y - 8, sh.radius * 0.35, 0, 7); ctx.fill();
      ctx.restore();
    }

    this.drawEffects();
    this.drawParticles();
    this.drawDamageNums();
  }

  private drawEffects(): void {
    const ctx = this.ctx;
    for (const r of this.rings) {
      const s = this.proj(r.x, r.y);
      const t = r.t / r.dur;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = 5 * (1 - t) + 1;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, r.radius * t, (r.radius * t) / 2, 0, 0, 7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const a of this.arcs) {
      const s = this.proj(a.x, a.y);
      const t = a.t / a.dur;
      // convert world angle to screen-space for the ellipse arc
      const screenAng = Math.atan2(Math.sin(a.angle) + Math.cos(a.angle), 2 * (Math.cos(a.angle) - Math.sin(a.angle)));
      ctx.fillStyle = a.color;
      ctx.globalAlpha = 0.35 * (1 - t);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      if (a.full) {
        ctx.ellipse(s.x, s.y, a.radius, a.radius / 2, 0, 0, 7);
      } else {
        ctx.ellipse(s.x, s.y, a.radius, a.radius / 2, 0, screenAng - 1.0, screenAng + 1.0);
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const b of this.beams) {
      const t = b.t / b.dur;
      ctx.save();
      ctx.shadowColor = b.color; ctx.shadowBlur = 12;
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = 3.5 * (1 - t) + 0.5;
      ctx.beginPath();
      const first = this.proj(b.points[0].x, b.points[0].y);
      ctx.moveTo(first.x, first.y - 10);
      for (let i = 1; i < b.points.length; i++) {
        const p = this.proj(b.points[i].x, b.points[i].y);
        // jagged middle point for lightning feel
        const prev = this.proj(b.points[i - 1].x, b.points[i - 1].y);
        ctx.lineTo((prev.x + p.x) / 2 + rand(-8, 8), (prev.y + p.y) / 2 - 10 + rand(-8, 8));
        ctx.lineTo(p.x, p.y - 10);
      }
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    for (const c of this.columns) {
      const s = this.proj(c.x, c.y);
      const t = c.t / c.dur;
      const height = 140 * (t < 0.3 ? t / 0.3 : 1);
      ctx.save();
      ctx.shadowColor = c.color; ctx.shadowBlur = 14;
      ctx.fillStyle = c.color;
      ctx.globalAlpha = 0.8 * (1 - t);
      ctx.fillRect(s.x - c.radius * 0.35, s.y - height, c.radius * 0.7, height);
      ctx.globalAlpha = 0.3 * (1 - t);
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, c.radius, c.radius / 2, 0, 0, 7);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  private drawParticles(): void {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const s = this.proj(p.x, p.y);
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(s.x - p.size / 2, s.y - p.z - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawDamageNums(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    for (const d of this.damageNums) {
      const s = this.proj(d.x, d.y);
      ctx.globalAlpha = clamp(d.life / 0.4, 0, 1);
      ctx.font = d.crit ? 'bold 22px VT323, monospace' : d.heal ? 'bold 18px VT323, monospace' : '17px VT323, monospace';
      ctx.fillStyle = d.crit ? '#ffc12e' : d.heal ? '#41d97f' : '#e8f4ff';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 3;
      const txt = d.crit ? `${d.value}!` : d.heal ? `+${d.value}` : `${d.value}`;
      ctx.strokeText(txt, s.x, s.y - 30);
      ctx.fillText(txt, s.x, s.y - 30);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- HUD ----------

  /** Edge arrows pointing at bosses that are alive but out of view. */
  private drawBossIndicators(run: Run): void {
    const ctx = this.ctx;
    const slack = 40;   // boss counts as visible until this far past the edge
    const margin = 34;  // arrow inset from the screen edge
    for (const e of run.enemies) {
      if (!e.isBoss) continue;
      const p = this.proj(e.x, e.y);
      const sx = p.x - this.camX + this.w / 2;
      const sy = p.y - this.camY + this.h / 2;
      if (sx > -slack && sx < this.w + slack && sy > -slack && sy < this.h + slack) continue;

      const ax = clamp(sx, margin, this.w - margin);
      const ay = clamp(sy, margin + 44, this.h - margin); // stay below the XP bar
      const ang = Math.atan2(sy - ay, sx - ax);
      const pulse = 0.75 + 0.25 * Math.sin(this.t * 7);

      ctx.save();
      ctx.translate(ax, ay);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = 'rgba(8, 12, 18, 0.75)';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = e.def.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = '15px VT323, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = e.def.color;
      ctx.fillText('⚠', 0, 5);
      // arrowhead on the rim, pointing at the boss
      ctx.rotate(ang);
      ctx.fillStyle = e.def.color;
      ctx.beginPath();
      ctx.moveTo(26, 0);
      ctx.lineTo(16, -6);
      ctx.lineTo(16, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // The Precipitate: faint gold shimmer at the edge — curiosity, not threat
    // (no ⚠; gold = reward in the color language).
    if (run.mushi) {
      const m = run.mushi;
      const p = this.proj(m.x, m.y);
      const sx = p.x - this.camX + this.w / 2;
      const sy = p.y - this.camY + this.h / 2;
      if (sx <= -slack || sx >= this.w + slack || sy <= -slack || sy >= this.h + slack) {
        const ax = clamp(sx, margin, this.w - margin);
        const ay = clamp(sy, margin + 44, this.h - margin);
        const ang = Math.atan2(sy - ay, sx - ax);
        const pulse = 0.35 + 0.25 * Math.sin(this.t * 4);
        const urgency = m.t < 8 ? 1.4 : 1; // brightens as the window closes
        ctx.save();
        ctx.translate(ax, ay);
        ctx.globalAlpha = Math.min(1, pulse * urgency);
        ctx.fillStyle = 'rgba(8, 12, 18, 0.6)';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffc12e';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.font = '14px VT323, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffc12e';
        ctx.fillText('?', 0, 5);
        ctx.rotate(ang);
        ctx.fillStyle = '#ffc12e';
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(13, -5);
        ctx.lineTo(13, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawHud(run: Run): void {
    const ctx = this.ctx;
    const pad = 16;

    // XP bar across the top
    const xpNeed = run.xpForLevel(run.level);
    ctx.fillStyle = 'rgba(8, 12, 18, 0.8)';
    ctx.fillRect(0, 0, this.w, 14);
    ctx.fillStyle = '#3fa9ff';
    ctx.fillRect(0, 0, this.w * clamp(run.xp / xpNeed, 0, 1), 14);
    ctx.fillStyle = '#dff1ff';
    ctx.font = '15px VT323, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`LV ${run.level}`, this.w / 2, 12);

    // timer
    ctx.font = '38px VT323, monospace';
    ctx.fillStyle = '#e8f4ff';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 4;
    ctx.strokeText(formatTime(run.time), this.w / 2, 52);
    ctx.fillText(formatTime(run.time), this.w / 2, 52);

    // crunch-time overtime: blocking the release costs the run
    if (run.crunchT > 0) {
      const blink = run.crunchT < 10 && Math.sin(this.t * 10) > 0;
      ctx.font = '26px VT323, monospace';
      ctx.fillStyle = blink ? '#ffd2d2' : '#ff5e5e';
      ctx.strokeText(`SHIP IN ${run.crunchT.toFixed(1)}s`, this.w / 2, 80);
      ctx.fillText(`SHIP IN ${run.crunchT.toFixed(1)}s`, this.w / 2, 80);
    }

    // HP bar (bottom-left)
    const hpW = 220;
    const hpY = this.h - pad - 22;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(8, 12, 18, 0.8)';
    ctx.fillRect(pad, hpY, hpW, 22);
    const hpFrac = clamp(run.hp / run.stats.maxHp, 0, 1);
    ctx.fillStyle = hpFrac > 0.35 ? '#41d97f' : '#ff5e5e';
    ctx.fillRect(pad, hpY, hpW * hpFrac, 22);
    ctx.strokeStyle = 'rgba(125, 249, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad + 0.5, hpY + 0.5, hpW, 22);
    ctx.fillStyle = '#0b1016';
    ctx.font = '17px VT323, monospace';
    ctx.fillText(`HP ${Math.ceil(run.hp)} / ${Math.round(run.stats.maxHp)}`, pad + 8, hpY + 17);

    // weapons row above HP bar
    let wx = pad;
    const wy = hpY - 38;
    ctx.font = '13px VT323, monospace';
    for (const w of run.weapons) {
      ctx.fillStyle = 'rgba(8, 12, 18, 0.8)';
      ctx.fillRect(wx, wy, 30, 30);
      ctx.strokeStyle = w.def.isEvolution ? '#ffc12e' : w.def.color;
      ctx.strokeRect(wx + 0.5, wy + 0.5, 30, 30);
      ctx.fillStyle = w.def.color;
      ctx.font = '20px VT323, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(w.def.icon, wx + 15, wy + 22);
      ctx.font = '12px VT323, monospace';
      ctx.fillStyle = '#dff1ff';
      ctx.fillText(w.def.isEvolution ? '★' : `${w.level}`, wx + 24, wy + 29);
      wx += 36;
    }
    ctx.textAlign = 'left';

    // kills / bits (top-right)
    ctx.textAlign = 'right';
    ctx.font = '22px VT323, monospace';
    ctx.fillStyle = '#e8f4ff';
    ctx.fillText(`🐛 ${run.kills}`, this.w - pad, 44);
    ctx.fillStyle = '#ffc12e';
    ctx.fillText(`⌬ ${run.computeBits().bits} bits`, this.w - pad, 70);

    // next boss countdown (top-right, under bits) — moot once crunch starts
    const tToBoss = run.nextBossAt - run.time;
    if (tToBoss < 99999 && !run.crunchStarted) {
      ctx.fillStyle = tToBoss < 10 ? '#ff5e5e' : 'rgba(232, 244, 255, 0.6)';
      ctx.font = '17px VT323, monospace';
      ctx.fillText(`next boss ${formatTime(Math.max(0, tToBoss))}`, this.w - pad, 92);
    }

    // alive boss bar (top-center)
    const boss = run.enemies.find((e) => e.isBoss);
    if (boss) {
      const bw = Math.min(480, this.w * 0.5);
      const bx = this.w / 2 - bw / 2;
      ctx.fillStyle = 'rgba(8, 12, 18, 0.8)';
      ctx.fillRect(bx, 64, bw, 14);
      ctx.fillStyle = '#ff5e5e';
      ctx.fillRect(bx, 64, bw * clamp(boss.hp / boss.maxHp, 0, 1), 14);
      ctx.strokeStyle = 'rgba(255, 94, 94, 0.5)';
      ctx.strokeRect(bx + 0.5, 64.5, bw, 14);
      ctx.fillStyle = '#ffd9d9';
      ctx.font = '15px VT323, monospace';
      ctx.textAlign = 'center';
      ctx.fillText((boss.def as BossDef).name, this.w / 2, 92);
    }
    ctx.textAlign = 'left';
  }

  /** FPS + frame-time readout (settings toggle, default off). The ms figure is
   *  the reference for the planned FPS safeguard, which trips at >20ms. */
  private drawFpsCounter(): void {
    const ctx = this.ctx;
    const ms = this.fpsDispMs;
    if (ms <= 0) return;
    const fps = Math.round(1000 / ms);
    ctx.font = '17px VT323, monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = ms > 20 ? '#ff5e5e' : ms > 17.5 ? '#ffc12e' : '#53e8a8';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    const text = `${fps} FPS · ${ms.toFixed(1)} ms`;
    ctx.strokeText(text, this.w - 16, this.h - 14);
    ctx.fillText(text, this.w - 16, this.h - 14);
    ctx.textAlign = 'left';
  }

  /** Floating virtual stick (touch play): faint base ring + knob under the finger. */
  private drawTouchStick(): void {
    const ts = touchStick();
    if (!ts) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#7df9ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ts.baseX, ts.baseY, ts.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(125, 249, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(ts.baseX + ts.knobX, ts.baseY + ts.knobY, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7df9ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  private drawBanners(): void {
    const ctx = this.bannerCtx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.w, this.h);
    let y = this.h * 0.22;
    ctx.textAlign = 'center';
    for (const b of this.banners) {
      const fadeIn = clamp(b.t / 0.2, 0, 1);
      const fadeOut = clamp((b.dur - b.t) / 0.4, 0, 1);
      ctx.globalAlpha = Math.min(fadeIn, fadeOut);
      ctx.font = '42px VT323, monospace';
      ctx.fillStyle = b.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 5;
      ctx.strokeText(b.text, this.w / 2, y);
      ctx.fillText(b.text, this.w / 2, y);
      ctx.font = '24px VT323, monospace';
      ctx.fillStyle = '#e8f4ff';
      ctx.strokeText(b.sub, this.w / 2, y + 30);
      ctx.fillText(b.sub, this.w / 2, y + 30);
      y += 76;
    }
    ctx.restore();
  }
}
