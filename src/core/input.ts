// Keyboard state. Movement vector from WASD/arrows.

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
}

/** Normalized movement vector in WORLD space (screen-relative, iso-adjusted by caller). */
export function moveVector(): { x: number; y: number } {
  let x = 0, y = 0;
  if (isDown('KeyW') || isDown('ArrowUp')) y -= 1;
  if (isDown('KeyS') || isDown('ArrowDown')) y += 1;
  if (isDown('KeyA') || isDown('ArrowLeft')) x -= 1;
  if (isDown('KeyD') || isDown('ArrowRight')) x += 1;
  if (x !== 0 && y !== 0) {
    const inv = 1 / Math.sqrt(2);
    x *= inv; y *= inv;
  }
  return { x, y };
}
