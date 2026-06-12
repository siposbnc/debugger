# ⚖️ Balance goal sheet

Target numbers the simulator and the ROADMAP.md watchlist check against — the written-down
version of what used to be tribal knowledge. **If a balance change moves one of these numbers
on purpose, update this file in the same commit.** Where a target is marked *(provisional)*
it was set from limited sim samples and should be recalibrated by the v0.2 simulator-matrix
item; everything else is sim-verified or a user-set design goal.

How to measure (see CLAUDE.md for the full commands):

```bash
node scripts/simulate.cjs <char> <map> 15   # pacing, TTK, Bits — per-minute log
node scripts/offerTest.cjs                  # card offer distribution assertions
node scripts/deferTest.cjs                  # Defer (level-up skip) behavior checks
```

## 1. Combat pacing

| Metric | Target | Status |
|---|---|---|
| Kill rate vs spawn rate | kills/min ≥ spawns/min before **6:00** for every starting weapon | matrix-verified 2026-06-11 (after the Syntax Wand pierce buff): 0 cap-pinned samples for max/nia/linus, ada ~0–1 in 5 |
| First boss (2:00 Merge Conflict) TTK | **60–100 s** | **not met by the auto-pick bot in any config** (medians 117–653 s, best linus × greenfield ≈ 117 s) — first actual measurement 2026-06-11; open question whether boss HP, bot build quality, or the target itself is wrong (roadmap balance item) |
| Later bosses TTK | no target yet — must die before the next boss spawns (< 120 s) *(provisional)* | boss cadence is `BOSS_INTERVAL` = 120 s (`bossLogic.ts`) |
| Player death pressure | "would-be damage taken" in the sim should stay the same order of magnitude as the HP pool early (≤ ~10× pool by 5:00) *(provisional)* | sim bot is invincible; this is the only survivability proxy |

Enemy cap is 380 (`MAX_ENEMIES`, perf budget, not a balance lever). Difficulty scaling
formulas live in `difficulty()` in `src/data/enemies.ts`:
`hpMult = 1 + 0.24m + 0.015m²`, `damageMult = 1 + 0.11m`, `speedMult ≤ 1.35`,
spawn interval × `0.915^m` (m = minutes). Elites from 4:00, chance `0.015 + 0.008/min`.

## 2. Leveling curve

`xpForLevel(l) = round(10 + 7(l−1) + (l−1)^1.9)` (`run.ts`). Boss XP burst: 60 × (1 + 0.5·tier).

Checkpoint targets at luck/XP-meta 0, auto-pick *(all provisional — huge observed variance,
see §6)*:

| Time | Level (healthy run) |
|---|---|
| 5:00 | ≥ 7 |
| 10:00 | ≥ 12 |
| 15:00 | ≥ 20 |

Defer (level-up skip) banks 20% of the next level's requirement — raw XP, no `xpMult`,
not counted as collected. It must always be weaker than taking any card.

## 3. Card offers (verified by `offerTest.cjs` assertions)

Per-card tier rates at luck 0 — `RARITY_BASE` is per-tier, split across that tier's
available cards (`levelup.ts`):

| Tier | Rate per card slot |
|---|---|
| Common | 50% |
| Uncommon | 28% |
| Rare | 13% |
| Epic | 5% |
| **Legendary** | **1.4%** (measured 1.40%) |

Luck shifts weight: common ÷ (1 + 0.18·luck); rare/epic/legendary × (1 + 0.2/0.32/0.5·luck).

Repeat-pick penalty: stat card weight × `0.55^timesPicked` (floor 8% of base — can't bind
while maxStacks ≤ 5); weapon level-ups `70 × 0.85^currentLevel`. Verified ratios: twice-picked
card ≈ 0.31× base (≈ 0.55²); weapon-up share decays ~10.3% → ~5.3% from lv 1 → lv 6.
Tier rates must stay unchanged by the penalty (legendary ≈ 1.4%).

