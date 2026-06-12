---
name: design-entity
description: Design and implement a complete Debugger game entity (weapon, enemy, boss, card, character, meta upgrade) from a one-line concept — the data record in src/data/, any behavior key + sprite work, unlock/visibility wiring, codex + objective reminders, and the verification steps.
---

# design-entity — turn a one-line concept into shippable game content

The argument is a one-line entity concept (e.g. "a bomb that forks into smaller bombs").
Produce a complete, integrated entity — not just a record: everything in the checklists
below for its type, then verify.

## Step 0 — decide the type, read the truth

1. If the concept doesn't name a type, pick the best fit (weapon / enemy / boss /
   upgrade card / character / meta upgrade) and say why in one line.
2. **Schemas live in `src/data/types.ts` — read the relevant interface first.**
   Then read 2–3 neighboring records in the target file and match their shape,
   field order, and number ranges exactly. Numbers start as a copy of the closest
   existing record, nudged toward the concept — never invented from nothing.
3. Check the id is unused (`Grep` the id across `src/`). Ids are lowerCamelCase
   wordplay (`garbageCollector`, `raceSpider`).

## Naming & tone (non-negotiable house rules)

- Every name is **software-culture wordplay** (`Heap Purifier`, `Deadlock Scarab`,
  `The Merge Conflict`). Match the register of existing names in the same file.
- `desc` / `codexDesc` mechanics text is **literal and clear** — no jokes.
- `flavor` is **where the joke lives** (cards/weapons). Bosses put personality in
  `codexDesc` (deadpan incident-report voice) and mechanics in `mechanicDesc`.
- Color is meaning, not decoration: green/cyan = player power, red/orange/purple =
  enemies/corruption, gold = rarity/reward. Pick `color` accordingly.
- Icons are a single glyph/emoji.

## Per-type checklist

### Weapon (`src/data/weapons.ts`)
- [ ] Record with a full **8-entry `levels` table** (`MAX_WEAPON_LEVEL = 8`); index 0 = level 1.
      Growth must be monotonic and roughly match a comparable weapon's curve.
- [ ] Decide the `WeaponKind`. **Existing kind = data-only.** A new kind needs:
      a branch in `src/game/combat.ts` (DOM-free!), visuals in `src/render/draw.ts`
      (+ `src/render/sprites.ts` if it has a baked sprite).
- [ ] Evolution? `evolveTo` on the base + an `isEvolution: true` record for the evolved form.
- [ ] Reachability: add to `DEFAULT_WEAPON_POOL` **or** `SHOP_WEAPONS` (with a cost in line
      with the others) **or** make it a character's starting weapon — otherwise it never appears.
- [ ] Single-weapon scenario preset in `scripts/scenarios/` (cheap acceptance test —
      the v0.3 weapon-balance items expect one per weapon).

### Enemy (`src/data/enemies.ts`)
- [ ] Record. `codexDesc` **is** the codex entry (the Bug Database renders all of
      `ENEMIES` automatically — no separate codex wiring).
- [ ] `shape`: reuse one of the existing shapes, or add a new `BUG_DRAWERS` entry in
      `src/render/sprites.ts` *and* extend the `shape` union in `types.ts`.
- [ ] Behavior: `chase`/`charge`/`jitter` + boolean flags are implemented in
      `src/game/run.ts`. A new flag needs its handling there (DOM-free!).
- [ ] **Spawn reachability**: add the id to at least one map's `spawnPlan` weights in
      `src/data/maps.ts` — an enemy not in any phase table never spawns.

### Boss (`src/data/bosses.ts`)
- [ ] Record; `codexDesc` + `mechanicDesc` are the codex entry (auto-rendered).
- [ ] `mechanic`: existing `BossMechanic` = data-only; a new one needs a branch in
      `src/game/bossLogic.ts` + the union in `types.ts`.
- [ ] Sprite: add a case to `bossSprite()` in `src/render/sprites.ts` (switch on boss id).
- [ ] Reachability: add to a map's `bossOrder` in `maps.ts`.

### Upgrade card (`src/data/upgrades.ts`)
- [ ] Pure data — use the local `C(...)` helper like neighbors. `mods` keys come from
      `StatMods`; percent-like fields are fractions (`0.1` = +10%).
- [ ] A **new StatMods key** is a bigger change: `types.ts` + folding in
      `src/game/stats.ts` + a `STAT_VIEW` entry in `src/ui/menus.ts` (card preview) — flag it.
- [ ] Rarity must match power level of same-rarity neighbors; set `maxStacks` if below 5.

### Character (`src/data/characters.ts`)
- [ ] Record (passive = `mods` and/or a `special` key — new specials are code in
      `src/game/run.ts`, flag it). `cost` in line with existing unlockables.
- [ ] Starting weapon must exist. Character select renders `CHARACTER_LIST` automatically.

### Meta upgrade (`src/data/meta.ts`)
- [ ] Record with `baseCost`/`costGrowth` in line with neighbors; keep the full-shop
      cost target in mind (`docs/BALANCE.md`: ~12.9k ⌬ ≈ 25–35 runs).

## Step 2 — don't forget (every type)

- **Objectives**: propose 1 matching objective for `src/data/objectives.ts` if the
  entity suggests a natural challenge ("evolve X", "kill N of Y") — ask before adding
  if it wasn't in the concept.
- **Headless rule**: nothing in `src/game/` or `src/data/` may touch DOM/Canvas/WebAudio.
- ROADMAP.md: check the item off / log in the Progress log per the usual workflow.

## Step 3 — verify (same gates as any content change)

1. `build-verifier` subagent (tsc + build).
2. `sim-verifier` subagent — this **is** a gameplay/content change: 15-min sim vs the
   ROADMAP.md Balance watchlist; weapons/cards also need `offerTest` (offer pool changed).
3. New enemy/boss: eyeball the sprite (serve a build, screenshot the codex —
   thumbnails render every entity automatically).
