# DEBUGGER — Game Design Document

*A roguelite survivors-like where a developer hunts literal bugs. This document is the
condensed design package for the implemented v1 (web build, TypeScript + Canvas).*

---

## 1. Elevator pitch

You are a developer trapped inside a corrupted software world. Bugs, memory leaks and
stack overflows have become monsters. Survive 15 minutes of escalating swarms, level up
through punny upgrade cards, evolve your dev tools into legendary weapons, defeat a boss
every two minutes, and spend earned **Bits** on permanent upgrades. *Vampire Survivors
meets a stand-up routine about production incidents.*

## 2. Core pillars

1. **Debugging as combat** — every system, name and joke maps to real software culture.
2. **Readable chaos** — hundreds of enemies, always legible (isometric, strong color language).
3. **One more run** — Bits, unlocks and objectives always leave a next goal.
4. **Funny, not a joke game** — humor in names/flavor; numbers and mechanics stay serious.
5. **Meta progression is mandatory, not optional** *(user directive 2026-06-12)* — the
   meta shop is not a convenience layer: harder maps are tuned to be near-unwinnable at
   zero meta *even on a good in-run build* (per-map `enemyScale`, certification in
   BALANCE.md §5). The intended loop is lose → bank Bits → buy → come back measurably
   stronger. This pillar is what the v0.5 infinite-meta/prestige endgame stands on —
   there must always be a wall worth returning stronger for.

## 3. Target player experience

Minute 0–2: power fantasy onboarding. Minute 2–8: build crafting under growing pressure.
Minute 8–15: bullet-heaven crescendo where a good build pops the screen. Death always
converts into Bits → visible permanent progress.

## 4. Core gameplay loop

Move (WASD) → weapons auto-fire → bugs drop XP gems → gems magnetize → level up →
pick 1 of 3 cards → grow stronger → boss every 2:00 → chest (evolution or bonus card) →
die or stabilize the system at 15:00 → Bits → meta shop → run again.

## 5. Run structure

| Time | Event |
|---|---|
| 0:00 | Spawns begin (Syntax Mites) |
| each min | Difficulty director: HP ×(1+0.24t+0.015t²), DMG ×(1+0.11t), spawn interval ×0.915ᵗ |
| 2:00 / 4:00 / … | Boss (5s warning banner), from the map's `bossOrder`, cycling with tier scaling |
| 4:00+ | Elites: chance 1.5% +0.8%/min — ×9 HP, ×10 XP, gold aura, may drop coffee (heal) |
| 15:00 | **SYSTEM STABILIZED** — victory |

## 6. Permanent progression structure

13 meta upgrades (cost = base × 1.55–1.9^level): starting HP/damage/speed/pickup/XP/
regen/armor/luck, +reroll/+banish/+defer, +1 weapon slot (4→5), boss-reward +25%/lvl.
Plus unlocks: 3 characters (250/450/700 ⌬), 4 weapons (200–600 ⌬), 1 map (500 ⌬).

## 7. Bits economy

`Bits = (min×10 + kills×0.1 + bosses×50×bossRewardMult + level×5 + objectives×100) × mapMult`
Measured yields (headless sim): first runs ~300–700, strong victory run ~1500–2100.
First meta purchases land after 1–2 runs; full shop ≈ 25–35 runs.

## 8. Character roster

| Name | Archetype | Weapon | Passive |
|---|---|---|---|
| **Ada Commit** (starter) | Full-Stack Dev | Syntax Wand | +10% XP |
| **Max Pipeline** | DevOps | Deployment Hammer | Auto-turret node every 12s (10s life) |
| **Nia Nullguard** | QA Tester | Assertion Blades | +5% crit, +25% crit vs elites/bosses |
| **Linus Patchwell** | OSS Maintainer | Garbage Collector | Helper process every 16s (9s life) |

## 9. Weapon roster (8 + 8 evolutions)

| Weapon | Kind | Behavior | Evolution |
|---|---|---|---|
| Syntax Wand | bolt | code bolts at nearest | Compiler's Scepter (5 piercing fast bolts) |
| Deployment Hammer | shockwave | radial slam + knockback | Release Breaker (double wave + stun) |
| Assertion Blades | orbit | orbiting blades | Test Suite Halo (8 blades, wide) |
| Garbage Collector | sweep | melee arc, deletes weakened small bugs | Heap Purifier (360°, absorbs heal 1 HP) |
| Regex Grimoire | chain | beam chaining between bugs | The Perfect Match (marks: +25% dmg taken) |
| Stack Staff | column | force columns on random targets | Overflow Spire (recursive 3-column lines) |
| Daemon Familiar | pet | orbiting shooter pet | Process Legion (5 pets, rapid fire) |
| Breakpoint Bow | snipe | piercing slowing shot | Timefreeze Debugger (pierce-all freeze) |