## 4. Bits economy

Per-run faucet (`computeBits()` in `run.ts`, × map `bitsMult`):
`10/min + 0.1/kill + 50/boss × bossRewardMult + 5/level + 100/objective` (objectives are
one-time, so no re-run inflation; the main growing faucet is boss kills, priced via the
`bossReward` meta).

| Band | Target ⌬ |
|---|---|
| Early runs (fresh save, deaths) | 300–700 |
| Strong 15:00 victory | 1500–2100 |
| Weak-variance 15:00 victory (0 bosses) | ~750–900 observed — below the early-run ceiling is acceptable only because objectives carry it |

Total shop cost: meta upgrades **9,425 ⌬** + characters 1,750 + weapons 1,550 + maps 3,700
(500 + 1,200 + 2,000) = **16,425 ⌬** → the original 25–35-run window was set against the
v0.2 12,875 ⌬ total; the v0.3 additions (Rex 350, Production Server 1,200, Cyber Glacier
2,000) sit on top and are earned at the higher ×1.5-map bands — re-check the runs-to-clear
window at the v0.3 band re-certification (roadmap "Meta shop depth check").

## 5. Difficulty certification (mortal-bot win rates)

The matrix can run a **mortal** bot (`--mortal`, survival kiting + real death) with pick
strategies (`--pick=first|greedy`) and meta power (`--meta=max`, or `"meta": "max"` in a
scenario preset). Survival must be decided by power, not movement: straggler recycling
(`spawner.ts`) makes the horde inescapable and heading-biased, and the quadratic
enemy-damage term makes an uncleaned wall lethal past ~min 8.

**Meta-gating is the core design (user directive 2026-06-12, DESIGN.md pillar 5):**
harder maps must be near-unwinnable at zero meta *even with a good in-run build*; meta
investment is what unlocks them. The lever is per-map `enemyScale` (enemy + boss
HP/damage; greenfield 1.0, memoryMarsh 1.2, productionServer 1.35, cyberGlacier 1.4).
The certification metric is the **meta gap**: zero-meta vs maxed-meta win rate on the
same good-build scenario. The old "marsh is build-gated, not meta-gated, by design"
ruling is **superseded** by this directive.

Certified 2026-06-12 (`build-good` / `build-good-meta` scenario presets — same lv 12 @
6:00 focused build, only meta differs; greedy continuation; n = 16/arm), after the same-day
card-tuning + boss-buff + crunch-punishment passes which lowered all absolute rates:

| Map (enemyScale) | good build, zero meta | good build, maxed meta | Target |
|---|---|---|---|
| greenfield (1.0) | **38%** (careless onward: 6%) | **69%** (careless onward: 38%) | zero ~30–50%, meta ≥ 60% |
| memoryMarsh (1.2) | **12.5%** | **56%** | zero ≤ 15%, meta ≥ 40% |
| productionServer (1.35) | **0%** | **50%** | zero ~0%, meta ≥ 40% |
| cyberGlacier (1.4) | **3%** (1/32) | **47%** (15/32) | zero ~0%, meta ≥ 40% |

Cyber Glacier certified 2026-06-12 at map ship (same presets, n = 32/arm, **greedy**).
Maxed-meta failures were 16 release-slips vs 1 death — the bot survives but the boss
queue outlives crunch, so boss TTK is the check, exactly like production. The latency
fields slow the horde as much as the player; the map's extra difficulty comes from
`enemyScale` 1.4 + the tank skew, not from the hazard cornering the kiter like marsh
pools do. **Methodology note:** the win rates in this table are greedy-bot numbers, but
the `build-good*` presets set `bot.pick: "first"` — always pass `--pick=greedy`
explicitly when re-certifying, or the rates come out ~3–4× lower (measured 12.5% vs 47%
on the glacier maxed arm) and aren't comparable to this table.

