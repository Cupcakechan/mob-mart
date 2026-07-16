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
import { dayKeyOf, hashDayKey, eventIdForDay, boardEventLine, boardQuipFor, MARKET_EVENTS } from './marketevents.js';
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
// EXPORTED since reform step 6: commissions.js seeds its daily order from the same PRNG — one
// seeded-random home for all day-derived content.
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One item's offer for one day: 1–2 distinct eligible materials at 1–2 units each, plus a gold
// component DERIVED from the item's own value (Pass B: round(basePrice × [multMin..multMax]) —
// a helm recipe prices like a helm; the margin dial the harness flagged). Returns null when no
// faucet exists yet — the board says "no trades today" instead of demanding the unearnable.
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
  const multLo = T.goldMultMin ?? 1.2, multHi = T.goldMultMax ?? 3.5;
  const gold = Math.round(ITEMS[itemId].basePrice * (multLo + rng() * (multHi - multLo)));
  return { itemId, materials, gold, key: `${dayKey}:${itemId}` };
}

// The whole board for a day — one offer per trade-tier item (Pass A ships one item; Pass B's
// full tier flows through with zero changes here). The DAILY SPECIAL (the discount pass —
// Daniel's Option 3): the featured pick is marked and discounted HERE, on the offer object
// itself, so the board, the overlay, the list row, and executeTrade all read ONE price and can
// never disagree. Originals ride along (origGold / origMaterials) for the was/now display.
export function offersForDay(dayKey) {
  const offers = tradeItemIds().map((id) => offerForDay(dayKey, id)).filter(Boolean);
  if (offers.length > 0) applyFeatureDiscount(offers[hashDayKey(`feature:${dayKey}`) % offers.length]);
  return offers;
}

// Gold × goldMult ALWAYS; one unit off the LARGEST material stack where a stack > 1 exists
// (ties break on insertion order — deterministic, it's the seeded build order), clamped to
// min 1. All-1s recipes get the gold cut alone (the recipes are 1-2 units, so the material
// cut is lumpy by nature — that's the Market-Day escalation hook, not a bug).
function applyFeatureDiscount(offer) {
  const F = CONFIG.trade?.feature ?? {};
  offer.featured = true;
  offer.origGold = offer.gold;
  offer.gold = Math.round(offer.gold * (F.goldMult ?? 0.6));
  let big = null;
  for (const [mid, n] of Object.entries(offer.materials)) {
    if (n > 1 && (big === null || n > offer.materials[big])) big = mid;
  }
  if (big !== null) {
    offer.origMaterials = { ...offer.materials };
    offer.materials[big] = Math.max(1, offer.materials[big] - (F.matUnitsOff ?? 1));
  }
}

// "Iron Sword ⇐ 2× Echo Fang + 1× Bogstone Bauble + 60g" — the one formatter every surface
// (board, panel, log, harness report) shares, so the offer always reads identically. A featured
// offer appends "(was Ng)" — the sign SELLS the deal (Daniel's Pass B ask).
export function describeOffer(offer) {
  if (!offer) return '';
  const parts = Object.entries(offer.materials)
    .map(([id, n]) => `${n}× ${MATERIALS[id]?.displayName ?? id}`);
  const was = offer.featured ? ` (was ${offer.origGold}g)` : '';
  return `${ITEMS[offer.itemId]?.displayName ?? offer.itemId} ⇐ ${parts.join(' + ')} + ${offer.gold}g${was}`;
}

// The ICONIC form (Pass B UI-fix): the same offer as a segment list, materials as ICON refs
// instead of names — the compact form the board and the Shop list both render. Segment kinds:
// { t:'text', s } literal chalk/label text; { t:'icon', iconId, n } an icon with its count.
// Text-only surfaces still call describeOffer; this is for the pictographic layouts.
export function describeOfferSegments(offer) {
  if (!offer) return [];
  const segs = [{ t: 'text', s: `${ITEMS[offer.itemId]?.displayName ?? offer.itemId} ⇐ ` }];
  const mats = Object.entries(offer.materials);
  mats.forEach(([id, n], i) => {
    segs.push({ t: 'icon', iconId: MATERIALS[id]?.iconId ?? id, n, mid: id });
    if (i < mats.length - 1) segs.push({ t: 'text', s: ' + ' });
  });
  segs.push({ t: 'text', s: ` + ${offer.gold}g` });
  if (offer.featured) segs.push({ t: 'text', s: ` (was ${offer.origGold}g)` });   // the deal, chalked —
                                                              // a text segment, so the board's
                                                              // write-on needs zero new draw code
  return segs;
}

// The board's daily voice line — deterministic per day (chalked once each morning, the sign's
// own law), picked from TRADE_VOICE.board by the same hash family as everything else here.
export function tradeBoardLine(dayKey) {
  const pool = TRADE_VOICE?.board ?? [];
  if (pool.length === 0) return '';
  return pool[hashDayKey(`voice:${dayKey}`) % pool.length];
}

