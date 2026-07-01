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

## 🧬 v0.5 — Prestige & infinite meta (design phase)  ← **current milestone**

> Promoted from draft, still open questions (`???`) — **write a short design doc in `docs/` and get it
> approved before implementing anything here.** Risk to manage: prestige must not invalidate the
> honest 25–35-run shop curve or turn into a pure number treadmill.

Theme proposal: prestige = **"The Great Rewrite"** — you ship v(N+1).0 of yourself. *(Draft 2026-06-13: name not fixed, open to suggestions — alternates in theme: the button says "SHIP IT", the act is a "Rewrite", the counter shows your major version v2.0, v3.0…)*

- [x] [P1] (M) Design doc: prestige currency, reset rules, what carries over, pacing targets. — ***APPROVED 2026-07-02: [docs/PRESTIGE.md](docs/PRESTIGE.md) is the spec — user rulings in §9 (full reset; Preflight Check over pre-unlocked evolutions; skills in the tree; ~10-cycle tree; Space/pad-B dash; Sudo Mode third active; Ship Bonus gains +10% XP) and §10 asks (XP ladder, CDR/crit cap-raiser nodes) folded into the body. Implementation staged in doc §8.*** *Enriched from draft 2026-06-13 — the doc must answer:*
  - **Trigger**: prestige becomes available when the **last map is first cleared** (the base game is "beaten"); the player may keep playing to earn more Legacy Tokens before pulling the trigger, with **diminishing returns** (formula needed — proposal: token gain ∝ √(post-clear Bits earned), so grinding doubles tokens roughly every 4× effort; exact curve is the doc's job)
  - **Token gain formula** (draft: "how to calculate token gain???") — candidate inputs: maps cleared, total Bits earned this cycle, best Endless times; must be predictable enough to show a live "tokens on rewrite: N" counter in the menu
  - **The tree sells mechanics, not just stats** (draft's core demand): node examples — **starting level** (begin runs at lv 2/3/4), **"keep upgrade X through prestige"** (multi-level: deeper buys preserve more of the meta shop across resets, maxed = that upgrade survives at max), **pre-unlocked weapon evolutions** (open question — risks trivializing boss chests, maybe "evolution available one level earlier" instead), and genuinely **new mechanic nodes** — *the draft (2026-06-17) proposes **active skills** unlocked via the infinite/prestige progression: a **Dash** (i-frames while dashing to blow through collisions, upgradable i-frame duration) and **Revive ×N** (upgradable count). These add a new active-input layer the base game doesn't have — Dash especially needs a keybind, a cooldown UI, and i-frame handling in `run.ts` damage. The doc should decide whether active skills live in the prestige tree or are their own unlock track; they're the strongest "sells mechanics, not stats" example so far. (unlockable characters/weapons gated here? draft says maybe — doc decides)*
  - **Map tier**: each prestige raises a global map tier (significantly harder + better Bits) — this is the same beast as the P3 "infinite map ladder" below; the doc should merge or explicitly separate them
- [ ] [P1] (L) **Prestige core** *(promoted from P2 on doc approval — PRESTIGE.md §8 stage 1)*: save fields (`rewrites`/`legacyTokens`/`tree`/`cycleBits`/`cycleOvertimeBest`/`keptMeta`), `data/prestige.ts` (node defs + token formula `3×maps + √(cycleBits/150) + overtimeMin/3`), SHIP IT button + Rewrite screen (live token counter, reset/persist table, arm/confirm, cycle summary), the reset itself, `you: vN.0` menu version, `prestigeTest.ts`
- [ ] [P1] (L) **Prestige tree** *(promoted from P2 on doc approval — PRESTIGE.md §8 stages 2–3)*: token-spend tree UI (the Backlog's "meta tree UI" pays off here) + passive nodes (Warm Boot, Severance Package, Persistent Config, Preflight Check, Compound Interest, Continuous Learning, Time Dilation, Ship Bonus Bits+XP) + actives (Dash Space/pad-B with i-frames + HUD pip, Restore Point revives, Sudo Mode)
- [ ] [P2] (M) **Prestige endgame levers** *(PRESTIGE.md §8 stage 4, balance-flagged)*: Deployment Tiers (map tier selector — absorbs the old "infinite map ladder" P3), Over-Cap Shop (infinite meta levels — the designed solve for glacier's amended 30–40% band, §5 re-cert is its acceptance test), Overclocked Cooling (CDR cap raiser — blades-cdr tripwire per rank), Critical Path (crit overflow → crit damage)
- [ ] [P3] (S) Game-speed unlock (1.25× / 1.5× sim speed as a prestige QoL reward)
- [ ] [P3] (M) New prestige-gated meta upgrade tier

### Rolled over from v0.4 *(unfinished P2s at the 2026-07-02 release — what shipped is in the CHANGELOG)*
- [ ] [P2] (S) **Linus meta-scaling tune** — *from the v0.3 meta-depth check (BALANCE.md §6): helpers only inherit `damageMult`, so linus runs ~2× under ada at maxed meta.* Candidate direction: allies inherit more computed stats (crit), or an ally-keyed meta upgrade. Don't buff his zero-meta floor (already the strongest)
- [ ] [P2] (M) **The Printer** (boss) — *no one knows how it works.* Unpredictable mimic: its kit is other bosses' mechanics, drawn at random — never the same fight twice. Proposal: each phase (~25% HP) it "prints a copy of" a random standard boss's signature layer (diff-hunk volleys / heap globs / radial bursts / frame guard) with printer-flavored visuals (paper-jam pools, toner globs, PC LOAD LETTER banner). Open design question at implementation: standard-pool member on all maps (mimicry IS its identity, map-agnostic) vs a rare wildcard that can hijack any map's 12:00 finale slot (~10%?) — lean standard-pool, the wildcard dilutes the per-map finale identity just established in v0.3
- [ ] [P2] (L) **Bug modifiers (ARPG-style affixes)** *(from draft 2026-06-13: "keep runs exciting and always different", PoE/Diablo inspiration; curses amplify)* — bugs can roll composable **modifiers** that alter stats/behaviour and tag them visually: the survivors-like analog of magic/rare monsters. **Carrier**: affixes ride the existing **elite** tier by default (1 affix baseline, reward scaled up); **curses raise the affix count *and* strength** and add a small chance for regular bugs to spawn "magic" with one affix — that curse→modifier link is the draft's core ask. **Cheap to build because the behaviours already exist**: `explodeOnDeath`, `frontShield`, `slowAura`, `duplicates`, `drain`, `ranged`, `regen` are all enemy flags today, so a modifier is a *spawn-time composition* of one onto any bug + a stat tweak — exactly how `makeCritical()` already layers a flag-like buff in `spawner.ts`. **Data model**: `EnemyModifier` records (keyed enum handled in `game/`, like `BossMechanic`) carrying effect + visual key + codex text; `Enemy` gains `mods: string[]`; a `rollModifiers(elite, curseLevel)` helper called from `makeEnemy`. **~8 affixes** (software-flavoured, mostly reusing flags): **Bloated** (+hp), **Optimized** (+speed), **Escalated** (+contact dmg), **Volatile** (`explodeOnDeath`), **Hotpatched** (`frontShield`/periodic immunity), **Forking** (`duplicates` on death), **Memory-hungry** (`regen`+`drain`), **Verbose** (fires a `ranged` shot). **Telegraphing is mandatory** — each affix needs a readable tell (aura tint + a small glyph stack above the bug) and a codex entry, or it's unfair; budget real sprite/codex time here. **Reward = risk**: more/stronger affixes → more XP/Bits/Credits, so chasing modified bugs is a choice. **Balance**: the *base* (no-curse) affix rate enters the sim baseline → full re-cert (kill-rate crossover, first-boss TTK, §5 meta gap all shift); curse-amplified affixes are opt-in harder content like curses themselves. **Depends on Curses** above for the amplification half — the base affix system can land first, with curses wiring into `curseLevel` after. **Decided (user 2026-06-13): ride the elite tier for now** — affixes attach to elites only; a distinct magic/rare tier (own spawn weights, more ARPG/UI surface) is a later consideration, not in this item
- [ ] [P2] (L) **Daily & weekly seeded challenges** — fixed seed (date-derived), fixed char/map/curses, share-your-score string. Daily = quick fixed loadout; weekly = harder, curse-stacked, bigger one-time ⌬ bonus. One codebase: a challenge is just `(seed, char, map, curses[], reward)`
- [ ] [P2] (S) **New meta upgrades: Projectiles + CDR** *(draft 2026-06-13)* — two shop rows in `meta.ts`, pure data, but **balance-flagged on three fronts**: (1) a CDR meta is new fuel for the `blades-cdr` tripwire (CDR cards were just retrimmed in v0.3's stat-cap pass) — scenario re-run mandatory; (2) both raise the maxed-meta ceiling, so the §5 meta-gap arms need a re-run (the gap is calibrated against the *full* shop); (3) the full-shop cost curve (25–35 runs) shifts — price accordingly. Projectiles is the big lever: suggest 1–2 levels at steep cost (the precedent is weaponSlot's single pricey level), CDR 2–3 small steps (+3–4% each, the 60%→asymptote cap absorbs abuse). Progressive unlock comes free: `STAT_TO_META` derives from `modsPerLevel`, and projectile/CDR card stats already exist
- [ ] [P2] (S) **Codex: cards tab** *(draft 2026-06-17)* — a database tab for every upgrade card, the exact pattern the weapon-arsenal tab already established: each entry shows icon, name, rarity, mechanical desc + flavor, mods; **revealed the first time the card is picked in a run** (mark a `card:<id>` in `spawnedKinds`/`encountered` from `applyCard`, like weapons do on wield). Locked rows reuse `lockedCodexRow` — a dimmed "?" silhouette is hint enough that there's something to unlock. Pure additive, no balance impact
- [ ] [P2] (M) **Rarity tiers unlocked by objectives** *(draft 2026-06-17)* — gate card rarities behind an **ordered** objective chain: runs start offering **common + uncommon only**; clearing the next objective in sequence unlocks rare, then epic, then legendary (you can't reach legendary before epic). Deliberately makes the **first several runs much harder** — by design. Mechanism: pick an ordered list of objective ids → rarity; in `levelup.ts` `rarityWeight()` zero out any tier whose gating objective isn't in `save.completedObjectives` (the offer machinery already splits weight per available tier, so a zeroed tier just drops out). The level-up card can hint a locked tier ("🔒 RARE — clear <objective>"). **This drives a BALANCE.md rewrite, not a re-cert against today's numbers** *(user ruling 2026-06-17): the current goals/bands are too generous — harder runs, especially the first several, are the explicit design intent.* So the deliverable includes **lowering the balance sheet**: win-rate targets drop (early/zero-meta runs are *meant* to mostly lose), Bits/run bands come down, and the §5 meta-gap is re-anchored to the new harder baseline rather than held at the old thresholds. A falling win rate here is success, not a regression to fix — re-run the matrix to *measure and record the new bands*, don't tune back up to the old ones. Pairs naturally with the per-map variants pass (also re-tuning early-game difficulty) — do them together so it's one balance rewrite, not two

*Note: "infinite run past 15:00" from the draft = **Endless mode**, shipped in v0.4 — prestige can gate extra Endless scaling rewards instead of duplicating it.*

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
- *(demoted from v0.4 at release, P3s)*: Achievements → cosmetic palette swaps; **Meta tree UI** (visual upgrade graph — the v0.5 skill-tree item is where it pays off); **Minimap: scale important contacts** (chests/events/bosses larger, add credit pickups to the minimap); **Containment event** (squash N bugs while the *player* stands in the marked area — third `FieldEventKind`); **Coffee pickup heals % of max HP** (balance-flagged sustain nerf)
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

- 2026-07-02 — **v0.4 released** (`v0.4.39`, release/0.4 → main): see [CHANGELOG.md](CHANGELOG.md). dev bumped to 0.5.0-dev (`v0.5-base`); v0.4 P2s rolled into v0.5 ("Rolled over" subsection), P3s demoted to the Backlog
- 2026-07-02 — **Prestige design doc APPROVED** (user rulings §9 + asks §10 folded in; reset/tree items promoted P2→P1 as the implementation, old infinite-map-ladder P3 absorbed into Deployment Tiers). Drafted same day: "The Great Rewrite" — SHIP IT unlocks on the cycle's first glacier clear; Legacy Tokens = `3×maps + √(cycleBits/150) + overtimeMin/3` (~24–28 ⟲ first rewrite, √ = the diminishing-returns grind guard); full reset of shop/licenses/maps/chars vs knowledge persisting (codex/objectives/records); 3-branch ~300-⟲ tree (Momentum keeps/starts, Skills = Dash + Revive actives, Leverage = map tiers + over-cap shop + repeatable tail); +30% Ship Bonus per rewrite (cycle 1 curve untouched, cycle 2 ≈ 65%); the P3 "infinite map ladder" merged into Deployment Tiers; §9 = 7 decisions for the user
