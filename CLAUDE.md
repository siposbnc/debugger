# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Debugger** — a roguelite survivors-like (Vampire Survivors-style) where a developer fights literal software bugs. TypeScript + Vite + HTML5 Canvas, **zero runtime dependencies, zero external assets**: all sprites are drawn procedurally, all audio is synthesized with WebAudio.

## Workflow — read this first

- **[ROADMAP.md](ROADMAP.md) is the source of truth** for what to work on. At session start, read it; pick the top `[P1]` item in the current milestone unless told otherwise. P1 bugs in "Known issues" come before feature work. Check items off and append to its Progress log when done.
- **`docs/DRAFT.md`** is the user's raw-idea scratch pad. If it has unprocessed entries: refine them, integrate into ROADMAP.md with priorities/proposals, then move them (verbatim) under the draft's "Processed" section.
- **On milestone release**: bump `package.json` version, tag, remove the milestone section from ROADMAP.md and rewrite it as a past-tense entry in [CHANGELOG.md](CHANGELOG.md).
- **Git**: commit often — one commit per logical fix/feature as you go, not one batch commit per session. Push to `origin` when the session's work is done and verified (build + sim pass).
- Design rationale lives in `docs/DESIGN.md` (incl. balance targets in §27); the original brief is `Debugger_Game_Design_Brief.md`.

## Commands

```bash
npm run dev        # Vite dev server → http://localhost:5173
npm run build      # tsc (type check) && vite build → dist/
```

There are no unit tests or linter; `tsc` via `npm run build` is the static check. Verification is simulation-based:

```bash
# Full headless run in Node with per-minute balance logs (game logic is DOM-free):
npx esbuild scripts/simulate.ts --bundle --platform=node --outfile=scripts/simulate.cjs && node scripts/simulate.cjs [charId] [mapId] [maxMinutes]
# e.g. node scripts/simulate.cjs ada greenfield 15   (ids: see src/data/characters.ts, maps.ts)

# Card-offer distribution check (same esbuild pattern):
npx esbuild scripts/offerTest.ts --bundle --platform=node --outfile=scripts/offerTest.cjs && node scripts/offerTest.cjs
```

In-browser dev flags: `?autostart` skips the menu into a run; `?autostart&turbo` = 6× speed, invincible, auto-picked cards (for watching balance live).

After any gameplay/content/balance change, run the simulator and check against the "Balance watchlist" in ROADMAP.md (kill rate ≥ spawn rate before min 6, first-boss TTK 60–100s, Bits/run bands).

## Architecture

The load-bearing rule: **`src/game/` and `src/data/` never touch the DOM, Canvas, or WebAudio.** That is what makes the headless Node simulator possible — don't break it. The simulation communicates outward only through `run.events` (the `RunEvent` discriminated union in `src/game/run.ts`), which `src/main.ts` drains each frame and fans out to the renderer (particles/banners/shake) and sound.

Flow: `main.ts` owns a 5-state machine (`menu | run | levelup | paused | summary`) and the main loop — fixed-step 60 Hz `run.update(1/60)` inside a rAF render. `Run` (in `game/run.ts`) is the entire simulation state: player, enemies, projectiles, pickups, zones, allies, weapon instances.

```
src/data/    All content as plain data records validated by types.ts.
             Behaviors are KEYED ENUMS (WeaponKind, BossMechanic, EnemyBehavior +
             boolean flags) — data names a behavior, src/game/ implements it.
src/game/    run.ts (state + orchestration), combat.ts (weapon kinds), spawner.ts
             (per-map SpawnPhase tables + difficulty director), bossLogic.ts
             (boss mechanics), levelup.ts (card offers/rarity weighting),
             stats.ts (StatMods resolution).
src/core/    input, spatial hash (collision), seeded RNG/math utils.
src/render/  sprites.ts (procedural sprite baking), draw.ts (2:1 isometric
             renderer, particles, HUD, handles RunEvents).
src/ui/      menus.ts — all DOM UI (menus, shop, codex, level-up modal, summary).
src/audio/   sound.ts — synthesized SFX + generative music ("intensity" driven).
src/save/    save.ts — localStorage key `debugger-save-v1`; loads by merging
             stored JSON over defaults() so added fields survive old saves.
```

**Adding content** = add a record in `src/data/` + handle its behavior key if new:
- New **weapon**: record in `weapons.ts` (8-entry `levels` table, optional `evolveTo`). A new `WeaponKind` also needs a branch in `combat.ts` and visuals in `draw.ts`/`sprites.ts`.
- New **enemy**: record in `enemies.ts`; a new `shape` needs a sprite in `sprites.ts`; new behaviors are flags handled in `run.ts`.
- New **boss**: record in `bosses.ts`; new `BossMechanic` → `bossLogic.ts`.
- New **map**: record in `maps.ts` (palette, `spawnPlan` phase table, `bossOrder`); also a shop unlock entry.
- Cards (`upgrades.ts`), characters, meta upgrades, objectives are usually pure data, no code.

**Stats model**: `StatMods` is additive; percent-like fields are fractions (`0.1` = +10%). `computeStats()` folds character + meta upgrade levels + taken cards into `ComputedStats` each time something changes. Difficulty scaling formulas live in `difficulty()` in `data/enemies.ts`.

## Conventions

- Tone: humor lives in `flavor` text only; `desc` (mechanical text) stays literal and clear. All names are software-culture wordplay — match it.
- Color language is meaningful, not decorative: green/cyan = player power, red/orange/purple = enemies/corruption, gold = rarity/reward, rarity colors in `RARITY_COLOR`.
- RNG: the simulation is **not** seeded — `Math.random()` (via `core/util.ts` helpers `rand`/`randInt`/`pick`) is used throughout; `mulberry32` is only for deterministic map decoration. (The v0.4 seeded-challenge roadmap item will require threading a seeded RNG through `game/`.)
- Perf budget: enemy cap 380, sprites pre-baked, spatial hash for collisions — keep per-frame allocations out of the hot loop.
