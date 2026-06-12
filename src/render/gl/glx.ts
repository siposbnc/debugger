// Hand-rolled WebGL2 quad batcher — the whole world pass is one interleaved
// dynamic buffer drawn in a single drawElements call (flushed mid-frame only
// if the 16k-quad capacity overflows). Zero dependencies.
//
// One shader covers everything via a per-quad mode:
//   0 textured sprite (atlas)   3 arc sector fill
//   1 ellipse fill (soft edge)  4 diamond fill
//   2 ring stroke (dashable)    5 solid quad
// Textured quads additionally get fx = (whiten, desat, brighten) — the GPU
// replacement for the old per-draw ctx.filter, which forced an intermediate
// surface per enemy per frame.

const VS = `#version 300 es
layout(location=0) in vec2 aPos;
layout(location=1) in vec2 aLocal;
layout(location=2) in vec2 aUV;
layout(location=3) in vec4 aColor;
layout(location=4) in vec4 aFx;
layout(location=5) in vec4 aParam;
uniform vec2 uRes;
out vec2 vLocal;
out vec2 vUV;
out vec4 vColor;
flat out vec4 vFx;
flat out vec4 vParam;
void main() {
  gl_Position = vec4(aPos.x / uRes.x * 2.0 - 1.0, 1.0 - aPos.y / uRes.y * 2.0, 0.0, 1.0);
  vLocal = aLocal;
  vUV = aUV;
  vColor = aColor;
  vFx = aFx;
  vParam = aParam;
}`;

const FS = `#version 300 es
precision mediump float;
uniform sampler2D uTex;
in vec2 vLocal;
in vec2 vUV;
in vec4 vColor;
flat in vec4 vFx;
flat in vec4 vParam;
out vec4 outColor;
const float TAU = 6.28318530718;
void main() {
  float mode = vFx.w;
  vec4 col;
  if (mode < 0.5) {
    // textured sprite (premultiplied atlas) with whiten/desat/brighten fx —
    // all three are linear in alpha, so operating on premultiplied rgb is fine
    vec4 t = texture(uTex, vUV);
    vec3 rgb = mix(t.rgb, vec3(t.a), vFx.x);
    float g = dot(rgb, vec3(0.299, 0.587, 0.114));
    rgb = mix(vec3(g), rgb, 1.0 - vFx.y); // vFx.y < 0 extrapolates: saturation boost
    rgb *= vFx.z;
    col = vec4(rgb, t.a);
  } else if (mode > 4.5) {
    col = vec4(1.0); // solid
  } else {
    float d = mode > 3.5 ? abs(vLocal.x) + abs(vLocal.y) : length(vLocal);
    float aa = fwidth(d);
    float alpha;
    if (mode < 1.5) {
      // ellipse fill; param.x = soft-edge fraction (≈1 → radial glow falloff)
      alpha = 1.0 - smoothstep(1.0 - max(vParam.x, aa), 1.0, d);
    } else if (mode < 2.5) {
      // ring stroke; param.x = thickness fraction, param.y = dash count, param.z = dash phase
      float inner = 1.0 - vParam.x;
      alpha = (1.0 - smoothstep(1.0 - aa, 1.0, d)) * smoothstep(inner - aa, inner, d);
      if (vParam.y > 0.5) {
        float f = fract((atan(vLocal.y, vLocal.x) / TAU + 0.5) * vParam.y + vParam.z);
        alpha *= smoothstep(0.0, 0.06, f) * (1.0 - smoothstep(0.58, 0.66, f));
      }
    } else if (mode < 3.5) {
      // arc sector fill; param.xy = start/end angle (end > start)
      alpha = 1.0 - smoothstep(1.0 - aa, 1.0, d);
      float rel = mod(atan(vLocal.y, vLocal.x) - vParam.x, TAU);
      alpha *= step(rel, vParam.y - vParam.x);
    } else {
      alpha = 1.0 - smoothstep(1.0 - aa, 1.0, d); // diamond
    }
    col = vec4(alpha);
  }
  outColor = col * vColor;
}`;

// ---------- CSS color parsing (cached) ----------

const colorCache = new Map<string, [number, number, number, number]>();

