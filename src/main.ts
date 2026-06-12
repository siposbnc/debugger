import './style.css';
import { initInput, initTouch, touchUsed, wasPressed, consumePressed, pollGamepad, padWasPressed, padMenuDir, PAD, setKeyBindings, binding } from './core/input';
import { loadSave, persistSave } from './save/save';
import { CHARACTERS } from './data/characters';
import { MAPS } from './data/maps';
import { DEFAULT_WEAPON_POOL } from './data/weapons';
import { Run } from './game/run';
import { snapshotRun, restoreRun } from './game/runSave';
import { grantChestCard, makeOffer, applyOffer } from './game/levelup';
import { createRenderer } from './render';
import { UI } from './ui/menus';
import { sound } from './audio/sound';

type GameState = 'menu' | 'run' | 'levelup' | 'paused' | 'summary';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const hudCanvas = document.getElementById('hud') as HTMLCanvasElement;
const bannerCanvas = document.getElementById('banners') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

const save = loadSave();
const renderer = createRenderer(canvas, hudCanvas, bannerCanvas);
const ui = new UI(uiRoot, save);

let state: GameState = 'menu';
let run: Run | null = null;

// dev/balance verification mode: ?turbo → 6x speed, invincible, auto-pick cards
const TURBO = new URLSearchParams(location.search).has('turbo');
// Sim-speed multiplier (tick rate): scales accumulated real time in the main
// loop, so fractional slow-mo works too (0.5 → a step every other frame).
// Turbo = 6×; dbg.speed() adjusts it live on dev builds.
let simSpeed = TURBO ? 6 : 1;

// Dev console (window.dbg): dev server + `npm run build:dev` only. __DEV_TOOLS__
// is a compile-time define — prod builds turn this into `if (false)` and the
// dynamic import (with the whole src/dev/ chunk) is eliminated from dist/.
if (__DEV_TOOLS__) {
  import('./dev/devtools').then((m) => m.installDevTools({
    getRun: () => run,
    save,
    getSpeed: () => simSpeed,
    setSpeed: (mult) => { simSpeed = mult; },
  }));
}

function applySettings(): void {
  sound.masterVolume = save.settings.master;
  sound.sfxVolume = save.settings.sfx;
  sound.musicVolume = save.settings.music;
  sound.applyVolumes();
  renderer.shakeEnabled = save.settings.shake;
  renderer.reduceFlashEnabled = save.settings.reduceFlash;
  renderer.playerHpBarEnabled = save.settings.playerHpBar;
  renderer.fpsCounterEnabled = save.settings.fpsCounter;
  setKeyBindings(save.settings.keys);
}
applySettings();
ui.onSettingsChanged = applySettings;

function startRun(charId: string, mapId: string): void {
  const character = CHARACTERS[charId] ?? CHARACTERS.ada;
  const map = MAPS[mapId] ?? MAPS.greenfield;
  const weaponPool = [...new Set([...DEFAULT_WEAPON_POOL, ...save.unlockedWeapons, character.weapon])];
  run = new Run(character, map, save.metaLevels, weaponPool, new Set(save.completedObjectives));
  if (TURBO) run.invincible = true;
  renderer.camX = 0; renderer.camY = 0;
  ui.hide();
  state = 'run';
  sound.startMusic();
}
ui.onStartRun = startRun;

// Resume a suspended run. The snapshot is consumed up front — a death after
// resuming is final (no reload-scumming), and a snapshot that fails to restore
// (content drift) is discarded rather than retried forever.
ui.onResumeRun = () => {
  const snap = save.suspendedRun;
  if (!snap) return;
  save.suspendedRun = null;
  persistSave(save);
  try {
    run = restoreRun(snap, new Set(save.completedObjectives));
  } catch (err) {
    console.warn('suspended run could not be restored — discarded', err);
    ui.showMainMenu();
    return;
  }
  if (TURBO) run.invincible = true;
  renderer.snapCamera(run.px, run.py);
  ui.hide();
  state = 'run';
  sound.startMusic();
};

