// scene.js — canvas diorama. M1 draws placeholder rects; real sprites swap in later
// (via a future sprites.js) without touching this call site's inputs.
import { CONFIG } from '../config.js';

const W = CONFIG.stage.width, H = CONFIG.stage.height;

const COL = {
  wall:'#1d1526', floor:'#2a2033',
  counter:'#5b3a24', counterTop:'#7a5233',
  portalFrame:'#3a2b1a', portalGlow:'#8b5cf6',
  shadow:'rgba(0,0,0,0.35)', face:'#00000088',
  customer:{ slime:'#57c96b', bat:'#8a6bd6', skeleton:'#d9d2c2' },
};

export function drawScene(ctx, state, tMs) {
  ctx.clearRect(0, 0, W, H);

  // Walls + floor
  ctx.fillStyle = COL.wall;  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COL.floor; ctx.fillRect(0, H * 0.62, W, H * 0.38);

  // Counter (center)
  const cx = W * 0.42, cy = H * 0.44, cw = W * 0.30, ch = H * 0.16;
  ctx.fillStyle = COL.counter;    ctx.fillRect(cx, cy, cw, ch);
  ctx.fillStyle = COL.counterTop; ctx.fillRect(cx, cy, cw, 14);

  // Portal (right) with a pulsing glow — the "To Battle" door
  const pulse = 0.5 + 0.5 * Math.sin(tMs / 500);
  const px = W * 0.80, py = H * 0.30, pw = W * 0.11, ph = H * 0.34;
  ctx.save();
  ctx.shadowColor = COL.portalGlow;
  ctx.shadowBlur = 20 + 20 * pulse;
  ctx.fillStyle = COL.portalFrame; ctx.fillRect(px - 8, py - 8, pw + 16, ph + 16);
  ctx.fillStyle = `rgba(139,92,246,${0.55 + 0.35 * pulse})`; ctx.fillRect(px, py, pw, ph);
  ctx.restore();

  // Current customer (placeholder block, idle bob) — faces forward so it reads as looking at you
  const c = state.currentCustomer;
  if (c) {
    const bob = Math.sin(tMs / 300) * 4;
    const size = 110;
    const mx = W * 0.18, my = H * 0.50 + bob;
    ctx.fillStyle = COL.shadow;
    ctx.beginPath();
    ctx.ellipse(mx + size / 2, H * 0.62 + size - 12, size * 0.4, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COL.customer[c.monsterId] ?? '#cccccc';   // fallback colour for unknown types
    ctx.fillRect(mx, my, size, size);
    ctx.fillStyle = COL.face;
    ctx.fillRect(mx + size * 0.28, my + size * 0.35, 10, 10);
    ctx.fillRect(mx + size * 0.60, my + size * 0.35, 10, 10);
  }
}
