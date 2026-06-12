// Shared content types. All game content (weapons, enemies, bosses, cards,
// characters, maps, meta upgrades, objectives) is plain data conforming to these.

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9fb4c7',
  uncommon: '#41d97f',
  rare: '#3fa9ff',
  epic: '#c45bff',
  legendary: '#ffc12e',
};

/** Additive stat modifiers. Percent-like fields are fractions (0.1 = +10%). */
export interface StatMods {
  maxHp?: number;          // flat HP
  regen?: number;          // HP per second
  armor?: number;          // flat damage reduction per hit/tick
  speed?: number;          // +% move speed
  damage?: number;         // +% weapon damage
  cooldown?: number;       // +% cooldown reduction (capped)
  area?: number;           // +% effect area/size
  projectiles?: number;    // +flat extra projectiles
  critChance?: number;     // +flat crit chance (0.05 = 5%)
  critMult?: number;       // +flat crit damage multiplier
  pickupRadius?: number;   // flat world units
  xpGain?: number;         // +% XP
  luck?: number;           // shifts rarity weights upward
  rerolls?: number;        // +flat per-run
  banishes?: number;
  skips?: number;
}

export interface UpgradeCard {
  id: string;
  name: string;
  rarity: Rarity;
  category: string;
  icon: string;     // single glyph/emoji rendered on the card
  desc: string;     // mechanical effect, plain language
  flavor: string;   // the joke
  mods: StatMods;
  /** Max times this card may be offered/taken in one run (default 5). */
  maxStacks?: number;
}

export type WeaponKind =
  | 'bolt'       // projectile at nearest enemy
  | 'shockwave'  // expanding ring around player
  | 'orbit'      // persistent orbiting blades
  | 'sweep'      // melee arc in facing direction
  | 'chain'      // instant beam chaining between enemies
  | 'column'     // eruptions at random nearby enemies
  | 'pet'        // familiar that shoots
  | 'snipe'      // piercing slowing shot
  | 'bomb'       // lobbed bomb that explodes and splits into child bombs
  | 'wall'       // persistent flame wall (line ahead / DMZ ring) burning crossers
  | 'homing'     // packets steering toward random enemies
  | 'smite';     // rare massive single-target strike

export interface WeaponLevelStats {
  damage: number;
  cooldown: number;   // seconds
  count: number;      // projectiles / blades / columns / pets / chain hits
  area: number;       // radius or size multiplier basis (world units)
  speed: number;      // projectile speed (where relevant)
  duration: number;   // lingering effect time (where relevant)
  pierce: number;
  slow: number;       // slow fraction applied to victims (0.4 = 40% slower)
}

export interface WeaponDef {
  id: string;
  name: string;
  kind: WeaponKind;
  icon: string;
  color: string;
  desc: string;
  flavor: string;
  evolveTo?: string;      // weapon id this evolves into at max level via boss chest
  isEvolution?: boolean;
  levels: WeaponLevelStats[];   // index 0 = level 1
}

export type EnemyBehavior = 'chase' | 'charge' | 'jitter';

export interface EnemyDef {
  id: string;
  name: string;
  codexDesc: string;
  hp: number;
  speed: number;
  damage: number;      // contact damage per second
  radius: number;      // world units
  xp: number;
  bits: number;
  color: string;
  shape: 'mite' | 'tick' | 'wasp' | 'leech' | 'spider' | 'beetle' | 'scarab' | 'centipede' | 'flask' | 'pillar';
  behavior: EnemyBehavior;
  /** spawn in clusters of N (Cache Tick) */
  cluster?: number;
  explodeOnDeath?: boolean;
  /** never moves, immune to knockback, exempt from straggler recycling
   *  (Deprecated Dependency pillars) */
  stationary?: boolean;
  slowAura?: boolean;     // slows the player when near (Deadlock Scarab)
  drain?: boolean;        // extra close-range damage + heals itself (Memory Leech)
  duplicates?: boolean;   // occasionally spawns a short-lived copy (Race Condition Spider)
  /** Not a software defect at all (The Precipitate): never in spawn plans or the
   *  enemies array — run.ts drives it as its own entity; codex tags it NOT A BUG. */
  notABug?: boolean;
}

export type BossMechanic =
  | 'split' | 'pools' | 'burst' | 'summon' | 'phase'
  | 'teleport'   // race condition: blink + afterimage races
  | 'slam'       // critical exception: telegraphed AoE slams
  | 'incident'   // production incident: pools + stack-frame guard combined
  | 'panic';     // kernel panic: chill rings + hard-freeze/thaw rhythm

export interface BossDef {
  id: string;
  name: string;
  codexDesc: string;
  hp: number;          // base, scaled by tier
  speed: number;
  damage: number;      // contact dps
  radius: number;
  color: string;
  mechanic: BossMechanic;
  mechanicDesc: string;
  /** standard = fills the every-2-min slots from the map's weighted pool;
   *  unique = exactly one map's finale (fixed 12:00 slot, bigger kit). */
  tier: 'standard' | 'unique';
}

export interface CharacterDef {
  id: string;
  name: string;
  archetype: string;
  desc: string;
  weapon: string;          // starting weapon id
  passiveDesc: string;
  mods: StatMods;
  special?: 'turrets' | 'helpers' | 'eliteCrit' | 'randomWeapon';
  cost: number;            // Bits to unlock (0 = starter)
  color: string;
  icon: string;
}

export interface SpawnPhase {
  fromMin: number;                       // active from this minute
  interval: number;                      // base seconds between spawns
  weights: Record<string, number>;       // enemyId -> weight
}

export interface MapDef {
  id: string;
  name: string;
  desc: string;
  icon: string;                          // map-select card emoji
  bitsMult: number;
  cost: number;                          // Bits to unlock (0 = starter)
  palette: {
    ground1: string;
    ground2: string;
    grid: string;
    accent: string;
    fog: string;
  };
  hazardPools?: boolean;                 // toxic slow pools scattered on the field
  hazardVents?: boolean;                 // overheating floor vents (periodic damage zones)
  hazardLatency?: boolean;               // latency fields (slow player AND enemies inside)
  /** Enemy + boss HP/damage multiplier (default 1). The meta-gating lever:
   *  pricier maps are tuned to be unwinnable without meta-shop investment,
   *  even on a good in-run build — see BALANCE.md §5. */
  enemyScale?: number;
  spawnPlan: SpawnPhase[];
  /** Standard-boss weights for the every-2-min slots (weighted random draw,
   *  no immediate repeat; the 2:00 opener draws only light bosses). */
  bossPool: Record<string, number>;
  /** This map's unique finale boss — spawns at the fixed 12:00 slot. */
  uniqueBoss: string;
}

export interface MetaUpgradeDef {
  id: string;
  name: string;
  desc: string;       // per-level effect
  icon: string;
  maxLevel: number;
  baseCost: number;
  costGrowth: number; // cost = baseCost * costGrowth^level
  modsPerLevel?: StatMods;
  special?: 'weaponSlot' | 'bossReward' | 'startBits';
}

/** Snapshot of a finished (or ongoing) run for objectives + Bits scoring. */
export interface RunStatsView {
  timeSec: number;
  kills: number;
  level: number;
  bossKills: number;
  xpCollected: number;
  evolvedWeapons: number;
  victory: boolean;
  characterId: string;
  mapId: string;
  mushiCaught: boolean;
}

export interface ObjectiveDef {
  id: string;
  name: string;
  desc: string;
  check: (s: RunStatsView) => boolean;
}
