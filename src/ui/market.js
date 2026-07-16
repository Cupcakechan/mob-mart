// market.js — the Trade Market OVERLAY (D6-B pulled forward, 2026-07-12 — Daniel's Option 2).
// A dedicated full-width surface for the daily trades: the featured offer as the "Special of the
// Day" headline, every posted offer as a FULL-NAME row (the readability fix the strip's one-line
// rows couldn't fit — material display names are up to 23 chars), material stocks with their caps,
// and tomorrow's forecast. Opened by clicking the canvas Market Board (main.js hit-tests
// scene.js's boardHitRect) or the Shop strip's Open Market button. The sim keeps RUNNING under it
// (the menu overlay's idle-honest law — an open-but-frozen idle game earns less than a closed
// tab). This pass is PRESENTATION ONLY: the featured DISCOUNT mechanic is the next pass's options
// round; the ticker quip bar rides after that (Daniel's staging, this session).
import { ITEMS } from '../data/items.js';
import { MATERIALS, MATERIAL_ORDER } from '../data/materials.js';
import { MONSTERS, MONSTER_IDS } from '../data/monsters.js';
import { tradeItemIds, featuredOffer, tradeDayKey, forecastDayKey, tickerSegments } from '../data/trademarket.js';
import { currentTradeOffers, canTrade, materialCap, isItemUnlocked, effectiveMaxStock,
  canFulfillCommission, commissionTerms, commissionDaysLeft, reservedFor } from '../game.js';   // + reform step 6, B1
import { MARKET_EVENTS, eventIdForDay, marketBannerText } from '../data/marketevents.js';   // F4 demand echo
import { CONFIG } from '../config.js';   // F4: the payout-mult default for the demand echo

let handlers = { onTrade: () => {}, onDirty: () => {} };
let rootEl = null;
let isOpen = false;
let tickerKey = null;   // the day the crawl was last built for — an innerHTML reset RESTARTS the
                        // CSS animation, and uiDirty fires every serve, so rebuild on rollover only

export function marketIsOpen() { return isOpen; }

// Open/close toggle .hidden (§87: the utility is !important, so it beats the overlay's own
// display:flex without a scoped override). Callers that open should follow with
// renderMarket(state) so the day's content is current on first paint.
export function openMarket() {
  if (!rootEl) return;
  isOpen = true;
  rootEl.classList.remove('hidden');
}
export function closeMarket() {
  if (!rootEl) return;
  isOpen = false;
  rootEl.classList.add('hidden');
}

// One offer as HTML — the FULL-NAME form ("Iron Buckler ⇐ [icon] 2 Polished Carapace Shard + 40g"),
// have/need tinting per component. A FEATURED offer renders the deal: the cut stack's original
// count and the original gold struck through beside the live values. PURE (string in-out) so the
// suite proves the full-name and was/now laws headlessly; renderMarket assigns it into the static
// rows. Icon fallback: onerror hides the img, the name still teaches.
export function offerRowHtml(offer, state) {
  if (!offer) return '';
  const parts = Object.entries(offer.materials).map(([mid, n]) => {
    const has = (state.materials?.[mid] ?? 0) >= n;
    const m = MATERIALS[mid];
    const orig = offer.origMaterials?.[mid];
    const was = orig !== undefined && orig !== n ? `<s class="offer-was">${orig}</s> ` : '';
    return `<span class="offer-mat ${has ? 'mat-ok' : 'mat-short'}"><img class="offer-mat-icon"`
      + ` src="assets/sprites/${m?.iconId ?? mid}.png" alt="" onerror="this.style.display='none'">`
      + `${was}${n} ${m?.displayName ?? mid}</span>`;
  });
  const goldOk = (state.gold ?? 0) >= offer.gold;
  const goldWas = offer.featured ? `<s class="offer-was">${offer.origGold}g</s> ` : '';
  const yTag = offer.rateDay === 'yesterday' ? ` <span class="rate-yesterday">(yesterday's rate)</span>` : '';   // the Yesterday Potion's tag
  return `<b>${ITEMS[offer.itemId]?.displayName ?? offer.itemId}</b> ⇐ ${parts.join('')}`
    + `<span class="${goldOk ? 'mat-ok' : 'mat-short'}"> + ${goldWas}${offer.gold}g</span>${yTag}`;
}

