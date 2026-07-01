// panels.js — DOM panels: current customer, shelf item cards (restock), serve/dismiss, battle log.
import { ITEMS, ITEM_ORDER } from '../data/items.js';
import { MONSTERS } from '../data/monsters.js';
import { serveBlockReason, canRestock } from '../game.js';

let handlers = { onServe: () => {}, onDismiss: () => {}, onRestock: () => {} };

export function initPanels(root, h) {
  handlers = h;
  root.innerHTML = `
    <section class="panel customer-panel">
      <h2 class="panel-title">Current Customer</h2>
      <div id="customer-body" class="customer-body"></div>
      <button id="serve-btn" class="serve-btn">Serve</button>
      <button id="dismiss-btn" class="dismiss-btn">Send Away</button>
    </section>

    <section class="panel items-panel">
      <h2 class="panel-title">Shelf</h2>
      <div id="item-cards" class="item-cards"></div>
    </section>

    <section class="panel log-panel">
      <h2 class="panel-title">Battle Results</h2>
      <ul id="battle-log" class="battle-log"></ul>
    </section>`;

  document.getElementById('serve-btn').addEventListener('click', () => handlers.onServe());
  document.getElementById('dismiss-btn').addEventListener('click', () => handlers.onDismiss());

  // Item cards are static structure; only the stock number + button state change at runtime.
  document.getElementById('item-cards').innerHTML = ITEM_ORDER.map((id) => {
    const it = ITEMS[id];
    return `<div class="item-card" data-item="${id}">
        <div class="item-name">${it.displayName}</div>
        <div class="item-price">&#9670; ${it.basePrice}</div>
        <div class="item-stock">Stock: <span id="stock-${id}">0</span>/${it.maxStock}</div>
        <button class="restock-btn" data-item="${id}">Restock &#9670;${it.restockCost}</button>
      </div>`;
  }).join('');

  root.querySelectorAll('.restock-btn').forEach((btn) =>
    btn.addEventListener('click', () => handlers.onRestock(btn.dataset.item)));
}

const REASON_LABEL = {
  'no-customer': 'No customer',
  'out-of-stock': 'Out of stock',
  'cant-afford': "Can't afford it",
  'no-item': '\u2014',
};

export function renderPanels(state) {
  const body = document.getElementById('customer-body');
  const serveBtn = document.getElementById('serve-btn');
  const dismissBtn = document.getElementById('dismiss-btn');
  const c = state.currentCustomer;

  if (c) {
    const m = MONSTERS[c.monsterId];
    const want = ITEMS[c.wantedItemId];
    body.innerHTML = `
      <div class="cust-name">${m?.displayName ?? '???'}</div>
      <div class="cust-line">Wants: <b>${want?.displayName ?? '???'}</b></div>
      <div class="cust-line">Budget: &#9670; ${c.budget}</div>`;
    const reason = serveBlockReason(state);
    serveBtn.disabled = reason !== null;
    serveBtn.textContent = reason ? (REASON_LABEL[reason] ?? 'Serve') : `Serve ${want?.displayName ?? ''}`;
  } else {
    body.innerHTML = `<div class="cust-empty">The shop is quiet&hellip; someone will wander in.</div>`;
    serveBtn.disabled = true;
    serveBtn.textContent = 'Serve';
  }
  dismissBtn.disabled = !c;

  for (const id of ITEM_ORDER) {
    const stockEl = document.getElementById(`stock-${id}`);
    if (stockEl) stockEl.textContent = state.items[id]?.stock ?? 0;
  }
  document.querySelectorAll('.restock-btn').forEach((btn) => {
    btn.disabled = !canRestock(state, btn.dataset.item);
  });

  const log = document.getElementById('battle-log');
  if (log) {
    log.innerHTML = state.log.map((e) => {
      const cls = e.repDelta > 0 ? 'good' : (e.repDelta < 0 ? 'bad' : 'meh');
      // Only combat/leave entries carry a crown; a no-sale dismiss (0) shows just the text.
      const crown = e.repDelta !== 0
        ? `<span class="log-crown">${e.repDelta > 0 ? '+' : ''}${e.repDelta}&#9819;</span>`
        : '';
      return `<li class="log-item ${cls}"><span class="log-text">${e.text}</span>${crown}</li>`;
    }).join('');
  }
}
