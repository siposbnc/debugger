# 🗺️ DEBUGGER — Roadmap

> **This is the single source of truth for what to build next and what's done.**
> Claude: read this file at the start of every work session, pick up the highest-priority
> unchecked item (unless told otherwise), and check items off here when they're complete.
> Human: edit freely — reorder, add, remove, re-prioritize. Whatever this file says, goes.

## How to use this file

- `- [ ]` = not started · `- [x]` = done · `- [~]` = in progress / partially done
- Tags: `[P1]` do next, `[P2]` soon, `[P3]` someday. `(S/M/L)` = rough effort (hours / a day / multi-day).
- Items inside a milestone are roughly ordered top-to-bottom by priority.
- New ideas go to the **💡 Backlog** at the bottom first; promote them into a milestone when committed.
- **Idea intake:** raw ideas are scribbled in [docs/DRAFT.md](docs/DRAFT.md). Claude refines them, integrates them here, then moves them under the "Processed" section of the draft. Don't work directly from the draft.
- **On release** (milestone fully checked): bump the version in `package.json`, tag the commit, then **move the milestone section out of this file into [CHANGELOG.md](CHANGELOG.md)** — rewritten as a clean release entry (what shipped, past tense; note anything dropped/deferred). The roadmap only tracks unshipped work; history lives in the changelog.
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
- [ ] [P2] (S) Run summary split: objectives/achievements block visually separated (divider) from the itemized Bits-by-stat breakdown
- [ ] [P2] (S) Health bar above the player character (toggleable in settings, default on)
- [ ] [P2] (S) Heal feedback: green floating number + brief glow on the player whenever HP is restored (coffee, Heap Purifier, regen ticks ≥1)
- [ ] [P2] (S) Bug database: render entity sprite thumbnails next to entries (sprites are procedural — draw to offscreen canvas once, cache)
- [ ] [P2] (S) Bug database: lifetime player stats page — accumulated uptime, total kills, total Bits earned, runs played, victories, bosses slain, favorite weapon
- [ ] [P2] (M) Minimap or edge-radar showing boss, elites, chests
- [ ] [P2] (S) Card tooltips in level-up modal: show resulting stat ("dmg 34 → 38"), not just "+8%"
- [ ] [P2] (S) "NEW" badge in codex/shop for unseen entries
- [ ] [P3] (S) Run-end screen: show per-weapon damage breakdown

### Controls & accessibility
- [x] [P1] (M) Keyboard navigation in **all** menus + card selection (WASD/arrows + Enter/Space, Esc = back) — do this first, it's the foundation gamepad menu support reuses — *done: `src/ui/kbnav.ts` — spatial (geometry-based) roving highlight, works on every screen incl. level-up cards, shop, sliders (←/→ adjust) and pause; focus survives screen re-renders (purchase/reroll); gamepad can drive `move()`/`activate()` directly. Esc backs out of menus / cancels banish mode; pause keeps Esc/P in the main loop to avoid double-toggle. Verified end-to-end with a Playwright run-through (menus, buy, level-up pick, abandon, summary)*
- [ ] [P1] (M) Gamepad support (move + menu navigation, standard mapping)
- [ ] [P2] (S) Remappable keys in settings
- [ ] [P2] (S) Volume sliders split: master / music / SFX (currently single toggle-ish)
- [ ] [P2] (S) Reduce-flash mode (tone down screen flash + shake for photosensitivity)
- [ ] [P3] (M) Touch controls (virtual stick) — unlocks mobile browser play

### Robustness & tech debt
- [x] [P1] (S) Save-data versioning + migration shim (before any content patch changes shapes) — *done: `SAVE_VERSION` + stepwise `MIGRATIONS[n]` (n → n+1) run before the defaults merge; pure field additions still need no migration. Newer-than-current saves pass through untouched and unknown fields survive a persist round-trip (safe downgrade). Verified with a Node localStorage-stub test (legacy, future-version, corrupt saves)*
- [ ] [P1] (S) `npm run build` + `tsc --noEmit` clean check wired into a pre-commit or CI script
- [ ] [P2] (S) Pause game on tab blur (currently can die in background?)— verify & fix
- [ ] [P2] (M) FPS safeguard: auto-lower enemy cap / particle density when frame time >20ms
- [ ] [P3] (S) Export/import save as JSON string (manual backup)

### Card system rework
- [ ] [P1] (M) Repeat-pick penalty: picked cards get less likely to reappear, for offer variety.
  **Proposed formula** (tune in sim): stat card `weight × 0.55^timesPicked` (floor 8% of base);
  weapon level-up cards get a gentler `weight × 0.85^currentLevel` (they must stay findable to
  reach max level + evolution). Banished cards stay at weight 0 as today.
- [ ] [P2] (S) Meta upgrade **"Muscle Memory"** (3 levels): softens the repeat penalty
  (0.55 → 0.70 → 0.85 → 1.0 effectively off) — lets build-focused players buy back consistency
- [ ] [P1] (S) Rework **Skip** — currently gives nothing, so it's strictly worse than any pick.
  **Proposal:** Skip = "Defer": bank 20% of the next level's XP requirement (momentum without power).
  Alternative if too strong: flat +5 ⌬ live Bits. Decide, implement, kill the dead button.
