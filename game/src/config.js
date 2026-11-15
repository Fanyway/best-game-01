// LUMEN DRIFT — tuning, palette and wave table. One place holds every number the
// game balances on, so a wave or a speed is a one-line change, never a hunt.

/** Logical playfield, in pixels. The canvas scales to the window; the game always thinks in these. */
export const FIELD = { width: 1280, height: 720 };

/** Fixed step of the simulation, in seconds. */
export const STEP = 1 / 60;

/** Longest frame the loop catches up on; a longer stall is dropped, not replayed. */
export const MAX_FRAME = 0.25;

/** Palette: deep indigo night, gold shards, cyan player, red sentinels, magenta accents. */
export const COLORS = {
  bgTop: '#0b1030',
  bgBottom: '#05060f',
  grid: 'rgba(120, 140, 255, 0.07)',
  border: '#2b3a7d',
  player: '#37e6ff',
  playerCore: '#eafcff',
  shard: '#ffd23f',
  shardCore: '#fff3c4',
  sentinel: '#ff3b5c',
  sentinelCore: '#ff8fa3',
  boss: '#ff2e63',
  shield: '#4de8ff',
  slow: '#c77dff',
  magnet: '#ffb703',
  text: '#eaf2ff',
  dim: '#93a4d6',
  danger: '#ff5c73',
  gold: '#ffd23f',
};

export const BEST_KEY = 'lumen-drift-best';

/** The player orb: acceleration, top speed, radius, and how long it is safe after a hit. */
export const PLAYER = {
  radius: 16,
  accel: 2600,
  maxSpeed: 340,
  friction: 0.86,
  invulnerableSeconds: 1.6,
};

/** A light shard: what it is worth and how long a pickup chain stays alive. */
export const SHARD = {
  radius: 11,
  value: 10,
  comboWindow: 4,
  comboStep: 0.5,
  maxCombo: 8,
};

/** A sentinel: base speed and size; waves scale both. */
export const SENTINEL = {
  radius: 18,
  baseSpeed: 95,
  chaseRadius: 220,
  chaseSpeedMul: 1.55,
  spawnSafeRadius: 260,
};

/** The boss sentinel of wave 10. */
export const BOSS = {
  radius: 34,
  baseSpeed: 130,
  chaseRadius: 420,
  minions: 3,
};

/** Power-ups: what each does and how long it lasts. */
export const POWERUP = {
  radius: 14,
  shieldSeconds: 10,
  slowSeconds: 6,
  slowMul: 0.4,
  magnetSeconds: 8,
  magnetRadius: 260,
  dropChance: 0.22,
};

/** Waves. Clearing a wave's shard quota opens the next; wave 10 is the boss wave and ends the game. */
export const WAVES = { total: 10 };

/** The spec for wave `n` (1-based): how many sentinels patrol, how fast they are, and how many shards clear it. */
export function waveSpec(n) {
  return {
    sentinels: Math.min(2 + n, 12),
    speedMul: 1 + 0.06 * (n - 1),
    shardQuota: 8 + 2 * n,
    boss: n === WAVES.total,
    spawnInterval: Math.max(0.6, 1.6 - 0.1 * n),
  };
}

/** Lives the player starts with. */
export const LIVES = 3;

/** Score for clearing a wave, before the wave number multiplies it. */
export const WAVE_CLEAR_BONUS = 100;
