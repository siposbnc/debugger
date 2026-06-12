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
