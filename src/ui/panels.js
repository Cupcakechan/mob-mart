// panels.js — DOM panels: current customer (front), Shelf (restock), Upgrades view, battle log.
// The Shelf and Upgrades panels share the center slot; the bottom nav toggles which is visible.
import { ITEMS, ITEM_ORDER } from '../data/items.js';
import { MONSTERS } from '../data/monsters.js';
import { UPGRADES, UPGRADE_ORDER, upgradeLevel, upgradeCost, isMaxed } from '../data/upgrades.js';
import { serveBlockReason, canRestock, effectiveMaxStock, canBuyUpgrade } from '../game.js';

let handlers = { onServe: () => {}, onDismiss: () => {}, onRestock: () => {}, onBuyUpgrade: () => {} };

export function initPanels(root, h) {
  handlers = h;
  root.innerHTML = `
    <section class="panel customer-panel">
      <h2 class="panel-title">Current Customer</h2>
      <div id="customer-body" class="customer-body"></div>
      <button id="serve-btn" class="serve-btn">Serve</button>
      <button id="dismiss-btn" class="dismiss-btn">Send Away</button>
    </section>

    <section id="items-panel" class="panel items-panel">
      <h2 class="panel-title">Shelf</h2>
      <div id="item-cards" class="item-cards"></div>
    </section>

    <section id="upgrades-panel" class="panel upgrades-panel hidden">
      <h2 class="panel-title">Upgrades</h2>
      <div id="upgrade-cards" class="upgrade-cards"></div>
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
        <div class="item-name">${it.displayName}</div>
        <div class="item-price">&#9670; ${it.basePrice}</div>
        <div class="item-stock">Stock: <span id="stock-${id}">0</span>/<span id="max-${id}">${it.maxStock}</span></div>
        <button class="restock-btn" data-item="${id}">Restock &#9670;${it.restockCost}</button>
      </div>`;
  }).join('');
  root.querySelectorAll('.restock-btn').forEach((btn) =>
    btn.addEventListener('click', () => handlers.onRestock(btn.dataset.item)));

  // Upgrade cards (data-driven; cost/level/button update at runtime).
  document.getElementById('upgrade-cards').innerHTML = UPGRADE_ORDER.map((id) => {
    const u = UPGRADES[id];
    return `<div class="upgrade-card" data-upg="${id}">
        <div class="upg-head"><span class="upg-name">${u.displayName}</span><span class="upg-cost" id="upgcost-${id}"></span></div>
        <div class="upg-desc">${u.description}</div>
        <div class="upg-foot"><span class="upg-level" id="upglvl-${id}"></span><button class="upg-buy" data-upg="${id}">Buy</button></div>
      </div>`;
  }).join('');
  root.querySelectorAll('.upg-buy').forEach((btn) =>
    btn.addEventListener('click', () => handlers.onBuyUpgrade(btn.dataset.upg)));
}

const REASON_LABEL = {
  'no-customer': 'No customer',
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
    const waitLine = waiting > 0 ? `<div class="cust-wait">${waiting} more in line</div>` : '';
    body.innerHTML = `
      <div class="cust-name">${m?.displayName ?? '???'}</div>
      <div class="cust-line">Wants: <b>${want?.displayName ?? '???'}</b></div>
      <div class="cust-line">Budget: &#9670; ${c.budget}</div>
      ${waitLine}`;
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
  }
  document.querySelectorAll('.restock-btn').forEach((btn) => {
    btn.disabled = !canRestock(state, btn.dataset.item);
  });

  // --- Upgrades: level, next cost (or MAX), buyability ---
  for (const id of UPGRADE_ORDER) {
    const u = UPGRADES[id];
    const lvl = upgradeLevel(state, id);
    const maxed = isMaxed(state, id);
    const lvlEl = document.getElementById(`upglvl-${id}`);
    if (lvlEl) lvlEl.textContent = maxed ? `Lv ${lvl} · Max` : `Lv ${lvl}`;
    const costEl = document.getElementById(`upgcost-${id}`);
    if (costEl) costEl.innerHTML = maxed ? 'MAX' : `&#9670; ${upgradeCost(id, lvl)}`;
    const buyBtn = document.querySelector(`.upg-buy[data-upg="${id}"]`);
    if (buyBtn) {
      buyBtn.disabled = !canBuyUpgrade(state, id);
      buyBtn.textContent = maxed ? 'Maxed' : 'Buy';
    }
  }

  // --- Battle log ---
  const log = document.getElementById('battle-log');
  if (log) {
    log.innerHTML = state.log.map((e) => {
      const cls = e.repDelta > 0 ? 'good' : (e.repDelta < 0 ? 'bad' : 'meh');
      const crown = e.repDelta !== 0
        ? `<span class="log-crown">${e.repDelta > 0 ? '+' : ''}${e.repDelta}&#9819;</span>`
        : '';
      return `<li class="log-item ${cls}"><span class="log-text">${e.text}</span>${crown}</li>`;
    }).join('');
  }
}
