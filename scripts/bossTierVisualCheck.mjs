// One-off: eyeball the new unique finale bosses + their mechanics' visuals.
// Forces the run clock to 11:58 so the 12:00 unique finale spawns, screenshots
// each map a few seconds into the fight (slam telegraphs, freeze rings, pools).
// Serve a `vite build --mode dev` output, then: node scripts/bossTierVisualCheck.mjs [url]
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';
const MAPS = ['memoryMarsh', 'productionServer', 'cyberGlacier', 'greenfield'];

const browser = await chromium.launch();
for (const map of MAPS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript((m) => {
    localStorage.setItem('debugger-save-v1', JSON.stringify({
      unlockedMaps: ['greenfield', 'memoryMarsh', 'productionServer', 'cyberGlacier'],
      lastMap: m,
    }));
  }, map);
  await page.goto(`${BASE}/?autostart`);
  await page.waitForFunction(() => typeof window.dbg === 'object');
  // dbg.time takes MINUTES; jumping to 11.9 makes the scheduler catch up —
  // the missed slots (incl. the 12:00 unique finale) spawn back-to-back
  await page.evaluate(() => { window.dbg.god(true); window.dbg.time(11.9); });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `scripts/boss-finale-${map}.png` });
  await page.close();
}
await browser.close();
console.log('screenshots → scripts/boss-finale-<map>.png');
