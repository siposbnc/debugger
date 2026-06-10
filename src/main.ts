import './style.css';
import { initInput, wasPressed, consumePressed } from './core/input';
import { loadSave, persistSave } from './save/save';
import { CHARACTERS } from './data/characters';
import { MAPS } from './data/maps';
import { DEFAULT_WEAPON_POOL } from './data/weapons';
import { Run } from './game/run';
import { grantChestCard, makeOffer, applyOffer } from './game/levelup';
import { Renderer } from './render/draw';
import { UI } from './ui/menus';
import { sound } from './audio/sound';

type GameState = 'menu' | 'run' | 'levelup' | 'paused' | 'summary';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

const save = loadSave();
const renderer = new Renderer(canvas);
const ui = new UI(uiRoot, save);

let state: GameState = 'menu';
let run: Run | null = null;

// dev/balance verification mode: ?turbo → 6x speed, invincible, auto-pick cards
const TURBO = new URLSearchParams(location.search).has('turbo');

function applySettings(): void {
  sound.sfxVolume = save.settings.sfx;
  sound.musicVolume = save.settings.music;
  sound.applyVolumes();
  renderer.shakeEnabled = save.settings.shake;
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
  lt.bestTimeSec = Math.max(lt.bestTimeSec, Math.floor(results.timeSec));
  lt.bestLevel = Math.max(lt.bestLevel, results.level);
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
  if (state !== 'run') return;
  state = 'paused';
  ui.showPause(
    () => { ui.hide(); state = 'run'; },
    () => { if (run) { run.over = true; run.victory = false; } endRun(); },
  );
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
      case 'chest': sound.play('chest'); break;
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

function frame(now: number): void {
  requestAnimationFrame(frame);
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (state === 'run' && run) {
    acc += elapsed;
    const speedMult = TURBO ? 6 : 1;
    while (acc >= STEP) {
      acc -= STEP;
      for (let i = 0; i < speedMult && !run.over; i++) run.update(STEP);
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

  if (wasPressed('Escape')) {
    if (state === 'run') pause();
  }
  consumePressed();

  renderer.update(elapsed);
  const map = run ? run.map : MAPS[save.lastMap] ?? MAPS.greenfield;
  renderer.render(state === 'summary' ? null : run, map, state === 'menu');
}

initInput();
// dev: ?autostart skips the menu straight into a run (combine with ?turbo)
if (new URLSearchParams(location.search).has('autostart')) {
  startRun(save.lastCharacter, save.lastMap);
} else {
  ui.showMainMenu();
}
requestAnimationFrame(frame);
