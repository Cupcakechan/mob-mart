// scene.js — canvas diorama. Every element draws its sprite if present (getSprite), else a
// placeholder, so art can drop in piecemeal without touching game logic. The blocks below are the
// tunable knobs: change a size/position here and reload to fit your sprites.
import { CONFIG } from '../config.js';
import { getSprite } from './sprites.js';

const W = CONFIG.stage.width, H = CONFIG.stage.height;

const COL = {
  wall:'#1d1526', floor:'#2a2033',
  shadow:'rgba(0,0,0,0.35)', face:'#00000088', marker:'#ffcf4a',
};
const CUST_COLOR = { slime:'#57c96b', bat:'#8a6bd6', skeleton:'#d9d2c2' };
const colorFor = (id) => CUST_COLOR[id] ?? '#cccccc';

// --- Queue: front mob (index 0) nearest the counter; line recedes left. -------
// spriteScale multiplies the box height for the drawn sprite (bump if your mobs look small).
const QUEUE = {
  frontX: W * 0.247,   // ~316 left-edge of the front mob
  stepX:  W * 0.105,   // ~134 gap between mobs
  y:      H * 0.528,   // ~380 top of the box
  size:   88,          // box size (drives the placeholder + shadow footprint)
  spriteScale: 1.0,    // drawn sprite height = size * this
};

// --- Counter / "desk" furniture. Author your desk ~`width` wide (2x for crisp). ---
// Sprite is drawn at `width`, aspect preserved, its BOTTOM resting on `baseY`.
// baseY is the SINGLE floor-contact dial: RAISE it (bigger number) to sink the desk lower, LOWER it
// to lift the desk. Bob is anchored to this below, so tuning baseY keeps his hands on the counter.
const COUNTER = {
  centerX: W * 0.57,   // ~730
  baseY:   H * 0.66,   // ~475, desk's bottom sits here on the floor   <-- FLOOR-CONTACT DIAL
  width:   480,        // ON-SCREEN WIDTH IN PX                         <-- desk-size dial
  phHeight: 118,       // placeholder rect height (until the sprite loads)
  color:'#5b3a24', topColor:'#7a5233',
};

// --- Bob (shopkeeper). Feet anchored 11px above the counter base so his hands stay on the desk
// top whenever you re-tune COUNTER.baseY. Tweak `height` to size-check him. ---
const BOB = {
  centerX: W * 0.57,          // ~730, centered over the counter
  feetY:   COUNTER.baseY - 11, // follows the counter (keeps Bob grounded + hands on the desk)
  height:  240,               // ON-SCREEN HEIGHT IN PX
  placeholderColor:'#7a4a2a',
};

// --- Portal ("To Battle" door). Sprite stretches to this box. -----------------
const PORTAL = { x: W * 0.80, y: H * 0.30, w: W * 0.11, h: H * 0.34, glow:'#8b5cf6', frame:'#3a2b1a' };

export function drawScene(ctx, state, tMs) {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = COL.wall;  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COL.floor; ctx.fillRect(0, H * 0.62, W, H * 0.38);

  drawBob(ctx);                 // before the counter, so the counter front overlaps his lower body
  drawCounter(ctx);
  drawPortal(ctx, tMs);
  drawQueue(ctx, state, tMs);
}

function drawQueue(ctx, state, tMs) {
  const q = state.queue;
  for (let i = q.length - 1; i >= 0; i--) {         // back-to-front so the front mob sits on top
    drawMob(ctx, QUEUE.frontX - i * QUEUE.stepX, QUEUE.y, QUEUE.size, q[i].monsterId, tMs, i === 0);
  }
}

function drawMob(ctx, x, y, size, monsterId, tMs, isFront) {
  const bob = Math.sin(tMs / 300 + x) * 4;          // +x so mobs don't bob in lockstep
  const groundY = y + size - 4;                     // shadow stays on the ground while the mob hops

  ctx.fillStyle = COL.shadow;
  ctx.beginPath();
  ctx.ellipse(x + size / 2, groundY, size * 0.42, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  const spr = getSprite(monsterId);
  if (spr) {
    const h = size * QUEUE.spriteScale;
    const w = h * (spr.naturalWidth / spr.naturalHeight);   // preserve aspect at target height
    ctx.drawImage(spr, x + size / 2 - w / 2, (y + size) - h + bob, w, h);  // anchored feet, bobbing
  } else {
    const my = y + bob;
    ctx.fillStyle = colorFor(monsterId);
    ctx.fillRect(x, my, size, size);
    ctx.fillStyle = COL.face;
    ctx.fillRect(x + size * 0.28, my + size * 0.35, size * 0.09, size * 0.09);
    ctx.fillRect(x + size * 0.60, my + size * 0.35, size * 0.09, size * 0.09);
  }

  if (isFront) {                                    // gold chevron over the mob Serve/Send Away hits
    const cxm = x + size / 2, ty = (y + bob) - 16;
    ctx.fillStyle = COL.marker;
    ctx.beginPath();
    ctx.moveTo(cxm - 9, ty); ctx.lineTo(cxm + 9, ty); ctx.lineTo(cxm, ty + 11);
    ctx.closePath(); ctx.fill();
  }
}

function drawBob(ctx) {
  const spr = getSprite('mimic_merchant');
  const h = BOB.height;
  if (spr) {
    const w = h * (spr.naturalWidth / spr.naturalHeight);
    ctx.drawImage(spr, BOB.centerX - w / 2, BOB.feetY - h, w, h);
  } else {
    const w = h * 0.7;
    ctx.fillStyle = BOB.placeholderColor;
    ctx.fillRect(BOB.centerX - w / 2, BOB.feetY - h, w, h);
    ctx.fillStyle = '#00000055';
    ctx.fillRect(BOB.centerX - w / 2, BOB.feetY - h * 0.45, w, 6);
  }
}

function drawCounter(ctx) {
  const spr = getSprite('counter');
  const w = COUNTER.width;
  if (spr) {
    const h = w * (spr.naturalHeight / spr.naturalWidth);   // preserve aspect, bottom on baseY
    ctx.drawImage(spr, COUNTER.centerX - w / 2, COUNTER.baseY - h, w, h);
  } else {
    const h = COUNTER.phHeight, x = COUNTER.centerX - w / 2, y = COUNTER.baseY - h;
    ctx.fillStyle = COUNTER.color;    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COUNTER.topColor; ctx.fillRect(x, y, w, 14);
  }
}

function drawPortal(ctx, tMs) {
  const pulse = 0.5 + 0.5 * Math.sin(tMs / 500);
  const spr = getSprite('portal');
  ctx.save();
  ctx.shadowColor = PORTAL.glow;
  ctx.shadowBlur = 20 + 20 * pulse;
  if (spr) {
    ctx.drawImage(spr, PORTAL.x, PORTAL.y, PORTAL.w, PORTAL.h);
  } else {
    ctx.fillStyle = PORTAL.frame; ctx.fillRect(PORTAL.x - 8, PORTAL.y - 8, PORTAL.w + 16, PORTAL.h + 16);
    ctx.fillStyle = `rgba(139,92,246,${0.55 + 0.35 * pulse})`; ctx.fillRect(PORTAL.x, PORTAL.y, PORTAL.w, PORTAL.h);
  }
  ctx.restore();
}
