// The shared headless "player bot" used by simulate.ts and matrix.ts: auto-picks
// the first offered card on level-up, opens chest bonuses, and drives movement
// (head for chests; orbit the boss if one is alive, else kite a wide circle).
// Keep both scripts on this one implementation so matrix conclusions always
// reflect the same bot simulate.ts shows.

import { Run } from '../src/game/run';
import { makeOffer, applyOffer, grantChestCard } from '../src/game/levelup';

export const STEP = 1 / 60;

/** One bot frame (call after run.update). Returns a granted chest-card name, if any. */
export function botStep(run: Run): string | null {
  let chestCard: string | null = null;

  // auto-pick first card on level up
  while (run.pendingLevelUps > 0) {
    const offer = makeOffer(run);
    if (offer.length === 0) { run.pendingLevelUps = 0; break; }
    applyOffer(run, offer[0]);
    run.pendingLevelUps--;
  }
  if (run.chestBonus) {
    run.chestBonus = false;
    const card = grantChestCard(run);
    if (card) chestCard = card.name;
  }

  // bot movement: head for chests, otherwise kite in a wide circle like a player
  const chest = run.pickups.find((p) => p.kind === 'chest');
  const speed = run.stats.moveSpeed * run.playerSlow;
  if (chest) {
    const dx = chest.x - run.px, dy = chest.y - run.py;
    const d = Math.hypot(dx, dy) || 1;
    run.px += (dx / d) * speed * STEP;
    run.py += (dy / d) * speed * STEP;
  } else {
    // orbit the boss if one is alive (players focus bosses), else kite a circle
    const boss = run.enemies.find((e) => e.isBoss);
    const ang = (run.time / 14) * Math.PI * 2; // one lap every 14s
    const cx = boss ? boss.x : 0, cy = boss ? boss.y : 0;
    const r = boss ? 190 : 280;
    const tx = cx + Math.cos(ang) * r, ty = cy + Math.sin(ang) * r;
    const dx = tx - run.px, dy = ty - run.py;
    const d = Math.hypot(dx, dy) || 1;
    const step = Math.min(d, speed * STEP);
    run.px += (dx / d) * step;
    run.py += (dy / d) * step;
  }
  return chestCard;
}
