// milestones.js — "Regulars' Loyalty" (idle-roadmap Pass 1). Lifetime sales counts turn into
// permanent bonuses at breakpoints — the genre's proven engine for making a small catalog generate
// an endless goal ladder (see MOB_MART_RESEARCH.md §1).
//
// THE ONE RULE THAT KEEPS THE QUEUE ALIVE: bonuses are paid ON TOP of a sale — they NEVER raise an
// item's basePrice. Affordability (serveBlockReason) keeps checking basePrice, so milestone growth
// can never push customers into "can't afford". Fiction: regulars tip; Bob upsells; prices stay put.
//
// All numbers here are dials. Magnitudes at full ladder: items 1 + 7x0.08 = x1.56 each,
// monsters 1 + 5x0.10 = x1.50 rep, everything 1.25^3 ~= x1.95 global -> ~x3 gold deep-endgame.
import { ITEMS, ITEM_ORDER } from './items.js';
import { MONSTER_IDS } from './monsters.js';   // bestiary completion walks the roster (no cycle:
                                               // monsters.js is a leaf registry with no imports)

export const ITEM_BREAKPOINTS = [10, 25, 50, 100, 250, 500, 1000];   // lifetime SALES of one item
export const ITEM_GOLD_PER_BREAKPOINT = 0.08;    // +8% gold on that item per breakpoint crossed

export const MONSTER_BREAKPOINTS = [25, 50, 100, 250, 500];          // lifetime SERVES of one monster
export const MONSTER_REP_PER_BREAKPOINT = 0.10;  // +10% rep from serving that monster per breakpoint

export const EVERYTHING_TIERS = [50, 250, 1000]; // EVERY item past N sales -> a global tier
export const EVERYTHING_GOLD_MULT = 1.25;        // global gold x1.25 per tier (multiplicative)

// --- Math (all guarded: absent stats read as 0, so pre-milestone saves just start counting) -----
export const crossedCount = (count, table) => table.filter((b) => count >= b).length;
export const nextBreakpoint = (count, table) => table.find((b) => count < b) ?? null;

const itemCount = (state, id) => state.stats?.itemSales?.[id] ?? 0;
const monsterCount = (state, id) => state.stats?.monsterServes?.[id] ?? 0;

export function itemGoldMult(state, itemId) {
  return 1 + ITEM_GOLD_PER_BREAKPOINT * crossedCount(itemCount(state, itemId), ITEM_BREAKPOINTS);
}

export function monsterRepMult(state, monsterId) {
  return 1 + MONSTER_REP_PER_BREAKPOINT * crossedCount(monsterCount(state, monsterId), MONSTER_BREAKPOINTS);
}

// Bestiary "studied %" (Pass 4a): crossed loyalty breakpoints over the total possible, across the
// whole roster. Pure + registry-driven — a new monster (Gobbo) adds MONSTER_BREAKPOINTS.length to
// the denominator automatically, so the % DROPS when a new mob joins. That's the field-guide feel
// (a new page to fill), deliberate and not a bug. Guarded like the rest: absent stats read as 0.
export function bestiaryCompletion(state) {
  const total = MONSTER_IDS.length * MONSTER_BREAKPOINTS.length;
  const crossed = MONSTER_IDS.reduce(
    (sum, id) => sum + crossedCount(monsterCount(state, id), MONSTER_BREAKPOINTS), 0);
  return { crossed, total, pct: total > 0 ? Math.floor((100 * crossed) / total) : 0 };
}

// The "everything" tier is driven by the LAGGARD — but only across the BASE (license-free) items.
// Two reasons: adding tier-2 registry rows must never REGRESS an earned global tier (three new
// items at 0 sales would drop the laggard to 0), and a ladder stalled behind an unbought license
// would be a dead want. Tier-2 items still get their own per-item ladders.
const BASE_ITEMS = ITEM_ORDER.filter((id) => !ITEMS[id]?.license);

// RATCHET (B2, items-scaffold pass 2026-07-04): the tier can also never regress when a NEW
// license-free item joins BASE_ITEMS (its 0 sales would drop the laggard). The highest tier ever
// reached persists in state.stats.everythingTierEarned (written by serveCurrent on a live
// crossing, seeded by mergeSave for older saves); the effective tier is max(computed, earned).
// Net effect of a new free item: it can never take an earned tier away — it only gates the NEXT
// one, i.e. it's a fresh goal, not a punishment.
export function everythingTier(state) {
  const min = Math.min(...BASE_ITEMS.map((id) => itemCount(state, id)));
  return Math.max(crossedCount(min, EVERYTHING_TIERS),
    Math.min(EVERYTHING_TIERS.length, Math.floor(state.stats?.everythingTierEarned ?? 0)));
}

// SAVE-MIGRATION ONLY — the pre-ratchet laggard basis, PINNED to the launch trio forever (do NOT
// grow this list when items are added; that's the whole point). mergeSave uses it to compute the
// tier an old save had already earned under the old rules, so an update that ships new free items
// can't regress a player who never ran the ratchet code.
export const LEGACY_EVERYTHING_BASIS = ['club', 'metal_helmet', 'hp_flask'];

export function globalGoldMult(state) {
  return Math.pow(EVERYTHING_GOLD_MULT, everythingTier(state));
}

// --- Announcement lines (system voice, delivered through the Battle Results log in gold) --------
// Voice rules (see COMEDY_BIBLE.md): Bob's shop-side voice, PG, <= ~78 chars filled, and NEVER
// imply a price increase (the fiction must match the affordability rule above): tips, loyalty,
// bestseller tags — not markups. Article-hazard rule applies: "the {item}" / "{item}s", never "a {item}".
export const MILESTONE_LINES = {
  item: [
    "Sale #{count} of the {item}! Regulars now tip extra for it.",
    "Bob framed receipt #{count}. The {item} now earns a loyalty bonus.",
    "{count} {item}s sold. Bob knows the pitch by heart — it pays better now.",
    "The {item} hit {count} sales. Bob added a 'bestseller' tag. It works.",
  ],
  monster: [
    "{name} milestone: {count} served! Their kind trusts Bob — extra rep per visit.",
    "Bob memorized the usual order. {count} served like {name} — rep flows faster.",
    "{count} sales to {name} and friends. Word spreads in the dungeon: more rep.",
    "Regulars' wall updated: {name} x{count}. Their visits impress the whole cave.",
  ],
  everything: [
    "Every item past {tier} sales! Bob rang the big bell. Everything pays more now.",
    "Full-shelf milestone: {tier}+ of each. Mob Mart is officially an institution.",
  ],
  lines: [   // line-unlock ladder: fired when a loyalty crossing unlocks authored material
    "New {name} stories unlocked! The regulars have history now.",
    "{name} is a true regular — Bob's heard things. Fresh tales in the log.",
  ],
};

// Fill + pick. Milestones are rare events, so a plain random pick is fine (no anti-repeat memory).
export function milestoneLine(kind, params) {
  const pool = MILESTONE_LINES[kind] ?? [];
  const template = pool[Math.floor(Math.random() * pool.length)] ?? '';
  return template
    .replace(/\{count\}/g, String(params.count ?? ''))
    .replace(/\{item\}/g, params.item ?? 'item')
    .replace(/\{name\}/g, params.name ?? 'Someone')
    .replace(/\{tier\}/g, String(params.tier ?? ''));
}
