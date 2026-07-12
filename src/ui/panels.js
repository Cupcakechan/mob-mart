// panels.js — DOM panels: current customer (front), Shelf (restock), Upgrades view, Workers view,
// battle log. The Shelf / Upgrades / Workers panels share the center slot; the bottom nav toggles
// which is visible.
import { setShopAttention, openTab } from './nav.js';
import { compactGold } from '../utils.js';
import { ITEM_BREAKPOINTS, MONSTER_BREAKPOINTS, MONSTER_REP_PER_BREAKPOINT,
  nextBreakpoint, crossedCount, bestiaryCompletion } from '../data/milestones.js';
import { PERKS, PERK_ORDER, perkCost } from '../data/perks.js';
import { trackByTier, nextTierInfo } from '../data/fametrack.js';
import { CONFIG } from '../config.js';
import { ITEMS, ITEM_ORDER } from '../data/items.js';
import { MONSTERS, MONSTER_IDS } from '../data/monsters.js';
import { UPGRADES, UPGRADE_ORDER, upgradeLevel, upgradeCost, isMaxed } from '../data/upgrades.js';
import { WORKERS, WORKER_ORDER, isWorkerOwned, workerHireCost,
  workerLevel, workerLevelCost, isWorkerLevelMaxed } from '../data/workers.js';
import { RELICS, RELIC_ORDER } from '../data/relics.js';   // the Forge (§14 Pass B)
import { MATERIALS, MATERIAL_ORDER } from '../data/materials.js';  // Trade Market (reform Pass B)
import {
  serveBlockReason, canRestock, effectiveMaxStock, canBuyUpgrade, isUpgradeUnlocked,
  canHireWorker, effectiveWorkerInterval, isPerkUnlocked, canBuyPerk, effectiveRestockCost,
  isItemUnlocked, canBuyLicense, fameOf, restockAllCost, canRestockAll, canBuyWorkerLevel,
  currentTradeOffers, materialCap, canStartExpedition,
} from '../game.js';
import { reputationTier } from '../reputation.js';
const reputationTierIndex = (state) => reputationTier(fameOf(state)).index;

let handlers = { onServe: () => {}, onDismiss: () => {}, onRestock: () => {}, onRestockAll: () => {}, onBuyUpgrade: () => {}, onBuyPerk: () => {}, onBuyLicense: () => {}, onHireWorker: () => {}, onOpenMarket: () => {}, onDirty: () => {} };
let activeCategory = 'weapon';   // shelf sub-tab (not persisted; category comes from the item registry)

// Switch the shelf's category sub-tab. Shared by the tab buttons and Bob's license bubble (which
// routes straight to the target license's category), so tab state can never drift between the two.
function setShelfCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll('.shelf-tab').forEach((b) =>
    b.classList.toggle('active', b.dataset.cat === activeCategory));
  handlers.onDirty();                              // re-render so the card filter applies now
}

