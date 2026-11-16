// LUMEN DRIFT v2 — tuning, palette and wave table. One place holds every number the
// game balances on, so a wave or a speed is a one-line change, never a hunt.
//
// v3: light is a weapon. The dark closes in as your light drains; shards feed it back.
// Banked shards widen your light — or buy prisms that bend light into beams that burn
// sentinels. Hoard for a wide, safe glow, or spend for firepower: that choice is the game.
// v3: prisms LINK. Two prisms close together join into a chain of light that burns
// anything it touches, and a linked prisma's own beam burns 25% harder. Placing prisms
// is now a network, not a scatter: cluster them for a burning web, or spread them wide
// for coverage. A chain kill pays 25% extra — the web rewards the bold.
// v4: the ECLIPSE. Every third wave the sun dies: kills pay double and prisms link
// farther — but WRAITHS rise, pale sentinels that hide in your light. A beam cannot
// burn a wraith inside your light; lure it into the dark, or spend bank to shrink
// your lamp and expose it. The dark is no longer just the enemy: during an eclipse,
// it is also your weapon.

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
  wraith: '#e6e6fa',
  wraithCore: '#ffffff',
  wraithVeil: '#b8b8ff',
  mini: '#ff9f1c',
  boss: '#ff2e63',
  beam: '#aef7ff',
  beamCore: '#ffffff',
  prism: '#7df9ff',
  prismCore: '#ffffff',
  link: '#5eead4',
  linkCore: '#d1fae5',
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
  ttl: 20,
  radius: 15,
};

/**
 * Prism links (v3): two prisms within range join into a chain of light. The chain burns
 * any sentinel it touches; a linked prisma's own beam burns harder (resonance); a
 * chain kill pays a bonus. One concept, three rewards — placement becomes a network.
 */
export const LINK = {
  range: 380,
  damagePerSecond: 0.8,
  resonanceMul: 1.25,
  killBonusMul: 1.25,
};

/** Score for burning a sentinel of each kind. */
export const KILL_SCORE = {
  patroller: 50,
  chaser: 60,
  splitter: 70,
  wraith: 80,
  mini: 25,
  boss: 500,
};

/**
 * The eclipse (v4): every third wave the sun dies. The lamp drains faster and the
 * dark deepens, but every kill pays double and prism links reach farther. Wraiths
 * rise only on eclipse waves — they hide in your light, so the dark is the weapon.
 */
export const ECLIPSE = {
  drainMul: 1.6,
  killScoreMul: 2,
  linkRange: 500,
};

/** A wraith: what it is worth to burn, and how it hunts. */
export const WRAITH = {
  hp: 2,
  speed: 85,
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
  wraith: { radius: 16, speed: 85, hp: 2, chaseRadius: 380, chaseMul: 1.3 },
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

/** A wave's modifier: calm, darkness surge, rush, prism bounty, eclipse, or the boss. */
export function waveModifier(n) {
  if (n === WAVES.total) return 'boss';
  if (n === 3 || n === 6 || n === 9) return 'eclipse';
  if (n === 8) return 'surge';
  if (n === 4 || n === 7) return 'rush';
  if (n === 5) return 'bounty';
  return 'calm';
}

export const MODIFIER_LABEL = {
  calm: '',
  surge: 'DARKNESS SURGE',
  rush: 'RUSH WAVE',
  bounty: 'PRISM BOUNTY',
  eclipse: 'ECLIPSE',
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
    wraiths: modifier === 'eclipse' ? (n === 3 ? 1 : 2) : 0,
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