- [x] [P1] (S) Verify rarity weighting math end-to-end (suspected cause of "legendary too common" bug below) — add a `scripts/offerTest.ts` assertion: over 10k offers at luck 0, legendary rate ≈ 1.4%/card — *done: weights were per-card, now per-tier split across available cards; assertion passes at 1.40%*

### Balance pass (sim-driven, see DESIGN.md §27)
- [ ] [P1] (S) **Balance goal sheet**: write `docs/BALANCE.md` documenting target numbers (TTK windows, kill-rate floors, Bits/run bands, rarity rates, level curve timing) — the sim and watchlist check against this instead of tribal knowledge
- [ ] [P1] (M) Run simulator matrix (4 chars × 2 maps × 15 min), record kill-rate vs spawn-rate per minute; fix any char that falls behind before min 6
- [ ] [P2] (S) Tune Assertion Blades + cooldown-build scaling (flagged as outlier)
- [ ] [P2] (S) Exception Beetle density above minute 10 (explosion stacking)

---

## 📦 v0.3 — Content expansion

Goal: more reasons to do "one more run". Content is data-driven — most items here are
records in `src/data/` plus a behavior key in `src/game/` and a sprite in `src/render/sprites.ts`.

### Maps (target: +2, total 4)
- [ ] [P1] (L) **Production Server** — industrial server room; hazard: overheating floor vents (periodic damage zones); enemy skew: exception beetles + deadlock scarabs; ×1.5 Bits
- [ ] [P2] (L) **Cyber Glacier** — frozen processes; hazard: latency fields (player + enemy slow zones); enemy skew: tanks; ×1.5 Bits
- [ ] Each new map needs: palette, spawnPlan, bossOrder, 1 unique hazard, 1–2 map objectives, shop unlock entry, codex entry

### Bosses (target: +3, total 8)
- [ ] [P1] (M) **The Race Condition** — teleports unpredictably, leaves a damaging afterimage copy
- [ ] [P2] (M) **The Critical Exception** — huge telegraphed AoE slams (dodge-window boss)
- [ ] [P2] (M) **The Production Incident** — 12:00+ finale boss combining two prior mechanics, only on ×1.5 maps

### Weapons (target: +4 with evolutions, total 12)
- [ ] [P1] (M) **Fork Bomb** — thrown bomb that splits into smaller bombs → evolves **Zip Bomb** (recursive splits)
- [ ] [P1] (M) **Firewall** — directional flame wall in movement direction → evolves **DMZ** (surrounding ring)
- [ ] [P2] (M) **Ping Storm** — homing packets at random enemies → evolves **DDoS** (massive packet flood)
- [ ] [P2] (M) **Sudo Scroll** — rare massive single-target smite → evolves **Root Access** (executes non-boss enemies below 15% HP)

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
- [ ] [P1] (M) **In-run events** — bug nests to destroy / broken terminals to repair on the map for bonus chests. *Promoted to P1: currently nothing motivates the player to actually move around the map — this is the fix.* Spawn 1 event per ~90s at a distance, marked on the radar/minimap, despawns after 45s if ignored
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
- [x] [P2] (S) Projectile-count modifier doesn't apply to Max Pipeline's turret — decide: design (turrets are fixed) or bug. Lean **bug**: passives feeling upgrade-dead is worse; apply at reduced rate (e.g. +1 projectile per +2 player projectiles) if full scaling is too strong. - Decision: it's a bug. Go with full scaling. — *fixed: turret fires 1 + player projectile bonus bolts with the same shared-target spread as weapon bolts; Max sim run within normal bands*

---

## ⚖️ Balance watchlist

Standing concerns to re-check after every content change (run `scripts/simulate.ts`):

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
- Daily login… no. (Anti-idea: keep it honest, no retention mechanics)
- Pet cosmetics for Daemon Familiar
- Photo mode / screenshot key with HUD hidden
- Speedrun timer + splits per boss
- Mod support: load extra `data/` JSON from user folder (desktop build)
- Cloud save sync / accounts — needs a backend + auth; **don't** build before desktop wrap exists. Ship the v0.2 export/import-as-JSON item first as the manual version; revisit only if there's a real multi-device audience

---

## 🛠️ Dev tooling (do alongside any milestone)

- [ ] [P2] (M) **Simulation scenarios**: `simulate.ts` accepts a scenario preconfig (JSON file or named preset): starting state (char, map, level, weapons + levels, taken cards, meta levels), card-pick strategy, time window — run starts *from* that state instead of fresh. For reproducing bug reports and testing specific builds; directly serves the balance-pass items (e.g. the "Assertion Blades + cooldown stacking" watchlist entry becomes a checked-in scenario)
- [ ] [P2] (S) Claude skill **`create-entity`** (`.claude/skills/create-entity/SKILL.md`): given a one-line concept, generates a complete entity record (weapon/enemy/boss/card/character) in the right `src/data/` file with a name + flavor text matching the game's dev-culture humor, a behavior key, and a sprite stub — plus reminds to add codex + objective entries
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
