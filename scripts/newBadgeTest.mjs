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

// --- fresh save: dots reflect progressive unlocks (codex has NOTHING to
// badge before anything is encountered — objectives moved to their own menu
// 2026-06-12, so the codex dot starts dark) ---
check('menu dot on SHOP (fresh save)', await dotOn('shop'));
check('no codex dot on a fresh save (nothing encountered)', !(await dotOn('codex')));
check('menu dot on OBJECTIVES (fresh save)', await dotOn('objectives'));

// --- fresh codex: every entry locked/glitched → no badges ---
await clickBtn('[data-act="codex"]');
check('fresh codex shows no badges (all locked)', (await badgeCount()) === 0);
await clickBtn('[data-act="back"]');
check('shop menu dot still on', await dotOn('shop'));

// --- shop tabs: badges per tab on first VIEW, survive purchase re-renders,
// menu dot holds until every tab has been opened (tabs added 2026-06-13) ---
await page.evaluate(() => { window.dbg.bits(500); });
await clickBtn('[data-act="shop"]');
// default tab = stat upgrades: on a fresh save every meta row is a locked ???
// (excluded from badge ids), so nothing badges here
check('meta tab (default): no badges on a fresh save', (await badgeCount()) === 0);
const tabDot = (t) => page.evaluate((x) => !!document.querySelector(`[data-tab="${x}"] .new-dot`), t);
check('unviewed tabs carry dots', (await tabDot('weapons')) && (await tabDot('chars')));
await clickBtn('[data-tab="weapons"]');
const wpnBadges = await badgeCount();
check('license tab badges on first view', wpnBadges > 0, `${wpnBadges} badges`);
await clickBtn('[data-tab="chars"]');
const chrBadges = await badgeCount();
check('character tab badges on first view', chrBadges > 5, `${chrBadges} badges`);
await page.click('.shop-row button:not([disabled])'); // hire the first affordable character
await page.waitForTimeout(200);
const afterBuy = await badgeCount();
check('badges survive purchase re-render', afterBuy === chrBadges, `${chrBadges} → ${afterBuy}`);
check('viewed tabs dropped their dots', !(await tabDot('weapons')) && !(await tabDot('chars')));
await clickBtn('[data-act="back"]');
check('shop menu dot cleared after all tabs viewed', !(await dotOn('shop')));
await clickBtn('[data-act="shop"]');
await clickBtn('[data-tab="weapons"]');
await clickBtn('[data-tab="chars"]');
check('second shop visit shows none', (await badgeCount()) === 0);
await clickBtn('[data-act="back"]');

// --- completing an objective re-badges just that entry (objectives menu) ---
await clickBtn('[data-act="objectives"]'); // first visit marks obj: ids seen
await clickBtn('[data-act="back"]');
await page.evaluate(() => {
  const save = JSON.parse(localStorage.getItem('debugger-save-v1'));
  const objId = save.seenIds.find((id) => id.startsWith('obj:') && !id.endsWith(':done')).slice(4);
  save.completedObjectives.push(objId);
  localStorage.setItem('debugger-save-v1', JSON.stringify(save));
});
await page.reload();
await page.waitForSelector('[data-act="start"]');
check('completed objective re-arms the OBJECTIVES dot', await dotOn('objectives'));
await clickBtn('[data-act="objectives"]');
const objBadges = await badgeCount();
const badgedDone = await page.evaluate(() =>
  !!document.querySelector('.codex-entry b.done .new-badge'));
check('exactly the completed objective is badged', objBadges === 1 && badgedDone, `${objBadges} badge(s)`);

await browser.close();
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
