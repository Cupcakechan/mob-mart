// main.js — entry point: wires DOM, scale-to-fit, input, save/load, nav, and the rAF game loop.
import { CONFIG } from './config.js';
import { clamp } from './utils.js';
import { update, serveCurrent, dismissCurrent, restockItem, restockAll, buyUpgrade, buyPerk, buyLicense, hireWorker, buyWorkerLevel, deliverBattleReport, refreshMarketDay } from './game.js';
import { CATEGORY_LABELS } from './data/marketevents.js';
import { loadState, saveState, clearSave } from './save.js';
import { computeOffline, applyOffline, formatAway } from './offline.js';
import { drawScene, playBobServe, playPortalOpen, spawnItemFloat, spawnCelebrant, setCelebrantEnteredCallback, playGregErrand, playBoardChalk } from './render/scene.js';
import { loadSprite } from './render/sprites.js';
import { initHud, renderHud } from './ui/hud.js';
import { initPanels, renderPanels } from './ui/panels.js';
import { initNav } from './ui/nav.js';
import { initKongregate } from './kongregate.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;                 // crisp pixels once sprites replace the rects

const state = loadState();                         // resume from a saved shop, or a fresh one

// Battle-report timing: the celebrant walking THROUGH the door is what publishes the battle
// result (deliverBattleReport sets uiDirty itself; the fallback timer in update() covers ghosts
// that never arrive). Wired here because main.js owns all render<->game plumbing.
setCelebrantEnteredCallback(() => deliverBattleReport(state));

// M6 — Kongregate bridge. Unconditional and safe on every platform: without the API's script tag
// (index.html locally / on itch) this is a silent no-op; on Kongregate (index.kongregate.html) it
// loads the API and submits the 'loaded' stat.
initKongregate();

// M5 — offline earnings, once at boot, BEFORE any autosave can refresh lastSeen. Compute what Bob
// sold while away (capped, stock-consuming), bank it, and save IMMEDIATELY: the save writes a fresh
// lastSeen, so a reload can't collect the same window twice. Modal only shows when there's actually
// something to report (quick reloads and worker-less/empty-shelf returns stay silent).
const offline = computeOffline(state, Date.now());
if ((offline.sales > 0 || (offline.scrap ?? 0) > 0) && offline.awaySec >= CONFIG.offline.minAwaySec) {  // scrap-only absences show too (§14)
  applyOffline(state, offline);
  saveState(state);
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText('offline-away',  formatAway(offline.cappedSec));   // show the time Bob WORKED (the capped span)
  setText('offline-sales', offline.sales);
  setText('offline-gold',  offline.gold);
  setText('offline-rep',   offline.rep);
  // Greg's credit line: only when his refills existed AND the reserve was actually tapped —
  // a full shelf that never needed the backroom earns Bob the credit alone.
  document.getElementById('offline-greg')
    ?.classList.toggle('hidden', !(offline.gregRefills > 0 && offline.reserveUsed > 0));
  // Doug's haul row — shown only when he actually brought something back (unhired or a
  // sub-interval absence both read 0 and stay hidden).
  setText('offline-scrap-n', offline.scrap ?? 0);
  document.getElementById('offline-doug')
    ?.classList.toggle('hidden', !((offline.scrap ?? 0) > 0));
  setText('offline-rats-n', offline.ratsFoiled);
  document.getElementById('offline-rats')
    ?.classList.toggle('hidden', !(offline.ratsFoiled > 0));
  document.getElementById('offline-modal')?.classList.remove('hidden');
}
document.getElementById('offline-collect-btn')?.addEventListener('click', () => {
  document.getElementById('offline-modal')?.classList.add('hidden');
});

// Market Day (retention pass, Option 2): derive today's demand event and, on the FIRST open of a
// calendar day, bank the supplier crate. Runs AFTER the offline bank on purpose — Bob sells the
// old shelf first, then the crate restocks the morning after. Save IMMEDIATELY on a grant (the
// lastMarketDay latch is what makes a reload a no-op — same rule as the offline bank above). The
// announcements live in refreshMarketDay (log lines + Bob's bubble) and the HUD banner is
// persistent; when the away modal is already up, its card doubles as the morning paper and gets
// the market lines appended here.
const market = refreshMarketDay(state, Date.now());
if (market?.crate) {
  saveState(state);
  const modalUp = !document.getElementById('offline-modal')?.classList.contains('hidden');
  if (modalUp) {
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    if (market.event) {
      setText('offline-market-name', market.event.displayName);
      setText('offline-market-what', CATEGORY_LABELS[market.event.category] ?? market.event.category);
    }
    document.getElementById('offline-market')?.classList.toggle('hidden', !market.event);
    setText('offline-crate-units', market.crate.units);
    setText('offline-crate-gold', market.crate.gold);
    document.getElementById('offline-crate')?.classList.remove('hidden');
  }
}

