// One-off: eyeball the Production Server terrain slice — server-rack blockers
// (sprite, shadow, iso depth-sort vs enemies/player). Collision itself is
// asserted headlessly by scripts/terrainTest.ts; this is the art check.
// Serve a `vite build --mode dev` output, then: node scripts/terrainVisualCheck.mjs [url]
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
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
await page.waitForTimeout(3000);
await page.screenshot({ path: 'scripts/terrain-check-1.png' });

// wander for a few seconds so the camera passes racks from another side
// (depth-sort check: player/bugs should draw behind racks they're north of)
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' })));
await page.waitForTimeout(2600);
await page.evaluate(() => {
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
});
await page.waitForTimeout(2600);
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })));
await page.screenshot({ path: 'scripts/terrain-check-2.png' });
await browser.close();
console.log('screenshots → scripts/terrain-check-1.png, terrain-check-2.png');
