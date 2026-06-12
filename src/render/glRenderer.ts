import { ventPhase, type GroundZone, type Run } from '../game/run';
import { ENEMIES } from '../data/enemies';
import type { BossDef, EnemyDef, MapDef } from '../data/types';
import { bladePositions, petPositions } from '../game/combat';
import { hash2, clamp, rand } from '../core/util';
import {
  bugSprite, bossSprite, playerSprite, gemSprite, coffeeSprite,
  chestSprite, turretSprite, helperSprite, propSprite,
} from './sprites';
import { RendererBase } from './rendererBase';
import { Batch, parseColor } from './gl/glx';
import { Atlas, type Region } from './gl/atlas';

const TILE = 56;

// Depth-sorted entity pass entries — pooled, no per-frame closures.
interface SortEntry { depth: number; kind: number; obj: unknown; }
const K_ENEMY = 0, K_ALLY = 1, K_PET = 2, K_MUSHI = 3, K_PLAYER = 4;

/**
 * WebGL2 world renderer: every world draw goes through one batched quad
 * shader (sprites from the atlas + SDF ellipse/ring/arc/diamond primitives),
 * normally a single draw call per frame. The old per-draw shadowBlur becomes
 * baked glow / soft-ellipse underlays; per-enemy ctx.filter becomes per-quad
 * whiten/desat/brighten. Overlays (HUD/text) stay Canvas2D in the base class.
 */
export class GlRenderer extends RendererBase {
  private gl!: WebGL2RenderingContext;
  private batch!: Batch;
  private atlas!: Atlas;
  private sortBuf: SortEntry[] = [];
  private arrowCache = new Map<string, HTMLCanvasElement>();

  constructor(canvas: HTMLCanvasElement, hudCanvas: HTMLCanvasElement, bannerCanvas: HTMLCanvasElement) {
    super(canvas, hudCanvas, bannerCanvas);
    this.maxParticles = 6000; // GPU headroom — the 2D path capped at 900
    this.initGL();
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    canvas.addEventListener('webglcontextrestored', () => this.initGL());
    this.resize();
  }

  private initGL(): void {
    const gl = this.canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied alpha
    this.batch = new Batch(gl);
    this.atlas = new Atlas(gl);
    this.arrowCache.clear();
    this.resize();
  }

  override resize(): void {
    super.resize();
    if (!this.gl) return; // base constructor runs before GL init
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.batch.setResolution(this.w, this.h);
  }

  /** Atlas region for a baked sprite canvas. */
  private reg(c: HTMLCanvasElement): Region {
    return this.atlas.region(c);
  }

  /** drawImage(c, x0, y0, c.width/2, c.height/2) equivalent. */
  private spr(c: HTMLCanvasElement, x0: number, y0: number, whiten = 0, desat = 0, bright = 1, flipX = false): void {
    const r = this.reg(c);
    this.batch.sprite(r, x0 + c.width / 4, y0 + c.height / 4, c.width / 2, c.height / 2, whiten, desat, bright, flipX);
  }

  protected renderWorld(run: Run | null, map: MapDef, ox: number, oy: number): void {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    const [fr, fg, fb] = parseColor(map.palette.fog);
    gl.clearColor(fr, fg, fb, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas.tex);

    this.drawFloor(map, ox, oy);
    if (run) this.drawEntities(run, ox, oy);
    this.drawEffects(ox, oy);
    this.drawParticles(ox, oy);
    this.batch.flush();
  }

  // ---------- floor ----------

