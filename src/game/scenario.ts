import { CHARACTERS } from '../data/characters';
import { MAPS } from '../data/maps';
import { WEAPONS, MAX_WEAPON_LEVEL, DEFAULT_WEAPON_POOL } from '../data/weapons';
import { CARD_BY_ID } from '../data/upgrades';
import { META_UPGRADES } from '../data/meta';
import { BOSS_INTERVAL } from '../data/bosses';
import { Run } from './run';

// Run-state injection for reproducing bug reports and testing specific builds:
// a Scenario describes a mid-run state (build, level, clock) and the run starts
// *from* it instead of fresh. Consumers: scripts/simulate.ts (--scenario flag,
// presets in scripts/scenarios/) and potentially the dev console. Same surface
// family as Run.forcedOffer — keep all injection going through Run's public
// methods so this file stays DOM-free and the headless rule holds.

export interface Scenario {
  /** Display name, free text. */
  name?: string;
  /** Character id (src/data/characters.ts). Default: ada. */
  char?: string;
  /** Map id (src/data/maps.ts). Default: greenfield. */
  map?: string;
  /** Meta upgrade levels by id, or 'max' for a fully bought shop. Default: none. */
  meta?: 'max' | Record<string, number>;
  /** Starting player level (xp curve position only — grants no card offers). */
  level?: number;
  /** Weapon id → level. Granted if not owned; evolution ids allowed. */
  weapons?: Record<string, number>;
  /** Drop the character's starting weapon first, so `weapons` defines the
   *  whole loadout (build isolation). */
  replaceWeapons?: boolean;
  /** Card id → stacks to apply (maxStacks is not enforced — author's intent). */
  cards?: Record<string, number>;
  /** Run clock start in minutes — spawn phases follow, and the boss schedule
   *  is advanced past already-due bosses (a mid-run state implies they were
   *  dealt with; they are NOT credited as kills). A boss due exactly at the
   *  start spawns immediately. Unlike dbg.time, which leaves the schedule
   *  alone and therefore floods the backlog of bosses on the next frame. */
  startMin?: number;
  // Consumed by the sim harness (scripts/), not by createScenarioRun:
  /** Sim window end in minutes. Default: 15. */
  maxMinutes?: number;
  /** Bot behavior: pick strategy + mortality (see scripts/simBot.ts). */
  bot?: { pick?: 'first' | 'greedy'; mortal?: boolean };
}

function fail(what: string, id: string, where: string): never {
  throw new Error(`scenario: unknown ${what} "${id}" — ids live in src/data/${where}`);
}

/** Build a Run starting from the scenario's state. */
export function createScenarioRun(sc: Scenario): Run {
  const character = CHARACTERS[sc.char ?? 'ada'] ?? fail('character', sc.char!, 'characters.ts');
  const map = MAPS[sc.map ?? 'greenfield'] ?? fail('map', sc.map!, 'maps.ts');
  const metaLevels = sc.meta === 'max'
    ? Object.fromEntries(META_UPGRADES.map((m) => [m.id, m.maxLevel]))
    : { ...(sc.meta ?? {}) };
  const pool = [...new Set([
    ...DEFAULT_WEAPON_POOL, character.weapon, ...Object.keys(sc.weapons ?? {}),
  ])];
  const run = new Run(character, map, metaLevels, pool, new Set());
  applyScenarioState(run, sc);
  return run;
}

/** Inject the scenario's mid-run state into an existing (fresh) run. */
export function applyScenarioState(run: Run, sc: Scenario): void {
  if (sc.replaceWeapons) run.weapons.length = 0;
  for (const [id, lvl] of Object.entries(sc.weapons ?? {})) {
    if (!WEAPONS[id]) fail('weapon', id, 'weapons.ts');
    let w = run.weapons.find((x) => x.def.id === id);
    if (!w) { run.addWeapon(id); w = run.weapons[run.weapons.length - 1]; }
    w.level = Math.max(1, Math.min(MAX_WEAPON_LEVEL, Math.round(lvl)));
  }
  for (const [id, n] of Object.entries(sc.cards ?? {})) {
    const card = CARD_BY_ID[id] ?? fail('card', id, 'upgrades.ts');
    for (let i = 0; i < n; i++) run.applyCard(card);
  }
  if (sc.level !== undefined) run.level = Math.max(1, Math.round(sc.level));
  if (sc.startMin) {
    run.time = Math.max(0, sc.startMin * 60);
    // skip bosses that were due before the start (boss k spawns at (k+1)·interval);
    // one due exactly at startMin still spawns on the first frame
    const past = Math.max(0, Math.ceil(run.time / BOSS_INTERVAL) - 1);
    run.bossIndex = past;
    run.nextBossAt = (past + 1) * BOSS_INTERVAL;
  }
}
