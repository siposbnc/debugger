// Dev console (window.dbg) verification: drives a dev-mode build in headless
// Chromium and exercises every dbg.* call against the live run + DOM.
// Serve a `vite build --mode dev` output first (vite preview), then:
//   node scripts/devtoolsTest.mjs [url]
// Needs playwright (npm install --no-save playwright + npx playwright install chromium-headless-shell).
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';

let failures = 0;
const check = (name, ok, detail = '') => {
  failures += ok ? 0 : 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/?autostart`); // straight into a run
await page.waitForFunction(() => typeof window.dbg === 'object');
const dbg = (expr) => page.evaluate(expr);

check('dbg installed, help shows banner', (await dbg(() => window.dbg.help())).includes('Debugger dev console'));
check('list returns table summary', (await dbg(() => window.dbg.list('weapons'))) === '1 table(s) above');
check('list rejects unknown kind', (await dbg(() => window.dbg.list('nonsense'))).includes('unknown kind'));

// bits(0) also seeds localStorage (a fresh profile has no save until a persist)
const bitsBefore = Number((await dbg(() => window.dbg.bits(0))).match(/→ (\d+)/)[1]);
await dbg(() => window.dbg.bits(500));
const bitsStored = await dbg(() => JSON.parse(localStorage.getItem('debugger-save-v1')).bits);
check('bits(500) adds and persists', bitsStored === bitsBefore + 500, `${bitsBefore} → ${bitsStored}`);

check('god() toggles on', (await dbg(() => window.dbg.god())).includes('invincible: true'));
check('god(false) forces off', (await dbg(() => window.dbg.god(false))).includes('invincible: false'));
await dbg(() => window.dbg.god(true)); // keep the test run alive from here on

check('give() grants a weapon', (await dbg(() => window.dbg.give('breakpointBow'))).includes('granted'));
check('give() refuses a duplicate', (await dbg(() => window.dbg.give('breakpointBow'))).includes('already owned'));
check('give() rejects unknown id', (await dbg(() => window.dbg.give('nonsense'))) === '');
check('level() sets weapon level', (await dbg(() => window.dbg.level('breakpointBow', 8))).includes('level 8'));
check('level() clamps to max', (await dbg(() => window.dbg.level('breakpointBow', 99))).includes('level 8'));
check('give() applies a card', (await dbg(() => window.dbg.give('coffeeBreak'))).includes('Coffee Break'));

check('xp() reports gain', /level \d+, \d+ pending/.test(await dbg(() => window.dbg.xp(5))));
check('time() moves the clock', (await dbg(() => window.dbg.time(5))).includes('5:00'));

// Drain any naturally opened level-up modal so the forced offer is the one
// on screen (the live run levels on its own while the checks above run).
for (let i = 0; i < 8 && await page.$('.levelup-wrap'); i++) {
  await page.click('.upgrade-card');
  await page.waitForTimeout(150);
}

// Forced offer: 2 ids → modal opens with exactly those 2 cards, and a pick applies.
await dbg(() => window.dbg.offer('hotfix', 'coffeeBreak'));
await page.waitForSelector('.levelup-wrap', { timeout: 5000 });
const modalText = await page.evaluate(() => document.querySelector('.levelup-wrap').textContent);
check('offer() opens modal with forced cards', /Hotfix/.test(modalText) && /Coffee Break/.test(modalText));
const cardCount = await page.evaluate(() => document.querySelectorAll('.upgrade-card').length);
check('offer() shows exactly the forced ids', cardCount === 2, `${cardCount} cards`);
await page.click('.upgrade-card'); // pick Hotfix — applyOffer must handle a forced item
await page.waitForTimeout(200);
check('picking a forced card applies cleanly', await page.evaluate(() => !document.body.textContent.includes('Error')));
check('offer() rejects unknown ids', (await dbg(() => window.dbg.offer('nonsense'))).includes('usage'));

await browser.close();
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
