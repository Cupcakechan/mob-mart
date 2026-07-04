// hud.js — top resource bar: Gold and Reputation (value + tier label + next-tier remainder).
import { formatGold } from '../utils.js';
import { reputationTier } from '../reputation.js';
import { nextTierInfo } from '../data/fametrack.js';

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
      <span class="hud-next" id="hud-next"></span>
    </div>`;
}

export function renderHud(state) {
  const gold = document.getElementById('hud-gold');
  if (gold) gold.textContent = formatGold(state.gold);

  const rep = document.getElementById('hud-rep');
  if (rep) rep.textContent = Math.floor(state.reputation);

  const tier = document.getElementById('hud-tier');
  // Dual-track Fame: the NUMBER is the spendable balance; the BADGE is the lifetime tier —
  // spending on perks lowers the number but can never lower the badge.
  if (tier) tier.textContent = reputationTier(state.lifetimeRep ?? state.reputation).label;

  // The one-line remainder ("· 32♛ to Trusted") — reads the LIFETIME track like the badge, so a
  // perk spend never inflates the distance; empty at the top of the ladder.
  const next = document.getElementById('hud-next');
  if (next) {
    const info = nextTierInfo(state.lifetimeRep ?? state.reputation);
    next.textContent = info ? `\u00b7 ${info.remaining}\u265b to ${info.label}` : '';
  }
}
