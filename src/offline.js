// offline.js — M5 offline earnings. Pure math (no DOM, headlessly testable): "what would the hired
// serve-worker have sold while the player was away?", capped and STOCK-CONSUMING.
//
// Design rules (see PROJECT_HANDOFF §4/§8):
// - Offline is the SAME math as live play, applied once over the elapsed delta: sales flow at the
//   worker's effective interval, pay real basePrices, grant real rep/sale, and consume real stock.
// - Stock-consuming is the exploit guard (watch-list #6): paying gold WITHOUT consuming stock would
//   let a shelf with one item mint free gold on every visit. sales = min(time/interval, total stock).
// - Deterministic (no RNG), so reload-spamming recomputes the identical result — nothing to farm.
// - Player-forgiving: no offline patience timeouts or rep losses; customers who "would have left"
//   simply aren't in the estimate.
import { CONFIG } from './config.js';
import { ITEMS, ITEM_ORDER } from './data/items.js';
import { WORKERS, WORKER_ORDER, isWorkerOwned } from './data/workers.js';
import { effectiveWorkerInterval, effectiveRepPerSale } from './game.js';

// Compute the offline result for `state` as of `nowMs`. Returns
//   { awaySec, cappedSec, sales, gold, rep, consumed: { itemId: count } }
// and mutates NOTHING — call applyOffline to bank it. Zero-sales results are normal (no worker,
// empty shelf, no time away) and the caller simply skips the modal for them.
export function computeOffline(state, nowMs) {
  const awaySec = Math.max(0, (nowMs - (state.lastSeen ?? nowMs)) / 1000);   // clock-skew guard: never negative
  const cappedSec = Math.min(awaySec, (CONFIG.offline?.capHours ?? 0) * 3600);
  const zero = { awaySec, cappedSec, sales: 0, gold: 0, rep: 0, consumed: {} };

  // First owned serve-worker sets the pace (just Bob for now; a second serve-worker would need a
  // combined-throughput pass — deliberately out of scope until one exists).
  let workerId = null;
  for (const id of WORKER_ORDER) {
    if (WORKERS[id].role === 'serve' && isWorkerOwned(state, id)) { workerId = id; break; }
  }
  if (!workerId || cappedSec <= 0) return zero;

  const interval = effectiveWorkerInterval(state, workerId);                 // Faster Counter speeds offline too
  const maxSales = Math.floor((cappedSec / interval) * (CONFIG.offline?.efficiency ?? 1));
  if (maxSales <= 0) return zero;

  // Consume stock round-robin across the shelf (a fair, deterministic stand-in for the live want
  // weights) until time or stock runs out. Works on a copy; state is untouched.
  const stocks = {};
  for (const id of ITEM_ORDER) stocks[id] = state.items[id]?.stock ?? 0;
  const consumed = {};
  let sales = 0, gold = 0, soldThisPass = true;
  while (sales < maxSales && soldThisPass) {
    soldThisPass = false;
    for (const id of ITEM_ORDER) {
      if (sales >= maxSales) break;
      if (stocks[id] > 0) {
        stocks[id] -= 1;
        consumed[id] = (consumed[id] ?? 0) + 1;
        gold += ITEMS[id]?.basePrice ?? 0;
        sales += 1;
        soldThisPass = true;
      }
    }
  }

  const rep = sales * effectiveRepPerSale(state);                            // Better Signage applies offline too
  return { awaySec, cappedSec, sales, gold, rep, consumed };
}

// Bank a computed result into state. Safe to call with a zero result (no-op, returns false).
export function applyOffline(state, result) {
  if (!result || result.sales <= 0) return false;
  state.gold += result.gold;
  state.reputation += result.rep;
  for (const [id, n] of Object.entries(result.consumed)) {
    if (state.items[id]) state.items[id].stock = Math.max(0, state.items[id].stock - n);
  }
  state.uiDirty = true;
  return true;
}

// "1h 23m" / "5m" / "45s" for the modal.
export function formatAway(sec) {
  const s = Math.floor(sec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60) % 60;
  const h = Math.floor(s / 3600);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