8 levels each; **evolution**: weapon at max level + collect a boss chest.

## 10–11. Upgrade card system

3 cards per level-up; pool = weapon level-ups (weight 70), new weapons (30), 32 stat
cards (rarity-weighted: 50/28/13/5/1.4, halved per-card; luck multiplies rare+ weights).
Reroll/banish/defer are meta-unlocked (Defer takes no card and banks 20% of the
next level's XP requirement — momentum without power). Examples: **Hotfix** (+8% dmg, C),
**Rubber Duck Insight** (+1 luck +10% XP, R), **Merge Conflict** (+40% dmg −10 HP, E),
**The 10x Developer** (+10% everything, L). Full list: `src/data/upgrades.ts`.

## 12. Enemy roster

Syntax Mite (swarm), Cache Tick (cluster ×6), Null Pointer Wasp (charge dash),
Memory Leech (drain + self-heal), Race Condition Spider (jitter + duplicates),
Exception Beetle (death explosion), Deadlock Scarab (player slow aura),
Stack Overflow Centipede (segmented tank). Stats: `src/data/enemies.ts`.

## 13. Boss roster

Every boss is two-layered (v0.3 boss mechanics pass): layer 1 is the attack
pattern (a movement check), layer 2 bends a rule to test the **build** — DPS
checks, soft enrages, interrupt thresholds. Rationale: pre-v0.3 bosses were
"different attack patterns, not unique fights" and fell to pure dodge/kite play;
a boss should be a challenge precisely when the build is weak. Tuning constants
live at the top of `src/game/bossLogic.ts`.

**Bullet heaven by default** *(user directive 2026-06-12)*: most bosses must
fight through dodgeable projectile patterns — the Infinite Loop is the
reference. A boss with no bullet layer is the *exception* and must buy its
uniqueness with other pressure (speed, heavy melee, hard-to-avoid mechanics,
bug spawning); the Legacy Monolith is the canonical one (pillars + breeding +
bulk, zero shots).

**Boss tiers** (v0.3, shipped): bosses split into **standard** and **unique**
(`BossDef.tier`). Standard bosses fill the every-2-minutes slots, drawn from
the map's *weighted pool* (`MapDef.bossPool`) — random, no immediate repeat,
and two **light-slot rules** (base HP ≤ 800 only): the 2:00 opener (no build
yet) and every post-finale slot (feature freeze: a 14:00 tank with ~60s +
crunch to die was an automatic release-slip, sim-caught). Each map has exactly
one **unique** finale (`MapDef.uniqueBoss`) at the fixed 12:00 slot: Legacy
Monolith → Greenfield, The Critical Exception → Memory Marsh, The Production
Incident → Production Server, The Kernel Panic → Cyber Glacier. The Race
Condition joined the standard pool (all maps). Standard base HP sits in a
narrow 650–1000 band — slots are random, so escalation is the per-slot tier
multiplier's job; finale base HP *descends* as the map ladder climbs
(2600/2400/2200/2400) because the slot multiplier, the map's `enemyScale` and
the finale's own resist mechanics all stack on it (certified against the
BALANCE.md §5 maxed-meta arms).

