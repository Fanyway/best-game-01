// The world and its waves: a fresh run, a wave's spec and spawns, and the one step that
// moves everything and settles the score. The world is the single record of truth; the
// renderer and the screenshots only read it.

import {
  COLORS,
  FIELD,
  LIVES,
  POWERUP,
  SHARD,
  WAVE_CLEAR_BONUS,
  WAVES,
  waveSpec,
} from './config.js';
import { createRandom } from './random.js';
import {
  burst,
  checkCollisions,
  createPlayer,
  spawnPowerup,
  spawnSentinel,
  spawnShard,
  updatePlayer,
  updatePowerups,
  updateSentinels,
  updateShards,
} from './entities.js';

/** A fresh world: wave 1 staged, nothing collected, three lives. */
export function createWorld(random) {
  const world = {
    random,
    player: createPlayer(),
    shards: [],
    sentinels: [],
    powerups: [],
    particles: [],
    wave: 1,
    spec: waveSpec(1),
    score: 0,
    combo: 0,
    comboTimer: 0,
    lives: LIVES,
    collected: 0,
    time: 0,
    shake: 0,
    flash: 0,
    waveBanner: 0,
    over: false,
    won: false,
  };
  startWave(world);
  return world;
}

/** Fill the arena for the world's current wave: its sentinels, its shards, and a boss on wave 10. */
export function startWave(world) {
  const spec = waveSpec(world.wave);
  world.spec = spec;
  world.collected = 0;
  world.waveBanner = 2.2;
  for (let i = 0; i < spec.sentinels; i += 1) {
    spawnSentinel(world, world.random, spec.speedMul, false);
  }
  if (spec.boss) {
    spawnSentinel(world, world.random, spec.speedMul, true);
  }
  for (let i = 0; i < spec.shardQuota + 4; i += 1) {
    spawnShard(world, world.random);
  }
}

/** Reset a world to a fresh run (restart after game over or a win). */
export function resetWorld(world) {
  const fresh = createWorld(world.random);
  for (const key of Object.keys(fresh)) world[key] = fresh[key];
}

/**
 * Advance the world one fixed step. `input` steers the player; the return is the events
 * of this step (pickup, hit, powerup, wave, win, over), each with what the main loop needs
 * to score it and play its sound. Returns 0 when nothing happened, else a bitmask-free
 * list the caller drains in order.
 */
export function stepWorld(world, input, dt) {
  if (world.over || world.won) return [];
  const events = [];
  world.time += dt;
  if (world.waveBanner > 0) world.waveBanner -= dt;
  if (world.shake > 0) world.shake -= dt;
  if (world.flash > 0) world.flash -= dt;
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }

  updatePlayer(world, input, dt);
  updateSentinels(world, dt);
  updateShards(world, dt);
  updatePowerups(world, dt);

  for (const event of checkCollisions(world)) {
    if (event.type === 'pickup') {
      world.combo = Math.min(world.combo + 1, SHARD.maxCombo);
      world.comboTimer = SHARD.comboWindow;
      const gained = Math.round(SHARD.value * (1 + (world.combo - 1) * SHARD.comboStep));
      world.score += gained;
      world.collected += 1;
      burst(world, event.shard.x, event.shard.y, COLORS.shard, 14, 180);
      events.push({ type: 'pickup', gained, combo: world.combo });
      if (world.random() < POWERUP.dropChance && world.powerups.length < 2) {
        spawnPowerup(world, world.random);
      }
      if (world.collected >= world.spec.shardQuota) {
        if (world.wave >= WAVES.total) {
          world.won = true;
          events.push({ type: 'win', score: world.score });
        } else {
          world.score += WAVE_CLEAR_BONUS * world.wave;
          world.lives = Math.min(LIVES, world.lives + 1);
          world.wave += 1;
          world.sentinels = [];
          events.push({ type: 'wave', wave: world.wave, bonus: WAVE_CLEAR_BONUS * (world.wave - 1) });
          startWave(world);
        }
      } else if (world.shards.length < 6) {
        spawnShard(world, world.random);
      }
    } else if (event.type === 'powerup') {
      const p = world.player;
      if (event.kind === 'shield') p.shield = POWERUP.shieldSeconds;
      if (event.kind === 'slow') p.slow = POWERUP.slowSeconds;
      if (event.kind === 'magnet') p.magnet = POWERUP.magnetSeconds;
      burst(world, p.x, p.y, COLORS[event.kind === 'shield' ? 'shield' : event.kind], 16, 200);
      events.push({ type: 'powerup', kind: event.kind });
    } else if (event.type === 'hit') {
      const p = world.player;
      if (p.shield > 0) {
        p.shield = 0;
        p.invuln = 1.2;
        burst(world, p.x, p.y, COLORS.shield, 22, 260);
        events.push({ type: 'shieldBreak' });
      } else {
        world.lives -= 1;
        world.combo = 0;
        p.invuln = 1.6;
        world.shake = 0.4;
        world.flash = 0.35;
        burst(world, p.x, p.y, COLORS.sentinel, 26, 300);
        burst(world, event.sentinel.x, event.sentinel.y, COLORS.sentinel, 12, 200);
        events.push({ type: 'hit', lives: world.lives });
        if (world.lives <= 0) {
          world.over = true;
          events.push({ type: 'over', score: world.score, wave: world.wave });
        }
      }
    }
  }
  return events;
}

/** The run's best score, kept in localStorage; a win or a loss writes it when it is beaten. */
export function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem('lumen-drift-best') ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(value) {
  try {
    window.localStorage.setItem('lumen-drift-best', String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

/** Make a world from a seed, for the screenshot scenes. */
export function worldFromSeed(seed) {
  return createWorld(createRandom(seed));
}
