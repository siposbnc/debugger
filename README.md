# 🐛 DEBUGGER

*A roguelite survivors-like where the bugs are real — and you are the exterminator.*

You are a developer trapped in a corrupted software world. Survive 15 minutes of
swarming Syntax Mites, Null Pointer Wasps and Memory Leeches, level up through
pun-loaded upgrade cards, evolve your dev tools into legendary weapons, defeat a boss
every two minutes, and spend **Bits** on permanent upgrades between runs.

Built with TypeScript + Vite + HTML5 Canvas. No assets — every sprite is drawn
procedurally and every sound is synthesized with WebAudio.

## Run it

```bash
npm install
npm run dev        # → http://localhost:5173
npm run build      # production build in dist/
```

## Controls

| Input | Action |
|---|---|
| `WASD` / arrows | Move (weapons fire automatically) |
| `ESC` | Pause |
| Mouse | Menus & upgrade cards |

## The loop

1. Bugs swarm in — your weapons auto-attack the nearest.
2. Dead bugs drop XP gems; walk near to vacuum them up.
3. Level up → choose 1 of 3 upgrade cards (5 rarities, luck shifts the odds).
4. Every 2:00 a boss spawns — kill it for a chest: **evolves a max-level weapon**
   or grants a bonus rare+ card.
5. Die (or stabilize the system at 15:00) → earn **⌬ Bits** → buy permanent
   upgrades, characters, weapons and maps → go again.

## Dev tools

- `http://localhost:5173/?autostart` — skip the menu straight into a run
- `...?autostart&turbo` — 6× speed, invincible, auto-picked cards (balance watching)
- `npx esbuild scripts/simulate.ts --bundle --platform=node --outfile=scripts/simulate.cjs && node scripts/simulate.cjs [char] [map] [minutes]`
  — full headless run with per-minute balance logs

## Project layout

```
src/data/    all content as data: weapons, enemies, bosses, cards, characters,
             maps, meta upgrades, objectives
src/game/    simulation: run state, spawner, combat, boss logic, level-up offers
src/render/  procedural sprites, isometric renderer, particles, HUD
src/ui/      DOM menus, shop, codex, level-up modal, run summary
src/audio/   WebAudio SFX + generative synthwave music
src/save/    localStorage persistence
docs/        full game design document
```

See [docs/DESIGN.md](docs/DESIGN.md) for the complete design package.
