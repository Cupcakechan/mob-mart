// hud.js — top resource bar. M1: Gold only (Reputation joins the bar in M2).
import { formatGold } from '../utils.js';

export function initHud(root) {
  root.innerHTML = `
    <div class="hud-chip">
      <span class="hud-icon" aria-hidden="true">&#9670;</span>
      <span class="hud-label">Gold</span>
      <span class="hud-value" id="hud-gold">0</span>
    </div>`;
}

export function renderHud(state) {
  const el = document.getElementById('hud-gold');
  if (el) el.textContent = formatGold(state.gold);
}
