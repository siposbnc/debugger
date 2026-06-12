# 🗺️ DEBUGGER — Roadmap

> **This is the single source of truth for what to build next and what's done.**
> Claude: read this file at the start of every work session, pick up the highest-priority
> unchecked item (unless told otherwise), and check items off here when they're complete.
> Human: edit freely — reorder, add, remove, re-prioritize. Whatever this file says, goes.

## How to use this file

- `- [ ]` = not started · `- [x]` = done · `- [~]` = in progress / partially done
- Tags: `[P1]` blocks this milestone's release — sessions work these first. `[P2]` ships if done by release, otherwise rolls into the next milestone. `[P3]` someday — auto-demoted to the Backlog at release unless explicitly promoted. `(S/M/L)` = rough effort (hours / a day / multi-day).
- Items inside a milestone are roughly ordered top-to-bottom by priority.
- New ideas go to the **💡 Backlog** at the bottom first; promote them into a milestone when committed.
- **Idea intake:** raw ideas are scribbled in [docs/DRAFT.md](docs/DRAFT.md). Claude refines them, integrates them here, then moves them under the "Processed" section of the draft. Don't work directly from the draft.
- **On release** (trigger: **all `[P1]` items in the milestone checked** — the cut is then mechanical, not a judgment call): cut `release/X.Y` from `dev` (drop the `-dev` suffix there, tag, point `main` at it — full policy in CLAUDE.md), then **move the milestone section out of this file into [CHANGELOG.md](CHANGELOG.md)** — rewritten as a clean release entry (what shipped, past tense; note anything dropped/deferred). Unchecked `[P2]`s move into the next milestone; unchecked `[P3]`s drop to the Backlog (promote explicitly to save one). Then bump `dev` to the next minor `-dev` and tag that bump commit `vX.Y-base` (+ push the tag) — the version's patch counter restarts from it. The roadmap only tracks unshipped work; history lives in the changelog. Hotfixes on `release/X.Y` bump the shown version automatically (commit-count patch number).
- Detailed design rationale lives in [docs/DESIGN.md](docs/DESIGN.md); the original brief is `Debugger_Game_Design_Brief.md`. This file tracks **execution**, those track **intent**.

---

## 🔧 v0.2 — Polish & QoL  ← **current milestone**

Goal: the game v0.1 already is, but friendlier, smoother and more informative.
No new content — only feel, clarity and robustness.

### UX / readability
- [x] [P1] (M) Pause menu upgrade: detailed current-run overview — not just "paused":
  - player stat sheet (all current StatMods, resolved values)
  - taken cards list (grouped, with counts)
  - per-weapon total damage + DPS (requires per-weapon damage tracking — shared with run-end breakdown below)
  - current card odds (rarity chances incl. luck, repeat penalties once implemented)
  — *done: 4 panels (~/player, ~/weapons, ~/cards, ~/card_odds). Damage credited per WeaponInstance via `hitEnemy` source (carries through evolution); turret/helper damage shown as "Allies". Odds computed from the live `candidates()` weights so they include luck, banishes and max stacks; repeat penalties will show up automatically once implemented. Sim now prints per-weapon damage/DPS at run end.*
