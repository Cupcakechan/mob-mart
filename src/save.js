// save.js — localStorage persistence. Versioned key, every field default-filled on load, all I/O
// wrapped in try/catch so a disabled/full/private-mode store degrades to a fresh game, never a crash.
import { clamp } from './utils.js';
import { CONFIG } from './config.js';               // expedition merge clamps into the config band
import { ITEMS } from './data/items.js';
import { MONSTERS } from './data/monsters.js';      // expedition merge: live-faucet families only
import { RELICS } from './data/relics.js';   // merge guard: legal relic ids/statuses only
import { UPGRADES, sumEffect } from './data/upgrades.js';
import { PERKS } from './data/perks.js';
import { WORKERS } from './data/workers.js';
import { createInitialState } from './state.js';
import { LEGACY_EVERYTHING_BASIS, EVERYTHING_TIERS, crossedCount } from './data/milestones.js';

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
    // Trade Market lifetime ledger (reform Pass A) — pre-market saves start at 0, additive.
    for (const id of Object.keys(fresh.stats.materialEarned ?? {})) {
      fresh.stats.materialEarned[id] = Math.max(0, Math.floor(numOr(data.stats.materialEarned?.[id], 0)));
    }
    // Expedition run ledger (reform step 4) — same guard family.
    for (const id of Object.keys(fresh.stats.expeditions ?? {})) {
      fresh.stats.expeditions[id] = Math.max(0, Math.floor(numOr(data.stats.expeditions?.[id], 0)));
    }
    // B2 ratchet migration: earned tier = max of the saved field AND the tier this save had already
    // reached under the OLD rules — computed over the PINNED launch-trio basis, NOT the live
    // BASE_ITEMS. That distinction is the whole fix: if an update ships new free items, a player's
    // first load computes the live laggard as 0, so only the pinned basis can recover what they'd
    // earned. Clamped to the ladder's length (a hand-edited 999 must not become gold x1.25^999).
    const legacyMin = Math.min(...LEGACY_EVERYTHING_BASIS.map((id) => fresh.stats.itemSales[id] ?? 0));
    fresh.stats.everythingTierEarned = Math.min(EVERYTHING_TIERS.length, Math.max(
      0,
      Math.floor(numOr(data.stats.everythingTierEarned, 0)),
      crossedCount(legacyMin, EVERYTHING_TIERS)));
  }
  fresh.gold = Math.max(0, numOr(data.gold, fresh.gold));
  fresh.reputation = Math.max(0, numOr(data.reputation, fresh.reputation));
  // Scrap (§14): additive schema — pre-Doug saves have no field and load as 0, same as gold's guard.
  fresh.scrap = Math.max(0, numOr(data.scrap, 0));
  fresh.sealPity = Math.min(20, Math.max(0, Math.floor(numOr(data.sealPity, 0))));   // pity slope: clamp 0..20 (a hand-edit can wait, never mint past the guarantee point)
  // Materials (reform Pass A): additive + registry-keyed — fresh keys only (stale ids drop),
  // non-negative integers (a hand-edited count must never NaN the trade math). Caps are
  // enforced at the FAUCET (addMaterial), not here — same stance as gold's unclamped merge.
  if (data.materials && typeof data.materials === 'object') {
    for (const id of Object.keys(fresh.materials)) {
      fresh.materials[id] = Math.max(0, Math.floor(numOr(data.materials?.[id], 0)));
    }
  }
  // Expeditions MVP (reform step 4): an in-flight run persists — GUARDED: the monster must be a
  // live faucet family (a stale/hand-edited id drops the run whole, fee already spent, no crash),
  // and `remaining` clamps into the config band so an edited 1e9 can't park the slot forever.
  fresh.expedition = null;
  if (data.expedition && typeof data.expedition === 'object') {
    const m = MONSTERS[data.expedition.monsterId];
    if (m && !m.special && m.material) {
      fresh.expedition = {
        monsterId: data.expedition.monsterId,
        dest: typeof data.expedition.dest === 'string' ? data.expedition.dest : 'the doors',
        remaining: clamp(numOr(data.expedition.remaining, 0), 0, CONFIG.expedition?.durationSec ?? 60),
      };
    }
  }
  // Commissions (reform step 6): the ONE order slot persists — GUARDED like the expedition slot:
  // the item must be a real TRADE-TIER row and the client a real non-special monster (a stale or
  // hand-edited id drops the order WHOLE, no crash — tomorrow places a fresh one), count/days
  // clamp into the config bands. placedIndex floors to an integer but is otherwise trusted —
  // terms re-DERIVE at fulfillment (commissionTerms), so no edit here can mint gold; the guards
  // protect against crashes and registry violations, not self-cheating (the gold-merge stance).
  fresh.commission = null;
  if (data.commission && typeof data.commission === 'object') {
    const it = ITEMS[data.commission.itemId];
    const cm = MONSTERS[data.commission.monsterId];
    const CB = CONFIG.commission ?? {};
    if (it && (it.acquisition ?? 'gold') === 'trade' && cm && !cm.special) {
      fresh.commission = {
        itemId: data.commission.itemId,
        monsterId: data.commission.monsterId,
        count: clamp(Math.floor(numOr(data.commission.count, CB.countMin ?? 2)),
          CB.countMin ?? 2, CB.countMax ?? 4),
        days: clamp(Math.floor(numOr(data.commission.days, CB.daysMin ?? 2)),
          CB.daysMin ?? 2, CB.daysMax ?? 3),
        placedIndex: Math.floor(numOr(data.commission.placedIndex, 0)),
      };
    }
  }
  fresh.lastCommissionIndex = Math.floor(numOr(data.lastCommissionIndex, -1));
  // REPEAT: the courier survives the reload (anti-refarm) — clamped to the config ceiling so a
  // hand-edited save can pause commissions for a year but never mint one early (floor 0).
  fresh.commissionCooldownSec = Math.min(
    Math.max(0, numOr(data.commissionCooldownSec, 0)),
    CONFIG.commission?.repeatCooldownSec ?? 7200);
  fresh.commissionSeq = Math.max(0, Math.floor(numOr(data.commissionSeq, 0)));
  // Relics (§14 Pass B): additive + GUARDED — only known relic ids with legal statuses survive
  // the merge (a corrupt/hand-edited save can't invent relics or statuses). Pre-relic saves: {}.
  fresh.relics = {};
  if (data.relics && typeof data.relics === 'object') {
    for (const [id, st] of Object.entries(data.relics)) {
      if (RELICS[id] && (st === 'found' || st === 'restored')) fresh.relics[id] = st;
    }
  }
  fresh.relicPity = Math.max(0, numOr(data.relicPity, 0));
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
      // Deep Sinks: clamp the restored training level to the registry's ladder (a hand-edited 999
      // must not become +999 gold/sale); pre-pass saves have no field and read as level 0.
      fresh.workers[id].level = clamp(
        Math.floor(numOr(data.workers[id]?.level, 0)), 0, WORKERS[id]?.levels?.maxLevel ?? 0);
    }
  }
  fresh.lastSeen = numOr(data.lastSeen, fresh.lastSeen);         // kept for M5 offline earnings
  // Market Day (additive schema, SAVE_VERSION unchanged): string-coerced — a pre-market save or a
  // tampered non-string reads as '' (never collected), which just grants today's crate. Harmless
  // by design: the latch prevents double-collect within a day, not across an update boundary.
  fresh.lastMarketDay = typeof data.lastMarketDay === 'string' ? data.lastMarketDay : '';
  fresh.lastVisitDay = typeof data.lastVisitDay === 'string' ? data.lastVisitDay : '';
  return fresh;
}

