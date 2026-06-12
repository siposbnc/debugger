// Procedural sprite baking: every entity type is drawn once into an offscreen
// canvas and reused, keeping hundreds of enemies cheap to render.

const cache = new Map<string, HTMLCanvasElement>();

function bake(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2; // 2x for crispness
  const ctx = c.getContext('2d')!;
  ctx.scale(2, 2);
  ctx.translate(w / 2, h / 2);
  draw(ctx);
  cache.set(key, c);
  return c;
}

function withGlow(ctx: CanvasRenderingContext2D, color: string, blur: number, fn: () => void): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  fn();
  ctx.restore();
}

function eyes(ctx: CanvasRenderingContext2D, x: number, y: number, gap: number, r: number, color = '#ffffff'): void {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x - gap, y, r, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x + gap, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#10131a';
  ctx.beginPath(); ctx.arc(x - gap, y + r * 0.2, r * 0.45, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x + gap, y + r * 0.2, r * 0.45, 0, 7); ctx.fill();
}

function legs(ctx: CanvasRenderingContext2D, color: string, r: number, pairs: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.lineCap = 'round';
  for (let i = 0; i < pairs; i++) {
    const yy = -r * 0.3 + (i * r * 0.8) / Math.max(1, pairs - 1);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.7, yy);
      ctx.lineTo(side * r * 1.25, yy + r * 0.35);
      ctx.stroke();
    }
  }
}

type BugDrawer = (ctx: CanvasRenderingContext2D, r: number, color: string, elite: boolean) => void;

