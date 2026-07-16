// commissions.js — COMMISSIONS (reform step 6 — TRADE_MARKET_DESIGN.md §8, Daniel's Option 2:
// THE NAMED CLIENT). Pure, headless math: which order exists on a given day, and how trade-day
// keys become comparable integers. A roster monster places an order for TRADE-TIER goods against
// a deadline counted in MARKET DAYS — the same clock the rotating rates and the forecast run on,
// so "hold stores? trade today? wait for tomorrow's rate?" is one planning loop (§8's whole point).
//
// Determinism contract (same standing as trademarket.js — the suite pins it): the order is a
// PURE function of (dayKey, eligible item list) and the live registries; no Math.random anywhere
// in this file. Same day, same licenses, same order — a reload can't reroll the client.
//
// What is NOT here: deadline state, placement latches, fulfillment math — those live on the
// state object and in game.js (refreshCommission / fulfillCommission), because they mutate.
import { CONFIG } from '../config.js';
import { MONSTERS, MONSTER_IDS } from './monsters.js';
import { hashDayKey } from './marketevents.js';
import { mulberry32 } from './trademarket.js';

// A trade-day key as a comparable integer, for deadline arithmetic across BOTH key families:
// the live calendar ('YYYY-MM-DD' -> days since epoch, computed via Date.UTC so DST can never
// make two adjacent days differ by anything but 1) and the harness's synthetic 'sim-day-N'
// (-> N). Any other shape (the forecast fallback's '+1' suffix family for odd test overrides)
// returns null — no day identity, and the deadline machinery idles rather than guesses.
export function dayIndexOf(key) {
  if (typeof key !== 'string') return null;
  const sim = /^sim-day-(-?\d+)$/.exec(key);
  if (sim) return Number(sim[1]);
  const cal = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (cal) return Math.floor(Date.UTC(+cal[1], +cal[2] - 1, +cal[3]) / 86400000);
  return null;
}

// One day's order: a seeded pick of ITEM (from the caller's eligible list — game.js passes the
// LICENSED trade tier, so an order can never demand what the shop may not legally sell: the
// eligibility law, applied to commissions), COUNT and DEADLINE from the CONFIG bands, and the
// CLIENT from the live non-special roster (the Inspector inspects; he does not queue up orders).
// Returns null when nothing is eligible yet — early game stays commission-free by construction.
// NOTE: terms (gold/rep) are deliberately NOT generated here — they DERIVE live at fulfillment
// (game.js commissionTerms), so a persisted order can never mint a stale or hand-edited price.
export function commissionForDay(dayKey, itemIds, seq = 0) {
  if (!Array.isArray(itemIds) || itemIds.length === 0) return null;
  const C = CONFIG.commission ?? {};
  // REPEAT (Option A): the Nth order of a day salts the seed. Seq 0 stays the LEGACY string so
  // every pre-repeat day's first order is bit-identical — the pinned worst-case renders and any
  // in-flight save's expectations survive. '#' cannot occur in a dayKey (calendar or sim-day
  // forms), so the salted space cannot collide with a real day.
  const rng = mulberry32(hashDayKey(seq > 0 ? `commission:${dayKey}#${seq}` : `commission:${dayKey}`));
  const span = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  const itemId = itemIds[Math.floor(rng() * itemIds.length)];
  const count = span(C.countMin ?? 2, C.countMax ?? 4);
  const clients = MONSTER_IDS.filter((id) => !MONSTERS[id].special);
  const monsterId = clients[Math.floor(rng() * clients.length)];
  const days = span(C.daysMin ?? 2, C.daysMax ?? 3);
  return { itemId, count, monsterId, days };
}
