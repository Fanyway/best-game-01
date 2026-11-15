// The things that live in the arena and how they move and meet. The world is one plain
// object (made in levels.js): player, shards, sentinels, powerups, particles, and the run's
// score, combo, lives, wave and timers. Every update here takes (world, dt) and, where it
// matters, the input; collisions return events the main loop turns into sound and score.

import {
  BOSS,
  FIELD,
  PLAYER,
  POWERUP,
  SENTINEL,
  SHARD,
} from './config.js';
import { pick, randRange } from './random.js';

/** The player orb, fresh in the middle of the arena. */
export function createPlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    invuln: 0,
    shield: 0,
    slow: 0,
    magnet: 0,
  };
}

/** A light shard somewhere open, never on top of the player. */
export function spawnShard(world, random) {
  let x = 0;
  let y = 0;
  for (let tries = 0; tries < 12; tries += 1) {
    x = randRange(random, 48, FIELD.width - 48);
    y = randRange(random, 64, FIELD.height - 48);
    const dx = x - world.player.x;
    const dy = y - world.player.y;
    if (dx * dx + dy * dy > 120 * 120) break;
  }
  world.shards.push({
    x,
    y,
    radius: SHARD.radius,
    phase: random() * Math.PI * 2,
    bob: randRange(random, 0.6, 1.4),
  });
}

/** A sentinel with two or three patrol points; a boss is bigger, faster and hunts further. */
export function spawnSentinel(world, random, speedMul, isBoss) {
  const spec = isBoss ? BOSS : SENTINEL;
  let x = 0;
  let y = 0;
  for (let tries = 0; tries < 12; tries += 1) {
    x = randRange(random, 48, FIELD.width - 48);
    y = randRange(random, 64, FIELD.height - 48);
    const dx = x - world.player.x;
    const dy = y - world.player.y;
    if (dx * dx + dy * dy > SENTINEL.spawnSafeRadius * SENTINEL.spawnSafeRadius) break;
  }
  const waypoints = [];
  for (let i = 0; i < 3; i += 1) {
    waypoints.push({
      x: randRange(random, 60, FIELD.width - 60),
      y: randRange(random, 80, FIELD.height - 60),
    });
  }
  world.sentinels.push({
    x,
    y,
    vx: 0,
    vy: 0,
    radius: spec.radius,
    speed: spec.baseSpeed * speedMul,
    chaseRadius: spec.chaseRadius,
    chaseMul: isBoss ? 1.35 : SENTINEL.chaseSpeedMul,
    waypoints,
    waypoint: 0,
    boss: isBoss,
    minionTimer: 4,
    phase: random() * Math.PI * 2,
  });
}

/** A power-up of a random kind, floating where the player can reach it. */
export function spawnPowerup(world, random) {
  const kinds = ['shield', 'slow', 'magnet'];
  world.powerups.push({
    x: randRange(random, 60, FIELD.width - 60),
    y: randRange(random, 80, FIELD.height - 60),
    kind: pick(random, kinds),
    radius: POWERUP.radius,
    ttl: 12,
    phase: random() * Math.PI * 2,
  });
}

/** A burst of sparks at (x, y): the feedback on every pickup and hit. */
export function burst(world, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + world.random() * 0.6;
    const v = speed * (0.4 + world.random() * 0.8);
    world.particles.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: 0.45 + world.random() * 0.3,
      maxLife: 0.75,
      color,
      size: 2 + world.random() * 3,
    });
  }
}

/** Steer the player by keys (or toward the held mouse), with acceleration and friction. */
export function updatePlayer(world, input, dt) {
  const p = world.player;
  const axis = input.axis();
  let tx = axis.x;
  let ty = axis.y;
  if (tx === 0 && ty === 0 && input.mouseDown()) {
    const m = input.mouse();
    if (m) {
      const dx = m.x - p.x;
      const dy = m.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 12) {
        tx = dx / d;
        ty = dy / d;
      }
    }
  }
  p.vx += tx * PLAYER.accel * dt;
  p.vy += ty * PLAYER.accel * dt;
  p.vx *= Math.pow(PLAYER.friction, dt * 60);
  p.vy *= Math.pow(PLAYER.friction, dt * 60);
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > PLAYER.maxSpeed) {
    p.vx = (p.vx / speed) * PLAYER.maxSpeed;
    p.vy = (p.vy / speed) * PLAYER.maxSpeed;
  }
  p.x = Math.min(FIELD.width - p.radius, Math.max(p.radius, p.x + p.vx * dt));
  p.y = Math.min(FIELD.height - p.radius, Math.max(p.radius, p.y + p.vy * dt));
  if (p.invuln > 0) p.invuln -= dt;
  if (p.shield > 0) p.shield -= dt;
  if (p.slow > 0) p.slow -= dt;
  if (p.magnet > 0) p.magnet -= dt;
}