const BUG_DRAWERS: Record<string, BugDrawer> = {
  tracer: (ctx, r, color) => {
    // long-lensed observer: slim body, big scope eye, antenna dish
    legs(ctx, color, r * 0.9, 2);
    withGlow(ctx, color, 6, () => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(0, r * 0.15, r * 0.7, r * 0.9, 0, 0, 7); ctx.fill();
    });
    // dish antenna
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.12;
    ctx.beginPath(); ctx.moveTo(0, -r * 0.6); ctx.lineTo(0, -r * 1.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -r * 1.35, r * 0.3, 0.3, Math.PI - 0.3, true); ctx.stroke();
    // single big scope lens
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a1d24';
    ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.18, 0, 7); ctx.fill();
    // crosshair ticks on the lens
    ctx.strokeStyle = 'rgba(26,29,36,0.7)';
    ctx.lineWidth = r * 0.07;
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, -r * 0.05); ctx.lineTo(-r * 0.55, -r * 0.05);
    ctx.moveTo(r * 0.4, -r * 0.05); ctx.lineTo(r * 0.55, -r * 0.05);
    ctx.stroke();
  },
  crab: (ctx, r, color) => {
    // wide shell with a bright frontal plate (the checksum) + claws
    legs(ctx, color, r, 3);
    withGlow(ctx, color, 6, () => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.1, r * 0.8, 0, 0, 7); ctx.fill();
    });
    // frontal validation plate (lighter, ridged)
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(0, -r * 0.35, r * 0.95, r * 0.35, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = r * 0.08;
    for (const sx of [-0.5, 0, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(sx * r, -r * 0.6); ctx.lineTo(sx * r, -r * 0.2);
      ctx.stroke();
    }
    // claws
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(-r * 1.15, -r * 0.35, r * 0.32, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 1.15, -r * 0.35, r * 0.32, 0, 7); ctx.fill();
    eyes(ctx, 0, r * 0.15, r * 0.3, r * 0.2);
  },
  mite: (ctx, r, color) => {
    legs(ctx, color, r, 3);
    withGlow(ctx, color, 6, () => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.85, 0, 0, 7); ctx.fill();
    });
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, -r * 0.3, r * 0.7, r * 0.4, 0, 0, 7); ctx.fill();
    eyes(ctx, 0, r * 0.1, r * 0.35, r * 0.22);
  },
  tick: (ctx, r, color) => {
    legs(ctx, color, r, 2);
    withGlow(ctx, color, 5, () => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    });
    eyes(ctx, 0, 0, r * 0.32, r * 0.2);
  },
  wasp: (ctx, r, color) => {
    // wings
    ctx.fillStyle = 'rgba(220,235,255,0.45)';
    ctx.beginPath(); ctx.ellipse(-r * 0.9, -r * 0.6, r * 0.9, r * 0.4, -0.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(r * 0.9, -r * 0.6, r * 0.9, r * 0.4, 0.5, 0, 7); ctx.fill();
    withGlow(ctx, color, 6, () => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.75, r, 0, 0, 7); ctx.fill();
    });
    // stripes
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-r * 0.7, -r * 0.15, r * 1.4, r * 0.22);
    ctx.fillRect(-r * 0.6, r * 0.35, r * 1.2, r * 0.22);
    // stinger
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(-r * 0.18, r * 1.5); ctx.lineTo(r * 0.18, r); ctx.fill();
    eyes(ctx, 0, -r * 0.45, r * 0.3, r * 0.2);
  },
  leech: (ctx, r, color) => {
    withGlow(ctx, color, 8, () => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-r, r * 0.6);
      ctx.quadraticCurveTo(-r, -r * 0.9, 0, -r * 0.9);
      ctx.quadraticCurveTo(r, -r * 0.9, r, r * 0.6);
      ctx.quadraticCurveTo(0, r * 1.1, -r, r * 0.6);
      ctx.fill();
    });
    // drips
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(-r * 0.5, r * 0.9, r * 0.18, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.4, r * 1.0, r * 0.14, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    eyes(ctx, 0, -r * 0.2, r * 0.34, r * 0.24);
  },
  spider: (ctx, r, color) => {
    legs(ctx, color, r * 1.15, 4);
    withGlow(ctx, color, 6, () => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -r * 0.75, r * 0.45, 0, 7); ctx.fill();
    });
    eyes(ctx, 0, -r * 0.75, r * 0.2, r * 0.13);
    // glitch offset ghost
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#7df9ff';
    ctx.beginPath(); ctx.arc(r * 0.25, 0, r * 0.8, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  },
  beetle: (ctx, r, color) => {
    legs(ctx, color, r, 3);
    withGlow(ctx, color, 10, () => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.92, 0, 0, 7); ctx.fill();
    });
    // warning shell line
    ctx.strokeStyle = 'rgba(255,240,160,0.9)';
    ctx.lineWidth = r * 0.12;
    ctx.beginPath(); ctx.moveTo(0, -r * 0.85); ctx.lineTo(0, r * 0.85); ctx.stroke();
    // "!" marking
    ctx.fillStyle = '#fff0a0';
    ctx.font = `bold ${r}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', -r * 0.45, 0);
    ctx.fillText('!', r * 0.45, 0);
    eyes(ctx, 0, -r * 0.55, r * 0.3, r * 0.18);
  },
  scarab: (ctx, r, color) => {
    legs(ctx, color, r, 3);
    withGlow(ctx, color, 8, () => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * 0.85, 0, 0, 7); ctx.fill();
    });
    // lock icon on shell
    ctx.strokeStyle = 'rgba(220,230,255,0.95)';
    ctx.lineWidth = r * 0.12;
    ctx.strokeRect(-r * 0.28, -r * 0.1, r * 0.56, r * 0.45);
    ctx.beginPath(); ctx.arc(0, -r * 0.12, r * 0.2, Math.PI, 0); ctx.stroke();
    eyes(ctx, 0, -r * 0.55, r * 0.28, r * 0.16);
  },
  // The Precipitate: a little Erlenmeyer flask on stubby legs, safety goggles,
  // teal liquid sloshing inside. Glass-white + gold glints — reward, not threat.
  flask: (ctx, r, color) => {
    legs(ctx, '#cfd8dc', r * 0.9, 2);
    // conical glass body with a neck
    withGlow(ctx, color, 7, () => {
      ctx.fillStyle = 'rgba(228, 245, 242, 0.55)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.32, -r * 1.25);
      ctx.lineTo(-r * 0.32, -r * 0.35);
      ctx.lineTo(-r * 1.0, r * 0.85);
      ctx.lineTo(r * 1.0, r * 0.85);
      ctx.lineTo(r * 0.32, -r * 0.35);
      ctx.lineTo(r * 0.32, -r * 1.25);
      ctx.closePath();
      ctx.fill();
    });
    // liquid pooled in the cone
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, r * 0.2);
    ctx.lineTo(-r * 0.95, r * 0.8);
    ctx.lineTo(r * 0.95, r * 0.8);
    ctx.lineTo(r * 0.62, r * 0.2);
    ctx.closePath();
    ctx.fill();
    // rising bubbles
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(-r * 0.2, r * 0.05, r * 0.1, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.15, -r * 0.25, r * 0.08, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -r * 0.6, r * 0.07, 0, 7); ctx.fill();
    // flask lip
    ctx.strokeStyle = 'rgba(228, 245, 242, 0.9)';
    ctx.lineWidth = Math.max(1.2, r * 0.12);
    ctx.beginPath(); ctx.moveTo(-r * 0.42, -r * 1.25); ctx.lineTo(r * 0.42, -r * 1.25); ctx.stroke();
    // oversized gold-rimmed safety goggles on the glass
    ctx.strokeStyle = '#ffc12e';
    ctx.lineWidth = Math.max(1.2, r * 0.13);
    ctx.beginPath(); ctx.arc(-r * 0.34, r * 0.32, r * 0.3, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(r * 0.34, r * 0.32, r * 0.3, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.06, r * 0.32); ctx.lineTo(r * 0.06, r * 0.32); ctx.stroke();
    eyes(ctx, 0, r * 0.32, r * 0.34, r * 0.18);
  },
  // Deprecated Dependency: a squat legacy server-rack pillar propping up the
  // Monolith's armor. Inert and crumbling — caution tape, dead LEDs, one
  // stubborn amber light. No legs, no eyes: it isn't alive, just load-bearing.
  pillar: (ctx, r, color) => {
    const w = r * 1.1, top = -r * 1.6, h = r * 2.4;
    withGlow(ctx, color, 6, () => {
      ctx.fillStyle = color;
      ctx.fillRect(-w / 2, top, w, h);
    });
    // side shading for depth
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(w * 0.15, top, w * 0.35, h);
    // rack slits
    ctx.fillStyle = 'rgba(20,24,32,0.8)';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-w * 0.36, top + h * (0.14 + i * 0.2), w * 0.72, h * 0.07);
    }
    // dead LEDs + one amber survivor
    ctx.fillStyle = 'rgba(120,130,145,0.9)';
    ctx.beginPath(); ctx.arc(-w * 0.22, top + h * 0.08, r * 0.07, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(0, top + h * 0.08, r * 0.07, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffc12e';
    ctx.beginPath(); ctx.arc(w * 0.22, top + h * 0.08, r * 0.07, 0, 7); ctx.fill();
    // crack down the casing
    ctx.strokeStyle = 'rgba(20,24,32,0.9)';
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.moveTo(-w * 0.1, top);
    ctx.lineTo(w * 0.05, top + h * 0.35);
    ctx.lineTo(-w * 0.12, top + h * 0.62);
    ctx.stroke();
    // diagonal caution stripe across the base
    ctx.save();
    ctx.beginPath(); ctx.rect(-w / 2, top + h * 0.72, w, h * 0.2); ctx.clip();
    for (let i = -3; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#1a1d24' : '#ffc12e';
      ctx.save();
      ctx.translate(i * w * 0.3, top + h * 0.82);
      ctx.rotate(-0.6);
      ctx.fillRect(-w * 0.15, -h * 0.2, w * 0.3, h * 0.4);
      ctx.restore();
    }
    ctx.restore();
  },
  centipede: (ctx, r, color) => {
    withGlow(ctx, color, 8, () => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, 7); ctx.fill();
    });
    // mandibles
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.16;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-r * 0.5, r * 0.6, r * 0.4, 0.3, 2.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(r * 0.5, r * 0.6, r * 0.4, Math.PI - 2.2, Math.PI - 0.3); ctx.stroke();
    eyes(ctx, 0, -r * 0.1, r * 0.35, r * 0.22, '#ffd9e8');
  },
};

export function bugSprite(shape: string, radius: number, color: string, elite: boolean): HTMLCanvasElement {
  const r = radius * (elite ? 1.45 : 1);
  const size = Math.ceil(r * 3.4) + 16;
  return bake(`bug:${shape}:${radius}:${color}:${elite}`, size, size, (ctx) => {
    if (elite) {
      withGlow(ctx, '#ffc12e', 16, () => {
        ctx.strokeStyle = '#ffc12e';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, r * 1.45, 0, 7); ctx.stroke();
      });
    }
    (BUG_DRAWERS[shape] ?? BUG_DRAWERS.mite)(ctx, r, color, elite);
  });
}

export function bossSprite(id: string, radius: number, color: string): HTMLCanvasElement {
  const size = Math.ceil(radius * 3.2) + 30;
  return bake(`boss:${id}:${radius}`, size, size, (ctx) => {
    const r = radius;
    withGlow(ctx, color, 22, () => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.32, 0, 7); ctx.stroke();
    });
    switch (id) {
      case 'mergeConflict': {
        legs(ctx, color, r, 3);
        withGlow(ctx, color, 12, () => {
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.ellipse(0, r * 0.15, r, r * 0.8, 0, 0, 7); ctx.fill();
          // two heads
          ctx.beginPath(); ctx.arc(-r * 0.45, -r * 0.7, r * 0.42, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.7, r * 0.42, 0, 7); ctx.fill();
        });
        eyes(ctx, -r * 0.45, -r * 0.7, r * 0.16, r * 0.11);
        eyes(ctx, r * 0.45, -r * 0.7, r * 0.16, r * 0.11);
        ctx.fillStyle = '#1a1d24';
        ctx.font = `bold ${r * 0.42}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('<<<', 0, r * 0.05);
        ctx.fillText('>>>', 0, r * 0.5);
        break;
      }
      case 'memoryLeak': {
        withGlow(ctx, color, 14, () => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(-r, r * 0.5);
          ctx.quadraticCurveTo(-r * 1.1, -r * 0.6, -r * 0.3, -r * 0.85);
          ctx.quadraticCurveTo(0, -r * 1.1, r * 0.4, -r * 0.8);
          ctx.quadraticCurveTo(r * 1.15, -r * 0.4, r, r * 0.5);
          ctx.quadraticCurveTo(0, r * 1.05, -r, r * 0.5);
          ctx.fill();
        });
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(-r * 0.55, r * 0.95, r * 0.18, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.3, r * 1.05, r * 0.22, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
        eyes(ctx, 0, -r * 0.25, r * 0.3, r * 0.18);
        break;
      }
      case 'infiniteLoop': {
        withGlow(ctx, color, 14, () => {
          ctx.strokeStyle = color;
          ctx.lineWidth = r * 0.34;
          ctx.beginPath(); ctx.arc(-r * 0.4, 0, r * 0.5, 0, 7); ctx.stroke();
          ctx.beginPath(); ctx.arc(r * 0.4, 0, r * 0.5, 0, 7); ctx.stroke();
        });
        eyes(ctx, -r * 0.4, 0, r * 0.16, r * 0.12);
        legs(ctx, color, r, 2);
        break;
      }
      case 'stackOverflowBoss': {
        // stacked tower of segments
        for (let i = 0; i < 4; i++) {
          const w = r * (1.15 - i * 0.2);
          const y = r * 0.7 - i * r * 0.48;
          withGlow(ctx, color, 8, () => {
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.ellipse(0, y, w, r * 0.3, 0, 0, 7); ctx.fill();
          });
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath(); ctx.ellipse(0, y - r * 0.08, w * 0.8, r * 0.16, 0, 0, 7); ctx.fill();
        }
        eyes(ctx, 0, -r * 0.78, r * 0.22, r * 0.15);
        break;
      }
      case 'raceCondition': {
        // a body that can't decide where it is: two offset ghost copies + core
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = color;
        for (const ox of [-r * 0.55, r * 0.55]) {
          ctx.beginPath(); ctx.ellipse(ox, 0, r * 0.7, r * 0.55, 0, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
        legs(ctx, color, r, 4);
        withGlow(ctx, color, 12, () => {
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.ellipse(0, 0, r * 0.8, r * 0.65, 0, 0, 7); ctx.fill();
        });
        eyes(ctx, 0, -r * 0.15, r * 0.2, r * 0.14);
        // glitch squares trailing off the body
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(-r * 1.15, -r * 0.5, r * 0.18, r * 0.18);
        ctx.fillRect(r * 0.95, r * 0.3, r * 0.22, r * 0.22);
        ctx.fillRect(-r * 0.9, r * 0.55, r * 0.14, r * 0.14);
        ctx.globalAlpha = 1;
        break;
      }
      case 'criticalException': {
        // jagged warning-burst body with a huge exclamation core
        withGlow(ctx, color, 14, () => {
          ctx.fillStyle = color;
          ctx.beginPath();
          const spikes = 9;
          for (let i = 0; i < spikes * 2; i++) {
            const a = (Math.PI * i) / spikes - Math.PI / 2;
            const rr = i % 2 === 0 ? r * 1.05 : r * 0.62;
            ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
          }
          ctx.closePath(); ctx.fill();
        });
        eyes(ctx, 0, -r * 0.3, r * 0.18, r * 0.13);
        ctx.fillStyle = '#1a1d24';
        ctx.font = `bold ${r * 0.85}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, r * 0.28);
        break;
      }
      case 'productionIncident': {
        // a screaming pager: rounded slab, alarm crown, SEV1 on the screen
        withGlow(ctx, color, 12, () => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(-r * 0.85, -r * 0.7, r * 1.7, r * 1.5, r * 0.2);
          ctx.fill();
        });
        // alarm horns radiating from the top
        ctx.strokeStyle = color;
        ctx.lineWidth = r * 0.1;
        for (const s of [-1, 0, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * r * 0.4, -r * 0.85);
          ctx.lineTo(s * r * 0.6, -r * 1.25);
          ctx.stroke();
        }
        // screen
        ctx.fillStyle = '#1a1d24';
        ctx.fillRect(-r * 0.6, -r * 0.45, r * 1.2, r * 0.55);
        withGlow(ctx, '#ff5e5e', 8, () => {
          ctx.fillStyle = '#ff5e5e';
          ctx.font = `bold ${r * 0.38}px monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('SEV-1', 0, -r * 0.17);
        });
        eyes(ctx, 0, r * 0.45, r * 0.2, r * 0.14);
        break;
      }
      case 'kernelPanic': {
        // a cracked ice slab wearing the BSOD sad face
        withGlow(ctx, color, 14, () => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(-r * 0.9, -r * 0.55);
          ctx.lineTo(-r * 0.35, -r * 1.05);
          ctx.lineTo(r * 0.75, -r * 0.85);
          ctx.lineTo(r * 0.95, r * 0.45);
          ctx.lineTo(r * 0.2, r * 1.0);
          ctx.lineTo(-r * 0.8, r * 0.7);
          ctx.closePath(); ctx.fill();
        });
        // internal fracture lines
        ctx.strokeStyle = 'rgba(16, 24, 40, 0.7)';
        ctx.lineWidth = r * 0.06;
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.6); ctx.lineTo(-r * 0.1, 0); ctx.lineTo(-r * 0.45, r * 0.55);
        ctx.moveTo(r * 0.55, -r * 0.5); ctx.lineTo(r * 0.25, r * 0.1); ctx.lineTo(r * 0.6, r * 0.5);
        ctx.stroke();
        // :( — the universal stop screen
        ctx.fillStyle = '#10182a';
        ctx.font = `bold ${r * 0.62}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.save();
        ctx.rotate(Math.PI / 2);
        ctx.fillText(':(', 0, 0);
        ctx.restore();
        break;
      }
      case 'legacyMonolith': {
        withGlow(ctx, color, 10, () => {
          ctx.fillStyle = color;
          ctx.fillRect(-r * 0.75, -r * 1.1, r * 1.5, r * 2.0);
        });
        // cracks
        ctx.strokeStyle = 'rgba(20,22,28,0.8)';
        ctx.lineWidth = r * 0.07;
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, -r * 1.1); ctx.lineTo(-r * 0.15, -r * 0.3); ctx.lineTo(-r * 0.45, r * 0.4);
        ctx.moveTo(r * 0.5, -r * 0.7); ctx.lineTo(r * 0.2, 0); ctx.lineTo(r * 0.5, r * 0.8);
        ctx.stroke();
        // glowing core eye
        withGlow(ctx, '#ff5e5e', 12, () => {
          ctx.fillStyle = '#ff5e5e';
          ctx.beginPath(); ctx.arc(0, -r * 0.35, r * 0.22, 0, 7); ctx.fill();
        });
        ctx.fillStyle = 'rgba(20,22,28,0.85)';
        ctx.font = `${r * 0.3}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('COBOL', 0, r * 0.45);
        break;
      }
    }
  });
}

