// One-off: eyeball the Cyber Glacier map — palette + latency-field rendering
// (ice sheet, crystals, stuttering ping ring) + player slow inside a field.
// Serve a `vite build --mode dev` output, then: node scripts/glacierVisualCheck.mjs [url]
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// seed the save so ?autostart lands on the new map (loadSave merges over defaults)
await page.addInitScript(() => {
  localStorage.setItem('debugger-save-v1', JSON.stringify({
    unlockedMaps: ['greenfield', 'cyberGlacier'],
    lastMap: 'cyberGlacier',
  }));
});
await page.goto(`${BASE}/?autostart`);
await page.waitForFunction(() => typeof window.dbg === 'object');
await page.evaluate(() => window.dbg.god(true));
await page.waitForTimeout(4000);
await page.screenshot({ path: 'scripts/glacier-check-1.png' });
await page.waitForTimeout(2500); // ping rings should be at different steps
await page.screenshot({ path: 'scripts/glacier-check-2.png' });
await browser.close();
console.log('screenshots → scripts/glacier-check-1.png, glacier-check-2.png');
