// scene.js — canvas diorama. Every element draws its sprite if present (getSprite), else a
// placeholder, so art can drop in piecemeal without touching game logic. The blocks below are the
// tunable knobs: change a size/position here and reload to fit your sprites.
import { CONFIG } from '../config.js';
import { getSprite } from './sprites.js';

const W = CONFIG.stage.width, H = CONFIG.stage.height;
const FLOOR_Y = H * 0.62;   // wall/floor split (y=446) — matches the shop_bg.png authoring spec

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

// --- Bob (shopkeeper). Feet sit ABOVE the counter base by the `lift` amount so his arms/hands
// show over the counter — he "floats" behind it on purpose (a peeking look; his lower body stays
// hidden behind the counter front, so nothing looks off). Still tied to COUNTER.baseY, so the desk
// and Bob move together. ---
const BOB = {
  centerX: W * 0.57,           // ~730, centered over the counter
  feetY:   COUNTER.baseY - 50, // <-- BOB-HEIGHT DIAL: raise the 50 to show MORE arms/hands, lower for less
  height:  240,                // ON-SCREEN HEIGHT IN PX
  placeholderColor:'#7a4a2a',
};

// Bob's animations — each is a horizontal-strip sheet (frames left-to-right, equal width),
// auto-sliced by frame count (no pixel sizes to enter). Drop a PNG named for its spriteId and it
// plays; absent, Bob falls back to the static mimic_merchant.png, then a placeholder. fps is
// per-animation, so tune idle/serving speed here independently.
const BOB_ANIMS = {
  idle:    { spriteId: 'bob_idle',  frames: 6, fps: 6,  loop: true  },  // gentle looping breathe
  serving: { spriteId: 'bob_serve', frames: 6, fps: 12, loop: false },  // one-shot, snappier
};
const bobAnim = { name: 'idle', startMs: null };   // current animation + when it started (ms)

// Play the one-shot serving animation (call when a serve actually happens). It runs once, then Bob
// drops back into the idle loop by itself.
export function playBobServe() {
  bobAnim.name = 'serving';
  bobAnim.startMs = null;          // reset so it restarts from frame 0 on the next draw
}

// --- Portal ("To Battle" door). Authored as a SQUARE 160x160 frame; drawn aspect-preserved at
// `size`, bottom resting on `baseY` (same anchor pattern as the counter/Bob — no more stretch-to-box).
// Animated path: portal_glow.png, a 4-frame horizontal strip (4x160 = 640x160), auto-sliced and
// looping forever. Fallback chain: strip -> static portal.png -> placeholder slab.
// Glow is alpha-aware (canvas shadow hugs the swirl's transparent edges) and kept SLIGHT via the
// two dials below.
const PORTAL = {
  centerX: W * 0.855,          // ~1094 — matches the old placeholder box's horizontal center
  baseY:   H * 0.64,           // ~461 — portal bottom, just below the floor line (grounded)
  size:    160,                // ON-SCREEN HEIGHT IN PX. 160 = crisp 1x of the art; 320 = crisp 2x.
  anim: { frames: 4, fps: 8 }, // swirl loop: 4 equal frames left-to-right; raise fps to spin faster
  glowBase: 10,                // <-- GLOW DIALS: blur = glowBase + glowPulse * pulse(0..1).
  glowPulse: 8,                //     Old placeholder glow was 20+20 — these read as "slight".
  glow:'#8b5cf6', frame:'#3a2b1a',
};

export function drawScene(ctx, state, tMs) {
  ctx.clearRect(0, 0, W, H);

  drawBackground(ctx);          // shop_bg.png if present, else flat wall + floor

  drawBob(ctx, tMs);            // before the counter, so the counter front overlaps his lower body
  drawCounter(ctx);
  drawPortal(ctx, tMs);
  drawQueue(ctx, state, tMs);
}

// Full-stage backdrop (wall + floor baked in). Falls back to flat colors with the floor line at
// FLOOR_Y so the scene reads fine before art arrives.
function drawBackground(ctx) {
  const spr = getSprite('shop_bg');
  if (spr) {
    ctx.drawImage(spr, 0, 0, W, H);
  } else {
    ctx.fillStyle = COL.wall;  ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = COL.floor; ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
  }
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

function drawBob(ctx, tMs) {
  const cfg = BOB_ANIMS[bobAnim.name];
  let spr = getSprite(cfg.spriteId);
  let frameCount = cfg.frames;
  if (!spr) { spr = getSprite('mimic_merchant'); frameCount = 1; }   // sheet absent -> static Bob

  if (!spr) {                                                        // nothing loaded -> placeholder
    const h = BOB.height, w = h * 0.7;
    ctx.fillStyle = BOB.placeholderColor;
    ctx.fillRect(BOB.centerX - w / 2, BOB.feetY - h, w, h);
    ctx.fillStyle = '#00000055';
    ctx.fillRect(BOB.centerX - w / 2, BOB.feetY - h * 0.45, w, 6);
    return;
  }

  if (bobAnim.startMs == null) bobAnim.startMs = tMs;
  let frame = Math.floor((tMs - bobAnim.startMs) / (1000 / cfg.fps));
  if (cfg.loop || frameCount === 1) {
    frame %= frameCount;                            // loop (or a single static frame)
  } else if (frame >= frameCount) {
    bobAnim.name = 'idle'; bobAnim.startMs = tMs;   // one-shot done -> return to idle...
    drawBob(ctx, tMs); return;                      // ...and draw idle this frame (idle loops, so no re-recursion)
  }

  const fw = spr.naturalWidth / frameCount;         // auto-sliced frame width
  const fh = spr.naturalHeight;
  const drawH = BOB.height;
  const drawW = drawH * (fw / fh);
  ctx.drawImage(spr, frame * fw, 0, fw, fh, BOB.centerX - drawW / 2, BOB.feetY - drawH, drawW, drawH);
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
  ctx.save();
  ctx.shadowColor = PORTAL.glow;
  ctx.shadowBlur = PORTAL.glowBase + PORTAL.glowPulse * pulse;   // slight, breathing glow

  const h = PORTAL.size;
  const strip = getSprite('portal_glow');                        // preferred: 4-frame swirl strip
  if (strip) {
    const frames = PORTAL.anim.frames;
    const frame = Math.floor(tMs / (1000 / PORTAL.anim.fps)) % frames;  // endless loop, no state needed
    const fw = strip.naturalWidth / frames;                      // auto-sliced frame width
    const fh = strip.naturalHeight;
    const w = h * (fw / fh);                                     // preserve aspect (square art -> w = h)
    ctx.drawImage(strip, frame * fw, 0, fw, fh, PORTAL.centerX - w / 2, PORTAL.baseY - h, w, h);
  } else {
    const single = getSprite('portal');                          // fallback: static single frame
    if (single) {
      const w = h * (single.naturalWidth / single.naturalHeight);
      ctx.drawImage(single, PORTAL.centerX - w / 2, PORTAL.baseY - h, w, h);
    } else {                                                     // last resort: square placeholder slab
      const w = h, x = PORTAL.centerX - w / 2, y = PORTAL.baseY - h;
      ctx.fillStyle = PORTAL.frame;
      ctx.fillRect(x - 8, y - 8, w + 16, h + 16);
      ctx.fillStyle = `rgba(139,92,246,${0.55 + 0.35 * pulse})`;
      ctx.fillRect(x, y, w, h);
    }
  }
  ctx.restore();
}
