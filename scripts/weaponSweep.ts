// Single-weapon balance sweep: every base weapon solo, measured over natural
// full runs (0:00 → 15:00) so the weapon's whole growth curve is visible.
//
//   npx esbuild scripts/weaponSweep.ts --bundle --platform=node --outfile=scripts/weaponSweep.cjs
//   node scripts/weaponSweep.cjs [samples=8] [--scaled] [--weapon=<id>]
//
// Each arm is a fresh mortal-greedy run (ada × greenfield) whose weapon pool is
// restricted to one weapon (replaceWeapons + poolOnly) — the bot levels it
// naturally (it is ~lv 3 by 6:00) and evolves it via boss chests. Checkpoints
// are read off the same runs instead of injecting cold mid-run states (v1 did,
// and measured cold-start recovery instead of weapon power):
//   early — first-boss TTK (the 2:00 slot), kill-rate crossover before 6:00
//           (alive pinned at the enemy cap), survival to 9:00
//   late  — evolution reached, victory, death time
// --scaled adds maxed meta (risk premiums must not compound with player
// scaling into late dominance — BALANCE.md §8).
//
// Declared design profiles live in BALANCE.md §8 — the PROFILES table here
// must mirror it. A weapon is an outlier relative to its profile, not the raw
// arm average.

import { BASE_WEAPONS, WEAPONS } from '../src/data/weapons';
import { MAX_ENEMIES } from '../src/data/enemies';
import { createScenarioRun, type Scenario } from '../src/game/scenario';
import { STEP, botStep, type BotOptions } from './simBot';

const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const samples = Number(pos[0] ?? 8);
const scaled = flags.includes('--scaled');
const weaponFilter = flags.find((f) => f.startsWith('--weapon='))?.slice(9);

// Mirror of BALANCE.md §8 — risk tier × growth profile per weapon.
// exempt: 'all' = solo bands don't apply (judged manually); 'wins' = the
// scaled win band doesn't apply (support/control identity — solo finale
// closure needs a partner weapon by design; kill floor + early bands still bind).
export const PROFILES: Record<string, {
  risk: 'low' | 'high';
  growth: 'early' | 'steady' | 'late';
  exempt?: 'all' | 'wins';
  note?: string;
}> = {
  syntaxWand:       { risk: 'low',  growth: 'early'  },
  deployHammer:     { risk: 'high', growth: 'steady' },
  assertBlades:     { risk: 'high', growth: 'late',  exempt: 'wins', note: 'defensive orbit — tops survival, no solo single-target finale burst (0/24 pooled scaled wins is identity, not a bug)' },
  garbageCollector: { risk: 'high', growth: 'steady' },
  regexGrimoire:    { risk: 'low',  growth: 'steady', exempt: 'wins', note: 'support chain — the evolution is a +25% damage-taken debuff, valueless solo' },
  stackStaff:       { risk: 'low',  growth: 'steady' },
  daemonFamiliar:   { risk: 'low',  growth: 'late',  exempt: 'wins', note: 'pet XP economy levels slowest solo, bloom band unreachable through this lens; binding metrics are the kill floor + scaled wins ≥ 1 of 8 (passes post-tune)' },
  breakpointBow:    { risk: 'low',  growth: 'early'  },
  forkBomb:         { risk: 'low',  growth: 'steady' },
  firewall:         { risk: 'high', growth: 'late'   },
  pingStorm:        { risk: 'low',  growth: 'late'   },
  sudoScroll:       { risk: 'low',  growth: 'steady', exempt: 'all', note: 'boss tool — no horde clear by design; judged on boss TTK' },
};

interface Sample {
  ttk: number | null;      // first boss: spawn → death, s
  pinned6: boolean;        // alive hit the cap before 6:00 (kill rate < spawn rate)
  lv6: number;             // weapon level at 6:00 (checkpoint sanity: ~lv 2–4)
  surv9: boolean;          // alive at 9:00
  evolved: boolean;
  victory: boolean;
  deathAt: number | null;  // s
  kills: number;
  bits: number;
}

