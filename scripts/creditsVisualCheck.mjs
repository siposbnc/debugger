// Verifies the credits feedback fixes: gold HUD counter (always shown,
// value-first), the registry buy modal (gold value-first balance), one-use
// consume-on-purchase, and Escape closing WITHOUT pausing. Needs a served
// build:dev, then: node scripts/creditsVisualCheck.mjs http://[::1]:PORT
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://[::1]:4188';
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`${BASE}/?autostart`);
await page.waitForFunction(() => typeof window.dbg !== 'undefined', { timeout: 10000 });
await page.evaluate(() => { window.dbg.god(true); window.dbg.credits(12); });
await page.waitForTimeout(500);
await page.screenshot({ path: 'scripts/credits-hud.png' });

// open the registry buy modal
await page.evaluate(() => window.dbg.registry(true));
await page.waitForTimeout(500);
const bal = await page.evaluate(() => document.querySelector('.credit-balance')?.textContent?.trim());
check('balance is value-first with a space (e.g. "12 ©")', /^\d+ ©$/.test(bal || ''), bal);
await page.screenshot({ path: 'scripts/credits-modal.png' });

// one-use: buy the first affordable item → modal closes + registry consumed
const creditsBefore = await page.evaluate(() => window.dbg.pos() && null) ; // noop to ensure dbg ready
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.registry-list button[data-buy]')].find((b) => !b.disabled);
  btn?.click();
});
await page.waitForTimeout(400);
const modalGone = await page.evaluate(() => !document.querySelector('.registry-title'));
check('one purchase closes the modal', modalGone);
// registry is consumed → re-walking in cannot reopen (dbg.registry refuses while live;
// here it should succeed because the old one is gone, proving consumption)
const reopened = await page.evaluate(() => window.dbg.registry(true));
check('registry was consumed on purchase', !reopened.includes('already live'), reopened);

// Escape closes the registry WITHOUT pausing
await page.waitForTimeout(400); // let the just-opened registry's prompt fire
const open2 = await page.evaluate(() => !!document.querySelector('.registry-title'));
check('registry modal reopened for esc test', open2);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const afterEsc = await page.evaluate(() => ({
  modal: !!document.querySelector('.registry-title'),
  paused: document.body.textContent.includes('execution paused'),
}));
check('Escape closes the registry', !afterEsc.modal);
check('Escape does NOT pause the game', !afterEsc.paused, JSON.stringify(afterEsc));

// Lint Pass: buying the random-stat option opens a 3-card picker (fresh run —
// the Esc test above left a registry live on the field, blocking a new one)
await page.goto(`${BASE}/?autostart`);
await page.waitForFunction(() => typeof window.dbg !== 'undefined', { timeout: 10000 });
await page.evaluate(() => { window.dbg.god(true); window.dbg.credits(10); window.dbg.registry(true); });
await page.waitForTimeout(400);
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.registry-list .shop-row')];
  const lint = rows.find((r) => r.textContent.includes('Lint Pass'));
  lint?.querySelector('button[data-buy]')?.click();
});
await page.waitForTimeout(400);
const picker = await page.evaluate(() => ({
  title: document.querySelector('.levelup-title')?.textContent?.trim() ?? '',
  cards: document.querySelectorAll('.card-row .upgrade-card').length,
}));
check('Lint Pass opens a picker', picker.title.includes('LINT PASS'), picker.title);
check('picker offers 3 stat upgrades', picker.cards === 3, `${picker.cards}`);
await page.screenshot({ path: 'scripts/credits-lintpass.png' });
await page.evaluate(() => document.querySelector('.card-row .upgrade-card')?.click());
await page.waitForTimeout(300);
const afterPick = await page.evaluate(() => !document.querySelector('.levelup-wrap'));
check('picking a stat upgrade closes the picker', afterPick);

await browser.close();
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
