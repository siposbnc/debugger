# 📜 CHANGELOG

All notable shipped changes to **Debugger**. Newest first.

When a [ROADMAP.md](ROADMAP.md) milestone ships, its section is removed from the roadmap and
recorded here — rewritten as *what changed* (past tense, player-facing first, tech notes after),
not as a copied task list. Dropped or deferred items are noted at the end of each entry.

---

## v0.2.67 — Polish & QoL (2026-06-12)

The game v0.1 already was, but friendlier, smoother and more informative. No new content
(one deliberate exception below) — feel, clarity, robustness, and a difficulty rework.

### UX & readability
- Pause screen rebuilt as a full current-run overview: resolved stat sheet, per-weapon damage + DPS, taken cards with stack counts, and live card odds (luck, banishes and repeat penalties included)
- Run summary now shows a per-weapon damage breakdown, and objectives are visually separated from the itemized Bits breakdown
- Level-up cards preview the resulting stat ("dmg 34 → 38") and warn when a pick is partially or fully wasted on a capped stat (CAPPED badge, dead cards dimmed)
- Suspend & resume: SUSPEND PROCESS snapshots the full run to the save; RESUME RUN on the main menu continues it later (snapshot consumed on resume — no reload-scumming)
- KILL PROCESS is now a two-step arm/confirm (`SIGKILL — ARE YOU SURE?`) across mouse, keyboard and gamepad
- Settings reachable from the pause screen (stepwise back routing, save-wipe hidden mid-run)
- Heal feedback: green floating numbers + sprite glow on every HP restore (regen ticks pooled to whole points)
- Player health bar above the sprite (toggleable, default on); damage numbers merge past 40 on screen; off-screen bosses get a pulsing edge indicator
- Bug database: procedural sprite thumbnails next to every entry + lifetime stats (accumulated uptime, favorite weapon by lifetime damage)
- NEW badges on unseen codex/shop entries with menu-button dots; completed objectives re-badge
- Version number on the main menu (dev builds show the commit-count patch number); optional FPS counter overlay color-keyed to the frame-time budget

### Controls & accessibility
- Keyboard navigation in all menus and card selection (spatial roving highlight, Esc = back)
- Full gamepad support: analog movement + complete menu navigation (standard mapping)
- Touch controls: floating virtual stick + touch pause button — mobile browsers are playable

### Card system
- Repeat-pick penalty: stat cards decay ×0.55 per pick (weapon level-ups a gentler ×0.85 per level) so offers stay varied; verified rarity math end-to-end (legendary 1.4%/card at luck 0)
- Skip reworked into **Defer**: banks 20% of the next level's XP requirement instead of giving nothing

### Balance & difficulty (sim-driven)
- **Power now beats movement**: straggler recycling (outrun enemies teleport ahead of the player's heading), quadratic late-game horde damage, turret-uptime trim — a careless auto-pick bot's win rate dropped from 83% to 28% on Greenfield (0% on Marsh) while good builds win 63–94% in equal-budget A/B scenarios
- Syntax Wand gained base pierce (ada was the only character failing the early kill-rate floor)
- `docs/BALANCE.md` goal sheet: pacing targets, level-curve checkpoints, card-rate and Bits-band targets the simulator checks against

### Easter egg
- **The Precipitate**: a rare wet-lab visitor that isn't a software bug — untargetable, purely functional, wanders by Brownian motion; catch it by touch for a chest, 602 XP and 23 ⌬ ("DEPENDENCY RESOLVED"). Codex entry filed under NOT A BUG, plus the "Cabal of Two" objective

### Robustness
- Save-data versioning with stepwise migrations (safe downgrade, unknown fields survive)
- Auto-pause on tab blur / hidden tab (background deaths were real and are gone)
- Pre-commit type-check hook + GitHub Actions CI (build, offer-distribution assertions, sim smoke)

### Fixes
- F5 advertised as resume hint (refreshed the browser instead); clipped tall menus; legendary cards too common (tier weights were per-card); Merge Conflict paying double chest + double boss credit; held key/stick spamming through freshly opened level-up screens (keyboard and gamepad); evolved weapon's base re-offered as "new"; turret not scaling with projectile count; `dbg.time()` NaN-poisoning the clock
- "Up/down feels slower than left/right" triaged: 2:1 isometric projection illusion, world speed is direction-independent — no change

### Dev tooling (alongside the milestone)
- Headless simulator grew scenarios (`--scenario=<name|path>` mid-run preconfigs), a 4-char × 2-map matrix runner with mortal bots and pick strategies, and per-weapon damage reporting
- `window.dbg` dev console on dev builds (bits/offer/give/level/xp/god/time/list/mushi), provably excluded from prod bundles
- `npm run play` isolated play server (frozen snapshot, no HMR); `npm run deploy:test` Netlify upload without CI minutes
- `design-entity` Claude skill; Playwright verification suites for pause guards, card previews, suspend, touch, badges, devtools

### Deferred
- To v0.3: minimap/edge-radar, remappable keys, split volume sliders, reduce-flash mode, FPS particle safeguard
- To Backlog: save export/import as JSON, "Muscle Memory" meta upgrade, boss-TTK investigation, Exception Beetle density past minute 10

---

## v0.1.0 — MVP (2026-06-10)

First playable build (`9b73df5`). The complete core loop, end to end:

### Gameplay
- 15-minute survival runs ending in death or **SYSTEM STABILIZED** victory
- 8 weapons with 8 levels each, plus 8 evolutions unlocked via boss chests at max level
- 8 enemy types with distinct behaviors (swarm, charge, drain, duplicate, explode, slow aura, cluster, segmented tank) + gold-aura elite variants from 4:00
- 5 bosses on a 2:00 cycle, each with a unique mechanic (split, pools, accelerating bursts, summons, armor phases), tier-scaled on repeat
- 32 stat upgrade cards across 5 rarities with luck weighting; reroll / banish / skip unlockable via meta
- 4 playable characters with distinct starting weapons and passives
- 2 maps: Greenfield Repository (starter) and Memory Marsh (toxic pools, ×1.25 Bits)

### Progression
- **Bits** economy: earn from time / kills / bosses / level / objectives, map multipliers
- 13 purchasable meta upgrades + character/weapon/map shop unlocks
- 12 one-time objectives (+100 ⌬ each), checked live mid-run
- localStorage save/load

### Presentation & tech
- Isometric HTML5 Canvas renderer, fully procedural sprites, "corrupted IDE" CRT aesthetic
- 100% synthesized WebAudio SFX + generative synthwave music that intensifies over the run
- Game feel: hit-flash, knockback, screen shake, floating damage numbers, XP magnetization
- Full menu flow: start, characters, maps, shop, codex, settings, post-run summary
- Dev tooling: `?autostart` / `?turbo` flags, headless balance simulator (`scripts/simulate.ts`)
- TypeScript + Vite, zero runtime dependencies, no external assets
