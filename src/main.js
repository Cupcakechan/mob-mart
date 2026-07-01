// main.js — entry point: wires DOM, scale-to-fit, input, save/load, nav, and the rAF game loop.
import { CONFIG } from './config.js';
import { clamp } from './utils.js';
import { update, serveCurrent, dismissCurrent, restockItem, buyUpgrade, hireWorker } from './game.js';
import { loadState, saveState, clearSave } from './save.js';
import { computeOffline, applyOffline, formatAway } from './offline.js';
import { drawScene, playBobServe, playPortalOpen } from './render/scene.js';
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
loadSprite('bob_idle',  'assets/sprites/bob_idle.png');   // 6-frame horizontal strip
loadSprite('bob_serve', 'assets/sprites/bob_serve.png');  // 6-frame horizontal strip

function resize() {
  const s = Math.min(window.innerWidth / CONFIG.stage.width, window.innerHeight / CONFIG.stage.height);
  stage.style.transform = `scale(${s})`;
}
window.addEventListener('resize', resize);
resize();

// UI wiring — panels/nav call back into game logic; game logic never touches the DOM.
initHud(document.getElementById('hud'));
initPanels(document.getElementById('shop-ui'), {
  onServe:      () => { if (serveCurrent(state)) { playBobServe(); playPortalOpen(); } },  // paid -> anims
  onDismiss:    () => dismissCurrent(state),
  onRestock:    (id) => restockItem(state, id),
  onBuyUpgrade: (id) => buyUpgrade(state, id),
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

  update(state, dt);
  // A worker auto-served this tick -> play Bob's serve one-shot, same as a manual serve. (Manual
  // serves fire the anim directly in onServe; this covers the auto path without duplicating it.)
  if (state.workerServed) { playBobServe(); playPortalOpen(); state.workerServed = false; }
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
