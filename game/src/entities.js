// The things that live in the arena and how they move and meet. The world is one plain
// object (made in levels.js): player, shards, sentinels, prisms, beams, powerups,
// particles, floaters, and the run's score, combo, lives, wave, light, bank and timers.
// Every update here takes (world, dt) and, where it matters, the input; collisions and
// beam kills return events the main loop turns into sound and score.

import {
  ECLIPSE,
  ENEMY,
  FIELD,
  KILL_SCORE,
  LIGHT,
  LINK,
  PLAYER,
  POWERUP,
  PRISM,
  SHARD,
  SPAWN_SAFE_RADIUS,
} from './config.js';
import { pick, randRange } from './random.js';

/**
 * The wraith's veil (v4): a wraith inside the player's light is shielded by it — no
 * beam or chain can burn it there. Outside the light it burns like any sentinel.
 * The player reads it at a glance: a veiled wraith wears a white ring.
 */
export function isVeiled(world, s) {
  if (s.kind !== 'wraith') return false;
  const dx = s.x - world.player.x;
  const dy = s.y - world.player.y;
  return dx * dx + dy * dy < world.lightRadius * world.lightRadius;
}

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

/**
 * A sentinel of the given kind. Kinds differ in speed, size, toughness and temper:
 * patrollers drift their routes, chasers hunt, splitters die into two minis, minis are
 * quick and small, and the boss is big, fast and breeds minions.
 */
export function spawnSentinel(world, random, speedMul, kind) {
  const spec = ENEMY[kind] || ENEMY.patroller;
  let x = 0;
  let y = 0;
  for (let tries = 0; tries < 12; tries += 1) {
    x = randRange(random, 48, FIELD.width - 48);
    y = randRange(random, 64, FIELD.height - 48);
    const dx = x - world.player.x;
    const dy = y - world.player.y;
    if (dx * dx + dy * dy > SPAWN_SAFE_RADIUS * SPAWN_SAFE_RADIUS) break;
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
    kind,
    radius: spec.radius,
    hp: spec.hp,
    maxHp: spec.hp,
    speed: spec.speed * speedMul,
    chaseRadius: spec.chaseRadius,
    chaseMul: spec.chaseMul,
    waypoints,
    waypoint: 0,
    boss: kind === 'boss',
    minionTimer: 4,
    phase: random() * Math.PI * 2,
  });
}

/** A prisma where the player stands: it bends the player's light into a burning beam. */
export function spawnPrism(world) {
  const p = world.player;
  world.prisms.push({
    x: p.x,
    y: p.y,
    radius: PRISM.radius,
    ttl: PRISM.ttl,
    maxTtl: PRISM.ttl,
    phase: world.random() * Math.PI * 2,
    linked: false,
  });
}

/** Distance from point (px, py) to the segment (x1, y1)-(x2, y2). */
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Burn one sentinel down and settle the reward. `linked` marks a chain kill: it pays
 * the link bonus, bursts bigger, and reads as LINK on the screen. Splitter deaths spawn
 * two minis; the boss reports itself. Used by beams and by chains alike.
 */
