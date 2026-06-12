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
- **On release** (trigger: **all `[P1]` items in the milestone checked** — the cut is then mechanical, not a judgment call): add the milestone's player-facing entry to `src/data/patchNotes.ts` (in-game "What's new" screen) *before* cutting so the release build ships its own notes; cut `release/X.Y` from `dev` (drop the `-dev` suffix there, tag, point `main` at it — full policy in CLAUDE.md), then **move the milestone section out of this file into [CHANGELOG.md](CHANGELOG.md)** — rewritten as a clean release entry (what shipped, past tense; note anything dropped/deferred). Unchecked `[P2]`s move into the next milestone; unchecked `[P3]`s drop to the Backlog (promote explicitly to save one). Then bump `dev` to the next minor `-dev` and tag that bump commit `vX.Y-base` (+ push the tag) — the version's patch counter restarts from it. The roadmap only tracks unshipped work; history lives in the changelog. Hotfixes on `release/X.Y` bump the shown version automatically (commit-count patch number).
- Detailed design rationale lives in [docs/DESIGN.md](docs/DESIGN.md); the original brief is `Debugger_Game_Design_Brief.md`. This file tracks **execution**, those track **intent**.

---

## 📦 v0.3 — Content expansion  ← **current milestone**

Goal: more reasons to do "one more run". Content is data-driven — most items here are
records in `src/data/` plus a behavior key in `src/game/` and a sprite in `src/render/sprites.ts`.

### Maps (target: +2, total 4)
- [x] [P1] (L) **Production Server** — industrial server room; hazard: overheating floor vents (periodic damage zones); enemy skew: exception beetles + deadlock scarabs; ×1.5 Bits — *done: 1200 ⌬ unlock; 24 staggered vents (9s cycle: grate → 1.6s warning glow → 2.2s eruption @ 26 dps, player-only like all zones; telegraph drawn from the same `ventPhase()` the damage uses), `vent` RunEvent → ember column + steam SFX (0.6s throttle); beetles from min 0, scarabs from min 3, late beetle weight capped at 5 (explosion-stacking Backlog concern); MapDef gained `icon` (select-card ternary retired); objectives `prodSoak`/`prodWin`; suspend/resume free via existing zone snapshots. Sim: max+nia victories (Bits 3566/3345 — over the ~3150 ×1.5 ceiling by exactly the first-clear +1200 objective stack, monitor at re-cert), ada/syntaxWand fails via crunch (consistent with known marsh fragility — the weakest starter SHOULD fail the priciest map); greenfield regression clean (2138). BALANCE.md needs a productionServer band at the already-flagged re-certification*
- [ ] [P1] (L) **Cyber Glacier** — frozen processes; hazard: latency fields (player + enemy slow zones); enemy skew: tanks; ×1.5 Bits
- [ ] Each new map needs: palette, spawnPlan, bossOrder, 1 unique hazard, 1–2 map objectives, shop unlock entry, codex entry
- [ ] [P2] (L) **Terrain & obstacles** — maps stop being featureless planes: impassable blockers (server racks, crashed processes) and terrain patches (e.g. slow zones distinct from hazards). Scope check before starting: needs collision for player *and* enemies (spatial hash covers entities, not static geometry yet), enemy steering around blockers (flow-field or simple slide-along — full pathfinding is overkill), isometric draw-order sorting for tall props, and spawn-point validation. Keep obstacle layout data-driven per map (seeded `mulberry32` like decoration) so the sim stays headless. Start with 1 obstacle type on one map as a vertical slice

