// One-off: banner texts must render above the level-up screen's blur layer
// (draft bug 2026-06-12 batch 16). Serve a `vite build --mode dev` output, then:
//   node scripts/bannerLayerTest.mjs [url]
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';

let failures = 0;
const check = (name, ok, detail = '') => {
  failures += ok ? 0 : 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${BASE}/?autostart`);
await page.waitForFunction(() => typeof window.dbg === 'object');

await page.evaluate(() => window.dbg.god(true));
// time() takes minutes; 1.91 min = 114.6s — boss warning banner fires at 115s
// (120 - 5s lead) and lasts 4s
await page.evaluate(() => window.dbg.time(1.91));
await page.waitForTimeout(800); // banner now on screen
await page.evaluate(() => window.dbg.xp(2000)); // forces a level-up → modal opens
await page.waitForSelector('.levelup-wrap', { timeout: 5000 });
await page.waitForTimeout(300); // modal fade-in settles; banner has ~2.5s left

// Structural: banner canvas sits above the UI layer and below scanlines
const z = await page.evaluate(() => ({
  ui: Number(getComputedStyle(document.getElementById('ui')).zIndex),
  banners: Number(getComputedStyle(document.getElementById('banners')).zIndex),
  scan: Number(getComputedStyle(document.getElementById('scanlines')).zIndex),
}));
check('banner layer above UI, below scanlines', z.ui < z.banners && z.banners < z.scan, JSON.stringify(z));

// The banner canvas actually has the banner painted on it right now
const painted = await page.evaluate(() => {
  const c = document.getElementById('banners');
  const d = c.getContext('2d').getImageData(0, 0, c.width, Math.floor(c.height * 0.4)).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
});
check('banner pixels present above the modal', painted > 500, `${painted} non-transparent px`);

await page.screenshot({ path: 'scripts/banner-over-blur.png' });
console.log('screenshot → scripts/banner-over-blur.png');

await browser.close();
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
