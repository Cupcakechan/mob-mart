// panels.js — DOM panels: current customer (front), Shelf (restock), Upgrades view, Workers view,
// battle log. The Shelf / Upgrades / Workers panels share the center slot; the bottom nav toggles
// which is visible.
import { setShopAttention } from './nav.js';
import { ITEM_BREAKPOINTS, nextBreakpoint } from '../data/milestones.js';
import { PERKS, PERK_ORDER, perkCost } from '../data/perks.js';
import { CONFIG } from '../config.js';
import { ITEMS, ITEM_ORDER } from '../data/items.js';
import { MONSTERS } from '../data/monsters.js';
import { UPGRADES, UPGRADE_ORDER, upgradeLevel, upgradeCost, isMaxed } from '../data/upgrades.js';
import { WORKERS, WORKER_ORDER, isWorkerOwned, workerHireCost } from '../data/workers.js';
import {
  serveBlockReason, canRestock, effectiveMaxStock, canBuyUpgrade, isUpgradeUnlocked,
  canHireWorker, effectiveWorkerInterval, isPerkUnlocked, canBuyPerk, effectiveRestockCost,
  isItemUnlocked, canBuyLicense, fameOf,
} from '../game.js';
import { reputationTier } from '../reputation.js';
const reputationTierIndex = (state) => reputationTier(fameOf(state)).index;

let handlers = { onServe: () => {}, onDismiss: () => {}, onRestock: () => {}, onBuyUpgrade: () => {}, onBuyPerk: () => {}, onBuyLicense: () => {}, onHireWorker: () => {} };

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
      <h2 class="panel-title">Shelf</h2>
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
        <button class="license-btn hidden" data-item="${id}"></button>
      </div>`;
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
        </div>
        <button class="wrk-buy" data-worker="${id}">Hire</button>
      </div>`;
  }).join('');
  root.querySelectorAll('.wrk-buy').forEach((btn) =>
    btn.addEventListener('click', () => handlers.onHireWorker(btn.dataset.worker)));
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
      card.classList.toggle('locked', !unlocked);
      restockBtn.classList.toggle('hidden', !unlocked);
      licenseBtn.classList.toggle('hidden', unlocked);
      if (!unlocked) {
        const tierIdx = lic.requiredTier ?? 0;
        const tierLabel = CONFIG.reputation.tiers[tierIdx]?.label ?? '???';
        const tierReached = reputationTierIndex(state) >= tierIdx;
        licenseBtn.textContent = tierReached ? `License ◆${lic.cost}` : `Reach ${tierLabel}`;
        licenseBtn.disabled = !canBuyLicense(state, id);
      }
    }
  }
  document.querySelectorAll('.restock-btn').forEach((btn) => {
    btn.disabled = !canRestock(state, btn.dataset.item);
  });

  // Attention system: the FRONT customer's sale is blocked by empty stock -> pulse exactly that
  // shelf card (and, via setShopAttention, the Shop tab when the shelf isn't visible). Deliberately
  // front-only: it means "a sale is blocked RIGHT NOW", so the pulse stays rare and meaningful —
  // a signal that's always on is a signal nobody sees.
  const starvedId = (c && (state.items[c.wantedItemId]?.stock ?? 0) <= 0) ? c.wantedItemId : null;
  document.querySelectorAll('.item-card').forEach((card) =>
    card.classList.toggle('attention', card.dataset.item === starvedId));
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
    if (owned) {
      if (descEl) {
        const secs = effectiveWorkerInterval(state, id);
        descEl.textContent = `Auto-serves the front \u00b7 ~${secs.toFixed(1)}s`;
      }
      if (buyBtn) { buyBtn.disabled = true; buyBtn.textContent = 'Active'; }
    } else {
      if (descEl) descEl.textContent = w.role === 'serve' ? 'Serves customers automatically' : 'Restocks automatically';
      if (buyBtn) {
        buyBtn.disabled = !canHireWorker(state, id);
        buyBtn.innerHTML = `Hire &#9670; ${workerHireCost(id)}`;
      }
    }
  }

  // --- Battle log ---
  const log = document.getElementById('battle-log');
  if (log) {
    log.innerHTML = state.log.map((e) => {
      const cls = e.tier === 'milestone' ? 'milestone'
        : (e.repDelta > 0 ? 'good' : (e.repDelta < 0 ? 'bad' : 'meh'));
      const crown = e.repDelta !== 0
        ? `<span class="log-crown">${e.repDelta > 0 ? '+' : ''}${e.repDelta}&#9819;</span>`
        : '';
      return `<li class="log-item ${cls}"><span class="log-text">${e.text}</span>${crown}</li>`;
    }).join('');
  }
}
