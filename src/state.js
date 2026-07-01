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
    reputation: CONFIG.economy.startingReputation, // shown on the HUD; service-based (see game.js)
    items,                      // { id: { stock } }
    queue: [],                  // customers in line; queue[0] is at the counter (the front)
    spawnTimer: 0,              // seconds until the next mob joins the back of the line
    log: [],                    // [{ text, repDelta, tier, monsterId }]  newest first
    lastSeen: Date.now(),       // timestamp of last activity (persisted; used by M5 offline earnings)
    uiDirty: true,              // transient: request a DOM panel re-render (not persisted)
  };
}
