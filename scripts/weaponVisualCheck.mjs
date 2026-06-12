// One-off: eyeball the v0.3 weapons — fork-bomb lob/forks, firewall lines,
// DMZ ring, ping-storm packets, sudo smite column.
// Serve a `vite build --mode dev` output, then: node scripts/weaponVisualCheck.mjs [url]
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';
const SETS = [
  ['bases', ['forkBomb', 'firewall', 'pingStorm', 'sudoScroll']],
  ['evos', ['zipBomb', 'dmz', 'ddos', 'rootShell']],
];

const browser = await chromium.launch();
for (const [label, weapons] of SETS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${BASE}/?autostart`);
  await page.waitForFunction(() => typeof window.dbg === 'object');
  await page.evaluate((ws) => {
    window.dbg.god(true);
    window.dbg.time(5); // density up
    for (const w of ws) window.dbg.give(w, w === 'zipBomb' || w === 'dmz' ? 1 : 6);
  }, weapons);
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `scripts/weapons-${label}.png` });
  await page.close();
}
await browser.close();
console.log('screenshots → scripts/weapons-bases.png, weapons-evos.png');
