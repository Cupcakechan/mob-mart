// save.js — localStorage persistence. Versioned key, every field default-filled on load, all I/O
// wrapped in try/catch so a disabled/full/private-mode store degrades to a fresh game, never a crash.
import { clamp } from './utils.js';
import { ITEMS } from './data/items.js';
import { UPGRADES, sumEffect } from './data/upgrades.js';
import { PERKS } from './data/perks.js';
import { WORKERS } from './data/workers.js';
import { createInitialState } from './state.js';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'mobmart.save.v1';

const numOr = (v, fallback) => (typeof v === 'number' && Number.isFinite(v)) ? v : fallback;

// Pure: overlay validated saved data onto a fresh state (default-fill + guards). No I/O.
export function mergeSave(fresh, data) {
  if (!data || typeof data !== 'object') return fresh;
  // Lifetime ledger: iterate FRESH keys (current registries — stale saved ids are dropped), clamp
  // to non-negative integers (a corrupt/edited count must never NaN the milestone math). Pre-ledger
  // saves simply start counting from 0 — additive schema, SAVE_VERSION unchanged.
  if (data.stats && typeof data.stats === 'object') {
    for (const id of Object.keys(fresh.stats.itemSales)) {
      fresh.stats.itemSales[id] = Math.max(0, Math.floor(numOr(data.stats.itemSales?.[id], 0)));
    }
    for (const id of Object.keys(fresh.stats.monsterServes)) {
      fresh.stats.monsterServes[id] = Math.max(0, Math.floor(numOr(data.stats.monsterServes?.[id], 0)));
    }
  }
  fresh.gold = Math.max(0, numOr(data.gold, fresh.gold));
  fresh.reputation = Math.max(0, numOr(data.reputation, fresh.reputation));
  // Dual-track migration: pre-Fame saves have no lifetimeRep — seed it from current rep so every
  // tier the player had already reached stays reached. Lifetime can never be below current.
  fresh.lifetimeRep = Math.max(fresh.reputation, Math.max(0, numOr(data.lifetimeRep, 0)));
  // Perk levels: iterate CURRENT registry, clamp to each perk's maxLevel (same guard as upgrades).
  if (data.perks && typeof data.perks === 'object') {
    for (const id of Object.keys(fresh.perks)) {
      const max = PERKS[id]?.maxLevel ?? 0;
      fresh.perks[id] = Math.min(max, Math.max(0, Math.floor(numOr(data.perks[id], 0))));
    }
  }
  // Licenses: strict-boolean coercion over CURRENT license-bearing items (a truthy string in a
  // tampered save must not unlock anything).
  if (data.licenses && typeof data.licenses === 'object') {
    for (const id of Object.keys(fresh.licenses)) {
      fresh.licenses[id] = data.licenses[id] === true;
    }
  }
  // Upgrades merge FIRST: the item-stock clamp below needs the restored Extra Shelf level to compute
  // the effective cap. (Clamping to the BASE cap here used to eat any stock bought above it on every
  // reload — silently refunding nothing.)
  if (data.upgrades && typeof data.upgrades === 'object') {
    for (const id of Object.keys(fresh.upgrades)) {              // iterate CURRENT upgrades
      const maxLevel = UPGRADES[id]?.maxLevel ?? 0;
      const saved = data.upgrades[id];
      fresh.upgrades[id] = clamp(Math.floor(numOr(saved, fresh.upgrades[id])), 0, maxLevel);
    }
  }
  if (data.items && typeof data.items === 'object') {
    for (const id of Object.keys(fresh.items)) {                 // iterate CURRENT items, not saved
      // Effective cap = base + restored maxStock upgrade effects (mirrors game.js effectiveMaxStock;
      // computed here directly to keep save.js free of a game.js dependency).
      const maxStock = (ITEMS[id]?.maxStock ?? Infinity) + sumEffect(fresh, 'maxStock');
      const saved = data.items[id]?.stock;
      fresh.items[id].stock = clamp(Math.floor(numOr(saved, fresh.items[id].stock)), 0, maxStock);
    }
  }
  // Workers: only `owned` is persisted. Iterate CURRENT workers (unknown saved ids ignored); a save
  // with no `workers` key (any pre-M4 save) simply leaves every worker unowned — old saves load fine.
  // On resume, an owned worker's timer starts at a full base interval so he doesn't fire instantly.
  if (data.workers && typeof data.workers === 'object') {
    for (const id of Object.keys(fresh.workers)) {
      const owned = data.workers[id]?.owned === true;            // only true when explicitly saved true
      fresh.workers[id].owned = owned;
      if (owned) fresh.workers[id].timer = WORKERS[id]?.baseInterval ?? 0;
    }
  }
  fresh.lastSeen = numOr(data.lastSeen, fresh.lastSeen);         // kept for M5 offline earnings
  return fresh;
}

// Pure: the persisted slice of state. Queue + log + transient timers are ephemeral (regenerate) and
// are NOT saved. Workers persist ownership only (the auto-serve timer regenerates on load).
export function serializeSave(state) {
  const items = {};
  for (const id of Object.keys(state.items)) items[id] = { stock: state.items[id].stock };
  const workers = {};
  for (const id of Object.keys(state.workers)) workers[id] = { owned: state.workers[id].owned === true };
  return {
    version: SAVE_VERSION,
    gold: state.gold,
    reputation: state.reputation,
    lifetimeRep: state.lifetimeRep ?? state.reputation,
    perks: { ...(state.perks ?? {}) },
    licenses: { ...(state.licenses ?? {}) },
    items,
    upgrades: { ...state.upgrades },
    workers,
    stats: {
      itemSales: { ...(state.stats?.itemSales ?? {}) },
      monsterServes: { ...(state.stats?.monsterServes ?? {}) },
    },
    lastSeen: Date.now(),
  };
}

export function loadState() {
  const fresh = createInitialState();
  let raw;
  try { raw = localStorage.getItem(SAVE_KEY); } catch { return fresh; }
  if (!raw) return fresh;
  let data;
  try { data = JSON.parse(raw); } catch { return fresh; }
  return mergeSave(fresh, data);
}

export function saveState(state) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(serializeSave(state))); }
  catch { /* full / disabled / private mode — skip the write; never crash the game */ }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
