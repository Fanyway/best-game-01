// Everything the player sees: the arena, the orb, the shards, the sentinels, the prisms
// and their beams, the dark that closes in, the HUD and the four screens (title, pause,
// win, game over). The canvas fills the window; the game always draws in the logical
// playfield and the renderer scales it to fit, letterboxed.
//
// v2 look: a parallax starfield over drifting nebulae, a darkness that swallows the arena
// outside the player's light, and beams that cut through it. Every enemy kind reads at a
// glance — spiky patroller, diamond chaser, hex splitter, tiny mini, crowned boss.

import { COLORS, FIELD, LIGHT, MODIFIER_LABEL, PRISM } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

/** Button rectangles, in playfield points, so the main loop can hit-test clicks. */
export const BUTTONS = {
  play: { x: FIELD.width / 2 - 130, y: 520, w: 260, h: 64 },
  restart: { x: FIELD.width / 2 - 130, y: 520, w: 260, h: 64 },
  mute: { x: FIELD.width - 52, y: 12, w: 40, h: 40 },
  prism: { x: FIELD.width - 196, y: FIELD.height - 66, w: 172, h: 44 },
};

/** True when the point is inside the rectangle. */
export function hitButton(rect, point) {
  return (
    point &&
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function makeStars() {
  let seed = 1234567;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  // Three parallax layers: far stars barely move, near stars drift with the player.
  const layers = [[], [], []];
  const counts = [70, 46, 24];
  for (let layer = 0; layer < 3; layer += 1) {
    for (let i = 0; i < counts[layer]; i += 1) {
      layers[layer].push({
        x: next() * FIELD.width,
        y: next() * FIELD.height,
        r: 0.6 + next() * (0.8 + layer * 0.7),
        twinkle: next() * Math.PI * 2,
      });
    }
  }
  return layers;
}

function makeNebulae() {
  return [
    { x: 240, y: 150, r: 260, color: '124, 77, 255', drift: 0.11, phase: 0 },
    { x: 1050, y: 520, r: 300, color: '45, 212, 191', drift: 0.07, phase: 2.1 },
    { x: 980, y: 130, r: 210, color: '255, 46, 154', drift: 0.09, phase: 4.2 },
    { x: 320, y: 560, r: 230, color: '55, 120, 255', drift: 0.13, phase: 1.3 },
  ];
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const starLayers = makeStars();
  const nebulae = makeNebulae();
  const parallax = [0.015, 0.04, 0.09];
  let scale = 1;
  let ox = 0;
  let oy = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    scale = Math.min(w / FIELD.width, h / FIELD.height) * dpr;
    ox = (canvas.width - FIELD.width * scale) / 2;
    oy = (canvas.height - FIELD.height * scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  /** A client pixel to a playfield point. */
  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return {
      x: ((clientX - rect.left) * dpr - ox) / scale,
      y: ((clientY - rect.top) * dpr - oy) / scale,
    };
  }

  function glowCircle(x, y, r, color, core) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
    g.addColorStop(0, color);
    g.addColorStop(0.35, color + '55');
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBackground(world) {
    const time = world.time;
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, COLORS.bgTop);
    g.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Nebulae drift slowly, so the night never sits still.
    for (const n of nebulae) {
      const nx = n.x + Math.sin(time * n.drift + n.phase) * 26;
      const ny = n.y + Math.cos(time * n.drift * 0.8 + n.phase) * 18;
      const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, n.r);
      ng.addColorStop(0, `rgba(${n.color}, 0.13)`);
      ng.addColorStop(1, `rgba(${n.color}, 0)`);
      ctx.fillStyle = ng;
      ctx.fillRect(nx - n.r, ny - n.r, n.r * 2, n.r * 2);
    }
    // Parallax stars: each layer slides a little against the player's drift.
    const px = world.player.x - FIELD.width / 2;
    const py = world.player.y - FIELD.height / 2;
    starLayers.forEach((layer, li) => {
      for (const s of layer) {
        const a = 0.25 + 0.55 * Math.abs(Math.sin(time * 0.7 + s.twinkle));
        ctx.fillStyle = `rgba(190, 205, 255, ${a.toFixed(2)})`;
        let sx = s.x - px * parallax[li];
        let sy = s.y - py * parallax[li];
        sx = ((sx % FIELD.width) + FIELD.width) % FIELD.width;
        sy = ((sy % FIELD.height) + FIELD.height) % FIELD.height;
        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let x = 80; x < FIELD.width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
      ctx.stroke();
    }
    for (let y = 80; y < FIELD.height; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
      ctx.stroke();
    }
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, FIELD.width - 3, FIELD.height - 3);
  }

  /** The dark outside the player's light: a radial gradient, clear near the orb, night at the edge. */
  function drawDarkness(world) {
    const p = world.player;
    const r = world.lightRadius;
    const surge = world.spec.modifier === 'surge' ? 0.06 : 0;
    const alpha = Math.min(0.92, 0.5 + 0.38 * (1 - world.light / LIGHT.max) + surge);
    const g = ctx.createRadialGradient(p.x, p.y, r * 0.35, p.x, p.y, r * 1.7);
    g.addColorStop(0, 'rgba(3, 4, 12, 0)');
    g.addColorStop(0.55, `rgba(3, 4, 12, ${(alpha * 0.55).toFixed(2)})`);
    g.addColorStop(1, `rgba(3, 4, 12, ${alpha.toFixed(2)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawShard(shard) {
    const bob = Math.sin(shard.phase) * 3;
    const y = shard.y + bob;
    ctx.save();
    ctx.translate(shard.x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = COLORS.shard;
    ctx.shadowColor = COLORS.shard;
    ctx.shadowBlur = 14;
    const s = shard.radius;
    ctx.fillRect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.shardCore;
    ctx.fillRect(-s * 0.32, -s * 0.32, s * 0.64, s * 0.64);
    ctx.restore();
  }

  /** One sentinel, drawn by kind so each reads at a glance. */
  function drawSentinel(s) {
    const pulse = 1 + 0.08 * Math.sin(s.phase * 2);
    const r = s.radius * pulse;
    ctx.save();
    ctx.translate(s.x, s.y);
    if (s.kind === 'chaser') {
      // A magenta diamond with two eyes, always pointing at the player.
      ctx.fillStyle = COLORS.chaser;
      ctx.shadowColor = COLORS.chaser;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.25);
      ctx.lineTo(r * 0.9, 0);
      ctx.lineTo(0, r * 1.25);
      ctx.lineTo(-r * 0.9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.chaserCore;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-r * 0.22, -r * 0.28, r * 0.13, 0, Math.PI * 2);
      ctx.arc(r * 0.22, -r * 0.28, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.kind === 'splitter') {
      // An amber hexagon with a ring: tough, and it comes apart when it dies.
      ctx.fillStyle = COLORS.splitter;
      ctx.shadowColor = COLORS.splitter;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const ang = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const px = Math.cos(ang) * r;
        const py = Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = COLORS.splitterCore;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#0b1030';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.kind === 'mini') {
      // A small amber triangle, quick and hungry.
      ctx.fillStyle = COLORS.mini;
      ctx.shadowColor = COLORS.mini;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.2);
      ctx.lineTo(r, r * 0.9);
      ctx.lineTo(-r, r * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      // Patroller and boss: a spiky star, the boss bigger with more spikes.
      ctx.fillStyle = s.boss ? COLORS.boss : COLORS.sentinel;
      ctx.shadowColor = s.boss ? COLORS.boss : COLORS.sentinel;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      const spikes = s.boss ? 10 : 8;
      for (let i = 0; i < spikes * 2; i += 1) {
        const ang = (i / (spikes * 2)) * Math.PI * 2;
        const rr = i % 2 === 0 ? r * 1.35 : r * 0.9;
        const px = Math.cos(ang) * rr;
        const py = Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.sentinelCore;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-r * 0.18, -r * 0.12, r * 0.14, 0, Math.PI * 2);
      ctx.arc(r * 0.18, -r * 0.12, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // A hurt sentinel shows its remaining health, so a beam's work is visible.
    if (s.hp < s.maxHp) {
      const w = s.radius * 2;
      const frac = Math.max(0, s.hp / s.maxHp);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(s.x - w / 2, s.y - s.radius - 12, w, 4);
      ctx.fillStyle = '#aef7ff';
      ctx.fillRect(s.x - w / 2, s.y - s.radius - 12, w * frac, 4);
    }
  }

  function drawPowerup(p) {
    const bob = Math.sin(p.phase) * 3;
    const color = p.kind === 'shield' ? COLORS.shield : p.kind === 'slow' ? COLORS.slow : COLORS.magnet;
    const label = p.kind === 'shield' ? 'S' : p.kind === 'slow' ? 'T' : 'U';
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0b1030';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 1);
    ctx.restore();
  }

  /** A prisma: a crystal diamond with a fading life ring. */
  function drawPrism(prism) {
    const pulse = 1 + 0.06 * Math.sin(prism.phase * 3);
    const r = prism.radius * pulse;
    ctx.save();
    ctx.translate(prism.x, prism.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = COLORS.prism;
    ctx.shadowColor = COLORS.prism;
    ctx.shadowBlur = 22;
    ctx.fillRect(-r * 0.62, -r * 0.62, r * 1.24, r * 1.24);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.prismCore;
    ctx.fillRect(-r * 0.28, -r * 0.28, r * 0.56, r * 0.56);
    ctx.restore();
    // Its remaining life, as a ring that drains.
    ctx.strokeStyle = 'rgba(125, 249, 255, 0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(prism.x, prism.y, prism.radius + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (prism.ttl / prism.maxTtl));
    ctx.stroke();
  }

  /** A beam: a bright core line with a soft halo, jittering like live light. */
  function drawBeam(beam, time) {
    const jitter = (Math.random() - 0.5) * 3;
    const mx = (beam.x1 + beam.x2) / 2 + jitter;
    const my = (beam.y1 + beam.y2) / 2 - jitter;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(174, 247, 255, 0.35)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(beam.x1, beam.y1);
    ctx.quadraticCurveTo(mx, my, beam.x2, beam.y2);
    ctx.stroke();
    ctx.strokeStyle = COLORS.beam;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = COLORS.beam;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(beam.x1, beam.y1);
    ctx.quadraticCurveTo(mx, my, beam.x2, beam.y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.beamCore;
    ctx.beginPath();
    ctx.arc(beam.x2, beam.y2, 5 + Math.sin(time * 14) * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(p, time) {
    // After a hit the orb flickers, but it never vanishes: the glow dims instead of
    // the whole orb blinking out, so the player is always readable.
    if (p.invuln > 0 && Math.floor(time * 12) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }
    glowCircle(p.x, p.y, p.radius, COLORS.player, COLORS.playerCore);
    ctx.globalAlpha = 1;
    if (p.shield > 0) {
      ctx.strokeStyle = COLORS.shield;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(time * 5);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (p.magnet > 0) {
      ctx.strokeStyle = COLORS.magnet;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }

  function drawParticles(world) {
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters(world) {
    for (const f of world.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.fillStyle = f.color;
      ctx.font = '800 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function text(str, x, y, size, color, weight, align) {
    ctx.fillStyle = color;
    ctx.font = `${weight || 700} ${size}px system-ui, sans-serif`;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function drawHud(world, best, muted) {
    ctx.textAlign = 'left';
    text(`SCORE ${world.score}`, 24, 30, 26, COLORS.text, 800, 'left');
    if (world.combo > 1) {
      text(
        `COMBO ×${(1 + (world.combo - 1) * 0.5).toFixed(1)}  (${world.combo})`,
        24,
        60,
        18,
        COLORS.gold,
        700,
        'left',
      );
      // The combo meter: the chain's remaining life, draining to zero.
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(24, 72, 110, 5);
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(24, 72, 110 * Math.max(0, world.comboTimer / 4), 5);
    }
    // Light meter: the lamp's remaining fuel, gold when full, red when starving.
    const lightColor = world.light > 40 ? COLORS.shield : world.light > 15 ? COLORS.gold : COLORS.danger;
    text('LIGHT', 24, 100, 13, lightColor, 700, 'left');
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(24, 110, 110, 6);
    ctx.fillStyle = lightColor;
    ctx.fillRect(24, 110, 110 * Math.max(0, world.light / 100), 6);
    text(`✦ ${world.bank}`, 24, 140, 18, COLORS.gold, 700, 'left');
    text(`◈ ${world.prisms.length}/${PRISM.max}`, 24, 164, 15, COLORS.prism, 700, 'left');
    text(`WAVE ${world.wave} / 10`, FIELD.width / 2, 30, 24, COLORS.text, 800);
    const modLabel = MODIFIER_LABEL[world.spec.modifier];
    if (modLabel) {
      text(modLabel, FIELD.width / 2, 58, 15, world.spec.modifier === 'surge' ? COLORS.danger : COLORS.prism, 700);
    }
    const mins = Math.floor(world.time / 60);
    const secs = Math.floor(world.time % 60);
    text(`${mins}:${String(secs).padStart(2, '0')}`, FIELD.width / 2, 82, 16, COLORS.dim, 600);
    const shardsLeft = Math.max(0, world.spec.shardQuota - world.collected);
    text(`SHARDS ${shardsLeft} TO CLEAR`, FIELD.width / 2, 106, 14, COLORS.gold, 600);
    for (let i = 0; i < 3; i += 1) {
      const hx = FIELD.width - 40 - i * 34;
      ctx.fillStyle = i < world.lives ? '#ff5c73' : 'rgba(255,92,115,0.22)';
      ctx.beginPath();
      ctx.moveTo(hx, 36);
      ctx.bezierCurveTo(hx - 11, 24, hx - 20, 32, hx, 46);
      ctx.bezierCurveTo(hx + 20, 32, hx + 11, 24, hx, 36);
      ctx.fill();
    }
    const timers = [];
    if (world.player.shield > 0) timers.push(['SHIELD', world.player.shield, COLORS.shield]);
    if (world.player.slow > 0) timers.push(['SLOW', world.player.slow, COLORS.slow]);
    if (world.player.magnet > 0) timers.push(['MAGNET', world.player.magnet, COLORS.magnet]);
    timers.forEach(([label, left, color], i) => {
      const y = 92 + i * 22;
      text(label, FIELD.width - 24, y, 13, color, 700, 'right');
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(FIELD.width - 130, y + 10, 106, 5);
      ctx.fillStyle = color;
      ctx.fillRect(FIELD.width - 130, y + 10, 106 * Math.min(1, left / 10), 5);
    });
    // The prism button: what a click or Q buys, and whether the bank covers it.
    const canPrism = world.bank >= PRISM.cost && world.prisms.length < PRISM.max;
    ctx.fillStyle = canPrism ? 'rgba(125, 249, 255, 0.16)' : 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = canPrism ? COLORS.prism : 'rgba(147, 164, 214, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(BUTTONS.prism.x, BUTTONS.prism.y, BUTTONS.prism.w, BUTTONS.prism.h, 10);
    ctx.fill();
    ctx.stroke();
    text(
      `PRISM  (Q)  −${PRISM.cost}✦`,
      BUTTONS.prism.x + BUTTONS.prism.w / 2,
      BUTTONS.prism.y + BUTTONS.prism.h / 2 + 1,
      17,
      canPrism ? COLORS.prism : COLORS.dim,
      800,
    );
    // The mute flag sits above the prism button, never on top of it.
    ctx.fillStyle = muted ? COLORS.danger : COLORS.dim;
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(muted ? 'MUTED (M)' : 'SOUND ON (M)', FIELD.width - 24, FIELD.height - 84);
    text(`BEST ${Math.max(best, world.score)}`, 24, FIELD.height - 24, 15, COLORS.dim, 600, 'left');
  }

  function drawButton(rect, label, accent) {
    ctx.fillStyle = 'rgba(20, 28, 64, 0.9)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 12);
    ctx.fill();
    ctx.stroke();
    text(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, 26, COLORS.text, 800);
  }

  function drawTitle(world, best) {
    ctx.fillStyle = 'rgba(5, 6, 15, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.save();
    ctx.shadowColor = COLORS.player;
    ctx.shadowBlur = 32;
    text('LUMEN DRIFT', FIELD.width / 2, 170, 84, COLORS.player, 900);
    ctx.restore();
    text('Pilot the light. Bend it into a weapon.', FIELD.width / 2, 232, 24, COLORS.text, 600);
    text('The dark closes in as your lamp drains — shards feed it back. Bank shards to widen', FIELD.width / 2, 282, 19, COLORS.dim, 500);
    text('your light, or spend 8✦ on a PRISM (Q): it bends light into a beam that burns sentinels.', FIELD.width / 2, 310, 19, COLORS.dim, 500);
    text('Clear wave 10 to win. Patrollers drift, chasers hunt, splitters burst into minis.', FIELD.width / 2, 338, 19, COLORS.dim, 500);
    text('Arrows / WASD to fly  •  hold mouse to steer  •  Q prism  •  P pause  •  M mute  •  R restart', FIELD.width / 2, 378, 18, COLORS.dim, 500);
    text('S = shield, T = slow time, U = magnet. Inside your light, sentinels slow down.', FIELD.width / 2, 408, 18, COLORS.dim, 500);
    drawButton(BUTTONS.play, 'PLAY', COLORS.player);
    if (best > 0) text(`BEST SCORE ${best}`, FIELD.width / 2, 620, 20, COLORS.gold, 700);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(5, 6, 15, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('PAUSED', FIELD.width / 2, 320, 56, COLORS.text, 900);
    text('Press P or Esc to resume', FIELD.width / 2, 380, 20, COLORS.dim, 500);
  }

  function drawWin(world, best) {
    ctx.fillStyle = 'rgba(5, 6, 15, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.save();
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 30;
    text('YOU WIN', FIELD.width / 2, 200, 72, COLORS.gold, 900);
    ctx.restore();
    text('All ten waves cleared. The dark is lit.', FIELD.width / 2, 262, 22, COLORS.text, 600);
    text(`SCORE  ${world.score}`, FIELD.width / 2, 330, 34, COLORS.text, 800);
    text(`BEST  ${Math.max(best, world.score)}`, FIELD.width / 2, 378, 22, COLORS.gold, 700);
    text(`SENTINELS BURNED  ${world.stats.kills}    •    PRISMS PLACED  ${world.stats.prismsPlaced}`, FIELD.width / 2, 424, 19, COLORS.prism, 700);
    drawButton(BUTTONS.restart, 'PLAY AGAIN', COLORS.gold);
  }

  function drawOver(world, best) {
    ctx.fillStyle = 'rgba(5, 6, 15, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.save();
    ctx.shadowColor = COLORS.sentinel;
    ctx.shadowBlur = 30;
    text('GAME OVER', FIELD.width / 2, 220, 72, COLORS.danger, 900);
    ctx.restore();
    text('The sentinels caught your light.', FIELD.width / 2, 280, 22, COLORS.text, 600);
    text(`SCORE  ${world.score}`, FIELD.width / 2, 350, 34, COLORS.text, 800);
    text(`BEST WAVE  ${world.wave} / 10    •    BEST SCORE  ${Math.max(best, world.score)}`, FIELD.width / 2, 400, 22, COLORS.gold, 700);
    drawButton(BUTTONS.restart, 'RESTART  (R)', COLORS.player);
  }

  return {
    toLogical,

    /** Paint the world on the given screen. `ui` carries the best score and the mute flag. */
    draw(world, screen, ui) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#05060f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, ox, oy);
      if (world.shake > 0) {
        const s = world.shake * 22;
        ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      }
      drawBackground(world);
      for (const shard of world.shards) drawShard(shard);
      for (const p of world.powerups) drawPowerup(p);
      for (const prism of world.prisms) drawPrism(prism);
      for (const s of world.sentinels) drawSentinel(s);
      drawParticles(world);
      if (screen !== SCREEN_TITLE) drawPlayer(world.player, world.time);
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawDarkness(world);
      // Beams cut through the dark: they are drawn after the darkness, not under it.
      for (const beam of world.beams) drawBeam(beam, world.time);
      drawFloaters(world);
      if (world.flash > 0) {
        ctx.fillStyle = `rgba(255, 59, 92, ${(world.flash * 0.55).toFixed(2)})`;
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      }
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
        drawHud(world, ui.best, ui.muted);
      }
      if (world.waveBanner > 0 && screen === SCREEN_PLAY) {
        const modLabel = MODIFIER_LABEL[world.spec.modifier];
        const banner = world.wave === 10 ? 'FINAL WAVE — THE BOSS' : `WAVE ${world.wave}`;
        ctx.globalAlpha = Math.min(1, world.waveBanner);
        text(banner, FIELD.width / 2, FIELD.height / 2 - 40, 52, COLORS.text, 900);
        if (modLabel) text(modLabel, FIELD.width / 2, FIELD.height / 2 + 6, 24, COLORS.prism, 800);
        ctx.globalAlpha = 1;
      }
      if (screen === SCREEN_TITLE) drawTitle(world, ui.best);
      if (screen === SCREEN_PAUSED) drawPaused();
      if (screen === SCREEN_WIN) drawWin(world, ui.best);
      if (screen === SCREEN_OVER) drawOver(world, ui.best);
      ctx.restore();
    },
  };
}
