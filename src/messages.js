// messages.js — turns a (monster, outcome tier) into a filled log line. Single home for the
// pick-and-fill logic so combat outcomes AND leave/dismiss all draw from the same registry.
import { pick } from './utils.js';
import { GENERIC_RESULTS, MONSTER_RESULTS } from './data/results.js';

// Pool the generic lines with any per-monster lines for this tier, then fill placeholders.
// Fallbacks guard every step so an unknown tier/monster degrades to a line, never a crash.
export function logLine(monsterId, tier, { name = 'Someone', item = 'something' } = {}) {
  const pool = (GENERIC_RESULTS[tier] ?? []).concat(MONSTER_RESULTS[monsterId]?.[tier] ?? []);
  const template = pool.length ? pick(pool) : '{name} did a thing.';
  return template.replace(/\{name\}/g, name).replace(/\{item\}/g, item);
}
