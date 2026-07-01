// state.js — the single mutable game-state object + screen flag. No DOM, no rendering here.
import { CONFIG } from './config.js';
import { ITEMS, ITEM_ORDER } from './data/items.js';

export function createInitialState() {
  const items = {};
  for (const id of ITEM_ORDER) {
    items[id] = { stock: ITEMS[id].startStock ?? 0 };
  }
  return {
    screen: 'title',            // 'title' | 'shop'
    gold: CONFIG.economy.startingGold,
    reputation: CONFIG.economy.startingReputation, // tracked in M1; shown as a HUD stat from M2
    items,                      // { id: { stock } }
    currentCustomer: null,      // customer instance or null
    nextCustomerTimer: 0,       // seconds until the next customer spawns
    log: [],                    // [{ text, repDelta, tier, monsterId }]  newest first
    uiDirty: true,              // transient: request a DOM panel re-render (not persisted)
  };
}
