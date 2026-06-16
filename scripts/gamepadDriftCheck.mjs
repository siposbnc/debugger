// Verifies the phantom-drift fix: a NON-standard gamepad with a resting axis
// must NOT move the player; a STANDARD one still must. Needs a served
// build:dev, then: node scripts/gamepadDriftCheck.mjs http://[::1]:PORT
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://[::1]:4188';
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function driftWith(mapping) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  await page.addInitScript((m) => {
    const fake = {
      id: 'Test pad', index: 0, connected: true, mapping: m, timestamp: 0,
      axes: [0, 1.0, 0, 0], // axis 1 (standard = left-stick Y) resting at +1 = "down"
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    navigator.getGamepads = () => [fake];
  }, mapping);
  await page.goto(`${BASE}/?autostart`);
  await page.waitForFunction(() => typeof window.dbg !== 'undefined', { timeout: 10000 });
  await page.evaluate(() => window.dbg.god(true));
  await page.waitForTimeout(300);
  const a = await page.evaluate(() => window.dbg.pos());
  await page.waitForTimeout(1200); // no keys pressed; only the fake pad acts
  const b = await page.evaluate(() => window.dbg.pos());
  await browser.close();
  return Math.round(b.y - a.y);
}

const stdDrift = await driftWith('standard');
check('standard pad axis still drives movement (positive control)', stdDrift > 100, `Δy=${stdDrift}`);

const nonStdDrift = await driftWith('');
check('non-standard pad no longer injects phantom down', Math.abs(nonStdDrift) < 5, `Δy=${nonStdDrift}`);

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
