// trademarket.js — THE TRADE MARKET (reform Pass A — TRADE_MARKET_DESIGN.md §5). Pure, headless
// math: which trade offers exist today, at what rates. Daniel's model: trade-tier stock is not
// crafted and not gold-restocked — it is TRADED for monster materials + gold at rates that
// ROTATE DAILY, so the optimal play re-derives itself every day (the anti-greedy-bot property).
//
// Determinism contract (the suite pins it): offers are a PURE function of (dayKey, itemId) and
// the live registries — same day, same offers, everywhere, always; no Math.random anywhere in
// this file (a reload can't reroll the market, and the sim harness feeds synthetic day keys).
//
// ELIGIBILITY LAW (§4.3): recipes draw ONLY from materials whose source monster is live in the
// normal spawn pool — an offer can never demand something the player has no way to earn.
import { CONFIG } from '../config.js';
import { ITEMS, ITEM_ORDER } from './items.js';
import { MONSTERS, MONSTER_IDS } from './monsters.js';
import { MATERIALS } from './materials.js';
import { dayKeyOf, hashDayKey } from './marketevents.js';
import { TRADE_VOICE } from './results.js';

// The trade tier: items whose stock arrives by trade, never by gold restock. Registry-driven —
// Pass B grows the tier by flipping `acquisition` fields, and every consumer here follows.
export function tradeItemIds() {
  return ITEM_ORDER.filter((id) => (ITEMS[id].acquisition ?? 'gold') === 'trade');
}

// Materials with a LIVE faucet: a non-special monster in the spawn pool carries the field.
// (The Inspector is special:true, so his future drop can never leak into recipes early.)
export function eligibleMaterialIds() {
  return MONSTER_IDS
    .filter((id) => !MONSTERS[id].special && MONSTERS[id].material && MATERIALS[MONSTERS[id].material])
    .map((id) => MONSTERS[id].material);
}

// Today's key. Live play reads the local calendar (dayKeyOf — flips at the player's midnight,
// the board's own convention); the sim harness and tests set state.tradeDayKeyOverride
// (TRANSIENT, never saved) to feed synthetic days — the headless seam, so the calendar-free
// baseline law holds without arming anything.
export function tradeDayKey(state) {
  return state?.tradeDayKeyOverride ?? dayKeyOf(Date.now());
}

// mulberry32 — the project's standard tiny PRNG (the suite + sim harness use the same), seeded
// here from the day-key hash so an offer is a pure function of its (day, item) identity.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One item's offer for one day: 1–2 distinct eligible materials at 1–2 units each, plus a gold
// component — all bands are CONFIG.trade dials. Returns null when no faucet exists yet (a fresh
// registry state) — the board says "no trades today" instead of demanding the unearnable.
export function offerForDay(dayKey, itemId) {
  const pool = eligibleMaterialIds();
  if (pool.length === 0 || !ITEMS[itemId]) return null;
  const T = CONFIG.trade ?? {};
  const rng = mulberry32(hashDayKey(`${dayKey}:${itemId}`));
  const span = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  const types = Math.min(pool.length, span(T.typesMin ?? 1, T.typesMax ?? 2));
  const bag = [...pool];                       // distinct picks: splice from a copy
  const materials = {};
  for (let i = 0; i < types; i++) {
    const mid = bag.splice(Math.floor(rng() * bag.length), 1)[0];
    materials[mid] = span(T.unitsMin ?? 1, T.unitsMax ?? 2);
  }
  const gold = span(T.goldMin ?? 30, T.goldMax ?? 90);
  return { itemId, materials, gold, key: `${dayKey}:${itemId}` };
}

// The whole board for a day — one offer per trade-tier item (Pass A ships one item; Pass B's
// full tier flows through with zero changes here).
export function offersForDay(dayKey) {
  return tradeItemIds().map((id) => offerForDay(dayKey, id)).filter(Boolean);
}

// "Iron Sword ⇐ 2× Echo Fang + 1× Bogstone Bauble + 60g" — the one formatter every surface
// (board, panel, log, harness report) shares, so the offer always reads identically.
export function describeOffer(offer) {
  if (!offer) return '';
  const parts = Object.entries(offer.materials)
    .map(([id, n]) => `${n}× ${MATERIALS[id]?.displayName ?? id}`);
  return `${ITEMS[offer.itemId]?.displayName ?? offer.itemId} ⇐ ${parts.join(' + ')} + ${offer.gold}g`;
}

// The board's daily voice line — deterministic per day (chalked once each morning, the sign's
// own law), picked from TRADE_VOICE.board by the same hash family as everything else here.
export function tradeBoardLine(dayKey) {
  const pool = TRADE_VOICE?.board ?? [];
  if (pool.length === 0) return '';
  return pool[hashDayKey(`voice:${dayKey}`) % pool.length];
}
