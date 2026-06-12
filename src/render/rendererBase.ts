import type { Run, RunEvent } from '../game/run';
import type { BossDef, MapDef } from '../data/types';
import { clamp, formatTime, lerp, rand } from '../core/util';
import { touchStick } from '../core/input';

// Isometric projection: sx = x - y, sy = (x + y) / 2.
// World is simulated on a flat 2D plane; this skews it into a 2:1 diamond view.

export interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; maxLife: number; color: string; size: number; }
export interface DamageNum { x: number; y: number; value: number; life: number; crit: boolean; heal?: boolean; }
export interface Ring { x: number; y: number; radius: number; t: number; dur: number; color: string; }
export interface Arc { x: number; y: number; angle: number; radius: number; full: boolean; t: number; dur: number; color: string; }
export interface Beam { points: { x: number; y: number }[]; t: number; dur: number; color: string; }
export interface Column { x: number; y: number; radius: number; t: number; dur: number; color: string; }

/**
 * Backend-agnostic renderer core: effect/particle state, RunEvent fan-in, the
 * camera, and every 2D overlay (HUD, damage numbers, banners). Subclasses
 * implement only the world pass — Canvas2D (legacy fallback) or WebGL2.
 *
 * Canvas stack: #game (world, owned by the subclass) → #hud (overlays, 2D,
 * below the DOM UI so pause/level-up blur covers it) → #ui → #banners (above
 * the DOM UI so flavor text survives screen overlays).
 */
export abstract class RendererBase {
  hudCtx: CanvasRenderingContext2D;
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
  protected frameMs = 0;
  private fpsDispMs = 0;
  private fpsDispT = 0;
  flash = 0; // screen flash on level up
  healGlow = 0; // green player glow while HP restores
  // FPS safeguard: particle spawn probability, backed off while frame time
  // exceeds the 20ms budget, recovered slowly once comfortably under it.
  particleDensity = 1;
  /** Particle hard cap — the GL backend raises this well past the 2D value. */
  protected maxParticles = 900;

  particles: Particle[] = [];
  damageNums: DamageNum[] = [];
  rings: Ring[] = [];
  arcs: Arc[] = [];
  beams: Beam[] = [];
  columns: Column[] = [];
  banners: { text: string; sub: string; t: number; dur: number; color: string }[] = [];
  // Infinite Loop snapshot marker: where the player will be rewound to (≤1 active)
  rewindMark: { x: number; y: number; t: number; dur: number } | null = null;
  // World-anchored glyphs queued by the GL world pass for the 2D overlay
  // (text can't go through the quad batcher); screen-space coords, cleared
  // every frame after drawing.
  protected worldTexts: { text: string; x: number; y: number; font: string; color: string; baseline?: CanvasTextBaseline }[] = [];

  private vignette: HTMLCanvasElement | null = null;

  constructor(public canvas: HTMLCanvasElement, public hudCanvas: HTMLCanvasElement, public bannerCanvas: HTMLCanvasElement) {
    this.hudCtx = hudCanvas.getContext('2d')!;
    this.bannerCtx = bannerCanvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    for (const c of [this.canvas, this.hudCanvas, this.bannerCanvas]) {
      c.width = this.w * this.dpr;
      c.height = this.h * this.dpr;
      c.style.width = `${this.w}px`;
      c.style.height = `${this.h}px`;
    }
    this.bakeVignette();
  }

