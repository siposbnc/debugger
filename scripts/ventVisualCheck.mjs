// One-off: eyeball the Production Server map — palette + floor-vent cycle.
// Serve a `vite build --mode dev` output, then: node scripts/ventVisualCheck.mjs [url]
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// seed the save so ?autostart lands on the new map (loadSave merges over defaults)
await page.addInitScript(() => {
  localStorage.setItem('debugger-save-v1', JSON.stringify({
    unlockedMaps: ['greenfield', 'productionServer'],
    lastMap: 'productionServer',
  }));
});
await page.goto(`${BASE}/?autostart`);
await page.waitForFunction(() => typeof window.dbg === 'object');
await page.evaluate(() => window.dbg.god(true));
await page.waitForTimeout(6000); // staggered vents: some should be glowing/erupting
await page.screenshot({ path: 'scripts/vent-check-1.png' });
await page.waitForTimeout(3500); // ~1 cycle later, different phases
await page.screenshot({ path: 'scripts/vent-check-2.png' });
await browser.close();
console.log('screenshots → scripts/vent-check-1.png, vent-check-2.png');
