// The world and its waves: a fresh run, a wave's spec and spawns, and the one step that
// moves everything and settles the score. The world is the single record of truth; the
// renderer and the screenshots only read it.
//
// v2: light is a resource. It drains every second and faster on surge waves; each shard
// feeds it back. Banked shards widen the light — and buy prisms, so every prisma costs
// vision. Prisms bend light into beams that burn sentinels; the only way to kill one.
// v3: prisms link into chains of light that burn anything they touch, and a linked
// prisma's beam burns harder. Placement is a network now: cluster for a web, spread
// for coverage. A wave clear also lights a fanfare pulse across the arena.
// v4: the eclipse. Every third wave the sun dies: kills pay double, links reach
// farther, and wraiths rise — pale ghosts that hide in your light. An eclipse clear
// earns a longer fanfare, and the dark itself is the weapon that burns them.

import {
  COLORS,
  ECLIPSE,
  FIELD,
  LIGHT,
  LIVES,
  POWERUP,
  PRISM,
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
  floater,
  spawnPowerup,
  spawnPrism,
  spawnSentinel,
  spawnShard,
  updateBeams,
  updateLinks,
  updatePlayer,
  updatePowerups,
  updatePrisms,
  updateSentinels,
  updateShards,
} from './entities.js';

/** The light radius from the meter and the bank: wide when fed, a pinhole when starved. */
export function lightRadius(world) {
  const fromBank = Math.min(world.bank, LIGHT.radiusBankCap) * LIGHT.radiusPerBank;
  const fromMeter = world.light * LIGHT.radiusPerLight;
  return Math.max(LIGHT.minRadius, LIGHT.radiusBase + fromBank + fromMeter);
}

/** A fresh world: wave 1 staged, nothing collected, three lives, a full lamp. */
export function createWorld(random) {
  const world = {
    random,
    player: createPlayer(),
    shards: [],
    sentinels: [],
    prisms: [],
    beams: [],
    links: [],
    linkCount: 0,
    powerups: [],
    particles: [],
    floaters: [],
    wave: 1,
    spec: waveSpec(1),
    score: 0,
    combo: 0,
    comboTimer: 0,
    lives: LIVES,
    collected: 0,
    bank: 0,
    light: LIGHT.max,
    lightRadius: 0,
    time: 0,
    shake: 0,
    flash: 0,
    fanfare: 0,
    waveBanner: 0,
    beamSoundTimer: 0,
    spawnTimer: 2,
    stats: { kills: 0, chainKills: 0, wraithsBurned: 0, maxLinks: 0, prismsPlaced: 0, shardsEaten: 0 },
    over: false,
    won: false,
  };
  world.lightRadius = lightRadius(world);
  startWave(world);
  return world;
}

/** Fill the arena for the world's current wave: its enemy mix, its shards, a boss on wave 10. */
export function startWave(world) {
  const spec = waveSpec(world.wave);
  world.spec = spec;
  world.collected = 0;
  world.waveBanner = 2.6;
  for (let i = 0; i < spec.patrollers; i += 1) {
    spawnSentinel(world, world.random, spec.speedMul, 'patroller');
  }
  for (let i = 0; i < spec.chasers; i += 1) {
    spawnSentinel(world, world.random, spec.speedMul, 'chaser');
  }
  for (let i = 0; i < spec.splitters; i += 1) {
    spawnSentinel(world, world.random, spec.speedMul, 'splitter');
  }
  // Wraiths rise only on eclipse waves: one on the first eclipse, two after.
  for (let i = 0; i < spec.wraiths; i += 1) {
    spawnSentinel(world, world.random, spec.speedMul, 'wraith');
  }
  if (spec.boss) {
    spawnSentinel(world, world.random, spec.speedMul, 'boss');
  }
  for (let i = 0; i < spec.shardQuota + 4; i += 1) {
    spawnShard(world, world.random);
  }
  // A bounty wave pays out in banked shards; a boss wave is announced, not gifted.
  if (spec.modifier === 'bounty') {
    world.bank += 5;
    spawnPowerup(world, world.random);
  }
}

/** Reset a world to a fresh run (restart after game over or a win). */
export function resetWorld(world) {
  const fresh = createWorld(world.random);
  for (const key of Object.keys(fresh)) world[key] = fresh[key];
}

/**
 * Spend banked shards on a prisma at the player's feet. Returns true when one was
 * placed, false when the bank is short or the field already holds the maximum.
 */
