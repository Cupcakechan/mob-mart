// state.js — the single mutable game-state object + screen flag. No DOM, no rendering here.
import { CONFIG } from './config.js';
import { ITEMS, ITEM_ORDER } from './data/items.js';
import { MATERIAL_ORDER } from './data/materials.js';
import { MONSTER_IDS } from './data/monsters.js';
import { PERK_ORDER } from './data/perks.js';
import { UPGRADE_ORDER } from './data/upgrades.js';
import { WORKER_ORDER } from './data/workers.js';

export function createInitialState() {
  const items = {};
  for (const id of ITEM_ORDER) {
    items[id] = { stock: ITEMS[id].startStock ?? 0 };
  }
  const upgrades = {};
  for (const id of UPGRADE_ORDER) upgrades[id] = 0;   // level per upgrade, starts at 0

  // Workers: per-id { owned, timer, level }. `owned` and `level` are persisted (see save.js);
  // `timer` (seconds until the next auto-serve attempt) is transient and always regenerated.
  const workers = {};
  for (const id of WORKER_ORDER) workers[id] = { owned: false, timer: 0, level: 0 };

  // Lifetime ledger (persisted): fuels milestone bonuses now; the bestiary (roadmap Pass 4) and
  // Kongregate badge stats later hang off these same integers. Keyed by current registries so a
  // future item/monster auto-appears at 0.
  const stats = { itemSales: {}, monsterServes: {}, materialEarned: {}, expeditions: {},
    everythingTierEarned: 0 };   // B2 ratchet: highest "everything" tier ever reached — persisted
                                 // so a NEW free item (laggard at 0 sales) can never regress an
                                 // earned tier; it only gates the next one. See milestones.js.
  for (const id of ITEM_ORDER) stats.itemSales[id] = 0;
  for (const id of MONSTER_IDS) { stats.monsterServes[id] = 0; stats.expeditions[id] = 0; }
  // Trade Market (reform Pass A): current stores + LIFETIME landed drops (fuels the first-drop
  // discovery line now; family mastery + harness acceptance later). Registry-keyed like the rest.
  const materials = {};
  for (const id of MATERIAL_ORDER) { materials[id] = 0; stats.materialEarned[id] = 0; }

  const perks = {};
  for (const id of PERK_ORDER) perks[id] = 0;   // Fame perk levels (rep-costed purchases)

  const licenses = {};
  for (const id of ITEM_ORDER) {
    if (ITEMS[id].license) licenses[id] = false;  // supplier licenses (tier-2 items start locked)
  }

  return {
    screen: 'title',            // 'title' | 'shop'
    gold: CONFIG.economy.startingGold,
    sealPity: 0,                // PITY SLOPE: consecutive missed seal rolls (PERSISTED — an
                                // unlucky streak must survive a reload, or refreshing farms the
                                // reset... of a counter that only ever HELPS. Persisted anyway:
                                // the streak is earned, and losing it to a reload feels wrong
                                // in the direction that costs the player).
    scrap: 0,                   // SALVAGE (§14): Doug's second resource — flows only once the
                                // scavenger is hired; spent at the forge (Pass B). Persisted.
    materials,                  // MONSTER MATERIALS (reform Pass A): { id: count }, capped per
                                // type (CONFIG.materials/game.js addMaterial). Persisted.
                                // LAW: never converts to or from gold — see materials.js.
    expedition: null,           // EXPEDITIONS MVP (reform step 4): the ONE slot. Null, or
                                // { monsterId, dest, remaining } — PERSISTED (a reload resumes
                                // the clock; main.js credits away time at boot). See game.js.
    commission: null,           // COMMISSIONS (reform step 6): the ONE order slot. Null, or
                                // { monsterId, itemId, count, days, placedIndex } — PERSISTED.
                                // Terms (gold/rep) DERIVE live at fulfillment (commissionTerms),
                                // so a save can never mint a price; placedIndex is a trade-day
                                // index (commissions.js dayIndexOf) — deadlines are absolute
                                // day math, immune to unobserved rollovers while away.
    lastCommissionIndex: -1,    // trade-day index of the last PLACED order (PERSISTED): the
                                // once-a-day placement latch — a reload right after fulfilling
                                // can't re-place (and re-farm) the same deterministic order.
    commissionCheckIn: 0,       // transient: update()'s commission rollover-check throttle
    commissionCooldownSec: 0,   // REPEAT: seconds until the courier can seat the next order.
                                // PERSISTED (a reload must not refresh the courier — the same
                                // anti-refarm stance as lastCommissionIndex); ticks down in
                                // update(), and boot credits the full absence (the expedition
                                // convention — offline.js is analytic and never ticks).
    commissionSeq: 0,           // REPEAT: orders placed on day lastCommissionIndex (PERSISTED).
                                // Seq 0 keeps the legacy seed byte-for-byte, so every existing
                                // day's first order is unchanged; seq N>0 salts the seed.
    relics: {},                 // RELIC status map (§14 Pass B): id -> 'found' | 'restored'.
                                // Absent id = not yet found. One-of-ones; persisted.
    relicPity: 0,               // scavenge runs since the last relic find — the pity floor
                                // (RELIC_FIND.pityRuns guarantees a find). Persisted.
    reputation: CONFIG.economy.startingReputation, // SPENDABLE rep balance (Fame perks draw this down)
    lifetimeRep: CONFIG.economy.startingReputation, // never decreases; drives tiers — spending can't
                                                    // cost you a gate you earned (dual-track Fame)
    perks,                      // { id: level } — rep-costed Fame perks
    licenses,                   // { itemId: bool } — one-time supplier licenses (tier-2 items)
    items,                      // { id: { stock } }
    upgrades,                   // { id: level }
    workers,                    // { id: { owned, timer } }  timer is transient (not persisted)
    stats,                      // lifetime { itemSales, monsterServes } — milestones/bestiary fuel
    queue: [],                  // customers in line; queue[0] is at the counter (the front)
    spawnTimer: 0,              // seconds until the next mob joins the back of the line
    serveCooldown: 0,           // transient: seconds until Serve re-enables after a sale (Faster Counter)
    workerServed: false,        // transient: a worker just auto-served -> main.js plays Bob's serve anim
    boardChalkPending: false,   // transient: a fresh market day arrived -> main.js plays the board's
                                // chalk write-on once the shop screen is visible (never serialized)
    log: [],                    // [{ text, repDelta, tier, monsterId }]  newest first
    pendingReports: [],         // battle results awaiting delivery — the report lands when the
                                // celebrant ENTERS the door (render event), or via the fallback
                                // timer (CONFIG.log.reportFallbackSec). TRANSIENT like uiDirty:
                                // serializeSave lists fields explicitly, so this is never saved —
                                // a reload inside the ~2s window drops the LINE only (gold/rep
                                // applied at serve, so nothing economic can be lost).
    lastSeen: Date.now(),       // timestamp of last activity (persisted; used by M5 offline earnings)
    lastMarketDay: '',          // 'YYYY-MM-DD' of the last supplier-crate grant (PERSISTED — the
                                // once-a-day latch, saved immediately on grant like the offline
                                // bank; '' = never collected, so day one grants)
    lastVisitDay: '',           // 'YYYY-MM-DD' of the last Inspector visit (PERSISTED — the
                                // once-a-day visit latch; autosave carries it, a crash before
                                // save just re-offers the visit)
    marketDayKey: null,         // transient: the day the market machinery last derived. Doubles as
                                // the ARMING flag for update()'s rollover check — only a boot that
                                // ran refreshMarketDay (main.js) sets it, so headless tests that
                                // tick update() never trigger crates/events by accident
    marketEventId: null,        // transient: today's demand event — re-derived from the date at
                                // boot/rollover, never saved (the date IS the save)
    uiDirty: true,              // transient: request a DOM panel re-render (not persisted)
  };
}