function suspendRun(): void {
  if (!run) return;
  save.suspendedRun = snapshotRun(run);
  persistSave(save);
  run = null;
  sound.stopMusic();
  state = 'menu';
  ui.showMainMenu();
}

function openLevelUp(): void {
  if (!run) return;
  state = 'levelup';
  ui.showLevelUp(run, () => {
    if (!run) return;
    run.pendingLevelUps = Math.max(0, run.pendingLevelUps - 1);
    if (run.pendingLevelUps > 0) openLevelUp();
    else state = 'run';
  });
}

function endRun(): void {
  if (!run) return;
  const results = run.computeBits();
  // persist: bits, lifetime stats, objectives
  save.bits += results.bits;
  const lt = save.lifetime;
  lt.runs++;
  lt.kills += results.kills;
  lt.bossKills += results.bossKills;
  lt.bitsEarned += results.bits;
  lt.uptimeSec += Math.floor(results.timeSec);
  lt.bestTimeSec = Math.max(lt.bestTimeSec, Math.floor(results.timeSec));
  lt.bestLevel = Math.max(lt.bestLevel, results.level);
  for (const w of run.weapons) {
    // evolved weapons credit the evolution's id (totalDamage carries through)
    if (w.totalDamage > 0) lt.weaponDamage[w.def.id] = (lt.weaponDamage[w.def.id] ?? 0) + Math.round(w.totalDamage);
  }
  if (results.victory) lt.victories++;
  for (const id of results.newObjectives) {
    if (!save.completedObjectives.includes(id)) save.completedObjectives.push(id);
  }
  persistSave(save);
  sound.stopMusic();

  state = 'summary';
  ui.showSummary(results, () => {
    run = null;
    state = 'menu';
    ui.showMainMenu();
  });
}

function pause(): void {
  if (state !== 'run' || !run) return;
  state = 'paused';
  showPauseScreen();
}

function showPauseScreen(): void {
  if (!run) return;
  ui.showPause(
    run,
    resume,
    () => { if (run) { run.over = true; run.victory = false; } endRun(); },
    suspendRun,
    () => ui.showSettings(showPauseScreen), // settings sub-screen, BACK returns here
  );
}

function resume(): void {
  if (state !== 'paused') return;
  ui.hide();
  state = 'run';
}

// Touch pause button: keyboard has Esc/P and pads have Start, but a touch run
// has no way into the pause menu without this. Lives outside #ui (menus wipe
// that) and above the canvas, so its touches never reach the virtual stick.
// Hidden until the session actually uses touch, then shown during runs only.
const touchPauseBtn = document.createElement('button');
touchPauseBtn.id = 'touch-pause';
touchPauseBtn.textContent = '❚❚';
touchPauseBtn.setAttribute('aria-label', 'Pause');
document.body.appendChild(touchPauseBtn);
touchPauseBtn.addEventListener('touchstart', (e) => {
  e.preventDefault(); // don't also fire the synthetic click
  pause();
});
touchPauseBtn.addEventListener('click', () => pause());

/** Esc/P/Start/B while paused: from the settings sub-screen back to the
 *  pause overview; from the pause screen itself, resume the run. */
function pauseBack(): void {
  if (ui.screenKind === 'settings') showPauseScreen();
  else resume();
}

function drainEvents(): void {
  if (!run) return;
  for (const ev of run.events) {
    renderer.handleEvent(ev);
    switch (ev.type) {
      case 'shoot': sound.play('shoot'); break;
      case 'kill': sound.play('kill'); break;
      case 'pickupXp': sound.play('pickup'); break;
      case 'pickupHp': sound.play('chest'); break;
      case 'hurt': sound.play('hurt'); break;
      case 'levelup': sound.play('levelup'); break;
      case 'bossWarning': sound.play('bossWarn'); break;
      case 'bossDie': sound.play('bossDie'); break;
      case 'snapshot': sound.play('fizz'); break;
      case 'rewind': sound.play('fizz'); break;
      case 'forcePush': sound.play('bossWarn'); break;
      case 'stackPop': sound.play('resolve'); break;
      case 'coreExposed': sound.play('resolve'); break;
      case 'memoryFreed': sound.play('resolve'); break;
      case 'crunch': sound.play('bossWarn'); break;
      case 'vent': sound.play('vent'); break;
      case 'chest': sound.play('chest'); break;
      case 'mushiSpawn': sound.play('fizz'); break;
      case 'mushiCaught': sound.play('resolve'); break;
      case 'mushiGone': sound.play('fizz'); break;
      case 'evolve': sound.play('evolve'); break;
      case 'objective': sound.play('objective'); break;
      case 'victory': sound.play('victory'); break;
      case 'death': sound.play('death'); break;
      default: break;
    }
  }
  run.events.length = 0;

  // chest with no evolution available → free rare+ card
  if (run.chestBonus) {
    run.chestBonus = false;
    const card = grantChestCard(run);
    if (card) {
      renderer.handleEvent({ type: 'bonusCard', cardName: card.name });
      sound.play('evolve');
    }
  }
}

