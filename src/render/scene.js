// scene.js — canvas diorama. Every element draws its sprite if present (getSprite), else a
// placeholder, so art can drop in piecemeal without touching game logic. The blocks below are the
// tunable knobs: change a size/position here and reload to fit your sprites.
import { CONFIG } from '../config.js';
import { MONSTERS } from '../data/monsters.js';
import { ITEMS, ITEM_ORDER } from '../data/items.js';
import { MARKET_EVENTS, boardQuipFor } from '../data/marketevents.js';   // Special-of-the-Day board (leaf, no cycle)
import { sumEffect } from '../data/upgrades.js';
import { WORKERS } from '../data/workers.js';   // Doug's scavenge clock (leaf data module, no cycle)
import { RELICS, RELIC_ORDER } from '../data/relics.js';   // the display (§14 Pass B)
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
  feetY:   COUNTER.baseY - 82, // BOB LIFT DIAL (bigger = higher). Window 78-119 (pngjs-measured): below 78 his
                               // hands (rows 89-119) clip behind the desk edge (y414); above 119 the chest bottom
                               // peeks over. 82 -> hands rest just above the desk, whole face + arms + chest show.
  height:  160,                // ON-SCREEN HEIGHT — drawn 1:1 (bob_idle is 160px/frame); no upscale = crisp.
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
const DOOR_VARIANTS = ['portal_glow_mountain', 'portal_glow_forest', 'portal_glow_dungeon',
  'portal_glow_desert', 'portal_glow_tavern', 'portal_glow_castle'];  // +3 (2026-07-08); pickDoorVariant rolls random, anti-repeat
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

// --- "Special of the Day" board (Daniel's art + idea, 2026-07-07 — Market Day's comedy home) ---
// Authored: assets/sprites/special_board.png, 640x220 (MEASURED at integration: opaque bbox
// x3..636 y3..218, transparent plank-end corners, face RGB 170,106,55 — hence the CREAM ink).
// Drawn at `width` with aspect preserved, flush-mounted on the wall above Bob (a hanging-hardware
// art revision later needs zero code). The header is CODE-DRAWN for now: if Daniel letters the
// art, flip `drawHeader` to false — a one-value swap. The quip is DETERMINISTIC per (day, event)
// via boardQuipFor — the sign is chalked once each morning, not re-rolled per reload. Fallback:
// a code plank (wall_shelf family) so the board renders even without the PNG.
const SPECIAL_BOARD = {
  centerX: W * 0.57,    // = BOB.centerX (~730): the merchant stands under his own sign
  topY: 136,            // hung ~45px above the lifted Bob's head (y291) — the "sign over the merchant" gap.
                        // Clears the HUD (bottom ~62) and the fame panel (top 96). Re-tune if you change BOB.feetY.
  width: 320,           // display width -> the 640 art lands at a clean x0.5
  drawHeader: true,     // "SPECIAL OF THE DAY" in code; false once the art carries lettering
  header: 'SPECIAL OF THE DAY',
  headerFont: "800 13px 'Segoe UI', system-ui, sans-serif",   // mirrors BUBBLE's family
  nameFont:   "800 14px 'Segoe UI', system-ui, sans-serif",
  quipFont:   "700 14px 'Segoe UI', system-ui, sans-serif",
  headerColor: '#f6e7c8', nameColor: '#ffcf4a', quipColor: '#f6e7c8',
  shade: 'rgba(0,0,0,.35)',   // 1px offset under every glyph — legibility over the wood grain
  padX: 14,                   // text inset from the board's side edges
  headerY: 13, nameY: 37, quipY: 61,  // line TOPS, from the board's top (110-tall display box)
  quipLineH: 19, maxQuipLines: 2,     // quips are authored <=48 chars -> two 14px lines always fit
  plank: '#8a5a30', plankEdge: '#5b3a24',   // fallback colors (wall_shelf family)
  // Life pass (Option 2, Daniel 2026-07-07) — BOTH motions are event-driven on purpose (the
  // shelf-wiggle law: occasional motion draws the eye, constant motion numbs it):
  chalk: { durMs: 1200 },     // morning write-on: name + quip reveal char-by-char over this span.
                              // Plays on a FRESH market day only (crate moment), deferred until
                              // the shop screen is actually visible (main.js gates the trigger) —
                              // same-day reloads show the sign already written, as the fiction says.
  thump: { durMs: 600, amp: 3, swings: 3, cooldownSec: 25 },  // door-slam shudder: a decaying
                              // x-rattle when a celebrant enters the portal. amp 0 = kill switch;
                              // the cooldown keeps maxed-Bob throughput (~2.5s serves) from
                              // turning a beat into wallpaper.
};

