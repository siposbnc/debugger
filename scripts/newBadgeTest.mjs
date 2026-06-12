// NEW-badge verification: unseen codex/shop entries get a NEW tag on first
// view (cleared on the next visit), main-menu buttons carry a dot while their
// screen holds anything unseen, badges survive shop purchase re-renders, and
// completing an objective re-badges it. Serve a build:dev output first, then:
//   node scripts/newBadgeTest.mjs [url]
// Needs playwright (npm install --no-save playwright + npx playwright install chromium-headless-shell).
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';
const browser = await chromium.launch();
const page = await browser.newPage();

let failures = 0;
const check = (name, ok, detail = '') => {
  failures += ok ? 0 : 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const badgeCount = () => page.evaluate(() => document.querySelectorAll('.new-badge').length);
const dotOn = (act) => page.evaluate((a) => !!document.querySelector(`[data-act="${a}"] .new-dot`), act);
const clickBtn = async (sel) => { await page.click(sel); await page.waitForTimeout(150); };

await page.goto(BASE);
await page.waitForSelector('[data-act="start"]');

// --- fresh save: menu dots on both buttons ---
check('menu dot on UPGRADES (fresh save)', await dotOn('shop'));
check('menu dot on BUG DATABASE (fresh save)', await dotOn('codex'));

// --- first codex visit: everything badged; second visit: nothing ---
await clickBtn('[data-act="codex"]');
const codexBadges = await badgeCount();
check('first codex visit shows NEW badges', codexBadges > 10, `${codexBadges} badges`);
await clickBtn('[data-act="back"]');
check('codex menu dot cleared after visit', !(await dotOn('codex')));
check('shop menu dot still on', await dotOn('shop'));
await clickBtn('[data-act="codex"]');
check('second codex visit shows none', (await badgeCount()) === 0);
await clickBtn('[data-act="back"]');

// --- shop: badges on first visit, survive a purchase re-render ---
await page.evaluate(() => { window.dbg.bits(500); });
await clickBtn('[data-act="shop"]');
const shopBadges = await badgeCount();
check('first shop visit shows NEW badges', shopBadges > 5, `${shopBadges} badges`);
await page.click('.shop-row button:not([disabled])'); // buy the first affordable upgrade
await page.waitForTimeout(200);
const afterBuy = await badgeCount();
check('badges survive purchase re-render', afterBuy === shopBadges, `${shopBadges} → ${afterBuy}`);
await clickBtn('[data-act="back"]');
check('shop menu dot cleared after visit', !(await dotOn('shop')));
await clickBtn('[data-act="shop"]');
check('second shop visit shows none', (await badgeCount()) === 0);
await clickBtn('[data-act="back"]');

// --- completing an objective re-badges just that entry ---
await page.evaluate(() => {
  const save = JSON.parse(localStorage.getItem('debugger-save-v1'));
  const objId = save.seenIds.find((id) => id.startsWith('obj:') && !id.endsWith(':done')).slice(4);
  save.completedObjectives.push(objId);
  localStorage.setItem('debugger-save-v1', JSON.stringify(save));
});
await page.reload();
await page.waitForSelector('[data-act="start"]');
check('completed objective re-arms the codex dot', await dotOn('codex'));
await clickBtn('[data-act="codex"]');
const objBadges = await badgeCount();
const badgedDone = await page.evaluate(() =>
  !!document.querySelector('.codex-entry b.done .new-badge'));
check('exactly the completed objective is badged', objBadges === 1 && badgedDone, `${objBadges} badge(s)`);

await browser.close();
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
