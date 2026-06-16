// Visual check: credit HUD counter and the registry buy modal. Needs a served
// build:dev (vite preview), then:
//   node scripts/creditsVisualCheck.mjs http://[::1]:PORT
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4188';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await page.goto(`${BASE}/?autostart`);
await page.waitForFunction(() => typeof window.dbg !== 'undefined', { timeout: 10000 });
await page.waitForTimeout(800);

// 1. HUD credit counter (top-right, under bits)
await page.evaluate(() => { window.dbg.god(true); window.dbg.credits(12); });
await page.waitForTimeout(500);
await page.screenshot({ path: 'scripts/credits-hud.png' });

// 2. registry dropped on the player → buy modal opens on the next frame
await page.evaluate(() => window.dbg.registry(true));
await page.waitForTimeout(500);
const modalOpen = await page.evaluate(() => !!document.querySelector('.registry-title'));
const balance = await page.evaluate(() => document.querySelector('.credit-balance')?.textContent);
console.log('registry buy modal open:', modalOpen, '| balance shown:', balance);
await page.screenshot({ path: 'scripts/credits-modal.png' });

// 3. buy the cheapest item; balance should drop
const before = balance;
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.registry-list button[data-buy]')].find((b) => !b.disabled);
  btn?.click();
});
await page.waitForTimeout(300);
const after = await page.evaluate(() => document.querySelector('.credit-balance')?.textContent);
console.log('balance before/after buy:', before, '->', after);
await page.screenshot({ path: 'scripts/credits-modal-after-buy.png' });

await browser.close();
