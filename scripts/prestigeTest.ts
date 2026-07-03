// Prestige (docs/PRESTIGE.md §8 stages 1–3) — stage 1: the Legacy Token
// formula, shipAvailable gating, the shipRewrite reset/persist surgery, the
// Ship Bonus on Run, cycle counters, suspend/resume. Stage 2: tree node
// costs, treePerks resolution, Warm Boot / Severance / Persistent Config /
// Preflight / Compound Interest / Continuous Learning / Time Dilation.
// Stage 3: Dash, Restore Point, Sudo Mode.
//
//   npx esbuild scripts/prestigeTest.ts --bundle --platform=node --outfile=scripts/prestigeTest.cjs
//   node scripts/prestigeTest.cjs

import { Run } from '../src/game/run';
import { snapshotRun, restoreRun } from '../src/game/runSave';
import {
  legacyTokens, playerVersion, SHIP_BONUS_BITS_PER_REWRITE, SHIP_BONUS_XP_PER_REWRITE,
  PRESTIGE_NODES, PRESTIGE_NODE_BY_ID, nodeCost, nodeMaxRank, treePerks, NO_PERKS,
  SEVERANCE_BITS, GAME_SPEEDS,
} from '../src/data/prestige';
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
  // kept meta requires the Persistent Config node — the slot clamp is real now
  const save = fakeSave({ keptMeta: ['hp'], tree: { persistentConfig: 1 } });
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

// --- 5. tree node costs (stage 2) ---
{
  const wb = PRESTIGE_NODE_BY_ID['warmBoot'];
  check('finite node cost ladder (Warm Boot 5/10/18)',
    nodeCost(wb, 0) === 5 && nodeCost(wb, 1) === 10 && nodeCost(wb, 2) === 18);
  check('finite node maxes out', nodeCost(wb, 3) === null && nodeMaxRank(wb) === 3);
  const ci = PRESTIGE_NODE_BY_ID['compoundInterest'];
  check('repeatable node: 5 + 2/rank, no cap',
    nodeCost(ci, 0) === 5 && nodeCost(ci, 1) === 7 && nodeCost(ci, 10) === 25 && nodeMaxRank(ci) === Infinity);
  const finiteTotal = PRESTIGE_NODES.reduce((a, n) => a + n.costs.reduce((x, y) => x + y, 0), 0);
  check('finite stage-2/3 tree costs ~290 (§8 ~330 incl. stage-4 levers)',
    finiteTotal >= 260 && finiteTotal <= 310, `${finiteTotal}`);
}

// --- 6. treePerks resolution (stage 2) ---
{
  check('empty tree resolves neutral',
    NO_PERKS.startLevel === 1 && NO_PERKS.startBits === 0 && NO_PERKS.keptMetaSlots === 0
    && NO_PERKS.evolveEarly === 0 && NO_PERKS.bitsMult === 1 && NO_PERKS.xpMult === 1
    && NO_PERKS.maxGameSpeed === 1 && NO_PERKS.dash === null && NO_PERKS.revives === 0 && NO_PERKS.sudo === null);
  const p = treePerks({
    warmBoot: 2, severance: 3, persistentConfig: 2, preflight: 1,
    compoundInterest: 4, continuousLearning: 2, timeDilation: 1,
  });
  check('Warm Boot rank 2 → start level 3', p.startLevel === 3);
  check('Severance rank 3 → 3000 starting bits', p.startBits === SEVERANCE_BITS[3] && p.startBits === 3000);
  check('Persistent Config rank 2 → 2 kept slots', p.keptMetaSlots === 2);
  check('Preflight → evolutions one level early', p.evolveEarly === 1);
  check('Compound Interest 4 → bits ×1.12', Math.abs(p.bitsMult - 1.12) < 1e-9);
  check('Continuous Learning 2 → xp ×1.06', Math.abs(p.xpMult - 1.06) < 1e-9);
  check('Time Dilation rank 1 → 1.25× ceiling', p.maxGameSpeed === GAME_SPEEDS[1]);
  const d1 = treePerks({ dash: 1 }).dash!, d3 = treePerks({ dash: 3 }).dash!, d5 = treePerks({ dash: 5 }).dash!;
  check('Dash ranks: 1 = base, 2–3 = +i-frames, 4–5 = −1s cd',
    d1.cooldown === 4 && Math.abs(d1.iframes - 0.18) < 1e-9
    && d3.cooldown === 4 && Math.abs(d3.iframes - 0.42) < 1e-9
    && d5.cooldown === 2 && Math.abs(d5.iframes - 0.42) < 1e-9);
  const s1 = treePerks({ sudo: 1 }).sudo!, s3 = treePerks({ sudo: 3 }).sudo!;
  check('Sudo ranks: 3s/75s → 4s/60s', s1.duration === 3 && s1.cooldown === 75 && s3.duration === 4 && s3.cooldown === 60);
  check('Restore Point ranks = revives', treePerks({ restorePoint: 2 }).revives === 2);
  check('over-rank tree entries clamp', treePerks({ warmBoot: 99, preflight: 5 }).startLevel === 4);
}

