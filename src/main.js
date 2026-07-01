// main.js — entry point: wires DOM, scale-to-fit, input, save/load, nav, and the rAF game loop.
import { CONFIG } from './config.js';
import { clamp } from './utils.js';
import { update, serveCurrent, dismissCurrent, restockItem, buyUpgrade, hireWorker } from './game.js';
import { loadState, saveState, clearSave } from './save.js';
import { drawScene, playBobServe } from './render/scene.js';
import { loadSprite } from './render/sprites.js';
import { initHud, renderHud } from './ui/hud.js';
import { initPanels, renderPanels } from './ui/panels.js';
import { initNav } from './ui/nav.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;                 // crisp pixels once sprites replace the rects

const state = loadState();                         // resume from a saved shop, or a fresh one

// Diorama sprites — each falls back to a placeholder if its PNG is absent, so art can drop in
// piecemeal. Filenames match the ids the scene uses.
loadSprite('shop_bg', 'assets/sprites/shop_bg.png');   // full 1280x720 backdrop (wall+floor)
loadSprite('mimic_merchant', 'assets/sprites/mimic_merchant.png');
loadSprite('slime',    'assets/sprites/slime.png');
loadSprite('bat',      'assets/sprites/bat.png');
loadSprite('skeleton', 'assets/sprites/skeleton.png');
loadSprite('counter',  'assets/sprites/counter.png');
loadSprite('portal',   'assets/sprites/portal.png');
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
  onServe:      () => { if (serveCurrent(state)) playBobServe(); },  // serve -> play the anim
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
  if (state.workerServed) { playBobServe(); state.workerServed = false; }
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
