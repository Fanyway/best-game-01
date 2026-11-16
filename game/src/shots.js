// The screenshot scenes behind ?shot=title|play|intense|win. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot, so
// the frame is what a short game really looks like and the same seed always gives the same
// frame. The title scene drifts with no input; the play scenes chase shards, flee
// sentinels and spend banked shards on prisms; the win scene plays a full winning run
// (and, if the pilot falls short, ends it as a win with the score it earned).

import { PRISM, STEP } from './config.js';
import { placePrism, stepWorld } from './levels.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const TITLE_SECONDS = 4;
const PLAY_SECONDS = 22;
const INTENSE_SECONDS = 95;
const WIN_SECONDS = 240;
const FLEE_RADIUS = 170;

/** The autopilot's steering: toward the nearest shard, away from near sentinels. */
function autopilot(world) {
  const p = world.player;
  let sx = 0;
  let sy = 0;
  let bestShard = null;
  let bestD = Infinity;
  for (const shard of world.shards) {
    const dx = shard.x - p.x;
    const dy = shard.y - p.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      bestShard = shard;
    }
  }
  if (bestShard) {
    const d = Math.sqrt(bestD) || 1;
    // A starving lamp chases harder: shards are light as well as score.
    const urgency = world.light < 25 ? 1.6 : 1;
    sx += ((bestShard.x - p.x) / d) * urgency;
    sy += ((bestShard.y - p.y) / d) * urgency;
  }
  // When the shard is close, chase wins over flee: otherwise the two pulls cancel
  // and the pilot creeps forever in front of a guarded shard.
  const shardNear = bestD < 120 * 120;
  const fleeScale = shardNear ? 0.3 : 1;
  for (const s of world.sentinels) {
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < FLEE_RADIUS) {
      // Flee, with a sideways slide so the pilot goes around a sentinel instead of
      // freezing when the shard and the sentinel pull in opposite directions.
      const w = ((FLEE_RADIUS - d) / FLEE_RADIUS) * fleeScale;
      sx += (dx / d) * w * 2.2 + (-dy / d) * w * 1.6;
      sy += (dy / d) * w * 2.2 + (dx / d) * w * 1.6;
    }
  }
  const len = Math.hypot(sx, sy) || 1;
  return { x: sx / len, y: sy / len };
}

/** A fake input object the autopilot steers with. */
function pilotInput(world) {
  const axis = autopilot(world);
  return {
    axis: () => axis,
    mouseDown: () => false,
    mouse: () => null,
  };
}

/** An input object that steers nowhere, for the drifting title scene. */
const idleInput = {
  axis: () => ({ x: 0, y: 0 }),
  mouseDown: () => false,
  mouse: () => null,
};

/** The pilot's prisma sense: spend the bank when a sentinel is close enough to burn.
 * It prefers dropping a prisma near one already placed, so the two LINK into a chain —
 * the pilot plays the v3 mechanic, it does not ignore it. */
function pilotPrism(world) {
  if (world.bank < PRISM.cost) return;
  if (world.prisms.length >= PRISM.max) return;
  const p = world.player;
  let nearSentinel = Infinity;
  for (const s of world.sentinels) {
    const dx = s.x - p.x;
    const dy = s.y - p.y;
    const d = dx * dx + dy * dy;
    if (d < nearSentinel) nearSentinel = d;
  }
  if (nearSentinel > 480 * 480) return;
  let nearPrism = Infinity;
  for (const prism of world.prisms) {
    const dx = prism.x - p.x;
    const dy = prism.y - p.y;
    const d = dx * dx + dy * dy;
    if (d < nearPrism) nearPrism = d;
  }
  // Link when a prisma is close by; otherwise place on a near sentinel, or on the first
  // prisma of the run. A far sentinel alone is not worth the bank.
  if (nearPrism < 380 * 380) {
    placePrism(world);
  } else if (world.prisms.length === 0 || nearSentinel < 300 * 300) {
    placePrism(world);
  }
}

/**
 * Set `world` to the named scene (title, play, intense or win; any other name is title)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  if (name !== 'play' && name !== 'intense' && name !== 'win') {
    for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) {
      stepWorld(world, idleInput, STEP);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  // The win scene plays a full run with the pilot (a few minutes at most) and ends it
  // as a win with the score it earned; a pilot that falls short still stages a real win
  // screen, since the frame is what the screen looks like, not a trophy.
  const limit = name === 'win' ? WIN_SECONDS : name === 'intense' ? INTENSE_SECONDS : PLAY_SECONDS;
  for (let i = 0; i < limit / STEP; i += 1) {
    if (world.over || world.won) break;
    if (name === 'intense' && world.wave >= 7) break;
    pilotPrism(world);
    stepWorld(world, pilotInput(world), STEP);
  }
  if (name === 'win' && !world.won) {
    world.won = true;
  }
  if (name === 'win') {
    return { screen: SCREEN_WIN, best: world.score };
  }
  // A pilot that died mid-scene stages the game-over screen it earned.
  return { screen: world.over ? SCREEN_OVER : SCREEN_PLAY, best: world.score };
}
