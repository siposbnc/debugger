// One-off check for the Skip→Defer rework: deferLevel() banks 20% of the next
// level's XP requirement, consumes a skip, never grants Bits-relevant xpCollected,
// and chains into a queued level-up when the bar was already ≥80%.
//
//   npx esbuild scripts/deferTest.ts --bundle --platform=node --outfile=scripts/deferTest.cjs
//   node scripts/deferTest.cjs

import { Run } from '../src/game/run';
import { CHARACTERS } from '../src/data/characters';
import { MAPS } from '../src/data/maps';
import { DEFAULT_WEAPON_POOL } from '../src/data/weapons';

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}

const mkRun = () => new Run(CHARACTERS.ada, MAPS.greenfield, { skip: 2 },
  [...new Set([...DEFAULT_WEAPON_POOL, CHARACTERS.ada.weapon])], new Set());

// 1. basic bank: +20% of the requirement, one skip consumed, no xpCollected
{
  const run = mkRun();
  const need = run.xpForLevel(run.level);
  const skipsBefore = run.skipsLeft;
  check('skips granted via meta mods', skipsBefore >= 1, `skipsLeft=${skipsBefore}`);
  const ok = run.deferLevel();
  check('deferLevel returns true with skips left', ok);
  check('banks exactly 20% of requirement', Math.abs(run.xp - need * 0.2) < 1e-9,
    `xp=${run.xp}, need=${need}`);
  check('consumes one skip', run.skipsLeft === skipsBefore - 1);
  check('does not count as collected XP', run.xpCollected === 0);
  check('does not level up below threshold', run.level === 1 && run.pendingLevelUps === 0);
}

// 2. chaining: at ≥80% of the bar, defer triggers the queued level-up
{
  const run = mkRun();
  const need = run.xpForLevel(run.level);
  run.xp = need * 0.85;
  run.deferLevel();
  check('defer at 85% chains a level-up', run.level === 2 && run.pendingLevelUps === 1,
    `level=${run.level}, pending=${run.pendingLevelUps}`);
  check('leftover xp carries over', Math.abs(run.xp - (need * 1.05 - need)) < 1e-9,
    `xp=${run.xp}`);
}

// 3. no skips left → no-op
{
  const run = mkRun();
  run.skipsLeft = 0;
  const ok = run.deferLevel();
  check('deferLevel refuses with 0 skips', !ok && run.xp === 0);
}

// 4. gainXp still applies xpMult and counts collected
{
  const run = mkRun();
  run.gainXp(10);
  const expected = 10 * run.stats.xpMult;
  check('gainXp unchanged (mult + collected)',
    Math.abs(run.xpCollected - expected) < 1e-9, `collected=${run.xpCollected}`);
}

console.log(failures === 0 ? '\nAll defer checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