export function playerSprite(color: string): HTMLCanvasElement {
  return bake(`player:${color}`, 56, 64, (ctx) => {
    // hover board shadow handled by renderer; draw the dev
    // body (hoodie)
    withGlow(ctx, color, 8, () => {
      ctx.fillStyle = '#2a3140';
      ctx.beginPath();
      ctx.moveTo(-11, 18);
      ctx.quadraticCurveTo(-13, -2, 0, -4);
      ctx.quadraticCurveTo(13, -2, 11, 18);
      ctx.closePath();
      ctx.fill();
    });
    // hoodie accent stripe
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-9, 14); ctx.quadraticCurveTo(0, 18, 9, 14); ctx.stroke();
    // head
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath(); ctx.arc(0, -12, 9, 0, 7); ctx.fill();
    // hair
    ctx.fillStyle = '#3a2e28';
    ctx.beginPath(); ctx.arc(0, -15, 9, Math.PI, 0); ctx.fill();
    // glasses
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(-7.5, -13, 6, 5);
    ctx.strokeRect(1.5, -13, 6, 5);
    ctx.beginPath(); ctx.moveTo(-1.5, -10.5); ctx.lineTo(1.5, -10.5); ctx.stroke();
    // laptop under arm
    ctx.fillStyle = '#454c5c';
    ctx.save();
    ctx.translate(10, 8); ctx.rotate(0.25);
    ctx.fillRect(-3, -6, 7, 12);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(-1.6, -4.5, 4.2, 9);
    ctx.restore();
  });
}