- [x] [P1] (S) Damage-number cap / merge when >40 on screen (legibility past minute 10) — *done: above 40 numbers, new damage merges into the nearest live number (value accumulates, crit upgrades, life refreshed); falls back to recycling the oldest slot*
- [x] [P1] (S) Off-screen boss indicator arrow (boss alive but out of view) — *done: pulsing edge marker in boss color (⚠ disc + rim arrowhead), clamped below the XP bar; handles multiple bosses incl. split halves*
- [x] [P1] (S) Show version number on the main menu — *done: `__APP_VERSION__` injected from package.json via Vite `define`, rendered bottom-right (`.version-tag`); single source of truth, follows the release version bump automatically*
- [x] [P1] (S) Run summary split: objectives/achievements block visually separated (divider) from the itemized Bits-by-stat breakdown — *done: `.summary-divider` ("BITS BREAKDOWN" label + rule) between run stats/objectives and the per-stat rows*
- [x] [P1] (S) Health bar above the player character (toggleable in settings, default on) — *done: 34px bar above the sprite, green → red below 35% HP (matches HUD threshold); `settings.playerHpBar` toggle in ~/.debuggerrc, pure field addition so old saves need no migration*
- [x] [P1] (S) Confirm before **KILL PROCESS** (abandon run) — two-step: first activate arms the button (`SIGKILL — ARE YOU SURE?`), second confirms; disarms on focus move or ~2s timeout. Must work identically for mouse, keyboard and gamepad (it's one kbnav activate away from a dead run) — *promoted 2026-06-11: run-loss safety, effectively a latent bug now that kbnav/gamepad ship* — *done: armed state lives on the button's click handler, which all three inputs share (kbnav `activate()` dispatches a real click); disarm via `.kb-focus` MutationObserver (covers kb/pad nav + mouse hover-away) and 2s timer; pulsing red `.armed` style. Verified by `scripts/pauseGuardTest.mjs` (arm text, no-kill on arm, timeout + focus-move disarm, keyboard arm/confirm)*
- [x] [P1] (S) Card tooltips in level-up modal: show resulting stat ("dmg 34 → 38"), not just "+8%" — **and warn when the stat is already capped** so dead picks are visible before buying: `computeStats()` hard-clamps cooldown (60% CDR) and crit chance (100%); if a card's mod would be fully wasted, badge it ("CAPPED", dimmed value), if partially wasted show the truncated result. Derive from the same clamps in `stats.ts` (compute stats with the card hypothetically applied and diff) — don't duplicate cap constants in the UI — *promoted 2026-06-11: highest informative-value-per-hour item left; directly the milestone goal* — *done exactly as specified: `cardStatPreview()` in menus.ts diffs `computeStats(…, [...cardMods, card.mods])` against live stats per mod key (`STAT_VIEW` mapping), so all clamps + floors are inherited; per-line "cur → new" rows, CAPPED mark on dead lines, fully dead cards dim with "⚠ ALREADY AT CAP — NO EFFECT". Verified by `scripts/cardPreviewTest.mjs` (11 checks via dev console forced offers: normal, weapon-card-no-preview, truncated-at-cap, fully capped, mixed) + screenshot*
- [x] [P1] (S) Heal feedback: green floating number + brief glow on the player whenever HP is restored (coffee, Heap Purifier, regen ticks ≥1) — *done: new `heal` RunEvent emitted from `healPlayer()` (the single chokepoint all three sources flow through); `healAccum` pools sub-1HP regen ticks into whole "+N" numbers (~1/s per HP/s regen) and full-HP heals emit nothing, so regen can't spam. Renderer: green bold "+N" via the damage-number system (excluded from the >40 merge so enemy damage can't fold in) + ~0.35s green tint/glow on the sprite (hurt flash wins if both active). Verified: build clean, 15-min ada sim victory 1850 ⌬ in band*
- [x] [P1] (M) Stop a run and resume later — *done: "SUSPEND PROCESS" on the pause menu snapshots the full run (player, build, cards, live enemies incl. boss state, pickups, zones, allies, boss schedule; projectiles dropped as sub-second transients) into `save.suspendedRun` (`src/game/runSave.ts`, pure-addition save field — no migration). Main menu shows "RESUME RUN — char @ time"; the snapshot is consumed on resume (death can't be reload-scummed) and kept across new runs until then. Restore throws on unknown content ids (version drift) → caller discards instead of resuming corrupt state. Verified by `scripts/suspendTest.ts` (24 Node round-trip checks: fidelity, Infinity-life marsh pools through JSON, continued sim, drift rejection) + `scripts/suspendUiTest.mjs` (11 Playwright checks: suspend → cold reload → resume continuity → consumption)*
- [ ] [P2] (M) Minimap or edge-radar showing boss, elites, chests
- [x] [P1] (S) Bug database: render entity sprite thumbnails next to entries (sprites are procedural — draw to offscreen canvas once, cache) — *done: the renderer's baked sprite canvases (`bugSprite`/`bossSprite`, already cached) are converted to data-URL `<img>`s once via a static `UI.entityThumb` cache; bugs use the base (non-elite) sprite, bosses get a slightly larger box. `.codex-entry.with-thumb` flex layout, stats/objectives panels untouched. Verified: build clean + Playwright (13/13 thumbs loaded, screenshot)*
- [x] [P1] (S) Bug database: lifetime player stats page — accumulated uptime, total kills, total Bits earned, runs played, victories, bosses slain, favorite weapon — *done: the codex `~/stats` panel already had kills/Bits/runs/victories/bosses; added the two untracked fields as pure save additions (no migration): `lifetime.uptimeSec` (sums every run's clock at end) and `lifetime.weaponDamage` (per-weapon-id lifetime damage; evolved weapons credit the evolution). New rows: "Accumulated uptime" (`formatDuration`: 3h 24m style) + "Favorite weapon" (highest lifetime damage, icon + name, "—" until first damage). Verified e2e via Playwright (abandoned 10s run → uptimeSec=10, syntaxWand damage recorded, both rows render)*
- [x] [P1] (S) Settings accessible from the pause screen *(from draft 2026-06-12)* — *done: SETTINGS button on the pause overview opens the existing settings screen with a back-target param (BACK → pause overview, not main menu); Esc/P/Start/B while paused now route through `pauseBack()` — settings → pause screen → resume, one step per press (kbnav stays out of Esc while paused, same rule as the pause screen itself). The save-wipe row is hidden when opened mid-run (wiping under a live run is undefined). Verified via Playwright flow test*
- [ ] [P1] (S) In-game FPS counter overlay (toggle in settings, default off) — also gives the FPS-safeguard item (Robustness) something visible to verify against
- [ ] [P1] (S) "NEW" badge in codex/shop for unseen entries — *demoted 2026-06-11: cosmetic, no gameplay/clarity stakes; re-promoted 2026-06-12 by user as part of the v0.2 release scope*
- [ ] [P1] (S) Run-end screen: show per-weapon damage breakdown (cheap now — per-weapon tracking already exists from the pause-menu item)

### Controls & accessibility
- [x] [P1] (M) Keyboard navigation in **all** menus + card selection (WASD/arrows + Enter/Space, Esc = back) — do this first, it's the foundation gamepad menu support reuses — *done: `src/ui/kbnav.ts` — spatial (geometry-based) roving highlight, works on every screen incl. level-up cards, shop, sliders (←/→ adjust) and pause; focus survives screen re-renders (purchase/reroll); gamepad can drive `move()`/`activate()` directly. Esc backs out of menus / cancels banish mode; pause keeps Esc/P in the main loop to avoid double-toggle. Verified end-to-end with a Playwright run-through (menus, buy, level-up pick, abandon, summary)*
- [x] [P1] (M) Gamepad support (move + menu navigation, standard mapping) — *done: standard-mapping pad polled once per frame in `core/input.ts`; left stick (analog, deadzone 0.35) + d-pad merge into `moveVector()` (magnitude preserved, clamped to 1 with keyboard), stick/d-pad drive the kbnav highlight with key-style delayed repeat, A = activate, B = back (and resume from pause), Start = pause toggle. Slider adjust moved into `KbNav.move()` so pads adjust volume too. Verified headless via `scripts/padTest.mjs` (Playwright + stubbed `getGamepads`): 10/10 checks — menu nav, submenu enter/back, run start, pause/resume*
- [ ] [P2] (S) Remappable keys in settings
- [ ] [P2] (S) Volume sliders split: master / music / SFX (currently single toggle-ish)
- [ ] [P2] (S) Reduce-flash mode (tone down screen flash + shake for photosensitivity)
- [ ] [P1] (M) Touch controls (virtual stick) — unlocks mobile browser play

### Robustness & tech debt
- [x] [P1] (S) Save-data versioning + migration shim (before any content patch changes shapes) — *done: `SAVE_VERSION` + stepwise `MIGRATIONS[n]` (n → n+1) run before the defaults merge; pure field additions still need no migration. Newer-than-current saves pass through untouched and unknown fields survive a persist round-trip (safe downgrade). Verified with a Node localStorage-stub test (legacy, future-version, corrupt saves)*
- [x] [P1] (S) `npm run build` + `tsc --noEmit` clean check wired into a pre-commit or CI script — *done: both. `.githooks/pre-commit` runs `tsc --noEmit` (fast, no bundling), activated dependency-free via npm `prepare` → `git config core.hooksPath .githooks` (runs on every `npm install`); verified it blocks a type error. `.github/workflows/ci.yml` runs the full build + offerTest assertions + a 5-min sim smoke on push/PR to dev/main. New `npm run check` = bare type check*
- [x] [P1] (S) Pause game on tab blur (currently can die in background?)— verify & fix — *promoted 2026-06-11: if real, it silently kills runs (worse than any open bug); verification alone is minutes* — *done: verified real for visible-but-unfocused windows (rAF keeps ticking while `core/input` clears held keys on blur → player stands still and dies); hidden tabs were already safe (rAF stops, sim freezes). Fix: auto-pause on window `blur` + `visibilitychange→hidden` (turbo runs exempt — unattended by design). Verified by `scripts/pauseGuardTest.mjs`*
- [ ] [P2] (M) FPS safeguard: auto-lower particle density when frame time >20ms. *note: do not lower enemy cap as it changes with the difficulty balance*  
- [ ] [P3] (S) Export/import save as JSON string (manual backup)

### Card system rework
- [x] [P1] (M) Repeat-pick penalty: picked cards get less likely to reappear, for offer variety.
  **Proposed formula** (tune in sim): stat card `weight × 0.55^timesPicked` (floor 8% of base);
  weapon level-up cards get a gentler `weight × 0.85^currentLevel` (they must stay findable to
  reach max level + evolution). Banished cards stay at weight 0 as today.
  — *done: implemented exactly as proposed (constants `REPEAT_DECAY`/`REPEAT_FLOOR`/`WEAPON_LEVEL_DECAY` in levelup.ts; note: the 8% floor can't bind with maxStacks ≤ 5 — 0.55⁴ ≈ 9.2% — kept for future high-stack cards). Pause-menu odds reflect it automatically. offerTest asserts the 0.55² ratio (measured 0.31) + tier rates unchanged (legendary 1.41%); weapon-up share decays 10.3% → 5.3% lv1→lv6. Sim: all 4 chars victorious, Bits 1545–1995 (ada weak-variance run 1102, pre-existing)*
- [ ] [P3] (S) Meta upgrade **"Muscle Memory"** (3 levels): softens the repeat penalty
  (0.55 → 0.70 → 0.85 → 1.0 effectively off) — lets build-focused players buy back consistency
- [x] [P1] (S) Rework **Skip** — currently gives nothing, so it's strictly worse than any pick.
  **Proposal:** Skip = "Defer": bank 20% of the next level's XP requirement (momentum without power).
  Alternative if too strong: flat +5 ⌬ live Bits. Decide, implement, kill the dead button.
  — *done: went with Defer (20% can't beat a card, and it stays out of the Bits economy). `Run.deferLevel()`
  banks `0.2 × xpForLevel(level)` — raw XP, no xpMult, not counted in xpCollected (no Bits) — and can chain
  a queued level-up if the bar was ≥80%. Button now reads "DEFER +20% XP ×n"; Snooze Notification meta desc
  updated. Verified via `scripts/deferTest.ts` (10 checks: bank amount, skip consumption, chaining,
  carry-over, 0-skip no-op, gainXp regression)*
- [x] [P1] (S) Verify rarity weighting math end-to-end (suspected cause of "legendary too common" bug below) — add a `scripts/offerTest.ts` assertion: over 10k offers at luck 0, legendary rate ≈ 1.4%/card — *done: weights were per-card, now per-tier split across available cards; assertion passes at 1.40%*

### Balance pass (sim-driven, see DESIGN.md §27)
- [x] [P1] (S) **Balance goal sheet**: write `docs/BALANCE.md` documenting target numbers (TTK windows, kill-rate floors, Bits/run bands, rarity rates, level curve timing) — the sim and watchlist check against this instead of tribal knowledge — *done: combat pacing, level curve checkpoints, card tier/penalty rates, Bits faucet formula + full-shop cost (12,875 ⌬ → 25–35 run window), known outliers. Provisional numbers (level checkpoints, 0-boss red-flag rate) explicitly marked for recalibration by the simulator-matrix item*
- [x] [P1] (M) Run simulator matrix (4 chars × 2 maps × 15 min), record kill-rate vs spawn-rate per minute; fix any char that falls behind before min 6 — *done: new `scripts/matrix.ts` (shared bot in `simBot.ts` with simulate.ts; per-minute kill vs spawn rate via Δkills+Δalive, first-boss TTK, BALANCE.md verdicts; `[charId]` filter arg). Verdict: only **ada** fell behind (cap-pinned 3/5 greenfield samples, 0 bosses in 4/5, median lv 17) — root cause: Syntax Wand was the only zero-pierce single-target starter and ada's passive adds no combat power. Fix: wand base pierce 1 + pierce step at lv 3. Post-fix aggregate (18 samples/map): pinned 2/18 greenfield (was 3/5), 3/18 marsh (was 2/5); median runs in band with other chars (other 3 chars: 0 pinned anywhere). Residual ~10–17% weak-draw pins are inherent to the offer[0] bot + ada's non-combat passive — left alone deliberately, strong runs already sit at band top; revisit only if human play confirms*
- [x] [P1] (L) **Difficulty rework: power must beat movement** (user directive 2026-06-11: a careless offer[0] bot should rarely win; good builds should win much more) — *done: (1) straggler recycling — outrun enemies teleport back to the spawn ring, 65% biased into the player's heading, so fleeing builds a wall ahead (`spawner.ts`); (2) quadratic enemy-damage term — uncleaned hordes turn lethal past ~min 8 (`enemies.ts`); (3) max's turret life 10s→7s (his free-DPS floor won 75% of pickless mortal runs). Measured with the new mortal-bot matrix: careless zero-meta wins 83%→28% greenfield / 0% marsh; maxed-meta careless 72%/31% — power gradient works. Targets + instruments in BALANCE.md §5*
- [x] [P1] (M) **In-run build-quality separation** — the second half of the directive ("good in-run builds win much more") is not yet demonstrable: all mortal bots are XP-starved (median lv 8–11 by 15:00) so pick quality barely matters; the greedy strategy measures ≈ careless. Needs scenario-granted builds (see Dev tooling "Simulation scenarios" item — **do that first**, promoted alongside this) to certify, plus possibly XP economy tuning (gem density/magnet) if humans also under-level. Open per BALANCE.md §6: marsh 0% at zero meta (meta-gated by design?), linus under-scales with meta — *promoted 2026-06-11: open half of an explicit user directive; everything else in v0.2 is optional polish, this is the milestone's outstanding promise* — *done 2026-06-12, certified via scenario A/B (`matrix.cjs --scenario=` + checked-in `build-good`/`build-scattered`/`build-none` presets — same ada lv-12-@-6:00 pick budget, spent well vs badly vs not at all; mortal, zero meta, n=16/arm): greenfield 63% vs 0% vs 0% wins; good build + greedy continuation 94%. **Power, not movement, decides the run — directive holds.** Marsh open question resolved as build-gating, not meta-gating (good zero-meta build wins 44% there); no XP-economy change made — organic-bot starvation is a kiting artifact, both A/B arms share the XP position so the comparison is clean (re-check only if human play under-levels too). Targets + re-run commands in BALANCE.md §5. En route: scenario `startMin` now advances the boss schedule past already-due bosses (was: backlog of 2–3 bosses flooding the first frame of any mid-run scenario)*
- [ ] [P3] (M) **Boss TTK investigation** — first matrix measurement shows no config meets the 60–100s first-boss TTK window under the auto-pick bot (medians 117–653s; best linus×greenfield ≈117s, i.e. bosses barely die within their 120s slot, then stack). Separate the causes before tuning: (a) bot build quality (offer[0] picks), (b) bot orbit radius 190 puts short-reach weapons (Assertion Blades ~80–135) permanently out of boss contact — explains nia's bimodal 0-boss runs, (c) boss HP curve possibly genuinely too high at 2:00, (d) target itself unrealistic for min-2 builds. Needs either a smarter pick/positioning strategy in the bot (sim-scenarios item helps) or a manual-play TTK measurement before touching boss HP
- [ ] [P3] (S) Exception Beetle density above minute 10 (explosion stacking)

---

## 📦 v0.3 — Content expansion

Goal: more reasons to do "one more run". Content is data-driven — most items here are
records in `src/data/` plus a behavior key in `src/game/` and a sprite in `src/render/sprites.ts`.

### Maps (target: +2, total 4)
- [ ] [P1] (L) **Production Server** — industrial server room; hazard: overheating floor vents (periodic damage zones); enemy skew: exception beetles + deadlock scarabs; ×1.5 Bits
- [ ] [P2] (L) **Cyber Glacier** — frozen processes; hazard: latency fields (player + enemy slow zones); enemy skew: tanks; ×1.5 Bits
- [ ] Each new map needs: palette, spawnPlan, bossOrder, 1 unique hazard, 1–2 map objectives, shop unlock entry, codex entry
- [ ] [P2] (L) **Terrain & obstacles** — maps stop being featureless planes: impassable blockers (server racks, crashed processes) and terrain patches (e.g. slow zones distinct from hazards). Scope check before starting: needs collision for player *and* enemies (spatial hash covers entities, not static geometry yet), enemy steering around blockers (flow-field or simple slide-along — full pathfinding is overkill), isometric draw-order sorting for tall props, and spawn-point validation. Keep obstacle layout data-driven per map (seeded `mulberry32` like decoration) so the sim stays headless. Start with 1 obstacle type on one map as a vertical slice

### Bosses (target: +3, total 8)
- [ ] [P1] (M) **The Race Condition** — teleports unpredictably, leaves a damaging afterimage copy
- [ ] [P2] (M) **The Critical Exception** — huge telegraphed AoE slams (dodge-window boss)
- [ ] [P2] (M) **The Production Incident** — 12:00+ finale boss combining two prior mechanics, only on ×1.5 maps
- [ ] [P2] (M) **Boss mechanics pass** — *user: existing bosses feel like different attack patterns, not unique fights — and they should be a challenge without a proper build, not just dodge/kite checks.* Design first, then implement: give each of the 5 a second, rule-bending layer that tests the **build** (DPS checks, soft enrages, interrupt thresholds), not only movement. Starter proposals to riff on:
  - Merge Conflict: halves linked by a damaging "diff" tether — positioning puzzle (or: HP gap between halves triggers a force-push enrage)
  - Memory Leak: pools never expire and slowly flood the arena — soft enrage via shrinking safe space; death "frees" all memory at once
  - Infinite Loop: snapshots the player's position, rewinds them to it 3s later (time-loop dodge planning)
  - Stack Overflow: unkilled mites stack frames that buff it; clearing the stack "pops" it into a long stun
  - Legacy Monolith: spawns "deprecated dependency" pillars that block shots; destroying one mid-armor exposes the core early

### Weapons (target: +4 with evolutions, total 12)
- [ ] [P1] (M) **Fork Bomb** — thrown bomb that splits into smaller bombs → evolves **Zip Bomb** (recursive splits)
- [ ] [P1] (M) **Firewall** — directional flame wall in movement direction → evolves **DMZ** (surrounding ring)
- [ ] [P2] (M) **Ping Storm** — homing packets at random enemies → evolves **DDoS** (massive packet flood)
- [ ] [P2] (M) **Sudo Scroll** — rare massive single-target smite → evolves **Root Access** (executes non-boss enemies below 15% HP)

### Weapon balance patch (sim-driven; run *after* the +4 weapons land so the pass covers the full 12-weapon arsenal once)
*(from draft 2026-06-12: weapons should be **near** equally balanced — true equality is impossible and not the goal, since weapons differ by design in how they're used)*
- [ ] [P2] (M) **Single-weapon scenarios** — one checked-in scenario per weapon (scenario `replaceWeapons` + the solo weapon at an equal level/clock budget) + a sweep that runs them all and compares kill rate, first-boss TTK and mortal win rate under identical conditions — **measured at (at least) two weapon-level checkpoints per weapon** (early, ~lv 2–3, and late, lv 8/evolved) so each weapon's growth curve is visible, not just one point on it. The tooling exists (`matrix.cjs --scenario=`, `replaceWeapons`); this is authoring the presets + a comparison harness/report. New v0.3 weapons get a preset as part of shipping (cheap acceptance test per weapon)
- [ ] [P2] (M) **Risk-adjusted equalization** — define two per-weapon design axes in BALANCE.md first, then tune outliers against them (a weapon is only an outlier relative to its declared profile, not the raw average):
  - **Risk tier** — how the weapon is meant to be used (`garbageCollector`'s self-endangering short reach vs `syntaxWand`'s safe poke); higher risk earns a higher reward ceiling — **but verify with scaled scenarios** (high level + offense cards + meta) that risk premiums don't compound with scaling upgrades into late-game dominance
  - **Growth profile** — some weapons are *designed* weak at low weapon levels and shine at high levels (user 2026-06-12): late bloomers may sit below the band at the early checkpoint but must reach it when leveled/evolved, and early performers must not also dominate the late checkpoint. The early window still has a floor — a late bloomer can't be so weak it never survives to bloom (the ada/Syntax-Wand pierce lesson)

  Acceptance: solo-weapon win rates within an agreed band per (risk tier × growth profile) at both the early and late weapon-level checkpoints, at low- and high-player-scaling alike
- [ ] [P2] (S) Tune Assertion Blades + cooldown-build scaling (flagged as outlier) — *moved here from v0.2 per user 2026-06-12; the checked-in `blades-cdr` scenario is the measurement instrument, and the risk-tier framing above decides how much of its edge is legitimate (short reach = high risk) vs outlier*

### Characters (target: +4, total 8)
- [ ] [P1] (S) **Rex Intern** — Intern; starts with random weapon; passive: +30% XP, −20% max HP (high risk beginner-luck char)
- [ ] [P2] (S) **Sec Hexa** — Security Engineer; starts Firewall; passive: thorns (returns 20% contact damage)
- [ ] [P2] (S) **Dana Tensor** — Data Scientist; starts Ping Storm; passive: pickups give +1% stacking damage per 100 XP (scaling late-game)
- [ ] [P3] (S) **Greybeard Cobol** — Legacy Maintainer; starts Stack Staff; passive: immune to slows, −15% move speed (tank archetype)

### Cards & enemies
- [ ] [P2] (M) **Shield system** — new defensive layer on top of HP (0 by default): absorbs damage first, and shield hits don't count as "real" damage (won't fail no-hit objectives). Includes new Shield stat cards + **"Starting Shield"** meta upgrade. Decide at design time: does shield regenerate (out-of-combat delay?) or only refill via pickups/cards?
- [ ] [P2] (M) +8 stat cards (fill thin categories: status effects, chain, summons — see brief; Shield cards counted under the shield-system item)
- [ ] [P2] (M) +2 enemy types: ranged spitter (forces movement), shielded enemy (directional block)
- [ ] [P3] (S) Meta upgrade: **decrease boss spawn timer** (bosses arrive sooner → faster, riskier runs). Open question: is "harder sooner" something players will pay Bits for? Decide when implementing — maybe frame as a curse-style toggle (v0.4) instead of a meta buy
- [ ] [P3] (S) +6 objectives covering the new content (one per new map/boss/weapon class) + hardcore full-run challenges from draft: **"Don't get hit"** (whole 15:00 run; shield absorbs don't count once the shield system lands) and **"Don't move"** (whole run — ultimate turret-build check)

---

## 🎮 v0.4 — Modes & replayability

- [ ] [P1] (L) **Endless mode** — past 15:00: boss order reshuffles, scaling continues, leaderboard-style best-time stat in codex
- [ ] [P1] (M) **Curses / difficulty modifiers** — pre-run toggles (e.g. "−25% pickup radius", "+50% enemy speed") each adding a Bits multiplier; stacking allowed
- [ ] [P1] (M) **In-run events** — bug nests to destroy / broken terminals to repair on the map for bonus chests. *Promoted to P1: currently nothing motivates the player to actually move around the map — this is the fix.* Spawn 1 event per ~90s at a distance, marked on the radar/minimap, despawns after 45s if ignored. Rewards: chests + **API Tokens** (see currency item below)
- [ ] [P2] (M) **In-run currency: API Tokens** — dropped by in-run events (maybe elites too); spent during the run at a **Package Registry** terminal (spawns after each boss, marked like events) on one-run consumables: instant heal, magnet sweep, +1 reroll/banish, short buffs. Separate economy from Bits (meta) and XP (leveling) — unspent tokens die with the run (or convert 10:1 to Bits?). Depends on in-run events; keep the item pool small (4–6) and data-driven
- [ ] [P2] (L) **Daily & weekly seeded challenges** — fixed seed (date-derived), fixed char/map/curses, share-your-score string. Daily = quick fixed loadout; weekly = harder, curse-stacked, bigger one-time ⌬ bonus. One codebase: a challenge is just `(seed, char, map, curses[], reward)`
- [ ] [P3] (M) Achievements → cosmetic palette swaps for characters
- [ ] [P3] (M) Meta tree UI (visual upgrade graph instead of flat shop list)

---

## 🧬 v0.5 — Prestige & infinite meta (design phase)

> Promoted from draft, still open questions (`???`) — **write a short design doc in `docs/` and get it
> approved before implementing anything here.** Risk to manage: prestige must not invalidate the
> honest 25–35-run shop curve or turn into a pure number treadmill.

Theme proposal: prestige = **"The Great Rewrite"** — you ship v(N+1).0 of yourself.

- [ ] [P1] (M) Design doc: prestige currency, reset rules, what carries over, pacing targets
- [ ] [P2] (L) Prestige reset: trade completed meta shop for a permanent multiplier + **Legacy Tokens**
- [ ] [P2] (L) Skill tree spent with Legacy Tokens (this is where the "meta tree UI" from v0.4 pays off)
- [ ] [P2] (M) Infinite meta-upgrade levels past current caps, exponential cost + diminishing returns
- [ ] [P3] (L) Procedural "infinite" map ladder: same biomes re-rolled with +difficulty / +Bits multiplier per rung
- [ ] [P3] (S) Game-speed unlock (1.25× / 1.5× sim speed as a prestige QoL reward)
- [ ] [P3] (M) New prestige-gated meta upgrade tier

*Note: "infinite run past 15:00" from the draft = **Endless mode**, already tracked in v0.4 — prestige can gate extra Endless scaling rewards instead of duplicating it.*

---

## 🚀 v1.0 — Release

- [ ] [P1] (L) Desktop wrap (Tauri preferred over Electron — smaller) with proper save path
- [ ] [P1] (M) Settings completeness: resolution/zoom, fullscreen, all audio sliders, key rebinds
- [ ] [P1] (M) Full balance certification: every char/map/mode combination sim-tested + 1 manual run each
- [ ] [P2] (L) Steam page assets: capsule art, trailer, screenshots, store copy
- [ ] [P2] (M) Steam achievements mapping (reuse objective system)
- [ ] [P3] (L) Localization pass (extract strings; the wordplay needs per-language rewriting, not translation)
- [ ] [P3] (S) Credits & licenses screen

---

## 🐛 Known issues

> Add bugs here as they're found; fix P1 bugs before any feature work.

- [x] [P1] (S) Pause hint advertises **F5** to resume — F5 refreshes the browser and wipes the run. Remove the hotkey + hint (use Esc/P/Space) — *fixed: Esc/P toggle pause, Space also resumes, button says "(ESC)"*
- [x] [P1] (S) **Menus clipped at the top** (Upgrades, Bug database not fully visible) — likely missing scroll container / `overflow-y: auto` + `align-items` issue on tall content; audit all menu panels at common window sizes — *fixed: `justify-content: center` on an overflowing flex column clips the top unreachably; replaced with flex spacers on `.screen` and `.levelup-wrap` (center when fits, scroll when tall)*
- [x] [P1] (S) **Legendary cards too common** — measure actual rate via `scripts/offerTest.ts`, expected ≈1.4% per card at luck 0; suspect luck multiplier or per-card halving applied wrong (ties into v0.2 card-system verification item) — *fixed: tier weights were applied per-card so tier rates scaled with card count (and drifted with banishes/max stacks); now split per tier. Measured 1.40% legendary at luck 0*
- [x] [P1] (S) **Merge Conflict double chest** — each split half drops a chest, so the *first* boss pays double. Verdict: bug — only the last-killed half should drop the chest (keep double XP burst as a fun consolation if balance allows) — *fixed: chest gated on twin half being dead; both halves keep the XP shower.* Boss-kill credit ruled a bug too: *fixed — first-killed half now emits a big regular kill effect; bossKills + bossDie banner + chest all come only from the last-killed half (1 boss = 1 boss kill in run + meta stats)*
- [x] [P1] (S) **Held movement key spams through the level-up screen** — kbnav (new today) accepted auto-repeat keydowns from keys held since before the screen appeared, so a player moving when the modal opened instantly cycled the card highlight — *fixed: kbnav ignores `repeat` events from any key not freshly pressed after the screen attached (per-key, re-locks on every screen change); hold-to-scroll inside a menu still works. Verified via Playwright synthetic repeat events: 6 pre-held repeats ignored, repeats flow after a fresh press, held Enter can't activate*
- [x] [P1] (S) **Evolved weapon's base version re-offered** — after evolving, the base weapon could appear again as a "new weapon" card (the evolved instance carries the evolution's id, so the base looked unowned) — *fixed: the new-weapon pool skips any weapon whose evolution is currently owned. Verified: 0 re-offers in 15k draws post-evolution, other weapons still offerable, offerTest rarity rates unchanged (legendary 1.43%)*
- [x] (S) **"Up/down movement feels slower than left/right"** — triaged: illusion, working as intended. World-space speed is direction-independent (screen input is rotated 45° into world axes with length preserved, `updatePlayer` in run.ts); the 2:1 isometric projection (`sx = x−y, sy = (x+y)/2`) halves vertical screen velocity, so screen-vertical travel reads ~2× slower while covering identical world distance — and enemies project identically, so chase/kite balance is unaffected. No change made; if it still feels wrong in play, reopen as a feel-tuning item (screen-space compensation would make vertical movement objectively faster in world terms and needs its own balance pass)
- [x] [P1] (S) **Held gamepad direction spams through the level-up screen** — same bug as the keyboard one above, pad edition: `pollGamepad`'s repeat machinery keeps ticking during a run, so a stick/d-pad held when a screen opened immediately cycled its items — *fixed: `padRequireNeutral()` called from `KbNav.attach()` gates the pad menu-direction until the stick returns to neutral (pad twin of the keyboard liveKeys gate); fresh input after release navigates normally. Verified via padTest.mjs regression checks (held stick stays on CONTINUE through the repeat window, nav resumes after release)*
- [x] [P2] (S) Projectile-count modifier doesn't apply to Max Pipeline's turret — decide: design (turrets are fixed) or bug. Lean **bug**: passives feeling upgrade-dead is worse; apply at reduced rate (e.g. +1 projectile per +2 player projectiles) if full scaling is too strong. - Decision: it's a bug. Go with full scaling. — *fixed: turret fires 1 + player projectile bonus bolts with the same shared-target spread as weapon bolts; Max sim run within normal bands*

---

## ⚖️ Balance watchlist

Standing concerns to re-check after every content change (run `scripts/simulate.ts`).
Full target numbers live in [docs/BALANCE.md](docs/BALANCE.md) — this is the short list:

- Kill rate ≥ spawn rate before minute 6 for **every** starting weapon
- First boss TTK in 60–100s window
- Assertion Blades + cooldown stacking (strongest known combo)
- Bits/run drift: target ~300–700 early runs, ~1500–2100 strong victory; full shop ≈ 25–35 runs

---

## 💡 Backlog (unscheduled ideas)

Parking lot — promote into a milestone before working on these.

- More biomes: Stack Canyon, Cloud Citadel, Firewall Bastion, Legacy Ruins, Nullwood Forest, Memory Marsh hard-mode
- Passive item slots (separate from stat cards, Vampire-Survivors-style item grid)
- Boss codex lore entries ("post-mortem reports" written as incident reviews)
- Pet cosmetics for Daemon Familiar
- Photo mode / screenshot key with HUD hidden
- Speedrun timer + splits per boss
- Mod support: load extra `data/` JSON from user folder (desktop build)
- Cloud save sync / accounts — needs a backend + auth; **don't** build before desktop wrap exists. Ship the v0.2 export/import-as-JSON item first as the manual version; revisit only if there's a real multi-device audience

---

## 🛠️ Dev tooling (do alongside any milestone)

- [x] [P1] (M) **Simulation scenarios** *(promoted 2026-06-11: gates the v0.2 P1 build-quality-separation item and unblocks the Boss-TTK + Assertion-Blades investigations — three consumers waiting)*: `simulate.ts` accepts a scenario preconfig (JSON file or named preset): starting state (char, map, level, weapons + levels, taken cards, meta levels), card-pick strategy, time window — run starts *from* that state instead of fresh. For reproducing bug reports and testing specific builds; directly serves the balance-pass items (e.g. the "Assertion Blades + cooldown stacking" watchlist entry becomes a checked-in scenario) — *done: `src/game/scenario.ts` (DOM-free schema + `createScenarioRun`, builds state via Run's public methods — same injection family as `run.forcedOffer`); `simulate.ts --scenario=<name|path>`, bare names resolve to `scripts/scenarios/<name>.json`; bot pick strategy + mortality configurable per scenario. First checked-in preset: `blades-cdr` (the Assertion Blades + CDR watchlist combo). Verified: scenario run starts lv 20 @ 5:00 with the injected build; plain-run regression unchanged*
- [x] [P2] (M) **Dev console API** (`window.dbg`) — manipulate the live run from the browser console on dev builds: `dbg.bits(n)` (add Bits), `dbg.offer(cardId, …)` (force the next level-up offer), `dbg.give(weaponId)` / `dbg.level(id, n)` (grant/level weapons), `dbg.list()` (enumerate card/weapon/enemy ids), plus obvious extras (`dbg.xp(n)`, `dbg.god()`, `dbg.time(min)`). **Requires build configurations first** (user ruling): introduce dev/prod build modes — `npm run build:dev` → `vite build --mode dev` alongside the default prod build — with a compile-time `__DEV_TOOLS__` constant injected via `define` in vite.config.ts. The dev API module is only imported behind `if (__DEV_TOOLS__)` so Rollup dead-code-eliminates it: **prod bundles must not contain the dev API at all** (verify with a grep over `dist/` in CI, not just a runtime no-op). Test-server deploys use the dev configuration; the `-dev` version suffix should follow the build mode so the menu tag and the tooling agree. Implement as a thin layer in `main.ts` calling `Run` methods — `src/game/` stays DOM-free, and forced offers should reuse the same hooks the Simulation-scenarios item needs (one "inject state into a run" surface, two consumers) — *done: `src/dev/devtools.ts` behind a dynamic import (prod build emits no devtools chunk — verified by grep both ways, locally + 2 new CI steps); `build:dev` script; `-dev` suffix now also follows the mode (dev server / `--mode dev` always show it). Forced offers live as `run.forcedOffer` (DOM-free, consumed by the first `makeOffer` draw so reroll falls back to a normal draw) — the scenario-tooling hook as planned. Verified by `scripts/devtoolsTest.mjs` (Playwright, 18 checks: every API call incl. forced 2-card offer rendered + picked); offerTest + 15-min sim unchanged after the levelup.ts builder refactor*
- [x] [P2] (S) **Isolated play server** *(from draft 2026-06-12: "docker support, so the game can be run in an isolated environment without interrupting Claude's work and to avoid vite's hot reload")* — solved without Docker per the processed proposal: `npm run play` = `tsc` + `build:dev` into a separate `dist-play/` (gitignored) + `vite preview --port 4180 --open` — no file watching (no hot reload), Claude's `dist/` rebuilds never touch it, re-run to pick up newer code. Docker remains an option only if clean-environment *repro* ever becomes the actual need — *done 2026-06-12: verified end-to-end (build into dist-play/, server serves its own asset hashes on :4180, independent of dist/)*
- [x] [P2] (S) Claude skill **`design-entity`** (`.claude/skills/design-entity/SKILL.md`; renamed from `create-entity` per user): given a one-line concept, generates a complete entity record (weapon/enemy/boss/card/character) in the right `src/data/` file with a name + flavor text matching the game's dev-culture humor, a behavior key, and a sprite stub — plus reminds to add codex + objective entries — *done 2026-06-12: per-type integration checklists (incl. the reachability traps: spawnPlan weights, weapon pool/shop, bossOrder), house tone/color rules, balance-by-neighbor numbers, and the standard verification gates (build-verifier, sim-verifier, offerTest for offer-pool changes)*
- [ ] [P3] (S) Save editor dev page (`?saveeditor` flag): view/edit the parsed localStorage save as a form, builds on the export/import item

---

## 📜 Progress log

> One line per meaningful session/merge: date — what changed. (Work-in-progress journal for the
> current milestone — on release these lines inform the [CHANGELOG.md](CHANGELOG.md) entry and are pruned.)

- 2026-06-10 — v0.1 MVP complete (`9b73df5`): full core loop, 2 maps, 5 bosses, sim tooling
- 2026-06-11 — Roadmap created
- 2026-06-11 — First DRAFT.md batch integrated: 5 bugs triaged, card-system rework (repeat penalty + Skip fix) added to v0.2, in-run events promoted to P1, new v0.5 Prestige milestone, dev-tooling section
- 2026-06-11 — All four P1 Known-issue bugs fixed (F5 hint, clipped menus, legendary rate, Merge Conflict double chest) + rarity verification item: offerTest.ts now asserts tier rates (legendary 1.40% @ luck 0); sim re-run, Bits/run 1318–1957 band unchanged vs baseline
- 2026-06-11 — Per user rulings: Merge Conflict halves now also share one boss-kill credit/banner (not just the chest), and Max Pipeline's turret gets full projectile-count scaling. Git workflow added to CLAUDE.md: commit per fix, push when session work is verified
- 2026-06-11 — Pause menu rebuilt as a current-run overview (stat sheet, weapons dmg/DPS, taken cards, live card odds); per-weapon damage tracking added to the sim layer + simulate.ts end-of-run damage table. Sim note: ada auto-pick runs vary widely (947–2144 Bits observed; one weak run killed 0 bosses) — the P1 simulator-matrix item should look at ada's variance
- 2026-06-11 — Render QoL: damage numbers merge instead of stacking past 40 on screen; off-screen bosses get a pulsing edge indicator arrow
- 2026-06-11 — Main menu shows the version number (injected from package.json at build time, so release bumps propagate automatically)
- 2026-06-11 — Keyboard navigation in all menus + card selection (kbnav.ts): spatial nav with same-row/column preference, Enter/Space activate, Esc = back, sliders adjustable. Space-resume now comes from the pause screen's default CONTINUE highlight instead of a main-loop special case. Verified via headless Playwright drive-through
- 2026-06-11 — Save-data versioning + migration shim: SAVE_VERSION + per-step MIGRATIONS table ahead of the defaults merge; downgrades preserve newer saves untouched
- 2026-06-11 — Branch policy correction: work pushed to `dev` from now on (main left as-is per user). Draft batch 2 processed: shield system + boss-timer meta + hardcore objectives into v0.3; evolved-weapon re-offer bug triaged and fixed same session. Sim variance note: ada samples 524–2154 Bits across 5 runs (incl. a 524 floor below the previously observed band) — strengthens the case for the P1 simulator-matrix item
- 2026-06-11 — Draft batch 3: held-key spam through level-up (kbnav regression) fixed same day via per-key auto-repeat gating; "simulation scenarios" preconfig idea added to Dev tooling (P2)
- 2026-06-11 — Draft batch 4 processed (terrain/obstacles → v0.3 P2 vertical slice; FPS counter → v0.2 P2). Two P1 UX items shipped: run-summary divider before the Bits breakdown, player health bar with settings toggle. Verified via build + sim (ada 1279 Bits, within known variance) + Playwright screenshots (bar renders, toggle flips, divider shows)
- 2026-06-11 — Session-start sync rule added to CLAUDE.md (`git pull --ff-only` before reading the roadmap) after a stale checkout nearly redid finished work; local-only subagents commit rebased onto origin/dev, user's "stop & resume a run" roadmap item restored. Gamepad support shipped: standard mapping, analog move merged into moveVector(), kbnav driven by stick/d-pad + A/B/Start, sliders pad-adjustable; verified via scripts/padTest.mjs (Playwright, stubbed Gamepad API, 10/10 checks) + build + sim (ada 885 Bits, weak-variance run, logic untouched in Node)
- 2026-06-11 — Type-check gate shipped: pre-commit hook (`tsc --noEmit`, hooksPath set by npm `prepare`) + GitHub Actions CI (build, offerTest assertions, 5-min sim smoke); hook verified to block a type error
- 2026-06-11 — User-reported bug fixed same day: held gamepad direction navigated freshly opened screens (level-up) — pad now requires a return to neutral on every screen attach, mirroring the keyboard liveKeys gate; padTest.mjs grew 2 regression checks (12/12 pass)
- 2026-06-11 — Repeat-pick penalty shipped with the proposed formula (0.55^picks stat cards / 0.85^level weapon-ups, 8% floor); offerTest grew penalty assertions (ratio 0.31 ≈ 0.55², tiers unchanged); 4-char sim sweep all victories, Bits 1102–1995
- 2026-06-11 — Draft batch 5 processed: in-run currency "API Tokens" added to v0.4 (P2, tied to events); events item linked to it; "up/down feels slower" triaged as code-verified illusion (2:1 iso projection, world speed uniform — no change); build-version idea already shipped earlier today
- 2026-06-11 — Incremental build version per user request: on `-dev` builds the patch number is the git commit count (`v0.2.33-dev`) — deterministic, stateless, distinguishes test-server deployments; releases untouched. CI checkout switched to full history so its commit count is correct. (Replaced the timestamp variant shipped an hour earlier)
- 2026-06-11 — Release-branch policy adopted (user ruling: main = mirror of newest release): releases live on `release/X.Y`, hotfixes commit there and merge back to dev, version substitution now applies on release builds too (`vX.Y.<count>`) so hotfixes bump production versions visibly; CLAUDE.md + roadmap release bullet rewritten, CI covers `release/**`
- 2026-06-11 — Draft batch 6: KILL PROCESS two-step confirm → v0.2 UX (P2); "Boss mechanics pass" → v0.3 Bosses (P2, design-first) — each boss gets a rule-bending layer that tests the build, not just dodging, with 5 starter proposals to riff on
- 2026-06-11 — Skip → **Defer** shipped (P1 card-system item, primary proposal): banks 20% of the next level's XP (raw, no xpMult, no Bits credit), button reads "DEFER +20% XP ×n". New `scripts/deferTest.ts` (10 checks). Sim: ada variance reconfirmed across 5 samples (748–2078 Bits; weak runs kill 0 bosses, alive count outgrows kills by min 4) — more fuel for the P1 simulator-matrix item
- 2026-06-11 — `docs/BALANCE.md` goal sheet written (P1): pacing targets, level-curve checkpoints, card tier/penalty rates, Bits faucet + 12,875 ⌬ full-shop cost; provisional values flagged for the matrix item. Watchlist now links to it. Noted: sim boss kills are bimodal (0 or several) — once a boss outlives its 120s slot the run never recovers, so TTK regressions surface as `bosses: 0`
- 2026-06-11 — Simulator matrix shipped (P1, last v0.2 balance P1): `scripts/matrix.ts` + shared `scripts/simBot.ts`. Findings: ada was the only char failing the min-6 pacing floor → root cause Syntax Wand pierce 0; fixed (base pierce 1 + lv-3 step), confirmed over 8 samples/map. First-ever TTK measurement shows no config in the 60–100s window under the bot → new P2 "Boss TTK investigation" item (don't tune boss HP before separating bot artifacts: orbit-radius-190 vs short-reach weapons explains nia's 0-boss runs). BALANCE.md statuses updated
- 2026-06-11 — Dev console API shipped (same-day from draft batch 7): build modes (`build:dev` / `--mode dev` → `__DEV_TOOLS__` define), `window.dbg` (bits/offer/give/level/xp/god/time/list) as a dynamic-import chunk that prod builds provably exclude (CI greps `dist/` both ways); `run.forcedOffer` hook added for forced offers, shared with the future sim-scenarios item. Verified: devtoolsTest.mjs 18/18 (Playwright), offerTest all-OK (ratio 0.301, legendary 1.56%), 15-min ada sim victory 1130 ⌬ (in band)
- 2026-06-11 — Draft batch 7 processed: cap-aware card warnings folded into the v0.2 card-tooltip item (computeStats clamps: 60% CDR, 100% crit — badge fully/partially wasted picks); dev console API (`window.dbg`, gated on the `-dev` version suffix) added to Dev tooling (P2), sharing the run-state-injection surface with the Simulation-scenarios item
- 2026-06-11 — Difficulty rework per user directive ("dumb bots should rarely win"). Instrumented first: mortal bot (real death + survival kiting) with pick strategies and meta levels in matrix.ts — found "victories" had always been invincible-by-fiat, and a careless bot won 83% of mortal greenfield runs by outrunning everything (nothing catches a 150 u/s player; spawner stops at cap, stragglers never return). Fixes: straggler recycling with heading bias, quadratic late enemy damage, max turret-uptime cut. Result: careless zero-meta 28%/0% (greenfield/marsh), maxed-meta 72%/31%. Bot fidelity bug found en route: sim bots never set faceX/faceY, so sweep weapons fired due-east in every previous sim (fixed; explains part of linus's historic weakness). In-run build-quality separation deferred to scenario tooling (new P2)
- 2026-06-11 — v0.2 reprioritized after the P1 sweep completed: promoted to P1 — tab-blur pause (possible silent run-killer), KILL PROCESS confirm (run-loss safety), cap-aware card tooltips (milestone's core "informative" goal), and in-run build-quality separation (open half of the difficulty directive) gated on Simulation scenarios (Dev tooling, also → P1). Demoted NEW badge to P3; run-end damage breakdown noted as near-free. Boss TTK / Assertion Blades / Beetle density stay P2 pending scenario tooling
- 2026-06-11 — Three promoted P1s shipped: tab-blur auto-pause (bug verified real for visible-but-unfocused windows — input clears on blur while rAF keeps ticking; hidden tabs were already safe), KILL PROCESS two-step confirm (arm → SIGKILL confirm, shared by mouse/kb/pad via the click handler; disarm on focus move or 2s), cap-aware level-up card previews (`cardStatPreview()` diffs hypothetical `computeStats()` — per-line "cur → new", CAPPED badges, dead cards dimmed). New `scripts/pauseGuardTest.mjs` + `scripts/cardPreviewTest.mjs` (Playwright)
- 2026-06-12 — Simulation scenarios shipped (last Dev-tooling P1): `src/game/scenario.ts` + `simulate.ts --scenario=<name|path>`, presets in `scripts/scenarios/` (first: `blades-cdr`). Unblocks the in-run build-quality-separation P1 (now the only open P1 in v0.2) and the Boss-TTK / Assertion-Blades P2 investigations
- 2026-06-12 — Priority semantics adopted (user-approved): P1 = release-blocking (the cut triggers mechanically when all P1s check), P2 rolls into the next milestone, P3 drops to Backlog unless promoted; user re-scoped v0.2 P1s accordingly (heal feedback, run stop/resume, codex thumbnails + lifetime stats, FPS counter, NEW badge, run-end damage breakdown, touch controls). Draft batch 9: per-weapon balance patch → new v0.3 "Weapon balance patch" section (solo-weapon scenario presets + comparison sweep; risk-adjusted equalization with risk tiers in BALANCE.md, checked at low *and* high scaling); Assertion Blades outlier item moved from v0.2 into it per user; user addendum same day: weapons also declare a *growth profile* (late bloomers weak early by design) — outliers judged against declared profile, sweep measures early + late weapon-level checkpoints
- 2026-06-12 — Heal feedback shipped (P1): `heal` RunEvent from `healPlayer()` with a sub-1HP accumulator (regen shows whole +N ~1/s, nothing at full HP); renderer draws green floating +N + brief green sprite glow (mirror of the hurt tint). Build + 15-min ada sim verified (victory, 1850 ⌬, kill rate ahead of spawns pre-min-6)
- 2026-06-12 — `design-entity` skill created (Dev tooling, renamed from create-entity per user): one-line concept → integrated entity with per-type checklists, tone rules and verification gates; first consumer is the pending Mishu easter-egg draft
- 2026-06-12 — Draft batch 12 shipped same day: settings accessible from the pause screen (back-target param on showSettings, stepwise Esc routing via `pauseBack()`, save-wipe hidden mid-run); Playwright flow 9/9 incl. menu-path regression
- 2026-06-12 — Lifetime stats completed (P1): new save fields `uptimeSec` + `weaponDamage` (pure additions) feed "Accumulated uptime" and "Favorite weapon" codex rows; verified e2e (Playwright, abandoned-run accumulation)
- 2026-06-12 — Isolated play server shipped (Dev tooling, promoted by user): `npm run play` → frozen `dist-play/` snapshot served on :4180, immune to Claude's builds/HMR
- 2026-06-12 — Codex sprite thumbnails shipped (P1): baked sprite canvases → cached data-URL imgs next to every bug/boss entry (13/13 verified via Playwright + screenshot)
- 2026-06-12 — Draft batch 11 (bug): `dbg.time('6:00')` NaN-poisoned the run clock/audio — all numeric dbg params now coerce + reject non-finite input (devtoolsTest 24/24)
- 2026-06-12 — Draft batch 10: docker-for-isolated-play refined into "Isolated play server" (Dev tooling P2 — `npm run play` counter-proposal, no Docker dep); `dbg.give(id, n)` shipped same day (cards stack ×n, unowned weapons granted at level n; devtoolsTest 20/20)
- 2026-06-12 — Versioning + test-server infra per user: patch number now counts commits since the `vX.Y-base` tag (resets each minor; `v0.2-base` backfilled on the 0.2.0-dev bump commit → version corrected v0.2.59-dev → v0.2.48-dev), CI fetches tags; release policy gains the base-tag step. Test server moves off Netlify CI (credits): new `npm run deploy:test` = local `build:dev` + `netlify deploy --prod` upload (zero build minutes, dirty-tree guard); user stops builds/unlinks repo on Netlify side
- 2026-06-12 — Suspend & resume shipped (P1): full-fidelity run snapshot in the save (`runSave.ts`), SUSPEND PROCESS pause button + RESUME RUN menu button; snapshot consumed on resume (no reload-scum), unknown-id restores rejected. New suspendTest.ts (24 checks) + suspendUiTest.mjs (11 Playwright checks); no sim re-run needed (run.ts untouched, game logic unchanged)
- 2026-06-12 — **In-run build-quality separation certified — last open v0.2 P1, the difficulty directive is now fully demonstrated.** `matrix.cjs --scenario=` A/B over checked-in equal-budget presets (ada lv 12 @ 6:00, mortal, zero meta, n=16/arm): good build 63% wins / scattered 0% / no-build 0% on greenfield; good+greedy 94%. Marsh §6 question resolved: build-gated, not meta-gated (good zero-meta build wins 44%). No XP/balance change needed. Scenario `startMin` fixed to skip already-due bosses (was flooding mid-run scenarios with the boss backlog). BALANCE.md §5/§6 updated with targets + re-run commands