| Boss | Layer 1: pattern | Layer 2: build test |
|---|---|---|
| The Merge Conflict | sprays aimed diff-hunk fans (3 shots whole, 4 per half once split, enraged half at ×0.55 period) and splits into two at 50% HP — both must die (each half starts at a full bar, **55%** of the original pool — at the old 35% the halves died before the enrage could ever matter; post-split is now the longer part of the fight) | halves linked by a damaging diff tether; >25% HP gap force-push enrages the stronger half (+50% dmg, +60% speed, denser volleys, "!!" marker + red ring) until the gap closes below 12% → spread your damage |
| The Memory Leak | drips damage pools + lobs slow heap globs at your feet that splash short-lived puddles (bullet layer: dodge the lob, lose the ground it lands on) | pools never expire while it lives (cap 28, oldest paged out; glob splashes don't count) — soft-enrage DPS check; death frees every pool at once |
| The Infinite Loop | radial bursts, faster each cycle | snapshots your position every 7s and rewinds you to it 2.5s later (marker shown) → plan positions, end the fight before the bursts compound |
| The Stack Overflow | summons recursive mites + aimed 5-shot fans | live mites are stack frames: 50% damage resist while any live (shield ring + one pip per frame over its HP bar); clearing the stack pops it — 2.5s stun at full vulnerability (10s pop cooldown) → add-clear/AoE check |
| The Legacy Monolith | armored phase (75% resist) ↔ exposed core | armor spawns 3 Deprecated Dependency pillars that soak shots/auto-aim and **holds until all are destroyed** (no timer; 5s exposed core after). Pillars *orbit* the boss — they travel with it, so the boss advancing is what brings them into weapon range (stationary pillars left a kiting melee build unable to ever break armor — sim-caught). Also breeds bugs: pairs from the map's spawn pool hatch around it every 4.5s the whole fight — it's legacy code, touching it makes more bugs |
| The Race Condition *(standard, v0.3)* | blinks to mid-range every ~4s, fires an aimed 4-fan on arrival | leaves a fragile **afterimage** (3% HP — any real hit pops it) at its old position; an image expiring unkilled = the race resolved in its favor → it heals 3% (attention/aim test, not a DPS test — at 7% image HP a kiting build that never faced the image stalled the fight on heals, sim-caught) |
| The Critical Exception *(Marsh finale, v0.3)* | huge telegraphed ground slams (1.25s circle, leave it or eat ~32×tier) + radial shard scatter from every impact | slam cadence accelerates linearly as HP drops (3.4s → 1.7s) and doubles below 50% (second slam *leads* the escape heading) — the dodge boss becomes a DPS race: end it before the floor is all telegraphs |
| The Production Incident *(Production finale, v0.3)* | aimed 4-fans + permanent leak pools (the Leak's kit, slower drip) | **two prior mechanics at once**: also summons stack frames (50% resist while any live, pop-stun on clear — the Overflow's kit, longer downtime). Lowest finale base HP on purpose: the frame guard nearly doubles its effective pool |
| The Kernel Panic *(Glacier finale, v0.3)* | expanding rings of **chill shards** — every hit lags the player (0.5× speed, 1.6s) | hard-freeze rhythm: at 70%/35% HP it locks up for 4s (0.15× armor, blizzard-rate rings) then **thaws** for 4s at 1.5× damage taken — burst-window test: strike the thaw |

A boss that is resistant *right now* always shows the rotating dashed shield
ring (+ desaturated sprite) — the armored state is never invisible.

Tier scaling: HP ×(1+0.35·slot), DMG ×(1+0.15·slot) — slot index is the only
escalation now that draws are random (the old base-HP spread encoded a fixed
order). Standard pool: Merge Conflict 650 / Memory Leak 800 / Race Condition
800 / Infinite Loop 900 / Stack Overflow 1000.

**Crunch Time** (v0.3, punishment rework 2026-06-12): the release ships at
15:00 — any boss still alive then is a *release blocker*. Instead of a free
victory, the run enters 30s of crunch — and crunch is a **punishment, not a
rescue** (user directive: the original version descoped the trash on the spot,
which made the overtime *easier* than the fight before it). Now: every live bug
**goes critical** (+50% damage, +30% speed, pulsing red ring + saturated
sprite) instead of despawning; anything hatched during overtime (Monolith
breeding, stack frames) is born critical; only *new* spawns freeze (feature
freeze) — and straggler recycling keeps running, so the critical horde cannot
be kited off. The player still gets crunch adrenaline (+50% damage, +15% move
speed) so a strong build has a real shot. Kill every blocker before the timer
ends → victory; any blocker outliving crunch → **the release slips and the run
is failed** ("RELEASE SLIPPED" summary). Constants: `CRUNCH_*` in
`src/game/run.ts`, `CRITICAL_*` in `src/game/spawner.ts`.

## 14. Maps

**Greenfield Repository** (starter): corrupted meadow, full pool, ×1.0 Bits, enemyScale 1.0.
**Memory Marsh** (500 ⌬): leech-heavy, static toxic pools (slow + dps), ×1.25 Bits, enemyScale 1.2.
**Production Server** (1200 ⌬): overheating floor vents (telegraphed eruptions), beetle/scarab
skew, ×1.5 Bits, enemyScale 1.35.
Map price, Bits multiplier and `enemyScale` climb together: the meta-gating ladder
(core pillar 5) — each next map is bought with the previous one's earnings and demands
the meta power those earnings bought. Future biomes (post-MVP): Stack Canyon, Cloud
Citadel, Cyber Glacier, Firewall Bastion, Legacy Ruins, Nullwood Forest.

## 15–16. Objectives & unlocks

12 one-time objectives (+100 ⌬ each, checked live, persisted): survive 5/10/15, kill
500/1500, level 10/20, boss 1/3, evolve a weapon, collect 500 XP, marsh 10-min.
Unlock surface = objectives (Bits) + shop (characters/weapons/maps/meta).

## 17. Difficulty scaling model

See §5. Knobs live in `difficulty()` (`src/data/enemies.ts`), per-map `spawnPlan`
phase tables (interval + enemy weights per minute band), and per-map `enemyScale`
(flat enemy + boss HP/damage multiplier — the meta-gating lever, core pillar 5;
certified values + win-rate targets in BALANCE.md §5). Enemy cap 380.

## 18. UI/UX

In-run HUD: XP bar + level (top), timer, kill & live-Bits counters, next-boss countdown,
boss HP bar, weapon icons + levels, HP bar, banner system (boss warning, objective,
evolution). Level-up modal: 3 rarity-glowing cards + reroll/banish/defer. Menus: start,
characters, maps, shop, codex (stats/bugs/incidents/objectives), settings. Post-run:
victory/defeat header, stat rows, itemized Bits breakdown.

## 19. Art direction

"Corrupted IDE" terminal-fantasy: near-black blue-green field, phosphor green/cyan =
player power, red/orange/purple = corruption, gold = rarity/reward. Procedurally drawn
glowing bugs (big eyes, software-glyph markings), 2:1 isometric diamond tiles with
circuit traces and corruption patches, CRT scanline overlay, glitch-square death
particles, VT323 + IBM Plex Mono.

## 20. Audio direction

100% synthesized WebAudio: square-wave shoot blips, glitch noise kills, alarm boss
warnings, arpeggio fanfares. Music: generative A-minor synthwave loop (bass, arpeggio,
hats) whose density/octaves rise with `intensity` = time/10min.

## 21. Game feel

Hit-flash, knockback, screen shake (scaled by event weight), floating damage numbers
(crits gold + larger), XP magnet streams, level-up screen flash, chest jingles, boss
death particle showers. Shake is toggleable.

## 22. First 10 minutes (intended)

0:00 lone wand bolts → 1:30 first card → 2:00 Merge Conflict (panic, kite, win ≈3:30)
→ chest → second weapon online → 5:00 objective banner + Smoke Test ⌬ → 6:00 Infinite
Loop forces movement through bullet rings → 8:00 build crystallizes (third weapon,
first epic card) → 10:00 Legacy Monolith phase-dance while trash floods the screen.

## 23. First 5 runs (intended)

R1: die ~7–9 min, ~400 ⌬ → buy HP + damage. R2: die ~10 min, unlock Regex Grimoire.
R3: first 15:00 victory attempt, unlock Max Pipeline. R4: Memory Marsh attempt.
R5: first evolution + Senior promotion objective; shop ~30% complete.

## 24. Data schemas

All content data-driven under `src/data/`: `types.ts` defines `WeaponDef` (kind +
8-level stat tables), `EnemyDef` (behavior + flags), `BossDef` (mechanic key),
`UpgradeCard` (StatMods), `CharacterDef`, `MapDef` (palette, spawnPlan, bossOrder),
`MetaUpgradeDef`, `ObjectiveDef` (predicate over `RunStatsView`). Adding content =
adding a record; behaviors are keyed enums handled in `src/game/`.

## 25. MVP scope — ✅ implemented

Everything above: 8+8 weapons, 8 enemies + elites, 5 bosses, 32 cards, 4 characters,
2 maps, 13 meta upgrades, 12 objectives, save/load, full menu flow, synth audio,
victory at 15:00, headless balance simulator (`scripts/simulate.ts`).

## 26. Post-MVP ideas

More biomes w/ unique hazards; weekly seeded challenge; passive item slots (split from
stat cards); curses/difficulty modifiers for Bits multipliers; achievements→cosmetics;
in-run events (bug nests, broken terminals to repair); controller support; meta tree UI;
Endless mode past 15:00; localized wordplay.

## 27. Balance recommendations

Keep kill rate ≥ spawn rate before minute 6 for any starting weapon (sim-verified:
wand ~100 kills by 2:00). First boss TTK target 60–100s. Watch: Assertion Blades scale
hardest with cooldown builds; Exception Beetle density above minute 10 (explosion
stacking); Bits inflation from objective re-runs is impossible (one-time) — main faucet
is boss kills, gated by bossRewardMult price.

Card power is capped structurally (2026-06-12 card-tuning pass): rares stack ×3,
epics ×2, legendaries ×1 — default-5 stacking on high tiers was the "stupidly strong"
outlier (5× Compiler Blessing = +150% dmg). Joke downsides must be real downsides
(Merge Conflict card −25 HP, Infinite Loop card −12% dmg). The **meta gap** is the
core certification metric: on harder maps the zero-meta→maxed-meta win-rate spread
must stay wide (BALANCE.md §5) — never tune it away.

## 28. Risks & design challenges

- **Perf**: WebGL2 batched-quad world renderer (2026-06-12 — late-game particle density
  is the design, so the renderer must scale past it, not shed it): atlas-packed baked
  sprites + SDF primitives, normally one draw call per frame; particle cap 6000 (2D
  fallback: 900). Enemy cap 380 (a balance constant, not a render limit), spatial hash.
  Degrade path: FPS safeguard sheds particle density, never the enemy cap.
- **Late-run legibility**: enforced palette separation (player=cool, enemy=warm) + damage-number cap.
- **The stationary degenerate strategy**: drains (leech), pools, scarab slows and charge
  dashes all punish standing still.
- **The running degenerate strategy**: the player (150 u/s) outpaces every enemy at any
  difficulty, so outrun enemies past ~1150 units are recycled onto the spawn ring around
  the player (`spawner.ts`). The horde can be dodged but never shed — kill rate, not
  movement speed, decides survival. Mortal-bot win-rate targets: BALANCE.md §5.
- **Joke fatigue**: humor lives in flavor text only; mechanical text stays literal.

## 29. Roadmap

v0.1 (this build) → v0.2 polish: pause-menu stat sheet, minimap, gamepad →
v0.3 content: 2 biomes, 4 weapons, 8 characters → v0.4 challenge/endless modes →
v1.0: Steam wrap (Electron/Tauri), achievements, localization.

## 30. Terrain & obstacles (v0.3)

Maps stopped being featureless planes; the design rules (all user-ruled 2026-06-12):

- **Blockers** are per-run collision circles (`Run.obstacles`) with a per-map sprite +
  layout: Production = server racks in **aisle rows** (2–4 tight bodies forming walls,
  ≥170u corridors between rows — the wall is the terrain, the aisle is the play),
  Marsh = dead-process stumps (scatter), Glacier = frozen-process ice columns
  (scatter). **Greenfield stays featureless by design** (tutorial plane + balance
  anchor). Collision is push-out (slide-along falls out of removing only the
  penetration component; multi-pass for wall rows). Bosses **crush** blockers they
  plow into (`crush` event) — fights progressively clear the arena, and no boss can
  be stranded. Blockers are permanent (destructibility is reserved for v0.4 in-run
  event objects).
- **Cover blocks projectiles only**: flat-flying shots die on blockers from BOTH
  sides; lobbed arcs (Fork Bombs, heap globs) fly over; instant effects (chains,
  smites, columns, sweeps, explosions) ignore cover. Projectile-weapon auto-aim is
  **LOS-gated** (`Run.hasLOS`) so the player's weapons don't waste cycles on covered
  targets; enemy tracers stay cover-blind — a dumb bug emptying its magazine into a
  rack is the player's reward for using cover.
- **Patches** are non-damaging floor terrain (`Run.patches`), symmetric by ruling —
  regular bugs ride/sink exactly like the player (frozen ones included; drift is
  physical), bosses/stationaries exempt: Production **Data Bus** conveyor lanes
  (60 u/s carry), Marsh **Swap Space** gravity wells (16→40 u/s pull toward center).
  Hazards deal damage; patches move you — the categories never blur.
- **Balance sims never see terrain** (`noTerrain`, BALANCE.md sim-environment
  policy): win-rate baselines are terrain-independent by construction, and terrain
  correctness has its own instruments (`scripts/terrainTest.ts`, suspend round-trips,
  visual checks). Seeded challenge runs (v0.4) will inherit deterministic layouts
  automatically once `Run.rng` is seed-threaded.