// One-shot presentation state (never saved — the render layer's usual ephemera).
const boardFx = { chalkStartMs: 0, lastThumpMs: -1e9 };

// The morning chalk one-shot. -1 sentinel: stamped with the real tMs on the next draw, the
// portalAnim pattern — callers don't need a clock.
export function playBoardChalk() { boardFx.chalkStartMs = -1; }

// Door-slam shudder, cooldown-gated at the trigger so the dial lives with the effect.
function thumpSpecialBoard(tMs) {
  if (tMs - boardFx.lastThumpMs < SPECIAL_BOARD.thump.cooldownSec * 1000) return;
  boardFx.lastThumpMs = tMs;
}

// Greedy word-wrap into at most maxLines; a too-long tail ellipsizes on the last line. Guards a
// future long quip — today's authored pool (<=48 chars) never trips the ellipsis.
function wrapBoardText(ctx, text, maxW, maxLines) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= maxW || cur === '') { cur = next; continue; }
    lines.push(cur);
    cur = words[i];
    if (lines.length === maxLines - 1) {                    // last line: take the rest, ellipsize to fit
      cur = words.slice(i).join(' ');
      while (cur.length > 1 && ctx.measureText(`${cur}\u2026`).width > maxW) cur = cur.slice(0, -1);
      if (i < words.length) { lines.push(ctx.measureText(cur).width > maxW ? `${cur}\u2026` : cur); }
      return lines;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawSpecialBoard(ctx, state, tMs) {
  const B = SPECIAL_BOARD;
  // Door-slam shudder: a decaying sine on x — a flush-mounted board RATTLES (translate), it
  // doesn't swing (rotate would claim hanging hardware the art doesn't show). Costs nothing
  // when idle: past durMs the offset is exactly 0.
  let shakeX = 0;
  const st = tMs - boardFx.lastThumpMs;
  if (st >= 0 && st < B.thump.durMs && B.thump.amp > 0) {
    const p = st / B.thump.durMs;
    shakeX = Math.sin(p * Math.PI * 2 * B.thump.swings) * B.thump.amp * (1 - p);
  }

  const spr = getSprite('special_board');
  const w = B.width;
  const h = spr ? Math.round(w * (spr.height / spr.width)) : 110;
  const x = Math.round(B.centerX - w / 2 + shakeX), y = B.topY;
  if (spr) {
    ctx.drawImage(spr, x, y, w, h);
  } else {                                                  // pre-art fallback: one framed plank
    ctx.fillStyle = B.plank;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = B.plankEdge; ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  }

  // Morning chalk progress: startMs 0 = never armed this session (a same-day reload) -> the sign
  // is already fully written, exactly as the fiction says; -1 = one-shot armed (playBoardChalk)
  // -> stamp with the real clock now; otherwise animate to 1 and stay there.
  if (boardFx.chalkStartMs === -1) boardFx.chalkStartMs = tMs;
  const chalkP = boardFx.chalkStartMs === 0
    ? 1 : Math.min(1, (tMs - boardFx.chalkStartMs) / B.chalk.durMs);

  ctx.save();
  ctx.textBaseline = 'top';
  const cx = x + w / 2, maxW = w - B.padX * 2;
  // Every line lands twice: a 1px dark shade then the ink — cheap legibility over the grain.
  // A PARTIAL row (mid-chalk) anchors LEFT at its FINAL left edge, so the reveal writes
  // left-to-right and finishes pixel-identical to the centered full row.
  const line = (text, fullText, font, color, ly) => {
    ctx.font = font;
    const partial = text.length < fullText.length;
    ctx.textAlign = partial ? 'left' : 'center';
    const lx = partial ? cx - ctx.measureText(fullText).width / 2 : cx;
    ctx.fillStyle = B.shade; ctx.fillText(text, lx + 1, y + ly + 1);
    ctx.fillStyle = color;   ctx.fillText(text, lx, y + ly);
  };
  if (B.drawHeader) line(B.header, B.header, B.headerFont, B.headerColor, B.headerY);  // painted, never chalked

  const ev = MARKET_EVENTS[state?.marketEventId];
  if (ev) {
    ctx.font = B.quipFont;                                  // wrap measures in the quip's own font
    const quip = boardQuipFor(ev, state.marketDayKey);
    const rows = wrapBoardText(ctx, quip, maxW, B.maxQuipLines);
    const plan = [
      { text: ev.displayName, font: B.nameFont, color: B.nameColor, ly: B.nameY },
      ...rows.map((t, i) => ({ text: t, font: B.quipFont, color: B.quipColor, ly: B.quipY + i * B.quipLineH })),
    ];
    // Char budget across the plan: the name writes first, then the quip rows — one hand, one pass.
    let budget = Math.round(plan.reduce((n, r) => n + r.text.length, 0) * chalkP);
    for (const r of plan) {
      const take = Math.min(r.text.length, budget);
      budget -= take;
      if (take <= 0) break;
      line(r.text.slice(0, take), r.text, r.font, r.color, r.ly);
    }
  }
  ctx.restore();
}

// --- Doug the Scavenger (§14 Pass A): the third worker, a GROUND gremlin at the counter's right
// corner — nearest the door he raids. Unlike Greg's echo-errand, Doug's round trip is a PURE
// FUNCTION of his worker timer: idle at home, walk to the door, GONE through it, walk back — so
// his homecoming lands exactly when the tick banks the scrap (game.js). One clock, nothing to
// desync; any timer state maps to a pose (load/hire mid-cycle just snaps him to the right leg).
// Draw order: with the workers — AFTER the door (wall furniture, so he walks in FRONT of it;
// the 2026-07-10 layer fix) and BEFORE the counter (it overlaps his legs at home). He melts
// through the threshold on a short alpha fade — the door's own purple glow sells the magic,
// and the shared playPortalOpen one-shot stays celebrant-only (no re-entrancy to manage).
const DOUG = {
  homeX: 870,          // tucked behind the counter, clear of the DOOR. Budget (the bottom-bar
                       // lesson): his content spans center-67..center+58 (measured cols), the door
                       // spans 934-1254 (drawn after him, so it CLIPS anything overlapping while
                       // idle), Bob's arms reach ~784, counter face ends ~970. Window: 867-876.
                       // 870 = 6px clear of the door, 19px clear of Bob, whole body behind the desk.
  feetY: COUNTER.baseY - 60,  // standing on the floor BEHIND the counter — less lifted than
                              // stool-Bob's -82: legs occluded, pack + head clear the desk
  // No wall-height walk target anymore (the 2026-07-10 floor fix): his legs speak the CELEBRANT
  // grammar — descend around the desk's end onto the contact plane (COUNTER.baseY, the same
  // plane the marchers hold), walk the floor to the doorway, then climb to the door's base with
  // the marchers' depth shrink (CELEBRATE.depthScale). legPos() below stages it; the fractions
  // are the dials.
  sinkFrac: 0.28,      // first slice of each leg: the step down/up around the desk's end
  enterFrac: 0.62,     // where the doorway climb begins (climb spans enterFrac..1)
  height: 160,         // NATIVE frame — drawn 1:1 (the sizing law; Bob/dragon precedent). NOTE: this
                       // line was once eaten by a neighboring splice and Doug vanished — a missing
                       // height NaNs every draw coordinate and canvas silently draws NOTHING.
  footPadWalk: 10,     // MEASURED (pngjs, walk frames: 9-12) — soles on the walk line
  footPadIdle: 9,      // MEASURED (pngjs, 2026-07-10 recolor re-measure): uniform 9 across all six
                       //   idle frames — resolves the launch-day PROVISIONAL 12 (feet sat 3px low)
  fadeSec: 0.45,       // threshold melt — the last/first beats of the out/back legs (alpha ramp)
  // walkSec + idleFrac now live in the WORKERS.scavenger registry (promoted 2026-07-10): the
  // battle-cameo gate (isDougOut, game.js) must share this exact clock — one source of truth.
  placeholderColor: '#5a7a4a',   // moss-green slab if every doug sprite is absent
};
const DOUG_ANIMS = {
  idle: { spriteId: 'doug_idle',       fps: 6 },   // frames auto-sliced by aspect (square frames),
  walk: { spriteId: 'doug_walk_happy', fps: 8 },   //   so the static doug.png fallback slices as 1
};

function drawScavenger(ctx, state, tMs) {
  const w = state.workers?.scavenger;
  if (!w?.owned) return;                                     // hire-gated, like Bob's arc and Greg
  const interval = WORKERS.scavenger?.baseInterval ?? 24;    // scavenge has no speed perks (scoped
                                                             //   in game.js) — this IS the clock
  const walk = Math.min((WORKERS.scavenger?.walkSec ?? 2.6), interval / 4);         // degenerate-interval guard: legs never overlap
  const timer = Math.max(0, Math.min(w.timer ?? interval, interval));
  const elapsed = interval - timer;                          // 0 at run start, interval at homecoming
  const idleSec = interval * (WORKERS.scavenger?.idleFrac ?? 0.3);
  const outEnd = idleSec + walk, backStart = interval - walk;
  const dl = (a, b, t) => a + (b - a) * t;                   // local lerp

  // Leg path (t: 0 = home, 1 = through the door), in the celebrants' floor language: down around
  // the desk's end (its face occludes the turn — he draws before the counter), the CONTACT PLANE
  // across the open floor, then the doorway climb with the marchers' recede-shrink.
  const legPos = (t) => {
    const turnX = DOUG.homeX + DOUG.sinkFrac * (PORTAL.centerX - DOUG.homeX);
    if (t < DOUG.sinkFrac) {
      const f = t / DOUG.sinkFrac;
      return { x: dl(DOUG.homeX, turnX, f), y: dl(DOUG.feetY, COUNTER.baseY, f), scale: 1 };
    }
    if (t < DOUG.enterFrac) {
      const f = (t - DOUG.sinkFrac) / (DOUG.enterFrac - DOUG.sinkFrac);
      return { x: dl(turnX, PORTAL.centerX, f), y: COUNTER.baseY, scale: 1 };
    }
    const f = (t - DOUG.enterFrac) / (1 - DOUG.enterFrac);
    return { x: PORTAL.centerX, y: dl(COUNTER.baseY, PORTAL.baseY, f),
             scale: 1 + (CELEBRATE.depthScale - 1) * f };
  };

  let x = DOUG.homeX, y = DOUG.feetY, mode = 'idle', flip = false, alpha = 1, scale = 1;
  if (elapsed < idleSec) { /* home: idle, sorting the last haul */ }
  else if (elapsed < outEnd) {                               // out-leg (faces right, as authored)
    const p = legPos((elapsed - idleSec) / walk);
    x = p.x; y = p.y; scale = p.scale; mode = 'walk';
    alpha = Math.max(0, Math.min(1, (outEnd - elapsed) / DOUG.fadeSec));   // melt into the doorway
  } else if (elapsed < backStart) {
    return;                                                  // through the door — gone scavenging
  } else {                                                   // back-leg: the same path REVERSED + mirrored
    const p = legPos(1 - (elapsed - backStart) / walk);
    x = p.x; y = p.y; scale = p.scale; mode = 'walk'; flip = true;
    alpha = Math.max(0, Math.min(1, (elapsed - backStart) / DOUG.fadeSec));  // and melt back out
  }

  const cfg = DOUG_ANIMS[mode];
  const spr = getSprite(cfg.spriteId) ?? getSprite('doug');  // strip -> static -> placeholder
  const box = DOUG.height;
  const footPad = mode === 'walk' ? DOUG.footPadWalk : DOUG.footPadIdle;
  const bx = box * scale;                                    // the doorway recede (feet-anchored)
  const topY = y + footPad * scale - bx;
  if (!spr) {                                                // placeholder slab (standing pattern)
    ctx.fillStyle = DOUG.placeholderColor;
    ctx.fillRect(x - bx * 0.25, topY + bx * 0.2, bx * 0.5, bx * 0.8);
    return;
  }
  const frames = Math.max(1, Math.round(spr.naturalWidth / spr.naturalHeight));  // aspect auto-slice
  const frame = Math.floor((tMs / 1000) * cfg.fps) % frames;
  const fw = spr.naturalWidth / frames;
  ctx.save();
  ctx.globalAlpha = alpha;                                   // threshold fade (1 everywhere else)
  if (flip) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }    // instant mirror — masked
  ctx.drawImage(spr, frame * fw, 0, fw, spr.naturalHeight,                      //   by the door/counter ends
    x - bx / 2, topY, bx * (fw / spr.naturalHeight), bx);
  ctx.restore();
}

