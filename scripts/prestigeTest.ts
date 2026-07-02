// Prestige core (docs/PRESTIGE.md §8 stage 1) — the Legacy Token formula,
// shipAvailable gating, the shipRewrite reset/persist surgery (incl. kept
// meta), the Ship Bonus (+30% Bits line, +10% XP) on Run, cycle counters,
// and suspend/resume carrying the rewrite count.
//
//   npx esbuild scripts/prestigeTest.ts --bundle --platform=node --outfile=scripts/prestigeTest.cjs
//   node scripts/prestigeTest.cjs

import { Run } from '../src/game/run';
import { snapshotRun, restoreRun } from '../src/game/runSave';
import { legacyTokens, playerVersion, SHIP_BONUS_BITS_PER_REWRITE, SHIP_BONUS_XP_PER_REWRITE } from '../src/data/prestige';
import { tokensOnRewrite, shipAvailable, shipRewrite } from '../src/save/prestige';
import type { SaveData } from '../src/save/save';
import { CHARACTERS } from '../src/data/characters';
import { MAPS } from '../src/data/maps';
import { DEFAULT_WEAPON_POOL } from '../src/data/weapons';

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}

function fakeSave(over: Partial<SaveData> = {}): SaveData {
  return {
    version: 1, bits: 4200, metaLevels: { hp: 5, damage: 3 },
    unlockedCharacters: ['ada', 'rex'], unlockedMaps: ['greenfield', 'memoryMarsh', 'productionServer', 'cyberGlacier'],
    unlockedWeapons: ['forkBomb'], completedObjectives: ['survive15'],
    lastCharacter: 'rex', lastMap: 'cyberGlacier',
    lifetime: { runs: 40, kills: 9000, bossKills: 100, bitsEarned: 24000, bestTimeSec: 900, bestLevel: 30, victories: 8, uptimeSec: 30000, weaponDamage: {} },
    settings: { master: 1, sfx: 0.7, music: 0.5, shake: true, reduceFlash: false, playerHpBar: true, fpsCounter: false, minimap: true, keys: {} },
    seenIds: ['bug:syntaxMite'], encountered: ['bug:syntaxMite'], unlockedMeta: ['hp', 'damage'],
    mapVictories: { greenfield: 4, memoryMarsh: 2, productionServer: 1, cyberGlacier: 1 },
    endlessMode: true, endlessBest: { greenfield: 800 }, curses: ['moveFast'],
    rewrites: 0, legacyTokens: 0, tree: {}, cycleBits: 24000, cycleRuns: 40,
    cycleOvertimeBest: { greenfield: 360 }, keptMeta: [],
    lastSeenVersion: '0.4', suspendedRun: null,
    ...over,
  };
}

// --- 1. token formula ---
{
  const t = legacyTokens(4, 24000, 360);
  check('map tokens = 3 per cleared map', t.mapTokens === 12, `${t.mapTokens}`);
  check('bits tokens = floor(sqrt(bits/150))', t.bitsTokens === Math.floor(Math.sqrt(160)), `${t.bitsTokens}`);
  check('overtime tokens = floor(min/3)', t.overtimeTokens === 2, `${t.overtimeTokens}`);
  check('first-rewrite total lands in the calibrated ~24-28 band', t.total >= 24 && t.total <= 28, `${t.total}`);
  const quadrupled = legacyTokens(4, 96000, 360);
  check('4x bits ~doubles the bits term (diminishing returns)',
    Math.abs(quadrupled.bitsTokens - 2 * t.bitsTokens) <= 1, `${t.bitsTokens} → ${quadrupled.bitsTokens}`);
  check('playerVersion: fresh v1.0, two rewrites v3.0',
    playerVersion(0) === 'v1.0' && playerVersion(2) === 'v3.0');
}

// --- 2. shipAvailable gate ---
{
  check('available once glacier cleared this cycle', shipAvailable(fakeSave()));
  check('not available before the last map falls', !shipAvailable(fakeSave({ mapVictories: { greenfield: 4 } })));
}

// --- 3. shipRewrite: resets, persists, grants ---
{
  const save = fakeSave({ keptMeta: ['hp'] });
  const receipt = shipRewrite(save);
  check('tokens granted match the preview', save.legacyTokens === receipt.tokens.total && receipt.tokens.total > 0);
  check('receipt ships the next version', receipt.version === 'v2.0');
  check('rewrites incremented', save.rewrites === 1);
  // resets
  check('shop reset except kept meta', Object.keys(save.metaLevels).join(',') === 'hp' && save.metaLevels.hp === 5);
  check('bits wiped', save.bits === 0);
  check('licenses wiped', save.unlockedWeapons.length === 0);
  check('maps back to greenfield', save.unlockedMaps.join(',') === 'greenfield' && save.lastMap === 'greenfield');
  check('characters back to ada', save.unlockedCharacters.join(',') === 'ada' && save.lastCharacter === 'ada');
  check('per-map wins reset (endless re-locks)', Object.keys(save.mapVictories).length === 0);
  check('pre-run toggles reset', !save.endlessMode && save.curses.length === 0);
  check('cycle counters reset', save.cycleBits === 0 && save.cycleRuns === 0 && Object.keys(save.cycleOvertimeBest).length === 0);
  // persists
  check('codex/objectives/records persist',
    save.encountered.length === 1 && save.completedObjectives.length === 1
    && save.lifetime.bitsEarned === 24000 && save.endlessBest.greenfield === 800);
  check('shop reveals persist', save.unlockedMeta.length === 2);
  check('ship again from zero grants nothing', shipRewrite(fakeSave({ mapVictories: {}, cycleBits: 0, cycleOvertimeBest: {} })).tokens.total === 0);
}

// --- 4. Ship Bonus on Run ---
{
  const pool = [...new Set([...DEFAULT_WEAPON_POOL, CHARACTERS.ada.weapon])];
  const plain = new Run(CHARACTERS.ada, MAPS.greenfield, {}, pool, new Set(), { noTerrain: true });
  const shipped = new Run(CHARACTERS.ada, MAPS.greenfield, {}, pool, new Set(), { noTerrain: true, rewrites: 2 });
  check('+10% XP per rewrite', Math.abs(shipped.stats.xpMult / plain.stats.xpMult - 1.2) < 1e-9,
    `${(shipped.stats.xpMult / plain.stats.xpMult).toFixed(3)}`);
  plain.kills = shipped.kills = 500; plain.time = shipped.time = 300;
  const rp = plain.computeBits(), rs = shipped.computeBits();
  const line = rs.bitsBreakdown.find((b) => b.label.startsWith('Ship Bonus'));
  check('Ship Bonus breakdown line present (+60% at 2 rewrites)', !!line && line.label.includes('60%'), line?.label);
  check('shipped run pays ~1.6x plain', Math.abs(rs.bits / rp.bits - (1 + 2 * SHIP_BONUS_BITS_PER_REWRITE)) < 0.02,
    `${(rs.bits / rp.bits).toFixed(3)}`);
  check('plain run has no Ship Bonus line', !rp.bitsBreakdown.some((b) => b.label.startsWith('Ship Bonus')));
  check('XP constant sanity', SHIP_BONUS_XP_PER_REWRITE === 0.1);
  // suspend/resume carries the bonus
  const restored = restoreRun(JSON.parse(JSON.stringify(snapshotRun(shipped))), new Set());
  check('resume keeps the rewrite count', restored.rewrites === 2);
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
