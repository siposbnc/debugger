// Verifies the credits/registry UI: gold value-first balance, multiple
// purchases per visit, consume-on-close, Escape closing WITHOUT pausing, and
// the Lint Pass picker. Needs a served build:dev, then:
//   node scripts/creditsVisualCheck.mjs http://[::1]:PORT
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

// multiple purchases per visit: buying a normal item keeps the modal open
const balAfterBuy = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.registry-list button[data-buy]')].find((b) => !b.disabled);
  btn?.click();
  return document.querySelector('.credit-balance')?.textContent?.trim();
});
await page.waitForTimeout(200);
const stillOpen = await page.evaluate(() => !!document.querySelector('.registry-title'));
check('a purchase keeps the registry open (multiple buys per visit)', stillOpen);
check('balance dropped after the purchase', balAfterBuy !== bal, `${bal} → ${balAfterBuy}`);

// closing after a purchase consumes the registry (one use)
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const afterEsc = await page.evaluate(() => ({
  modal: !!document.querySelector('.registry-title'),
  paused: document.body.textContent.includes('execution paused'),
}));
check('Escape closes the registry', !afterEsc.modal);
check('Escape does NOT pause the game', !afterEsc.paused, JSON.stringify(afterEsc));
const consumed = await page.evaluate(() => window.dbg.registry(true)); // succeeds only if the old one is gone
check('used registry is consumed on close', !consumed.includes('already live'), consumed);

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
// after picking, the same visit returns to the registry for more purchases
const afterPick = await page.evaluate(() => document.querySelector('.registry-title')?.textContent?.trim() ?? '');
check('picking a stat upgrade returns to the registry', afterPick.includes('PACKAGE REGISTRY'), afterPick);

await browser.close();
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
