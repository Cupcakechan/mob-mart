// main.js — entry point: wires DOM, scale-to-fit, input, save/load, nav, and the rAF game loop.
import { CONFIG } from './config.js';
import { clamp } from './utils.js';
import { update, serveCurrent, dismissCurrent, restockItem, buyUpgrade } from './game.js';
import { loadState, saveState, clearSave } from './save.js';
import { drawScene } from './render/scene.js';
import { loadSprite } from './render/sprites.js';
import { initHud, renderHud } from './ui/hud.js';
import { initPanels, renderPanels } from './ui/panels.js';
import { initNav } from './ui/nav.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;                 // crisp pixels once sprites replace the rects

const state = loadState();                         // resume from a saved shop, or a fresh one

loadSprite('mimic_merchant', 'assets/sprites/mimic_merchant.png');

function resize() {
  const s = Math.min(window.innerWidth / CONFIG.stage.width, window.innerHeight / CONFIG.stage.height);
  stage.style.transform = `scale(${s})`;
}
window.addEventListener('resize', resize);
resize();

// UI wiring — panels/nav call back into game logic; game logic never touches the DOM.
initHud(document.getElementById('hud'));
initPanels(document.getElementById('shop-ui'), {
  onServe:      () => serveCurrent(state),
  onDismiss:    () => dismissCurrent(state),
  onRestock:    (id) => restockItem(state, id),
  onBuyUpgrade: (id) => buyUpgrade(state, id),
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
