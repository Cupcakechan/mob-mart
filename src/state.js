// state.js — the single mutable game-state object + screen flag. No DOM, no rendering here.
import { CONFIG } from './config.js';
import { ITEMS, ITEM_ORDER } from './data/items.js';
import { UPGRADE_ORDER } from './data/upgrades.js';
import { WORKER_ORDER } from './data/workers.js';

export function createInitialState() {
  const items = {};
  for (const id of ITEM_ORDER) {
    items[id] = { stock: ITEMS[id].startStock ?? 0 };
  }
  const upgrades = {};
  for (const id of UPGRADE_ORDER) upgrades[id] = 0;   // level per upgrade, starts at 0

  // Workers: per-id { owned, timer }. `owned` is persisted (see save.js); `timer` (seconds until the
  // next auto-serve attempt) is transient and always regenerated — never saved.
  const workers = {};
  for (const id of WORKER_ORDER) workers[id] = { owned: false, timer: 0 };

  return {
    screen: 'title',            // 'title' | 'shop'
    gold: CONFIG.economy.startingGold,
    reputation: CONFIG.economy.startingReputation, // shown on the HUD; service-based (see game.js)
    items,                      // { id: { stock } }
    upgrades,                   // { id: level }
    workers,                    // { id: { owned, timer } }  timer is transient (not persisted)
    queue: [],                  // customers in line; queue[0] is at the counter (the front)
    spawnTimer: 0,              // seconds until the next mob joins the back of the line
    serveCooldown: 0,           // transient: seconds until Serve re-enables after a sale (Faster Counter)
    workerServed: false,        // transient: a worker just auto-served -> main.js plays Bob's serve anim
    log: [],                    // [{ text, repDelta, tier, monsterId }]  newest first
    lastSeen: Date.now(),       // timestamp of last activity (persisted; used by M5 offline earnings)
    uiDirty: true,              // transient: request a DOM panel re-render (not persisted)
  };
}
