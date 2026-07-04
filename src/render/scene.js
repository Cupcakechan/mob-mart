// scene.js — canvas diorama. Every element draws its sprite if present (getSprite), else a
// placeholder, so art can drop in piecemeal without touching game logic. The blocks below are the
// tunable knobs: change a size/position here and reload to fit your sprites.
import { CONFIG } from '../config.js';
import { MONSTERS } from '../data/monsters.js';
import { ITEMS, ITEM_ORDER } from '../data/items.js';
import { sumEffect } from '../data/upgrades.js';
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
  portalAnim.holdLatch = 0;              // fresh one-shot -> re-derive the hold (see drawPortal)
}

// --- Wall shelves v2 (set dressing): the wall shelf is now PURE DECORATION — two staggered
// planks showing a random ROTATING SAMPLE of the unlocked item pool, so the wall stays readable
// even when the catalog someday outgrows what one plank can show. Changes from C-lite: the
// semi-transparent slot squares are GONE (goods sit straight on the plank), locked items no longer
// appear as dim teases (the greyed Shop card carries that job now), and slots swap with a short
// crossfade so a rotation reads as restocking, never a glitch. KEPT from C-lite: the per-item
// stock bar and the starved-glow — the front customer's out-of-stock want is force-swapped into
// view (shelf A, slot 0) so the gold breathe always has a home, keeping the attention system's
// canvas level intact. Still display only: no click region; SHOP opens the management panel.
// Optional art hook: drop assets/sprites/wall_shelf.png and BOTH planks use it (drawn into the
// plankBoxH band under the icons); absent, the code-drawn plank remains the fallback.
const WALL_SHELF = {
  shelves: [            // Shelf v3 (Daniel's pick): THREE rows on one common axis — a centered
    { x: 78, y: 38 },   // shelving UNIT, replacing v2's two staggered planks. x is the icon left
    { x: 78, y: 134 },  // (plank extends plankPad past it: plank spans x60..372); y is the icon TOP.
    { x: 78, y: 230 },  // Band math: row height = 48+2+30+6+4 = 90, 6px between rows -> bottoms at
                        // 128 / 224 / 320. Ceiling is the speech bubble's box top, MEASURED from
                        // drawBubble: tip 407-18-4(bob) - tail 11 - body 51 = y322 worst case over
                        // x270..450 — the unit clears it by 2px. Queue heads (~y394) sit below.
  ],
  slotsPerShelf: 4,     // display capacity per plank — the sample size, NOT the catalog size.
                        // NOTE: 12 slots vs today's 3-6 item catalog = repeats across rows
                        // (shared-pool dilution, expected for set dressing; variety returns as
                        // the catalog grows).
  slotStep: 76,         // horizontal spacing between slots (keeps the 28px visual gap at 48px icons)
  iconSize: 48,         // 64px art at x0.75 — non-integer, minor crunch accepted post-crisp-canvas
                        // (Option 3 of the crispness plan — native-size re-export — removes it)
  plankPad: 18,         // plank extends this far past the outer icons each side (plank w = 312)
  plankBoxH: 30,        // vertical band reserved for the plank — art OR code-drawn fills it
  rotateSec: 45,        // one shelf re-rolls its sample this often (shelves take turns)
  crossfadeMs: 300,     // per-slot swap fade; 0 = instant
  barW: 48, barH: 4,    // stock bar under the plank band (tracks iconSize)
  barGapY: 6,           // gap between plank band bottom and the bar
  wiggle: {             // Shelf motion (Daniel's pick, Option 2 of 3): items rest still; every
    intervalMs: 4000,   // intervalMs ONE random displayed item plays a brief hop-and-settle.
    durMs: 800,         // Scarce on purpose — occasional motion draws the eye where a constant
    hopPx: 4,           // bob numbs it, and resting goods stay ON the plank (the grounding
    squash: 0.12,       // pass's rule extends to set dressing: nothing levitates).
  },
  propId: 'wall_shelf', // optional authored plank sprite (see the art spec / handoff §9)
  plank: '#5b3a24', plankEdge: '#3a2415',
  barFill: '#ffcf4a', barEmpty: '#b3402e', glow: '#ffcf4a',
};