// The SALE SIGN (board rework — Daniel's Option 2, 2026-07-12: "the board is for the player,
// not the lore" — it ADVERTISES; the overlay informs). Two plain text lines, no recipes:
// "TODAY: Silver Key — 40% OFF" / "Tomorrow: Spiked Club". The percent DERIVES from the live
// goldMult dial — and it's ad copy for the GOLD cut only; the material cut makes the real deal
// deeper, so the sign undersells, never oversells. Returns the contentKey the chalk write-on
// re-keys on, so scene.js needs ONE call per draw (it previously made two).
// BOARD RESTRUCTURE (Daniel's Option 2, 2026-07-16): three registers -> a hierarchy. The DEMAND
// headlines (see boardEventLine's note for why it earned the top row), the DEAL rides as the
// second line (it is the ad that pulls players into the overlay), the FORECAST retires from the
// board entirely — the overlay's footer already carries "Tomorrow: ..." verbatim, so the plank
// was duplicating a surface one click away and paying for it in login confusion. The freed third
// row brings the chalk QUIP home (Market Day's comedy home — boardQuipFor, event+day-keyed,
// deterministic per morning). The forecast's day key stays exported: the overlay still uses it.
export function boardLines(state) {
  const t = featuredOffer(tradeDayKey(state));
  const pct = Math.round((1 - (CONFIG.trade?.feature?.goldMult ?? 0.6)) * 100);
  const evId = eventIdForDay(tradeDayKey(state));
  const ev = MARKET_EVENTS[evId];
  return {
    headline: boardEventLine(ev),
    deal: t ? `Deal: ${ITEMS[t.itemId]?.displayName ?? t.itemId} — ${pct}% off` : '',
    quip: boardQuipFor(ev, tradeDayKey(state)),
    contentKey: `${t?.key ?? ''}|${evId}`,
  };
}

// TOMORROW's key (Pass B, the forecast — law 3's planning surface). Live play adds a calendar
// day; the harness/test override increments its synthetic counter — deterministic both ways,
// and the fallback ('+1' suffix) still yields a stable, distinct tomorrow for odd overrides.
export function forecastDayKey(state) {
  const o = state?.tradeDayKeyOverride;
  if (o) {
    const m = /^sim-day-(\d+)$/.exec(o);
    return m ? `sim-day-${Number(m[1]) + 1}` : `${o}+1`;
  }
  return dayKeyOf(Date.now() + 86400000);
}

// YESTERDAY's key — the ticker's movement baseline (forecastDayKey's mirror: same override
// contract, same fallback shape, minus a day).
export function yesterdayKey(state) {
  const o = state?.tradeDayKeyOverride;
  if (o) {
    const m = /^sim-day-(\d+)$/.exec(o);
    return m ? `sim-day-${Number(m[1]) - 1}` : `${o}-1`;
  }
  return dayKeyOf(Date.now() - 86400000);
}

// THE TICKER (Pass C — Daniel's Option 3): REAL day-over-day movement per tier item, interleaved
// with day-seeded editorial quips ({mat} resolves to an eligible material — new materials flow
// into the jokes automatically). Movement compares PRE-DISCOUNT gold on BOTH days (origGold ??
// gold): the special's cut is a sale price, not a market move — counting it would fake a crash
// today and a rally tomorrow. Segments are typed ({ t:'move', name, pct } | { t:'quip', s }) so
// the overlay colors ▲/▼ without string parsing. Deterministic per day, like everything here.
export function tickerSegments(state) {
  const today = offersForDay(tradeDayKey(state));
  const yGold = Object.fromEntries(
    offersForDay(yesterdayKey(state)).map((o) => [o.itemId, o.origGold ?? o.gold]));
  const quipPool = TRADE_VOICE?.ticker ?? [];
  const mats = eligibleMaterialIds();
  const h = hashDayKey(`ticker:${tradeDayKey(state)}`);
  const segs = [];
  let qi = 0;
  today.forEach((o, i) => {
    const t = o.origGold ?? o.gold;
    const y = yGold[o.itemId] ?? t;
    const pct = y > 0 ? Math.round(((t - y) / y) * 100) : 0;
    segs.push({ t: 'move', name: (ITEMS[o.itemId]?.displayName ?? o.itemId).toUpperCase(), pct });
    if (i % 2 === 1 && quipPool.length > 0 && mats.length > 0) {   // a quip after every 2nd mover
      const line = quipPool[(h + qi) % quipPool.length];
      const mat = (MATERIALS[mats[(h + qi) % mats.length]]?.displayName ?? '').toUpperCase();
      segs.push({ t: 'quip', s: line.replaceAll('{mat}', mat) });
      qi++;
    }
  });
  return segs;
}

// The board headline's FEATURED offer — the day's discounted special, marked by offersForDay
// (one hash, one mark, one price; this just finds it).
export function featuredOffer(dayKey) {
  return offersForDay(dayKey).find((o) => o.featured) ?? null;
}