export function gemSprite(tier: 0 | 1 | 2): HTMLCanvasElement {
  const colors = ['#7df9ff', '#41d97f', '#ffc12e'];
  const c = colors[tier];
  const s = 9 + tier * 2;
  return bake(`gem:${tier}`, s * 3, s * 3, (ctx) => {
    withGlow(ctx, c, 8, () => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.7, 0);
      ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, 0);
    ctx.closePath(); ctx.fill();
  });
}

export function coffeeSprite(): HTMLCanvasElement {
  return bake('coffee', 36, 40, (ctx) => {
    withGlow(ctx, '#ff8a8a', 6, () => {
      ctx.fillStyle = '#e8e3d8';
      ctx.fillRect(-8, -6, 16, 16);
    });
    ctx.strokeStyle = '#e8e3d8';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(10, 2, 5, -1.2, 1.2); ctx.stroke();
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(-8, -6, 16, 4);
    // steam
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-3, -9); ctx.quadraticCurveTo(-6, -13, -3, -16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, -9); ctx.quadraticCurveTo(6, -13, 3, -16); ctx.stroke();
    ctx.fillStyle = '#cc3344';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('+', 0, 4);
  });
}

export function chestSprite(): HTMLCanvasElement {
  return bake('chest', 52, 52, (ctx) => {
    withGlow(ctx, '#ffc12e', 14, () => {
      ctx.fillStyle = '#3a3322';
      ctx.fillRect(-14, -8, 28, 18);
      ctx.fillStyle = '#ffc12e';
      ctx.fillRect(-14, -12, 28, 6);
    });
    ctx.fillStyle = '#ffc12e';
    ctx.fillRect(-2.5, -8, 5, 18);
    ctx.fillStyle = '#10131a';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('.zip', 0, 7);
  });
}

