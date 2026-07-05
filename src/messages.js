// messages.js — turns a (monster, outcome tier) into a filled log line. Single home for the
// pick-and-fill logic so combat outcomes AND leave/dismiss all draw from the same registry.
import { pick } from './utils.js';
import { GENERIC_RESULTS, MONSTER_RESULTS } from './data/results.js';
import { ITEMS } from './data/items.js';

// Last template dealt per pool, keyed by monsterId|tier — so the picker never repeats a line
// back-to-back within the same (monster, tier) pool. Module-level + ephemeral on purpose: it's
// presentation memory, not game state, so it's never persisted and resets on reload (harmless).
const lastPicked = new Map();

// Pool the generic lines with any per-monster lines for this tier, filter by the sold item's
// CATEGORY (item-aware pass, 2026-07-04: templates are either plain strings — neutral, fire for
// everything — or { text, cats } objects that only fire when the item's category matches; that's
// how "swung the {item} once" stays a weapon joke instead of filling with a potion). When no
// itemId is given (leave path), tagged templates are excluded entirely — they're item-specific by
// definition. Then fill placeholders. Fallbacks guard every step so an unknown tier/monster/item
// degrades to a line, never a crash.
// RETURN SHAPE (line-unlock pass, 2026-07-04): { text, golden }. golden lines render gold in the
// log — the 100-serve payoff Daniel wanted memorable. `serves` = the monster's lifetime serve
// count INCLUDING the current one; templates tagged minServes (?? 0) only fire at/after it, so
// loyalty pays out in comedy and the Bestiary pips double as new-material markers.
export function logLine(monsterId, tier, { name = 'Someone', item = 'something', itemId = null, serves = 0, gregHired = false } = {}) {
  const cat = ITEMS[itemId]?.category ?? null;
  const pool = (GENERIC_RESULTS[tier] ?? []).concat(MONSTER_RESULTS[monsterId]?.[tier] ?? [])
    .filter((t) => {
      const cats = typeof t === 'string' ? null : t.cats;
      const min = typeof t === 'string' ? 0 : (t.minServes ?? 0);
      // Greg-voiced templates ({ greg: true }) exist only once he's hired — pre-hire, the shop's
      // worst employee hasn't been employed yet (voice pass, 2026-07-05).
      const greg = typeof t === 'string' ? false : (t.greg === true);
      return (!cats?.length || (cat !== null && cats.includes(cat))) && min <= serves && (!greg || gregHired);
    })
    .map((t) => (typeof t === 'string'
      ? { text: t, golden: false }
      : { text: t.text, golden: t.golden === true }));   // normalize BEFORE anti-repeat compares
  const key = `${monsterId}|${tier}`;

  let choice = pool.length ? pick(pool) : { text: '{name} did a thing.', golden: false };
  // Anti-repeat: one re-draw from the alternatives if we dealt this exact line last time (only
  // when the pool has an alternative). Filtering guarantees the re-draw can't repeat either.
  if (pool.length > 1 && choice.text === lastPicked.get(key)) {
    choice = pick(pool.filter((c) => c.text !== choice.text));
  }
  lastPicked.set(key, choice.text);

  return { text: choice.text.replace(/\{name\}/g, name).replace(/\{item\}/g, item), golden: choice.golden };
}
