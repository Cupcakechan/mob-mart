// main.js — entry point: wires DOM, scale-to-fit, input, save/load, nav, and the rAF game loop.
import { CONFIG } from './config.js';
import { clamp } from './utils.js';
import { update, serveCurrent, dismissCurrent, restockItem, restockAll, buyUpgrade, buyPerk, buyLicense, hireWorker } from './game.js';
import { loadState, saveState, clearSave } from './save.js';
import { computeOffline, applyOffline, formatAway } from './offline.js';
import { drawScene, playBobServe, playPortalOpen, spawnItemFloat } from './render/scene.js';
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

// M6 — Kongregate bridge. Unconditional and safe on every platform: without the API's script tag
// (index.html locally / on itch) this is a silent no-op; on Kongregate (index.kongregate.html) it
// loads the API and submits the 'loaded' stat.
initKongregate();

// M5 — offline earnings, once at boot, BEFORE any autosave can refresh lastSeen. Compute what Bob
// sold while away (capped, stock-consuming), bank it, and save IMMEDIATELY: the save writes a fresh
// lastSeen, so a reload can't collect the same window twice. Modal only shows when there's actually
// something to report (quick reloads and worker-less/empty-shelf returns stay silent).
const offline = computeOffline(state, Date.now());
if (offline.sales > 0 && offline.awaySec >= CONFIG.offline.minAwaySec) {
  applyOffline(state, offline);
  saveState(state);
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText('offline-away',  formatAway(offline.cappedSec));   // show the time Bob WORKED (the capped span)
  setText('offline-sales', offline.sales);
  setText('offline-gold',  offline.gold);
  setText('offline-rep',   offline.rep);
  document.getElementById('offline-modal')?.classList.remove('hidden');
}
document.getElementById('offline-collect-btn')?.addEventListener('click', () => {
  document.getElementById('offline-modal')?.classList.add('hidden');
});

// Diorama sprites — each falls back to a placeholder if its PNG is absent, so art can drop in
// piecemeal. Filenames match the ids the scene uses.
loadSprite('shop_bg', 'assets/sprites/shop_bg.png');   // full 1280x720 backdrop (wall+floor)
loadSprite('mimic_merchant', 'assets/sprites/mimic_merchant.png');
loadSprite('slime',    'assets/sprites/slime.png');
loadSprite('bat',      'assets/sprites/bat.png');
loadSprite('skeleton', 'assets/sprites/skeleton.png');
loadSprite('counter',  'assets/sprites/counter.png');
loadSprite('portal',   'assets/sprites/portal.png');
loadSprite('portal_glow', 'assets/sprites/portal_glow.png');  // 4-frame swirl strip (640x160); absent -> static portal
loadSprite('portal_glow_mountain', 'assets/sprites/portal_glow_mountain.png');  // door destinations:
loadSprite('portal_glow_forest',   'assets/sprites/portal_glow_forest.png');    // same door, different
loadSprite('portal_glow_dungeon',  'assets/sprites/portal_glow_dungeon.png');   // world through it
loadSprite('bob_idle',  'assets/sprites/bob_idle.png');   // 6-frame horizontal strip
loadSprite('bob_serve', 'assets/sprites/bob_serve.png');  // 6-frame horizontal strip
loadSprite('club',         'assets/sprites/club.png');         // item icons (64x64) — used by the
loadSprite('metal_helmet', 'assets/sprites/metal_helmet.png'); // canvas purchase float; the DOM
loadSprite('hp_flask',     'assets/sprites/hp_flask.png');     // shelf cards load the same files
loadSprite('iron_sword',    'assets/sprites/iron_sword.png');    // tier-2 icons (authoring pending;
loadSprite('greater_flask', 'assets/sprites/greater_flask.png'); // floats skip + cards degrade to
loadSprite('knight_helm',   'assets/sprites/knight_helm.png');   // text until the PNGs land)
loadSprite('bat_idle', 'assets/sprites/bat_idle.png');            // Batty's 4-frame wing-flap strip (512x128)

function resize() {
  const s = Math.min(window.innerWidth / CONFIG.stage.width, window.innerHeight / CONFIG.stage.height);
  stage.style.transform = `scale(${s})`;
}
window.addEventListener('resize', resize);
resize();

// UI wiring — panels/nav call back into game logic; game logic never touches the DOM.
initHud(document.getElementById('hud'));
initPanels(document.getElementById('shop-ui'), {
  onServe:      () => {                                              // paid -> anims + item float
    const bought = state.queue[0]?.wantedItemId;                     // read BEFORE serve shifts the queue
    if (serveCurrent(state)) { playBobServe(); playPortalOpen(); spawnItemFloat(bought); }
  },
  onDismiss:    () => dismissCurrent(state),
  onRestock:    (id) => restockItem(state, id),
  onRestockAll: () => restockAll(state),
  onDirty:      () => { state.uiDirty = true; },   // shelf category switch -> re-render next frame
  onBuyUpgrade: (id) => buyUpgrade(state, id),
  onBuyPerk:    (id) => buyPerk(state, id),      // Fame perks: spends rep, never the lifetime track
  onBuyLicense: (id) => buyLicense(state, id),   // supplier licenses: one-time gold, unlocks tier-2
  onHireWorker: (id) => hireWorker(state, id),
});
initNav(document.getElementById('nav'));           // bottom nav swaps the center panel

document.getElementById('reset-btn').addEventListener('click', () => {
  if (window.confirm('Reset all progress? This clears your saved shop.')) {
    clearSave();
    location.reload();
  }
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
  update(state, dt);
  // A worker auto-served this tick -> play Bob's serve one-shot, same as a manual serve. (Manual
  // serves fire the anim directly in onServe; this covers the auto path without duplicating it.)
  if (state.workerServed) {
    playBobServe(); playPortalOpen(); spawnItemFloat(preFrontItem);
    state.workerServed = false;
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