// --- The Relic Display (§14 Pass B): the trophy corner, LEFT of Bob — wall frames in the empty
// band between the Special board (bottom 246) and the counter top (~353), plus objects standing
// on the desk. Frames appear once Doug is HIRED (the corner opens with the scavenger) and hang
// EMPTY until each relic is restored — an empty frame is a visible want. All 1:1: the frame is
// 80px, its content window 64px, relics 64px — authored to nest (measured, 2026-07-10).
const RELIC_DISPLAY = {
  relicSize: 64,       // relic art native — 1:1, centered in the frame's window
  fallbackFrame: 96,   // code-drawn frame size when wooden_frame.png is absent
  counterTopY: 448,    // desk-relic DRAW BASE — MEASURED (pngjs, 2026-07-10): the desk's back edge
                       // is flat at y413.8 across the magnet's span, and the magnet art has 5px of
                       // base padding, so 448 puts its visible base ~30px onto the desk surface.
                       // (v1 used 402 — the sprite-box top, which floats objects on the WALL: the
                       // counter PNG has transparent rows up top; the surface starts at ~414.)
  // The frame draws at its NATURAL size (v1 was 80 with a 64 border box — too small for the
  // relics; the re-author needs an inner WINDOW >= 64). Reading naturalWidth means the new
  // frame is a pure art drop — no code retune, and the suite pins only 'square, >= 80'.
};

