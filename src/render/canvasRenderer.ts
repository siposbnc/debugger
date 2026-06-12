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

const TILE = 56;

/**
 * Legacy Canvas2D world pass — the automatic fallback when WebGL2 init fails.
 * Frozen: new world visuals land in glRenderer.ts; this only needs to keep
 * compiling (missing flourishes on the fallback path are acceptable).
 */
export class CanvasRenderer extends RendererBase {
  ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement, hudCanvas: HTMLCanvasElement, bannerCanvas: HTMLCanvasElement) {
    super(canvas, hudCanvas, bannerCanvas);
    this.ctx = canvas.getContext('2d')!;
  }

  protected renderWorld(run: Run | null, map: MapDef, ox: number, oy: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // background fog color
    ctx.fillStyle = map.palette.fog;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.translate(ox, oy);
    this.drawFloor(map);
    if (run) this.drawWorld(run);
    this.drawEffects();
    this.drawParticles();
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
      if (z.kind === 'vent') {
        this.drawVent(z, s.x, s.y);
        continue;
      }
      if (z.kind === 'latency') {
        // minimal: the field must be visible/readable; the GL stutter-ring
        // effect stays GL-only (this backend is frozen)
        ctx.fillStyle = 'rgba(110, 200, 255, 0.12)';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, z.radius, z.radius / 2, 0, 0, 7);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150, 225, 255, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        continue;
      }
      const alpha = z.kind === 'marsh' ? 0.3 : 0.4 * clamp(z.life / 2, 0.3, 1);
      ctx.fillStyle = z.kind === 'marsh' ? `rgba(60, 140, 90, ${alpha})` : `rgba(84, 224, 107, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, z.radius, z.radius / 2, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = z.kind === 'marsh' ? 'rgba(90, 190, 120, 0.35)' : 'rgba(120, 255, 150, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // terrain patches (gameplay-relevant: drift sources must be visible;
    // the GL animations stay GL-only — this backend is frozen)
    for (const tp of run.patches) {
      if (tp.kind === 'bus') {
        const a = this.proj(tp.x - tp.ux * tp.halfLen, tp.y - tp.uy * tp.halfLen);
        const c = this.proj(tp.x + tp.ux * tp.halfLen, tp.y + tp.uy * tp.halfLen);
        ctx.strokeStyle = 'rgba(95, 215, 255, 0.3)';
        ctx.lineWidth = tp.halfWidth;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
      } else {
        const s = this.proj(tp.x, tp.y);
        ctx.fillStyle = 'rgba(155, 123, 212, 0.12)';
        ctx.beginPath(); ctx.ellipse(s.x, s.y, tp.radius, tp.radius / 2, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(155, 123, 212, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // terrain blockers (gameplay-critical: collision must be visible; the GL
    // rack sprite stays GL-only — this backend is frozen)
    for (const o of run.obstacles) {
      const s = this.proj(o.x, o.y);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, o.r * 1.15, o.r * 0.58, 0, 0, 7);
      ctx.fill();
      const w = o.r * 1.5, h = o.r * 2.1;
      ctx.fillStyle = '#1f232b';
      ctx.fillRect(s.x - w / 2, s.y - h + o.r * 0.3, w, h);
      ctx.strokeStyle = '#3a4150';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(s.x - w / 2, s.y - h + o.r * 0.3, w, h);
    }

    // firewalls / DMZ rings (gameplay-relevant: minimal line/ring rendering)
    for (const wl of run.walls) {
      const fade = Math.min(1, wl.life / 0.5);
      ctx.strokeStyle = wl.color;
      ctx.globalAlpha = 0.85 * fade;
      ctx.lineWidth = 3;
      if (wl.ring > 0) {
        const s = this.proj(wl.x, wl.y);
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, wl.ring, wl.ring / 2, 0, 0, 7);
        ctx.stroke();
      } else {
        const a = this.proj(wl.x - wl.ux * wl.halfLen, wl.y - wl.uy * wl.halfLen);
        const c = this.proj(wl.x + wl.ux * wl.halfLen, wl.y + wl.uy * wl.halfLen);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // critical-exception slam telegraphs (gameplay-critical: must be visible
    // on this backend too, minimal styling)
    for (const sl of run.slams) {
      const s = this.proj(sl.x, sl.y);
      const p = 1 - clamp(sl.t / sl.maxT, 0, 1);
      ctx.fillStyle = `rgba(255, 77, 77, ${0.12 + 0.18 * p})`;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, sl.radius, sl.radius / 2, 0, 0, 7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 77, 77, 0.85)';
      ctx.lineWidth = 2;
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

          const sprite = e.isBoss || e.raceImage // afterimages wear the boss sprite
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

          // crunch-time critical severity: thin pulsing red ring on every bug
          if (e.critical) {
            ctx.strokeStyle = `rgba(255, 70, 70, ${0.5 + 0.25 * Math.sin(this.t * 8)})`;
            ctx.lineWidth = 2;
            const cr = e.def.radius * 1.35;
            ctx.beginPath(); ctx.ellipse(s.x, s.y, cr, cr / 2, 0, 0, 7); ctx.stroke();
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
          if (e.critical && e.hitFlash <= 0 && e.frozenT <= 0) ctx.filter = 'brightness(1.25) saturate(1.6)';
          if (e.isCopy || e.raceImage) ctx.globalAlpha = 0.55;
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
            if (run.stats.shieldMax > 0) {
              ctx.fillStyle = 'rgba(0,0,0,0.6)';
              ctx.fillRect(s.x - bw / 2, by - 5, bw, 3);
              ctx.fillStyle = '#5fd7ff';
              ctx.fillRect(s.x - bw / 2, by - 5, bw * clamp(run.shield / run.stats.shieldMax, 0, 1), 3);
            }
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

  /** Overheating floor vent: dark grate when idle, orange glow ramping through
   *  the warning telegraph, white-hot flicker + rising embers while erupting. */
  private drawVent(z: GroundZone, sx: number, sy: number): void {
    const ctx = this.ctx;
    const { phase, p } = ventPhase(z);
    // grate base — always visible so the hazard layout is learnable
    ctx.fillStyle = 'rgba(14, 10, 11, 0.55)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, z.radius, z.radius / 2, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 90, 80, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // slats
    ctx.strokeStyle = 'rgba(120, 90, 80, 0.25)';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      const r = z.radius * (1 - Math.abs(i) * 0.18) * 0.85;
      ctx.beginPath();
      ctx.moveTo(sx - r, sy + i * z.radius / 9);
      ctx.lineTo(sx + r, sy + i * z.radius / 9);
      ctx.stroke();
    }
    if (phase === 'warn') {
      ctx.fillStyle = `rgba(255, 116, 56, ${0.08 + 0.3 * p})`;
      ctx.beginPath();
      ctx.ellipse(sx, sy, z.radius * (0.5 + 0.5 * p), z.radius * (0.5 + 0.5 * p) / 2, 0, 0, 7);
      ctx.fill();
    } else if (phase === 'erupt') {
      const flicker = 0.85 + 0.15 * Math.sin(this.t * 31 + z.x);
      ctx.fillStyle = `rgba(255, 130, 50, ${0.5 * flicker})`;
      ctx.beginPath();
      ctx.ellipse(sx, sy, z.radius, z.radius / 2, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 230, 170, ${0.45 * flicker})`;
      ctx.beginPath();
      ctx.ellipse(sx, sy, z.radius * 0.55, z.radius * 0.28, 0, 0, 7);
      ctx.fill();
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
}
