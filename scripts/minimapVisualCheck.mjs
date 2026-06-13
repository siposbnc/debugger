// Visual check for the minimap: bottom-right radar with horde dots, the
// field-event glyph, and a rim-clamped boss square — directions must agree
// with the edge-radar markers. Needs a served build:dev output.
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(`${BASE}/?autostart`);
await page.waitForFunction(() => typeof window.dbg === 'object');
await page.waitForTimeout(2500); // let a small horde gather
await page.evaluate(() => { window.dbg.god(true); });

// 1. baseline: radar + horde dots
await page.screenshot({ path: 'scripts/minimap-horde.png' });

// 2. far event: # glyph on the radar; its direction must match the edge marker
console.log(await page.evaluate(() => window.dbg.event('nest')));
await page.waitForTimeout(400);
await page.screenshot({ path: 'scripts/minimap-event.png' });

// 3. boss (2:00 spawn): big colored square, rim-clamped while far
await page.evaluate(() => { window.dbg.time(2); });
await page.waitForTimeout(2500); // warning banner → spawn
await page.screenshot({ path: 'scripts/minimap-boss.png' });

console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
