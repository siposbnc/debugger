# Scratch pad

Dump raw ideas, questions and bug sightings here. Claude refines them, integrates them
into [ROADMAP.md](../ROADMAP.md), and moves them to **Processed** below.

## Draft ideas

*(empty)*

## Dev env ideas

*(empty)*

## Bugs

*(empty)*

---

## Processed → ROADMAP.md (2026-06-11, batch 6)

- Kill-process confirmation → **v0.2 UX, P2 (S)** — two-step arm/confirm on the button itself (`SIGKILL — ARE YOU SURE?`), disarms on focus move or timeout; same flow for mouse/keyboard/gamepad
- Bosses need more unique mechanics + must challenge the build, not just dodging → **v0.3 Bosses, P2 (M) "Boss mechanics pass"** — design-first item; each boss gets a second rule-bending layer that tests the build (DPS checks, soft enrages, interrupt thresholds); seeded with 5 proposals (diff tether, arena-flooding pools, position rewind, stack-frame buffs, dependency pillars) — the ??? is the point, treat them as creative prompts not specs

<details>
<summary>Batch 6 — original notes (kept for reference)</summary>

### Draft ideas

- confirmation for kill process (end run) to avoid accidental click
- bosses need more unique mechanics, not just different attack patterns
    - needs creativity
    - they need to be a challange to defeat without proper build (don't just require dodging bullets or kiting them)
    - ???

</details>

## Processed → ROADMAP.md (2026-06-11, batch 5)

- In-run events ?? → **already tracked: v0.4 P1 "In-run events"** (bug nests / broken terminals for bonus chests, radar-marked, ~1 per 90s) — now also linked to the token economy below
- In-run currency (tokens) → **v0.4 P2 "In-run currency: API Tokens"** — events drop tokens, spent during the run at a Package Registry terminal on one-run consumables (heal, magnet sweep, +1 reroll/banish, short buffs); separate economy from Bits/XP, dies with the run. Depends on events shipping first
- Build version in the main menu → semver was already shipped (v0.2 version tag); user clarified twice: wants an **incremental build version** to distinguish test-server deployments → **shipped same day**: on `-dev` builds the patch number becomes the git commit count (`v0.2.33-dev`), deterministic per commit, no counter file; release versions pass through untouched (a timestamp variant was briefly shipped in between, replaced)
- Up/down slower than left/right → **triaged in Known issues: illusion, code-verified** — world speed is direction-independent; the 2:1 iso projection halves vertical *screen* velocity for everything equally (enemies too), so balance is unaffected. No change; reopen as feel-tuning if it still bothers in play

<details>
<summary>Batch 5 — original notes (kept for reference)</summary>

### Draft ideas

- in run events ??
- in run currency (tokens?)
    - can be spent for upgrades/items after as a reward for events
- include build version in the main menu

### Bugs

- feels a lot slower to move up/down than left/right - bug or illusion?

</details>

## Processed → ROADMAP.md (2026-06-11, batch 4)

- Better map design (terrain, obstacles) → **v0.3 Maps, P2 (L) "Terrain & obstacles"** — scoped as a vertical slice (1 obstacle type, 1 map first); flagged the real costs: static-geometry collision, enemy steering, iso draw order, spawn validation; layout stays data-driven/seeded so the headless sim survives
- In-game FPS counter (toggleable) → **v0.2 UX, P2 (S)** — settings toggle, default off; doubles as the verification surface for the existing FPS-safeguard robustness item

<details>
<summary>Batch 4 — original notes (kept for reference)</summary>

### Draft ideas

- better map design, not just a 2d plane
    - different terrain, obstacles
- in-game FPS counter (can be toggled in settings)

</details>

## Processed → ROADMAP.md (2026-06-11, batch 3)

- Simulation scenarios (run starts from a preconfig) → **🛠️ Dev tooling, P2 (M)** — scenario file/preset defines starting state + pick strategy + time window; watchlist combos become checked-in scenarios
- Bug: held movement key spams through the level-up screen → **triaged into Known issues and fixed immediately** (kbnav regression from today's keyboard-nav feature; auto-repeats now require a fresh keypress after each screen opens)

<details>
<summary>Batch 3 — original notes (kept for reference)</summary>

### Dev env ideas

- more dev tooling for simulations. option to create and test specific scenarios
    - for example, run starts from a preconfig

### Bugs

- levelup screen is instant. when the player holds an arrow key to continously move and the levelup screen appears, they start to "spam" through the cards insantly. this feels unfriendly and is not an intended behavior

</details>

## Processed → ROADMAP.md (2026-06-11, batch 2)

- Shield system (HP overlay, shield cards, doesn't count as real damage) → **v0.3 Cards & enemies, P2 (M)** — includes the "Starting Shield" meta upgrade; regen-vs-pickup refill left as a design-time question
- Meta upgrade: decrease boss timer → **v0.3, P3 (S)** with an open question (might fit better as a v0.4 curse toggle than a meta buy)
- New objectives: "Don't get hit" / "Don't move" for the whole run → **folded into the v0.3 objectives item** (no-hit interacts with shield rule per the draft)
- Bug: evolved weapon's base version re-offered → **triaged into Known issues and fixed immediately** (P1; new-weapon pool now skips bases whose evolution is owned)

<details>
<summary>Batch 2 — original notes (kept for reference)</summary>

### Draft ideas

- Shield (on top of health, 0 by default)
    - Increased with cards (new Shield cards)
    - Taking shield damage doesn't count as real damage (doesn't fail the "Don't get hit" objective)
- Meta upgrades:
    - decrease boss timer
    - Starting shield
- New objectives:
    - Don't get hit for 15 minutes (whole run)
    - Don't move for 15 minutes (whole run)

### Bugs

- When owning an evolved weapon, the base version can be offered again

</details>

## Processed → ROADMAP.md (2026-06-11)

- Daily / weekly challanges → **merged into the v0.4 seeded-challenge item** (daily = quick fixed loadout, weekly = curse-stacked with bigger one-time ⌬ bonus; same underlying system)

<details>
<summary>Batch 1 — original notes (kept for reference)</summary>

### Draft ideas

- Split the Run summary. Split the achieved objectives (bugs squashed, level reached, etc) and the accumulated Bits by stats with a clear --- line. This is to visually distinguish them for the player to easily understand what they see. → **v0.2 UX**
- Card pool limitations; Decrease the odds for the selected card for reappearing again (special formula for weapon cards, they are still less probable to appear but not as much as other cards).
	- Formula is needed. → **proposed in v0.2 "Card system rework"** (0.55^picks stat / 0.85^level weapon)
	- Meta upgrade to increase the odds → **"Muscle Memory" meta upgrade, v0.2**
- Pause menu stat sheet; detailed overview of the current run (taken cards, player stats, odds/chances, total damage and dps for each weapon) → **merged into v0.2 pause-menu item**
- More player meta stats (Bug database menu): Accumulated Uptime (total time alive), etc → **v0.2 UX (lifetime stats page)**
- Navigation with movement inputs in all menus and card selection (arrows or WASD) → **v0.2 Controls, P1 (foundation for gamepad)**
- Rethink card "Skip". What is the benefit of it currently?! → **v0.2 Card system: Skip = "Defer" proposal (bank 20% next-level XP)**
- Prestige system ??? (infinite scaling, skill tree, infinite maps, new/infinite meta upgrades, game speed, infinite run) → **new v0.5 milestone "Prestige & infinite meta", design-doc first; infinite run = Endless mode already in v0.4**
- Health bar above player character (togglable in settings) → **v0.2 UX**
- Healing effect for the player → **v0.2 UX (heal feedback: green number + glow)**
- Show icons (image/icon of the entity) for the entries in the Bug database menu → **v0.2 UX (cached sprite thumbnails)**
- A lot more and more challenging meta objectives → **v0.3 objectives item expanded**
- Challanges, tasks during a run — no motivation and goal for the player to move around the map currently → **v0.4 in-run events promoted to P1 with this rationale**
- Minimap ? → **already in v0.2 (P2)**
- Documented balance goal sheet → **v0.2 Balance: `docs/BALANCE.md`**
- Sync save data to cloud. Account? → **Backlog (after desktop wrap; export/import first)**

### Dev env ideas

- Claude Skill: create entity (generate entity matching game style from a description) → **🛠️ Dev tooling section**
- Save data import/export + dev tool to modify → **v0.2 export/import + 🛠️ Dev tooling save editor (`?saveeditor`)**

### Bugs

All five triaged into **ROADMAP.md → Known issues** with priorities and proposed verdicts
(Merge Conflict double chest = bug, single chest on last kill; turret projectile scaling = lean bug, reduced-rate scaling).

</details>
