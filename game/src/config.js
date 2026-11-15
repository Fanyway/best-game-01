// LUMEN DRIFT v2 — tuning, palette and wave table. One place holds every number the
// game balances on, so a wave or a speed is a one-line change, never a hunt.
//
// v2: light is a weapon. The dark closes in as your light drains; shards feed it back.
// Banked shards widen your light — or buy prisms that bend light into beams that burn
// sentinels. Hoard for a wide, safe glow, or spend for firepower: that choice is the game.

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
  chaser: '#ff2e9a',
  chaserCore: '#ff9ed2',
  splitter: '#ffb703',
  splitterCore: '#ffe08a',
  mini: '#ff9f1c',
  boss: '#ff2e63',
  beam: '#aef7ff',
  beamCore: '#ffffff',
  prism: '#7df9ff',
  prismCore: '#ffffff',
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

/**
 * Light: the meter that drains, the radius it buys, and how the dark fights back.
 * radius = base + min(bank, bankCap) * perBank + light * perLight, never below minRadius.
 * Spending banked shards on a prism therefore shrinks your light: offense costs vision.
 * Sentinels caught inside your light move slower; when the light dies they speed up.
 */
export const LIGHT = {
  max: 100,
  drainPerSecond: 2.2,
  surgeDrainMul: 2.0,
  bossDrainMul: 1.4,
  shardRestore: 12,
  radiusBase: 90,
  radiusPerBank: 6,
  radiusBankCap: 20,
  radiusPerLight: 0.8,
  minRadius: 55,
  slowInLight: 0.65,
  darkSpeedMul: 1.25,
};

/** A prisma: what it costs, how far its beam reaches, how fast it burns, how long it lives. */
export const PRISM = {
  cost: 8,
  max: 3,
  range: 340,
  damagePerSecond: 1.2,
  ttl: 22,
  radius: 15,
};

/** Score for burning a sentinel of each kind. */
export const KILL_SCORE = {
  patroller: 50,
  chaser: 60,
  splitter: 70,
  mini: 25,
  boss: 500,
};

/**
 * Enemy kinds. Patrollers drift their patrol routes and only chase up close; chasers
 * hunt from far away and are fast but fragile; splitters are slow and tough, and die
 * into two quick minis; the boss of wave 10 is big, fast and breeds minions.
 */
export const ENEMY = {
  patroller: { radius: 18, speed: 95, hp: 3, chaseRadius: 200, chaseMul: 1.4 },
  chaser: { radius: 14, speed: 150, hp: 2, chaseRadius: 330, chaseMul: 1.15 },
  splitter: { radius: 20, speed: 80, hp: 3, chaseRadius: 260, chaseMul: 1.3 },
  mini: { radius: 10, speed: 175, hp: 1, chaseRadius: 320, chaseMul: 1.1 },
  boss: { radius: 34, speed: 130, hp: 30, chaseRadius: 420, chaseMul: 1.35, minions: 3 },
};

/** Spawn safety: never drop a sentinel on top of the player. */
export const SPAWN_SAFE_RADIUS = 260;

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

/** A wave's modifier: calm, darkness surge, rush, prism bounty, or the boss. */
export function waveModifier(n) {
  if (n === WAVES.total) return 'boss';
  if (n === 3 || n === 6 || n === 8) return 'surge';
  if (n === 4 || n === 7 || n === 9) return 'rush';
  if (n === 5) return 'bounty';
  return 'calm';
}

export const MODIFIER_LABEL = {
  calm: '',
  surge: 'DARKNESS SURGE',
  rush: 'RUSH WAVE',
  bounty: 'PRISM BOUNTY',
  boss: 'THE BOSS',
};

/** The spec for wave `n` (1-based): the mix of enemy kinds, their speed, and the shard quota. */
export function waveSpec(n) {
  const modifier = waveModifier(n);
  return {
    modifier,
    patrollers: Math.min(2 + Math.floor(n * 0.7), 8),
    chasers: n >= 2 ? Math.min(n - 1, 5) : 0,
    splitters: n >= 4 ? Math.min(Math.floor((n - 2) / 2), 3) : 0,
    speedMul: 1 + 0.05 * (n - 1) + (modifier === 'rush' ? 0.3 : 0),
    shardQuota: 8 + 2 * n,
    boss: n === WAVES.total,
    // Trickle spawns keep the pressure on after the beams thin the first wave.
    spawnInterval: Math.max(1.4, 3.4 - 0.18 * n),
  };
}

/** Lives the player starts with. */
export const LIVES = 3;

/** Score for clearing a wave, before the wave number multiplies it. */
export const WAVE_CLEAR_BONUS = 100;
