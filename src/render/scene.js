// scene.js — canvas diorama. M1/M2 draw placeholder rects for mobs; Bob is a static sprite with a
// graceful fallback. Sprites swap in piecemeal without touching game logic.
import { CONFIG } from '../config.js';
import { getSprite } from './sprites.js';

const W = CONFIG.stage.width, H = CONFIG.stage.height;

const COL = {
  wall:'#1d1526', floor:'#2a2033',
  counter:'#5b3a24', counterTop:'#7a5233',
  portalFrame:'#3a2b1a', portalGlow:'#8b5cf6',
  shadow:'rgba(0,0,0,0.35)', face:'#00000088', marker:'#ffcf4a',
};
const CUST_COLOR = { slime:'#57c96b', bat:'#8a6bd6', skeleton:'#d9d2c2' };
const colorFor = (id) => CUST_COLOR[id] ?? '#cccccc';   // fallback colour for unknown types

// --- Queue layout. Front mob (index 0) sits nearest the counter; the line recedes left. ---
// The line lives in the clear left strip so the front mob isn't hidden behind the centered Shelf
// panel (a DOM overlay whose left edge is ~x425). Front right edge (~404) clears it.
const QUEUE = {
  frontX: W * 0.247,   // ~316 left-edge of the front mob
  stepX:  W * 0.081,   // ~104 gap between mobs
  y:      H * 0.528,   // ~380 top; feet land ~468 — on the floor, clear of the Current Customer panel
  size:   88,
};

// --- Bob (shopkeeper) draw box. Tweak `height` to check his on-screen scale. ---
const BOB = {
  centerX: W * 0.57,
  feetY:   H * 0.585,
  height:  240,        // ON-SCREEN HEIGHT IN PX — adjust to size-check Bob
  placeholderColor:'#7a4a2a',
};

export function drawScene(ctx, state, tMs) {
  ctx.clearRect(0, 0, W, H);

  // Walls + floor
  ctx.fillStyle = COL.wall;  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COL.floor; ctx.fillRect(0, H * 0.62, W, H * 0.38);

  // Bob before the counter so the counter front overlaps his lower body
  drawBob(ctx);

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

  drawQueue(ctx, state, tMs);
}

// Draw the line back-to-front so the front mob sits on top of those behind it.
function drawQueue(ctx, state, tMs) {
  const q = state.queue;
  for (let i = q.length - 1; i >= 0; i--) {
    const x = QUEUE.frontX - i * QUEUE.stepX;
    drawMob(ctx, x, QUEUE.y, QUEUE.size, colorFor(q[i].monsterId), tMs, i === 0);
  }
}

function drawMob(ctx, x, y, size, color, tMs, isFront) {
  const bob = Math.sin(tMs / 300 + x) * 4;   // +x so mobs don't bob in lockstep
  const my = y + bob;
  const groundY = y + size - 4;              // shadow stays on the ground while the mob hops

  ctx.fillStyle = COL.shadow;
  ctx.beginPath();
  ctx.ellipse(x + size / 2, groundY, size * 0.42, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.fillRect(x, my, size, size);
  ctx.fillStyle = COL.face;
  ctx.fillRect(x + size * 0.28, my + size * 0.35, size * 0.09, size * 0.09);
  ctx.fillRect(x + size * 0.60, my + size * 0.35, size * 0.09, size * 0.09);

  // Gold chevron above the front mob — the one Serve / Send Away acts on.
  if (isFront) {
    const cxm = x + size / 2, ty = my - 16;
    ctx.fillStyle = COL.marker;
    ctx.beginPath();
    ctx.moveTo(cxm - 9, ty); ctx.lineTo(cxm + 9, ty); ctx.lineTo(cxm, ty + 11);
    ctx.closePath(); ctx.fill();
  }
}

// Draw Bob: the static sprite if present, else a placeholder box at the same scale/position.
function drawBob(ctx) {
  const spr = getSprite('mimic_merchant');
  const h = BOB.height;
  if (spr) {
    const w = h * (spr.naturalWidth / spr.naturalHeight);   // preserve aspect at the target height
    ctx.drawImage(spr, BOB.centerX - w / 2, BOB.feetY - h, w, h);
  } else {
    const w = h * 0.7;
    ctx.fillStyle = BOB.placeholderColor;
    ctx.fillRect(BOB.centerX - w / 2, BOB.feetY - h, w, h);
    ctx.fillStyle = '#00000055';
    ctx.fillRect(BOB.centerX - w / 2, BOB.feetY - h * 0.45, w, 6);
  }
}
