// One-off smoke test for the WebGL2 renderer: loads ?autostart&turbo, fails on
// page errors / GL fallback, fast-forwards into late-game density, screenshots.
//   node scripts/glSmoke.mjs [url]
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
const warnings = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
  if (m.type() === 'warning') warnings.push(m.text());
});

await page.goto(`${BASE}/?autostart&turbo`);
await page.waitForFunction(() => typeof window.dbg === 'object');
await page.waitForTimeout(1500);

const usingGl = await page.evaluate(() => {
  const c = document.getElementById('game');
  // a 2d-context canvas returns null for webgl2 and vice versa
  return c.getContext('webgl2') !== null;
});
console.log(usingGl ? 'PASS world canvas is WebGL2' : 'FAIL world canvas is not WebGL2');

await page.screenshot({ path: 'scripts/.smoke-early.png' });

// fast-forward to minute 9 (dense spawns) and let turbo run a while
await page.evaluate(() => { window.dbg.time(9); window.dbg.god(true); });
await page.waitForTimeout(12000);
await page.screenshot({ path: 'scripts/.smoke-late.png' });

const fps = await page.evaluate(() => new Promise((res) => {
  let frames = 0;
  const t0 = performance.now();
  const tick = () => { frames++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res(frames / 2); };
  requestAnimationFrame(tick);
}));
console.log(`fps over 2s (headless swiftshader — not representative of real GPUs): ${fps.toFixed(0)}`);

const glFellBack = warnings.some((w) => w.includes('falling back to Canvas2D'));
console.log(glFellBack ? 'FAIL GL init fell back to Canvas2D' : 'PASS no Canvas2D fallback');
if (errors.length) {
  console.log(`FAIL ${errors.length} page error(s):`);
  for (const e of errors.slice(0, 10)) console.log('  ' + e);
} else {
  console.log('PASS no page errors');
}

await browser.close();
process.exit(usingGl && !glFellBack && errors.length === 0 ? 0 : 1);
