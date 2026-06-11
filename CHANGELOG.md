# 📜 CHANGELOG

All notable shipped changes to **Debugger**. Newest first.

When a [ROADMAP.md](ROADMAP.md) milestone ships, its section is removed from the roadmap and
recorded here — rewritten as *what changed* (past tense, player-facing first, tech notes after),
not as a copied task list. Dropped or deferred items are noted at the end of each entry.

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
