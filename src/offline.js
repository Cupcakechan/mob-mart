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
import { sumEffect } from './data/upgrades.js';
import { itemGoldMult, globalGoldMult } from './data/milestones.js';
import { effectiveWorkerInterval, effectiveRepPerSale, effectiveMaxStock } from './game.js';

// Compute the offline result for `state` as of `nowMs`. Returns
//   { awaySec, cappedSec, sales, gold, rep, consumed: { itemId: count } }
// and mutates NOTHING — call applyOffline to bank it. Zero-sales results are normal (no worker,
// empty shelf, no time away) and the caller simply skips the modal for them.
export function computeOffline(state, nowMs) {
  const awaySec = Math.max(0, (nowMs - (state.lastSeen ?? nowMs)) / 1000);   // clock-skew guard: never negative
  // Effective cap = base hours + any future 'offlineCap' effects (none today; harmless plumbing —
  // NOTE: with current numbers STOCK binds long before time, which is why backroom_storage extends
  // inventory, not hours).
  const capHours = (CONFIG.offline?.capHours ?? 0) + sumEffect(state, 'offlineCap');
  const cappedSec = Math.min(awaySec, capHours * 3600);
  const zero = { awaySec, cappedSec, sales: 0, gold: 0, rep: 0, consumed: {}, reserveUsed: 0, soldByItem: {} };

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

  // Backroom Storage: each level stocks one full shelf-refill of RESERVE per item for this absence.
  // Bob sells the live shelf first, then restocks from the backroom — a reserve unit pays
  // basePrice MINUS restockCost (Bob buys the restock out of the margin), so it's always profitable
  // (every item's basePrice > restockCost) but active play still out-earns it per unit.
  const reservePerItem = sumEffect(state, 'offlineReserve');                 // full refills per item
  const stocks = {}, reserves = {}, goldPer = {};
  // Milestone multipliers apply offline too (loyal regulars keep tipping) but are FROZEN at the
  // absence's start: counts crossed mid-absence don't compound within the same absence —
  // deterministic and conservative. Per-unit rounding matches the live serve path exactly.
  const gMult = globalGoldMult(state);
  for (const id of ITEM_ORDER) {
    stocks[id] = state.items[id]?.stock ?? 0;                                // live shelf units
    reserves[id] = reservePerItem * effectiveMaxStock(state, id);            // Extra Shelf compounds in
    goldPer[id] = Math.round((ITEMS[id]?.basePrice ?? 0) * itemGoldMult(state, id) * gMult);
  }
  const consumed = {};                                                       // LIVE units only (applyOffline
  const soldByItem = {};                                                     //  decrements the real shelf);
  let sales = 0, gold = 0, reserveUsed = 0, soldThisPass = true;             // soldByItem = live + reserve (ledger fuel)
  while (sales < maxSales && soldThisPass) {
    soldThisPass = false;
    for (const id of ITEM_ORDER) {
      if (sales >= maxSales) break;
      if (stocks[id] > 0) {                                                  // shelf first
        stocks[id] -= 1;
        consumed[id] = (consumed[id] ?? 0) + 1;
        soldByItem[id] = (soldByItem[id] ?? 0) + 1;
        gold += goldPer[id];
        sales += 1;
        soldThisPass = true;
      } else if (reserves[id] > 0) {                                         // then the backroom
        reserves[id] -= 1;
        reserveUsed += 1;
        soldByItem[id] = (soldByItem[id] ?? 0) + 1;
        gold += goldPer[id] - (ITEMS[id]?.restockCost ?? 0);                 // loyalty applies; Bob still paid the restock
        sales += 1;
        soldThisPass = true;
      }
    }
  }

  const rep = sales * effectiveRepPerSale(state);                            // Better Signage applies offline too
  // (Monster rep-milestones are NOT applied offline: the sim sells items, it doesn't simulate WHO
  // bought them — monster counts stay live-only, flagged in the handoff.)
  return { awaySec, cappedSec, sales, gold, rep, consumed, reserveUsed, soldByItem };
}

// Bank a computed result into state. Safe to call with a zero result (no-op, returns false).
export function applyOffline(state, result) {
  if (!result || result.sales <= 0) return false;
  state.gold += result.gold;
  state.reputation += result.rep;
  state.lifetimeRep = (state.lifetimeRep ?? 0) + result.rep;  // lifetime tracks every rep gain
                                                              // (always initialized by state/merge)
  for (const [id, n] of Object.entries(result.consumed)) {
    if (state.items[id]) state.items[id].stock = Math.max(0, state.items[id].stock - n);
  }
  // Bank the lifetime ledger (live + reserve units). Crossings during an absence are deliberately
  // SILENT — the away modal already summarizes the haul, and a burst of milestone log lines at boot
  // would drown it; the bonuses are active immediately either way.
  for (const [id, n] of Object.entries(result.soldByItem ?? {})) {
    if (state.stats?.itemSales?.[id] !== undefined) state.stats.itemSales[id] += n;
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
