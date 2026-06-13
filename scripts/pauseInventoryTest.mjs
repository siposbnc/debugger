// Check for the pause-screen inventory (primary-pane redesign 2026-06-13):
// per-weapon cards (name, level pips/EVO tag, damage tally, desc, resolved
// stat chips), open-slot placeholders up to weaponSlots, and proof the chips
// show effective() values (global mults applied), not raw table rows.
// Needs a served build:dev output (dbg required):
//   npx vite build --mode dev && npx vite preview   then   node scripts/pauseInventoryTest.mjs [url]
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

let pass = 0, fail = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`);
  ok ? pass++ : fail++;
};

await page.goto(`${BASE}/?autostart`);
await page.waitForFunction(() => typeof window.dbg === 'object');
await page.waitForTimeout(800); // let the run actually start

await page.evaluate(() => {
  window.dbg.god(true);
  window.dbg.give('forkBomb');
  window.dbg.level('forkBomb', 3);
  window.dbg.give('zipBomb'); // isEvolution — should render the EVO tag
  window.dbg.stat('damageMult', 1);
  window.dbg.stat('cooldownFactor', 1);
});

const readWeapons = async () => {
  await page.keyboard.press('Escape');
  await page.waitForSelector('.pause-inventory .inv-card', { timeout: 4000 });
  return page.$$eval('.pause-inventory .inv-card:not(.empty)', (els) => els.map((el) => ({
    name: el.querySelector('.inv-title b')?.textContent?.trim() ?? '',
    level: el.querySelector('.inv-title .pips')?.textContent?.trim() ?? '',
    pipsOn: el.querySelectorAll('.pip.on').length,
    dmg: el.querySelector('.inv-dmg')?.textContent?.trim() ?? '',
    desc: el.querySelector('.wpn-desc')?.textContent?.trim() ?? '',
    chips: [...el.querySelectorAll('.wpn-stats .wstat')].map((c) => c.textContent.trim()),
  })));
};
const chipNum = (w, label) => {
  const c = w.chips.find((t) => t.startsWith(label));
  return c ? parseFloat(c.slice(label.length).trim()) : NaN;
};

// --- pass 1: structure at neutral mults ---
const w1 = await readWeapons();
check(w1.length === 3, `3 weapon cards rendered (starter + 2 given) — got ${w1.length}`);
check(w1.every((w) => w.desc.length > 0), 'every card has a description');
const empties = await page.$$eval('.pause-inventory .inv-card.empty', (els) => els.length);
check(empties === 1, `open-slot placeholder fills to weaponSlots (4 slots − 3 weapons = 1, got ${empties})`);
const fork1 = w1.find((w) => w.name.includes('Fork Bomb'));
const zip = w1.find((w) => w.name.includes('Zip Bomb'));
check(!!fork1 && fork1.level.includes('Lv 3') && fork1.pipsOn === 3, 'Fork Bomb card shows Lv 3 with 3 pips lit');
check(!!zip && zip.level.includes('EVO'), 'Zip Bomb card shows EVO tag');
check(!!fork1 && /\/s/.test(fork1.dmg), 'damage/DPS tally present on the card');
check(w1.every((w) => w.chips.some((c) => c.startsWith('Damage')) && w.chips.some((c) => c.startsWith('Cooldown'))), 'Damage + Cooldown chips on every weapon');
check(!!fork1 && !fork1.chips.some((c) => c.startsWith('Slow')), 'zero-valued fields omitted (no Slow chip on Fork Bomb)');

const d1 = chipNum(fork1, 'Damage');
const c1 = parseFloat((fork1.chips.find((t) => t.startsWith('Cooldown')) ?? '').replace('Cooldown', ''));
check(Number.isFinite(d1) && d1 > 0, `Fork Bomb damage chip parses (${d1})`);
check(Number.isFinite(c1) && c1 > 0, `Fork Bomb cooldown chip parses (${c1}s)`);

// --- pass 2: global mults must move the shown numbers ---
await page.keyboard.press('Escape'); // resume
await page.waitForTimeout(150);
await page.evaluate(() => {
  window.dbg.stat('damageMult', 2);
  window.dbg.stat('cooldownFactor', 0.5);
});
const w2 = await readWeapons();
const fork2 = w2.find((w) => w.name.includes('Fork Bomb'));
const d2 = chipNum(fork2, 'Damage');
const c2 = parseFloat((fork2.chips.find((t) => t.startsWith('Cooldown')) ?? '').replace('Cooldown', ''));
check(Math.abs(d2 - d1 * 2) <= 1, `damageMult ×2 doubles the Damage chip (${d1} → ${d2})`);
check(Math.abs(c2 - c1 / 2) <= 0.01, `cooldownFactor 0.5 halves the Cooldown chip (${c1}s → ${c2}s)`);

check(errors.length === 0, `no page errors${errors.length ? `: ${errors[0]}` : ''}`);

await browser.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail === 0 ? 0 : 1);
