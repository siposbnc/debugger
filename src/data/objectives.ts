import type { ObjectiveDef } from './types';

// Checked during the run (each completion: +100 Bits in the formula, persisted
// so it can only be earned once across all runs).

export const OBJECTIVES: ObjectiveDef[] = [
  { id: 'survive5', name: 'Smoke Test', desc: 'Survive 5 minutes', check: (s) => s.timeSec >= 300 },
  { id: 'survive10', name: 'Soak Test', desc: 'Survive 10 minutes', check: (s) => s.timeSec >= 600 },
  { id: 'survive15', name: 'Stable Release', desc: 'Survive the full 15 minutes', check: (s) => s.victory },
  { id: 'kill500', name: 'Issue Triage', desc: 'Squash 500 bugs in one run', check: (s) => s.kills >= 500 },
  { id: 'kill1500', name: 'Backlog Zero', desc: 'Squash 1,500 bugs in one run', check: (s) => s.kills >= 1500 },
  { id: 'level10', name: 'Promotion: Mid-Level', desc: 'Reach level 10', check: (s) => s.level >= 10 },
  { id: 'level20', name: 'Promotion: Senior', desc: 'Reach level 20', check: (s) => s.level >= 20 },
  { id: 'boss1', name: 'First Incident Closed', desc: 'Defeat a boss', check: (s) => s.bossKills >= 1 },
  { id: 'boss3', name: 'On-Call Hero', desc: 'Defeat 3 bosses in one run', check: (s) => s.bossKills >= 3 },
  { id: 'evolve', name: 'Major Version Bump', desc: 'Evolve a weapon', check: (s) => s.evolvedWeapons >= 1 },
  { id: 'xp500', name: 'Knowledge Base', desc: 'Collect 500 XP in one run', check: (s) => s.xpCollected >= 500 },
  { id: 'marshWin', name: 'Drained the Swamp', desc: 'Survive 10 minutes in Memory Marsh', check: (s) => s.mapId === 'memoryMarsh' && s.timeSec >= 600 },
  { id: 'mushiCatch', name: 'Cabal of Two', desc: 'Walk into a very rare visitor before it evaporates', check: (s) => s.mushiCaught },
];

export const OBJECTIVE_BITS = 100;