// Diorama sprites — each falls back to a placeholder if its PNG is absent, so art can drop in
// piecemeal. Filenames match the ids the scene uses.
loadSprite('shop_bg', 'assets/sprites/shop_bg.png');   // full 1280x720 backdrop (wall+floor)
loadSprite('mimic_merchant', 'assets/sprites/mimic_merchant.png');
loadSprite('slime',    'assets/sprites/slime.png');
loadSprite('bat',      'assets/sprites/bat.png');
loadSprite('skeleton', 'assets/sprites/skeleton.png');
loadSprite('counter',  'assets/sprites/counter.png');
loadSprite('restocker','assets/sprites/restocker.png');  // Greg's static frame (112x112)
loadSprite('greg_fly', 'assets/sprites/greg_fly.png');   // Greg's 6-frame flight strip (west-facing)
loadSprite('greg_fly_n','assets/sprites/greg_fly_n.png');// Greg's north strip (back view, shelf work)
                                                          // — 404s gracefully to the west strip
                                                          // until Daniel drops it
loadSprite('portal',   'assets/sprites/portal.png');
loadSprite('portal_glow', 'assets/sprites/portal_glow.png');  // 4-frame swirl strip (640x160); absent -> static portal
loadSprite('portal_glow_mountain', 'assets/sprites/portal_glow_mountain.png');  // door destinations:
loadSprite('portal_glow_forest',   'assets/sprites/portal_glow_forest.png');    // same door, different
loadSprite('portal_glow_dungeon',  'assets/sprites/portal_glow_dungeon.png');   // world through it
loadSprite('portal_glow_desert', 'assets/sprites/portal_glow_desert.png');  // +3 destinations (2026-07-08):
loadSprite('portal_glow_tavern', 'assets/sprites/portal_glow_tavern.png');  //   desert, tavern, castle
loadSprite('portal_glow_castle', 'assets/sprites/portal_glow_castle.png');  //   (committed with this pass)
loadSprite('bob_idle',  'assets/sprites/bob_idle.png');   // 6-frame horizontal strip
loadSprite('bob_serve', 'assets/sprites/bob_serve.png');  // 6-frame horizontal strip
loadSprite('club',         'assets/sprites/club.png');         // item icons (64x64) — used by the
loadSprite('metal_helmet', 'assets/sprites/metal_helmet.png'); // canvas purchase float; the DOM
loadSprite('hp_flask',     'assets/sprites/hp_flask.png');     // shelf cards load the same files
loadSprite('iron_sword',    'assets/sprites/iron_sword.png');    // tier-2 icons (authoring pending;
loadSprite('greater_flask', 'assets/sprites/greater_flask.png'); // floats skip + cards degrade to
loadSprite('knight_helm',   'assets/sprites/knight_helm.png');   // text until the PNGs land)
loadSprite('tattered_shirt', 'assets/sprites/tattered_shirt.png');  // Batch 1 icons (64x64, id-named,
loadSprite('bandages',       'assets/sprites/bandages.png');        //   registered BEFORE the art —
loadSprite('wooden_shield',  'assets/sprites/wooden_shield.png');   //   the wall_shelf lesson; absent
loadSprite('rusty_key',      'assets/sprites/rusty_key.png');       //   -> cards text-only, floats
loadSprite('leather_bracer', 'assets/sprites/leather_bracer.png');  //   skip, wall slots empty-draw)
loadSprite('murk_tonic',     'assets/sprites/murk_tonic.png');
loadSprite('pickaxe',        'assets/sprites/pickaxe.png');
loadSprite('quiver',         'assets/sprites/quiver.png');
loadSprite('zip_tonic',      'assets/sprites/zip_tonic.png');
loadSprite('iron_buckler',   'assets/sprites/iron_buckler.png');   // Batch 2 chain tops (buckler IN;
loadSprite('iron_gauntlet',  'assets/sprites/iron_gauntlet.png');  //   gauntlet registered pre-art)
loadSprite('tattered_cloak', 'assets/sprites/tattered_cloak.png'); // Batch 3a leather set (64x64,
loadSprite('leather_boots',  'assets/sprites/leather_boots.png');  //   id-named, art landed with the
loadSprite('leather_cap',    'assets/sprites/leather_cap.png');    //   batch; the wall_shelf pairing
loadSprite('leather_gloves', 'assets/sprites/leather_gloves.png'); //   lesson, guarded by suite 0b)
loadSprite('leather_sling',  'assets/sprites/leather_sling.png');
loadSprite('silver_key',  'assets/sprites/silver_key.png');   // Batch 3b upgrades + curios (64x64,
loadSprite('spiked_club', 'assets/sprites/spiked_club.png');  //   id-named, art landed with the
loadSprite('iron_shield', 'assets/sprites/iron_shield.png');  //   batch; suite 0b guards pairing)
loadSprite('map',         'assets/sprites/map.png');
loadSprite('salt',        'assets/sprites/salt.png');
loadSprite('bat_idle', 'assets/sprites/bat_idle.png');            // Batty's 4-frame wing-flap strip (512x128)
loadSprite('slime_idle', 'assets/sprites/slime_idle.png');        // Slimey/Skele idle strips (Pass B): same
loadSprite('skeleton_idle', 'assets/sprites/skeleton_idle.png');  //   shared 4-frame contract; absent -> static
loadSprite('wall_shelf', 'assets/sprites/wall_shelf.png');        // wall-shelf plank prop (shelf v2; absent -> code-drawn plank)
loadSprite('special_board', 'assets/sprites/special_board.png');  // Special-of-the-Day sign over Bob (Daniel's 640x220,
                                                                  //   2026-07-07; absent -> code plank, text still draws)
