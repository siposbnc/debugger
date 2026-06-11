// Verifies the two run-protection behaviors:
//  1. Auto-pause when the window blurs / the tab hides (visible-unfocused
//     windows used to keep simulating with input cleared — a silent run killer).
//  2. KILL PROCESS two-step confirm: arm → confirm, disarms on focus move
//     and on a ~2s timeout.
// Serve the app first (vite preview or dev), then: node scripts/pauseGuardTest.mjs [url]
// Needs playwright (npm install --no-save playwright + npx playwright install chromium-headless-shell).
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/?autostart`);
await page.waitForTimeout(600); // let the run spin up

let failures = 0;
const check = (name, ok, detail = '') => {
  failures += ok ? 0 : 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const uiEmpty = () => page.evaluate(() => document.getElementById('ui').children.length === 0);
const onPause = () => page.evaluate(() => document.getElementById('ui').textContent.includes('CONTINUE (ESC)'));
const abandonText = () => page.evaluate(() =>
  document.querySelector('[data-act="abandon"]')?.textContent ?? null);
const resume = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(120); };

// --- 1. auto-pause on window blur ---
check('run is live (no UI)', await uiEmpty());
await page.evaluate(() => window.dispatchEvent(new Event('blur')));
await page.waitForTimeout(120);
check('window blur pauses the run', await onPause());
await resume();
check('Esc resumes after blur-pause', await uiEmpty());

// --- 2. auto-pause on tab hide (visibilitychange + document.hidden) ---
await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(120);
check('tab hide pauses the run', await onPause());
await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
});
await resume();
check('Esc resumes after hide-pause', await uiEmpty());

// --- 3. KILL PROCESS two-step confirm ---
await page.keyboard.press('Escape'); // pause
await page.waitForTimeout(120);
check('pause screen open', await onPause());

await page.click('[data-act="abandon"]');
await page.waitForTimeout(80);
check('first click arms (text changes)', (await abandonText())?.includes('ARE YOU SURE'), `text: ${await abandonText()}`);
check('run not ended by arming', await onPause());

// timeout disarm
await page.waitForTimeout(2300);
check('arms back down after ~2s', await abandonText() === 'KILL PROCESS', `text: ${await abandonText()}`);

// focus-move disarm (arm via keyboard activate, then navigate away)
await page.click('[data-act="abandon"]'); // mouseover focused it; click arms
await page.waitForTimeout(80);
check('re-armed', (await abandonText())?.includes('ARE YOU SURE'));
await page.keyboard.press('ArrowLeft'); // kbnav moves focus to CONTINUE
await page.waitForTimeout(80);
check('focus move disarms', await abandonText() === 'KILL PROCESS', `text: ${await abandonText()}`);

// keyboard confirm path: focus back on abandon, Enter arms, Enter confirms
await page.keyboard.press('ArrowRight');
await page.keyboard.press('Enter');
await page.waitForTimeout(80);
check('keyboard Enter arms', (await abandonText())?.includes('ARE YOU SURE'));
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
const onSummary = await page.evaluate(() => document.getElementById('ui').textContent.includes('BITS BREAKDOWN'));
check('second activate kills the run (summary shown)', onSummary);

await browser.close();
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