/** Parse #rgb/#rrggbb/#rrggbbaa/rgb()/rgba() → [r,g,b,a] floats 0..1. */
export function parseColor(css: string): [number, number, number, number] {
  let c = colorCache.get(css);
  if (c) return c;
  let r = 1, g = 1, b = 1, a = 1;
  if (css[0] === '#') {
    if (css.length === 4) {
      r = parseInt(css[1] + css[1], 16) / 255;
      g = parseInt(css[2] + css[2], 16) / 255;
      b = parseInt(css[3] + css[3], 16) / 255;
    } else {
      r = parseInt(css.slice(1, 3), 16) / 255;
      g = parseInt(css.slice(3, 5), 16) / 255;
      b = parseInt(css.slice(5, 7), 16) / 255;
      if (css.length >= 9) a = parseInt(css.slice(7, 9), 16) / 255;
    }
  } else {
    const m = css.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?/);
    if (m) {
      r = +m[1] / 255; g = +m[2] / 255; b = +m[3] / 255;
      if (m[4] !== undefined) a = +m[4];
    }
  }
  c = [r, g, b, a];
  colorCache.set(css, c);
  return c;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`shader compile failed: ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
}

const MAX_QUADS = 16384;
const FLOATS_PER_VERT = 15; // pos2 local2 uv2 color1(packed u8x4) fx4 param4
const STRIDE = FLOATS_PER_VERT * 4;

export class Batch {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private uRes: WebGLUniformLocation;
  private data = new ArrayBuffer(MAX_QUADS * 4 * STRIDE);
  private f32 = new Float32Array(this.data);
  private u32 = new Uint32Array(this.data);
  private quads = 0;
  /** Pre-packed premultiplied RGBA8 for the next quads (see color()). */
  private tint = 0xffffffff;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`program link failed: ${gl.getProgramInfoLog(prog)}`);
    }
    this.program = prog;
    this.uRes = gl.getUniformLocation(prog, 'uRes')!;
    gl.useProgram(prog);
    gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    this.vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, STRIDE, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, STRIDE, 16);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, STRIDE, 24);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 4, gl.FLOAT, false, STRIDE, 28);
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 4, gl.FLOAT, false, STRIDE, 44);

    // static index pattern: 2 triangles per quad
    const idx = new Uint32Array(MAX_QUADS * 6);
    for (let q = 0; q < MAX_QUADS; q++) {
      const v = q * 4, i = q * 6;
      idx[i] = v; idx[i + 1] = v + 1; idx[i + 2] = v + 2;
      idx[i + 3] = v + 2; idx[i + 4] = v + 1; idx[i + 5] = v + 3;
    }
    const ibo = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    gl.bindVertexArray(null);
  }

  /** Set the premultiplied tint for subsequent quads from a CSS color × alpha. */
  color(css: string, alpha = 1): void {
    const [r, g, b, a0] = parseColor(css);
    const a = a0 * alpha;
    this.tint =
      ((a * 255) << 24 >>> 0) |
      ((b * a * 255) << 16) |
      ((g * a * 255) << 8) |
      (r * a * 255);
  }

  /** White tint at the given alpha (sprites drawn as-baked). */
  alpha(a = 1): void {
    const v = (a * 255) | 0;
    this.tint = ((v << 24) >>> 0) | (v << 16) | (v << 8) | v;
  }

  private vert(o: number, x: number, y: number, lx: number, ly: number, u: number, v: number,
    fx: number, fy: number, fz: number, mode: number, p0: number, p1: number, p2: number, p3: number): void {
    const f = this.f32;
    f[o] = x; f[o + 1] = y; f[o + 2] = lx; f[o + 3] = ly; f[o + 4] = u; f[o + 5] = v;
    this.u32[o + 6] = this.tint;
    f[o + 7] = fx; f[o + 8] = fy; f[o + 9] = fz; f[o + 10] = mode;
    f[o + 11] = p0; f[o + 12] = p1; f[o + 13] = p2; f[o + 14] = p3;
  }

  /** Axis-aligned quad. Corners (x0,y0)-(x1,y1); local/uv interpolated. */
  private push(x0: number, y0: number, x1: number, y1: number,
    u0: number, v0: number, u1: number, v1: number,
    fx: number, fy: number, fz: number, mode: number,
    p0 = 0, p1 = 0, p2 = 0, p3 = 0): void {
    if (this.quads >= MAX_QUADS) this.flush();
    const o = this.quads * 4 * FLOATS_PER_VERT;
    this.vert(o, x0, y0, -1, -1, u0, v0, fx, fy, fz, mode, p0, p1, p2, p3);
    this.vert(o + FLOATS_PER_VERT, x1, y0, 1, -1, u1, v0, fx, fy, fz, mode, p0, p1, p2, p3);
    this.vert(o + FLOATS_PER_VERT * 2, x0, y1, -1, 1, u0, v1, fx, fy, fz, mode, p0, p1, p2, p3);
    this.vert(o + FLOATS_PER_VERT * 3, x1, y1, 1, 1, u1, v1, fx, fy, fz, mode, p0, p1, p2, p3);
    this.quads++;
  }

  /** Textured sprite centered at (cx, cy), drawn w×h, optional fx + x-mirror. */
  sprite(r: { u0: number; v0: number; u1: number; v1: number }, cx: number, cy: number, w: number, h: number,
    whiten = 0, desat = 0, bright = 1, flipX = false): void {
    const u0 = flipX ? r.u1 : r.u0, u1 = flipX ? r.u0 : r.u1;
    this.push(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, u0, r.v0, u1, r.v1, whiten, desat, bright, 0);
  }

  /** Textured sprite rotated by ang around its center. */
  rotSprite(r: { u0: number; v0: number; u1: number; v1: number }, cx: number, cy: number, w: number, h: number, ang: number): void {
    if (this.quads >= MAX_QUADS) this.flush();
    const c = Math.cos(ang), s = Math.sin(ang);
    const hw = w / 2, hh = h / 2;
    const o = this.quads * 4 * FLOATS_PER_VERT;
    const px = (lx: number, ly: number) => cx + lx * hw * c - ly * hh * s;
    const py = (lx: number, ly: number) => cy + lx * hw * s + ly * hh * c;
    this.vert(o, px(-1, -1), py(-1, -1), -1, -1, r.u0, r.v0, 0, 0, 1, 0, 0, 0, 0, 0);
    this.vert(o + FLOATS_PER_VERT, px(1, -1), py(1, -1), 1, -1, r.u1, r.v0, 0, 0, 1, 0, 0, 0, 0, 0);
    this.vert(o + FLOATS_PER_VERT * 2, px(-1, 1), py(-1, 1), -1, 1, r.u0, r.v1, 0, 0, 1, 0, 0, 0, 0, 0);
    this.vert(o + FLOATS_PER_VERT * 3, px(1, 1), py(1, 1), 1, 1, r.u1, r.v1, 0, 0, 1, 0, 0, 0, 0, 0);
    this.quads++;
  }

  /** Filled ellipse; soft = edge-fade fraction (≈1 for a radial glow). */
  ellipse(cx: number, cy: number, rx: number, ry: number, soft = 0): void {
    this.push(cx - rx, cy - ry, cx + rx, cy + ry, 0, 0, 0, 0, 0, 0, 1, 1, soft);
  }

  /** Ellipse ring stroke; width in px (along the minor axis), optional dashes. */
  ring(cx: number, cy: number, rx: number, ry: number, width: number, dashes = 0, dashPhase = 0): void {
    const t = Math.min(1, width / Math.max(1, Math.min(rx, ry)));
    this.push(cx - rx, cy - ry, cx + rx, cy + ry, 0, 0, 0, 0, 0, 0, 1, 2, t, dashes, dashPhase);
  }

  /** Filled elliptic sector between screen-space angles a0→a1 (a1 > a0). */
  sector(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): void {
    this.push(cx - rx, cy - ry, cx + rx, cy + ry, 0, 0, 0, 0, 0, 0, 1, 3, a0, a1);
  }

  /** Filled diamond (|x|+|y| ≤ 1 in local space) — isometric tiles, blades, pets. */
  diamond(cx: number, cy: number, rx: number, ry: number): void {
    this.push(cx - rx, cy - ry, cx + rx, cy + ry, 0, 0, 0, 0, 0, 0, 1, 4);
  }

  /** Solid axis-aligned rect (HP bars, columns, particles). */
  rect(x: number, y: number, w: number, h: number): void {
    this.push(x, y, x + w, y + h, 0, 0, 0, 0, 0, 0, 1, 5);
  }

  /** Solid line segment as a rotated quad. */
  line(x0: number, y0: number, x1: number, y1: number, width: number): void {
    if (this.quads >= MAX_QUADS) this.flush();
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * width / 2, ny = (dx / len) * width / 2;
    const o = this.quads * 4 * FLOATS_PER_VERT;
    this.vert(o, x0 + nx, y0 + ny, -1, -1, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0);
    this.vert(o + FLOATS_PER_VERT, x1 + nx, y1 + ny, 1, -1, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0);
    this.vert(o + FLOATS_PER_VERT * 2, x0 - nx, y0 - ny, -1, 1, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0);
    this.vert(o + FLOATS_PER_VERT * 3, x1 - nx, y1 - ny, 1, 1, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0);
    this.quads++;
  }

  /** Upload + draw everything queued since the last flush. */
  flush(): void {
    if (this.quads === 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.f32, 0, this.quads * 4 * FLOATS_PER_VERT);
    gl.drawElements(gl.TRIANGLES, this.quads * 6, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    this.quads = 0;
  }

  /** Set the logical-pixel resolution uniform (call when size changes). */
  setResolution(w: number, h: number): void {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniform2f(this.uRes, w, h);
  }
}