loadSprite('slime_walk_happy', 'assets/sprites/slime_walk_happy.png');        // celebrate pass: happy-walk strips,
loadSprite('bat_walk_happy', 'assets/sprites/bat_walk_happy.png');            //   4 equal frames each; absent ->
loadSprite('skeleton_walk_happy', 'assets/sprites/skeleton_walk_happy.png');  //   idle strip / static march fallback
loadSprite('frog', 'assets/sprites/frog.png');                    // Pass 4b — Froggo (128x128 per the permanent
loadSprite('frog_idle', 'assets/sprites/frog_idle.png');          //   convention; registered BEFORE the art exists,
loadSprite('frog_walk_happy', 'assets/sprites/frog_walk_happy.png'); // the wall_shelf lesson; absent -> rect/static.
loadSprite('rat', 'assets/sprites/rat.png');                      // Ratty (roadmap 6, Pass A) — same contract:
loadSprite('rat_idle', 'assets/sprites/rat_idle.png');            //   static 128 + 4x128 idle strip + walk strip,
loadSprite('rat_walk_happy', 'assets/sprites/rat_walk_happy.png');//   all pre-registered, placeholder until art.
loadSprite('beetle', 'assets/sprites/beetle.png');                // Beetley (roadmap 6.5) — same contract;
loadSprite('beetle_idle', 'assets/sprites/beetle_idle.png');      //   static landed 2026-07-05, strips
loadSprite('beetle_walk_happy', 'assets/sprites/beetle_walk_happy.png'); // authored and incoming.
loadSprite('dragon', 'assets/sprites/dragon.png');                // THE INSPECTOR (Special Visits, 2026-07-07) —
loadSprite('dragon_idle', 'assets/sprites/dragon_idle.png');      //   same contract; all three authored + measured
loadSprite('dragon_walk_happy', 'assets/sprites/dragon_walk_happy.png'); // (footPad 14, ~82% tall fill, drawn 1:1 at pixelScale 1).
loadSprite('doug', 'assets/sprites/doug.png');                       // DOUG the Scavenger (§14 Pass A):
loadSprite('doug_idle', 'assets/sprites/doug_idle.png');             //   160px frames drawn 1:1, 6f strips
loadSprite('doug_walk_happy', 'assets/sprites/doug_walk_happy.png'); //   (Bob's shape); footPad measured
                                                                  //   "_walk_happy" name kept by convention; the
                                                                  //   authored content will be a grumpy stomp.