export function initMarket(root, h) {
  rootEl = root;
  handlers = { ...handlers, ...h };

  // Static structure; per-day content fills in renderMarket. Rows are one-per-TIER-item (the
  // strip's old pattern, relocated): the tier is static per session, only recipes/affordability
  // change daily. Row ids intentionally KEEP the strip's offer-text-<id> names — a pure relocation
  // keeps its addresses.
  root.innerHTML = `
    <div class="market-card">
      <div class="market-head">
        <h2 class="market-title">Trade Market</h2>
        <span id="mkt-day" class="market-day"></span>
        <button id="mkt-close" class="menu-close market-close">Close</button>
      </div>
      <div class="market-special">
        <span class="special-badge">Special of the Day</span>
        <span id="mkt-special" class="offer-text"></span>
      </div>
      <div class="market-demand">
        <span class="demand-badge">Today's Demand</span>
        <span id="mkt-demand" class="offer-text"></span>
      </div>
      <div id="mkt-commission" class="market-commission hidden">
        <span class="commission-badge">Special Order</span>
        <span id="mkt-comm-text" class="offer-text"></span>
        <button id="mkt-comm-fulfill" class="offer-trade">Fulfill</button>
      </div>
      <div id="mkt-offers" class="market-offer-list">${tradeItemIds().map((itemId) =>
        `<div class="offer-row" data-item-row="${itemId}">
           <span class="offer-text" id="offer-text-${itemId}"></span><button
           class="offer-trade" data-item="${itemId}">Trade</button></div>`).join('')}
      </div>
      <div class="market-foot">
        <div id="mkt-mats" class="market-mats"></div>
        <div id="mkt-forecast" class="market-forecast"></div>
      </div>
      <div class="market-ticker"><div class="ticker-track" id="mkt-ticker"></div></div>
    </div>`;

  // Material chips — every SOURCED material (the strip's twin scan; a new source auto-appears).
  // Overlay chips show count/CAP (room here; the strip stays count-only per Daniel's QA), so the
  // ids differ from the strip's mat-<id> — both surfaces render simultaneously.
  const sourced = new Set();
  for (const id of MONSTER_IDS) {
    if (MONSTERS[id].material) sourced.add(MONSTERS[id].material);
    if (MONSTERS[id].gradeMaterial) sourced.add(MONSTERS[id].gradeMaterial);
  }
  document.getElementById('mkt-mats').innerHTML = MATERIAL_ORDER
    .filter((mid) => sourced.has(mid))
    .map((mid) => {
      const m = MATERIALS[mid];
      return `<span class="mat-chip" title="${m.displayName}"><img class="mat-icon" src="assets/sprites/${m.iconId}.png" alt="" onerror="this.style.display='none'"><b id="mkt-mat-${m.id}">0</b></span>`;
    }).join('');

  // Scoped to [data-item]: the commission's Fulfill button SHARES the .offer-trade class for its
  // styling but is not a trade button — an unscoped sweep would double-bind it (reform step 6).
  root.querySelectorAll('.offer-trade[data-item]').forEach((btn) =>
    btn.addEventListener('click', () => handlers.onTrade(btn.dataset.offer ?? '')));
  document.getElementById('mkt-comm-fulfill').addEventListener('click', () => handlers.onFulfill());
  document.getElementById('mkt-close').addEventListener('click', () => closeMarket());
  root.addEventListener('click', (e) => { if (e.target === root) closeMarket(); });  // backdrop dismiss
}

