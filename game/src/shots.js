// The screenshot scenes behind ?shot=title|play|intense|over. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot, so
// the frame is what a short game really looks like and the same seed always gives the same
// frame. The title scene drifts with no input; the play scenes chase shards and flee
// sentinels; the over scene plays a careful run first and ends it after a minute
// or so, as a player who lasted a few waves is.

import { STEP } from './config.js';
import { stepWorld } from './levels.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const TITLE_SECONDS = 4;
const PLAY_SECONDS = 22;
const INTENSE_SECONDS = 95;
const OVER_SECONDS = 90;
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
    sx += (bestShard.x - p.x) / d;
    sy += (bestShard.y - p.y) / d;
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

/**
 * Set `world` to the named scene (title, play, intense or over; any other name is title)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  if (name !== 'play' && name !== 'intense' && name !== 'over') {
    for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) {
      stepWorld(world, idleInput, STEP);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  // The game-over scene plays a careful run first (a minute or so, a few thousand
  // points, a few waves in) and only then ends the run; a reckless pilot died in
  // seconds at wave 1, which makes a thin game-over screen.
  const limit = name === 'over' ? OVER_SECONDS : name === 'intense' ? INTENSE_SECONDS : PLAY_SECONDS;
  for (let i = 0; i < limit / STEP; i += 1) {
    if (world.over || world.won) break;
    if (name === 'intense' && world.wave >= 6) break;
    stepWorld(world, pilotInput(world), STEP);
  }
  if (name === 'over' && !world.over) {
    world.lives = 0;
    world.over = true;
  }
  return { screen: world.over ? SCREEN_OVER : SCREEN_PLAY, best: world.score };
}