export function turretSprite(): HTMLCanvasElement {
  return bake('turret', 40, 48, (ctx) => {
    withGlow(ctx, '#ffb347', 8, () => {
      ctx.fillStyle = '#454c5c';
      ctx.beginPath(); ctx.moveTo(-9, 14); ctx.lineTo(9, 14); ctx.lineTo(5, -2); ctx.lineTo(-5, -2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffb347';
      ctx.beginPath(); ctx.arc(0, -7, 6, 0, 7); ctx.fill();
    });
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(0, -19); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -20, 1.6, 0, 7); ctx.stroke();
  });
}

export function helperSprite(): HTMLCanvasElement {
  return bake('helper', 36, 40, (ctx) => {
    withGlow(ctx, '#9be564', 10, () => {
      ctx.fillStyle = '#9be564';
      ctx.beginPath();
      ctx.moveTo(-8, 8);
      ctx.quadraticCurveTo(-9, -8, 0, -10);
      ctx.quadraticCurveTo(9, -8, 8, 8);
      ctx.quadraticCurveTo(0, 13, -8, 8);
      ctx.fill();
    });
    ctx.fillStyle = '#10131a';
    ctx.beginPath(); ctx.arc(-3, -2, 1.8, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(3, -2, 1.8, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(16,19,26,0.8)';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PR', 0, 7);
  });
}

export function propSprite(kind: 'terminal' | 'shard' | 'nest'): HTMLCanvasElement {
  if (kind === 'terminal') {
    return bake('prop:terminal', 60, 64, (ctx) => {
      ctx.fillStyle = '#23262e';
      ctx.fillRect(-13, -16, 26, 22);
      withGlow(ctx, '#53e8a8', 6, () => {
        ctx.fillStyle = 'rgba(83,232,168,0.25)';
        ctx.fillRect(-10, -13, 20, 16);
      });
      ctx.fillStyle = '#53e8a8';
      ctx.globalAlpha = 0.8;
      ctx.font = '5px monospace';
      ctx.fillText('> err', -9, -7);
      ctx.fillText('> 404', -9, -1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1a1d24';
      ctx.fillRect(-4, 6, 8, 8);
      ctx.fillRect(-10, 14, 20, 3);
    });
  }
  if (kind === 'shard') {
    return bake('prop:shard', 40, 52, (ctx) => {
      withGlow(ctx, '#7df9ff', 10, () => {
        ctx.fillStyle = 'rgba(125,249,255,0.85)';
        ctx.beginPath();
        ctx.moveTo(0, -18); ctx.lineTo(7, -4); ctx.lineTo(3, 16); ctx.lineTo(-5, 12); ctx.lineTo(-6, -6);
        ctx.closePath(); ctx.fill();
      });
      ctx.fillStyle = 'rgba(16,19,26,0.65)';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('{ }', 0, 2);
    });
  }
  return bake('prop:nest', 56, 44, (ctx) => {
    withGlow(ctx, '#c84f4f', 8, () => {
      ctx.fillStyle = '#3a2430';
      ctx.beginPath(); ctx.ellipse(0, 4, 20, 10, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#c84f4f';
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, 7); ctx.fill();
    });
    ctx.fillStyle = '#2a1620';
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 4, 0, 0, 7); ctx.fill();
  });
}