export function initPanels(root, h) {
  handlers = h;
  root.innerHTML = `
    <section class="panel customer-panel">
      <div class="customer-info">
        <h2 class="panel-title">Current Customer</h2>
        <div id="customer-body" class="customer-body"></div>
      </div>
      <div class="customer-actions">
        <button id="serve-btn" class="serve-btn">Serve</button>
        <button id="dismiss-btn" class="dismiss-btn">Send Away</button>
      </div>
    </section>

    <section id="items-panel" class="panel items-panel">
      <div class="shelf-header">
        <h2 class="panel-title">Shelf</h2>
        <div class="shelf-tabs" id="shelf-tabs">
          <button class="shelf-tab active" data-cat="weapon">Weapons</button>
          <button class="shelf-tab" data-cat="armor">Armor</button>
          <button class="shelf-tab" data-cat="consumable">Consumables</button>
        </div>
        <button id="restock-all-btn" class="restock-all-btn">Restock All</button>
      </div>
      <div id="market-strip" class="market-strip">
        <div class="market-offer"><span class="market-board-title">Trade Market</span><span id="market-count"></span><button id="open-market-btn" class="open-market-btn">Open Market</button></div>
        <div class="market-row">
          <div id="market-mats" class="market-mats"></div>
        </div>
      </div>
      <div id="item-cards" class="item-cards"></div>
    </section>

    <section id="upgrades-panel" class="panel upgrades-panel hidden">
      <h2 class="panel-title">Upgrades</h2>
      <div id="upgrade-cards" class="upgrade-cards"></div>
      <h3 class="panel-subtitle">Fame Perks <span class="subtitle-hint">spend reputation</span></h3>
      <div id="perk-cards" class="upgrade-cards"></div>
    </section>

    <section id="workers-panel" class="panel workers-panel hidden">
      <h2 class="panel-title">Workers</h2>
      <div id="worker-cards" class="worker-cards"></div>
      <div id="forge-section" class="worker-cards hidden">
        <div class="panel-subhead">Doug&#8217;s Forge &#8212; found relics restored here go on display, forever</div>
        <div id="forge-rows"></div>
      </div>
    </section>

    <section id="fame-panel" class="panel fame-panel hidden">
      <h2 class="panel-title">Fame <span class="subtitle-hint" id="fame-standing"></span></h2>
      <div id="fame-track" class="fame-track"></div>
    </section>

    <section id="bestiary-panel" class="panel bestiary-panel hidden">
      <h2 class="panel-title">Bestiary <span class="subtitle-hint" id="bestiary-completion"></span></h2>
      <div id="beast-cards" class="beast-cards"></div>
    </section>

    <section class="panel log-panel">
      <h2 class="panel-title">Battle Results</h2>
      <ul id="battle-log" class="battle-log"></ul>
    </section>`;

  document.getElementById('serve-btn').addEventListener('click', () => handlers.onServe());
  document.getElementById('dismiss-btn').addEventListener('click', () => handlers.onDismiss());

  // Shelf cards (static structure; stock + cap + button state update at runtime).
  document.getElementById('item-cards').innerHTML = ITEM_ORDER.map((id) => {
    const it = ITEMS[id];
    return `<div class="item-card" data-item="${id}">
        <img class="item-icon" src="assets/sprites/${id}.png" alt=""
             onerror="this.style.display='none'">
        <div class="item-name">${it.displayName}</div>
        <div class="item-price">&#9670; ${it.basePrice}</div>
        <div class="item-stock">Stock: <span id="stock-${id}">0</span>/<span id="max-${id}">${it.maxStock}</span></div>
        <div class="item-sold"><b id="sold-${id}">0</b> sold<span id="next-${id}"></span></div>
        <button class="restock-btn" data-item="${id}">Restock &#9670;<span id="rcost-${id}">${it.restockCost}</span></button>
        <div class="trade-hint hidden">Trade at the Market Board</div>
        <button class="license-btn hidden" data-item="${id}"></button>
      </div>`;
  }).join('');
  document.querySelectorAll('.shelf-tab').forEach((btn) =>
    btn.addEventListener('click', () => setShelfCategory(btn.dataset.cat)));
  document.getElementById('restock-all-btn')
    .addEventListener('click', () => handlers.onRestockAll());
  // Trade Market (D6-B overlay pass): the offer LIST relocated to src/ui/market.js's overlay —
  // the strip keeps chips + the Open Market door (the design doc's sketch, verbatim). The strip's
  // one-line icon-only rows couldn't teach material names; the overlay's full-name rows can.
  document.getElementById('open-market-btn')
    .addEventListener('click', () => handlers.onOpenMarket());
  // Material chips: one per SOURCED material — serve faucets AND the Inspector's VIP drops
  // (material/gradeMaterial on any row), in MATERIAL_ORDER. A new source auto-appears.
  const sourced = new Set();
  for (const id of MONSTER_IDS) {
    if (MONSTERS[id].material) sourced.add(MONSTERS[id].material);
    if (MONSTERS[id].gradeMaterial) sourced.add(MONSTERS[id].gradeMaterial);
  }
  document.getElementById('market-mats').innerHTML = MATERIAL_ORDER
    .filter((mid) => sourced.has(mid))
    .map((mid) => {
      const m = MATERIALS[mid];
      return `<span class="mat-chip" title="${m.displayName}"><img class="mat-icon" src="assets/sprites/${m.iconId}.png" alt="" onerror="this.style.display='none'"><b id="mat-${m.id}">0</b></span>`;
    }).join('');

  root.querySelectorAll('.license-btn').forEach((btn) =>
    btn.addEventListener('click', () => handlers.onBuyLicense(btn.dataset.item)));
  root.querySelectorAll('.restock-btn').forEach((btn) =>
    btn.addEventListener('click', () => handlers.onRestock(btn.dataset.item)));

  // Upgrade cards (data-driven; cost/level/button update at runtime). Compact rows so the list fits
  // the left slot above the queue.
  document.getElementById('upgrade-cards').innerHTML = UPGRADE_ORDER.map((id) => {
    const u = UPGRADES[id];
    return `<div class="upgrade-card" data-upg="${id}">
        <div class="upg-info">
          <div class="upg-name">${u.displayName}</div>
          <div class="upg-desc">${u.description}</div>
        </div>
        <div class="upg-meta">
          <span class="upg-level" id="upglvl-${id}"></span>
          <span class="upg-cost" id="upgcost-${id}"></span>
        </div>
        <button class="upg-buy" data-upg="${id}">Buy</button>
      </div>`;
  }).join('');
  document.getElementById('perk-cards').innerHTML = PERK_ORDER.map((id) => {
    const p = PERKS[id];
    return `<div class="upgrade-card perk-card" data-perk="${id}">
        <div class="upg-info">
          <div class="upg-name">${p.displayName}</div>
          <div class="upg-desc">${p.description}</div>
        </div>
        <div class="upg-meta">
          <span class="upg-level" id="perklvl-${id}"></span>
          <span class="upg-cost perk-cost" id="perkcost-${id}"></span>
        </div>
        <button class="upg-buy perk-buy" data-perk="${id}">Buy</button>
      </div>`;
  }).join('');
  root.querySelectorAll('.perk-buy').forEach((btn) =>
    btn.addEventListener('click', () => handlers.onBuyPerk(btn.dataset.perk)));

  root.querySelectorAll('.upg-buy:not(.perk-buy)').forEach((btn) =>
    btn.addEventListener('click', () => handlers.onBuyUpgrade(btn.dataset.upg)));

  // Worker cards (data-driven; status + button update at runtime). Same compact-row look as upgrades.
  document.getElementById('worker-cards').innerHTML = WORKER_ORDER.map((id) => {
    const w = WORKERS[id];
    return `<div class="worker-card" data-worker="${id}">
        <div class="wrk-info">
          <div class="wrk-name">${w.displayName}</div>
          <div class="wrk-desc" id="wrkdesc-${id}"></div>
          <div class="wrk-level hidden" id="wrklvl-${id}"></div>
        </div>
        <button class="wrk-buy" data-worker="${id}">Hire</button>
        <button class="wrk-train hidden" data-worker="${id}">Train</button>
      </div>`;
  }).join('');
  root.querySelectorAll('.wrk-buy').forEach((btn) =>
    btn.addEventListener('click', () => handlers.onHireWorker(btn.dataset.worker)));
  root.querySelectorAll('.wrk-train').forEach((btn) =>
    btn.addEventListener('click', () => handlers.onBuyWorkerLevel(btn.dataset.worker)));

  // The Forge rows (§14 Pass B): one per relic, data-driven; status text + the Restore button
  // update at runtime (renderForge). Reuses the worker-card look — zero new CSS.
  document.getElementById('forge-rows').innerHTML = RELIC_ORDER.map((id) => `
    <div class="worker-card" data-relic="${id}">
      <div class="wrk-info">
        <div class="wrk-name" id="relicname-${id}">???</div>
        <div class="wrk-desc" id="relicdesc-${id}">Doug hasn't found this yet.</div>
      </div>
      <button class="wrk-buy forge-restore hidden" data-relic="${id}">Restore</button>
    </div>`).join('');
  root.querySelectorAll('.forge-restore').forEach((btn) =>
    btn.addEventListener('click', () => handlers.onRestoreRelic(btn.dataset.relic)));

  // Bob's hire arc: the goal chip over the empty counter routes to the remedy (the Workers tab).
  // Lives outside this root (a #stage sibling over the diorama) — same document, direct lookup.
  document.getElementById('hire-goal-chip')
    ?.addEventListener('click', () => openTab('workers'));

  // Bob's license bubble: click = take me to that license. Shop tab + the item's category — the
  // pulsing gold license button (renderPanels) finishes the trail. dataset.item is stamped by the
  // render from bobSpeech.current.itemId, so the route always matches the line being shown.
  document.getElementById('bob-bubble')?.addEventListener('click', function () {
    openTab('shop');
    const cat = ITEMS[this.dataset.item]?.category;
    if (cat) setShelfCategory(cat);
  });

  // Greg's restock bubble: click = restock the named item, straight through the same handler the
  // shelf buttons use (game-side canRestock guards double-fire; the render re-picks the next
  // most-urgent item on the resulting dirty pass).
  document.getElementById('greg-bubble')?.addEventListener('click', function () {
    if (this.dataset.item) handlers.onRestock(this.dataset.item);
  });

  // Fame track (UX roadmap 2): STATIC structure — the ladder is registry data, so the nodes and
  // their unlock chips are built once here; only reached/current classes and the header's standing
  // line change at runtime (renderPanels). Chip detail rides the title attribute (hover).
  document.getElementById('fame-track').innerHTML = trackByTier().map((n) => `
    <div class="fame-node" data-tier="${n.index}">
      <div class="fame-rail"><span class="fame-dot"></span></div>
      <div class="fame-node-body">
        <div class="fame-node-head">
          <span class="fame-node-label">${n.label}</span>
          <span class="fame-node-min">${n.min > 0 ? `&#9819; ${n.min}` : 'day one'}</span>
        </div>
        <div class="fame-unlocks">${n.unlocks.length
          ? n.unlocks.map((u) => `<span class="fame-chip ${u.kind}" title="${u.detail}">${u.label}</span>`).join('')
          : '<span class="fame-chip">A milestone of its own</span>'}</div>
      </div>
    </div>`).join('');

  // Bestiary cards (Pass 4a; data-driven — Gobbo will auto-appear from the registry). DISPLAY
  // LAYER ONLY: the Pass-1 loyalty ledger (state.stats.monsterServes) is the single source of
  // truth; this pass adds no new counting, no save change. One pip per MONSTER_BREAKPOINT.
  document.getElementById('beast-cards').innerHTML = MONSTER_IDS.filter((id) => !MONSTERS[id].special).map((id) => {
    const m = MONSTERS[id];
    const pips = MONSTER_BREAKPOINTS.map(() => '<span class="beast-pip"></span>').join('');
    return `<div class="beast-card" data-beast="${id}">
        <img class="beast-portrait" src="assets/sprites/${m.spriteId ?? id}.png" alt=""
             onerror="this.style.display='none'">
        <div class="beast-info">
          <div class="beast-name" id="beast-name-${id}">${m.displayName}</div>
          <div class="beast-sub" id="beast-sub-${id}"></div>
          <div class="beast-exp-row"><span class="beast-exp" id="beast-exp-${id}"></span><button
            class="beast-send" data-beast="${id}">Send &#9670;${CONFIG.expedition?.fee ?? 25}</button></div>
        </div>
        <div class="beast-progress">
          <div class="beast-pips" id="beast-pips-${id}">${pips}</div>
          <div class="beast-next" id="beast-next-${id}"></div>
        </div>
      </div>`;
  }).join('');

  // Expeditions (reform step 4): the grid cards are the JOB CARDS (Daniel, 2026-07-11 — a pure
  // lore Bestiary is a later, separate surface). One binding pass; VIP cards never carry the
  // button (the grid filter above already excludes specials).
  document.querySelectorAll('.beast-send').forEach((btn) =>
    btn.addEventListener('click', () => handlers.onExpedition(btn.dataset.beast)));

  // VIP VISITORS (Daniel, 2026-07-08): special rows DO get bestiary entries — their own section
  // under the grid, not rows in it. Same card system, same discovered/silhouette reveal (a mystery
  // card until the first visit), but no pips/next — VIPs are trophies, not ladders, and the
  // completion % stays a field guide of REGULARS (grid-only, suite-pinned). Built JS-side so
  // index.html (and the Kong mirror) stay untouched; idempotence-guarded like all init work.
  const vipIds = MONSTER_IDS.filter((id) => MONSTERS[id].special);
  if (vipIds.length && !document.getElementById('beast-vip-cards')) {
    document.getElementById('beast-cards')?.insertAdjacentHTML('afterend',
      `<div class="beast-vip-header">VIP Visitors</div>
       <div id="beast-vip-cards">${vipIds.map((id) => {
        const m = MONSTERS[id];
        return `<div class="beast-card vip" data-beast="${id}">
            <img class="beast-portrait" src="assets/sprites/${m.spriteId ?? id}.png" alt=""
                 onerror="this.style.display='none'">
            <div class="beast-info">
              <div class="beast-name" id="beast-name-${id}">${m.displayName}</div>
              <div class="beast-sub" id="beast-sub-${id}"></div>
            </div>
            <div class="beast-progress"><div class="beast-next vip" id="beast-next-${id}"></div></div>
          </div>`;
      }).join('')}</div>`);
  }
}

const REASON_LABEL = {
  'no-customer': 'No customer',
  'cooling-down': 'Serving\u2026',
  'out-of-stock': 'Out of stock',
  'cant-afford': "Can't afford it",
  'no-item': '\u2014',
};

export function renderPanels(state) {
  // --- Current customer (front of line) ---
  const body = document.getElementById('customer-body');
  const serveBtn = document.getElementById('serve-btn');
  const dismissBtn = document.getElementById('dismiss-btn');
  const c = state.queue[0];

  if (c) {
    const m = MONSTERS[c.monsterId];
    const want = ITEMS[c.wantedItemId];
    const waiting = state.queue.length - 1;
    // Want/budget now live in the canvas speech bubble above the mob (hybrid stage 2); the panel
    // keeps the name (context for the buttons below it) and the line count.
    body.innerHTML = `
      <div class="cust-name">${m?.displayName ?? '???'}</div>
      <div class="cust-line">${waiting > 0 ? `${waiting} more in line` : 'No one else in line'}</div>`;
    const reason = serveBlockReason(state);
    serveBtn.disabled = reason !== null;
    serveBtn.textContent = reason ? (REASON_LABEL[reason] ?? 'Serve') : `Serve ${want?.displayName ?? ''}`;
  } else {
    body.innerHTML = `<div class="cust-empty">The shop is quiet&hellip; someone will wander in.</div>`;
    serveBtn.disabled = true;
    serveBtn.textContent = 'Serve';
  }
  dismissBtn.disabled = !c;

  // --- Shelf: stock + (upgradeable) cap + restock affordability ---
  for (const id of ITEM_ORDER) {
    const stockEl = document.getElementById(`stock-${id}`);
    if (stockEl) stockEl.textContent = state.items[id]?.stock ?? 0;
    const maxEl = document.getElementById(`max-${id}`);
    if (maxEl) maxEl.textContent = effectiveMaxStock(state, id);
    // Regulars' Loyalty: lifetime count + the next breakpoint = a visible want on every card.
    const sold = state.stats?.itemSales?.[id] ?? 0;
    const soldEl = document.getElementById(`sold-${id}`);
    if (soldEl) soldEl.textContent = sold;
    const nextEl = document.getElementById(`next-${id}`);
    if (nextEl) {
      const nb = nextBreakpoint(sold, ITEM_BREAKPOINTS);
      nextEl.textContent = nb !== null ? ` · next ${nb}` : ' · maxed';
    }
    const rcostEl = document.getElementById(`rcost-${id}`);
    if (rcostEl) rcostEl.textContent = effectiveRestockCost(state, id);   // Haggler's Charm live
    // Supplier licenses: a locked card sells its LICENSE instead of restocks — the visible want.
    const card = document.querySelector(`.item-card[data-item="${id}"]`);
    const restockBtn = card?.querySelector('.restock-btn');
    const licenseBtn = card?.querySelector('.license-btn');
    const lic = ITEMS[id].license;
    if (lic && restockBtn && licenseBtn) {
      const unlocked = isItemUnlocked(state, id);
      const tierReached = reputationTierIndex(state) >= (lic.requiredTier ?? 0);
      const affordable = canBuyLicense(state, id);   // tier + unowned + GOLD
      card.classList.toggle('locked', !unlocked);
      // License indicator, two-stage (Daniel's call, 2026-07-04): the blinking bright-gold card
      // frame means BUY ME NOW — eligible AND affordable. Eligible-but-broke keeps only the
      // subtle gold breathe on the button below ("this exists for you, save up"). Note the split:
      // Bob's bubble still triggers on eligibility alone; only the BLINK is gold-gated, so it
      // switches on/off live as gold crosses the license cost.
      card.classList.toggle('license-ready', !unlocked && affordable);
      restockBtn.classList.toggle('hidden', !unlocked);
      licenseBtn.classList.toggle('hidden', unlocked);
      if (!unlocked) {
        const tierLabel = CONFIG.reputation.tiers[lic.requiredTier ?? 0]?.label ?? '???';
        licenseBtn.textContent = tierReached ? `License ◆${lic.cost}` : `Reach ${tierLabel}`;
        licenseBtn.disabled = !canBuyLicense(state, id);
        // Standing gold on the button rides the card's blink (CSS keys off .license-ready);
        // eligibility, never affordability — it pulses even while broke, because "save up for
        // this" IS the guidance.
        licenseBtn.classList.toggle('attention', tierReached);
      } else {
        licenseBtn.classList.remove('attention');
      }
    }
    // Trade-tier cards (reform Pass A): once licensed, this card's inflow is the Market Board,
    // not gold restock. Runs AFTER the license toggle above ON PURPOSE — that block un-hides
    // restockBtn every frame for unlocked cards, and trade must win. While still LOCKED the
    // license button keeps the stage (the license remains the sell gate, unchanged).
    if (restockBtn) {
      const isTrade = (ITEMS[id].acquisition ?? 'gold') !== 'gold';
      const showHint = isTrade && isItemUnlocked(state, id);
      if (showHint) restockBtn.classList.add('hidden');
      card?.querySelector('.trade-hint')?.classList.toggle('hidden', !showHint);
    }
  }
  document.querySelectorAll('.restock-btn').forEach((btn) => {
    btn.disabled = !canRestock(state, btn.dataset.item);
  });

  // Category filter (Pass 3.5): only the active category's cards show — the shelf never stacks
  // vertically again no matter how many items the registry grows.
  document.querySelectorAll('.item-card').forEach((card) =>
    card.classList.toggle('hidden', ITEMS[card.dataset.item]?.category !== activeCategory));

  // Restock All: quote = full fill at effective costs; enabled while ANY unit is buyable.
  // Quote COMPACTS at 1000+ (clip fix, 2026-07-05): the header row's minimum width is fixed but
  // the quote grows with roster + maxStock — the exact figure rides the tooltip.
  const raBtn = document.getElementById('restock-all-btn');
  if (raBtn) {
    const quote = restockAllCost(state);
    raBtn.textContent = quote > 0 ? `Restock All ◆${compactGold(quote)}` : 'Stocked';
    raBtn.title = quote >= 1000 ? `◆${quote} exact` : '';
    raBtn.disabled = !canRestockAll(state);
  }

  // Trade Market (D6-B overlay pass): the row fill + category filter moved to market.js's
  // renderMarket — the overlay shows ALL of today's offers with full names (space exists there).
  // The strip keeps only the count line as the door's label.
  const offers = currentTradeOffers(state);
  const countEl = document.getElementById('market-count');
  if (countEl) countEl.textContent = offers.length > 0 ? `${offers.length} trades posted today` : 'No trades today.';
  for (const mid of Object.keys(state.materials ?? {})) {
    const el = document.getElementById(`mat-${mid}`);
    if (el) {
      el.textContent = `${state.materials[mid] ?? 0}`;        // count only — compact (Daniel's QA)
      const chip = el.closest('.mat-chip');
      if (chip) chip.title = `${MATERIALS[mid]?.displayName ?? mid}: ${state.materials[mid] ?? 0}/${materialCap(state, mid)}`;
    }
  }

  // Expeditions (reform step 4): the Job Card row per grid family — lifetime runs, the live
  // countdown on the away family (update() marks dirty at 1Hz), and the Send button with its
  // block reason on the tooltip (the strip's own trick).
  for (const id of MONSTER_IDS) {
    const expEl = document.getElementById(`beast-exp-${id}`);
    const sendBtn = document.querySelector(`.beast-send[data-beast="${id}"]`);
    if (!expEl || !sendBtn) continue;
    const away = state.expedition?.monsterId === id;
    const runs = state.stats?.expeditions?.[id] ?? 0;
    expEl.textContent = away ? `away ${Math.max(0, Math.ceil(state.expedition.remaining))}s`
      : runs > 0 ? `${runs} run${runs === 1 ? '' : 's'}` : '';
    sendBtn.disabled = !canStartExpedition(state, id);
    sendBtn.title = away ? 'Already out there'
      : state.expedition ? 'One expedition at a time'
      : state.gold < (CONFIG.expedition?.fee ?? 25) ? 'Not enough gold' : '';
  }

  // Attention system: the FRONT customer's sale is blocked by empty stock -> pulse exactly that
  // shelf card (and, via setShopAttention, the Shop tab when the shelf isn't visible). Deliberately
  // front-only: it means "a sale is blocked RIGHT NOW", so the pulse stays rare and meaningful —
  // a signal that's always on is a signal nobody sees. With category tabs the signal hops levels:
  // nav pulse (panel closed) -> category tab pulse (wrong tab open) -> card pulse (right tab open).
  const starvedId = (c && (state.items[c.wantedItemId]?.stock ?? 0) <= 0) ? c.wantedItemId : null;
  const starvedCat = starvedId ? ITEMS[starvedId]?.category : null;
  document.querySelectorAll('.item-card').forEach((card) =>
    card.classList.toggle('attention', card.dataset.item === starvedId));
  document.querySelectorAll('.shelf-tab').forEach((tab) =>
    tab.classList.toggle('attention', starvedCat !== null && tab.dataset.cat === starvedCat
      && activeCategory !== starvedCat));
  setShopAttention(starvedId !== null);

  // --- Fame perks: locked state (LIFETIME tier), level, rep cost, buyability ---
  for (const id of PERK_ORDER) {
    const p = PERKS[id];
    const card = document.querySelector(`.perk-card[data-perk="${id}"]`);
    if (!card) continue;
    const unlocked = isPerkUnlocked(state, id);
    card.classList.toggle('locked', !unlocked);
    const lvl = document.getElementById(`perklvl-${id}`);
    const cost = document.getElementById(`perkcost-${id}`);
    const btn = card.querySelector('.perk-buy');
    const level = state.perks?.[id] ?? 0;
    const maxed = level >= (p.maxLevel ?? Infinity);
    if (!unlocked) {
      const tierLabel = CONFIG.reputation.tiers[p.requiredTier]?.label ?? '???';
      if (lvl) lvl.textContent = '';
      if (cost) cost.textContent = `Reach ${tierLabel}`;
      if (btn) { btn.disabled = true; btn.textContent = 'Locked'; }
    } else {
      if (lvl) lvl.textContent = maxed ? `Lv ${level} · Max` : `Lv ${level}`;
      if (cost) cost.textContent = maxed ? 'MAX' : `♛ ${perkCost(id, level)}`;
      if (btn) { btn.disabled = !canBuyPerk(state, id); btn.textContent = maxed ? 'Maxed' : 'Buy'; }
    }
  }

  // --- Upgrades: locked state (rep tier), level, cost, buyability ---
  for (const id of UPGRADE_ORDER) {
    const u = UPGRADES[id];
    const lvl = upgradeLevel(state, id);
    const maxed = isMaxed(state, id);
    const unlocked = isUpgradeUnlocked(state, id);

    const card = document.querySelector(`.upgrade-card[data-upg="${id}"]`);
    if (card) card.classList.toggle('locked', !unlocked);

    const lvlEl = document.getElementById(`upglvl-${id}`);
    if (lvlEl) lvlEl.textContent = maxed ? `Lv ${lvl} · Max` : `Lv ${lvl}`;

    const costEl = document.getElementById(`upgcost-${id}`);
    // Hide the cost while locked (the button carries the unlock requirement instead).
    if (costEl) costEl.innerHTML = !unlocked ? '' : (maxed ? 'MAX' : `&#9670; ${upgradeCost(id, lvl)}`);

    const buyBtn = document.querySelector(`.upg-buy[data-upg="${id}"]`);
    if (buyBtn) {
      if (!unlocked) {
        buyBtn.disabled = true;
        const tier = CONFIG.reputation.tiers[u.requiredTier]?.label ?? '???';
        buyBtn.textContent = `Reach ${tier}`;
      } else {
        buyBtn.disabled = !canBuyUpgrade(state, id);
        buyBtn.textContent = maxed ? 'Maxed' : 'Buy';
      }
    }
  }

  // --- Workers: hire cost when unowned; "active" + rough interval once hired ---
  for (const id of WORKER_ORDER) {
    const w = WORKERS[id];
    const owned = isWorkerOwned(state, id);
    const card = document.querySelector(`.worker-card[data-worker="${id}"]`);
    if (card) card.classList.toggle('owned', owned);

    const descEl = document.getElementById(`wrkdesc-${id}`);
    const buyBtn = document.querySelector(`.wrk-buy[data-worker="${id}"]`);
    const lvlEl = document.getElementById(`wrklvl-${id}`);
    const trainBtn = document.querySelector(`.wrk-train[data-worker="${id}"]`);
    if (owned) {
      if (descEl) {
        const secs = effectiveWorkerInterval(state, id);
        descEl.textContent = WORKERS[id].role === 'serve'
          ? `Auto-serves the front \u00b7 ~${secs.toFixed(1)}s`
          : WORKERS[id].role === 'scavenge'
            ? `Scavenges the beyond \u00b7 ~${secs.toFixed(0)}s a run`   // (Pass A shipped the restock
            : `Restocks 1 unit \u00b7 ~${secs.toFixed(1)}s`;            //  copy here by mistake — fixed)
      }
      if (buyBtn) { buyBtn.disabled = true; buyBtn.textContent = 'Active'; }
      // Training row (Deep Sinks): level + live effect line, and a Train button that names its
      // blocker — price when buyable, "Reach Mythic" at the deep gate (the license-button
      // pattern), MAX at the top. Exact cost rides the tooltip; the label compacts (5-digit rungs).
      const L = WORKERS[id].levels;
      if (L && lvlEl && trainBtn) {
        const lvl = workerLevel(state, id);
        lvlEl.classList.remove('hidden');
        lvlEl.textContent = `${L.name} Lv ${lvl}/${L.maxLevel} \u00b7 ${L.desc}`;
        trainBtn.classList.remove('hidden');
        if (isWorkerLevelMaxed(state, id)) {
          trainBtn.disabled = true; trainBtn.textContent = 'MAX'; trainBtn.title = '';
        } else if ((lvl + 1) >= (L.deepFrom ?? Infinity)
                   && reputationTierIndex(state) < (L.deepTier ?? 0)) {
          trainBtn.disabled = true;
          trainBtn.textContent = `Reach ${CONFIG.reputation.tiers[L.deepTier]?.label ?? '???'}`;
          trainBtn.title = '';
        } else {
          const cost = workerLevelCost(id, lvl);
          trainBtn.disabled = !canBuyWorkerLevel(state, id);
          trainBtn.innerHTML = `Train &#9670;${compactGold(cost)}`;
          trainBtn.title = `\u25c6 ${cost}`;                  // compactGold rule: exact figure in the tooltip
        }
      }
    } else {
      if (descEl) descEl.textContent = w.role === 'serve' ? 'Serves customers automatically' : 'Restocks automatically';
      lvlEl?.classList.add('hidden');                         // Back-to-Title re-renders must reset these
      trainBtn?.classList.add('hidden');
      if (buyBtn) {
        // Fame-gated hires (Greg): below the tier, the button names the gate instead of the price —
        // the license-button pattern. ?? 0 keeps ungated workers (Bob) on the price path.
        const tierIdx = w.requiredTier ?? 0;
        const tierReached = reputationTierIndex(state) >= tierIdx;
        buyBtn.disabled = !canHireWorker(state, id);
        buyBtn.innerHTML = tierReached
          ? `Hire &#9670; ${workerHireCost(id)}`
          : `Reach ${CONFIG.reputation.tiers[tierIdx]?.label ?? '???'}`;
      }
    }
  }

  // --- Bob's hire arc: the goal chip shows while the FIRST merchant is unhired; hiring hides it
  // (hireWorker sets uiDirty, so it vanishes the same render). Old saves with owned already true
  // never see it. Cost reads the live worker registry, so a hireCost retune can't drift the label.
  const hireChip = document.getElementById('hire-goal-chip');
  if (hireChip) {
    const bobOwned = isWorkerOwned(state, 'mimic_merchant');
    hireChip.classList.toggle('hidden', bobOwned);
    if (!bobOwned) hireChip.innerHTML =
      `The counter needs a merchant!<br><b>Hire Bob &mdash; &#9670; ${workerHireCost('mimic_merchant')}</b>`;
  }

  // --- Greg's restock bubble (Option 1 + duty cycle, 2026-07-05): shows only while the game-side
  // cycle says so (state.gregBubble.showFor > 0 — pops ~10s per ~45s while something's out) AND
  // Greg is hired AND something unlocked is out. The target re-derives per render: a mid-show
  // restock retargets to the next out item or hides early. Anchored at Greg's HOME (fixed CSS) —
  // he may be mid-errand under an active bubble; that's his post reporting, and it's brief.
  const gregBubble = document.getElementById('greg-bubble');
  if (gregBubble) {
    const showing = (state.gregBubble?.showFor ?? 0) > 0 && isWorkerOwned(state, 'restocker');
    const quip = showing ? state.gregBubble?.quip : null;
    if (quip) {
      // The hire quip: pure flavor for one window — no target, no affordability, not clickable.
      gregBubble.classList.remove('hidden', 'affordable');
      gregBubble.disabled = true;
      gregBubble.dataset.item = '';
      gregBubble.textContent = quip;
    } else {
      const isOut = (id) => isItemUnlocked(state, id) && state.items[id].stock === 0;
      const front = state.queue[0]?.wantedItemId;
      const target = showing
        ? ((front && isOut(front)) ? front : ITEM_ORDER.find(isOut) ?? null)
        : null;
      gregBubble.classList.toggle('hidden', !target);
      if (target) {
        const affordable = canRestock(state, target);
        gregBubble.disabled = !affordable;
        gregBubble.classList.toggle('affordable', affordable);
        gregBubble.dataset.item = target;
        gregBubble.innerHTML =
          `${ITEMS[target].displayName} out &mdash; <b>Restock &#9670; ${effectiveRestockCost(state, target)}</b>`;
      }
    }
  }

  // --- Bob's license bubble (DOM): show state.bobSpeech.current over Bob's head — but only once
  // Bob EXISTS (hire arc: no Bob, no anchor; game.js keeps ticking and the reminder re-raises, so
  // an early crossing is never lost). dataset.item carries the click route's target.
  const bobBubble = document.getElementById('bob-bubble');
  if (bobBubble) {
    const cur = state.bobSpeech?.current;
    const show = !!cur && isWorkerOwned(state, 'mimic_merchant');
    bobBubble.classList.toggle('hidden', !show);
    if (show) {
      bobBubble.textContent = cur.text;
      bobBubble.dataset.item = cur.itemId ?? '';
    }
  }

  // --- Fame track: reached/current node state + the dual-track standing line. The header is the
  // spendable-vs-lifetime separator the panel owes: the BADGE-driving number (lifetime) and the
  // WALLET (spendable) side by side, plus the same remainder the HUD carries. ---
  {
    const fame = fameOf(state);
    const tierIdx = reputationTierIndex(state);
    document.querySelectorAll('.fame-node').forEach((node) => {
      const i = Number(node.dataset.tier);
      node.classList.toggle('reached', i < tierIdx);
      node.classList.toggle('current', i === tierIdx);
    });
    const standing = document.getElementById('fame-standing');
    if (standing) {
      const next = nextTierInfo(fame);
      standing.innerHTML =
        `lifetime <b>&#9819; ${Math.floor(fame)}</b> \u00b7 to spend <b>&#9819; ${Math.floor(state.reputation)}</b>`
        + (next ? ` \u00b7 ${next.remaining}&#9819; to ${next.label}` : ' \u00b7 top of the ladder');
    }
  }

  // --- Bestiary: lifetime serves -> loyalty pips + studied % (display over the Pass-1 ledger) ---
  const comp = bestiaryCompletion(state);
  const compEl = document.getElementById('bestiary-completion');
  if (compEl) compEl.textContent = `${comp.pct}% studied`;
  for (const id of MONSTER_IDS) {
    const card = document.querySelector(`.beast-card[data-beast="${id}"]`);
    if (!card) continue;
    const served = state.stats?.monsterServes?.[id] ?? 0;
    // Undiscovered = never served: silhouette + ??? until first serve. Moot for the launch trio on
    // existing saves, but it makes a NEW monster's debut (Gobbo, next pass) a reveal, not a row.
    const discovered = served > 0;
    card.classList.toggle('undiscovered', !discovered);
    const nameEl = document.getElementById(`beast-name-${id}`);
    if (nameEl) nameEl.textContent = discovered ? (MONSTERS[id]?.displayName ?? id) : '???';
    const crossed = crossedCount(served, MONSTER_BREAKPOINTS);
    const isVip = MONSTERS[id]?.special === true;
    const subEl = document.getElementById(`beast-sub-${id}`);
    if (subEl) {
      // VIP cards speak visit language and skip the rep-mult line — trophies, not ladders.
      subEl.textContent = isVip
        ? (discovered ? `Visits ${served}` : 'Not yet visited')
        : (discovered
          ? `Served ${served}${crossed > 0
              ? ` \u00b7 +${Math.round(crossed * MONSTER_REP_PER_BREAKPOINT * 100)}% rep` : ''}`
          : 'Not yet served');
    }
    const pipsEl = document.getElementById(`beast-pips-${id}`);
    if (pipsEl) [...pipsEl.children].forEach((pip, i) => pip.classList.toggle('filled', i < crossed));
    const nextEl = document.getElementById(`beast-next-${id}`);
    if (nextEl) {
      const nb = nextBreakpoint(served, MONSTER_BREAKPOINTS);
      nextEl.textContent = isVip ? (discovered ? 'VIP' : '')
        : (!discovered ? '' : (nb !== null ? `next ${nb}` : 'maxed'));
    }
  }

  // --- Battle log ---
  const log = document.getElementById('battle-log');
  if (log) {
    log.innerHTML = state.log.map((e) => {
      const cls = e.golden ? 'golden'                        // 100-serve payoff lines outrank tiers
        : (e.tier === 'milestone' ? 'milestone'
        : (e.tier === 'market' ? 'market'                    // Market Day: amber "world news" lines
        : (e.repDelta > 0 ? 'good' : (e.repDelta < 0 ? 'bad' : 'meh'))));
      const crown = e.repDelta !== 0
        ? `<span class="log-crown">${e.repDelta > 0 ? '+' : ''}${e.repDelta}&#9819;</span>`
        : '';
      return `<li class="log-item ${cls}"><span class="log-text">${e.text}</span>${crown}</li>`;
    }).join('');
  }
}