  private drawFloor(map: MapDef, ox: number, oy: number): void {
    const b = this.batch;
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
        const sx = cx - cy, sy = (cx + cy) / 2;
        if (sx < this.camX - this.w / 2 - TILE * 2 || sx > this.camX + this.w / 2 + TILE * 2) continue;
        if (sy < this.camY - this.h / 2 - TILE || sy > this.camY + this.h / 2 + TILE) continue;
        const x = sx + ox, y = sy + oy;

        const h = hash2(tx, ty);
        b.color((tx + ty) % 2 === 0 ? p.ground1 : p.ground2);
        // 3% oversize: neighbors overlap by a hair so AA edges can't open seams
        b.diamond(x, y, TILE * 1.03, TILE * 0.515);

        // circuit traces on some tiles
        if (h > 0.82) {
          const my = y + (h > 0.91 ? -TILE * 0.25 : TILE * 0.25);
          b.color(p.grid);
          b.line(x - TILE * 0.5, y, x, my, 1.2);
          b.line(x, my, x + TILE * 0.5, y, 1.2);
        }
        // corruption glow patches
        if (h < 0.035) {
          b.color(p.accent, 0.133); // the old `${accent}22`
          b.diamond(x, y, TILE, TILE / 2);
        }
        // props
        if (h > 0.035 && h < 0.043) {
          const sprite = propSprite(h < 0.038 ? 'terminal' : h < 0.041 ? 'shard' : 'nest');
          b.alpha(1);
          this.spr(sprite, x - sprite.width / 4, y - sprite.height / 2 - 8);
        }
      }
    }
  }

  // ---------- world entities ----------

  private drawEntities(run: Run, ox: number, oy: number): void {
    const b = this.batch;
    const px = (wx: number, wy: number) => wx - wy + ox;
    const py = (wx: number, wy: number) => (wx + wy) / 2 + oy;

    // ground zones
    for (const z of run.zones) {
      const sx = px(z.x, z.y), sy = py(z.x, z.y);
      if (z.kind === 'vent') {
        this.drawVent(z, sx, sy);
        continue;
      }
      if (z.kind === 'latency') {
        this.drawLatency(z, sx, sy);
        continue;
      }
      const alpha = z.kind === 'marsh' ? 0.3 : 0.4 * clamp(z.life / 2, 0.3, 1);
      b.color(z.kind === 'marsh' ? 'rgb(60, 140, 90)' : 'rgb(84, 224, 107)', alpha);
      b.ellipse(sx, sy, z.radius, z.radius / 2);
      b.color(z.kind === 'marsh' ? 'rgba(90, 190, 120, 0.35)' : 'rgba(120, 255, 150, 0.5)');
      b.ring(sx, sy, z.radius, z.radius / 2, 1.5);
    }

    // firewalls / DMZ rings: glowing burn shapes + rising flame particles
    for (const wl of run.walls) {
      const fade = Math.min(1, wl.life / 0.5); // burn out in the last half-second
      if (wl.ring > 0) {
        const sx = px(wl.x, wl.y), sy = py(wl.x, wl.y);
        b.color(wl.color, 0.18 * fade);
        b.ring(sx, sy, wl.ring, wl.ring / 2, 13);
        b.color(wl.color, 0.85 * fade);
        b.ring(sx, sy, wl.ring, wl.ring / 2, 2.5);
        if (Math.random() < 0.6) {
          const a = Math.random() * Math.PI * 2;
          this.spawnParticle({
            x: wl.x + Math.cos(a) * wl.ring, y: wl.y + Math.sin(a) * wl.ring, z: 2,
            vx: rand(-15, 15), vy: rand(-15, 15), vz: rand(60, 150),
            life: rand(0.25, 0.5), maxLife: 0.5,
            color: Math.random() < 0.35 ? '#ffe6aa' : wl.color, size: rand(2, 4),
          });
        }
      } else {
        const x1 = wl.x - wl.ux * wl.halfLen, y1 = wl.y - wl.uy * wl.halfLen;
        const x2 = wl.x + wl.ux * wl.halfLen, y2 = wl.y + wl.uy * wl.halfLen;
        b.color(wl.color, 0.22 * fade);
        b.line(px(x1, y1), py(x1, y1), px(x2, y2), py(x2, y2), 12);
        b.color(wl.color, 0.9 * fade);
        b.line(px(x1, y1), py(x1, y1), px(x2, y2), py(x2, y2), 3);
        if (Math.random() < 0.6) {
          const t = rand(-wl.halfLen, wl.halfLen);
          this.spawnParticle({
            x: wl.x + wl.ux * t, y: wl.y + wl.uy * t, z: 2,
            vx: rand(-15, 15), vy: rand(-15, 15), vz: rand(60, 150),
            life: rand(0.25, 0.5), maxLife: 0.5,
            color: Math.random() < 0.35 ? '#ffe6aa' : wl.color, size: rand(2, 4),
          });
        }
      }
    }

    // critical-exception slam telegraphs: red circle filling inward as the
    // impact approaches — leave it before the fill completes
    for (const s of run.slams) {
      const sx = px(s.x, s.y), sy = py(s.x, s.y);
      const p = 1 - clamp(s.t / s.maxT, 0, 1); // 0 → 1 toward impact
      b.color(s.color, 0.12 + 0.18 * p);
      b.ellipse(sx, sy, s.radius, s.radius / 2);
      b.color(s.color, 0.85);
      b.ring(sx, sy, s.radius, s.radius / 2, 2);
      b.color('rgb(255, 230, 200)', 0.5 + 0.3 * p);
      b.ring(sx, sy, s.radius * p, (s.radius * p) / 2, 2.5);
    }

    // merge-conflict diff tether: a marching-dash beam between the split halves
    let halfA: { x: number; y: number } | null = null;
    let halfB: { x: number; y: number } | null = null;
    for (const e of run.enemies) {
      if (e.isBoss && e.splitDone && (e.def as BossDef).mechanic === 'split') {
        if (!halfA) halfA = e; else if (!halfB) halfB = e;
      }
    }
    if (halfA && halfB) {
      const ax = px(halfA.x, halfA.y), ay = py(halfA.x, halfA.y);
      const bx = px(halfB.x, halfB.y), by = py(halfB.x, halfB.y);
      b.color('rgb(255, 148, 48)', 0.25);
      b.line(ax, ay, bx, by, 13);
      // marching dashes: 12 on / 8 off, drifting at 70 px/s
      const len = Math.hypot(bx - ax, by - ay);
      if (len > 1) {
        const ux = (bx - ax) / len, uy = (by - ay) / len;
        b.color('rgb(255, 148, 48)', 0.9);
        let d = -((this.t * 70) % 20);
        for (; d < len; d += 20) {
          const d0 = Math.max(0, d), d1 = Math.min(len, d + 12);
          if (d1 > d0) b.line(ax + ux * d0, ay + uy * d0, ax + ux * d1, ay + uy * d1, 2.5);
        }
      }
    }

    // infinite-loop rewind marker: you will be yanked back to this spot
    if (this.rewindMark) {
      const m = this.rewindMark;
      const sx = px(m.x, m.y), sy = py(m.x, m.y);
      const pulse = 1 + 0.12 * Math.sin(this.t * 9);
      const left = 1 - m.t / m.dur; // fraction of the countdown remaining
      b.color('rgb(196, 91, 255)', 0.9);
      b.ring(sx, sy, 26 * pulse, 13 * pulse, 2);
      b.color('rgb(196, 91, 255)', 0.3);
      b.ellipse(sx, sy, 26 * left, 13 * left);
      this.worldTexts.push({ text: '⟲', x: sx, y: sy - 16, font: 'bold 15px monospace', color: '#c45bff', baseline: 'middle' });
    }

    // xp gems + pickups (on the ground, under entities)
    b.alpha(1);
    for (const p of run.pickups) {
      const sx = px(p.x, p.y), sy = py(p.x, p.y);
      let sprite: HTMLCanvasElement;
      if (p.kind === 'xp') sprite = gemSprite(p.value >= 20 ? 2 : p.value >= 5 ? 1 : 0);
      else if (p.kind === 'hp') sprite = coffeeSprite();
      else sprite = chestSprite();
      const bob = Math.sin(performance.now() / 300 + p.x) * 3;
      this.spr(sprite, sx - sprite.width / 4, sy - sprite.height / 4 + bob - 6);
    }

    // depth-sorted billboards (pooled entries — the old path allocated ~400
    // closures per frame here, a steady GC hitch source)
    const buf = this.sortBuf;
    let n = 0;
    const entry = (depth: number, kind: number, obj: unknown) => {
      if (n >= buf.length) buf.push({ depth: 0, kind: 0, obj: null });
      const s = buf[n++];
      s.depth = depth; s.kind = kind; s.obj = obj;
    };
    for (const e of run.enemies) entry(e.x + e.y, K_ENEMY, e);
    for (const a of run.allies) entry(a.x + a.y, K_ALLY, a);
    for (const pet of petPositions(run)) entry(pet.x + pet.y, K_PET, pet);
    if (run.mushi) entry(run.mushi.x + run.mushi.y, K_MUSHI, run.mushi);
    entry(run.px + run.py, K_PLAYER, null);

    const view = buf.slice(0, n); // sort() needs an exact-length window
    view.sort((a, c) => a.depth - c.depth);
    for (const s of view) {
      switch (s.kind) {
        case K_ENEMY: this.drawEnemy(run, s.obj as Run['enemies'][number], ox, oy); break;
        case K_ALLY: {
          const a = s.obj as Run['allies'][number];
          const sx = px(a.x, a.y), sy = py(a.x, a.y);
          b.color('#000', 0.3);
          b.ellipse(sx, sy, 12, 6);
          b.alpha(1);
          const sprite = a.kind === 'turret' ? turretSprite() : helperSprite();
          this.spr(sprite, sx - sprite.width / 4, sy - sprite.height / 2);
          break;
        }
        case K_PET: {
          const pet = s.obj as ReturnType<typeof petPositions>[number];
          const sx = px(pet.x, pet.y), sy = py(pet.x, pet.y);
          const bob = Math.sin(performance.now() / 250 + pet.x) * 3;
          b.color(pet.color, 0.4);
          b.ellipse(sx, sy - 18 + bob, 15, 15, 1); // baked-glow stand-in
          b.color(pet.color);
          b.diamond(sx, sy - 18 + bob, 8, 8);
          break;
        }
        case K_MUSHI: {
          const m = s.obj as NonNullable<Run['mushi']>;
          const def = ENEMIES.mushi;
          const sx = px(m.x, m.y), sy = py(m.x, m.y);
          b.color('#000', 0.3);
          b.ellipse(sx, sy, def.radius, def.radius / 2);
          const sprite = bugSprite(def.shape, def.radius, def.color, false);
          // fading in the last few seconds before it evaporates
          const a = m.t < 5 ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.t * 9)) : 1;
          b.alpha(a);
          const bob = Math.sin(this.t * 6 + m.x) * 1.5;
          this.spr(sprite, sx - sprite.width / 4, sy - sprite.height / 2 + def.radius / 2 + bob);
          b.alpha(1);
          // ambient bubble trail
          if (Math.random() < 0.25) {
            this.spawnParticle({
              x: m.x + rand(-6, 6), y: m.y + rand(-6, 6), z: 6,
              vx: rand(-8, 8), vy: rand(-8, 8), vz: rand(25, 55),
              life: rand(0.4, 0.8), maxLife: 0.8, color: '#cfeee8', size: rand(1, 2.5),
            });
          }
          break;
        }
        case K_PLAYER: this.drawPlayer(run, ox, oy); break;
      }
    }

    // orbit blades (over entities)
    for (const bl of bladePositions(run)) {
      const sx = px(bl.x, bl.y), sy = py(bl.x, bl.y);
      // canvas path was top −r, sides ±0.5r, bottom +0.6r around y−8
      const cy = sy - 8 - bl.r * 0.2;
      b.color(bl.color, 0.4);
      b.ellipse(sx, cy, bl.r * 0.9, bl.r * 0.9, 1);
      b.color(bl.color);
      b.diamond(sx, cy, bl.r * 0.5, bl.r * 0.8);
    }

    // projectiles
    for (const p of run.projectiles) {
      const sx = px(p.x, p.y), sy = py(p.x, p.y);
      if (p.kind === 'bomb' && p.bomb) {
        // lobbed: hop along a sine arc over the flight, shadow on the ground
        const frac = clamp(1 - p.life / p.bomb.maxLife, 0, 1);
        const hop = Math.sin(Math.PI * frac) * (26 + p.bomb.maxLife * 40);
        b.color('#000', 0.25);
        b.ellipse(sx, sy, 6, 3);
        b.color('rgb(26, 29, 36)');
        b.ellipse(sx, sy - 10 - hop, 7, 7);
        b.color(p.color, 0.9);
        b.ring(sx, sy - 10 - hop, 7, 7, 1.5);
        // fuse spark
        b.color('rgb(255, 230, 170)', 0.7 + 0.3 * Math.sin(this.t * 30));
        b.ellipse(sx + 4, sy - 19 - hop, 2, 2);
      } else if (p.kind === 'arrow') {
        const ang = Math.atan2((p.vx + p.vy) / 2, p.vx - p.vy); // screen-space angle
        const c = this.arrowSprite(p.color);
        b.alpha(1);
        this.batch.rotSprite(this.reg(c), sx, sy - 10, c.width / 2, c.height / 2, ang);
      } else {
        const r = p.kind === 'petbolt' ? 4 : 6;
        b.color(p.color, 0.45);
        b.ellipse(sx, sy - 10, r + 8, r + 8, 1); // glow underlay (was shadowBlur 8)
        b.color(p.color);
        b.ellipse(sx, sy - 10, r, r);
      }
    }

    // enemy shots
    for (const sh of run.enemyShots) {
      const sx = px(sh.x, sh.y), sy = py(sh.x, sh.y) - 8;
      b.color(sh.color, 0.45);
      b.ellipse(sx, sy, sh.radius * 1.6, sh.radius * 1.6, 1);
      b.color(sh.color);
      b.ellipse(sx, sy, sh.radius * 0.8, sh.radius * 0.8);
      b.color('#fff', 0.7);
      b.ellipse(sx, sy, sh.radius * 0.35, sh.radius * 0.35);
    }
  }

  private drawEnemy(run: Run, e: Run['enemies'][number], ox: number, oy: number): void {
    const b = this.batch;
    const sx = e.x - e.y + ox;
    const sy = (e.x + e.y) / 2 + oy;

    // shadow
    b.color('#000', 0.35);
    b.ellipse(sx, sy, e.def.radius * (e.elite ? 1.4 : 1), e.def.radius / 2);

    // race-condition afterimages are non-boss entities wearing the boss sprite
    const sprite = e.isBoss || e.raceImage
      ? bossSprite(e.def.id, e.def.radius, (e.def as BossDef).color)
      : bugSprite((e.def as EnemyDef).shape, e.def.radius, (e.def as EnemyDef).color, e.elite);
    const w = sprite.width / 2, h = sprite.height / 2;

    // centipede body segments behind the head
    if (!e.isBoss && (e.def as EnemyDef).shape === 'centipede') {
      for (let i = 1; i <= 3; i++) {
        const bx = e.x - Math.cos(e.facing) * i * e.def.radius * 1.3;
        const by = e.y - Math.sin(e.facing) * i * e.def.radius * 1.3;
        const rr = e.def.radius * (1 - i * 0.12);
        b.color((e.def as EnemyDef).color, 0.85 - i * 0.15);
        b.ellipse(bx - by + ox, (bx + by) / 2 + oy - 8, rr, rr);
      }
    }

    // crunch-time critical severity: thin pulsing red ring on every bug
    if (e.critical) {
      b.color('rgb(255, 70, 70)', 0.5 + 0.25 * Math.sin(this.t * 8));
      const cr = e.def.radius * 1.35;
      b.ring(sx, sy, cr, cr / 2, 2);
    }
    // force-push enrage: pulsing red threat ring under the sprite
    if (e.enraged) {
      b.color('rgb(255, 94, 94)', 0.85);
      const pr2 = e.def.radius * (1.5 + 0.12 * Math.sin(this.t * 10));
      b.ring(sx, sy, pr2, pr2 / 2, 4);
    }
    // resistant right now (monolith armor, stack-overflow frames):
    // rotating dashed shield ring so the state is unmistakable
    if (e.isBoss && (e.armorMult ?? 1) < 1) {
      const sr = e.def.radius * 1.75;
      const dashes = Math.max(6, Math.round((Math.PI * sr * 1.5) / 18)); // ≈ the old [11,7] dash
      b.color('rgb(157, 178, 199)', 0.9);
      b.ring(sx, sy, sr, sr / 2, 3, dashes, this.t * 2.5);
    }

    // status fx — same precedence as the old ctx.filter chain
    let whiten = 0, desat = 0, bright = 1;
    if (e.hitFlash > 0) whiten = 0.85;
    if (e.frozenT > 0) { whiten = 0; desat = 0.85; bright = 1.35; }
    if (e.isBoss && (e.armorMult ?? 1) < 1) {
      whiten = 0;
      if (e.armorMult! <= 0.25) { desat = 0.7; bright = 0.8; } else { desat = 0.45; bright = 0.9; }
    }
    if (e.enraged && e.hitFlash <= 0) { desat = -0.5; bright = 1.3; }
    if (e.critical && e.hitFlash <= 0 && e.frozenT <= 0) { desat = -0.6; bright = 1.2; }
    if (e.raceImage) {
      // ghostly, desaturated, and visibly burning down: flickers as the fuse runs out
      desat = 0.6;
      bright = 1.1 + 0.15 * Math.sin(this.t * (e.copyT < 1.2 ? 24 : 8));
    }
    b.alpha(e.isCopy || e.raceImage ? 0.55 : 1);
    b.sprite(this.reg(sprite), sx, sy - h / 2 + e.def.radius / 2, w, h, whiten, desat, bright);
    b.alpha(1);

    // boss / elite hp bar above
    if (e.isBoss || e.elite) {
      const bw = e.def.radius * 2.2;
      b.color('#000', 0.6);
      b.rect(sx - bw / 2, sy - h - 4, bw, 5);
      b.color(e.isBoss ? '#ff5e5e' : '#ffc12e');
      b.rect(sx - bw / 2, sy - h - 4, bw * clamp(e.hp / e.maxHp, 0, 1), 5);
      // stack overflow / production incident: one pip per live stack frame guarding it
      if (e.isBoss && ((e.def as BossDef).mechanic === 'summon' || (e.def as BossDef).mechanic === 'incident') && (e.addsAlive ?? 0) > 0) {
        b.color('#9db2c7');
        const np = Math.min(12, e.addsAlive!);
        for (let i = 0; i < np; i++) {
          b.rect(sx - bw / 2 + i * 9, sy - h - 13, 6, 6);
        }
      }
      // force-push enrage callout
      if (e.enraged) {
        this.worldTexts.push({ text: '!!', x: sx, y: sy - h - 8, font: 'bold 14px monospace', color: '#ff5e5e', baseline: 'bottom' });
      }
    }
  }

  private drawPlayer(run: Run, ox: number, oy: number): void {
    const b = this.batch;
    const sx = run.px - run.py + ox;
    const sy = (run.px + run.py) / 2 + oy;
    b.color('#000', 0.4);
    b.ellipse(sx, sy, 14, 7);

    const sprite = playerSprite(run.character.color);
    const w = sprite.width / 2, h = sprite.height / 2;
    const cy = sy - h / 2 - 6; // sprite box center (drawImage top was sy − h − 6)
    let whiten = 0, bright = 1;
    if (run.hurtFlash > 0.1) {
      // stand-in for the old brightness/sepia/hue-rotate red tint
      b.color('#ff9d8a');
      whiten = 0.35; bright = 1.45;
    } else if (this.healGlow > 0.05) {
      // green restore glow (was shadowBlur 18)
      b.color('#41d97f', 0.4 * (this.healGlow / 0.35));
      b.ellipse(sx, cy, w * 0.8, h * 0.6, 1);
      b.color('#b8ffc9');
      whiten = 0.2; bright = 1.25;
    } else {
      b.alpha(1);
    }
    const flip = run.faceX - run.faceY < 0; // facing screen-left
    b.sprite(this.reg(sprite), sx, cy, w, h, whiten, 0, bright, flip);
    b.alpha(1);

    if (this.playerHpBarEnabled) {
      const bw = 34;
      const by = sy - h - 14;
      const frac = clamp(run.hp / run.stats.maxHp, 0, 1);
      b.color('#000', 0.6);
      b.rect(sx - bw / 2, by, bw, 5);
      b.color(frac > 0.35 ? '#41d97f' : '#ff5e5e');
      b.rect(sx - bw / 2, by, bw * frac, 5);
      // shield strip above the HP bar (only when the build has shield)
      if (run.stats.shieldMax > 0) {
        b.color('#000', 0.6);
        b.rect(sx - bw / 2, by - 5, bw, 3);
        b.color('#5fd7ff');
        b.rect(sx - bw / 2, by - 5, bw * clamp(run.shield / run.stats.shieldMax, 0, 1), 3);
      }
    }
  }

  // ---------- effects + particles ----------

  private drawEffects(ox: number, oy: number): void {
    const b = this.batch;
    const px = (wx: number, wy: number) => wx - wy + ox;
    const py = (wx: number, wy: number) => (wx + wy) / 2 + oy;

    for (const r of this.rings) {
      const t = r.t / r.dur;
      b.color(r.color, 1 - t);
      b.ring(px(r.x, r.y), py(r.x, r.y), Math.max(1, r.radius * t), Math.max(0.5, (r.radius * t) / 2), 5 * (1 - t) + 1);
    }
    for (const a of this.arcs) {
      const t = a.t / a.dur;
      b.color(a.color, 0.35 * (1 - t));
      const sx = px(a.x, a.y), sy = py(a.x, a.y);
      if (a.full) {
        b.ellipse(sx, sy, a.radius, a.radius / 2);
      } else {
        // convert world angle to the screen-space parametric angle
        const screenAng = Math.atan2(Math.sin(a.angle) + Math.cos(a.angle), 2 * (Math.cos(a.angle) - Math.sin(a.angle)));
        b.sector(sx, sy, a.radius, a.radius / 2, screenAng - 1.0, screenAng + 1.0);
      }
    }
    for (const bm of this.beams) {
      const t = bm.t / bm.dur;
      const width = 3.5 * (1 - t) + 0.5;
      let prevX = px(bm.points[0].x, bm.points[0].y);
      let prevY = py(bm.points[0].x, bm.points[0].y) - 10;
      for (let i = 1; i < bm.points.length; i++) {
        const nx = px(bm.points[i].x, bm.points[i].y);
        const ny = py(bm.points[i].x, bm.points[i].y) - 10;
        // jagged middle point for lightning feel
        const mx = (prevX + nx) / 2 + rand(-8, 8);
        const my = (prevY + ny) / 2 + rand(-8, 8);
        b.color(bm.color, (1 - t) * 0.35);
        b.line(prevX, prevY, mx, my, width + 7); // glow underlay (was shadowBlur 12)
        b.line(mx, my, nx, ny, width + 7);
        b.color(bm.color, 1 - t);
        b.line(prevX, prevY, mx, my, width);
        b.line(mx, my, nx, ny, width);
        prevX = nx; prevY = ny;
      }
    }
    for (const c of this.columns) {
      const t = c.t / c.dur;
      const height = 140 * (t < 0.3 ? t / 0.3 : 1);
      const sx = px(c.x, c.y), sy = py(c.x, c.y);
      b.color(c.color, 0.25 * (1 - t));
      b.rect(sx - c.radius * 0.35 - 8, sy - height - 8, c.radius * 0.7 + 16, height + 16); // glow halo
      b.color(c.color, 0.8 * (1 - t));
      b.rect(sx - c.radius * 0.35, sy - height, c.radius * 0.7, height);
      b.color(c.color, 0.3 * (1 - t));
      b.ellipse(sx, sy, c.radius, c.radius / 2);
    }
  }

  private drawParticles(ox: number, oy: number): void {
    const b = this.batch;
    for (const p of this.particles) {
      b.color(p.color, clamp(p.life / p.maxLife, 0, 1));
      const sx = p.x - p.y + ox;
      const sy = (p.x + p.y) / 2 + oy - p.z;
      b.rect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    }
  }

  /** Overheating floor vent: dark grate when idle, orange glow ramping through
   *  the warning telegraph, white-hot flicker + rising embers while erupting. */
  private drawVent(z: GroundZone, sx: number, sy: number): void {
    const b = this.batch;
    const { phase, p } = ventPhase(z);
    // grate base — always visible so the hazard layout is learnable
    b.color('rgb(14, 10, 11)', 0.55);
    b.ellipse(sx, sy, z.radius, z.radius / 2);
    b.color('rgb(120, 90, 80)', 0.4);
    b.ring(sx, sy, z.radius, z.radius / 2, 1.5);
    // slats
    b.color('rgb(120, 90, 80)', 0.25);
    for (let i = -2; i <= 2; i++) {
      const r = z.radius * (1 - Math.abs(i) * 0.18) * 0.85;
      b.line(sx - r, sy + i * z.radius / 9, sx + r, sy + i * z.radius / 9, 1);
    }
    if (phase === 'warn') {
      b.color('rgb(255, 116, 56)', 0.08 + 0.3 * p);
      b.ellipse(sx, sy, z.radius * (0.5 + 0.5 * p), z.radius * (0.5 + 0.5 * p) / 2);
    } else if (phase === 'erupt') {
      const flicker = 0.85 + 0.15 * Math.sin(this.t * 31 + z.x);
      b.color('rgb(255, 130, 50)', 0.5 * flicker);
      b.ellipse(sx, sy, z.radius, z.radius / 2);
      b.color('rgb(255, 230, 170)', 0.45 * flicker);
      b.ellipse(sx, sy, z.radius * 0.55, z.radius * 0.28);
      if (Math.random() < 0.35) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * z.radius * 0.8;
        this.spawnParticle({
          x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d, z: 4,
          vx: rand(-25, 25), vy: rand(-25, 25), vz: rand(140, 320),
          life: rand(0.35, 0.7), maxLife: 0.7,
          color: Math.random() < 0.4 ? '#ffe6aa' : '#ff8232',
          size: rand(2, 4),
        });
      }
    }
  }

  /** Latency field: pale ice sheet with embedded crystal shards and a ping
   *  ring that expands in stutter-steps — lag made visible. Boundary stays
   *  crisp so the player can read exactly where the slow starts. */
  private drawLatency(z: GroundZone, sx: number, sy: number): void {
    const b = this.batch;
    b.color('rgb(110, 200, 255)', 0.10);
    b.ellipse(sx, sy, z.radius, z.radius / 2);
    b.color('rgb(150, 225, 255)', 0.18);
    b.ellipse(sx, sy, z.radius * 0.6, z.radius * 0.3);
    b.color('rgb(150, 225, 255)', 0.45);
    b.ring(sx, sy, z.radius, z.radius / 2, 1.5);
    // ice crystals — deterministic per field (position-seeded), so they don't shimmer
    for (let i = 0; i < 4; i++) {
      const seed = Math.sin(z.x * 12.9898 + z.y * 78.233 + i * 37.719) * 43758.5453;
      const fr = seed - Math.floor(seed);
      const a = fr * Math.PI * 2;
      const d = (0.25 + 0.55 * ((fr * 7919) % 1)) * z.radius;
      const cs = 3 + ((fr * 104729) % 1) * 4;
      b.color('rgb(190, 235, 255)', 0.35);
      b.diamond(sx + Math.cos(a) * d, sy + Math.sin(a) * d * 0.5, cs, cs * 1.6);
    }
    // ping ring: progress quantized to 8 steps — it visibly stutters outward
    const t = ((this.t * 0.35 + z.x * 0.013 + z.y * 0.007) % 1 + 1) % 1;
    const q = Math.floor(t * 8) / 8;
    b.color('rgb(160, 230, 255)', 0.3 * (1 - q));
    b.ring(sx, sy, z.radius * (0.15 + 0.85 * q), z.radius * (0.15 + 0.85 * q) / 2, 1.2);
  }

  /** Arrow projectile baked per color (glow included), pointing +x. */
  private arrowSprite(color: string): HTMLCanvasElement {
    let c = this.arrowCache.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = 88; c.height = 48; // 2× for crispness, like sprites.ts
    const ctx = c.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.translate(22, 12);
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.fillRect(-10, -2, 20, 4);
    ctx.beginPath(); ctx.moveTo(10, -5); ctx.lineTo(16, 0); ctx.lineTo(10, 5); ctx.fill();
    this.arrowCache.set(color, c);
    return c;
  }
}
