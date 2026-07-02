// scene.js — canvas diorama. Every element draws its sprite if present (getSprite), else a
// placeholder, so art can drop in piecemeal without touching game logic. The blocks below are the
// tunable knobs: change a size/position here and reload to fit your sprites.
import { CONFIG } from '../config.js';
import { MONSTERS } from '../data/monsters.js';
import { getSprite } from './sprites.js';

const W = CONFIG.stage.width, H = CONFIG.stage.height;
const FLOOR_Y = 462;   // wall/floor split (y=446) — matches the shop_bg.png authoring spec

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
  y:      H * 0.565,   // ~407 top of the box -> mob FEET at ~495, forward of the wall seam so the
                       // line stands on the same floor plane the counter now occupies. PROVISIONAL:
                       // if feet hide behind the Current Customer DOM panel, raise toward H*0.545;
                       // if the mobs still read as glued to the wall, sink toward H*0.60.
  size:   88,          // box size (drives the placeholder + shadow footprint)
  spriteScale: 1.0,    // drawn sprite height = size * this
};

// --- Counter / "desk" furniture. Author your desk ~`width` wide (2x for crisp). ---
// Sprite is drawn at `width`, aspect preserved, its BOTTOM resting on `baseY`.
// baseY is the SINGLE floor-contact dial: RAISE it (bigger number) to sink the desk lower, LOWER it
// to lift the desk. Bob is anchored to this below, so tuning baseY keeps his hands on the counter.
const COUNTER = {
  centerX: W * 0.57,   // ~730
  baseY:   H * 0.74,   // ~533 — desk bottom. Pulled OFF the back wall (was H*0.66, hugging the seam
                       // at 446): in this low top-down view, lower on screen = closer to the viewer,
                       // so ~87px of visible floor BEHIND the desk gives the scene a mid-ground and
                       // kills the "sticker on the wall" float.       <-- FLOOR-CONTACT DIAL
  width:   480,        // ON-SCREEN WIDTH IN PX                         <-- desk-size dial
  phHeight: 118,       // placeholder rect height (until the sprite loads)
  color:'#5b3a24', topColor:'#7a5233',
  shadowRx: 0.55,      // contact-shadow half-width as a fraction of `width` (0 disables the shadow)
  shadowRy: 13,        // contact-shadow half-height in px
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

// --- Portal — now the battle DOOR (ids stay 'portal'/'portal_glow'; internal ids never rename).
// Authored as 4 equal frames left-to-right: frame 0 = CLOSED ... frame 3 = fully OPEN. Drawn
// aspect-preserved at `size`, bottom resting on `baseY` (same anchor pattern as the counter/Bob).
// The door is EVENT-DRIVEN, not looping: it sits closed (frame 0) until a customer PAYS and leaves
// (main.js calls playPortalOpen on every successful serve, manual or auto), then plays a one-shot
// open -> brief hold ("they walk through") -> close, and settles closed again. Dismiss/leave do NOT
// open it — only paying customers go to battle.
// Fallback chain: strip -> static portal.png -> placeholder slab. Glow is alpha-aware and slight.
const PORTAL = {
  centerX: W * 0.855,          // ~1094 — horizontal center
  baseY:   FLOOR_Y + 6,            // door bottom sits exactly ON the wall/floor seam (y=446) — the door
                               // lives on the back wall, so it tracks the backdrop spec, not a guess.
  size:    320,                // ON-SCREEN HEIGHT IN PX. 320 = crisp 2x of 160px art (160 = 1x).
                               //        NOTE: set to your locally-tuned value if it differs.
  anim: { frames: 4, fps: 10, holdMs: 350 },  // open 0.4s -> hold 0.35s -> close 0.4s (~1.15s total)
  glowBase: 10,                // blur = glowBase + glowPulse * pulse(0..1) — the "slight" glow
  glowPulse: 8,
  glow:'#8b5cf6', frame:'#3a2b1a',
};
const portalAnim = { startMs: null };   // null = door closed/idle; a timestamp = one-shot in progress

// --- Door destinations: same door strip, different world through the opening (frame 0 is
// pixel-identical across all variants, so the closed door never pops between picks). Each PAID
// serve re-rolls where that customer is headed. Files are optional and independent: the picker
// only chooses among strips that actually loaded, so drop them in piecemeal — none loaded falls
// back to the base portal_glow.png (the original void), then static portal.png, then placeholder.
// Adding a biome later = author one strip + add its id here.
const DOOR_VARIANTS = ['portal_glow_mountain', 'portal_glow_forest', 'portal_glow_dungeon'];
let doorVariant = null;                 // strip id for the current opening; null = base strip
let lastVariant = null;                 // anti-repeat memory (same trick as the log-line picker)

function pickDoorVariant() {
  const ready = DOOR_VARIANTS.filter((id) => getSprite(id));   // only art that has actually loaded
  if (ready.length === 0) return null;
  let pick = ready[Math.floor(Math.random() * ready.length)];
  if (ready.length > 1 && pick === lastVariant) {              // one re-draw: never the same biome
    const others = ready.filter((id) => id !== pick);          // twice in a row
    pick = others[Math.floor(Math.random() * others.length)];
  }
  lastVariant = pick;
  return pick;
}

// Open the battle door (call on a successful SERVE — the customer paid and is leaving to fight).
// A serve mid-animation restarts it from frame 0, so rapid sales keep the door lively, never stuck.
export function playPortalOpen() {
  doorVariant = pickDoorVariant();       // this customer's destination, rolled at the moment of sale
  portalAnim.startMs = -1;               // sentinel: stamp with the real tMs on the next draw
}

// --- Purchase float: on a successful serve, the bought item's icon rises from the front-of-queue
// spot and fades — the moment-of-sale readout the log can't give at a glance. Purely cosmetic and
// transient (never saved). If the item sprite hasn't been dropped yet, the float silently skips —
// no placeholder box mid-air.
const FLOAT = {
  size: 32,          // ON-SCREEN PX — 64px art at clean 2:1, matching the shelf-card icons
  risePx: 46,        // how far the icon drifts up over its lifetime
  durMs: 900,        // lifetime; alpha fades linearly to 0 across it
  maxAlive: 8,       // hard cap — a maxed-Bob hot streak can't grow the list unbounded
};
const floaters = [];                     // { itemId, startMs } — x/y derive from QUEUE at draw time

// Queue a float for the just-purchased item (call alongside playBobServe/playPortalOpen).
export function spawnItemFloat(itemId) {
  if (!itemId) return;
  floaters.push({ itemId, startMs: -1 });          // stamped with real tMs on the next draw
  if (floaters.length > FLOAT.maxAlive) floaters.shift();
}

export function drawScene(ctx, state, tMs) {
  ctx.clearRect(0, 0, W, H);

  drawBackground(ctx);          // shop_bg.png if present, else flat wall + floor

  drawCounterShadow(ctx);       // contact shadow FIRST: grounds the desk AND Bob standing behind it
  drawBob(ctx, tMs);            // before the counter, so the counter front overlaps his lower body
  drawCounter(ctx);
  drawPortal(ctx, tMs);
  drawQueue(ctx, state, tMs);
  drawFloaters(ctx, tMs);       // purchase floats on top of everything — they're the payoff beat
}

// Rise-and-fade the queued purchase icons above the front-of-queue spot.
function drawFloaters(ctx, tMs) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    if (f.startMs === -1) f.startMs = tMs;                       // stamp freshly-spawned floats
    const age = tMs - f.startMs;
    if (age >= FLOAT.durMs) { floaters.splice(i, 1); continue; } // lifetime over -> gone
    const spr = getSprite(f.itemId);
    if (!spr) { floaters.splice(i, 1); continue; }               // no art yet -> skip silently
    const t = age / FLOAT.durMs;                                 // 0..1 progress
    const s = FLOAT.size;
    const x = QUEUE.frontX + QUEUE.size / 2 - s / 2;             // centered on the front mob's spot
    const y = QUEUE.y - s - t * FLOAT.risePx;                    // starts above the mob, drifts up
    ctx.save();
    ctx.globalAlpha = 1 - t;                                     // linear fade-out
    ctx.drawImage(spr, x, y, s, s);
    ctx.restore();
  }
}

