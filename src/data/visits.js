// visits.js — Special Visits (Option 2, "The Inspection" — Daniel 2026-07-07): the dragon VIP's
// voice. Leaf registry, marketevents.js's shape: pools + pure fills, no state knowledge. The
// mechanics (trigger, grade math, latch) live in game.js; the tunables in CONFIG.visits.
//
// Fiction from the art itself: glasses + clipboard = OFFICIALDOM IN A MONSTER SHOP. He arrives
// announced, he samples impartially, and his tip is a report card on the shelves. Hygiene laws
// apply (no second person, log width <=80, bubbles <=48) — suite-scanned like every pool.

export const VISIT_LINES = {
  announce: [
    'The Inspector has arrived. Everyone act natural.',
    'A dragon with a clipboard just walked in. Straighten the shelves.',
  ],
  bubble: [
    'The Inspector! Look busy!',
    "Clipboard dragon, twelve o'clock.",
  ],
  // {pct} = shelf fullness percent, {tip} = the graded gold. Filled lengths stay <=80.
  grade: [
    'Shelves at {pct}% \u2014 the Inspector tips {tip} gold.',
    'The clipboard reads {pct}%. The tip reads {tip} gold.',
  ],
};

const pickFrom = (pool) => pool[Math.floor(Math.random() * pool.length)] ?? '';

export function visitAnnounceLine() { return pickFrom(VISIT_LINES.announce); }
export function visitBubbleLine() { return pickFrom(VISIT_LINES.bubble); }

export function visitGradeLine(pct, tip) {
  return pickFrom(VISIT_LINES.grade)
    .replace(/\{pct\}/g, String(pct))
    .replace(/\{tip\}/g, String(tip));
}
