// hud.js — top resource bar: Gold and Reputation (value + tier label).
import { formatGold } from '../utils.js';
import { reputationTier } from '../reputation.js';

export function initHud(root) {
  root.innerHTML = `
    <div class="hud-chip">
      <span class="hud-icon" aria-hidden="true">&#9670;</span>
      <span class="hud-label">Gold</span>
      <span class="hud-value" id="hud-gold">0</span>
    </div>
    <div class="hud-chip">
      <span class="hud-icon rep" aria-hidden="true">&#9819;</span>
      <span class="hud-label">Rep</span>
      <span class="hud-value" id="hud-rep">0</span>
      <span class="hud-tier" id="hud-tier">&mdash;</span>
    </div>`;
}

export function renderHud(state) {
  const gold = document.getElementById('hud-gold');
  if (gold) gold.textContent = formatGold(state.gold);

  const rep = document.getElementById('hud-rep');
  if (rep) rep.textContent = Math.floor(state.reputation);

  const tier = document.getElementById('hud-tier');
  if (tier) tier.textContent = reputationTier(state.reputation).label;
}