Reading the ladder: on the starter map, *either* meta or build/skill buys a fair shot and
both together make it comfortable; each next map shifts the requirement one notch toward
"both, and more meta". Bot rates understate humans (careless continuation, orbit kiting),
so absolute numbers are pessimistic — the gap shape is the target, not the exact values.
Dominant failure mode at high meta is now release-slip (bosses outliving crunch), not
death — boss TTK, not survival, is the late-game check. Re-run with:
`node scripts/matrix.cjs 16 --scenario=build-good[-meta] [--map=...] --pick=greedy`
(`--pick=greedy` is **required** for numbers comparable to this table — see the
methodology note below).

**In-run build-quality separation** (first certified 2026-06-12 pre-difficulty-overhaul,
n = 16/arm): the `build-good` / `build-scattered` / `build-none` scenario presets grant the
*same* XP position (ada lv 12 @ 6:00 = an 11-pick budget) and differ only in how the budget
was spent — focused offense (wand lv 6 + dmg/CDR cards) vs unfocused eco/utility cards vs
nothing. The original numbers (good 63% / greedy 94% on greenfield vs scattered & none 0%)
predate the difficulty overhaul; post-overhaul good-build rates are in the meta-gap table
above (38% / 6% greenfield zero-meta). The *separation* requirement stands: scattered and
no-build arms must stay ≤ 10% wherever the good build posts a meaningfully higher rate.
Caveat: lv 12 @ 6:00 sits slightly above the §2 invincible-bot curve (plausible for a skilled
human, generous for an average one); all arms share it, so the comparison is fair.

Re-run with:
`node scripts/matrix.cjs 16 --scenario=build-good` (also `--pick=greedy`, `--map=memoryMarsh`,
and the `build-scattered` / `build-none` arms).

Pre-fix baseline for the record: careless zero-meta bots won **83%** on greenfield by
running away forever (player 150 u/s outruns every enemy; the spawner stopped at the cap
and stragglers were never recycled — survival needed no kill rate at all).

## 6. Known outliers & open questions (re-check after every content change)

- **Assertion Blades + cooldown stacking** — strongest known combo; the checked-in
  `blades-cdr` scenario is the instrument (updated 2026-06-12 to the max *legal* CDR
  build under the new stack caps: rares ×3, epics ×2).
- **Exception Beetle density past 10:00** — explosion stacking.
- **ada auto-pick variance** — *root-caused 2026-06-11 by the matrix*: the Syntax Wand was
  the only zero-pierce, single-target starter, and ada's passive (+10% XP) adds no combat
  power, so weak card draws let the minute 3–6 swarm outrun her. Fixed with base pierce 1 +
  a pierce step at lv 3 (`weapons.ts`); post-fix medians match the other characters. Some
  variance remains inherent to the offer[0] bot.
- Boss kills are bimodal in sim (0 or several): once a boss outlives its 120 s slot, bosses
  stack and the run never recovers — TTK regressions show up as `bosses: 0`, not as slightly
  longer kills. Treat any 0-boss rate ≥ ~50% per config as a red flag *(provisional)*.
- **max's free-DPS floor**: turrets + 360° starter let a pickless max win 75% of mortal
  zero-meta runs (others 12–37%); turret life cut 10 s → 7 s brought him to 50% — still the
  strongest floor, watch after any turret/hammer change.
- **memoryMarsh at zero meta** is a 0%-win wall for careless mortal bots (hazard pools +
  swarm corner the kiter by ~min 4). *The earlier "build-gating, not meta-gating, by design"
  ruling is superseded (user directive 2026-06-12): marsh is now explicitly meta-gated via
  `enemyScale` 1.2 — a good zero-meta build wins only 12.5%, maxed meta 56% (§5 table).*
- **linus under-scales with meta** (maxed-meta careless: 3/8 greenfield, 0/8 marsh vs
  6–7/8 for others) — helpers don't benefit from most meta stats; check when characters
  get a balance pass.