function drawRelicWall(ctx, state) {                       // WALL layer — called with the wall,
  if (state.workers?.scavenger?.owned !== true) return;    //   right after the door
  const frame = getSprite('wooden_frame');
  for (const id of RELIC_ORDER) {
    const r = RELICS[id];
    if (r.spot.kind !== 'frame') continue;
    const fs = frame?.naturalWidth ?? RELIC_DISPLAY.fallbackFrame;   // natural-size frame
    const fx = r.spot.x - fs / 2, fy = r.spot.topY;
    if (frame) ctx.drawImage(frame, fx, fy, fs, fs);
    else {                                                 // graceful: a code-drawn frame
      ctx.strokeStyle = '#6b4a2f'; ctx.lineWidth = 6;
      ctx.strokeRect(fx + 3, fy + 3, fs - 6, fs - 6);
    }
    if (state.relics?.[id] === 'restored') {
      const spr = getSprite(r.spriteId);
      const inset = (fs - RELIC_DISPLAY.relicSize) / 2;    // centered in whatever window the art brings
      if (spr) ctx.drawImage(spr, fx + inset, fy + inset, RELIC_DISPLAY.relicSize, RELIC_DISPLAY.relicSize);
    }
  }
}

function drawCounterRelics(ctx, state) {                   // DESK layer — called right after the
  for (const id of RELIC_ORDER) {                          //   counter, so they stand ON it
    const r = RELICS[id];
    if (r.spot.kind !== 'counter' || state.relics?.[id] !== 'restored') continue;
    const spr = getSprite(r.spriteId);
    if (!spr) continue;                                    // graceful: no placeholder clutter on the desk
    const s = RELIC_DISPLAY.relicSize;
    ctx.drawImage(spr, r.spot.x - s / 2, RELIC_DISPLAY.counterTopY - s, s, s);
  }
}

