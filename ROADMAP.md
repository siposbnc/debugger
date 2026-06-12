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

## 🎮 v0.4 — Modes & replayability  ← **current milestone**

### Map identity *(from draft 2026-06-12: maps should differ in WHAT you fight, not just weights — same direction as the v0.3 boss pools)*
- [ ] [P1] (L) **Per-map enemy pools via variants** — every map gets its own roster of ≥5 enemy types, and no two maps share the *exact* same type (overlap only as variants). Mechanism: **variants** — data records that reuse a base archetype's shape/behavior with a palette swap, stat shifts and at most one flag tweak (e.g. glacier "Frost Mite": mite shape, icy palette, slower but chills on contact; production "Panic Beetle": bigger blast). ~8 base archetypes fan out into 4 distinct rosters without 20 hand-drawn enemies — `EnemyDef` gains `variantOf` (sprite/behavior inherited, codex groups variants under the base entry or as their own dimmed sub-rows: decide at implementation). Spawn plans rewritten per map; sim re-cert across all maps (kill-rate crossover + meta gap are sensitive to enemy stat shifts). The v0.3 "+2 enemy types" item (spitter, shielded) feeds the pools if it rolls over
- [ ] [P2] (S) **Linus meta-scaling tune** — *from the v0.3 meta-depth check (BALANCE.md §6): helpers only inherit `damageMult`, so linus runs ~2× under ada at maxed meta.* Candidate direction: allies inherit more computed stats (crit), or an ally-keyed meta upgrade. Don't buff his zero-meta floor (already the strongest)
- [ ] [P2] (M) **The Printer** (boss) — *no one knows how it works.* Unpredictable mimic: its kit is other bosses' mechanics, drawn at random — never the same fight twice. Proposal: each phase (~25% HP) it "prints a copy of" a random standard boss's signature layer (diff-hunk volleys / heap globs / radial bursts / frame guard) with printer-flavored visuals (paper-jam pools, toner globs, PC LOAD LETTER banner). Open design question at implementation: standard-pool member on all maps (mimicry IS its identity, map-agnostic) vs a rare wildcard that can hijack any map's 12:00 finale slot (~10%?) — lean standard-pool, the wildcard dilutes the per-map finale identity just established in v0.3

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
- [ ] [P2] (M) Infinite meta-upgrade levels past current caps, exponential cost + diminishing returns — *this is the designed solve for the hard endgame (user ruling 2026-06-12): re-certify Cyber Glacier's maxed-meta band here (currently amended to 30–40%, BALANCE.md §5)*
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

*(resolved v0.2/v0.3-era issues are recorded in the [changelog](CHANGELOG.md))*

---

## ⚖️ Balance watchlist

Standing concerns to re-check after every content change (run `scripts/simulate.ts`).
Full target numbers live in [docs/BALANCE.md](docs/BALANCE.md) — this is the short list.
**Sims always run terrain-free** (user policy 2026-06-12 — obstacles/patches/events off,
hazards on; terrain has its own tests):

- Kill rate ≥ spawn rate before minute 6 for **every** starting weapon
- First boss TTK in 60–100s window
- **Meta gap** (BALANCE.md §5): harder maps stay near-unwinnable at zero meta on a good build (marsh ≤ 15%, production/glacier ~0%) while maxed meta keeps them winnable (≥ 40%; **glacier amended to 30–40%** by user ruling — v0.5 infinite meta levels are the endgame solve; **greenfield zero amended to ~20–35%**, the documented cost of the §8 wand dominance fix) — never tune the gap away
- `blades-cdr` tripwire: re-run after any Assertion Blades or CDR-source change (v0.3 verdict: the combo is legitimate high-risk ceiling, not an outlier — runaway = preset win rate climbing toward ~50%, currently 1–2/8)
- Weapon profile bands (BALANCE.md §8): `weaponSweep.cjs` zero + `--scaled` after any weapon change — outliers are profile-relative
- Bits/run drift: target ~300–700 early runs, ~1500–2100 strong victory; full shop ≈ 25–35 runs

---

## 💡 Backlog (unscheduled ideas)

Parking lot — promote into a milestone before working on these.

- *(demoted from v0.2 at release, P3s)*: Export/import save as JSON string (manual backup); **"Muscle Memory"** meta upgrade (3 levels softening the repeat-pick penalty 0.55 → 0.70 → 0.85 → 1.0); **Boss TTK investigation** (no config meets the 60–100s first-boss window under the auto-pick bot — separate bot artifacts (offer[0] picks, orbit radius vs short reach) from real boss-HP issues before tuning; the v0.3 weaponSweep brawl-bot work partially addressed the short-reach artifact); Exception Beetle density above minute 10 (explosion stacking)
- *(demoted from v0.3 at release, P3s)*: Meta upgrade **decrease boss spawn timer** (open question: is "harder sooner" something players pay Bits for? maybe a v0.4 curse instead); **+6 objectives** covering the v0.3 content (one per new map/boss/weapon class) + hardcore full-run challenges: **"Don't get hit"** (whole 15:00 run; shield absorbs don't count) and **"Don't move"** (whole run — ultimate turret-build check)
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

- 2026-06-12 — **v0.3 released** (`v0.3.50`, release/0.3 → main): see [CHANGELOG.md](CHANGELOG.md). dev bumped to 0.4.0-dev (`v0.4-base`); v0.3 P3s demoted to Backlog (no unchecked P2s)
