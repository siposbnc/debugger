import { RendererBase } from './rendererBase';
import { GlRenderer } from './glRenderer';
import { CanvasRenderer } from './canvasRenderer';

export type { RendererBase };

/** WebGL2 renderer, falling back to the frozen legacy Canvas2D path when GL
 *  init fails (ancient hardware, blocklisted drivers, disabled WebGL). */
export function createRenderer(canvas: HTMLCanvasElement, hudCanvas: HTMLCanvasElement, bannerCanvas: HTMLCanvasElement): RendererBase {
  try {
    return new GlRenderer(canvas, hudCanvas, bannerCanvas);
  } catch (err) {
    console.warn('WebGL2 init failed — falling back to Canvas2D renderer', err);
    return new CanvasRenderer(canvas, hudCanvas, bannerCanvas);
  }
}