  /** Vignette baked once per resize (half-res — it's a smooth gradient) instead
   *  of a per-frame full-screen radial-gradient fill. */
  private bakeVignette(): void {
    const c = this.vignette ?? document.createElement('canvas');
    const vw = Math.max(2, Math.round(this.w / 2));
    const vh = Math.max(2, Math.round(this.h / 2));
    c.width = vw; c.height = vh;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(vw / 2, vh / 2, vh * 0.45, vw / 2, vh / 2, vh * 0.95);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, vw, vh);
    this.vignette = c;
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
  protected spawnParticle(p: Particle): void {
    if (this.particles.length >= this.maxParticles) return;
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
        this.banner('🚨 CRUNCH TIME', 'ship date reached — every bug goes critical; resolve all blockers in 30s', '#ff5e5e', 5);
        this.shake(8);
        break;
      case 'vent': {
        // eruption kick: a brief fire column + ember burst (ongoing embers come
        // from drawVent while the erupt phase lasts)
        this.columns.push({ x: ev.x, y: ev.y, radius: ev.radius * 0.6, t: 0, dur: 0.45, color: '#ff8232' });
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * ev.radius * 0.7;
          this.spawnParticle({
            x: ev.x + Math.cos(a) * d, y: ev.y + Math.sin(a) * d, z: 6,
            vx: rand(-40, 40), vy: rand(-40, 40), vz: rand(200, 420),
            life: rand(0.4, 0.8), maxLife: 0.8,
            color: Math.random() < 0.4 ? '#ffe6aa' : '#ff8232', size: rand(2, 5),
          });
        }
        break;
      }
      case 'teleport':
        // arrival glitch: a tight ring + square static burst
        this.rings.push({ x: ev.x, y: ev.y, radius: 55, t: 0, dur: 0.3, color: '#e0d24b' });
        for (let i = 0; i < 8; i++) {
          this.spawnParticle({
            x: ev.x + rand(-30, 30), y: ev.y + rand(-30, 30), z: 10,
            vx: rand(-60, 60), vy: rand(-60, 60), vz: rand(20, 120),
            life: rand(0.15, 0.4), maxLife: 0.4, color: '#e0d24b', size: rand(3, 6),
          });
        }
        break;
      case 'raceResolved':
        this.banner('RACE LOST', 'the afterimage expired — it resolved in its favor and healed', '#e0d24b', 2.5);
        this.rings.push({ x: ev.x, y: ev.y, radius: 80, t: 0, dur: 0.5, color: '#e0d24b' });
        break;
      case 'slam':
        this.rings.push({ x: ev.x, y: ev.y, radius: ev.radius, t: 0, dur: 0.5, color: '#ff4d4d' });
        this.shake(7);
        for (let i = 0; i < 16; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * ev.radius;
          this.spawnParticle({
            x: ev.x + Math.cos(a) * d, y: ev.y + Math.sin(a) * d, z: 6,
            vx: rand(-100, 100), vy: rand(-100, 100), vz: rand(80, 280),
            life: rand(0.3, 0.6), maxLife: 0.6, color: '#ff4d4d', size: rand(2, 5),
          });
        }
        break;
      case 'hardFreeze':
        this.banner('❄ HARD FREEZE', 'it locked up — heavily armored; weather the blizzard', '#7adcff', 2.5);
        this.rings.push({ x: ev.x, y: ev.y, radius: 110, t: 0, dur: 0.6, color: '#7adcff' });
        this.shake(5);
        break;
      case 'thaw':
        this.banner('THAWED', 'it is vulnerable — strike now', '#b8ffc9', 2.5);
        this.rings.push({ x: ev.x, y: ev.y, radius: 90, t: 0, dur: 0.5, color: '#b8ffc9' });
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
    // swap-remove: particle draw order is irrelevant (tiny additive-ish quads),
    // and splice() in a many-thousand array is the hot path's GC enemy
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
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

  /** Backend world pass: floor, zones, entities, projectiles, effects,
   *  particles — everything camera-translated by (ox, oy). */
  protected abstract renderWorld(run: Run | null, map: MapDef, ox: number, oy: number): void;

  render(run: Run | null, map: MapDef, menuDrift = false): void {
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

    this.renderWorld(run, map, ox, oy);

    // ----- overlay canvas: damage numbers, HUD, flashes, vignette -----
    const ctx = this.hudCtx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.w, this.h);

    this.drawDamageNums(ctx, ox, oy);
    if (this.worldTexts.length > 0) {
      ctx.textAlign = 'center';
      for (const wt of this.worldTexts) {
        ctx.font = wt.font;
        ctx.fillStyle = wt.color;
        ctx.textBaseline = wt.baseline ?? 'alphabetic';
        ctx.fillText(wt.text, wt.x, wt.y);
      }
      ctx.textBaseline = 'alphabetic';
      this.worldTexts.length = 0;
    }
    if (run) {
      this.drawHud(ctx, run);
      this.drawBossIndicators(ctx, run);
      this.drawTouchStick(ctx);
    }
    if (this.fpsCounterEnabled) this.drawFpsCounter(ctx);

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

    if (this.vignette) ctx.drawImage(this.vignette, 0, 0, this.w, this.h);

    ctx.restore();

    this.drawBanners();
  }

  // ---------- overlays (always Canvas2D, on #hud) ----------

  private drawDamageNums(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    ctx.textAlign = 'center';
    for (const d of this.damageNums) {
      const sx = d.x - d.y + ox;
      const sy = (d.x + d.y) / 2 + oy;
      ctx.globalAlpha = clamp(d.life / 0.4, 0, 1);
      ctx.font = d.crit ? 'bold 22px VT323, monospace' : d.heal ? 'bold 18px VT323, monospace' : '17px VT323, monospace';
      ctx.fillStyle = d.crit ? '#ffc12e' : d.heal ? '#41d97f' : '#e8f4ff';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 3;
      const txt = d.crit ? `${d.value}!` : d.heal ? `+${d.value}` : `${d.value}`;
      ctx.strokeText(txt, sx, sy - 30);
      ctx.fillText(txt, sx, sy - 30);
    }
    ctx.globalAlpha = 1;
  }

  /** Edge arrows pointing at bosses that are alive but out of view. */
  private drawBossIndicators(ctx: CanvasRenderingContext2D, run: Run): void {
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

  private drawHud(ctx: CanvasRenderingContext2D, run: Run): void {
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
   *  the reference for the FPS safeguard, which trips at >20ms. */
  private drawFpsCounter(ctx: CanvasRenderingContext2D): void {
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
  private drawTouchStick(ctx: CanvasRenderingContext2D): void {
    const ts = touchStick();
    if (!ts) return;
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