function killSentinel(world, target, events, linked) {
  const idx = world.sentinels.indexOf(target);
  if (idx < 0) return;
  world.sentinels.splice(idx, 1);
  const base = KILL_SCORE[target.kind] || 50;
  // An eclipse doubles every kill; a chain kill adds its own bonus on top.
  const eclipseMul = world.spec.modifier === 'eclipse' ? ECLIPSE.killScoreMul : 1;
  const value = Math.round(base * (linked ? LINK.killBonusMul : 1) * eclipseMul);
  world.score += value;
  world.stats.kills += 1;
  if (target.kind === 'wraith') world.stats.wraithsBurned += 1;
  if (linked) world.stats.chainKills += 1;
  const tag = linked && eclipseMul > 1 ? `LINK ×2 +${value}` : linked ? `LINK +${value}` : eclipseMul > 1 ? `×2 +${value}` : `+${value}`;
  if (linked) {
    burst(world, target.x, target.y, '#5eead4', 30, 320);
    burst(world, target.x, target.y, '#aef7ff', 14, 220);
    floater(world, target.x, target.y - 10, tag, '#5eead4');
  } else if (target.kind === 'wraith') {
    burst(world, target.x, target.y, '#e6e6fa', 30, 320);
    burst(world, target.x, target.y, '#b8b8ff', 14, 220);
    floater(world, target.x, target.y - 10, tag, '#e6e6fa');
  } else {
    burst(world, target.x, target.y, '#aef7ff', 20, 260);
    floater(world, target.x, target.y - 10, tag, '#aef7ff');
  }
  events.push({ type: 'kill', kind: target.kind, value, x: target.x, y: target.y, linked });
  if (target.kind === 'splitter') {
    for (let i = 0; i < 2; i += 1) {
      spawnSentinel(world, world.random, world.spec.speedMul, 'mini');
      const mini = world.sentinels[world.sentinels.length - 1];
      mini.x = Math.min(FIELD.width - mini.radius, Math.max(mini.radius, target.x + (i === 0 ? -24 : 24)));
      mini.y = Math.min(FIELD.height - mini.radius, Math.max(mini.radius, target.y + (i === 0 ? -14 : 14)));
    }
    events.push({ type: 'split', x: target.x, y: target.y });
  }
  if (target.boss) {
    events.push({ type: 'bossDown', score: world.score });
  }
}

/**
 * Prism links (v3): every pair of prisms within LINK.range joins into a chain of light.
 * A chain burns any sentinel it touches, and both prisms it joins resonate — their own
 * beams burn harder. Returns events: a `link` event when the web grows, so the sound
 * board can chime it. The live links are left in world.links for the renderer to draw.
 */
