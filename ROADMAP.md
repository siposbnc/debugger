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
- [~] [P1] (L) **Per-map enemy pools via variants** — *in progress (2026-06-17): foundation + Marsh + Production rosters shipped; Glacier remains, plus a Marsh bespoke-sprite retrofit (it shipped as palette reskins before the "most should look unique" ruling).* every map gets its own roster of ≥5 enemy types, and no two maps share the *exact* same type. **User ruling 2026-06-17: reskins are fine for *some*, but *most* of each map's roster should be visually unique — bespoke sprites tailored to the map, not just palette swaps.** Variants still reuse a base archetype's *behaviour* (so `game/` is untouched) while overriding the *shape* with a new drawer. Mechanism: **variants** — data records that reuse a base archetype's shape/behavior with a palette swap, stat shifts and at most one flag tweak (e.g. glacier "Frost Mite": mite shape, icy palette, slower but chills on contact; production "Panic Beetle": bigger blast). ~8 base archetypes fan out into 4 distinct rosters without 20 hand-drawn enemies — `EnemyDef` gains `variantOf` (sprite/behavior inherited, codex groups variants under the base entry or as their own dimmed sub-rows: decide at implementation). Spawn plans rewritten per map; sim re-cert across all maps (kill-rate crossover + meta gap are sensitive to enemy stat shifts). The v0.3 "+2 enemy types" item (spitter, shielded) feeds the pools if it rolls over
- [ ] [P2] (S) **Linus meta-scaling tune** — *from the v0.3 meta-depth check (BALANCE.md §6): helpers only inherit `damageMult`, so linus runs ~2× under ada at maxed meta.* Candidate direction: allies inherit more computed stats (crit), or an ally-keyed meta upgrade. Don't buff his zero-meta floor (already the strongest)
- [ ] [P2] (M) **The Printer** (boss) — *no one knows how it works.* Unpredictable mimic: its kit is other bosses' mechanics, drawn at random — never the same fight twice. Proposal: each phase (~25% HP) it "prints a copy of" a random standard boss's signature layer (diff-hunk volleys / heap globs / radial bursts / frame guard) with printer-flavored visuals (paper-jam pools, toner globs, PC LOAD LETTER banner). Open design question at implementation: standard-pool member on all maps (mimicry IS its identity, map-agnostic) vs a rare wildcard that can hijack any map's 12:00 finale slot (~10%?) — lean standard-pool, the wildcard dilutes the per-map finale identity just established in v0.3

