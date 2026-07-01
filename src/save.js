// save.js — localStorage persistence. Versioned key, every field default-filled on load, all I/O
// wrapped in try/catch so a disabled/full/private-mode store degrades to a fresh game, never a crash.
// Pure merge/serialize are split out from the I/O so the risky logic is unit-testable.
import { clamp } from './utils.js';
import { ITEMS } from './data/items.js';
import { createInitialState } from './state.js';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'mobmart.save.v1';

const numOr = (v, fallback) => (typeof v === 'number' && Number.isFinite(v)) ? v : fallback;

// Pure: overlay validated saved data onto a fresh state (default-fill + guards). No I/O.
// Guards every value so a tampered/corrupt save (NaN, negative, over-cap) can't break the game.
export function mergeSave(fresh, data) {
  if (!data || typeof data !== 'object') return fresh;
  fresh.gold = Math.max(0, numOr(data.gold, fresh.gold));
  fresh.reputation = Math.max(0, numOr(data.reputation, fresh.reputation));
  if (data.items && typeof data.items === 'object') {
    for (const id of Object.keys(fresh.items)) {                 // iterate CURRENT items, not saved
      const maxStock = ITEMS[id]?.maxStock ?? Infinity;
      const saved = data.items[id]?.stock;
      fresh.items[id].stock = clamp(Math.floor(numOr(saved, fresh.items[id].stock)), 0, maxStock);
    }
  }
  fresh.lastSeen = numOr(data.lastSeen, fresh.lastSeen);         // kept for M5 offline earnings
  return fresh;
}

// Pure: the persisted slice of state. Queue + log are ephemeral (regenerate) and are NOT saved.
export function serializeSave(state) {
  const items = {};
  for (const id of Object.keys(state.items)) items[id] = { stock: state.items[id].stock };
  return {
    version: SAVE_VERSION,
    gold: state.gold,
    reputation: state.reputation,
    items,
    lastSeen: Date.now(),
  };
}

// Load a fresh state overlaid with any valid save. Any failure -> a clean fresh state.
export function loadState() {
  const fresh = createInitialState();
  let raw;
  try { raw = localStorage.getItem(SAVE_KEY); } catch { return fresh; }  // storage unavailable
  if (!raw) return fresh;                                                 // no save yet
  let data;
  try { data = JSON.parse(raw); } catch { return fresh; }                // corrupt JSON -> fresh
  return mergeSave(fresh, data);
}

export function saveState(state) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(serializeSave(state))); }
  catch { /* full / disabled / private mode — skip the write; never crash the game */ }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
