# Scratch pad

Dump raw ideas, questions and bug sightings here. Claude refines them, integrates them
into [ROADMAP.md](../ROADMAP.md), and moves them to **Processed** below.

## Draft ideas

- Shield (on top of health, 0 by default)
    - Increased with cards (new Shield cards)
    - Taking shield damage doesn't count as real damage (doesn't fail the "Don't get hit" objective)
- Meta upgrades:
    - decrease boss timer
    - Starting shield
- New objectives:
    - Don't get hit for 15 minutes (whole run)
    - Don't move for 15 minutes (whole run)

## Dev env ideas

*(empty)*

## Bugs

- When owning an evolved weapon, the base version can be offered again

---

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