export function drawScene(ctx, state, tMs) {
  ctx.clearRect(0, 0, W, H);

  drawBackground(ctx);          // shop_bg.png if present, else flat wall + floor

  drawWallShelf(ctx, state, tMs);  // goods on the wall (diegetic shelf, C-lite — display only)
  drawSpecialBoard(ctx, state, tMs); // the Special-of-the-Day sign over Bob (Market Day's comedy home)
  drawPortal(ctx, tMs);         // the DOOR is furniture ON the far wall: it paints with the wall,
                                // BEFORE every character — Doug approaches it in FRONT (2026-07-10
                                // layer fix); celebrants + queue still draw later, so they overlap
                                // it as before. Its content (x990-1198, measured) never meets the
                                // counter (ends 970), so the desk corner is untouched by the move.
  drawRelicWall(ctx, state);    // the trophy frames hang with the wall furniture (§14 Pass B)
  drawCounterShadow(ctx);       // contact shadow FIRST: grounds the desk AND Bob standing behind it
  drawBob(ctx, state, tMs);     // before the counter, so the counter front overlaps his lower body
  drawRestocker(ctx, state, tMs); // the flyer hovers left of Bob — same layer, same counter overlap
  drawScavenger(ctx, state, tMs); // Doug at the counter's right corner — in FRONT of the door, behind the desk
  drawCounter(ctx);
  drawCounterRelics(ctx, state); // restored counter relics stand on the desk (§14 Pass B)
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
  // Tail anchoring (VIP pass, 2026-07-08): the classic tip sits at QUEUE.y - tipGapY (y389),
  // sized for the cast's heads (~y394-397). A pixel-doubled VIP's head is far above that, so the
  // tip RIDES UP to point at whoever is actually front: min() means every regular mob keeps the
  // exact old geometry, and only a taller-than-classic head lifts the bubble.
  const front = MONSTERS[c.monsterId];
  const frontHead = (QUEUE.y + QUEUE.size) - mobDrawnBox(front)
    + (front?.footPad ?? 0) * (mobDrawnBox(front) / 128);
  const tipY = Math.min(QUEUE.y - BUBBLE.tipGapY, frontHead - 2) + bob;
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

// --- The Restocker (UX roadmap 4): the second worker, a SMALL FLYER hovering left of Bob. Art is
// pending — placeholder-first per the standing pattern (Bob's placeholder language: body rect +
// darker band). Flyer conventions: hover bob like the flying mobs (same sine period), altitude
// padding above the counter. Draw gates on ownership, exactly like Bob's hire-arc gate.
const RESTOCKER = {
  centerX: 490,        // HOME: tucked at Bob's left shoulder (Daniel's screenshot position) —
                       // body spans 434-546: 30px clear of the front mob's box (right edge 404),
                       // 100px clear of Bob (left edge ~646)
  hoverY:  330,        // TOP of the body at hover altitude — bottom ~442 floats over the counter top
  height:  112,        // NATIVE frame size (greg.png is 112x112, content 101x93 measured via pngjs).
                       // 1:1 on purpose: pixel art only scales clean at integers — the earlier 96
                       // would have been a 0.857x downscale and muddied every pixel. Still well
                       // under Bob's 240.
  shadowY: 472,        // PROVISIONAL (feel): the counter surface his shadow lands on — ~30px
                       // below his hovering feet (442), far enough to read "airborne"
  shadowFade: 150,     // px of errand travel over which the shadow lifts away (no meaningful
                       // ground under the shelf wall, so it leaves WITH him instead of painting
                       // a floor ellipse 300px below)
  placeholderColor: '#4a6a7a',   // slate-blue: reads "not Greg" at a glance if the PNG is absent
};
// Greg's flight loop (Daniel: 6 frames, 2026-07-04). Same auto-slice convention as BOB_ANIMS —
// drop greg_fly.png (horizontal strip, 112px frames) and it plays; absent, Greg falls back to the
// static restocker.png, then the placeholder. He never lands, so ONE loop is his whole existence:
// the altitude bob below is code-side, the strip only flaps.
const GREG_ANIMS = {
  fly:  { spriteId: 'greg_fly',   frames: 6, fps: 8, loop: true },  // west-facing flight (mirrored for east)
  flyN: { spriteId: 'greg_fly_n', frames: 6, fps: 8, loop: true },  // back view — shelf work (Daniel,
                                                                    // 2026-07-05); absent -> fly covers
};

// The errand (Option 1, Daniel 2026-07-05; feel passes same day): every trickle restock sends
// Greg on a visible run — home -> a RANDOM spot in the shelf area -> a dwell with a small
// collecting drift -> a turn HOP -> home -> a settling turn hop. PURELY VISUAL: the stock landed
// on the game tick that triggered this (main.js consumes state.gregRestocked and calls
// playGregErrand); the errand is the tick's echo, so economy timing and the suite never depend
// on it.
// TURNS: the earlier squash-flip (width through zero) read as a paper-card artifact on Greg's
// asymmetric detail (Daniel's second feel report), so turns are now INSTANT mirrors masked by
// motion — during each turn leg he hops straight up ~24px and the facing swaps at the APEX, the
// moment of zero horizontal velocity, where the eye expects the silhouette to change (the classic
// 16-bit sprite turn). Same hop at the shelf and at the homecoming settle, so the beat reads as
// his signature move rather than two different tricks.
const GREG_ERRAND = {
  durationMs: 4400,    // full round trip, still comfortably under the 8s trickle spacing (errands
                       // only fire on SUCCESSFUL trickles, which reset the 8s timer — so runs can
                       // never overlap and playGregErrand needs no re-entrancy guard)
  // The shelf AREA (plank spans x60..372, rows y38..320): each errand picks a random hover spot
  // in these cx/cy ranges — margins keep his 112px body over the unit (slight plank overhang ok).
  destX: [120, 330], destY: [50, 200],
  driftR: 22,          // the collecting drift radius around the picked spot
  turnHop: 24,         // the turn hop's rise in px — the mask that sells the instant flip
  // Leg fractions (sum 1.0): out / dwell / turn-hop / home / settle-hop.
  legOut: 0.24, legDwell: 0.32, legTurn: 0.10, legHome: 0.24, legSettle: 0.10,
};
let gregErrand = null;                     // { t0, x, y } — destination rolled per errand
export function playGregErrand() {
  const [x0, x1] = GREG_ERRAND.destX, [y0, y1] = GREG_ERRAND.destY;
  gregErrand = { t0: performance.now(),
                 x: x0 + Math.random() * (x1 - x0),
                 y: y0 + Math.random() * (y1 - y0) };
}

function drawRestocker(ctx, state, tMs) {
  if (state?.workers?.restocker?.owned !== true) return;        // no hire, no flyer
  const hover = Math.sin(tMs / 300 + RESTOCKER.centerX) * 5;    // flying-mob hover, own phase
  const smooth = (t) => t * t * (3 - 2 * t);
  const hop = (t) => Math.sin(t * Math.PI) * GREG_ERRAND.turnHop;   // rise-and-fall bump, apex at t=0.5

  // Errand position + pose. Poses: 'west' (natural — the art faces the shop), 'east' (mirrored),
  // 'north' (the back-view strip, shelf work — Daniel 2026-07-05; falls back to west while the
  // strip isn't in). With the north dwell, BOTH facing changes get natural masks: west->north
  // lands exactly where the out leg's smoothstep decelerates to zero, and north->east swaps at
  // the departure hop's apex.
  let cx = RESTOCKER.centerX, cy = RESTOCKER.hoverY, pose = 'west';
  if (gregErrand !== null) {
    const E = GREG_ERRAND;
    const p = (tMs - gregErrand.t0) / E.durationMs;
    const bOut = E.legOut, bDwell = bOut + E.legDwell, bTurn = bDwell + E.legTurn,
          bHome = bTurn + E.legHome;                            // leg boundaries (settle runs to 1)
    const perchX = gregErrand.x + E.driftR;                     // where the drift ends (cos(2pi)=1)
    if (p >= 1 || p < 0) {
      gregErrand = null;                                        // (p<0 guards a clock hiccup)
    } else if (p < bOut) {
      const t = smooth(p / E.legOut);                           // outbound — faces west (natural)
      cx = RESTOCKER.centerX + (gregErrand.x - RESTOCKER.centerX) * t;
      cy = RESTOCKER.hoverY  + (gregErrand.y - RESTOCKER.hoverY)  * t;
    } else if (p < bDwell) {
      const a = ((p - bOut) / E.legDwell) * Math.PI * 2;        // the collecting dwell: a lazy
      cx = gregErrand.x + Math.cos(a) * E.driftR;               // drift circle around the spot,
      cy = gregErrand.y + Math.sin(a) * E.driftR * 0.5;         // FACING THE SHELVES
      pose = 'north';
    } else if (p < bTurn) {
      const t = (p - bDwell) / E.legTurn;                       // the departure hop: straight up
      cx = perchX;                                              // and down at the perch — the
      cy = gregErrand.y - hop(t);                               // north->east swap rides the apex
      pose = t < 0.5 ? 'north' : 'east';
    } else if (p < bHome) {
      const t = smooth((p - bTurn) / E.legHome);                // homebound — mirrored (flying east)
      cx = perchX + (RESTOCKER.centerX - perchX) * t;
      cy = gregErrand.y + (RESTOCKER.hoverY - gregErrand.y) * t;
      pose = 'east';
    } else {
      const t = (p - bHome) / E.legSettle;                      // the settling hop at home: same
      cx = RESTOCKER.centerX;                                   // move, apex swap back to facing
      cy = RESTOCKER.hoverY - hop(t);                           // the shop
      pose = t < 0.5 ? 'east' : 'west';
    }
  }
  cy += hover;

  // Greg's ground shadow (Daniel, 2026-07-05): flyers get the detached ellipse. It sits on the
  // counter surface under him — NOT tracking the hover bob (the grounding rule: the shadow is
  // what sells the air) — and alpha-ramps out over the first shadowFade px of an errand.
  {
    const dHome = Math.hypot(cx - RESTOCKER.centerX, (cy - hover) - RESTOCKER.hoverY);
    const a = Math.max(0, 1 - dHome / RESTOCKER.shadowFade);
    if (a > 0) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = COL.shadow;
      ctx.beginPath();
      ctx.ellipse(cx, RESTOCKER.shadowY, 40, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Resolve pose -> sheet + mirror. North uses the back-view strip when present; without it, the
  // dwell degrades to today's west-facing behavior (never a placeholder mix).
  const northSheet = getSprite(GREG_ANIMS.flyN.spriteId);
  const useNorth = pose === 'north' && !!northSheet;
  const face = pose === 'east' ? -1 : 1;

  const h = RESTOCKER.height;
  const drawFrame = (img, sx, sy, sw, sh, w) => {
    ctx.save();
    if (face === -1) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }  // mirror about cx
    ctx.drawImage(img, sx, sy, sw, sh, cx - w / 2, cy, w, h);
    ctx.restore();
  };

  const cfg = useNorth ? GREG_ANIMS.flyN : GREG_ANIMS.fly;
  const sheet = useNorth ? northSheet : getSprite(GREG_ANIMS.fly.spriteId);
  if (sheet) {
    const frame = Math.floor(tMs / (1000 / cfg.fps)) % cfg.frames;
    const sw = sheet.width / cfg.frames;                        // auto-slice: no pixel sizes to enter
    drawFrame(sheet, frame * sw, 0, sw, sheet.height, h * (sw / sheet.height));
    return;
  }
  const spr = getSprite('restocker');                           // static frame (pre-strip fallback)
  if (spr) { drawFrame(spr, 0, 0, spr.width, spr.height, h * (spr.width / spr.height)); return; }
  const w = h * 0.7;                                            // Bob's placeholder proportions, small
  ctx.fillStyle = RESTOCKER.placeholderColor;
  ctx.fillRect(cx - w / 2, cy, w, h);
  ctx.fillStyle = '#00000055';
  ctx.fillRect(cx - w / 2, cy + h * 0.55, w, 4);
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

// Drawn box height for a mob — the ONE sizing formula, shared by drawMob and the want-bubble's
// dynamic tail. Two regimes: `pixelScale` (VIPs) draws at an exact integer multiple of the
// AUTHORED frame (nearest-neighbor-crisp by construction — the pixel-scaling lesson); otherwise
// the classic chain, QUEUE.size x global dial x per-monster spriteScale.
function mobDrawnBox(m) {
  if (m?.pixelScale) {
    const spr = (m.anim ? getSprite(`${m.id}_idle`) : null) ?? getSprite(m.id ?? '');
    const fh = spr?.naturalHeight ?? 128;                  // frame height (strips are one row)
    return fh * m.pixelScale;
  }
  return QUEUE.size * QUEUE.spriteScale * (m?.spriteScale ?? 1);
}

function drawMob(ctx, x, y, size, monsterId, tMs, isFront) {
  const m = MONSTERS[monsterId];
  // Grounding pass: the idle hover bob is a FLYER behavior (registry `flying`, ?? false) — a slime
  // gently rising and falling reads as levitation. Grounded mobs sit still; their motion arrives
  // with the idle strips. The serve celebration's hop is untouched (drawCelebrants has its own math).
  const flying = m?.flying ?? false;
  const bob = flying ? Math.sin(tMs / 300 + x) * 4 : 0;   // +x so flyers don't bob in lockstep
  const groundY = y + size - 4;                     // shadow stays on the ground while the mob hops

  // Shadow: FLYERS ONLY (Daniel, 2026-07-05). The detached ellipse is the altitude cue under a
  // hovering body; grounded sprites sit ON the floor and their art carries its own contact, so
  // the drawn ellipse under them read as a double shadow.
  if (flying) {
    ctx.fillStyle = COL.shadow;
    ctx.beginPath();
    ctx.ellipse(x + size / 2, groundY, size * 0.42, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sprite chain (all registry-driven, all optional): <id>_idle.png strip if the monster declares
  // an `anim` field AND the strip loaded -> static <id>.png -> colored placeholder rect. Strips are
  // horizontal, equal-width frames, auto-sliced by the declared frame count (Bob's convention).
  const anim = m?.anim;
  const strip = anim ? getSprite(`${monsterId}_idle`) : null;
  const spr = strip ?? getSprite(monsterId);
  if (spr) {
    // Global dial x per-monster calibration, OR a VIP's integer pixel-double — one shared formula
    // (mobDrawnBox above) so the bubble's tail math can never drift from the draw.
    const h = mobDrawnBox(m);
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
      thumpSpecialBoard(tMs);   // the slam rattles the wall — the board shudders (cooldown-gated)
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

    // Shadow: same FLYERS-ONLY rule as drawMob (uniformly, so a Froggo isn't shadowless in the
    // queue but shadowed mid-march — judgment call, 2026-07-05: the hop still reads through the
    // squash-and-stretch below; reverse per-site if the march loses its grounding).
    if (MONSTERS[c.monsterId]?.flying ?? false) {
      ctx.fillStyle = COL.shadow;
      ctx.beginPath();
      ctx.ellipse(x + size / 2, feetY - 4, size * 0.42 * scale, 10 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sprite chain, squash-and-stretch applied about the feet anchor so it reads ground-planted.
    const m = MONSTERS[c.monsterId];
    const h = mobDrawnBox(m) * scale;
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

function drawBob(ctx, state, tMs) {
  // Bob's hire arc: Bob does NOT exist on stage until hired. The empty counter (plus the DOM goal
  // chip, panels.js) carries the pseudo-tutorial beat — manual serving first, then the hire makes
  // him appear. Old saves with owned already true never see the gate. The anim state also resets
  // here so a stray pre-hire playBobServe (main.js gates the trigger, but belt-and-braces) can't
  // greet his first frame with a stale mid-one-shot.
  if (state?.workers?.mimic_merchant?.owned !== true) {
    bobAnim.name = 'idle'; bobAnim.startMs = null;
    return;
  }

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
    drawBob(ctx, state, tMs); return;               // ...and draw idle this frame (idle loops, so no re-recursion)
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