function resize() {
  const s = Math.min(window.innerWidth / CONFIG.stage.width, window.innerHeight / CONFIG.stage.height);
  stage.style.transform = `scale(${s})`;

  // Crisp-canvas pass: size the canvas BACKING STORE to the real device pixels the stage occupies
  // (devicePixelRatio x fit scale) while its CSS size stays 1280x720 (style.css pins #scene), and
  // bridge with setTransform so every existing draw call keeps using logical 1280x720 coords —
  // scene.js is untouched. Result: the browser's final scale of the canvas is 1:1 with device
  // pixels, so it never resamples the frame; sprites are nearest-neighbor sampled ONCE at their
  // true on-screen size. (Before this, the frame was rendered at 1280x720 and then stretched by
  // transform+DPR — a non-integer resample that softened everything, sprites and text alike.)
  const k = Math.min(3, (window.devicePixelRatio || 1) * s);   // cap ~3x: a 4K-and-zoomed combo
                                                               // shouldn't balloon fill cost
  const bw = Math.max(1, Math.round(CONFIG.stage.width * k));
  const bh = Math.max(1, Math.round(CONFIG.stage.height * k));
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;                             // NOTE: assigning width/height WIPES the canvas
    canvas.height = bh;                            // and RESETS all context state (the gotcha) ...
  }
  // ... so the transform and smoothing flag are re-applied on EVERY resize, unconditionally.
  // Exact bw/1280 (not k) so rounding can't leave a sliver of unmapped backing at the edges.
  ctx.setTransform(bw / CONFIG.stage.width, 0, 0, bh / CONFIG.stage.height, 0, 0);
  ctx.imageSmoothingEnabled = false;               // missing this = the whole scene silently goes
                                                   // bilinear-soft on the first window resize
}
window.addEventListener('resize', resize);
resize();

// UI wiring — panels/nav call back into game logic; game logic never touches the DOM.
initHud(document.getElementById('hud'));
initPanels(document.getElementById('shop-ui'), {
  onServe:      () => {                                              // paid -> anims + item float
    const bought = state.queue[0]?.wantedItemId;                     // read BEFORE serve shifts the queue
    const buyer  = state.queue[0]?.monsterId;                        // ditto — the celebrant's identity
    if (serveCurrent(state)) {
      // Bob's hire arc: pre-hire, YOU are the merchant — the serve happens with no Bob on stage,
      // so his one-shot is gated on ownership (drawBob gates the draw; this gates the trigger).
      // The customer-side beats (door, float, celebrant) are unconditional — the sale is real.
      if (state.workers?.mimic_merchant?.owned === true) playBobServe();
      playPortalOpen(); spawnItemFloat(bought); spawnCelebrant(buyer);
    }
  },
  onDismiss:    () => dismissCurrent(state),
  onRestock:    (id) => restockItem(state, id),
  onRestockAll: () => restockAll(state),
  onDirty:      () => { state.uiDirty = true; },   // shelf category switch -> re-render next frame
  onBuyUpgrade: (id) => buyUpgrade(state, id),
  onBuyPerk:    (id) => buyPerk(state, id),      // Fame perks: spends rep, never the lifetime track
  onBuyLicense: (id) => buyLicense(state, id),   // supplier licenses: one-time gold, unlocks tier-2
  onHireWorker: (id) => hireWorker(state, id),
  onBuyWorkerLevel: (id) => buyWorkerLevel(state, id),  // Deep Sinks: worker training purchases
});
initNav(document.getElementById('nav'));           // bottom nav swaps the center panel

// --- Menu overlay (UX roadmap 5, Option 2) -------------------------------------------------
// In-game: the Menu button opens it over the RUNNING shop (no pause state exists on purpose —
// idle-honest). From the title: the Credits link opens it on the credits tab, over the title.
const menuOverlay = document.getElementById('menu-overlay');
const showMenu = (tab) => {
  document.querySelectorAll('.menu-tab').forEach((b) =>
    b.classList.toggle('active', b.dataset.menuTab === tab));
  document.getElementById('menu-settings').classList.toggle('hidden', tab !== 'settings');
  document.getElementById('menu-credits').classList.toggle('hidden', tab !== 'credits');
  menuOverlay.classList.remove('hidden');
};