/** Sentinels patrol their waypoints and chase the player when close; the boss also breeds minions. */
export function updateSentinels(world, dt) {
  const p = world.player;
  const slowMul = p.slow > 0 ? POWERUP.slowMul : 1;
  for (const s of world.sentinels) {
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const dist = Math.hypot(dx, dy) || 1;
    let tx = 0;
    let ty = 0;
    if (dist < s.chaseRadius) {
      tx = dx / dist;
      ty = dy / dist;
    } else {
      const wp = s.waypoints[s.waypoint];
      const wx = wp.x - s.x;
      const wy = wp.y - s.y;
      const wd = Math.hypot(wx, wy) || 1;
      if (wd < 24) {
        s.waypoint = (s.waypoint + 1) % s.waypoints.length;
      } else {
        tx = wx / wd;
        ty = wy / wd;
      }
    }
    const speed = s.speed * (dist < s.chaseRadius ? s.chaseMul : 1) * slowMul;
    s.vx += (tx * speed - s.vx) * Math.min(1, dt * 4);
    s.vy += (ty * speed - s.vy) * Math.min(1, dt * 4);
    s.x = Math.min(FIELD.width - s.radius, Math.max(s.radius, s.x + s.vx * dt));
    s.y = Math.min(FIELD.height - s.radius, Math.max(s.radius, s.y + s.vy * dt));
    s.phase += dt * 3;
    if (s.boss) {
      s.minionTimer -= dt;
      const minions = world.sentinels.filter((o) => !o.boss).length;
      if (s.minionTimer <= 0 && minions < BOSS.minions + world.wave) {
        s.minionTimer = 6;
        spawnSentinel(world, world.random, world.spec.speedMul, false);
      }
    }
  }
}

/** Shards bob in place and drift toward a magnetised player. */
export function updateShards(world, dt) {
  const p = world.player;
  for (const shard of world.shards) {
    shard.phase += dt * 2 * shard.bob;
    if (p.magnet > 0) {
      const dx = p.x - shard.x;
      const dy = p.y - shard.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < POWERUP.magnetRadius) {
        const pull = 420 * (1 - d / POWERUP.magnetRadius);
        shard.x += (dx / d) * pull * dt;
        shard.y += (dy / d) * pull * dt;
      }
    }
  }
}

/** Power-ups fade out after their time; particles drift and die. */
export function updatePowerups(world, dt) {
  for (let i = world.powerups.length - 1; i >= 0; i -= 1) {
    world.powerups[i].ttl -= dt;
    world.powerups[i].phase += dt * 2;
    if (world.powerups[i].ttl <= 0) world.powerups.splice(i, 1);
  }
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const pt = world.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.96;
    pt.vy *= 0.96;
    if (pt.life <= 0) world.particles.splice(i, 1);
  }
}

function circlesHit(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.radius + b.radius;
  return dx * dx + dy * dy < r * r;
}

/**
 * What the player touched this step. Returns events: {type:'pickup', shard},
 * {type:'hit', sentinel}, {type:'powerup', kind}, each once per touch. The main loop
 * turns them into score, lives and sound; the world itself stays the record of truth.
 */
export function checkCollisions(world) {
  const events = [];
  const p = world.player;
  for (let i = world.shards.length - 1; i >= 0; i -= 1) {
    if (circlesHit(p, world.shards[i])) {
      events.push({ type: 'pickup', shard: world.shards[i] });
      world.shards.splice(i, 1);
    }
  }
  for (let i = world.powerups.length - 1; i >= 0; i -= 1) {
    if (circlesHit(p, world.powerups[i])) {
      events.push({ type: 'powerup', kind: world.powerups[i].kind });
      world.powerups.splice(i, 1);
    }
  }
  if (p.invuln <= 0) {
    for (const s of world.sentinels) {
      if (circlesHit(p, s)) {
        events.push({ type: 'hit', sentinel: s });
        break;
      }
    }
  }
  return events;
}
