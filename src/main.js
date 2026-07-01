// main.js — entry point: wires DOM, scale-to-fit, input, and the rAF game loop.
import { CONFIG } from './config.js';
import { clamp } from './utils.js';
import { createInitialState } from './state.js';
import { update, serveCurrent, dismissCurrent, restockItem } from './game.js';
import { drawScene } from './render/scene.js';
import { loadSprite } from './render/sprites.js';
import { initHud, renderHud } from './ui/hud.js';
import { initPanels, renderPanels } from './ui/panels.js';

const stage = document.getElementById('stage');
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;                 // crisp pixels once sprites replace the rects

const state = createInitialState();

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

// Title -> Shop
document.getElementById('open-shop-btn').addEventListener('click', () => {
  state.screen = 'shop';
  document.getElementById('title').classList.add('hidden');
  state.nextCustomerTimer = CONFIG.queue.firstCustomerDelaySec;
  state.uiDirty = true;
});

// First paint
renderHud(state);
renderPanels(state);

// Game loop: canvas redraws every frame (animation); DOM panels re-render only when dirty
// (avoids 60fps DOM thrash and keeps the battle-log scroll position stable).
let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.1);   // clamp: a backgrounded tab can hand us a huge dt
  last = now;

  update(state, dt);
  drawScene(ctx, state, now);

  if (state.uiDirty) {
    renderHud(state);
    renderPanels(state);
    state.uiDirty = false;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