### Bosses (target: +3, total 8)
*(user 2026-06-12: shared boss pools across maps won't stay fun — maps need unique fights,
not just themes. Framework in DESIGN.md §13: **standard** bosses fill the 2-minute slots from
a shared, per-map-filtered random pool; each map gets exactly one **unique** finale boss.)*
- [ ] [P1] (M) **Boss tier system** — `BossDef.tier: 'standard' | 'unique'`; maps swap `bossOrder` for a weighted `bossPool` (standard slots drawn randomly, with per-map filtering) + one `uniqueBoss` finale (fixed late-run slot, e.g. 12:00, bigger kit). Provisional uniques: Legacy Monolith → Greenfield, Critical Exception → Marsh, Production Incident → Production Server, Cyber Glacier's TBD with the map. Land together with the +3 bosses below so the standard pool doesn't go thin
- [ ] [P1] (M) **The Race Condition** — teleports unpredictably, leaves a damaging afterimage copy; joins the **standard pool**. Needs a bullet layer (DESIGN §13: bullet heaven by default) or explicit compensating pressure
- [ ] [P1] (M) **The Critical Exception** — huge telegraphed AoE slams (dodge-window boss); **Memory Marsh's unique finale**
- [ ] [P1] (M) **The Production Incident** — finale boss combining two prior mechanics; **Production Server's unique finale**
- [x] [P1] (S) **Crunch Time** *(user 2026-06-12)* — bosses alive at 15:00 are release blockers: 30s overtime; any blocker outliving it fails the run ("RELEASE SLIPPED"). Outliving bosses no longer wins. *Punishment rework same day (user: "punishment, not an option to save the run"): trash is no longer descoped — every live bug **goes critical** (+50% dmg, +30% speed, red ring visual) and stays; overtime hatches (Monolith breeding, stack frames) are born critical; straggler recycling keeps running so the critical horde can't be kited off; only new spawns freeze. Player adrenaline buffs kept (+50% dmg / +15% speed) so a strong build retains a real shot*
- [x] [P1] (M) **Boss feedback round 2** *(user 2026-06-12)* — Merge Conflict died too fast post-split (enrage never fired) + most bosses should be bullet heavens. Done: split halves 35% → **55%** of the original pool each (post-split is now the longer half of the fight), aimed diff-hunk volleys (3-fan whole, 4-fan per half, enraged half at ×0.55 period), enrage gap 30% → 25% (off 12%); Memory Leak lobs heap globs that splash short-lived puddles (`EnemyShot.splash`; permanent-pool cap ignores splashes); Stack Overflow fans 3 → 5 shots. "Bullet heaven by default" written into DESIGN.md §13 — Monolith stays the canonical no-shots exception (pillars + breeding + bulk)
- [x] [P1] (M) **Boss mechanics pass** — *user: existing bosses feel like different attack patterns, not unique fights — and they should be a challenge without a proper build, not just dodge/kite checks.* — *done: all 5 starter proposals implemented as second layers (design + numbers in DESIGN.md §13, tuning constants atop `bossLogic.ts`): Merge Conflict diff tether + force-push enrage on >30% HP gap (hysteresis 15%); Memory Leak permanent pools (cap 28, oldest paged out, death frees all); Infinite Loop position snapshot → 2.5s-later rewind (ground marker); Stack Overflow 50% resist while frames live + stack-pop 2.5s stun (10s cd); Legacy Monolith 3 Deprecated Dependency pillars (new stationary shot-soak enemy, NOT A BUG codex entry) — *feedback round: armor holds until ALL pillars die (no timer), pillars orbit the boss (kiting must not out-range them — sim-caught), it breeds bugs from the map pool every 8s (≤300 alive), split halves both start at full bars, and resist/enrage states got explicit visuals (shield ring, frame pips, '!!')*. Unified `Enemy.armorMult` resist, 7 new RunEvents (banners/marker/SFX), suspend/resume-safe. Verified: build clean; sim 4 runs (ada+max+nia greenfield, ada marsh) all victories, no watchlist regression — first-boss TTK window remains the pre-existing Backlog issue (bosses now die slower, not faster); Bits 1948–2215 greenfield (~band ceiling), 2731 marsh (×1.25 map)*

