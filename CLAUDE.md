# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Debugger** — a roguelite survivors-like (Vampire Survivors-style) where a developer fights literal software bugs. TypeScript + Vite + HTML5 Canvas, **zero runtime dependencies, zero external assets**: all sprites are drawn procedurally, all audio is synthesized with WebAudio.

## Workflow — read this first

- **Sync before anything else.** Other sessions push to `origin/dev` between sessions — a stale checkout means redoing work that's already done. At session start, before reading ROADMAP.md, run exactly one command: `git pull --ff-only`. Only if it fails, fall back to `git fetch` + `git rebase origin/dev` (stash uncommitted local edits first and pop them after — they may be the user's). Don't browse upstream history beyond this; the refreshed ROADMAP.md tells you what's done.
- **[ROADMAP.md](ROADMAP.md) is the source of truth** for what to work on. At session start, read it; pick the top `[P1]` item in the current milestone unless told otherwise. P1 bugs in "Known issues" come before feature work. Check items off and append to its Progress log when done.
- **`docs/DRAFT.md`** is the user's raw-idea scratch pad. If it has unprocessed entries: refine them, integrate into ROADMAP.md with priorities/proposals, then move them (verbatim) under the draft's "Processed" section.
- **Branches**: all work happens on `dev`. Each release lives on a `release/X.Y` branch (e.g. `release/0.2`); hotfixes for a shipped version are committed there and merged (or cherry-picked) back into `dev`. `main` is a read-only mirror of the newest release tip — never commit to it directly; update it with `git push origin release/X.Y:main --force-with-lease`.
- **Versioning**: `package.json` holds only `X.Y.0` (+ `-dev` on the dev branch); the build replaces the patch number with the git commit count **since the `vX.Y-base` tag** (`vite.config.ts`) — the tag sits on the commit that bumped `package.json` to `X.Y.0-dev`, so the patch counter restarts at every minor. Dev builds show `vX.Y.<count>-dev`, release builds `vX.Y.<count>` — a hotfix commit on `release/X.Y` (which descends from the base tag) bumps the production version automatically. Counting falls back to total history if the tag is unreachable; CI fetches tags for this (`fetch-tags: true`).
- **Test server**: deployed manually with `npm run deploy:test` — local `build:dev` + Netlify CLI upload (`netlify deploy --prod --dir=dist`), so no Netlify build minutes are used and the version matches the local commit exactly. CI builds on the Netlify site are stopped by design — don't re-enable webhook/auto-deploys. The script refuses a dirty working tree (`-- --dirty` overrides).
- **On milestone release** (trigger: every `[P1]` in the milestone checked — `[P1]` = release-blocking, `[P2]` rolls into the next milestone, `[P3]` drops to the Backlog): first, on `dev`, add the milestone's player-facing entry to `src/data/patchNotes.ts` (the in-game "What's new" screen — curated highlights, not the CHANGELOG) so the release build ships its own notes; then cut `release/X.Y` from `dev`; on it drop the `-dev` suffix from `package.json` and tag the actual built version (`git describe`-able, e.g. `v0.2.41`); point `main` at it (see above). On `dev`: move the milestone section from ROADMAP.md to a past-tense entry in [CHANGELOG.md](CHANGELOG.md) (carrying the P2/P3 roll-over with it) and bump `package.json` to the next minor with `-dev` (e.g. `0.3.0-dev`) — **tag that bump commit `vX.Y-base` and push the tag** (the patch counter restarts from it).
- **Git**: commit often — one commit per logical fix/feature as you go, not one batch commit per session. Push to `origin` when the session's work is done and verified (build + sim pass).
- Design rationale lives in `docs/DESIGN.md` (incl. balance targets in §27); the original brief is `Debugger_Game_Design_Brief.md`.

## Commands

```bash
npm run dev          # Vite dev server → http://localhost:5173
npm run build        # tsc (type check) && vite build → dist/ (prod: dev console excluded)
npm run build:dev    # dev-configured build (--mode dev): window.dbg dev console compiled in
npm run deploy:test  # test-server deploy: local build:dev + netlify CLI upload (user-triggered)
npm run play         # user's isolated play server: build:dev → dist-play/ + preview on :4180
                     # (frozen snapshot — no HMR, untouched by Claude's dist/ rebuilds)
```

There are no unit tests or linter; `tsc` via `npm run build` is the static check. Verification is simulation-based:

```bash
# Full headless run in Node with per-minute balance logs (game logic is DOM-free):
npx esbuild scripts/simulate.ts --bundle --platform=node --outfile=scripts/simulate.cjs && node scripts/simulate.cjs [charId] [mapId] [maxMinutes]
# e.g. node scripts/simulate.cjs ada greenfield 15   (ids: see src/data/characters.ts, maps.ts)
# --scenario=<name|path> starts from a preconfigured mid-run state (build/level/clock/bot) —
# presets in scripts/scenarios/*.json, schema in src/game/scenario.ts

# Card-offer distribution check (same esbuild pattern):
npx esbuild scripts/offerTest.ts --bundle --platform=node --outfile=scripts/offerTest.cjs && node scripts/offerTest.cjs
```

In-browser dev flags: `?autostart` skips the menu into a run; `?autostart&turbo` = 6× speed, invincible, auto-picked cards (for watching balance live). On dev builds, `window.dbg` (browser console) manipulates the live run — `dbg.help()` lists the API (`bits`, `offer`, `give`, `level`, `xp`, `god`, `stat`, `time`, `speed`, `list`); verified by `scripts/devtoolsTest.mjs` (Playwright, needs a served `build:dev` output).

After any gameplay/content/balance change, run the simulator and check against the "Balance watchlist" in ROADMAP.md (kill rate ≥ spawn rate before min 6, first-boss TTK 60–100s, Bits/run bands).

### Subagent delegation (cost policy)

The main session runs on an expensive frontier model — reserve it for design, implementation, and debugging. Routine verification is delegated to cheaper project subagents (defined in `.claude/agents/`):

- **`build-verifier`** (Haiku): runs `npm run build` and reports tsc errors. Use it after every code change instead of running the build inline.
- **`sim-verifier`** (Sonnet): runs the headless simulator (and the offer test when relevant) and checks results against the ROADMAP.md balance watchlist. Use it after every gameplay/content/balance change instead of running the sim inline.

Run them in the background (or in parallel with each other) while continuing other work; act on their reports in the main session. Do not delegate implementation or fixes to them — they are run-and-report only.

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
src/render/  sprites.ts (procedural sprite baking), rendererBase.ts (RunEvent
             handling, effect/particle state, all 2D overlays/HUD on #hud) +
             world-pass backends: glRenderer.ts (WebGL2 batched quads — the
             default; gl/ holds the quad batcher + sprite atlas) and
             canvasRenderer.ts (frozen legacy fallback if WebGL2 init fails —
             keep it compiling, don't add new visuals to it).
src/ui/      menus.ts — all DOM UI (menus, shop, codex, level-up modal, summary).
src/audio/   sound.ts — synthesized SFX + generative music ("intensity" driven).
src/save/    save.ts — localStorage key `debugger-save-v1`; loads by merging
             stored JSON over defaults() so added fields survive old saves.
```

**Adding content** = add a record in `src/data/` + handle its behavior key if new:
- New **weapon**: record in `weapons.ts` (8-entry `levels` table, optional `evolveTo`). A new `WeaponKind` also needs a branch in `combat.ts` and visuals in `glRenderer.ts`/`sprites.ts`.
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
