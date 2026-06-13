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

// help() prints (multi-line, styled) rather than returning a string — capture the log
const logs = [];
page.on('console', (msg) => logs.push(msg.text()));
await dbg(() => window.dbg.help());
const helpLog = logs.find((l) => l.includes('Debugger dev console'));
check('dbg installed, help logs formatted text', !!helpLog && helpLog.includes('\n') && helpLog.includes('dbg.god(on?)'));
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
check('give(id, n) stacks a card n times', (await dbg(() => window.dbg.give('coffeeBreak', 3))).includes('×4'));
check('give(id, n) grants a weapon at level n', (await dbg(() => window.dbg.give('stackStaff', 4))).includes('level 4'));

// event(): field-event spawn hook (v0.4 in-run events). Must run BEFORE any
// time() jump — a clock past 75s triggers the natural spawn, after which
// further spawn attempts legitimately refuse.
check('event() spawns a chosen kind', (await dbg(() => window.dbg.event('terminal'))).includes('terminal spawned'));
check('event() refuses while one is live', (await dbg(() => window.dbg.event('nest'))).includes('already live'));
check('event(junk) rejected', (await dbg(() => window.dbg.event('party'))).includes('usage'));

check('xp() reports gain', /level \d+, \d+ pending/.test(await dbg(() => window.dbg.xp(5))));
check('time() moves the clock', (await dbg(() => window.dbg.time(5))).includes('5:00'));

// stat(): read, override (survives a card pickup = recompute), clear
check('stat(id) reads a stat', (await dbg(() => window.dbg.stat('moveSpeed'))).includes('moveSpeed ='));
check('stat() lists all stats', (await dbg(() => window.dbg.stat())).includes('current stats above'));
check('stat() rejects unknown id', (await dbg(() => window.dbg.stat('swagger'))).includes('unknown stat'));
check('stat(id, n) overrides', (await dbg(() => window.dbg.stat('damageMult', 9))).includes('damageMult → 9'));
await dbg(() => window.dbg.give('coffeeBreak')); // triggers recompute — override must survive
check('stat override survives recompute', (await dbg(() => window.dbg.stat('damageMult'))).includes('= 9'));
check('stat(id, null) clears override', !(await dbg(() => window.dbg.stat('damageMult', null))).includes('= 9'));
check('stat(id, junk) rejected', (await dbg(() => window.dbg.stat('damageMult', 'lots'))).includes('usage'));

// speed(): read, set, clamp, reject
check('speed() reads multiplier', /sim speed: [\d.]+×/.test(await dbg(() => window.dbg.speed())));
check('speed(3) sets multiplier', (await dbg(() => window.dbg.speed(3))).includes('3×'));
check('speed(999) clamps to 20', (await dbg(() => window.dbg.speed(999))).includes('20×'));
check('speed(0) rejected', (await dbg(() => window.dbg.speed(0))).includes('usage'));
check('speed("fast") rejected', (await dbg(() => window.dbg.speed('fast'))).includes('usage'));
await dbg(() => window.dbg.speed(1)); // back to normal for the offer checks below

// Numeric params from the console aren't type-checked: a string like '6:00'
// must be rejected, not NaN-poison the run clock (draft bug 2026-06-12).
check('time() rejects a non-numeric arg', (await dbg(() => window.dbg.time('6:00'))).includes('usage'));
check('clock not NaN-poisoned after bad arg', (await dbg(() => window.dbg.time(6))).includes('6:00'));
check('xp() rejects a non-numeric arg', (await dbg(() => window.dbg.xp('lots'))).includes('usage'));
check('time() coerces a numeric string', (await dbg(() => window.dbg.time('7'))).includes('7:00'));

// unlock(): progressive-unlock reveal (codex/meta/all), bad arg rejected
check('unlock() reveals codex + meta', /codex \(\d+ entries\) \+ meta shop \(\d+ upgrades\)/.test(await dbg(() => window.dbg.unlock())));
check('unlock persists to the save', await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('debugger-save-v1') ?? '{}');
  return (s.encountered ?? []).includes('boss:kernelPanic') && (s.unlockedMeta ?? []).includes('shield');
}));
check('unlock(junk) rejected', (await dbg(() => window.dbg.unlock('everything'))).includes('usage'));

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
