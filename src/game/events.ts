// In-run field events (v0.4): timed excursions that pay out a chest — the
// reason to actually move around the map. One event at a time, two kinds:
// a Bug Nest (destroy it: a stationary hatcher living in the enemies array,
// so targeting/damage/death just work) or a Hung Terminal (repair it: stand
// inside the ring until it reboots). Spawned just off-screen on a ~90s
// cadence, marked on the edge radar, despawns after 45s if ignored.
// Disabled under noTerrain (balance-sim policy 2026-06-12) — events are
// validated by scripts/eventsTest.ts, never by the watchlist sims.

import type { Enemy, Run } from './run';
import { ENEMIES, MAX_ENEMIES } from '../data/enemies';
import { dist, rand } from '../core/util';
import { makeEnemy, randomPhaseEnemyDef } from './spawner';

export type FieldEventKind = 'nest' | 'terminal';

export interface FieldEvent {
  kind: FieldEventKind;
  x: number; y: number;
  t: number;          // seconds left on the field before despawning unresolved
  progress: number;   // terminal reboot progress 0..1 (nest: unused)
  hatchT: number;     // nest: countdown to the next bred bug
  nest: Enemy | null; // the damageable nest entity (lives in run.enemies)
}

export const EVENT_FIRST_AT = 75;      // s — first excursion offer
export const EVENT_INTERVAL = 90;      // s from one event's end to the next
export const EVENT_JITTER = 12;
export const EVENT_LIFE = 45;          // s on the field before despawning
export const EVENT_DIST_MIN = 750;     // spawn band: just past the screen edge…
export const EVENT_DIST_MAX = 950;     // …but a short, deliberate trip
export const NEST_HATCH_INTERVAL = 3;  // s per bug bred while the nest stands
export const TERMINAL_RADIUS = 80;     // stand-within reboot range
export const TERMINAL_REPAIR_TIME = 4; // s inside the ring to reboot

const EVENT_NAME: Record<FieldEventKind, string> = {
  nest: ENEMIES.bugNest.name,
  terminal: 'Hung Terminal',
};

/** Place + activate an event of the given kind (also the test/dev hook). */
export function spawnFieldEvent(run: Run, kind: FieldEventKind): void {
  // rejection-sample a clear drop point in the ring band around the player
  let x = 0, y = 0;
  const clearance = kind === 'terminal' ? TERMINAL_RADIUS : ENEMIES.bugNest.radius + 30;
  for (let tries = 0; tries < 24; tries++) {
    const a = Math.random() * Math.PI * 2;
    const d = rand(EVENT_DIST_MIN, EVENT_DIST_MAX);
    x = run.px + Math.cos(a) * d;
    y = run.py + Math.sin(a) * d;
    if (run.obstacles.some((o) => dist(x, y, o.x, o.y) < o.r + clearance) ||
        run.zones.some((z) => dist(x, y, z.x, z.y) < z.radius + clearance)) continue;
    break; // last try stands either way — a slightly awkward spot beats none
  }
  const ev: FieldEvent = { kind, x, y, t: EVENT_LIFE, progress: 0, hatchT: NEST_HATCH_INTERVAL, nest: null };
  if (kind === 'nest') {
    ev.nest = makeEnemy(run, ENEMIES.bugNest, x, y, false);
    run.enemies.push(ev.nest);
  }
  run.fieldEvent = ev;
  run.emit({ type: 'eventSpawn', x, y, kind, name: EVENT_NAME[kind] });
}

/** Event completed: the bounty chest. (A killed nest already paid its own
 *  kill credit + XP through the normal death path — the chest is on top.) */
function resolve(run: Run, ev: FieldEvent): void {
  run.pickups.push({ kind: 'chest', x: ev.x, y: ev.y, value: 0, magnet: false, vx: 0, vy: 0 });
  run.fieldEvent = null;
  run.eventAt = run.time + EVENT_INTERVAL + rand(-EVENT_JITTER, EVENT_JITTER);
  run.emit({ type: 'eventDone', x: ev.x, y: ev.y, kind: ev.kind, name: EVENT_NAME[ev.kind] });
}

export function updateFieldEvents(run: Run, dt: number): void {
  if (!run.eventsEnabled) return;
  const ev = run.fieldEvent;
  if (!ev) {
    // feature freeze: no new excursions once crunch hits (a live one plays out)
    if (!run.crunchStarted && run.time >= run.eventAt) {
      run.eventAt = Infinity; // re-armed when the event resolves or expires
      spawnFieldEvent(run, Math.random() < 0.5 ? 'nest' : 'terminal');
    }
    return;
  }

  if (ev.kind === 'nest') {
    const nest = ev.nest!;
    if (nest.hp <= 0 || !run.enemies.includes(nest)) {
      resolve(run, ev);
      return;
    }
    ev.hatchT -= dt;
    if (ev.hatchT <= 0) {
      ev.hatchT = NEST_HATCH_INTERVAL;
      if (run.enemies.length < MAX_ENEMIES) {
        const a = Math.random() * Math.PI * 2;
        run.enemies.push(makeEnemy(run, randomPhaseEnemyDef(run),
          ev.x + Math.cos(a) * 34, ev.y + Math.sin(a) * 34, false));
      }
    }
  } else if (dist(ev.x, ev.y, run.px, run.py) < TERMINAL_RADIUS) {
    ev.progress += dt / TERMINAL_REPAIR_TIME;
    if (ev.progress >= 1) {
      resolve(run, ev);
      return;
    }
  }

  ev.t -= dt;
  if (ev.t <= 0) {
    if (ev.nest) {
      const idx = run.enemies.indexOf(ev.nest);
      if (idx !== -1) run.removeEnemy(idx); // scatters unrewarded — no kill credit
    }
    run.fieldEvent = null;
    run.eventAt = run.time + EVENT_INTERVAL + rand(-EVENT_JITTER, EVENT_JITTER);
    run.emit({ type: 'eventExpired', x: ev.x, y: ev.y, kind: ev.kind });
  }
}