// The grounding cue the queue mobs already have and the desk was missing: a soft ellipse pinned
// under the desk's base. Same COL.shadow as the mobs so the whole scene shares one light logic.
function drawCounterShadow(ctx) {
  if (!COUNTER.shadowRx) return;
  ctx.fillStyle = COL.shadow;
  ctx.beginPath();
  ctx.ellipse(COUNTER.centerX, COUNTER.baseY - 5, COUNTER.width * COUNTER.shadowRx, COUNTER.shadowRy, 0, 0, Math.PI * 2);
  ctx.fill();
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
    // Global dial x per-monster calibration (optional registry field, ?? 1 so new mobs need nothing).
    const h = size * QUEUE.spriteScale * (MONSTERS[monsterId]?.spriteScale ?? 1);
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
  // Variant strip for this opening if rolled+loaded, else the base (void) strip. The variant
  // persists while the door idles closed — harmless, since frame 0 is identical across strips.
  const strip = (doorVariant && getSprite(doorVariant)) || getSprite('portal_glow');
  if (strip) {
    const { frames, fps, holdMs } = PORTAL.anim;
    let frame = 0;                                               // default: door closed
    if (portalAnim.startMs === -1) portalAnim.startMs = tMs;     // stamp a freshly-triggered one-shot
    if (portalAnim.startMs !== null) {
      const t = tMs - portalAnim.startMs;
      const frameMs = 1000 / fps;
      const openDur = frames * frameMs;                          // 0 -> fully open
      if (t < openDur) {
        frame = Math.floor(t / frameMs);                         // opening: 0,1,2,3
      } else if (t < openDur + holdMs) {
        frame = frames - 1;                                      // held open: customer walks through
      } else if (t < openDur * 2 + holdMs) {
        frame = (frames - 1) - Math.floor((t - openDur - holdMs) / frameMs);  // closing: 3,2,1,0
      } else {
        portalAnim.startMs = null;                               // one-shot done -> settle closed
      }
      frame = Math.max(0, Math.min(frames - 1, frame));          // guard the boundaries
    }
    const fw = strip.naturalWidth / frames;                      // auto-sliced frame width
    const fh = strip.naturalHeight;
    const w = h * (fw / fh);                                     // preserve aspect
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