// The Forge's runtime face (§14 Pass B): section visibility (Doug hired), per-relic status —
// ??? until found, name + card + priced Restore once found, 'On display' once restored. Called
// from main.js on the same dirty pass as renderPanels (kept OUT of renderPanels: independent
// concern, independent anchor).
export function renderForge(state) {
  const section = document.getElementById('forge-section');
  if (!section) return;
  const show = state.workers?.scavenger?.owned === true;
  section.classList.toggle('hidden', !show);
  if (!show) return;
  for (const id of RELIC_ORDER) {
    const r = RELICS[id], st = state.relics?.[id];
    const name = document.getElementById(`relicname-${id}`);
    const desc = document.getElementById(`relicdesc-${id}`);
    const btn = document.querySelector(`.forge-restore[data-relic="${id}"]`);
    if (!name || !desc || !btn) continue;
    if (!st) {
      name.textContent = '???';
      desc.textContent = "Doug hasn't found this yet.";
      btn.classList.add('hidden');
    } else if (st === 'found') {
      name.textContent = r.displayName;
      desc.textContent = `${r.card} \u2014 broken. Restore: \u2699${r.restoreCost.scrap} + \u25c6${r.restoreCost.gold}`;
      btn.classList.remove('hidden');
      btn.disabled = !((state.scrap ?? 0) >= r.restoreCost.scrap && state.gold >= r.restoreCost.gold);
      btn.textContent = 'Restore';
    } else {
      name.textContent = r.displayName;
      desc.textContent = `${r.card} \u2014 on display.`;
      btn.classList.add('hidden');
    }
  }
}