export function placePrism(world) {
  if (world.over || world.won) return false;
  if (world.bank < PRISM.cost) return false;
  if (world.prisms.length >= PRISM.max) return false;
  world.bank -= PRISM.cost;
  world.stats.prismsPlaced += 1;
  spawnPrism(world);
  world.lightRadius = lightRadius(world);
  burst(world, world.player.x, world.player.y, '#7df9ff', 18, 220);
  floater(world, world.player.x, world.player.y - 26, `PRISM −${PRISM.cost}✦`, '#7df9ff');
  return true;
}

/**
 * Advance the world one fixed step. `input` steers the player; the return is the events
 * of this step (pickup, hit, powerup, kill, prism, wave, win, over), each with what the
 * main loop needs to score it and play its sound. Returns 0 when nothing happened, else
 * a bitmask-free list the caller drains in order.
 */
export function stepWorld(world, input, dt) {
  if (world.over || world.won) return [];
  const events = [];
  world.time += dt;
  if (world.waveBanner > 0) world.waveBanner -= dt;
  if (world.shake > 0) world.shake -= dt;
  if (world.flash > 0) world.flash -= dt;
  if (world.fanfare > 0) world.fanfare -= dt;
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }

  // The dark closes in: the lamp drains, faster on surge waves, faster still in an
  // eclipse, and fastest at the boss.
  const drain = LIGHT.drainPerSecond
    * (world.spec.modifier === 'surge' ? LIGHT.surgeDrainMul : 1)
    * (world.spec.modifier === 'eclipse' ? ECLIPSE.drainMul : 1)
    * (world.spec.modifier === 'boss' ? LIGHT.bossDrainMul : 1);
  world.light = Math.max(0, world.light - drain * dt);
  world.lightRadius = lightRadius(world);

  updatePlayer(world, input, dt);
  updateSentinels(world, dt);
  updateShards(world, dt);
  updatePowerups(world, dt);
  updatePrisms(world, dt);
  // Links first: they mark which prisms resonate before the beams burn.
  for (const event of updateLinks(world, dt)) {
    events.push(event);
  }
  for (const event of updateBeams(world, dt)) {
    events.push(event);
  }
  // Trickle spawns: the dark keeps sending sentinels while the wave lasts, so a
  // cleared field never stays empty for long.
  world.spawnTimer -= dt;
  if (world.spawnTimer <= 0) {
    world.spawnTimer = world.spec.spawnInterval;
    const total = world.spec.patrollers + world.spec.chasers + world.spec.splitters + world.spec.wraiths + (world.spec.boss ? 1 : 0);
    if (world.sentinels.length < total + 4) {
      const roll = world.random();
      // During an eclipse the dark sometimes sends another wraith, never more than
      // two at once — the veil is a threat, not a flood.
      const wraithsOut = world.sentinels.filter((s) => s.kind === 'wraith').length;
      const kind = world.spec.modifier === 'eclipse' && roll < 0.15 && wraithsOut < 2
        ? 'wraith'
        : roll < 0.5 ? 'patroller' : roll < 0.8 && world.wave >= 2 ? 'chaser' : world.wave >= 4 ? 'splitter' : 'patroller';
      spawnSentinel(world, world.random, world.spec.speedMul, kind);
    }
  }
  if (world.beams.length > 0) {
    world.beamSoundTimer -= dt;
    if (world.beamSoundTimer <= 0) {
      world.beamSoundTimer = 0.4;
      events.push({ type: 'beam' });
    }
  }

  for (const event of checkCollisions(world)) {
    if (event.type === 'pickup') {
      world.combo = Math.min(world.combo + 1, SHARD.maxCombo);
      world.comboTimer = SHARD.comboWindow;
      const gained = Math.round(SHARD.value * (1 + (world.combo - 1) * SHARD.comboStep));
      world.score += gained;
      world.collected += 1;
      world.bank += 1;
      world.stats.shardsEaten += 1;
      world.light = Math.min(LIGHT.max, world.light + LIGHT.shardRestore);
      world.lightRadius = lightRadius(world);
      burst(world, event.shard.x, event.shard.y, COLORS.shard, 14, 180);
      floater(world, event.shard.x, event.shard.y - 14, `+${gained}`, COLORS.shard);
      events.push({ type: 'pickup', gained, combo: world.combo });
      if (world.random() < POWERUP.dropChance * (world.spec.modifier === 'bounty' ? 2 : 1) && world.powerups.length < 2) {
        spawnPowerup(world, world.random);
      }
      if (world.collected >= world.spec.shardQuota) {
        if (world.wave >= WAVES.total) {
          world.won = true;
          events.push({ type: 'win', score: world.score });
        } else {
          world.score += WAVE_CLEAR_BONUS * world.wave;
          world.lives = Math.min(LIVES, world.lives + 1);
          // An eclipse clear earns a longer fanfare: the gold washes out twice as long.
          world.fanfare = world.spec.modifier === 'eclipse' ? 2.0 : 1.4;
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
