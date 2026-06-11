import { sound } from '../audio/sound';

// Spatial keyboard navigation for the DOM menus: WASD/arrows move a roving
// highlight (.kb-focus), Enter/Space activate it, Esc fires the screen's back
// action. One instance lives on UI; re-attach after every screen render.
// Navigation is geometry-based (nearest rect in the pressed direction), so any
// layout works without per-screen wiring. Gamepad menu support can drive
// move()/activate() directly.

const ITEM_SELECTOR = 'button:not(:disabled), .select-card, .upgrade-card, input[type="range"]';

const DIR: Record<string, { x: number; y: number }> = {
  KeyW: { x: 0, y: -1 }, ArrowUp: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 }, ArrowDown: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 }, ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 }, ArrowRight: { x: 1, y: 0 },
};

/** Stable identity for an item so focus survives a screen re-render. */
function itemKey(el: HTMLElement): string {
  const d = el.dataset;
  return d.act ?? d.id ?? d.meta ?? d.weapon ?? (d.i !== undefined ? `card${d.i}` : el.id || el.textContent || '');
}

export class KbNav {
  private container: HTMLElement | null = null;
  private items: HTMLElement[] = [];
  private idx = -1;
  private onBack: (() => void) | null = null;
  private lastKey = ''; // survives re-renders so focus stays put after a purchase/reroll
  private liveKeys = new Set<string>(); // codes pressed fresh since attach — only these may auto-repeat

  private keyHandler = (e: KeyboardEvent): void => this.onKey(e);
  private overHandler = (e: Event): void => this.onOver(e);

  attach(container: HTMLElement, onBack: (() => void) | null): void {
    this.detach();
    this.container = container;
    this.onBack = onBack;
    this.items = [...container.querySelectorAll<HTMLElement>(ITEM_SELECTOR)];
    this.liveKeys.clear();
    window.addEventListener('keydown', this.keyHandler);
    container.addEventListener('mouseover', this.overHandler);
    const prev = this.lastKey ? this.items.findIndex((el) => itemKey(el) === this.lastKey) : -1;
    const primary = this.items.findIndex((el) => el.classList.contains('primary'));
    this.focus(prev >= 0 ? prev : primary >= 0 ? primary : 0, false, false);
  }

  detach(): void {
    window.removeEventListener('keydown', this.keyHandler);
    this.container?.removeEventListener('mouseover', this.overHandler);
    this.items[this.idx]?.classList.remove('kb-focus');
    this.container = null;
    this.items = [];
    this.idx = -1;
    this.onBack = null;
  }

  /** Move the highlight to the nearest item in direction (dx,dy); wraps around when at an edge. */
  move(dx: number, dy: number): void {
    if (this.items.length === 0) return;
    const cur = this.items[this.idx];
    if (!cur) { this.focus(0, true, true); return; }
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let lane = -1, laneScore = Infinity;   // candidates overlapping on the cross axis (same row/column)
    let best = -1, bestScore = Infinity;   // any candidate ahead — fallback for diagonal-only layouts
    let wrap = -1, wrapDist = -Infinity;
    for (let i = 0; i < this.items.length; i++) {
      if (i === this.idx) continue;
      const b = this.items[i].getBoundingClientRect();
      const ox = b.left + b.width / 2 - ax;
      const oy = b.top + b.height / 2 - ay;
      const ahead = ox * dx + oy * dy;                      // progress along the pressed direction
      const drift = Math.abs(ox * dy) + Math.abs(oy * dx);  // off-axis offset, weighted against
      if (ahead > 1) {
        const inLane = dy !== 0
          ? b.left < a.right && b.right > a.left
          : b.top < a.bottom && b.bottom > a.top;
        if (inLane) {
          const score = ahead + drift * 0.5;
          if (score < laneScore) { laneScore = score; lane = i; }
        }
        const score = ahead + drift * 2.5;
        if (score < bestScore) { bestScore = score; best = i; }
      } else if (ahead < -1) {
        const score = -ahead - drift * 2.5;
        if (score > wrapDist) { wrapDist = score; wrap = i; }
      }
    }
    const next = lane >= 0 ? lane : best >= 0 ? best : wrap;
    if (next >= 0) this.focus(next, true, true);
  }

  /** Click the highlighted item, replicating a real mouse press (mousedown first, for click sounds). */
  activate(): void {
    const cur = this.items[this.idx];
    if (!cur || cur instanceof HTMLInputElement) return;
    cur.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    cur.click();
  }

  private onKey(e: KeyboardEvent): void {
    // A key held from before this screen appeared only emits auto-repeats —
    // ignore those so movement keys can't spam through the level-up cards.
    if (e.repeat) {
      if (!this.liveKeys.has(e.code)) return;
    } else {
      this.liveKeys.add(e.code);
    }
    if (e.code === 'Escape') {
      if (this.onBack) {
        e.preventDefault();
        this.onBack();
      }
      return;
    }
    const dir = DIR[e.code];
    if (dir) {
      e.preventDefault();
      const cur = this.items[this.idx];
      if (dir.y === 0 && cur instanceof HTMLInputElement && cur.type === 'range') {
        cur.value = String(Number(cur.value) + dir.x * 5);
        cur.dispatchEvent(new Event('input'));
        return;
      }
      this.move(dir.x, dir.y);
      return;
    }
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      e.preventDefault();
      this.activate();
    }
  }

  private onOver(e: Event): void {
    const i = this.items.findIndex((el) => el.contains(e.target as Node));
    if (i >= 0) this.focus(i, false, false);
  }

  private focus(i: number, scroll: boolean, tick: boolean): void {
    if (i < 0 || i >= this.items.length || i === this.idx) return;
    this.items[this.idx]?.classList.remove('kb-focus');
    this.idx = i;
    const el = this.items[i];
    el.classList.add('kb-focus');
    this.lastKey = itemKey(el);
    if (scroll) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (tick) sound.play('click');
  }
}
