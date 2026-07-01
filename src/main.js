// main.js — entry point: wires DOM, scale-to-fit, input, save/load, and the rAF game loop.
import { CONFIG } from './config.js';
import { clamp } from './utils.js';
import { update, serveCurrent, dismissCurrent, restockItem } from './game.js';
import { loadState, saveState, clearSave } from './save.js';
import { drawScene } from './render/scene.js';
import { loadSprite } from './render/sprites.js';
import { initHud, renderHud } from './ui/hud.js';
import { initPanels, renderPanels } from './ui/panels.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;                 // crisp pixels once sprites replace the rects

const state = loadState();                         // resume from a saved shop, or a fresh one

// Static art (piecemeal). Missing files fall back to placeholders, so this never blocks the game.
loadSprite('mimic_merchant', 'assets/sprites/mimic_merchant.png');

// Scale-to-fit: fit the fixed stage into the window, keeping canvas + DOM overlay locked together
// (one transform on the shared #stage wrapper, so the two layers can never drift apart).
function resize() {
  const s = Math.min(window.innerWidth / CONFIG.stage.width, window.innerHeight / CONFIG.stage.height);
  stage.style.transform = `scale(${s})`;
}
window.addEventListener('resize', resize);
resize();

// UI wiring — the panels call back into game logic; game logic never touches the DOM.
initHud(document.getElementById('hud'));
initPanels(document.getElementById('shop-ui'), {
  onServe:   () => serveCurrent(state),
  onDismiss: () => dismissCurrent(state),
  onRestock: (id) => restockItem(state, id),
});

// Reset — clears the save and reloads to a fresh shop. Confirmed because it's destructive.
document.getElementById('reset-btn').addEventListener('click', () => {
  if (window.confirm('Reset all progress? This clears your saved shop.')) {
    clearSave();
    location.reload();
  }
});

// Title -> Shop
document.getElementById('open-shop-btn').addEventListener('click', () => {
  state.screen = 'shop';
  document.getElementById('title').classList.add('hidden');
  state.spawnTimer = CONFIG.queue.firstCustomerDelaySec;
  state.uiDirty = true;
});

// First paint
renderHud(state);
renderPanels(state);

// Game loop: canvas redraws every frame (animation); DOM panels re-render only when dirty, and we
// autosave on the same signal (only once the shop is open, so the title screen doesn't overwrite
// the saved lastSeen that M5 will read at boot). localStorage writes are sub-millisecond.
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
