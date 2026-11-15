// Everything the player sees: the arena, the orb, the shards, the sentinels, the HUD and
// the four screens (title, pause, win, game over). The canvas fills the window; the game
// always draws in the logical playfield and the renderer scales it to fit, letterboxed.

import { COLORS, FIELD } from './config.js';

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
  const stars = [];
  for (let i = 0; i < 130; i += 1) {
    stars.push({
      x: next() * FIELD.width,
      y: next() * FIELD.height,
      r: 0.6 + next() * 1.6,
      twinkle: next() * Math.PI * 2,
    });
  }
  return stars;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const stars = makeStars();
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

  function drawBackground(time) {
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, COLORS.bgTop);
    g.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const s of stars) {
      const a = 0.25 + 0.55 * Math.abs(Math.sin(time * 0.7 + s.twinkle));
      ctx.fillStyle = `rgba(190, 205, 255, ${a.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
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

  function drawSentinel(s) {
    const pulse = 1 + 0.08 * Math.sin(s.phase * 2);
    const r = s.radius * pulse;
    ctx.save();
    ctx.translate(s.x, s.y);
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
    ctx.restore();
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
    }
    text(`WAVE ${world.wave} / 10`, FIELD.width / 2, 30, 24, COLORS.text, 800);
    const mins = Math.floor(world.time / 60);
    const secs = Math.floor(world.time % 60);
    text(`${mins}:${String(secs).padStart(2, '0')}`, FIELD.width / 2, 58, 16, COLORS.dim, 600);
    const shardsLeft = Math.max(0, world.spec.shardQuota - world.collected);
    text(`SHARDS ${shardsLeft} TO CLEAR`, FIELD.width / 2, 82, 14, COLORS.gold, 600);
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
    ctx.fillStyle = muted ? COLORS.danger : COLORS.dim;
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(muted ? 'MUTED (M)' : 'SOUND ON (M)', FIELD.width - 24, FIELD.height - 24);
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
    text('LUMEN DRIFT', FIELD.width / 2, 190, 84, COLORS.player, 900);
    ctx.restore();
    text('Pilot the light. Outrun the dark.', FIELD.width / 2, 250, 24, COLORS.text, 600);
    text('Collect shards to clear each wave — clear wave 10 to win. Dodge the red sentinels.', FIELD.width / 2, 300, 19, COLORS.dim, 500);
    text('Arrows / WASD to fly  •  hold mouse to steer  •  P pause  •  M mute  •  R restart', FIELD.width / 2, 340, 18, COLORS.dim, 500);
    text('Shards build your combo. S = shield, T = slow time, U = magnet.', FIELD.width / 2, 372, 18, COLORS.dim, 500);
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
    text('YOU WIN', FIELD.width / 2, 220, 72, COLORS.gold, 900);
    ctx.restore();
    text('All ten waves cleared. The dark is lit.', FIELD.width / 2, 280, 22, COLORS.text, 600);
    text(`SCORE  ${world.score}`, FIELD.width / 2, 360, 34, COLORS.text, 800);
    text(`BEST  ${Math.max(best, world.score)}`, FIELD.width / 2, 410, 22, COLORS.gold, 700);
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
      drawBackground(world.time);
      for (const shard of world.shards) drawShard(shard);
      for (const p of world.powerups) drawPowerup(p);
      for (const s of world.sentinels) drawSentinel(s);
      drawParticles(world);
      if (screen !== SCREEN_TITLE) drawPlayer(world.player, world.time);
      if (world.flash > 0) {
        ctx.fillStyle = `rgba(255, 59, 92, ${(world.flash * 0.55).toFixed(2)})`;
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      }
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
        drawHud(world, ui.best, ui.muted);
      }
      if (world.waveBanner > 0 && screen === SCREEN_PLAY) {
        ctx.globalAlpha = Math.min(1, world.waveBanner);
        text(world.wave === 10 ? 'FINAL WAVE — THE BOSS' : `WAVE ${world.wave}`, FIELD.width / 2, FIELD.height / 2 - 40, 52, COLORS.text, 900);
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
