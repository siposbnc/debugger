// Verifies the level-up card stat preview ("dmg ×1.00 → ×1.08") and the
// cap-aware warnings: partially truncated results show the clamped number,
// fully wasted cards get a CAPPED badge + dimmed card. Drives the real UI
// through the dev console API, so this needs a served `npm run build:dev`
// output (window.dbg): node scripts/cardPreviewTest.mjs [url]
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4173';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/?autostart`);
await page.waitForFunction(() => !!window.dbg, null, { timeout: 5000 });
await page.waitForTimeout(400);

let failures = 0;
const check = (name, ok, detail = '') => {
  failures += ok ? 0 : 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const dbg = (expr) => page.evaluate(expr);
const openOffer = async (...ids) => {
  await page.evaluate((list) => window.dbg.offer(...list), ids);
  await page.waitForSelector('.upgrade-card', { timeout: 3000 });
  await page.waitForTimeout(120);
};
const cardInfo = () => page.evaluate(() => {
  const el = document.querySelector('.upgrade-card');
  return {
    capped: el.classList.contains('capped-card'),
    warning: el.querySelector('.cap-warning')?.textContent ?? null,
    lines: [...el.querySelectorAll('.stat-line')].map((l) => ({
      text: l.textContent.replace(/\s+/g, ' ').trim(),
      wasted: l.classList.contains('wasted'),
    })),
  };
});
const pick = async () => {
  await page.click('.upgrade-card');
  await page.waitForTimeout(150);
};

// --- plain stat card shows resulting value ---
await openOffer('hotfix'); // +8% damage
let info = await cardInfo();
check('stat preview rendered', info.lines.length === 1, JSON.stringify(info.lines));
check('shows current → resulting value', /Damage.*×\d.+→.+×\d/.test(info.lines[0]?.text ?? ''), info.lines[0]?.text);
check('not marked capped', !info.capped && !info.warning);
await pick();

// --- weapon-up cards show the concrete level delta (changed fields only) ---
await openOffer('syntaxWand'); // ada's starter at lv 1 → "Level 1 → 2" card
info = await cardInfo();
check('weapon-up preview rendered', info.lines.length > 0, JSON.stringify(info.lines));
check('weapon-up shows a damage delta', info.lines.some((l) => /Damage.*\d+ → \d+/.test(l.text)), JSON.stringify(info.lines));
check('unchanged weapon fields omitted', !info.lines.some((l) => /Pierce/.test(l.text)), JSON.stringify(info.lines));
await pick();

// --- new-weapon cards show the level-1 sheet (nonzero fields) ---
await openOffer('deployHammer'); // unowned → NEW WEAPON card
info = await cardInfo();
check('new-weapon preview shows lv-1 sheet', info.lines.some((l) => /Damage\s*\d+/.test(l.text)) && info.lines.some((l) => /Cooldown/.test(l.text)), JSON.stringify(info.lines));
await pick();

// --- partial truncation: result clamps at the 75% CDR cap (headroom pass) ---
// breakpointTrap ×5 + autoformat ×2 = 72% (dbg bypasses stack caps)
await dbg(() => { for (let i = 0; i < 5; i++) window.dbg.give('breakpointTrap'); window.dbg.give('autoformat', 2); });
// CDR now 12×5+6×2 = 72%; +12% would be 84% → preview must show the clamped −75%
await openOffer('breakpointTrap');
info = await cardInfo();
check('truncated result shows the cap', info.lines[0]?.text.includes('−75%'), info.lines[0]?.text);
check('partial waste is not CAPPED', !info.lines[0]?.wasted && !info.capped, JSON.stringify(info));
await pick(); // CDR raw 84% → resolved 75%

// --- fully wasted single-stat card: CAPPED badge + dimmed card ---
await openOffer('autoformat'); // +6% CDR on a capped stat
info = await cardInfo();
check('dead stat line marked CAPPED', info.lines[0]?.wasted && info.lines[0]?.text.includes('CAPPED'), info.lines[0]?.text);
check('card badged + dimmed', info.capped && (info.warning ?? '').includes('NO EFFECT'), JSON.stringify({ capped: info.capped, warning: info.warning }));
await pick(); // picking a dead card must still close the modal

// --- mixed card: capped stat wasted, live stat still previews ---
await openOffer('raceCondition'); // +16% CDR (dead) + 8% speed (live)
info = await cardInfo();
const dead = info.lines.filter((l) => l.wasted), live = info.lines.filter((l) => !l.wasted);
check('mixed card: cooldown line wasted', dead.length === 1 && dead[0].text.includes('Cooldown'), JSON.stringify(info.lines));
check('mixed card: speed line live', live.length === 1 && /Speed.+→/.test(live[0].text), JSON.stringify(live));
check('mixed card not fully capped', !info.capped && !info.warning);
await pick();

await browser.close();
console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
