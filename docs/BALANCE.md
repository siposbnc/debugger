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
see §5)*:

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

Total shop cost: meta upgrades **9,425 ⌬** + characters 1,400 + weapons 1,550 + map 500 =
**12,875 ⌬** → at the target bands a full clear lands in the user-set **25–35 runs** window
(avg ~370–515 ⌬/run blended).

## 5. Known outliers & open questions (re-check after every content change)

- **Assertion Blades + cooldown stacking** — strongest known combo; needs a checked-in
  scenario once the sim-scenarios tooling exists.
- **Exception Beetle density past 10:00** — explosion stacking.
- **ada auto-pick variance** — *root-caused 2026-06-11 by the matrix*: the Syntax Wand was
  the only zero-pierce, single-target starter, and ada's passive (+10% XP) adds no combat
  power, so weak card draws let the minute 3–6 swarm outrun her. Fixed with base pierce 1 +
  a pierce step at lv 3 (`weapons.ts`); post-fix medians match the other characters. Some
  variance remains inherent to the offer[0] bot.
- Boss kills are bimodal in sim (0 or several): once a boss outlives its 120 s slot, bosses
  stack and the run never recovers — TTK regressions show up as `bosses: 0`, not as slightly
  longer kills. Treat any 0-boss rate ≥ ~50% per config as a red flag *(provisional)*.
