// Touch-controls verification: drives the real UI with synthetic touches —
// menu tap starts a run, the floating virtual stick moves the player (verified
// end-to-end through a suspend snapshot), and the touch pause button
// pauses/resumes. Serve a build:dev output first (vite preview or dev), then:
//   node scripts/touchTest.mjs [url]
// Needs playwright (npm install --no-save playwright + npx playwright install chromium-headless-shell).
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';

const browser = await chromium.launch();
const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 900, height: 640 } });
const page = await ctx.newPage();
await page.goto(BASE);
await page.waitForSelector('[data-act="start"]');

let failures = 0;
const check = (name, ok, detail = '') => {
  failures += ok ? 0 : 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const uiEmpty = () => page.evaluate(() => document.getElementById('ui').children.length === 0);
const pauseBtnShown = () => page.evaluate(() => document.getElementById('touch-pause')?.classList.contains('show') ?? false);
const tapButton = async (text) => {
  const el = page.locator('#ui button', { hasText: text }).first();
  await el.tap();
  await page.waitForTimeout(150);
};

// Virtual-stick drag dispatched as real TouchEvents on the canvas (the
// listeners are plain DOM handlers — synthetic events exercise them fully).
const stick = {
  start: (x, y) => page.evaluate(([x, y]) => {
    const c = document.getElementById('game');
    const t = new Touch({ identifier: 7, target: c, clientX: x, clientY: y });
    c.dispatchEvent(new TouchEvent('touchstart', { touches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
  }, [x, y]),
  move: (x, y) => page.evaluate(([x, y]) => {
    const c = document.getElementById('game');
    const t = new Touch({ identifier: 7, target: c, clientX: x, clientY: y });
    c.dispatchEvent(new TouchEvent('touchmove', { touches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
  }, [x, y]),
  end: (x, y) => page.evaluate(([x, y]) => {
    const c = document.getElementById('game');
    const t = new Touch({ identifier: 7, target: c, clientX: x, clientY: y });
    c.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t], bubbles: true, cancelable: true }));
  }, [x, y]),
};

// --- menu tap starts a run ---
await page.locator('[data-act="start"]').tap();
await page.waitForTimeout(400);
check('tap on START RUN starts a run', await uiEmpty());

// --- touch pause button appears once touch is in use during a run ---
check('touch pause button shown in-run', await pauseBtnShown());

// --- virtual stick moves the player ---
// Hold the stick to the right ~1.2s. Screen-right rotates into world (+x, -y),
// so the player must drift to positive px (start is exactly 0,0).
await stick.start(450, 320);
await stick.move(550, 320);
await page.waitForTimeout(1200);
await stick.end(550, 320);
await page.waitForTimeout(100);

// --- pause via the touch button ---
await page.locator('#touch-pause').tap();
await page.waitForTimeout(200);
const pausedText = await page.evaluate(() => document.getElementById('ui').textContent);
check('touch pause button opens pause screen', pausedText.includes('CONTINUE'));
check('pause button hidden while paused', !(await pauseBtnShown()));

// --- resume by tapping CONTINUE ---
await tapButton('CONTINUE');
check('tap CONTINUE resumes the run', await uiEmpty());

// --- suspend and verify the player actually moved (end-to-end stick check) ---
await page.locator('#touch-pause').tap();
await page.waitForTimeout(200);
await tapButton('SUSPEND PROCESS');
await page.waitForTimeout(300);
const snap = await page.evaluate(() => JSON.parse(localStorage.getItem('debugger-save-v1')).suspendedRun);
check('suspend reachable by touch (snapshot saved)', !!snap);
check('virtual stick moved the player', !!snap && snap.px > 10 && snap.py < -10, snap ? `px=${snap.px.toFixed(1)} py=${snap.py.toFixed(1)}` : 'no snapshot');

// --- back on the menu: touch pause button gone ---
check('pause button hidden on the menu', !(await pauseBtnShown()));

// --- stick releases cleanly: resume, no input → player stays put ---
await tapButton('RESUME RUN');
await page.waitForTimeout(150);
check('resume run via tap', await uiEmpty());
await page.waitForTimeout(800);
await page.locator('#touch-pause').tap();
await page.waitForTimeout(200);
await tapButton('SUSPEND PROCESS');
await page.waitForTimeout(300);
const snap2 = await page.evaluate(() => JSON.parse(localStorage.getItem('debugger-save-v1')).suspendedRun);
const drift = snap2 && snap ? Math.hypot(snap2.px - snap.px, snap2.py - snap.py) : Infinity;
check('released stick = no residual movement', drift < 1, `drift=${drift.toFixed(2)}`);

await browser.close();
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