export function updateLinks(world, dt) {
  const events = [];
  world.links = [];
  for (const prism of world.prisms) prism.linked = false;
  // During an eclipse the chains reach farther: the dark carries the light.
  const linkRange = world.spec.modifier === 'eclipse' ? ECLIPSE.linkRange : LINK.range;
  for (let i = 0; i < world.prisms.length; i += 1) {
    for (let j = i + 1; j < world.prisms.length; j += 1) {
      const a = world.prisms[i];
      const b = world.prisms[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dx * dx + dy * dy > linkRange * linkRange) continue;
      a.linked = true;
      b.linked = true;
      world.links.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
  }
  if (world.links.length > world.linkCount) {
    events.push({ type: 'link', count: world.links.length });
  }
  world.linkCount = world.links.length;
  world.stats.maxLinks = Math.max(world.stats.maxLinks, world.links.length);
  for (const link of world.links) {
    for (const s of [...world.sentinels]) {
      if (!world.sentinels.includes(s)) continue;
      if (isVeiled(world, s)) continue;
      if (distToSegment(s.x, s.y, link.x1, link.y1, link.x2, link.y2) > s.radius + 8) continue;
      s.hp -= LINK.damagePerSecond * dt;
      if (world.random() < 0.5) {
        world.particles.push({
          x: s.x + (world.random() - 0.5) * s.radius * 2,
          y: s.y + (world.random() - 0.5) * s.radius * 2,
          vx: (world.random() - 0.5) * 120,
          vy: (world.random() - 0.5) * 120,
          life: 0.3,
          maxLife: 0.3,
          color: '#5eead4',
          size: 2 + world.random() * 2,
        });
      }
      if (s.hp <= 0) killSentinel(world, s, events, true);
    }
  }
  return events;
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

/** Floating score text that rises and fades: the reward you can read. */
export function floater(world, x, y, text, color) {
  world.floaters.push({ x, y, text, color, life: 1.1, maxLife: 1.1 });
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

/**
 * Sentinels patrol their waypoints and chase the player when close; minis and chasers
 * hunt harder, the boss also breeds minions. Inside the player's light they slow down;
 * when the light dies the dark speeds them up. Returns nothing; the world is the record.
 */
export function updateSentinels(world, dt) {
  const p = world.player;
  const slowMul = p.slow > 0 ? POWERUP.slowMul : 1;
  const lightR = world.lightRadius;
  const dark = world.light <= 0.01;
  for (const s of world.sentinels) {
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const dist = Math.hypot(dx, dy) || 1;
    let tx = 0;
    let ty = 0;
    // Minis never patrol: they always hunt. The rest chase inside their radius.
    if (s.kind === 'mini' || dist < s.chaseRadius) {
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
    let speed = s.speed * (dist < s.chaseRadius || s.kind === 'mini' ? s.chaseMul : 1) * slowMul;
    // A wraith is steady in the dark and in the light alike: the lamp neither slows
    // it nor hurries it. Every other sentinel slows inside the light and speeds up
    // when the lamp dies.
    if (s.kind !== 'wraith') {
      if (dist < lightR) speed *= LIGHT.slowInLight;
      if (dark) speed *= LIGHT.darkSpeedMul;
    }
    s.vx += (tx * speed - s.vx) * Math.min(1, dt * 4);
    s.vy += (ty * speed - s.vy) * Math.min(1, dt * 4);
    s.x = Math.min(FIELD.width - s.radius, Math.max(s.radius, s.x + s.vx * dt));
    s.y = Math.min(FIELD.height - s.radius, Math.max(s.radius, s.y + s.vy * dt));
    s.phase += dt * 3;
    if (s.boss) {
      s.minionTimer -= dt;
      const minions = world.sentinels.filter((o) => !o.boss).length;
      if (s.minionTimer <= 0 && minions < ENEMY.boss.minions + world.wave) {
        s.minionTimer = 6;
        spawnSentinel(world, world.random, world.spec.speedMul, 'mini');
      }
    }
  }
}

/**
 * Each prisma aims its beam at the nearest sentinel in range and burns it. A linked
 * prisma resonates: its beam burns harder. A beam that kills returns an event with the
 * score. The live beams are left in world.beams for the renderer to draw.
 */
export function updateBeams(world, dt) {
  const events = [];
  world.beams = [];
  for (const prism of world.prisms) {
    let target = null;
    let bestD = PRISM.range * PRISM.range;
    for (const s of world.sentinels) {
      // A veiled wraith is not a target: the beam would waste itself on the veil.
      // The prisma aims at the nearest sentinel it can actually burn.
      if (isVeiled(world, s)) continue;
      const dx = s.x - prism.x;
      const dy = s.y - prism.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        target = s;
      }
    }
    if (!target) continue;
    world.beams.push({ x1: prism.x, y1: prism.y, x2: target.x, y2: target.y, kind: target.kind, linked: prism.linked });
    const damage = PRISM.damagePerSecond * (prism.linked ? LINK.resonanceMul : 1) * dt;
    target.hp -= damage;
    // Burn sparks where the beam lands, so a hit reads even at a glance.
    if (world.random() < 0.5) {
      world.particles.push({
        x: target.x + (world.random() - 0.5) * target.radius * 2,
        y: target.y + (world.random() - 0.5) * target.radius * 2,
        vx: (world.random() - 0.5) * 120,
        vy: (world.random() - 0.5) * 120,
        life: 0.3,
        maxLife: 0.3,
        color: '#aef7ff',
        size: 2 + world.random() * 2,
      });
    }
    if (target.hp <= 0) killSentinel(world, target, events, false);
  }
  return events;
}

/** Prisms fade out after their time; a spent prisma leaves a few sparks behind. */
export function updatePrisms(world, dt) {
  for (let i = world.prisms.length - 1; i >= 0; i -= 1) {
    const prism = world.prisms[i];
    prism.ttl -= dt;
    prism.phase += dt * 2;
    if (prism.ttl <= 0) {
      burst(world, prism.x, prism.y, '#7df9ff', 10, 140);
      world.prisms.splice(i, 1);
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

/** Power-ups fade out after their time; particles drift and die; floaters rise and fade. */
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
  for (let i = world.floaters.length - 1; i >= 0; i -= 1) {
    const f = world.floaters[i];
    f.life -= dt;
    f.y -= 34 * dt;
    if (f.life <= 0) world.floaters.splice(i, 1);
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