// --- 7. passive nodes on Run (stage 2) ---
{
  const pool = [...new Set([...DEFAULT_WEAPON_POOL, CHARACTERS.ada.weapon])];
  const warm = new Run(CHARACTERS.ada, MAPS.greenfield, {}, pool, new Set(),
    { noTerrain: true, perks: treePerks({ warmBoot: 3 }) });
  check('Warm Boot: run starts at level 4 with 3 picks owed', warm.level === 4 && warm.pendingLevelUps === 3);

  const learned = new Run(CHARACTERS.ada, MAPS.greenfield, {}, pool, new Set(),
    { noTerrain: true, rewrites: 1, perks: treePerks({ continuousLearning: 2 }) });
  const plain = new Run(CHARACTERS.ada, MAPS.greenfield, {}, pool, new Set(), { noTerrain: true });
  check('Continuous Learning stacks with Ship Bonus XP',
    Math.abs(learned.stats.xpMult / plain.stats.xpMult - 1.1 * 1.06) < 1e-9,
    `${(learned.stats.xpMult / plain.stats.xpMult).toFixed(4)}`);

  const rich = new Run(CHARACTERS.ada, MAPS.greenfield, {}, pool, new Set(),
    { noTerrain: true, perks: treePerks({ compoundInterest: 3 }) });
  rich.kills = plain.kills = 500; rich.time = plain.time = 300;
  const rr = rich.computeBits(), rp = plain.computeBits();
  const line = rr.bitsBreakdown.find((b) => b.label.startsWith('Compound Interest'));
  check('Compound Interest breakdown line (+9%)', !!line && line.label.includes('9%'), line?.label);
  check('Compound Interest pays ~1.09×', Math.abs(rr.bits / rp.bits - 1.09) < 0.02, `${(rr.bits / rp.bits).toFixed(3)}`);

  // Preflight: a boss chest evolves a level-7 weapon (gate is levels.length - 1)
  const mkChestRun = (preflight: boolean) => {
    const r = new Run(CHARACTERS.ada, MAPS.greenfield, {}, pool, new Set(),
      { noTerrain: true, perks: preflight ? treePerks({ preflight: 1 }) : undefined });
    r.weapons[0].level = r.weapons[0].def.levels.length - 1; // one below max
    r.pickups.push({ kind: 'chest', x: r.px, y: r.py, value: 0, magnet: false, vx: 0, vy: 0 });
    r.update(1 / 60);
    return r;
  };
  const pre = mkChestRun(true), base = mkChestRun(false);
  check('Preflight Check: chest evolves at level 7', pre.weapons[0].def.isEvolution === true);
  check('without Preflight the same chest gives the bonus card instead',
    !base.weapons[0].def.isEvolution && base.chestBonus);

  // suspend/resume carries the perks
  const restored = restoreRun(JSON.parse(JSON.stringify(snapshotRun(warm))), new Set());
  check('resume keeps the tree perks', restored.perks.startLevel === 4);
}

// --- 8. Severance + Persistent Config through shipRewrite (stage 2) ---
{
  const save = fakeSave({ tree: { severance: 2, persistentConfig: 1 }, keptMeta: ['hp', 'damage'] });
  shipRewrite(save);
  check('Severance rank 2: new cycle starts with 1500 bits', save.bits === 1500);
  check('keptMeta clamped to owned slots (1)',
    save.keptMeta.join(',') === 'hp' && Object.keys(save.metaLevels).join(',') === 'hp');
  const noTree = fakeSave();
  shipRewrite(noTree);
  check('no tree: bits reset to 0, nothing kept', noTree.bits === 0 && Object.keys(noTree.metaLevels).length === 0);
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