### Difficulty & meta-gating *(user 2026-06-12: the game should feel a lot harder; meta upgrades currently serve no purpose — harder maps must be near impossible without them, even on a good build. Core design pillar, see DESIGN.md §2.5)*
- [x] [P1] (M) **Per-map enemy scaling** — new `MapDef.enemyScale` (enemy + boss HP/damage mult): greenfield 1.0, marsh 1.2, production 1.35. Certified meta gap (good-build scenario, greedy, n=16/arm): greenfield 38% zero-meta → 69% maxed; marsh 12.5% → 56%; production **0% → 50%**. New targets + superseded "build-gating by design" ruling recorded in BALANCE.md §5
- [x] [P1] (S) **Card tuning pass** *(user: some cards give stupidly strong stats)* — structural stack caps: rares ×3, epics ×2 (default was ×5 — e.g. 5× Compiler Blessing = +150% dmg +40% CDR), depInjection ×2; value trims (garbageDay 22→18%, breakpointTrap 16→12%, compilerBlessing 30→25%, raceCondition 22→16% CDR); joke downsides made real (mergeConflictCard −10→−25 HP, infiniteLoopCard −5→−12% dmg). Legendaries untouched (×1, that's their job). `blades-cdr` scenario updated to max legal CDR; offerTest assertions still green
- [ ] [P2] (S) **Meta shop depth check** — with meta now mandatory (pillar 5), verify the 9,425 ⌬ shop gives enough headroom to carry production-tier maps before v0.5 infinite levels land; revisit `linus under-scales with meta` (BALANCE.md §6) as part of it

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
- [x] [P1] (S) **Rex Intern** — Intern; starts with random weapon; passive: +30% XP, −20% max HP (high risk beginner-luck char) — *done: `special: 'randomWeapon'` (new CharacterDef special) — starter drawn in the Run constructor from the run's offerable pool (base weapons only), so it grows with shop unlocks and stays DOM-free; char select shows "Random weapon"; suspend/resume safe (restore replaces constructor weapons). Cost 350 ⌬ (between max 250 / nia 450). Verified: build clean; sim-verifier 3×rex+1×ada 15-min victories, all watchlist items at baseline (Bits 2157–2183, ~XP-passive-driven, ruled fine); 10-draw starter distribution covered all 4 pool weapons*
- [ ] [P1] (S) **Sec Hexa** — Security Engineer; starts Firewall; passive: thorns (returns 20% contact damage)
- [ ] [P1] (S) **Dana Tensor** — Data Scientist; starts Ping Storm; passive: pickups give +1% stacking damage per 100 XP (scaling late-game)
- [ ] [P1] (S) **Greybeard Cobol** — Legacy Maintainer; starts Stack Staff; passive: immune to slows, −15% move speed (tank archetype)

### Progression & discovery *(from draft 2026-06-12)*
- [ ] [P1] (M) **Progressive meta-upgrade unlocks** — shop upgrades start hidden/locked; acquiring a stat-modifier card of that stat in any run unlocks the corresponding meta upgrade for purchase. Locked entries show as silhouetted "???" rows (cost hidden) so the shop has discovery pull. Cards whose stat has a still-locked upgrade get a small visual hint in the level-up modal ("unlocks a meta upgrade") — ties run picks to meta progression. Save: `unlockedMeta` id set, pure addition. Decide at implementation: weapons' meta upgrades (if any are weapon-keyed) unlock via owning the weapon once
- [ ] [P1] (S) **Progressive codex unlocks** — bug/boss entries start locked and reveal when the entity is first encountered (spawned on screen / boss announced); locked entries render dimmed with a "?" thumbnail and glitched/unreadable text (procedural scramble of the real copy, stable per entry). Save: reuse the existing `seenIds` machinery (`bug:`/`boss:` keys already exist — encounter-time marking instead of codex-open marking for the reveal). The Precipitate stays unlisted until collected (it's already a secret)
- [x] [P1] (S) **"What's new" screen** *(from draft 2026-06-12)* — main-menu entry listing player-facing release notes (newest first) so returning players learn what changed. Content is a curated data record in `src/data/` (one entry per release, player tone, highlights only) — **not** CHANGELOG.md verbatim (dev-facing, not bundled; zero-external-assets rule applies); writing the entry becomes a step in the release checklist. Save: `lastSeenVersion` (pure addition) — the menu button shows a "NEW" badge when the running version is newer than the stored one, cleared on open. Reuses the codex-style menu chrome; flavor welcome, mechanics text literal per tone convention — *done: `src/data/patchNotes.ts` (v0.1 + v0.2 entries authored), WHAT'S NEW button with `new-dot` badge; badge keys off the newest notes entry vs `lastSeenVersion` (works on dev builds where the running minor has no notes yet; fresh saves badge once by design). Release checklists in CLAUDE.md + this file gained the "author the entry before cutting" step. Verified: build clean; one-off Playwright flow, 12 checks (badge, newest-first + NEW tag, persistence across reload, revisit unbadged)*

### Cards & enemies
- [ ] [P2] (M) **Shield system** — new defensive layer on top of HP (0 by default): absorbs damage first, and shield hits don't count as "real" damage (won't fail no-hit objectives). Includes new Shield stat cards + **"Starting Shield"** meta upgrade. Decide at design time: does shield regenerate (out-of-combat delay?) or only refill via pickups/cards?
- [ ] [P2] (M) +8 stat cards (fill thin categories: status effects, chain, summons — see brief; Shield cards counted under the shield-system item)
- [ ] [P2] (M) +2 enemy types: ranged spitter (forces movement), shielded enemy (directional block)
- [ ] [P3] (S) Meta upgrade: **decrease boss spawn timer** (bosses arrive sooner → faster, riskier runs). Open question: is "harder sooner" something players will pay Bits for? Decide when implementing — maybe frame as a curse-style toggle (v0.4) instead of a meta buy
- [ ] [P3] (S) +6 objectives covering the new content (one per new map/boss/weapon class) + hardcore full-run challenges from draft: **"Don't get hit"** (whole 15:00 run; shield absorbs don't count once the shield system lands) and **"Don't move"** (whole run — ultimate turret-build check)

### QoL roll-over (unfinished v0.2 P2s)
- [ ] [P1] (M) Minimap or edge-radar showing boss, elites, chests — *in-run events (v0.4) will want this too*
- [x] [P2] (S) Remappable keys in settings — *done: `settings.keys` (action → KeyboardEvent.code, pure save addition); rebindable Move up/down/left/right + Pause via click-to-capture rows (Esc cancels, duplicate codes move to the new action, binding the default clears the custom); arrows + Esc stay fixed fallbacks so the game is never unplayable; "reset binds" row when any custom exists. Verified via one-off Playwright flow (11 checks: capture, persist across reload, rebound pause key pauses a live run, reset)*
- [x] [P2] (S) Volume sliders split: master / music / SFX (currently single toggle-ish) — *done: SFX/music sliders already existed; added the missing `settings.master` (pure save addition, default 1.0) as a multiplier on both gain nodes + a Master slider row above them*
- [x] [P2] (S) Reduce-flash mode (tone down screen flash + shake for photosensitivity) — *done: `settings.reduceFlash` toggle (default off) — full-screen overlays (level-up/evolve/victory cyan, hurt red) drop to 25% intensity and screen shake to 35% magnitude; per-sprite hit flashes untouched (small-area, not a photosensitivity risk)*
- [x] [P2] (M) FPS safeguard: auto-lower particle density when frame time >20ms (the v0.2 FPS counter is the verification surface). *note: do not lower enemy cap as it changes with the difficulty balance* — *done: all particle spawns routed through `spawnParticle()` (probabilistic drop + 900 hard cap); density sheds fast (−0.5/s, floor 15%) while the frame-time EMA exceeds 20ms and recovers slowly (+0.08/s) under 15ms. Enemy cap untouched by construction. Effects other than particles (rings/beams/banners) unaffected*

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

## 📱 v0.6 — Mobile *(from draft 2026-06-12: "full mobile support — v0.6 could be focusing on this entirely")*

Goal: the touch-controls foundation (v0.2) becomes a genuinely playable phone experience.
Design questions are open — treat items as scoping placeholders until this milestone is current.

- [ ] [P1] (L) **Responsive UI pass** — all menus + the level-up card modal usable on phone portrait/landscape (cards are the worst offender today: fixed-width row, hover-dependent tooltips). Audit every screen at 360×640 / 390×844 / landscape; tap targets ≥ 44px; card stat previews must work without hover
- [ ] [P1] (M) **Viewport vs combat range** — on small screens, spawning and most ranged combat happens off-screen (spawn ring + weapon reach exceed the visible area). Open design question (draft: "how to solve this??") — candidate directions to evaluate: dynamic zoom-out floor (render scale tied to viewport), spawn-ring radius tied to visible area (balance impact — sim must model it), or edge indicators for off-screen action. Needs a design decision before implementation
- [ ] [P2] (S) **Mobile menu footer hints** — main-menu footer key hints are compressed and wrong on mobile (keyboard hints on a touch device); show touch-appropriate hints, or hide them when touch is the active input
- [ ] [P3] (S) PWA manifest + icon (installable, fullscreen standalone) — cheap once the above land

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

*(none open — v0.2-era fixes are recorded in the [changelog](CHANGELOG.md))*

---

## ⚖️ Balance watchlist

Standing concerns to re-check after every content change (run `scripts/simulate.ts`).
Full target numbers live in [docs/BALANCE.md](docs/BALANCE.md) — this is the short list:

- Kill rate ≥ spawn rate before minute 6 for **every** starting weapon
- First boss TTK in 60–100s window
- **Meta gap** (BALANCE.md §5): harder maps stay near-unwinnable at zero meta on a good build (marsh ≤ 15%, production ~0%) while maxed meta keeps them winnable (≥ 40%) — never tune the gap away
- Assertion Blades + cooldown stacking (strongest known combo; `blades-cdr` scenario)
- Bits/run drift: target ~300–700 early runs, ~1500–2100 strong victory; full shop ≈ 25–35 runs

---

## 💡 Backlog (unscheduled ideas)

Parking lot — promote into a milestone before working on these.

- *(demoted from v0.2 at release, P3s)*: Export/import save as JSON string (manual backup); **"Muscle Memory"** meta upgrade (3 levels softening the repeat-pick penalty 0.55 → 0.70 → 0.85 → 1.0); **Boss TTK investigation** (no config meets the 60–100s first-boss window under the auto-pick bot — separate bot artifacts (offer[0] picks, orbit radius vs short reach) from real boss-HP issues before tuning; single-weapon scenarios in the v0.3 balance patch will help); Exception Beetle density above minute 10 (explosion stacking)
- More biomes: Stack Canyon, Cloud Citadel, Firewall Bastion, Legacy Ruins, Nullwood Forest, Memory Marsh hard-mode
- Passive item slots (separate from stat cards, Vampire-Survivors-style item grid)
- Boss codex lore entries ("post-mortem reports" written as incident reviews)
- Pet cosmetics for Daemon Familiar
- Photo mode / screenshot key with HUD hidden
- Speedrun timer + splits per boss
- Mod support: load extra `data/` JSON from user folder (desktop build)
- Cloud save sync / accounts — needs a backend + auth; **don't** build before desktop wrap exists. Ship the export/import-as-JSON backlog item first as the manual version; revisit only if there's a real multi-device audience

---

## 🛠️ Dev tooling (do alongside any milestone)

- [ ] [P3] (S) Save editor dev page (`?saveeditor` flag): view/edit the parsed localStorage save as a form, builds on the export/import item

---

## 📜 Progress log

> One line per meaningful session/merge: date — what changed. (Work-in-progress journal for the
> current milestone — on release these lines inform the [CHANGELOG.md](CHANGELOG.md) entry and are pruned.)

- 2026-06-12 — **Difficulty overhaul** (user directive: game much harder, meta upgrades must matter): per-map `enemyScale` meta-gating (marsh 1.2 / production 1.35; production certified **0%** win at zero meta on a good build vs 50% maxed — DESIGN.md pillar 5, BALANCE.md §5 rewritten); card stack caps (rares ×3, epics ×2) + outlier trims; **boss round 2** (Merge Conflict durable split 55% + diff-hunk volleys, Memory Leak heap globs, Stack Overflow 5-fans, "bullet heaven by default" rule); **Crunch Time is now a punishment** — bugs go critical (+50% dmg +30% speed, stay on the field) instead of despawning. Boss-tier framework (shared standard pool + one unique finale per map) designed into DESIGN.md §13 / roadmap, lands with the +3 bosses. Watchlist green (offer test, kill-rate crossover, Bits bands)
- 2026-06-12 — **Production Server map shipped** (v0.3 P1, map 3 of 4): ×1.5 Bits / 1200 ⌬, overheating floor-vent hazard (telegraphed periodic damage zones — first new GroundZone kind since marsh), beetle+scarab skew, 2 objectives. Sim-verified ×3 chars + greenfield regression; ada/syntaxWand can't clear it (intended difficulty ceiling, watch at re-cert)
- 2026-06-12 — **Banner-under-blur bug fixed** (draft batch 16): banners moved to a dedicated `#banners` canvas above the UI layer — level-up/pause overlays no longer hide active banner text
- 2026-06-12 — **Boss feedback round + Crunch Time shipped**: split halves start at full bars; Monolith armor needs ALL pillars dead (orbiting pillars — three sim rounds tuned reachability), breeds bugs every 8s; resist/enrage states got explicit visuals. New **Crunch Time** mechanic: bosses alive at 15:00 → 30s ship-or-slip overtime, surviving blockers fail the run. BALANCE.md win targets flagged for re-cert
- 2026-06-12 — **Boss mechanics pass shipped** (v0.3 P1): every boss now two-layered — pattern (movement) + build test (DPS check / soft enrage / interrupt). Merge Conflict tether+enrage, Memory Leak permanent pools freed on death, Infinite Loop position rewind, Stack Overflow frame-guard+pop stun, Legacy Monolith breakable dependency pillars. DESIGN.md §13 rewritten; sim-verified on both maps ×3 chars, no watchlist regression
- 2026-06-12 — **"What's new" screen shipped** (v0.3 P1): `src/data/patchNotes.ts` player-facing notes (v0.1/v0.2 authored), main-menu entry with `lastSeenVersion`-driven NEW dot, release checklist now includes authoring the entry pre-cut. Playwright-verified (12 checks)
- 2026-06-12 — **v0.2 released** (`v0.2.67`, release/0.2 → main): see [CHANGELOG.md](CHANGELOG.md). dev bumped to 0.3.0-dev (`v0.3-base`); v0.2 P2 QoL rolled into v0.3, P3s demoted to Backlog
- 2026-06-12 — Three QoL roll-overs shipped in one settings/render pass: master volume slider (multiplier over SFX/music gains), reduce-flash mode (full-screen flash 25% / shake 35% when on), FPS particle safeguard (spawn probability sheds at >20ms frame EMA, floor 15%, hard cap 900; enemy cap untouched). All pure save additions, game logic untouched (no sim re-run needed)
- 2026-06-12 — **Rex Intern shipped** (first v0.3 character, P1): `randomWeapon` special draws the starter from the run's weapon pool, +30% XP / −20 max HP, 350 ⌬. Sim-verified (3 rex + 1 ada regression, all victories, watchlist at baseline)
- 2026-06-12 — Remappable keys shipped (last S-sized QoL roll-over): click-to-capture rebinding for movement + pause with fixed arrow/Esc fallbacks, conflict stealing, reset row; Playwright-verified incl. rebound-pause on a live run
