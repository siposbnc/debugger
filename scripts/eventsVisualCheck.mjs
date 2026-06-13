// Visual check for in-run field events: terminal overlay (+ progress arc),
// nest sprite, spawn banner and far-spawn edge marker. Needs a served
// build:dev output:  npx vite preview --port 4173   then run this.
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(`${BASE}/?autostart`);
await page.waitForFunction(() => typeof window.dbg === 'object');
await page.waitForTimeout(1200);
await page.evaluate(() => { window.dbg.god(true); });

// 1. terminal dropped onto the player: banner + ring + reboot starts at once
console.log(await page.evaluate(() => window.dbg.event('terminal', true)));
await page.waitForTimeout(500);
await page.screenshot({ path: 'scripts/events-terminal.png' });

// 2. mid-reboot: green progress arc
await page.waitForTimeout(1600);
await page.screenshot({ path: 'scripts/events-terminal-progress.png' });
await page.waitForTimeout(3000); // completes (chest + TERMINAL REBOOTED banner)

// 3. nest nearby: sprite + spawn banner
console.log(await page.evaluate(() => window.dbg.event('nest', true)));
await page.waitForTimeout(600);
await page.screenshot({ path: 'scripts/events-nest.png' });

// 4. far spawn on a fresh run: edge-radar marker pointing off-screen
await page.goto(`${BASE}/?autostart`);
await page.waitForFunction(() => typeof window.dbg === 'object');
await page.waitForTimeout(1200);
await page.evaluate(() => { window.dbg.god(true); window.dbg.event('nest'); });
await page.waitForTimeout(500);
await page.screenshot({ path: 'scripts/events-marker.png' });

console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
