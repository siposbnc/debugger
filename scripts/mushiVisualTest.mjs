// The Precipitate — visual/UI verification: codex entry (thumbnail, NOT A BUG
// tag, listed last), dbg.mushi() spawn, and screenshots for eyeballing.
// Serve a `vite build --mode dev` output first (vite preview), then:
//   node scripts/mushiVisualTest.mjs [url]
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';

let failures = 0;
const check = (name, ok, detail = '') => {
  failures += ok ? 0 : 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });

// --- codex entry ---
await page.goto(BASE);
await page.click('button[data-act="codex"]');
await page.waitForSelector('.codex-cols');

const entry = await page.evaluate(() => {
  const panel = [...document.querySelectorAll('.codex-panel')]
    .find((p) => p.querySelector('h3')?.textContent === '~/known_bugs');
  const entries = [...panel.querySelectorAll('.codex-entry')];
  const last = entries[entries.length - 1];
  const img = last.querySelector('img.codex-thumb');
  return {
    bugCount: entries.length,
    lastName: last.querySelector('b')?.textContent ?? '',
    tag: last.querySelector('.codex-tag')?.textContent ?? '',
    desc: last.querySelector('.codex-body > span')?.textContent ?? '',
    thumbLoaded: !!img && img.naturalWidth > 0,
  };
});
check('listed last in ~/known_bugs', entry.lastName.includes('The Precipitate'), entry.lastName.trim());
check('NOT A BUG tag rendered', entry.tag === 'NOT A BUG');
check('thumbnail baked + loaded', entry.thumbLoaded);
check('codex copy carries the cabal line', entry.desc.includes('cabal of exactly two'));
check('only the Precipitate is tagged', await page.evaluate(
  () => document.querySelectorAll('.codex-tag').length === 1));
await page.screenshot({ path: 'scripts/mushi-codex.png', clip: { x: 0, y: 0, width: 1500, height: 950 } });

// --- in-run spawn via dbg ---
await page.goto(`${BASE}/?autostart`);
await page.waitForFunction(() => typeof window.dbg === 'object');
await page.evaluate(() => window.dbg.god(true));
const msg = await page.evaluate(() => window.dbg.mushi());
check('dbg.mushi() schedules it', msg.includes('precipitating'), msg);
await page.waitForTimeout(1200); // spawn + a moment of wandering
const again = await page.evaluate(() => window.dbg.mushi());
check('dbg.mushi() reports it present', again.includes('already here'), again);
await page.screenshot({ path: 'scripts/mushi-ingame.png' });

await browser.close();
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures ? 1 : 0);
