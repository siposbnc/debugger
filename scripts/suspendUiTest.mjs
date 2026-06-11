// End-to-end suspend & resume flow:
//   run → pause → SUSPEND PROCESS → main menu shows RESUME RUN →
//   full page reload (cold start from localStorage) → resume →
//   clock/level/kills continue from the snapshot → snapshot consumed.
// Serve the app first (vite preview or dev), then: node scripts/suspendUiTest.mjs [url]
// Needs playwright (npm install --no-save playwright + npx playwright install chromium-headless-shell).
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';
const SAVE_KEY = 'debugger-save-v1';

const browser = await chromium.launch();
const page = await browser.newPage();

let failures = 0;
const check = (name, ok, detail = '') => {
  failures += ok ? 0 : 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const uiText = () => page.evaluate(() => document.getElementById('ui').textContent);
const uiEmpty = () => page.evaluate(() => document.getElementById('ui').children.length === 0);
const savedSnap = () => page.evaluate((k) =>
  JSON.parse(localStorage.getItem(k) ?? '{}').suspendedRun ?? null, SAVE_KEY);
// "breakpoint hit at M:SS — level L, K bugs squashed" → seconds
const pausedClock = async () => {
  const m = (await uiText()).match(/breakpoint hit at (\d+):(\d+)/);
  return m ? +m[1] * 60 + +m[2] : -1;
};

// --- 1. play a few seconds, suspend from pause ---
await page.goto(`${BASE}/?autostart`);
await page.waitForTimeout(3000);
check('run is live', await uiEmpty());
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
check('pause shows SUSPEND PROCESS', (await uiText()).includes('SUSPEND PROCESS'));
await page.click('[data-act="suspend"]');
await page.waitForTimeout(200);

check('suspend returns to main menu', (await uiText()).includes('START RUN'));
check('main menu offers RESUME RUN', (await uiText()).includes('RESUME RUN'));
const snap = await savedSnap();
check('snapshot persisted to localStorage', !!snap && snap.time > 1,
  snap ? `t=${snap.time.toFixed(1)}s, lv ${snap.level}, ${snap.kills} kills` : 'missing');

// --- 2. cold start: reload, resume, state carries over ---
await page.goto(`${BASE}/`); // no autostart — a fresh boot from the save
await page.waitForTimeout(400);
check('RESUME RUN survives a reload', (await uiText()).includes('RESUME RUN'));
await page.click('[data-act="resumeRun"]');
await page.waitForTimeout(800);
check('resume enters the run', await uiEmpty());
check('snapshot consumed on resume', (await savedSnap()) === null);

await page.keyboard.press('Escape');
await page.waitForTimeout(150);
const clock = await pausedClock();
check('clock continues from the snapshot', clock >= Math.floor(snap.time) && clock < snap.time + 10,
  `paused at ${clock}s, suspended at ${snap.time.toFixed(1)}s`);
const killsM = (await uiText()).match(/(\d+) bugs squashed/);
check('kill count carried over', !!killsM && +killsM[1] >= snap.kills,
  `${killsM?.[1]} vs ${snap.kills} at suspend`);

// --- 3. consumed means gone: another cold start has no resume offer ---
await page.goto(`${BASE}/`);
await page.waitForTimeout(400);
check('no RESUME RUN after consumption', !(await uiText()).includes('RESUME RUN'));

await browser.close();
console.log(failures === 0 ? '\nAll suspend UI checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