// Reset, relocated into the menu with DOUBLE-CONFIRM friction (a destructive action deserves it —
// replaces the old floating button's window.confirm): first click ARMS the button ("Really
// erase?"), a second click within 4s resets; the arm decays on the timer or when the menu closes.
const resetBtn = document.getElementById('menu-reset-btn');
let resetArmTimer = null;
const resetArm = (armed) => {
  clearTimeout(resetArmTimer);
  resetBtn.classList.toggle('armed', armed);
  resetBtn.textContent = armed ? 'Really erase? Click again' : 'Reset Progress';
  if (armed) resetArmTimer = setTimeout(() => resetArm(false), 4000);
};
resetBtn.addEventListener('click', () => {
  if (!resetBtn.classList.contains('armed')) { resetArm(true); return; }
  clearSave();
  location.reload();
});

document.getElementById('menu-btn').addEventListener('click', () => showMenu('settings'));
document.getElementById('title-credits-btn').addEventListener('click', () => showMenu('credits'));
document.querySelectorAll('.menu-tab').forEach((b) =>
  b.addEventListener('click', () => showMenu(b.dataset.menuTab)));
document.getElementById('menu-close-btn').addEventListener('click', () => {
  menuOverlay.classList.add('hidden');
  resetArm(false);                                // a half-armed reset never survives the menu closing
});

// Back to Title: recreates the BOOT state exactly — update() gates on screen === 'shop', so the
// shop freezes (no spawns, no timers, no autosave), just like before the first Open Shop. Save
// FIRST: autosave only runs on the shop screen, so without this a tab closed at the title could
// lose up to an autosave interval. Re-entry is the existing Open Shop handler (it resets the
// spawn grace too).
document.getElementById('menu-title-btn').addEventListener('click', () => {
  saveState(state);
  state.screen = 'title';
  menuOverlay.classList.add('hidden');
  resetArm(false);
  document.getElementById('title').classList.remove('hidden');
});

document.getElementById('open-shop-btn').addEventListener('click', () => {
  state.screen = 'shop';
  document.getElementById('title').classList.add('hidden');
  state.spawnTimer = CONFIG.queue.firstCustomerDelaySec;
  state.uiDirty = true;
});

renderHud(state);
renderPanels(state);

// Game loop: canvas redraws every frame; DOM panels re-render + autosave only when dirty (shop only,
// so the title screen doesn't overwrite the saved lastSeen that M5 reads at boot).
let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.1);   // clamp: a backgrounded tab can hand us a huge dt
  last = now;

  // Capture the front customer's want BEFORE update: if a worker serves this tick, this is who they
  // served. Reliable BECAUSE of the greet gate — a worker may only serve a customer who's already
  // been at the front >= greetSec, so a mob promoted mid-tick can never be the one served this tick.
  const preFrontItem = state.queue[0]?.wantedItemId;
  const preFrontMob  = state.queue[0]?.monsterId;   // same pre-tick capture, for the celebrant
  update(state, dt);
  // A worker auto-served this tick -> play Bob's serve one-shot, same as a manual serve. (Manual
  // serves fire the anim directly in onServe; this covers the auto path without duplicating it.)
  if (state.workerServed) {
    playBobServe(); playPortalOpen(); spawnItemFloat(preFrontItem); spawnCelebrant(preFrontMob);
    state.workerServed = false;
  }
  if (state.gregRestocked) {                      // trickle landed this tick -> Greg's shelf errand
    playGregErrand();                             // (visual echo only; the stock already moved)
    state.gregRestocked = false;
  }
  // Board chalk (life pass): armed by a FRESH market day (refreshMarketDay), consumed only once
  // the shop is actually on screen — a boot's morning waits through the title for Open Shop; a
  // midnight rollover mid-play fires immediately. One-shot, then the flag drops.
  if (state.boardChalkPending && state.screen === 'shop') {
    playBoardChalk();
    state.boardChalkPending = false;
  }
  drawScene(ctx, state, now);

  if (state.uiDirty) {
    renderHud(state);
    renderPanels(state);
    if (state.screen === 'shop') saveState(state);
    state.uiDirty = false;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
