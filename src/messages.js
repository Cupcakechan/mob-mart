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
export function logLine(monsterId, tier, { name = 'Someone', item = 'something', itemId = null } = {}) {
  const cat = ITEMS[itemId]?.category ?? null;
  const pool = (GENERIC_RESULTS[tier] ?? []).concat(MONSTER_RESULTS[monsterId]?.[tier] ?? [])
    .filter((t) => {
      const cats = typeof t === 'string' ? null : t.cats;
      return !cats?.length || (cat !== null && cats.includes(cat));
    })
    .map((t) => (typeof t === 'string' ? t : t.text));   // normalize BEFORE anti-repeat compares
  const key = `${monsterId}|${tier}`;

  let template = pool.length ? pick(pool) : '{name} did a thing.';
  // Anti-repeat: one re-draw from the alternatives if we dealt this exact line last time (only
  // when the pool has an alternative). Filtering guarantees the re-draw can't repeat either.
  if (pool.length > 1 && template === lastPicked.get(key)) {
    template = pick(pool.filter((t) => t !== template));
  }
  lastPicked.set(key, template);

  return template.replace(/\{name\}/g, name).replace(/\{item\}/g, item);
}
