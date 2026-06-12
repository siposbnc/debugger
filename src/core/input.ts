// Keyboard + gamepad + touch state. Movement vector from WASD/arrows +
// left stick/d-pad + virtual touch stick.

const down = new Set<string>();
const pressedThisFrame = new Set<string>();

export function initInput(): void {
  window.addEventListener('keydown', (e) => {
    if (!down.has(e.code)) pressedThisFrame.add(e.code);
    down.add(e.code);
    // Keep the page from scrolling with arrows/space while playing.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());
}

export function isDown(code: string): boolean {
  return down.has(code);
}

/** True only on the frame the key went down. Call consumePressed() at frame end. */
export function wasPressed(code: string): boolean {
  return pressedThisFrame.has(code);
}

export function consumePressed(): void {
  pressedThisFrame.clear();
  padPressedFrame.clear();
}

/** Movement vector in SCREEN space, length ≤ 1 (analog stick preserves magnitude). */
export function moveVector(): { x: number; y: number } {
  let x = padX + stickVX, y = padY + stickVY;
  if (isDown('KeyW') || isDown('ArrowUp')) y -= 1;
  if (isDown('KeyS') || isDown('ArrowDown')) y += 1;
  if (isDown('KeyA') || isDown('ArrowLeft')) x -= 1;
  if (isDown('KeyD') || isDown('ArrowRight')) x += 1;
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y };
}

// ---------- gamepad (standard mapping) ----------
// Polled once per frame by the main loop. Movement merges into moveVector();
// menus get edge-triggered button presses + a held-direction with key-style
// repeat (drives KbNav.move()). Never touched by the headless sim.

export const PAD = { A: 0, B: 1, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;

const DEADZONE = 0.35;
const REPEAT_DELAY = 0.4, REPEAT_RATE = 0.15;

let padX = 0, padY = 0;
const padDown = new Set<number>();
const padPressedFrame = new Set<number>();
let menuDir: { x: number; y: number } | null = null;
let heldDirKey = '';
let repeatT = 0;
let padNeutralGate = false;

/** Ignore a held pad direction until the stick/d-pad returns to neutral.
 *  KbNav calls this on attach so movement held when a screen opens (level-up!)
 *  can't spin through its items — pad twin of the keyboard liveKeys gate. */
export function padRequireNeutral(): void {
  padNeutralGate = true;
}

export function pollGamepad(dt: number): void {
  menuDir = null;
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  let gp: Gamepad | null = null;
  for (const p of pads) {
    if (p && (!gp || p.mapping === 'standard')) gp = p;
    if (gp && gp.mapping === 'standard') break;
  }
  if (!gp) {
    padX = padY = 0;
    padDown.clear();
    heldDirKey = '';
    return;
  }

  for (let i = 0; i < gp.buttons.length; i++) {
    if (gp.buttons[i].pressed) {
      if (!padDown.has(i)) padPressedFrame.add(i);
      padDown.add(i);
    } else {
      padDown.delete(i);
    }
  }

  const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
  padX = Math.abs(ax) > DEADZONE ? ax : 0;
  padY = Math.abs(ay) > DEADZONE ? ay : 0;
  if (padDown.has(PAD.LEFT)) padX = -1;
  if (padDown.has(PAD.RIGHT)) padX = 1;
  if (padDown.has(PAD.UP)) padY = -1;
  if (padDown.has(PAD.DOWN)) padY = 1;

  // Menu direction: dominant axis only, first press fires immediately then
  // repeats like a held keyboard key.
  let dx = 0, dy = 0;
  if (padX !== 0 || padY !== 0) {
    if (Math.abs(padX) >= Math.abs(padY)) dx = Math.sign(padX);
    else dy = Math.sign(padY);
  }
  const key = dx === 0 && dy === 0 ? '' : `${dx},${dy}`;
  if (key === '') {
    heldDirKey = '';
    padNeutralGate = false;
  } else if (padNeutralGate) {
    // direction held since before the current screen attached — stay quiet
  } else if (key !== heldDirKey) {
    heldDirKey = key;
    menuDir = { x: dx, y: dy };
    repeatT = REPEAT_DELAY;
  } else {
    repeatT -= dt;
    if (repeatT <= 0) {
      menuDir = { x: dx, y: dy };
      repeatT = REPEAT_RATE;
    }
  }
}

/** True only on the frame the pad button went down. Cleared by consumePressed(). */
export function padWasPressed(button: number): boolean {
  return padPressedFrame.has(button);
}

/** Menu-nav direction for this frame (press + auto-repeat), or null. */
export function padMenuDir(): { x: number; y: number } | null {
  return menuDir;
}

// ---------- touch (floating virtual stick) ----------
// The first touch on the canvas anchors the stick base where the finger lands;
// dragging sets a radius-clamped vector that merges into moveVector() exactly
// like the pad stick. Later touches while one is held are ignored (the DOM
// pause button sits above the canvas and never reaches these handlers).
// Only main.ts calls initTouch() — the headless sim never sees any of this.

const STICK_RADIUS = 64;  // drag distance (CSS px) for full speed
const STICK_DEAD = 8;     // ignore micro-jitter so a tap doesn't nudge the player

let stickTouchId: number | null = null;
let stickBaseX = 0, stickBaseY = 0; // base anchor, CSS px
let stickKnobX = 0, stickKnobY = 0; // knob offset from base, clamped to STICK_RADIUS
let stickVX = 0, stickVY = 0;       // movement vector, length ≤ 1
let touchSeen = false;              // any touch ever → show touch-only UI

export function initTouch(target: HTMLElement): void {
  // Menu taps land on DOM buttons, not the canvas — catch every touch at the
  // window so touch-only UI (the pause button) exists from the first tap.
  window.addEventListener('touchstart', () => { touchSeen = true; }, { capture: true, passive: true });

  target.addEventListener('touchstart', (e) => {
    e.preventDefault(); // no scroll/zoom/long-press-select on the playfield
    if (stickTouchId !== null) return;
    const t = e.changedTouches[0];
    stickTouchId = t.identifier;
    stickBaseX = t.clientX;
    stickBaseY = t.clientY;
    stickKnobX = stickKnobY = stickVX = stickVY = 0;
  }, { passive: false });

  target.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== stickTouchId) continue;
      const dx = t.clientX - stickBaseX, dy = t.clientY - stickBaseY;
      const len = Math.hypot(dx, dy);
      if (len < STICK_DEAD) {
        stickKnobX = stickKnobY = stickVX = stickVY = 0;
      } else {
        const mag = Math.min(1, len / STICK_RADIUS);
        stickVX = (dx / len) * mag;
        stickVY = (dy / len) * mag;
        stickKnobX = stickVX * STICK_RADIUS;
        stickKnobY = stickVY * STICK_RADIUS;
      }
    }
  }, { passive: false });

  const release = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== stickTouchId) continue;
      stickTouchId = null;
      stickKnobX = stickKnobY = stickVX = stickVY = 0;
    }
  };
  target.addEventListener('touchend', release);
  target.addEventListener('touchcancel', release);
  window.addEventListener('blur', () => {
    stickTouchId = null;
    stickKnobX = stickKnobY = stickVX = stickVY = 0;
  });
}

/** Live virtual-stick geometry for the renderer (CSS px), or null when idle. */
export function touchStick(): { baseX: number; baseY: number; knobX: number; knobY: number; radius: number } | null {
  if (stickTouchId === null) return null;
  return { baseX: stickBaseX, baseY: stickBaseY, knobX: stickKnobX, knobY: stickKnobY, radius: STICK_RADIUS };
}

/** True once any touch input has been seen this session (gates touch-only UI). */
export function touchUsed(): boolean {
  return touchSeen;
}