// Ephemeral presentation state — like the log picker and the floaters, never saved.
// slots[shelfIdx][slotIdx] = { itemId, prevId, fadeStart } (itemId null = empty plank space).
const shelfDress = { slots: null, nextRotateMs: -1, rotateIdx: 0, poolSig: '' };

// Items allowed on the wall: unlicensed rows never appear (same gate as spawn wants / restock).
function unlockedPool(state) {
  return ITEM_ORDER.filter((id) => !ITEMS[id]?.license || state.licenses?.[id] === true);
}

// Pure sampler (exported for the headless suite): pick up to `count` ids from `pool`, no
// duplicates within the result, PREFERRING ids not in `avoid` (the other shelf's goods) and
// topping up from `avoid` only when the pool is too small to fill the shelf otherwise — so a big
// catalog spreads variety across planks, while today's small one still fills both. Order is part
// of the sample: even when every item is on display, a re-roll visibly rearranges the goods.
export function sampleShelf(pool, count, avoid = [], rand = Math.random) {
  const shuffle = (arr) => {                     // Fisher-Yates on a copy
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const fresh = shuffle(pool.filter((id) => !avoid.includes(id)));
  const reused = shuffle(pool.filter((id) => avoid.includes(id)));
  return fresh.concat(reused).slice(0, count);   // may be SHORTER than count — pad happens at slot level
}

// Write a sample into a shelf's slots, starting a crossfade only where the item actually changed.
function dressShelf(shelfIdx, ids, tMs) {
  const row = shelfDress.slots[shelfIdx];
  for (let s = 0; s < WALL_SHELF.slotsPerShelf; s++) {
    const id = ids[s] ?? null;                   // sample shorter than capacity -> empty slot
    if (row[s].itemId === id) continue;
    row[s] = { itemId: id, prevId: row[s].itemId, fadeStart: tMs };
  }
}

function currentIds(shelfIdx) {
  return shelfDress.slots[shelfIdx].map((sl) => sl.itemId).filter((id) => id !== null);
}

// Shelf-wiggle state (ephemeral): which slot is mid-hop, and when the next one fires.
const shelfWiggle = { shelf: -1, slot: -1, startMs: 0, nextAtMs: 0 };

function drawWallShelf(ctx, state, tMs) {
  const nShelves = WALL_SHELF.shelves.length;

  // (Re)dress everything when the unlocked pool changes — boot, and the instant a license is
  // bought (the new good crossfades onto the wall: a free visual payoff, no event wiring needed).
  const pool = unlockedPool(state);
  const sig = pool.join(',');
  if (shelfDress.slots === null || sig !== shelfDress.poolSig) {
    if (shelfDress.slots === null) {
      shelfDress.slots = WALL_SHELF.shelves.map(() =>
        Array.from({ length: WALL_SHELF.slotsPerShelf }, () => ({ itemId: null, prevId: null, fadeStart: 0 })));
    }
    shelfDress.poolSig = sig;
    let placed = [];
    for (let i = 0; i < nShelves; i++) {
      const ids = sampleShelf(pool, WALL_SHELF.slotsPerShelf, placed);
      dressShelf(i, ids, tMs);
      placed = placed.concat(ids);
    }
    shelfDress.nextRotateMs = tMs + WALL_SHELF.rotateSec * 1000;
  }

  // Slow rotation: one shelf re-rolls per tick, alternating — with the log picker's anti-repeat
  // (one re-draw if the new arrangement matches the old exactly; identical is possible but rare).
  if (tMs >= shelfDress.nextRotateMs) {
    const i = shelfDress.rotateIdx % nShelves;
    const avoid = currentIds((i + 1) % nShelves);
    let ids = sampleShelf(pool, WALL_SHELF.slotsPerShelf, avoid);
    if (pool.length > 1 && ids.join(',') === currentIds(i).join(',')) {
      ids = sampleShelf(pool, WALL_SHELF.slotsPerShelf, avoid);
    }
    dressShelf(i, ids, tMs);
    shelfDress.rotateIdx++;
    shelfDress.nextRotateMs = tMs + WALL_SHELF.rotateSec * 1000;
  }

  // Starved force-include: if the front customer's want is unlocked, dry, and NOT on display,
  // swap it into shelf A slot 0 so the attention glow is always visible. Self-idempotent — once
  // displayed, the "not on display" test fails, so this fires once per starvation, not per frame.
  const front = state.queue[0];
  const starvedId = (front && pool.includes(front.wantedItemId)
    && (state.items[front.wantedItemId]?.stock ?? 0) <= 0) ? front.wantedItemId : null;
  if (starvedId && !shelfDress.slots.some((row) => row.some((sl) => sl.itemId === starvedId))) {
    const row = shelfDress.slots[0];
    row[0] = { itemId: starvedId, prevId: row[0].itemId, fadeStart: tMs };
  }
  const pulse = 0.5 + 0.5 * Math.sin(tMs / 500);

  // Wiggle scheduler: one displayed slot at a time, re-picked every intervalMs. Stale indices are
  // harmless (rotation may swap the item mid-wiggle — whatever is there now wiggles; a slot gone
  // empty simply skips the transform). Ephemeral render state, never saved.
  if (tMs >= shelfWiggle.nextAtMs) {
    const candidates = [];
    shelfDress.slots.forEach((row, ri) =>
      row.forEach((sl, si) => { if (sl.itemId !== null) candidates.push([ri, si]); }));
    if (candidates.length > 0) {
      const [ri, si] = candidates[Math.floor(Math.random() * candidates.length)];
      shelfWiggle.shelf = ri; shelfWiggle.slot = si; shelfWiggle.startMs = tMs;
    }
    shelfWiggle.nextAtMs = tMs + WALL_SHELF.wiggle.intervalMs;
  }

  ctx.save();
  for (let i = 0; i < nShelves; i++) {
    const sh = WALL_SHELF.shelves[i];
    const plankLeft = sh.x - WALL_SHELF.plankPad;
    const plankW = (WALL_SHELF.slotsPerShelf - 1) * WALL_SHELF.slotStep
      + WALL_SHELF.iconSize + 2 * WALL_SHELF.plankPad;
    const plankY = sh.y + WALL_SHELF.iconSize + 2;

    const prop = getSprite(WALL_SHELF.propId);       // authored plank art, if it ever lands
    if (prop) {
      ctx.drawImage(prop, plankLeft, plankY, plankW, WALL_SHELF.plankBoxH);
    } else {                                          // code-drawn fallback (the C-lite plank)
      ctx.fillStyle = WALL_SHELF.plank;
      ctx.fillRect(plankLeft, plankY, plankW, 8);
      ctx.fillStyle = WALL_SHELF.plankEdge;
      ctx.fillRect(plankLeft, plankY + 8, plankW, 3);
      ctx.fillRect(plankLeft + 8, plankY + 11, 6, 7);            // two bracket nubs
      ctx.fillRect(plankLeft + plankW - 14, plankY + 11, 6, 7);
    }

    for (let s = 0; s < WALL_SHELF.slotsPerShelf; s++) {
      const slot = shelfDress.slots[i][s];
      if (slot.itemId === null && slot.prevId === null) continue;   // truly empty plank space
      const x = sh.x + s * WALL_SHELF.slotStep;
      const t = WALL_SHELF.crossfadeMs > 0
        ? Math.min(1, (tMs - slot.fadeStart) / WALL_SHELF.crossfadeMs) : 1;
      if (t >= 1) slot.prevId = null;                 // fade done — drop the outgoing icon

      if (slot.prevId !== null) {                     // outgoing icon fades away underneath
        const prevSpr = getSprite(slot.prevId);
        if (prevSpr) {
          ctx.globalAlpha = 1 - t;
          ctx.drawImage(prevSpr, x, sh.y, WALL_SHELF.iconSize, WALL_SHELF.iconSize);
          ctx.globalAlpha = 1;
        }
      }
      if (slot.itemId !== null) {
        ctx.save();
        if (slot.itemId === starvedId) {              // gold breathe on the blocked good
          ctx.shadowColor = WALL_SHELF.glow;
          ctx.shadowBlur = 8 + 10 * pulse;
        }
        const spr = getSprite(slot.itemId);
        if (spr) {
          ctx.globalAlpha = t;
          // Wiggle transform: airborne through 70% of the clip, landing squash (width compensates)
          // through the last 30% — the celebrant hop's language at shelf scale. Bottom-ANCHORED so
          // the item visibly leaves and returns to the plank; when idle (sx=sy=1, lift=0) this
          // reduces to exactly the old top-left blit.
          let lift = 0, sx = 1, sy = 1;
          if (i === shelfWiggle.shelf && s === shelfWiggle.slot) {
            const p = (tMs - shelfWiggle.startMs) / WALL_SHELF.wiggle.durMs;
            if (p >= 0 && p < 1) {
              if (p < 0.7) {
                lift = Math.sin(Math.PI * (p / 0.7)) * WALL_SHELF.wiggle.hopPx;
              } else {
                const k = Math.sin(Math.PI * ((p - 0.7) / 0.3)) * WALL_SHELF.wiggle.squash;
                sy = 1 - k; sx = 1 + k * 0.7;
              }
            }
          }
          const w = WALL_SHELF.iconSize * sx, hgt = WALL_SHELF.iconSize * sy;
          ctx.drawImage(spr, x + (WALL_SHELF.iconSize - w) / 2,
            sh.y + (WALL_SHELF.iconSize - hgt) - lift, w, hgt);
          ctx.globalAlpha = 1;
        }
        ctx.restore();

        // Stock bar: gold fill, red when dry — same readout as C-lite, one per DISPLAYED item.
        const max = (ITEMS[slot.itemId]?.maxStock ?? 0) + sumEffect(state, 'maxStock');
        const stock = state.items[slot.itemId]?.stock ?? 0;
        const frac = max > 0 ? Math.min(1, stock / max) : 0;
        const bx = x + (WALL_SHELF.iconSize - WALL_SHELF.barW) / 2;
        const by = plankY + WALL_SHELF.plankBoxH + WALL_SHELF.barGapY;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(bx, by, WALL_SHELF.barW, WALL_SHELF.barH);
        ctx.fillStyle = frac > 0 ? WALL_SHELF.barFill : WALL_SHELF.barEmpty;
        ctx.fillRect(bx, by, Math.max(2, Math.round(WALL_SHELF.barW * frac)), WALL_SHELF.barH);
      }
    }
  }
  ctx.restore();
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

  drawWallShelf(ctx, state, tMs);  // goods on the wall (diegetic shelf, C-lite — display only)
  drawCounterShadow(ctx);       // contact shadow FIRST: grounds the desk AND Bob standing behind it
  drawBob(ctx, tMs);            // before the counter, so the counter front overlaps his lower body
  drawCounter(ctx);
  drawPortal(ctx, tMs);
  drawQueue(ctx, state, tMs);
  drawCelebrants(ctx, tMs);     // served-mob ghosts: hop at the counter, then march into the door
  drawBubble(ctx, state, tMs);  // front customer's ask, pinned to the asker (hybrid stage 2)
  drawFloaters(ctx, tMs);       // purchase floats on top of everything — they're the payoff beat
}

// --- Speech bubble: the front customer's name/want/budget, drawn above them on the canvas. The
// INFO-ONLY variant of the hybrid plan — Serve/Send Away stay as DOM buttons in the bottom bar.
// Replaces both the panel's info lines AND the old gold chevron (the bubble itself marks the front
// mob now). Width is measured from the text each frame; the tail bobs in phase with the mob.
// A purchase float briefly crosses the bubble on a serve — deliberate, it fades in 0.9s.
// The bubble is PURE CHARACTER VOICE: no system text. The blocked-sale signal (out of stock)
// lives in the shelf-card + Shop-tab attention pulse (panels.js/nav.js) — where the fix is.
const BUBBLE = {
  tipGapY: 18,        // gap between the mob box top (QUEUE.y) and the tail tip — clears 1.15-scaled heads
  padX: 12, padY: 9,  // inner padding
  lineGap: 5,         // vertical gap between text lines
  radius: 9,          // corner rounding
  tailW: 16, tailH: 11,
  nameFont: "700 15px 'Segoe UI', system-ui, sans-serif",  // mirrors --font in style.css
  lineFont: "600 13px 'Segoe UI', system-ui, sans-serif",
  bg: 'rgba(31,23,43,0.93)',   // same family as the DOM panels
  border: '#4b3a63',
  name: '#ffcf4a',             // gold, matching panel titles
  text: '#f4eede',
};

function drawBubble(ctx, state, tMs) {
  const c = state.queue[0];
  if (!c) return;
  const name = MONSTERS[c.monsterId]?.displayName ?? '???';
  const item = ITEMS[c.wantedItemId];
  const want = `wants ${item?.displayName ?? '???'} \u25C6 ${c.budget}`;

  ctx.save();
  ctx.font = BUBBLE.nameFont;
  let textW = ctx.measureText(name).width;
  ctx.font = BUBBLE.lineFont;
  textW = Math.max(textW, ctx.measureText(want).width);

  const w = Math.ceil(textW) + BUBBLE.padX * 2;
  const h = BUBBLE.padY * 2 + 15 + BUBBLE.lineGap + 13;
  // Grounding cleanup: the bubble bobs IN PHASE with the front mob — which, since the grounding
  // pass, only bobs when `flying`. Same gate here, or the bubble hovers over a stationary Slimey.
  const flying = MONSTERS[c.monsterId]?.flying ?? false;
  const bob = flying ? Math.sin(tMs / 300 + QUEUE.frontX) * 4 : 0;   // same phase as drawMob's front slot
  const cx = QUEUE.frontX + QUEUE.size / 2;
  const tipY = QUEUE.y - BUBBLE.tipGapY + bob;
  const x = Math.max(8, Math.min(W - w - 8, cx - w / 2));        // clamp inside the stage
  const y = tipY - BUBBLE.tailH - h;

  ctx.beginPath();                                               // rounded body + tail, one path
  ctx.roundRect(x, y, w, h, BUBBLE.radius);
  ctx.moveTo(cx - BUBBLE.tailW / 2, tipY - BUBBLE.tailH);
  ctx.lineTo(cx, tipY);
  ctx.lineTo(cx + BUBBLE.tailW / 2, tipY - BUBBLE.tailH);
  ctx.closePath();
  ctx.fillStyle = BUBBLE.bg;     ctx.fill();
  ctx.strokeStyle = BUBBLE.border; ctx.lineWidth = 2; ctx.stroke();

  ctx.textBaseline = 'top';
  ctx.font = BUBBLE.nameFont; ctx.fillStyle = BUBBLE.name;
  ctx.fillText(name, x + BUBBLE.padX, y + BUBBLE.padY);
  ctx.font = BUBBLE.lineFont; ctx.fillStyle = BUBBLE.text;
  ctx.fillText(want, x + BUBBLE.padX, y + BUBBLE.padY + 15 + BUBBLE.lineGap);
  ctx.restore();
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
  const m = MONSTERS[monsterId];
  // Grounding pass: the idle hover bob is a FLYER behavior (registry `flying`, ?? false) — a slime
  // gently rising and falling reads as levitation. Grounded mobs sit still; their motion arrives
  // with the idle strips. The serve celebration's hop is untouched (drawCelebrants has its own math).
  const flying = m?.flying ?? false;
  const bob = flying ? Math.sin(tMs / 300 + x) * 4 : 0;   // +x so flyers don't bob in lockstep
  const groundY = y + size - 4;                     // shadow stays on the ground while the mob hops

  ctx.fillStyle = COL.shadow;
  ctx.beginPath();
  ctx.ellipse(x + size / 2, groundY, size * 0.42, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sprite chain (all registry-driven, all optional): <id>_idle.png strip if the monster declares
  // an `anim` field AND the strip loaded -> static <id>.png -> colored placeholder rect. Strips are
  // horizontal, equal-width frames, auto-sliced by the declared frame count (Bob's convention).
  const anim = m?.anim;
  const strip = anim ? getSprite(`${monsterId}_idle`) : null;
  const spr = strip ?? getSprite(monsterId);
  if (spr) {
    // Global dial x per-monster calibration (optional registry field, ?? 1 so new mobs need nothing).
    const h = size * QUEUE.spriteScale * (m?.spriteScale ?? 1);
    if (strip) {
      // +x*37ms phase offset so two Battys in line don't flap in lockstep (same trick as the hop).
      const frame = Math.floor((tMs + x * 37) / (1000 / anim.fps)) % anim.frames;
      const fw = strip.naturalWidth / anim.frames;
      const fh = strip.naturalHeight;
      const w = h * (fw / fh);
      // footPad (registry, MEASURED art-space rows below the feet, ?? 0): shift the draw DOWN so
      // the art's real feet — not the transparent padding — meet the shadow line. The overflow is
      // transparent rows sinking invisibly below the floor. Trimmed art later -> field goes to 0.
      const pad = (m?.footPad ?? 0) * (h / fh);
      ctx.drawImage(strip, frame * fw, 0, fw, fh, x + size / 2 - w / 2, (y + size) - h + bob + pad, w, h);
    } else {
      const w = h * (spr.naturalWidth / spr.naturalHeight);   // preserve aspect at target height
      const pad = (m?.footPad ?? 0) * (h / spr.naturalHeight);
      ctx.drawImage(spr, x + size / 2 - w / 2, (y + size) - h + bob + pad, w, h);  // anchored feet
    }
  } else {
    const my = y + bob;
    ctx.fillStyle = colorFor(monsterId);
    ctx.fillRect(x, my, size, size);
    ctx.fillStyle = COL.face;
    ctx.fillRect(x + size * 0.28, my + size * 0.35, size * 0.09, size * 0.09);
    ctx.fillRect(x + size * 0.60, my + size * 0.35, size * 0.09, size * 0.09);
  }

  // (The old gold front-marker chevron was retired when the speech bubble arrived — the bubble's
  // tail points at the front mob, doing the same job with more information.)
}

// --- Serve celebration (react pass): a PAID serve spawns a render-side "celebrant" — a ghost of
// the just-served mob (game state already shifted; zero economy impact) that does a happy double
// hop at the counter, then marches right and walks THROUGH the battle door, fading at the
// threshold while the door's hold phase stretches to cover its arrival (see drawPortal). The mob
// buying, celebrating, and marching off to lose is the game's core joke made visible.
// Art chain during the walk: <id>_walk_happy.png strip (4 equal-width frames, auto-sliced — same
// convention as <id>_idle.png) -> idle strip if declared -> static <id>.png -> placeholder rect.
// The hop phase is fully code-driven (squash-and-stretch), so every mob celebrates with NO art.
const CELEBRATE = {
  hopMs: 700,          // celebrate-in-place duration
  hops: 2,             // full hops inside hopMs
  hopHeight: 16,       // px of air per hop
  squash: 0.12,        // squash-and-stretch amount at landing (0 = rigid)
  nudgeX: 70,          // instant-ish sidestep toward the door, so the next-in-line's snap-forward
  nudgeMs: 150,        //   into the front slot never overlaps the celebrant
  walkSpeed: 650,      // px/s toward the door (~1.0s for the ~660px run)
  walkAnim: { frames: 4, fps: 8 },  // shared happy-walk contract (per-monster override: walkHappy field)
  sinkMs: 250,         // easing time from the QUEUE's foot plane down onto the COUNTER's contact
                       //   plane at walk start — the march runs IN FRONT of the desk, so feet belong
                       //   on the plane the desk stands on (COUNTER.baseY), not the queue's (~38px
                       //   higher/behind, which read as walking on a ledge up the counter's face)
  enterMs: 450,        // ENTER leg: time to turn at the doorway and walk up-screen INTO the portal
                       //   (feet: counter plane -> door base on the wall plane), fading out en route
  enterFadeFrom: 0.4,  // fraction of the enter leg that plays fully opaque before the fade starts —
                       //   the turn should be SEEN; only the last stretch dissolves into the doorway
  depthScale: 0.85,    // size multiplier at the end of the ENTER leg — the mob is genuinely receding
                       //   to the wall plane there, so the shrink reads as depth (it was disabled
                       //   while the march faded at floor level, where it read as just shrinking)
  arriveBufferMs: 150, // door stays held this long past the last celebrant's fade-out
  max: 4,              // rapid worker serves cap the parade; oldest is dropped
};
const celebrants = [];   // ephemeral, never saved: { monsterId, startMs (-1 until first draw) }

// Battle-report timing: main.js registers a callback here; drawCelebrants fires it the frame a
// celebrant finishes entering the door. Kept as a callback so render code never imports game state.
let celebrantEnteredCb = null;
export function setCelebrantEnteredCallback(cb) { celebrantEnteredCb = cb; }

export function spawnCelebrant(monsterId) {
  if (!monsterId) return;                          // guard: serve raced an empty queue
  if (celebrants.length >= CELEBRATE.max) celebrants.shift();
  celebrants.push({ monsterId, startMs: -1 });     // -1 sentinel: stamped on the next draw (Bob's pattern)
}

// Walk geometry is fixed (front slot -> door center), so the walk duration is a constant.
function celebrantWalkMs() {
  const startX = QUEUE.frontX + CELEBRATE.nudgeX;
  const doorX = PORTAL.centerX - QUEUE.size / 2;   // left edge such that mob CENTER meets door center
  return ((doorX - startX) / CELEBRATE.walkSpeed) * 1000;
}

// The door needs to stay open until the last celebrant has finished ENTERING it (+ buffer).
// Returns the latest still-needed "door open until" time, or -Infinity when nobody's en route.
function celebrantsNeedDoorUntil() {
  let until = -Infinity;
  for (const c of celebrants) {
    if (c.startMs === -1) continue;                // not yet stamped — covered on the next frame
    until = Math.max(until, c.startMs + CELEBRATE.hopMs + celebrantWalkMs()
                            + CELEBRATE.enterMs + CELEBRATE.arriveBufferMs);
  }
  return until;
}

function drawCelebrants(ctx, tMs) {
  const C = CELEBRATE;
  const size = QUEUE.size;
  const startX = QUEUE.frontX + C.nudgeX;
  const doorX = PORTAL.centerX - size / 2;
  const walkMs = celebrantWalkMs();
  const homeFeetY = QUEUE.y + size;                // the queue's floor plane

  for (let i = celebrants.length - 1; i >= 0; i--) {
    const c = celebrants[i];
    if (c.startMs === -1) c.startMs = tMs;
    const t = tMs - c.startMs;
    if (t > C.hopMs + walkMs + C.enterMs) {
      celebrants.splice(i, 1);
      // Door-entry event (battle-report timing pass): the celebrant is fully through the door —
      // tell the game so the pending battle report lands NOW. Render->game is callback-only
      // (main.js wires it); scene never touches state directly. Fired once per despawn.
      celebrantEnteredCb?.();
      continue;
    }

    // Phase math -> position, air, squash, depth, alpha. Three phases:
    //   HOP   celebrate in place at the old front slot
    //   WALK  march right, in front of the desk, feet on the counter's floor-contact plane
    //   ENTER turn at the doorway and walk UP-SCREEN into the portal (counter plane -> door base),
    //         shrinking for depth and fading out — the walk cycle keeps playing through the turn
    let x, feetY = homeFeetY, scale = 1, alpha = 1, air = 0, land = 0, walkT = -1;
    if (t < C.hopMs) {                             // HOP: sidestep in, then bounce in place
      x = QUEUE.frontX + Math.min(1, t / C.nudgeMs) * C.nudgeX;
      const arc = Math.abs(Math.sin((t / C.hopMs) * Math.PI * C.hops));
      air = -C.hopHeight * arc;
      land = 1 - arc;                              // 1 at touchdown -> full squash exactly on landing
    } else if (t < C.hopMs + walkMs) {             // WALK: feet ease down onto the counter's contact
      walkT = t - C.hopMs;                         // plane (tracks the COUNTER.baseY dial), then hold
      const wf = walkT / walkMs;                   // it all the way to the doorway — no fade here
      x = startX + (doorX - startX) * wf;
      const sink = Math.min(1, walkT / C.sinkMs);
      feetY = homeFeetY + (COUNTER.baseY - homeFeetY) * sink;
    } else {                                       // ENTER: x holds at the door center; feet climb to
      walkT = t - C.hopMs;                         // the door's base on the wall plane
      const ef = (t - C.hopMs - walkMs) / C.enterMs;
      x = doorX;
      feetY = COUNTER.baseY + (PORTAL.baseY - COUNTER.baseY) * ef;
      scale = 1 + (C.depthScale - 1) * ef;
      alpha = ef < C.enterFadeFrom ? 1 : 1 - (ef - C.enterFadeFrom) / (1 - C.enterFadeFrom);
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    // Shadow first, ON THE GROUND — it squashes with the depth scale but never lifts with the hop
    // (same grounding rule as drawMob: the shadow is what sells the air).
    ctx.fillStyle = COL.shadow;
    ctx.beginPath();
    ctx.ellipse(x + size / 2, feetY - 4, size * 0.42 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sprite chain, squash-and-stretch applied about the feet anchor so it reads ground-planted.
    const m = MONSTERS[c.monsterId];
    const h = size * QUEUE.spriteScale * (m?.spriteScale ?? 1) * scale;
    const sx = 1 + land * C.squash * 0.6;          // widen on landing...
    const sy = 1 - land * C.squash;                // ...while flattening — classic squash
    const cxA = x + size / 2, cyA = feetY;         // anchor: feet center
    ctx.translate(cxA, cyA + air);
    ctx.scale(sx, sy);
    ctx.translate(-cxA, -cyA);

    const wa = m?.walkHappy ?? C.walkAnim;
    const walkStrip = walkT >= 0 ? getSprite(`${c.monsterId}_walk_happy`) : null;
    const idleAnim = m?.anim;
    const idleStrip = idleAnim ? getSprite(`${c.monsterId}_idle`) : null;
    const strip = walkStrip ?? idleStrip;
    const anim = walkStrip ? wa : idleAnim;
    const spr = strip ?? getSprite(c.monsterId);
    if (spr) {
      if (strip) {
        const clock = walkStrip ? walkT : t;       // walk strip steps from the walk's own t=0
        const frame = Math.floor(clock / (1000 / anim.fps)) % anim.frames;
        const fw = strip.naturalWidth / anim.frames;
        const fh = strip.naturalHeight;
        const w = h * (fw / fh);
        // Same grounding rule as drawMob: footPad (?? 0) drops the art's real feet onto feetY, so
        // the march reads planted on the counter plane instead of hovering above it.
        const pad = (m?.footPad ?? 0) * (h / fh);
        ctx.drawImage(strip, frame * fw, 0, fw, fh, x + size / 2 - w / 2, feetY - h + pad, w, h);
      } else {
        const w = h * (spr.naturalWidth / spr.naturalHeight);
        const pad = (m?.footPad ?? 0) * (h / spr.naturalHeight);
        ctx.drawImage(spr, x + size / 2 - w / 2, feetY - h + pad, w, h);
      }
    } else {                                       // last resort: the same placeholder rect language
      ctx.fillStyle = colorFor(c.monsterId);
      ctx.fillRect(x, feetY - size, size, size);
    }
    ctx.restore();
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
      // The hold stretches while celebrants are marching: the door must not close in a mob's face.
      // LATCHED (never shrinks within one one-shot): when the last celebrant despawns its
      // contribution vanishes, and an unlatched hold would snap back to base mid-cycle — teleporting
      // the close-phase math forward and slamming the door shut with no animation.
      const needUntil = celebrantsNeedDoorUntil();               // absolute tMs, or -Infinity
      portalAnim.holdLatch = Math.max(portalAnim.holdLatch ?? holdMs,
                                      holdMs, needUntil - portalAnim.startMs - openDur);
      const holdEff = portalAnim.holdLatch;
      if (t < openDur) {
        frame = Math.floor(t / frameMs);                         // opening: 0,1,2,3
      } else if (t < openDur + holdEff) {
        frame = frames - 1;                                      // held open: customer walks through
      } else if (t < openDur * 2 + holdEff) {
        frame = (frames - 1) - Math.floor((t - openDur - holdEff) / frameMs);  // closing: 3,2,1,0
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