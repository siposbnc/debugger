// Headless balance/system verification: runs a full game run in Node.
// Bundled with esbuild (no DOM access in game logic). The "bot" is invincible
// and drifts toward chests so reward flow can be observed.
//
//   npx esbuild scripts/simulate.ts --bundle --platform=node --outfile=scripts/simulate.cjs
//   node scripts/simulate.cjs

import { Run } from '../src/game/run';
import { makeOffer, applyOffer, grantChestCard } from '../src/game/levelup';
import { CHARACTERS } from '../src/data/characters';
import { MAPS } from '../src/data/maps';
import { DEFAULT_WEAPON_POOL } from '../src/data/weapons';
import { formatTime } from '../src/core/util';

const STEP = 1 / 60;
// usage: node simulate.cjs [characterId] [mapId] [maxMinutes]
const charId = process.argv[2] ?? 'ada';
const mapId = process.argv[3] ?? 'greenfield';
const maxMinutes = Number(process.argv[4] ?? 15);
console.log(`=== simulating ${charId} on ${mapId} (${maxMinutes} min cap) ===`);
const run = new Run(CHARACTERS[charId], MAPS[mapId], {},
  [...new Set([...DEFAULT_WEAPON_POOL, CHARACTERS[charId].weapon])], new Set());
run.invincible = true;

let lastLogMin = -1;
let damageTaken = 0;
const originalHurt = run.hurtPlayer.bind(run);
run.hurtPlayer = (amount: number) => { damageTaken += amount; originalHurt(amount); };

while (!run.over && run.time < maxMinutes * 60) {
  run.update(STEP);

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
    if (card) console.log(`  [${formatTime(run.time)}] chest bonus card: ${card.name}`);
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

  for (const ev of run.events) {
    if (ev.type === 'bossSpawn') console.log(`  [${formatTime(run.time)}] BOSS SPAWN: ${ev.name}`);
    if (ev.type === 'bossDie') console.log(`  [${formatTime(run.time)}] BOSS DOWN:  ${ev.name}`);
    if (ev.type === 'evolve') console.log(`  [${formatTime(run.time)}] EVOLVED: ${ev.weaponName} → ${ev.evolvedName}`);
    if (ev.type === 'objective') console.log(`  [${formatTime(run.time)}] OBJECTIVE: ${ev.name}`);
  }
  run.events.length = 0;

  const min = Math.floor(run.time / 60);
  if (min !== lastLogMin) {
    lastLogMin = min;
    console.log(
      `${formatTime(run.time).padStart(5)} | lv ${String(run.level).padStart(2)} | kills ${String(run.kills).padStart(5)} | ` +
      `alive ${String(run.enemies.length).padStart(3)} | dmg taken ${Math.round(damageTaken).toString().padStart(5)} | ` +
      `weapons ${run.weapons.map((w) => `${w.def.id}:${w.level}${w.def.isEvolution ? '*' : ''}`).join(', ')}`,
    );
  }
}

const results = run.computeBits();
console.log('\n=== RUN COMPLETE ===');
console.log(`victory: ${results.victory}, time: ${formatTime(results.timeSec)}`);
console.log(`kills: ${results.kills}, level: ${results.level}, bosses: ${results.bossKills}`);
console.log(`objectives: ${results.newObjectives.join(', ')}`);
for (const b of results.bitsBreakdown) console.log(`  ${b.label}: +${b.value}`);
console.log(`TOTAL BITS: ${results.bits}`);
console.log(`total damage taken (would-be): ${Math.round(damageTaken)} vs pool ~${Math.round(run.stats.maxHp)} HP`);
console.log('damage by weapon:');
for (const w of run.weapons) {
  const dps = w.totalDamage / Math.max(1, run.time - w.acquiredAt);
  console.log(`  ${w.def.name.padEnd(22)} lv ${w.level}${w.def.isEvolution ? '*' : ' '} ${Math.round(w.totalDamage).toString().padStart(8)} (${Math.round(dps)}/s)`);
}
if (run.allyDamage > 0) console.log(`  ${'(allies)'.padEnd(22)}      ${Math.round(run.allyDamage).toString().padStart(8)}`);
