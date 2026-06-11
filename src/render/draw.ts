import type { Run, RunEvent } from '../game/run';
import type { BossDef, EnemyDef, MapDef } from '../data/types';
import { bladePositions, petPositions } from '../game/combat';
import { hash2, clamp, formatTime, lerp, rand } from '../core/util';
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
  w = 0; h = 0; dpr = 1;
  camX = 0; camY = 0;
  t = 0; // render clock for HUD pulses
  shakeMag = 0;
  shakeEnabled = true;
  playerHpBarEnabled = true;
  flash = 0; // screen flash on level up
  healGlow = 0; // green player glow while HP restores

  particles: Particle[] = [];
  damageNums: DamageNum[] = [];
  rings: Ring[] = [];
  arcs: Arc[] = [];
  beams: Beam[] = [];
  columns: Column[] = [];
  banners: { text: string; sub: string; t: number; dur: number; color: string }[] = [];

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
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

  // ---------- event → visuals ----------

  handleEvent(ev: RunEvent): void {
    switch (ev.type) {
      case 'kill': {
        const n = ev.big ? 18 : 7;
        for (let i = 0; i < n; i++) {
          this.particles.push({
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
          this.particles.push({
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
      case 'bossDie':
        this.banner('BUG RESOLVED', `${ev.name} — closed as fixed`, '#41d97f', 3);
        this.shake(10);
        for (let i = 0; i < 40; i++) {
          this.particles.push({
            x: ev.x, y: ev.y, z: 14,
            vx: rand(-260, 260), vy: rand(-260, 260), vz: rand(80, 320),
            life: rand(0.5, 1.1), maxLife: 1.1,
            color: Math.random() < 0.5 ? '#ffc12e' : '#7df9ff', size: rand(3, 7),
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

    const shX = this.shakeMag > 0.2 ? rand(-this.shakeMag, this.shakeMag) : 0;
    const shY = this.shakeMag > 0.2 ? rand(-this.shakeMag, this.shakeMag) : 0;
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
    }
    this.drawBanners();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(125, 249, 255, ${this.flash * 0.35})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (run && run.hurtFlash > 0) {
      ctx.fillStyle = `rgba(255, 60, 60, ${run.hurtFlash * 0.6})`;
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

          ctx.save();
          if (e.hitFlash > 0) ctx.filter = 'brightness(2.2)';
          if (e.frozenT > 0) ctx.filter = 'saturate(0.2) brightness(1.4)';
          if (e.isBoss && e.phase === 'armored' && (e.def as BossDef).mechanic === 'phase') {
            ctx.filter = 'saturate(0.3) brightness(0.8)';
          }
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

    // next boss countdown (top-right, under bits)
    const tToBoss = run.nextBossAt - run.time;
    if (tToBoss < 99999) {
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

  private drawBanners(): void {
    const ctx = this.ctx;
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
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}
