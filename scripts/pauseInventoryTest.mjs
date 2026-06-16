// Check for the pause-screen inventory (card-reuse redesign 2026-06-13):
// weapons render with the level-up `.upgrade-card` design — name, level in the
// rarity label, damage tally in the tagline, resolved effective() stats as
// stat-preview lines — plus open-slot placeholders up to weaponSlots, and
// proof the stats show effective() values (global mults applied), not raw rows.
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
  await page.waitForSelector('.pause-inventory .upgrade-card.inv-weapon', { timeout: 4000 });
  return page.$$eval('.pause-inventory .upgrade-card.inv-weapon:not(.empty)', (els) => els.map((el) => {
    const stats = {};
    el.querySelectorAll('.stat-preview .stat-line').forEach((line) => {
      const label = line.querySelector('span:not(.v)')?.textContent?.trim() ?? '';
      const val = line.querySelector('.v')?.textContent?.trim() ?? '';
      if (label) stats[label] = val;
    });
    return {
      name: el.querySelector('h3')?.textContent?.trim() ?? '',
      level: el.querySelector('.rarity')?.textContent?.trim() ?? '',
      dmg: el.querySelector('.tagline')?.textContent?.trim() ?? '',
      desc: el.querySelector('.desc')?.textContent?.trim() ?? '',
      stats,
    };
  }));
};
const statNum = (w, label) => (label in w.stats ? parseFloat(w.stats[label]) : NaN);

// --- pass 1: structure at neutral mults ---
const w1 = await readWeapons();
check(w1.length === 3, `3 weapon cards rendered (starter + 2 given) — got ${w1.length}`);
check(w1.every((w) => w.desc.length > 0), 'every card has a description');
const empties = await page.$$eval('.pause-inventory .upgrade-card.inv-weapon.empty', (els) => els.length);
check(empties === 1, `open-slot placeholder fills to weaponSlots (4 slots − 3 weapons = 1, got ${empties})`);
const fork1 = w1.find((w) => w.name.includes('Fork Bomb'));
const zip = w1.find((w) => w.name.includes('Zip Bomb'));
check(!!fork1 && fork1.level.includes('LV 3'), `Fork Bomb card shows LV 3 in the rarity label — got "${fork1?.level}"`);
check(!!zip && zip.level.includes('EVOLVED'), `Zip Bomb card shows EVOLVED — got "${zip?.level}"`);
check(!!fork1 && /\/s/.test(fork1.dmg), 'damage/DPS tally present in the tagline');
check(w1.every((w) => 'Damage' in w.stats && 'Cooldown' in w.stats), 'Damage + Cooldown stat lines on every weapon');
check(!!fork1 && !('Slow' in fork1.stats), 'zero-valued fields omitted (no Slow line on Fork Bomb)');

const d1 = statNum(fork1, 'Damage');
const c1 = statNum(fork1, 'Cooldown');
check(Number.isFinite(d1) && d1 > 0, `Fork Bomb damage stat parses (${d1})`);
check(Number.isFinite(c1) && c1 > 0, `Fork Bomb cooldown stat parses (${c1}s)`);

// --- pass 2: global mults must move the shown numbers ---
await page.keyboard.press('Escape'); // resume
await page.waitForTimeout(150);
await page.evaluate(() => {
  window.dbg.stat('damageMult', 2);
  window.dbg.stat('cooldownFactor', 0.5);
});
const w2 = await readWeapons();
const fork2 = w2.find((w) => w.name.includes('Fork Bomb'));
const d2 = statNum(fork2, 'Damage');
const c2 = statNum(fork2, 'Cooldown');
check(Math.abs(d2 - d1 * 2) <= 1, `damageMult ×2 doubles the Damage stat (${d1} → ${d2})`);
check(Math.abs(c2 - c1 / 2) <= 0.01, `cooldownFactor 0.5 halves the Cooldown stat (${c1}s → ${c2}s)`);

check(errors.length === 0, `no page errors${errors.length ? `: ${errors[0]}` : ''}`);

await browser.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail === 0 ? 0 : 1);