// Pure: the persisted slice of state. Queue + log + transient timers are ephemeral (regenerate) and
// are NOT saved. Workers persist ownership only (the auto-serve timer regenerates on load).
export function serializeSave(state) {
  const items = {};
  for (const id of Object.keys(state.items)) items[id] = { stock: state.items[id].stock };
  const workers = {};
  for (const id of Object.keys(state.workers)) {
    workers[id] = { owned: state.workers[id].owned === true,
      // Deep Sinks: training levels persist beside ownership (floored non-negative; merge clamps
      // to the registry's maxLevel on the way back in).
      level: Math.max(0, Math.floor(state.workers[id].level ?? 0)) };
  }
  return {
    version: SAVE_VERSION,
    gold: state.gold,
    reputation: state.reputation,
    scrap: Math.max(0, Math.floor(state.scrap ?? 0)),   // Doug's salvage (§14) — additive field
    sealPity: Math.max(0, Math.floor(state.sealPity ?? 0)),   // pity slope: the streak survives reloads
    materials: { ...(state.materials ?? {}) },           // monster materials (reform Pass A)
    expedition: state.expedition
      ? { monsterId: state.expedition.monsterId, dest: state.expedition.dest,
          remaining: Math.max(0, state.expedition.remaining ?? 0) }
      : null,                                            // the ONE expedition slot (reform step 4)
    commission: state.commission
      ? { monsterId: state.commission.monsterId, itemId: state.commission.itemId,
          count: state.commission.count, days: state.commission.days,
          placedIndex: state.commission.placedIndex }
      : null,                                            // the ONE order slot (reform step 6)
    lastCommissionIndex: Math.floor(state.lastCommissionIndex ?? -1),   // the placement latch
    commissionCooldownSec: Math.max(0, state.commissionCooldownSec ?? 0),   // REPEAT: the courier's clock
    commissionSeq: Math.max(0, Math.floor(state.commissionSeq ?? 0)),       // REPEAT: today's order count
    relics: state.relics ?? {},                          // relic statuses (§14 Pass B)
    relicPity: Math.max(0, Math.floor(state.relicPity ?? 0)),
    lifetimeRep: state.lifetimeRep ?? state.reputation,
    perks: { ...(state.perks ?? {}) },
    licenses: { ...(state.licenses ?? {}) },
    items,
    upgrades: { ...state.upgrades },
    workers,
    stats: {
      itemSales: { ...(state.stats?.itemSales ?? {}) },
      monsterServes: { ...(state.stats?.monsterServes ?? {}) },
      materialEarned: { ...(state.stats?.materialEarned ?? {}) },   // lifetime landed drops (reform)
      expeditions: { ...(state.stats?.expeditions ?? {}) },          // lifetime runs per family (step 4)
      everythingTierEarned: state.stats?.everythingTierEarned ?? 0,   // B2 ratchet (see milestones.js)
    },
    lastSeen: Date.now(),
    // Market Day latch: which local calendar day already granted its supplier crate. A string
    // ('' = never); the EVENT id is deliberately not saved — it re-derives from the date.
    lastMarketDay: typeof state.lastMarketDay === 'string' ? state.lastMarketDay : '',
    // Special Visits latch: same contract as the market latch above.
    lastVisitDay: typeof state.lastVisitDay === 'string' ? state.lastVisitDay : '',
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
