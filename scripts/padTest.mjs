// Headless gamepad verification: stubs navigator.getGamepads() with a fake
// standard-mapping pad and drives the real UI — d-pad/stick menu nav, A
// activate, B back, Start pause/resume. Serve the app first (vite preview or
// dev), then: node scripts/padTest.mjs [url]
// Needs playwright (npm install --no-save playwright + npx playwright install chromium-headless-shell).
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';
const BTN = { A: 0, B: 1, START: 9, DOWN: 13, RIGHT: 15 };

const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript(() => {
  const pad = {
    id: 'Fake Pad', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
  };
  window.__pad = pad;
  navigator.getGamepads = () => [pad];
});
await page.goto(BASE);
await page.waitForSelector('[data-act="start"]');

const press = async (btn) => {
  await page.evaluate((b) => { window.__pad.buttons[b].pressed = true; window.__pad.buttons[b].value = 1; }, btn);
  await page.waitForTimeout(80);
  await page.evaluate((b) => { window.__pad.buttons[b].pressed = false; window.__pad.buttons[b].value = 0; }, btn);
  await page.waitForTimeout(80);
};
const focused = () => page.evaluate(() => document.querySelector('.kb-focus')?.textContent?.trim() ?? null);
const onMainMenu = () => page.evaluate(() => !!document.querySelector('[data-act="start"]'));
const uiEmpty = () => page.evaluate(() => document.getElementById('ui').children.length === 0);
const focusTo = async (label) => {
  for (let i = 0; i < 10; i++) {
    if (await focused() === label) return true;
    await press(BTN.DOWN);
  }
  return false;
};

let failures = 0;
const check = (name, ok, detail = '') => {
  failures += ok ? 0 : 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const before = await focused();
await press(BTN.DOWN);
const afterDpad = await focused();
check('d-pad moves focus', afterDpad !== null && afterDpad !== before, `${before} → ${afterDpad}`);

await page.evaluate(() => { window.__pad.axes[1] = 1; });
await page.waitForTimeout(100);
await page.evaluate(() => { window.__pad.axes[1] = 0; });
await page.waitForTimeout(80);
const afterStick = await focused();
check('left stick moves focus', afterStick !== afterDpad, `${afterDpad} → ${afterStick}`);

check('focus reaches SETTINGS', await focusTo('SETTINGS'));
await press(BTN.A);
check('A opens submenu', !(await onMainMenu()));
await press(BTN.B);
check('B backs out to main menu', await onMainMenu());

check('focus reaches START RUN', await focusTo('START RUN'));
await press(BTN.A);
await page.waitForTimeout(400);
check('A starts a run (UI cleared)', await uiEmpty());

await press(BTN.START);
const paused = await page.evaluate(() => document.getElementById('ui').textContent.includes('CONTINUE'));
check('Start pauses (pause screen shown)', paused);
await press(BTN.B);
check('B resumes from pause', await uiEmpty());
await press(BTN.START);
await press(BTN.START);
check('Start toggles pause/resume', await uiEmpty());

// Regression: a direction held while a screen opens (e.g. moving when the
// level-up modal appears) must not navigate it until released.
await page.evaluate(() => { window.__pad.axes[1] = 1; });
await page.waitForTimeout(200);
await press(BTN.START);
const f0 = await focused();
await page.waitForTimeout(600); // > repeat delay — would have rotated without the gate
const f1 = await focused();
check('held stick does not navigate a fresh screen', f0 !== null && f0 === f1, `stayed on ${f0}`);
await page.evaluate(() => { window.__pad.axes[1] = 0; });
await page.waitForTimeout(100);
await press(BTN.RIGHT); // pause actions are a horizontal row
const f2 = await focused();
check('nav works again after release', f2 !== f1, `${f1} → ${f2}`);

await browser.close();
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
