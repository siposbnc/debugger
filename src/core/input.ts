// Keyboard + gamepad state. Movement vector from WASD/arrows + left stick/d-pad.

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

/** Movement vector in WORLD space, length ≤ 1 (analog stick preserves magnitude). */
export function moveVector(): { x: number; y: number } {
  let x = padX, y = padY;
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
