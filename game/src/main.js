// LUMEN DRIFT — boot and the one loop. Input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the renderer paints
// what is there. The game moves between five screens: title, play, paused, win and game over.
//
// ?seed=N fixes the shard and sentinel pattern. ?shot=title|play|intense|over (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.

import { MAX_FRAME, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createWorld, readBest, resetWorld, saveBest, stepWorld, worldFromSeed } from './levels.js';
import {
  BUTTONS,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  createRenderer,
  hitButton,
} from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const renderer = createRenderer(canvas);
const input = createInput(canvas, (x, y) => renderer.toLogical(x, y));

let world = shot ? worldFromSeed(seed) : createWorld(createRandom(seed));
let screen = SCREEN_TITLE;
let best = readBest();
let lastTime = 0;
let accumulator = 0;

// A handle for play-testing from the console: the current screen and world.
window.__lumen = {
  get screen() {
    return screen;
  },
  get world() {
    return world;
  },
};

/** The status line screen readers announce. */
function announce(text) {
  if (status) status.textContent = text;
}

/** Start a fresh run from the title, win or game-over screen. */
function startGame() {
  audio.unlock();
  audio.click();
  resetWorld(world);
  screen = SCREEN_PLAY;
  announce('LUMEN DRIFT: wave 1. Collect shards, dodge sentinels.');
}

/** Drain one step's events into sound, score and the status line. */
function handleEvents(events) {
  for (const event of events) {
    if (event.type === 'pickup') audio.pickup(event.combo);
    if (event.type === 'powerup') audio.powerup();
    if (event.type === 'shieldBreak') audio.hit();
    if (event.type === 'hit') {
      audio.hit();
      announce(`Hit! ${event.lives} ${event.lives === 1 ? 'life' : 'lives'} left.`);
    }
    if (event.type === 'wave') {
      audio.waveClear();
      announce(`Wave ${event.wave}. Bonus ${event.bonus}.`);
    }
    if (event.type === 'win') {
      audio.win();
      best = Math.max(best, event.score);
      saveBest(best);
      screen = SCREEN_WIN;
      announce(`You win! Score ${event.score}.`);
    }
    if (event.type === 'over') {
      audio.lose();
      best = Math.max(best, event.score);
      saveBest(best);
      screen = SCREEN_OVER;
      announce(`Game over. Score ${event.score}, wave ${event.wave}. Press R to restart.`);
    }
  }
}

function update(dt) {
  if (input.pressed(ACTION_MUTE)) {
    audio.toggleMute();
  }
  const click = input.click();
  if (click && hitButton(BUTTONS.mute, click)) {
    audio.toggleMute();
    input.clearClick();
  }

  if (screen === SCREEN_TITLE) {
    if (input.pressed(ACTION_CONFIRM) || (click && hitButton(BUTTONS.play, click))) {
      startGame();
    }
    if (click) input.clearClick();
  } else if (screen === SCREEN_PLAY) {
    if (input.pressed(ACTION_PAUSE)) {
      screen = SCREEN_PAUSED;
    } else {
      handleEvents(stepWorld(world, input, dt));
    }
    if (click) input.clearClick();
  } else if (screen === SCREEN_PAUSED) {
    if (input.pressed(ACTION_PAUSE) || input.pressed(ACTION_CONFIRM)) {
      screen = SCREEN_PLAY;
    }
    if (click) input.clearClick();
  } else if (screen === SCREEN_WIN || screen === SCREEN_OVER) {
    if (
      input.pressed(ACTION_RESTART) ||
      input.pressed(ACTION_CONFIRM) ||
      (click && hitButton(BUTTONS.restart, click))
    ) {
      startGame();
    }
    if (click) input.clearClick();
  }
  input.endFrame();
}

function frame(timestamp) {
  const now = timestamp / 1000;
  let elapsed = lastTime === 0 ? 0 : now - lastTime;
  lastTime = now;
  if (elapsed > MAX_FRAME) elapsed = MAX_FRAME;
  accumulator += elapsed;
  while (accumulator >= STEP) {
    update(STEP);
    accumulator -= STEP;
  }
  renderer.draw(world, screen, { best, muted: audio.muted });
  requestAnimationFrame(frame);
}

if (shot) {
  const staged = stageShot(shot, world);
  screen = staged.screen;
  best = Math.max(best, staged.best);
  renderer.draw(world, screen, { best, muted: false });
  renderer.draw(world, screen, { best, muted: false });
  window.__shotReady = true;
} else {
  window.addEventListener('blur', () => {
    if (screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
  });
  requestAnimationFrame(frame);
}
