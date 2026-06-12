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
  rex: {
    id: 'rex', name: 'Rex Intern', archetype: 'Intern',
    desc: 'Started Monday. Already has prod access, a mechanical keyboard, and no idea which tool he grabbed on the way in.',
    weapon: 'syntaxWand', // fallback only — randomWeapon special draws from the run's weapon pool
    passiveDesc: 'Starts with a random weapon. +30% XP gain, −20% max HP.',
    mods: { xpGain: 0.3, maxHp: -20 },
    special: 'randomWeapon',
    cost: 350, color: '#7df9ff', icon: '🧑‍🎓',
  },
  hexa: {
    id: 'hexa', name: 'Sec Hexa', archetype: 'Security Engineer',
    desc: 'Runs a zero-trust household. Anything that makes contact receives a signed, certified, very painful response.',
    weapon: 'firewall',
    passiveDesc: 'Thorns: attackers take back 20% of their contact damage.',
    mods: {},
    special: 'thorns',
    cost: 550, color: '#ff6b4d', icon: '🥷',
  },
  dana: {
    id: 'dana', name: 'Dana Tensor', archetype: 'Data Scientist',
    desc: 'Refuses to act without data. Every XP shard is another training sample, and the model only ever gets stronger.',
    weapon: 'pingStorm',
    passiveDesc: '+1% damage per 100 XP collected this run. Scales forever.',
    mods: {},
    special: 'xpPower',
    cost: 650, color: '#5fd7ff', icon: '👩‍🔬',
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
  cobol: {
    id: 'cobol', name: 'Greybeard Cobol', archetype: 'Legacy Maintainer',
    desc: 'Has maintained the mainframe since before your language existed. Walks slowly because nothing has ever made him hurry.',
    weapon: 'stackStaff',
    passiveDesc: 'Immune to all slows. −15% move speed. Unstoppable, eventually.',
    mods: { speed: -0.15 },
    special: 'slowImmune',
    cost: 800, color: '#c9b48a', icon: '🧓',
  },
};

export const CHARACTER_LIST = Object.values(CHARACTERS);
