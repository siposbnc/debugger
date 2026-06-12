// One-off: progressive codex + meta-shop unlocks.
// Serve a `vite build --mode dev` output, then: node scripts/progressiveUnlocksTest.mjs [url]
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗ FAIL'} ${name}`); };

const browser = await chromium.launch();

// --- 1. fresh save: everything locked, Precipitate unlisted, shop all ??? ---
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(BASE);
  await page.click('button[data-act="codex"]');
  check('fresh codex has locked rows', await page.locator('.codex-entry.locked').count() > 0);
  check('fresh codex reveals no bug names', !(await page.content()).includes('Syntax Mite'));
  check('Precipitate unlisted (not even locked)', !(await page.content()).includes('Precipitate'));
  await page.screenshot({ path: 'scripts/unlocks-codex-fresh.png' });
  await page.click('button[data-act="back"]');
  await page.click('button[data-act="shop"]');
  const lockedMeta = await page.locator('.shop-row.locked').count();
  check('fresh shop: all 14 meta rows are ???', lockedMeta === 14);
  check('fresh shop hides upgrade names', !(await page.content()).includes('Sharper Semicolons'));
  await page.screenshot({ path: 'scripts/unlocks-shop-fresh.png' });
  await page.close();
}

// --- 2. seeded save: partial reveals render unlocked ---
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => {
    localStorage.setItem('debugger-save-v1', JSON.stringify({
      encountered: ['bug:syntaxMite', 'boss:mergeConflict'],
      unlockedMeta: ['damage'],
      completedObjectives: ['boss1'],
      metaLevels: { hp: 2 },
    }));
  });
  await page.goto(BASE);
  await page.click('button[data-act="codex"]');
  const html = await page.content();
  check('seeded codex shows Syntax Mite', html.includes('Syntax Mite'));
  check('seeded codex shows Merge Conflict', html.includes('The Merge Conflict'));
  check('seeded codex keeps others locked', await page.locator('.codex-entry.locked').count() > 0);
  await page.click('button[data-act="back"]');
  await page.click('button[data-act="shop"]');
  const shopHtml = await page.content();
  check('card-revealed meta visible (damage)', shopHtml.includes('Sharper Semicolons'));
  check('purchased meta visible (hp lvl 2)', shopHtml.includes('Hardened Hardware'));
  check('objective-derived meta visible (bossReward)', shopHtml.includes('Bug Bounty Program'));
  check('weaponSlot still ??? (no evolve objective)', !shopHtml.includes('Extra Dev Environment'));
  await page.screenshot({ path: 'scripts/unlocks-shop-seeded.png' });
  await page.close();
}

// --- 3. live pipeline: run encounters persist via suspend; card hint shows ---
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${BASE}/?autostart`);
  await page.waitForFunction(() => typeof window.dbg === 'object');
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.dbg.god(true); window.dbg.xp(60); });
  await page.waitForSelector('.upgrade-card', { timeout: 5000 });
  check('level-up card shows unlock hint (fresh save)', await page.locator('.unlock-hint').count() > 0);
  await page.screenshot({ path: 'scripts/unlocks-card-hint.png' });
  // take cards until no level-up modal remains (xp grant can queue several)
  while (await page.locator('.upgrade-card').count() > 0) {
    await page.locator('.upgrade-card').first().click();
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape'); // pause
  await page.waitForTimeout(400);
  await page.click('button[data-act="suspend"]'); // suspend & exit -> records encounters
  await page.waitForTimeout(400);
  await page.click('button[data-act="codex"]');
  check('post-suspend codex reveals an encountered bug', (await page.content()).includes('Syntax Mite'));
  await page.screenshot({ path: 'scripts/unlocks-codex-after-run.png' });
  await page.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