- [ ] [P1] (L) **Endless mode — "Normal Work Hours" & overtime** — *(refined from draft 2026-06-13, reframed 2026-06-17)* the work-hours pun restructures **Endless mode only** — **normal runs are unchanged (still 15:00 → victory); the base game loop and its balance baseline stay exactly as they are** *(user clarification 2026-06-17)*:
  - **Per-map unlock**: clearing a map normally (the 15:00 victory) unlocks Endless *for that map only* — pre-run toggle on its map-select card, hidden until earned. Needs the `mapVictories` per-map win counter (shared with the gated-map-progression item below).
  - **Inside an Endless run, "Normal Work Hours" run 8:00** *(draft 2026-06-17: an 8-hour workday → 8 minutes)* — a compressed workday so you reach the interesting content fast; the clock **past 8:00 is "Overtime."** This 8:00 boundary lives in Endless mode, not the base game. (Open at implementation: does Endless reuse the map's 15-min `spawnPlan` and just start overtime scaling at 8:00, or get a compressed 8-min plan? Lean reuse-plus-early-overtime to avoid authoring a second per-map table — decide when building.)
  - At the 8:00 boundary the Bits payout **banks immediately** (an overtime death never forfeits it — otherwise nobody opts in twice); boss order reshuffles from the map's `bossPool`, the unique finale re-enters the pool at elevated `bossTier`; `difficulty()` gains an **exponential overtime term** keyed off 8:00 (draft: "exponential scaling after [normal hours]" — e.g. hp/damage ×~1.06–1.08 per overtime minute, tuned so even god-tier builds collapse a fixed span in: every endless run has a definite end, which is what makes best-time-per-map a real leaderboard stat in the codex). Overtime's "more generous rewards" framing = a Bits/Credits multiplier that ramps with the minute, paying for the rising risk. **Balance is Endless-scoped** — opt-in harder content like curses; it doesn't touch the normal-run sim baseline
- [ ] [P1] (M) **Curses / difficulty modifiers** — pre-run toggles (e.g. "−25% pickup radius", "+50% enemy speed") each adding a Bits multiplier; stacking allowed. *Debuff-flavoured curses (draft 2026-06-17): a "Malfunction" toggle that periodically reverses movement for a few seconds, a "Kernel Lock" that disables weapons for ~15s on a timer — harsher, higher-multiplier curses that punish on a rhythm rather than a flat stat tax. Keep them timed/telegraphed (a banner + windup) so they read as a mechanic, not random death; the same timed-debuff effects could later be inflicted by a boss/affix instead of a whole-run toggle*
- [ ] [P2] (L) **Bug modifiers (ARPG-style affixes)** *(from draft 2026-06-13: "keep runs exciting and always different", PoE/Diablo inspiration; curses amplify)* — bugs can roll composable **modifiers** that alter stats/behaviour and tag them visually: the survivors-like analog of magic/rare monsters. **Carrier**: affixes ride the existing **elite** tier by default (1 affix baseline, reward scaled up); **curses raise the affix count *and* strength** and add a small chance for regular bugs to spawn "magic" with one affix — that curse→modifier link is the draft's core ask. **Cheap to build because the behaviours already exist**: `explodeOnDeath`, `frontShield`, `slowAura`, `duplicates`, `drain`, `ranged`, `regen` are all enemy flags today, so a modifier is a *spawn-time composition* of one onto any bug + a stat tweak — exactly how `makeCritical()` already layers a flag-like buff in `spawner.ts`. **Data model**: `EnemyModifier` records (keyed enum handled in `game/`, like `BossMechanic`) carrying effect + visual key + codex text; `Enemy` gains `mods: string[]`; a `rollModifiers(elite, curseLevel)` helper called from `makeEnemy`. **~8 affixes** (software-flavoured, mostly reusing flags): **Bloated** (+hp), **Optimized** (+speed), **Escalated** (+contact dmg), **Volatile** (`explodeOnDeath`), **Hotpatched** (`frontShield`/periodic immunity), **Forking** (`duplicates` on death), **Memory-hungry** (`regen`+`drain`), **Verbose** (fires a `ranged` shot). **Telegraphing is mandatory** — each affix needs a readable tell (aura tint + a small glyph stack above the bug) and a codex entry, or it's unfair; budget real sprite/codex time here. **Reward = risk**: more/stronger affixes → more XP/Bits/Credits, so chasing modified bugs is a choice. **Balance**: the *base* (no-curse) affix rate enters the sim baseline → full re-cert (kill-rate crossover, first-boss TTK, §5 meta gap all shift); curse-amplified affixes are opt-in harder content like curses themselves. **Depends on Curses** above for the amplification half — the base affix system can land first, with curses wiring into `curseLevel` after. **Decided (user 2026-06-13): ride the elite tier for now** — affixes attach to elites only; a distinct magic/rare tier (own spawn weights, more ARPG/UI surface) is a later consideration, not in this item
- [x] [P1] (M) **In-run events** — bug nests to destroy / broken terminals to repair on the map for bonus chests. *Promoted to P1: currently nothing motivates the player to actually move around the map — this is the fix.* Spawn 1 event per ~90s at a distance, marked on the radar/minimap, despawns after 45s if ignored. Rewards: chests + **Credits** (see currency item below) — *shipped 2026-06-13 with chest rewards; credit drops landed with the currency item (it owns both ends of that economy)*
- [x] [P2] (M) **Minimap** — *promoted 2026-06-13 (user): deferred from v0.2 → v0.3, where only the edge-radar half shipped and the actual minimap fell off the roadmap; in-run events made the gap acute. Shipped same day*: bottom-right fixed-range overview radar (settings toggle, default on) through the same iso projection as the camera — horde dots, gold elites/chests, rim-clamped boss squares, field-event `#`/`>` glyphs, Precipitate shimmer. The world is unbounded, so it's a radar, not a map
- [x] [P2] (M) **In-run currency: Credits** *(renamed from "API Tokens" 2026-06-13 per user)* — dropped by in-run events and elites; spent during the run at a **Package Registry** terminal (comes online after each boss, marked like events) on one-run consumables: Hotfix Patch (heal 50%), Garbage Collect (magnet sweep), Spare CI Run / Emergency Veto (+1 reroll/banish), Overclock (+25% dmg 60s) / Hot Reload (+20% speed 60s). Separate economy from Bits (meta) and XP (leveling) — unspent credits die with the run. Two meta upgrades shipped with it (Premium API Plan = elite drop rate, Bulk Billing = drop amount) — no card stat matches, so they reveal on the first credit picked up. Fully gated under `noTerrain` (inert in balance sims; sim-verified zero drift). `dbg.credits(n)`/`dbg.registry()` hooks; `scripts/creditsTest.ts` (23 checks) + visual check
- [ ] [P2] (L) **Daily & weekly seeded challenges** — fixed seed (date-derived), fixed char/map/curses, share-your-score string. Daily = quick fixed loadout; weekly = harder, curse-stacked, bigger one-time ⌬ bonus. One codebase: a challenge is just `(seed, char, map, curses[], reward)`
- [ ] [P3] (M) Achievements → cosmetic palette swaps for characters
- [ ] [P3] (M) Meta tree UI (visual upgrade graph instead of flat shop list)
- [ ] [P3] (S) **Minimap: scale important contacts** *(draft 2026-06-17)* — chests, in-run events and bosses should be markedly larger on the minimap (they're objectives — draw the eye); credits a smaller bump but still bigger than now. Implies **adding credit pickups to the minimap** (they aren't plotted there today). Pure `drawMinimap()` tuning in `rendererBase.ts` — bump the per-contact sizes, keep horde dots small so the hierarchy reads
- [ ] [P3] (S) **New in-run event type: Containment** *(draft 2026-06-17)* — "squash N bugs inside the marked area" — the *player* must be inside the zone for kills to count (not the bug), so it pulls you into the horde rather than away. Extends the `game/events.ts` kind union (a third `FieldEventKind` beside nest/terminal) with a ring zone + a live counter; rewards the same chest + Credits. Keep the area small enough to be dangerous, the count tuned so it resolves in ~10–15s of focused fighting
- [ ] [P3] (S) **Coffee pickup heals a % of max HP** *(draft 2026-06-17)* — the elite HP drop restores a fraction of max HP instead of a flat 25, so topping off is harder without regen investment (and scales sensibly as max HP grows). One-line change in `collectPickup` (`value` → `maxHp * frac`); balance-flagged — it's a mortal-survivability nerf, re-check the §5 marsh/glacier arms (sensitive to sustain)

### Progression & economy *(from draft 2026-06-13: centralize purchases in the shop, gate map discovery)*
- [x] [P2] (S) **Shop sells characters** — move character purchases off the select screen into the shop, beside the existing "# Weapon licenses" section (a "# Characters" section: icon, name, archetype, cost, BUY); rename the menu button UPGRADES → **SHOP** to match. One purchase surface: the character-select screen keeps locked silhouettes (cost shown, "unlock in SHOP" hint) but no longer sells — two buy paths for the same thing is how desyncs happen. NEW-badge: add `chr:` ids to `shopIds()` so new characters badge like licenses do
- [x] [P2] (S) **Gated map progression** — the next map is **hidden** on map select (silhouetted "???" card, no name/cost — same visual language as locked codex/meta rows) until the previous map is first cleared; then it appears for purchase at its Bits cost. Chain = cost order (greenfield → marsh → production → glacier). Mechanism: new save field `mapVictories: Record<string, number>` counting wins per map (also feeds per-map Endless unlock + best-time stats — one field, three consumers). Migration: maps already in `unlockedMaps` stay owned/visible regardless of clear state (merge-over-defaults handles the field itself)
- [x] [P2] (S) **Codex: weapon arsenal tab** — new codex dimension listing every weapon: icon, desc + flavor, evolution chain (base ⇄ evolved cross-linked), key `levels[]` highlights, and **lifetime damage dealt** (`lifetime.weaponDamage` is already tracked in the save — finally surface it). Progressive reveal like bugs: entry unlocks the first time the weapon is wielded in a run (license purchase alone doesn't spoil the evolved forms); locked rows reuse `lockedCodexRow` (dimmed "?", glitched text)
- [ ] [P2] (S) **New meta upgrades: Projectiles + CDR** *(draft 2026-06-13)* — two shop rows in `meta.ts`, pure data, but **balance-flagged on three fronts**: (1) a CDR meta is new fuel for the `blades-cdr` tripwire (CDR cards were just retrimmed in v0.3's stat-cap pass) — scenario re-run mandatory; (2) both raise the maxed-meta ceiling, so the §5 meta-gap arms need a re-run (the gap is calibrated against the *full* shop); (3) the full-shop cost curve (25–35 runs) shifts — price accordingly. Projectiles is the big lever: suggest 1–2 levels at steep cost (the precedent is weaponSlot's single pricey level), CDR 2–3 small steps (+3–4% each, the 60%→asymptote cap absorbs abuse). Progressive unlock comes free: `STAT_TO_META` derives from `modsPerLevel`, and projectile/CDR card stats already exist
- [x] [P2] (M) **Pause inventory redesign** — *user feedback on the v0.3 weapons panel: "feels cramped together, inventory should be main visual focus".* Make the arsenal the anchor of the pause screen: weapons as large cards (icon, level pips, resolved stat block, evolution-ready hint) in the primary pane; run stats / taken cards demoted to a secondary column or collapsible. Pure DOM/CSS in `menus.ts`, no sim impact — pairs naturally with the arsenal-tab item (shared card markup)
- [ ] [P2] (S) **Codex: cards tab** *(draft 2026-06-17)* — a database tab for every upgrade card, the exact pattern the weapon-arsenal tab already established: each entry shows icon, name, rarity, mechanical desc + flavor, mods; **revealed the first time the card is picked in a run** (mark a `card:<id>` in `spawnedKinds`/`encountered` from `applyCard`, like weapons do on wield). Locked rows reuse `lockedCodexRow` — a dimmed "?" silhouette is hint enough that there's something to unlock. Pure additive, no balance impact
- [ ] [P2] (M) **Rarity tiers unlocked by objectives** *(draft 2026-06-17)* — gate card rarities behind an **ordered** objective chain: runs start offering **common + uncommon only**; clearing the next objective in sequence unlocks rare, then epic, then legendary (you can't reach legendary before epic). Deliberately makes the **first several runs much harder** — by design. Mechanism: pick an ordered list of objective ids → rarity; in `levelup.ts` `rarityWeight()` zero out any tier whose gating objective isn't in `save.completedObjectives` (the offer machinery already splits weight per available tier, so a zeroed tier just drops out). The level-up card can hint a locked tier ("🔒 RARE — clear <objective>"). **This drives a BALANCE.md rewrite, not a re-cert against today's numbers** *(user ruling 2026-06-17): the current goals/bands are too generous — harder runs, especially the first several, are the explicit design intent.* So the deliverable includes **lowering the balance sheet**: win-rate targets drop (early/zero-meta runs are *meant* to mostly lose), Bits/run bands come down, and the §5 meta-gap is re-anchored to the new harder baseline rather than held at the old thresholds. A falling win rate here is success, not a regression to fix — re-run the matrix to *measure and record the new bands*, don't tune back up to the old ones. Pairs naturally with the per-map variants pass (also re-tuning early-game difficulty) — do them together so it's one balance rewrite, not two

---

## 🧬 v0.5 — Prestige & infinite meta (design phase)

> Promoted from draft, still open questions (`???`) — **write a short design doc in `docs/` and get it
> approved before implementing anything here.** Risk to manage: prestige must not invalidate the
> honest 25–35-run shop curve or turn into a pure number treadmill.

Theme proposal: prestige = **"The Great Rewrite"** — you ship v(N+1).0 of yourself. *(Draft 2026-06-13: name not fixed, open to suggestions — alternates in theme: the button says "SHIP IT", the act is a "Rewrite", the counter shows your major version v2.0, v3.0…)*

- [ ] [P1] (M) Design doc: prestige currency, reset rules, what carries over, pacing targets. *Enriched from draft 2026-06-13 — the doc must answer:*
  - **Trigger**: prestige becomes available when the **last map is first cleared** (the base game is "beaten"); the player may keep playing to earn more Legacy Tokens before pulling the trigger, with **diminishing returns** (formula needed — proposal: token gain ∝ √(post-clear Bits earned), so grinding doubles tokens roughly every 4× effort; exact curve is the doc's job)
  - **Token gain formula** (draft: "how to calculate token gain???") — candidate inputs: maps cleared, total Bits earned this cycle, best Endless times; must be predictable enough to show a live "tokens on rewrite: N" counter in the menu
  - **The tree sells mechanics, not just stats** (draft's core demand): node examples — **starting level** (begin runs at lv 2/3/4), **"keep upgrade X through prestige"** (multi-level: deeper buys preserve more of the meta shop across resets, maxed = that upgrade survives at max), **pre-unlocked weapon evolutions** (open question — risks trivializing boss chests, maybe "evolution available one level earlier" instead), and genuinely **new mechanic nodes** — *the draft (2026-06-17) proposes **active skills** unlocked via the infinite/prestige progression: a **Dash** (i-frames while dashing to blow through collisions, upgradable i-frame duration) and **Revive ×N** (upgradable count). These add a new active-input layer the base game doesn't have — Dash especially needs a keybind, a cooldown UI, and i-frame handling in `run.ts` damage. The doc should decide whether active skills live in the prestige tree or are their own unlock track; they're the strongest "sells mechanics, not stats" example so far. (unlockable characters/weapons gated here? draft says maybe — doc decides)*
  - **Map tier**: each prestige raises a global map tier (significantly harder + better Bits) — this is the same beast as the P3 "infinite map ladder" below; the doc should merge or explicitly separate them
- [ ] [P2] (L) Prestige reset: trade completed meta shop for a permanent multiplier + **Legacy Tokens**
- [ ] [P2] (L) Skill tree spent with Legacy Tokens (this is where the "meta tree UI" from v0.4 pays off)
- [ ] [P2] (M) Infinite meta-upgrade levels past current caps, exponential cost + diminishing returns — *this is the designed solve for the hard endgame (user ruling 2026-06-12): re-certify Cyber Glacier's maxed-meta band here (currently amended to 30–40%, BALANCE.md §5)*
- [ ] [P3] (L) Procedural "infinite" map ladder: same biomes re-rolled with +difficulty / +Bits multiplier per rung — *likely the implementation of the design doc's "map tier per prestige" (draft 2026-06-13); resolve the overlap in the doc*
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
hazards on; terrain has its own tests).
**Direction (user ruling 2026-06-17): the game should get HARDER — the win-rate and
Bits bands below are too generous and are slated to come *down* with the rarity-gating +
per-map-variants work. A falling win rate (especially early/zero-meta) is the intended
outcome, not a regression. Don't tune back up to these numbers; lower them to the new
measured baseline when that work lands.**

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
- [ ] [P3] (S) **More `dbg` run hooks** *(draft 2026-06-17)* — four console verbs on the existing `window.dbg` (thin layer in `src/dev/devtools.ts` over `Run`/spawner methods, keeping the headless rule): **`dbg.boss(id?)`** force-spawn a specific boss now (no arg = next in the map's order; validates against `dbg.list('bosses')`); **`dbg.remove(id)`** drop an owned weapon from the run (the missing inverse of `give`/`level` — for testing slot/offer behaviour after a weapon leaves); **`dbg.spawn(mult)`** scale the difficulty director's spawn rate live (0 = freeze the horde, e.g. to inspect a boss solo; reads current with no arg). The draft's fourth ask, **"spawn specific event", already ships** as `dbg.event('nest'|'terminal')` — it just gains the third kind automatically when the Containment event lands. Extend `devtoolsTest.mjs` for each new verb

---

## 📜 Progress log

> One line per meaningful session/merge: date — what changed. (Work-in-progress journal for the
> current milestone — on release these lines inform the [CHANGELOG.md](CHANGELOG.md) entry and are pruned.)

- 2026-06-12 — **v0.3 released** (`v0.3.50`, release/0.3 → main): see [CHANGELOG.md](CHANGELOG.md). dev bumped to 0.4.0-dev (`v0.4-base`); v0.3 P3s demoted to Backlog (no unchecked P2s)
- 2026-06-13 — Draft batch 21 processed: v0.4 gains a "Progression & economy" section (shop sells characters, gated map progression, codex weapon arsenal, pause inventory redesign — all P2); Endless mode refined to per-map unlock + banked victory + exponential overtime; v0.5 prestige design-doc item enriched with the draft's tree/trigger/token details
- 2026-06-13 — Progression & economy: 3 of 4 items shipped same day (gated map progression w/ `mapVictories` save field; shop sells characters, UPGRADES → SHOP; codex `~/arsenal` tab w/ reveal-on-wield). Build + sanity sim pass; pause inventory redesign remains
- 2026-06-13 — Pause inventory redesign shipped: `~/inventory` primary pane (large weapon cards w/ pips, resolved stats, evolution state, open-slot placeholders), stats/cards/odds demoted to a secondary row. Screenshot-verified at 1440px + 640px — the whole Progression & economy section is done
- 2026-06-13 — **In-run events shipped** (v0.4 P1): Bug Nest (stationary hatcher, new enemy + sprite) & Hung Terminal (stand-to-reboot, HUD-overlay visual) on a ~90s cadence, edge-radar-marked, 45s despawn, bounty chests. noTerrain-gated (sim-verified zero drift); `dbg.event()` hook; eventsTest (17 checks) + visual check + devtoolsTest 43/43
- 2026-06-13 — **Minimap shipped** (promoted by user — lost in the v0.2→v0.3 deferral, only edge radar had survived): bottom-right radar, settings toggle, event band inside the rim by construction; screenshot-verified
- 2026-06-13 — **Shop tabs shipped** (user: list too lengthy): stat upgrades / licenses / characters as switchable tabs, NEW badges taken per tab viewed (tab dots + main-menu dot stay honest). Drive-by: newBadgeTest repaired (broken since the objectives-menu move). Draft batch 22 processed: projectiles+CDR metas → new P2; token metas folded into the API Tokens item
- 2026-06-13 — **In-run currency: Credits shipped** (P2, renamed from API Tokens per user): event + elite drops → post-boss Package Registry (6 consumables: heal/magnet/reroll/banish/dmg+speed buffs), cyan HUD counter + coin/kiosk sprites + edge-radar/minimap markers (⬡). Two meta upgrades (Premium API Plan, Bulk Billing) revealing on first credit. noTerrain-gated; creditsTest 23 checks, progressiveUnlocksTest updated 14→16 rows, sim-verifier + build clean
- 2026-06-13 — Credits feedback pass: gold coins (was cyan, clashed with XP), value-first "12©", HUD shows after first pickup, one-use registry, Hung Terminal progress decays out of range, Esc-close no longer pauses. Minimap enlarged + moved top-right (stats → top-left). Gamepad phantom-drift fix (non-standard pads ignored)
- 2026-06-13 — Draft batch 23 processed: **Bug modifiers (ARPG affixes)** added to v0.4 as P2 (L), placed under Curses (its amplifier) — composes existing enemy flags at spawn, full sim re-cert flagged
- 2026-06-17 — Per-map variants (P1) started: `EnemyDef.variantOf` + `variant()` helper (inherits shape/behaviour/flags, overrides palette+stats); **Memory Marsh** converted to its own 7-variant roster (bog mite / drip tick / mire wasp / heap leech / fork spider / sludge scarab / rot centipede — drain/slow/tank identity, no explosion/shield types); codex tags variants "VARIANT · <base>". Re-cert: enemyScale eased 1.2→1.15 + finale slow-aura trimmed to hold the §5 band — n=64 matrix zero-meta 1.6% / maxed-meta 50%; kill-rate crossover min 3. Greenfield/production/glacier rosters still to convert
- 2026-06-17 — Per-map variants cont'd: **user ruling — most variants should be visually unique, not reskins.** Added `explodeRadius` (data) + 5 bespoke production sprites (`bolt`/`drone`/`canister`/`lock`/`sentry`). **Production** roster = Crash Mite (reskin) + Thread Tick / Segfault Drone / Panic Beetle (wider blast) / Mutex Scarab / Telemetry Sentry (bespoke) — crash/explosion/lock/ranged identity, no tank/drain/dup. n=64 matrix: zero-meta 6.25%, maxed-meta 39% (kept harder per the bands-come-down ruling — winnable with investment, brutal at zero). Remaining: Glacier roster + retrofit Marsh's 7 reskins to bespoke sprites
- 2026-06-17 — Draft batch 25 processed: **Endless item reframed as "Normal Work Hours & overtime"** (draft work-hours pun) — **Endless-only** (user clarified: normal runs stay 15:00, base balance baseline untouched): inside an Endless run the workday is 8:00, clock past it is Overtime with a ramping reward multiplier + exponential `difficulty()` term keyed off 8:00. **Dev tooling +1 (P3 S)**: `dbg.boss`/`dbg.remove`/`dbg.spawn` hooks (the "spawn specific event" ask already ships as `dbg.event`)