// ---------- main loop (fixed-step update, rAF render) ----------

const STEP = 1 / 60;
let last = performance.now();
let acc = 0;
// Lag guard: never queue more than this much sim time for one frame — a huge
// speed multiplier on a slow frame must back off, not spiral.
const MAX_FRAME_SIM = 0.5;

function frame(now: number): void {
  requestAnimationFrame(frame);
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;

  pollGamepad(elapsed);

  if (state === 'run' && run) {
    acc = Math.min(MAX_FRAME_SIM, acc + elapsed * simSpeed);
    while (acc >= STEP) {
      acc -= STEP;
      if (!run.over) run.update(STEP);
      if (run.pendingLevelUps > 0 && !run.over) {
        if (TURBO) {
          // auto-pick to keep the balance run unattended
          while (run.pendingLevelUps > 0) {
            const offer = makeOffer(run);
            if (offer.length === 0) { run.pendingLevelUps = 0; break; }
            applyOffer(run, offer[0]);
            run.pendingLevelUps--;
          }
        } else {
          drainEvents();
          openLevelUp();
          break;
        }
      }
      if (run.over) break;
    }
    drainEvents();
    sound.intensity = Math.min(1, run.time / 600);
    if (run.over && state === 'run') endRun();
  } else {
    acc = 0;
  }

  // Gamepad menu navigation: stick/d-pad moves the kbnav highlight, A activates,
  // B = back (no-op on the pause screen, which has no onBack — handled below).
  if (state !== 'run') {
    const dir = padMenuDir();
    if (dir) ui.navMove(dir.x, dir.y);
    if (padWasPressed(PAD.A)) ui.navActivate();
    if (padWasPressed(PAD.B)) ui.navBack();
  }

  // Esc/P/Start pause toggling lives here, not in kbnav — menus handle their own Esc=back.
  // Space-resume comes from kbnav: the pause screen's default highlight is CONTINUE.
  if (wasPressed('Escape') || wasPressed(binding('pause')) || padWasPressed(PAD.START)) {
    if (state === 'run') pause();
    else if (state === 'paused') pauseBack();
  } else if (state === 'paused' && padWasPressed(PAD.B)) {
    pauseBack();
  }
  consumePressed();

  touchPauseBtn.classList.toggle('show', state === 'run' && touchUsed());

  renderer.update(elapsed);
  const map = run ? run.map : MAPS[save.lastMap] ?? MAPS.greenfield;
  renderer.render(state === 'summary' ? null : run, map, state === 'menu');
}

// A visible-but-unfocused window keeps ticking rAF while core/input clears all
// held keys on blur — the player stands still and dies. Auto-pause instead.
// (A hidden tab is already safe: rAF stops, the simulation freezes.) The
// visibilitychange pause makes the freeze explicit: returning players see the
// pause menu, not a snapshot. Turbo runs are unattended by design — never pause.
window.addEventListener('blur', () => { if (!TURBO) pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !TURBO) pause(); });

initInput();
initTouch(canvas);
// dev: ?autostart skips the menu straight into a run (combine with ?turbo)
if (new URLSearchParams(location.search).has('autostart')) {
  startRun(save.lastCharacter, save.lastMap);
} else {
  ui.showMainMenu();
}
requestAnimationFrame(frame);
