import type { CharacterDef } from './types';

export const CHARACTERS: Record<string, CharacterDef> = {
  ada: {
    id: 'ada', name: 'Ada Commit', archetype: 'Full-Stack Developer',
    desc: 'Writes the frontend, the backend, and the eulogy for every bug in between.',
    weapon: 'syntaxWand',
    passiveDesc: '+10% XP gain. Balanced and dependable.',
    mods: { xpGain: 0.1 },
    cost: 0, color: '#53e8a8', icon: '👩‍💻',
  },
  max: {
    id: 'max', name: 'Max Pipeline', archetype: 'DevOps Engineer',
    desc: 'Believes every problem is solved by adding one more stage to the pipeline.',
    weapon: 'deployHammer',
    passiveDesc: 'Every 12s, deploys an auto-firing turret node (lasts 10s).',
    mods: {},
    special: 'turrets',
    cost: 250, color: '#ffb347', icon: '👷',
  },
  nia: {
    id: 'nia', name: 'Nia Nullguard', archetype: 'QA Tester',
    desc: 'Has personally filed 4,812 bug reports. Tonight she closes them all.',
    weapon: 'assertBlades',
    passiveDesc: '+5% crit chance, +25% extra crit chance vs elites & bosses.',
    mods: { critChance: 0.05 },
    special: 'eliteCrit',
    cost: 450, color: '#6db9ff', icon: '🕵️‍♀️',
  },
  linus: {
    id: 'linus', name: 'Linus Patchwell', archetype: 'Open Source Maintainer',
    desc: 'Reviews your PR, rewrites your PR, then absorbs your PR into the kernel of himself.',
    weapon: 'garbageCollector',
    passiveDesc: 'Every 16s, merges in a helper process that fights beside you (9s).',
    mods: {},
    special: 'helpers',
    cost: 700, color: '#9be564', icon: '🧙',
  },
};

export const CHARACTER_LIST = Object.values(CHARACTERS);
