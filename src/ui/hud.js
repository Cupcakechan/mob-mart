// hud.js — top resource bar: Gold and Reputation (value + tier label + next-tier remainder).
import { formatGold } from '../utils.js';
import { reputationTier } from '../reputation.js';
import { nextTierInfo } from '../data/fametrack.js';
import { CONFIG } from '../config.js';
import { MARKET_EVENTS, marketBannerText, marketBannerCompact } from '../data/marketevents.js';

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
    </div>
    <div class="hud-chip scrap hidden" id="hud-scrap-chip" title="Salvage — Doug's haul from beyond the door">
      <span class="hud-icon scrap" aria-hidden="true">&#9881;</span>
      <span class="hud-label">Scrap</span>
      <span class="hud-value" id="hud-scrap">0</span>
    </div>
    <div class="hud-chip market hidden" id="hud-market-chip" title="Today's market: demand pays a bonus">
      <span class="hud-icon market" aria-hidden="true">&#9788;</span>
      <span class="hud-market-text" id="hud-market">&mdash;</span>
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

  // Market Day banner (compact since the layout pass, 2026-07-07): the chip shows the actionable
  // fact ("Armor +50%"); the full "Falling Rock Season · Armor +50%" rides the tooltip — the
  // event NAME also lives in the log line, Bob's bubble, and the away modal. Hidden only when no
  // event is derived (a headless state or pre-boot frame) — every calendar day has one. The mult
  // resolves registry-override ?? CONFIG here so the formatters stay pure.
  const chip = document.getElementById('hud-market-chip');
  const marketText = document.getElementById('hud-market');
  if (chip && marketText) {
    const ev = MARKET_EVENTS[state.marketEventId];
    chip.classList.toggle('hidden', !ev);
    if (ev) {
      const mult = ev.payoutMult ?? CONFIG.market?.payoutMult ?? 1;
      marketText.textContent = marketBannerCompact(ev, mult);
      chip.title = marketBannerText(ev, mult);
    }
  }
}
