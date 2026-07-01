// Player-facing release notes for the "What's new" screen — newest first.
// One entry per shipped release, written at release time (a release-checklist
// step alongside the CHANGELOG.md move). Curated highlights in player tone,
// NOT a copy of the dev-facing CHANGELOG. Mechanics text stays literal;
// flavor lives in the `flavor` line.

export interface PatchNote {
  /** Release series, e.g. '0.2' — compared against save.lastSeenVersion. */
  version: string;
  name: string;
  date: string; // ISO, release day
  highlights: string[];
  flavor?: string;
}

export const PATCH_NOTES: PatchNote[] = [
  {
    version: '0.4',
    name: 'Modes & Replayability',
    date: '2026-07-02',
    highlights: [
      'Endless mode: clear a map to unlock its ENDLESS toggle — the workday ends at 8:00 with your victory payout banked, and everything past it is Overtime: escalating pay, exponentially escalating danger, and a per-map "longest shift" record. Every shift ends. How late did you stay?',
      'Curses: seven opt-in modifiers that pay extra Bits for extra pain — from +35% enemy HP to a Kernel Lock that periodically freezes your weapons for 15 telegraphed seconds. Stack all seven for +180% pay, if you dare',
      'Every map now fights differently: each has its own bug roster — Memory Marsh drains and slows, Production Server crashes and explodes, Cyber Glacier tanks and chills. 20 new map-native bugs, most with their own look',
      'In-run events: Bug Nests to torch and Hung Terminals to reboot appear on the radar — bounty chests and Credits for those who go',
      'Credits: a new in-run currency from events and elites, spent at the post-boss Package Registry on one-run consumables (heal, magnet sweep, extra reroll, damage/speed buffs). Unspent Credits die with the run',
      'A real minimap: horde density, gold elites, chests, events and boss markers at a glance',
      'The shop now sells everything in one place — stat upgrades, weapon licenses and characters, in tabs — and new maps stay hidden until you clear the one before',
      'Codex arsenal tab: every weapon with its evolution chain and your lifetime damage; the pause screen puts your build front and center with full weapon cards',
      'Harder by design: the new rosters and spawn plans were certified against tighter balance targets — early runs are meant to sting',
    ],
    flavor: 'Normal work hours are 8:00 sharp. The overtime is voluntary, the bugs are not.',
  },
  {
    version: '0.3',
    name: 'Content Expansion',
    date: '2026-06-12',
    highlights: [
      'Two new maps: Production Server (erupting floor vents, server-rack aisles, data-bus conveyors) and Cyber Glacier (latency fields that lag everything inside — you included)',
      'Maps are no longer empty planes: racks, dead process trees and ice columns block movement and stop bullets — bosses just crush through them',
      'Every map now ends in its own unique 12:00 finale boss, with the earlier slots drawn from a per-map pool — plus 4 new bosses, each a real mechanic, not just more HP',
      'Crunch Time: bosses alive at 15:00 trigger 30 seconds of overtime — every bug goes critical, and an unresolved blocker fails the run with RELEASE SLIPPED',
      'New weapons: Fork Bomb, Firewall, Ping Storm and Sudo Scroll, each with an evolution — the arsenal is 12 base weapons now',
      '4 new developers: Rex Intern (random starter), Sec Hexa (thorns), Dana Tensor (XP-powered damage) and Greybeard Cobol (immune to slows)',
      'Shields: a recharging layer over your HP that comes back if you avoid damage — with new cards and an Air Gap meta upgrade',
      '11 new upgrade cards, 2 new late-game bugs (one shoots back, one blocks frontal damage), and a higher cooldown cap for dedicated attack-speed builds',
      'Harder by design: pricier maps now genuinely require meta investment — a good build alone no longer clears them',
      'The codex and meta shop reveal entries as you encounter them, weapon cards preview their exact level-up numbers, and the pause screen shows your full weapon stats',
      'New WebGL renderer: the late game got denser, the frame rate did not',
    ],
    flavor: 'The roadmap said "more reasons to do one more run." The roadmap has been implemented.',
  },
  {
    version: '0.2',
    name: 'Polish & QoL',
    date: '2026-06-12',
    highlights: [
      'Pause is now a full run overview: live stat sheet, per-weapon damage and DPS, taken cards, and your actual card odds',
      'Upgrade cards preview their real effect ("Damage ×1.00 → ×1.08") and warn when a pick would be wasted on a capped stat',
      'Suspend & resume: SUSPEND PROCESS saves a run mid-fight; pick it up later from the main menu',
      'Full gamepad support and keyboard navigation in every menu; touch controls make mobile browsers playable',
      'Skip reworked into Defer: banks 20% of the next level\'s XP instead of giving nothing',
      'Repeated picks now decay in the offer pool, so level-ups stay varied',
      'Difficulty reworked: strong builds win runs — endless kiting no longer does',
      'Bug Database grew sprite thumbnails, lifetime stats, and NEW badges on anything you haven\'t seen',
      'Healing shows green numbers, your character has a health bar (toggleable), and off-screen bosses get an edge marker',
    ],
    flavor: 'Also: something that is NOT A BUG occasionally wanders the codebase. Catch it.',
  },
  {
    version: '0.1',
    name: 'MVP',
    date: '2026-06-10',
    highlights: [
      'The core loop ships: 15-minute survival runs — squash bugs, level up, and stabilize the system',
      '8 weapons with 8 levels each, plus 8 boss-chest evolutions',
      '8 bug types with distinct behaviors, elite variants, and 5 bosses on a 2:00 cycle',
      '4 playable characters, 2 maps, 32 upgrade cards across 5 rarities',
      'Bits economy: 13 permanent meta upgrades, weapon licenses, and 12 objectives',
      'Synthwave that intensifies as things go wrong, and a corrupted-IDE look drawn entirely in code',
    ],
    flavor: 'Zero assets were harmed in the making of this game: every sprite is procedural, every sound synthesized.',
  },
];
