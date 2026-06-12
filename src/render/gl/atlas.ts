// Texture atlas for the procedurally-baked sprites. sprites.ts keeps baking
// to offscreen canvases exactly as before; the first time a canvas is drawn
// through the GL path it gets shelf-packed into one 2048² texture and looked
// up by canvas identity (WeakMap) from then on — no per-frame key strings.

export interface Region { u0: number; v0: number; u1: number; v1: number; w: number; h: number; }

const SIZE = 2048;
const PAD = 2; // gutter against linear-filter bleed

export class Atlas {
  private gl: WebGL2RenderingContext;
  tex: WebGLTexture;
  private byCanvas = new WeakMap<HTMLCanvasElement, Region>();
  private shelfX = PAD;
  private shelfY = PAD;
  private shelfH = 0;
  private full = false;
  /** 1×1 opaque white — the "no texture" UV for SDF/solid quads. */
  white: Region;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SIZE, SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const c = document.createElement('canvas');
    c.width = 4; c.height = 4;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 4, 4);
    const r = this.pack(c)!;
    // sample dead center of the white patch so filtering can't catch a border
    const mu = (r.u0 + r.u1) / 2, mv = (r.v0 + r.v1) / 2;
    this.white = { u0: mu, v0: mv, u1: mu, v1: mv, w: 4, h: 4 };
  }

  /** Atlas region for a baked sprite canvas (packs + uploads on first sight). */
  region(c: HTMLCanvasElement): Region {
    let r = this.byCanvas.get(c);
    if (!r) {
      r = this.pack(c) ?? this.white; // overflow: degrade visibly, don't crash
      this.byCanvas.set(c, r);
    }
    return r;
  }

  private pack(c: HTMLCanvasElement): Region | null {
    const w = c.width, h = c.height;
    if (this.shelfX + w + PAD > SIZE) {
      this.shelfX = PAD;
      this.shelfY += this.shelfH + PAD;
      this.shelfH = 0;
    }
    if (this.shelfY + h + PAD > SIZE || w + PAD * 2 > SIZE) {
      if (!this.full) {
        this.full = true;
        console.warn('sprite atlas full — new sprites render as white quads');
      }
      return null;
    }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, this.shelfX, this.shelfY, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    const r: Region = {
      u0: this.shelfX / SIZE, v0: this.shelfY / SIZE,
      u1: (this.shelfX + w) / SIZE, v1: (this.shelfY + h) / SIZE,
      w, h,
    };
    this.shelfX += w + PAD;
    this.shelfH = Math.max(this.shelfH, h);
    return r;
  }
}