export function renderMarket(state) {
  if (!isOpen || !rootEl) return;   // closed overlay costs nothing on the uiDirty path

  const offers = currentTradeOffers(state);
  const dayEl = document.getElementById('mkt-day');
  if (dayEl) dayEl.textContent = offers.length > 0 ? `${offers.length} trades posted today` : 'No trades today.';

  // The headline: today's featured offer (the same pick the canvas board advertises — one source,
  // trademarket's deterministic hash). Text-only: its Trade button is its own row below. The
  // discount pass will make THIS price diverge from the row's.
  const specialEl = document.getElementById('mkt-special');
  if (specialEl) specialEl.innerHTML = offerRowHtml(featuredOffer(tradeDayKey(state)), state);

  // F4 demand surface — the overlay's INFORMATIVE half of the doctrine pair (the board
  // advertises "DEMAND: Weapons tip today"; here the number). Derived from the same calendar
  // day as the board line (eventIdForDay ∘ tradeDayKey) so the two never disagree, and the
  // mult is resolved through the same registry-override ?? CONFIG default the payout uses.
  const demandEl = document.getElementById('mkt-demand');
  if (demandEl) {
    const ev = MARKET_EVENTS[eventIdForDay(tradeDayKey(state))];
    const mult = ev ? (ev.payoutMult ?? CONFIG.market?.payoutMult ?? 1) : 1;
    demandEl.textContent = ev ? marketBannerText(ev, mult) : 'Quiet market today.';
  }

  // THE SPECIAL ORDER (reform step 6): the named client's row. Hidden when no order is live
  // (a plain .hidden toggle — the utility is !important since §87). Terms render LIVE
  // (commissionTerms derives from today's multipliers, the same numbers fulfillment will pay);
  // "shelf n/N" is the progress read — the same units the queue is shopping from, which is the
  // decision. Fulfill disables with a reason, the offer buttons' own convention.
  const commEl = document.getElementById('mkt-commission');
  if (commEl) {
    const c = state.commission;
    const courier = !c && (state.commissionCooldownSec ?? 0) > 0;
    // REPEAT: three row states — a live order, the courier countdown (so the repeat is
    // DISCOVERABLE: a row that silently vanished taught players orders were daily), or hidden
    // (pre-license, or a day whose first order never seated).
    commEl.classList.toggle('hidden', !c && !courier);
    const fbtn0 = document.getElementById('mkt-comm-fulfill');
    if (fbtn0) fbtn0.classList.toggle('hidden', courier);
    if (courier) {
      const s = Math.ceil(state.commissionCooldownSec);
      const eta = s >= 3600 ? `~${Math.ceil(s / 360) / 10}h` : `~${Math.max(1, Math.ceil(s / 60))}m`;
      const textEl = document.getElementById('mkt-comm-text');
      if (textEl) textEl.innerHTML = `The courier is out finding the next client · back in <b>${eta}</b>`;
    }
    if (c) {
      const terms = commissionTerms(state, c);
      const left = commissionDaysLeft(state);
      const have = state.items[c.itemId]?.stock ?? 0;
      const textEl = document.getElementById('mkt-comm-text');
      if (textEl) {
        const held = reservedFor(state, c.itemId);   // B1: units set aside from the counter for this order
        textEl.innerHTML = `<b>${MONSTERS[c.monsterId]?.displayName ?? '???'}</b> orders `
          + `${c.count}× <b>${ITEMS[c.itemId]?.displayName ?? c.itemId}</b>`
          + ` · pays <b>${terms.gold}g</b> + ${terms.rep} fame`
          + ` · <span class="${left <= 1 ? 'comm-due' : ''}">${left <= 1 ? 'due tomorrow!' : `${left} days left`}</span>`
          + ` · shelf <span class="${have >= c.count ? 'mat-ok' : 'mat-short'}">${have}/${c.count}</span>`
          + (held > 0 ? ` · <span class="comm-reserved">${held} held from the counter</span>` : '');
      }
      const fbtn = document.getElementById('mkt-comm-fulfill');
      if (fbtn) {
        fbtn.disabled = !canFulfillCommission(state);
        fbtn.title = fbtn.disabled ? 'Not enough on the shelf — trade for more first' : '';
      }
    }
  }

  // The rows — the strip's fill loop, relocated verbatim (validation + tooltip reasons unchanged;
  // executeTrade re-validates the key against the CURRENT day, the midnight guard).
  for (const offer of offers) {
    const textEl = document.getElementById(`offer-text-${offer.itemId}`);
    const btn = rootEl.querySelector(`.offer-trade[data-item="${offer.itemId}"]`);
    if (!textEl || !btn) continue;
    textEl.innerHTML = offerRowHtml(offer, state);
    textEl.closest('.offer-row')?.classList.toggle('featured', !!offer.featured);   // the deal's row glows
    // REPEAT rider (Daniel, 2026-07-16): the Special Order's target row glows GREEN — the same
    // awareness treatment the gold deal gets, in the commission family's colour. Trading here is
    // how an under-stocked order gets filled, so the highlight marks the action, not just the fact.
    // (This loop's variable is `offer` — the builder loop above uses a bare `itemId`, and copying
    // its shape here shipped a ReferenceError that froze the overlay on open, 2026-07-16.)
    textEl.closest('.offer-row')?.classList.toggle('comm-target', state.commission?.itemId === offer.itemId);
    const goldOk = state.gold >= offer.gold;
    btn.disabled = !canTrade(state, offer);
    btn.dataset.offer = offer.key;
    btn.title = !isItemUnlocked(state, offer.itemId) ? 'License required first'
      : (state.items[offer.itemId]?.stock ?? 0) >= effectiveMaxStock(state, offer.itemId) ? 'Shelf is full'
      : !goldOk ? 'Not enough gold'
      : btn.disabled ? 'Missing materials' : '';
  }

  for (const mid of Object.keys(state.materials ?? {})) {
    const el = document.getElementById(`mkt-mat-${mid}`);
    if (el) el.textContent = `${state.materials[mid] ?? 0}/${materialCap(state, mid)}`;
  }

  const fcEl = document.getElementById('mkt-forecast');
  if (fcEl) {
    const fc = featuredOffer(forecastDayKey(state));
    fcEl.innerHTML = fc ? `<b>Tomorrow:</b> ${offerRowHtml(fc, state)}` : '';
  }

  // The LED crawl (Pass C — Daniel's Option 3): typed segments become colored spans; the track
  // holds the content TWICE so the -50% keyframe loops seamlessly. Speed scales with content
  // length for a constant px/sec feel. Rebuilt only when the day key changes (see tickerKey).
  const tickEl = document.getElementById('mkt-ticker');
  if (tickEl) {
    const dk = tradeDayKey(state);
    if (dk !== tickerKey) {
      tickerKey = dk;
      const sep = '<span class="tick-sep"> ◆ </span>';
      const html = tickerSegments(state).map((s) => s.t === 'move'
        ? `<span class="tick-name">${s.name}</span> <span class="${s.pct > 0 ? 'tick-up' : s.pct < 0 ? 'tick-down' : 'tick-flat'}">`
          + `${s.pct > 0 ? '▲' : s.pct < 0 ? '▼' : '•'}${Math.abs(s.pct)}%</span>`
        : `<span class="tick-quip">${s.s}</span>`).join(sep);
      tickEl.innerHTML = `${html}${sep}${html}${sep}`;
      tickEl.style.animationDuration = `${Math.max(24, Math.round(tickEl.textContent.length * 0.28))}s`;
    }
  }
}