// Brawl engagement range per contact-range weapon kind (world units).
const ENGAGE_R: Partial<Record<string, number>> = {
  orbit: 70, sweep: 85, shockwave: 95, wall: 75,
};

/** High-risk weapons are measured under brawl movement — that's what their
 *  risk tier means; a kiting bot faces away and reads them as ~zero DPS. */
function botFor(weaponId: string): BotOptions {
  const brawl = PROFILES[weaponId]?.risk === 'high';
  return {
    pick: 'greedy', mortal: true,
    style: brawl ? 'brawl' : 'kite',
    engageR: ENGAGE_R[WEAPONS[weaponId].kind] ?? 80,
  };
}

function runOne(weaponId: string): Sample {
  const sc: Scenario = {
    name: `solo ${weaponId} (natural run)`,
    char: 'ada',
    map: 'greenfield',
    weapons: { [weaponId]: 1 },
    replaceWeapons: true,
    poolOnly: true,
    meta: scaled ? 'max' : undefined,
    maxMinutes: 15,
    bot: { pick: 'greedy', mortal: true },
  };
  const bot = botFor(weaponId);
  // balance-sim policy (user 2026-06-12): terrain-free, see matrix.ts
  const run = createScenarioRun(sc, { noTerrain: true });
  run.invincible = false;

  let firstSpawnT: number | null = null, firstDieT: number | null = null;
  let pinned6 = false, lv6 = 0, surv9 = false;
  while (!run.over && run.time < 15 * 60) {
    run.update(STEP);
    botStep(run, bot);
    for (const ev of run.events) {
      if (ev.type === 'bossSpawn' && firstSpawnT === null) firstSpawnT = run.time;
      if (ev.type === 'bossDie' && firstDieT === null) firstDieT = run.time;
    }
    run.events.length = 0;
    if (run.time < 360 && run.enemies.length >= MAX_ENEMIES - 10) pinned6 = true;
    if (run.time < 361) lv6 = run.weapons[0]?.level ?? 0;
    if (run.time >= 540 && !surv9) surv9 = true;
  }
  return {
    ttk: firstSpawnT !== null && firstDieT !== null ? firstDieT - firstSpawnT : null,
    pinned6, lv6, surv9,
    evolved: run.evolvedCount > 0,
    victory: run.victory,
    deathAt: run.over && !run.victory ? run.time : null,
    kills: run.kills,
    bits: run.computeBits().bits,
  };
}

const median = (xs: number[]) => xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : NaN;
const medOf = (xs: (number | null)[], unit = 's') => {
  const k = xs.filter((x): x is number => x !== null);
  return k.length ? `${Math.round(median(k))}${unit}` : '—';
};
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const weapons = BASE_WEAPONS.map((w) => w.id).filter((id) => !weaponFilter || id === weaponFilter);
console.log(`weapon sweep v2 (natural solo runs): n=${samples}/arm, meta=${scaled ? 'MAX (scaled)' : 'zero'}, mortal greedy, ada × greenfield, 15:00`);

interface Row { weapon: string; s: Sample[] }
const rows: Row[] = [];
for (const id of weapons) {
  const s: Sample[] = [];
  for (let i = 0; i < samples; i++) s.push(runOne(id));
  rows.push({ weapon: id, s });
}

console.log('\nweapon            ttk(med)  pin≤6  lv@6  surv@9  evo    win    death(med)  kills(med)  bits(med)  profile');
for (const { weapon, s } of rows) {
  const p = PROFILES[weapon];
  console.log(
    weapon.padEnd(18) +
    medOf(s.map((x) => x.ttk)).padEnd(10) +
    `${s.filter((x) => x.pinned6).length}/${samples}`.padEnd(7) +
    `${median(s.map((x) => x.lv6))}`.padEnd(6) +
    `${s.filter((x) => x.surv9).length}/${samples}`.padEnd(8) +
    `${s.filter((x) => x.evolved).length}/${samples}`.padEnd(7) +
    `${s.filter((x) => x.victory).length}/${samples}`.padEnd(7) +
    (s.some((x) => x.deathAt !== null) ? fmtTime(median(s.map((x) => x.deathAt).filter((d): d is number => d !== null))) : '—').padEnd(12) +
    `${median(s.map((x) => x.kills))}`.padEnd(12) +
    `${median(s.map((x) => x.bits))}`.padEnd(11) +
    (p ? `${p.risk}-risk ${p.growth}${botFor(weapon).style === 'brawl' ? ' [brawl]' : ''}` : '?'),
  );
}

