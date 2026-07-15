// hud.js — top resource bar: Gold and Reputation (value + tier label). The next-LEVEL remainder
// used to live here too; it moved to the Fame panel's standing line on 2026-07-15 (see style.css's
// LAYOUT BUDGET) — the row had outgrown the band and was running under the Menu button.
import { formatGold } from '../utils.js';
import { reputationTier, fameLevel } from '../reputation.js';

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
    </div>
    <div class="hud-chip scrap hidden" id="hud-scrap-chip" title="Salvage — Doug's haul from beyond the door">
      <span class="hud-icon scrap" aria-hidden="true">&#9881;</span>
      <span class="hud-label">Scrap</span>
      <span class="hud-value" id="hud-scrap">0</span>
    </div>`;
}

export function renderHud(state) {
  const gold = document.getElementById('hud-gold');
  if (gold) gold.textContent = formatGold(state.gold);

  const rep = document.getElementById('hud-rep');
  if (rep) rep.textContent = Math.floor(state.reputation);

  const tier = document.getElementById('hud-tier');
  // Dual-track Fame: the NUMBER is the spendable balance; the BADGE is the lifetime tier —
  // spending on perks lowers the number but can never lower the badge. F1a: the badge carries
  // the fame LEVEL beside the rung ("Renowned · Lv 13") — levels are the frequent beat, rungs
  // the rare one (FAME_ECONOMY_DESIGN.md §4).
  if (tier) {
    const fame = state.lifetimeRep ?? state.reputation;
    tier.textContent = `${reputationTier(fame).label} \u00b7 Lv ${fameLevel(fame)}`;
  }

  // The next-LEVEL remainder ("· 18047♛ to Lv 18") USED to render here. Retired from the HUD
  // 2026-07-15 (Daniel's call) and moved to the Fame panel's standing line, which is the panel
  // that already owned the rung remainder — one progress surface instead of two. The MEASURED
  // reason: the span cost ~146px of a band with none to spare, and the row was running under the
  // Menu button from ~10k gold onward. panels.js renders it now; reputation.js still exports
  // nextLevelInfo for it.

  // Scrap (§14): hidden until the scavenger is hired or scrap is banked — the early HUD stays
  // two-chip clean. Glyph follows the gold/rep text-glyph convention (⚙); icon_scrap.png stays
  // reserved for a future icon pass.
  const scrapChip = document.getElementById('hud-scrap-chip');
  const scrapVal = document.getElementById('hud-scrap');
  if (scrapChip && scrapVal) {
    const show = state.workers?.scavenger?.owned === true || (state.scrap ?? 0) > 0;
    scrapChip.classList.toggle('hidden', !show);
    scrapVal.textContent = Math.floor(state.scrap ?? 0);
  }

  // Market Day HUD chip RETIRED (Daniel, 2026-07-12): the floating "Weapons +50%" pill was
  // redundant chrome once the board, forecast, and ticker carried the market's story — and it
  // hovered awkwardly over the wall art. The EVENT SYSTEM is untouched: payouts still multiply,
  // the morning log line + Bob's bubble still announce, and the away modal still leads with the
  // day's market. The chip's markup/CSS live in git history if it ever earns its spot back.
}