// ---- profile-relative flags (bands: BALANCE.md §8) ----
// Zero-meta solo arms only discriminate on kill rate + win dominance (nearly
// everything dies pre-9:00 at zero meta — that's the lens, not a bug); the
// survival / bloom / late-win bands bind on the --scaled arm, where maxed-meta
// survivability gives them dynamic range.
const flagsOut: string[] = [];
if (rows.length >= 2) {
  const winMed = median(rows.map((r) => r.s.filter((x) => x.victory).length));
  const winMax = Math.max(...rows.map((r) => r.s.filter((x) => x.victory).length));
  const killMed = median(rows.filter((r) => PROFILES[r.weapon]?.exempt !== 'all')
    .map((r) => median(r.s.map((x) => x.kills))));
  for (const { weapon, s } of rows) {
    const p = PROFILES[weapon];
    if (!p) { flagsOut.push(`${weapon}: no declared profile (add to BALANCE.md §8 + PROFILES)`); continue; }
    if (p.exempt === 'all') continue;
    const surv9 = s.filter((x) => x.surv9).length;
    const wins = s.filter((x) => x.victory).length;
    const evolvedN = s.filter((x) => x.evolved).length;
    const kills = median(s.map((x) => x.kills));
    // catastrophic-floor check (both arms): a weapon contributing <25% of the
    // arm's median kills isn't weak, it's non-functional
    if (kills < killMed * 0.25) {
      flagsOut.push(`${weapon} (${p.risk}/${p.growth}): kill floor miss — ${kills} median kills vs arm median ${killMed} (<25%)`);
    }
    // early performers must not also dominate the late checkpoint (both arms)
    if (p.growth === 'early' && wins === winMax && winMax > 0) {
      const second = Math.max(...rows.filter((x) => x.weapon !== weapon).map((x) => x.s.filter((y) => y.victory).length));
      if (wins > second + 1) {
        flagsOut.push(`${weapon} (${p.risk}/${p.growth}): early performer DOMINATES late checkpoint (${wins}/${samples} vs next ${second}/${samples})`);
      }
    }
    if (!scaled) continue; // survival/bloom/win bands bind on the scaled arm
    const floor = p.growth === 'late' ? Math.ceil(samples * 0.25) : Math.ceil(samples * 0.5);
    if (surv9 < floor) {
      flagsOut.push(`${weapon} (${p.risk}/${p.growth}): EARLY ${p.growth === 'late' ? 'floor' : 'band'} miss (scaled) — survived 9:00 in ${surv9}/${samples} (need ≥${floor})`);
    }
    if (p.exempt === 'wins') continue; // support/control identity: see PROFILES note
    if (p.growth === 'late' && evolvedN < Math.ceil(samples * 0.5)) {
      flagsOut.push(`${weapon} (${p.risk}/${p.growth}): never blooms (scaled) — evolved in only ${evolvedN}/${samples}`);
    }
    if (wins < winMed - 2) {
      flagsOut.push(`${weapon} (${p.risk}/${p.growth}): LATE band miss (scaled) — ${wins}/${samples} wins vs arm median ${winMed}`);
    }
  }
}

console.log('\n=== FLAGS (profile-relative, bands per BALANCE.md §8) ===');
console.log(flagsOut.length ? flagsOut.map((f) => '⚠ ' + f).join('\n') : 'all weapons within their declared profiles');
