// dossier.js — the Field Guide DOSSIER (2026-07-15, pass 2b): the content-selection leaf behind a
// full guide entry. PURE — no DOM, no state mutation, no Math.random (the trademarket.js /
// gregBubbleFor / offerRowHtml precedent) — so the whole reveal ladder is suite-assertable without
// a browser, and a UI bug can never leak content the ladder has not unlocked.
//
// THE JOB (Daniel's Option 2, 2026-07-15). The Field Guide CARD advertises: one tagline, the mob's
// one comic lever. The DOSSIER informs: four labelled field notes, one per pip, then the mob's
// golden line as the capstone. That is the sale-sign doctrine ("the board advertises, the overlay
// informs") applied to a second surface, and it is why the card carries ONE line and not five.
//
// WHAT THIS FILE USED TO DO, AND WHY IT NO LONGER DOES. The first 2b draft bucketed the 211 usable
// MONSTER_RESULTS lines into a "Greatest Hits" section under the notes. Daniel rejected it, and the
// reason is a register clash worth keeping written down: a battle-log line is the mob's POV IN A
// MOMENT, while the guide speaks in permanent truths. Recycling the log into the guide put the wrong
// voice on the page no matter how good the individual lines were. The Dossier is NEW writing, and
// the only recycled line left is the golden — which was always authored as a bestiary capstone
// ("The heroes have a name for Slimey now. He thinks it's a compliment. It is."). Do not re-add a
// results.js render here without re-reading this paragraph.
import { MONSTERS } from './monsters.js';
import { MONSTER_RESULTS } from './results.js';
import { MONSTER_BREAKPOINTS, crossedCount, nextBreakpoint } from './milestones.js';

// THE LADDER (Daniel's pick): SERVE breakpoints. Fame rungs were REJECTED, and the reason is
// load-bearing — fame is GLOBAL, so "more revealed about Slimey" must never unlock by trading
// swords. MONSTER_BREAKPOINTS already draws the pips on the guide card, so the ladder is visible
// before it is ever explained.
//
// Note i reveals at MONSTER_BREAKPOINTS[i], and the LAST rung is the golden line. That is the whole
// rule; there is no table here because there is nothing to tabulate. DERIVED, never hand-typed —
// the serve counts live in MONSTER_BREAKPOINTS and only there (§29's own day-old
// `ITEM_ORDER.length === 15` broke inside a day). §84 pins the arithmetic: notes-per-mob must equal
// breakpoints-minus-one, so ADDING a breakpoint fails the suite loudly rather than silently leaving
// a rung that reveals nothing.
export const DOSSIER_NOTES_PER_MOB = MONSTER_BREAKPOINTS.length - 1;

// The pip-5 heading. Not invented: three of the eight golden lines END on the word ("A legend."),
// so the guide is quoting the log rather than labelling it.
export const DOSSIER_GOLDEN_LABEL = 'The Legend';

const textOf = (t) => (typeof t === 'string' ? t : t?.text ?? '');
const isGolden = (t) => typeof t === 'object' && t !== null && t.golden === true;

// A guide entry has no item in it, so a line carrying an unfilled {item} placeholder can never
// render here. Only the golden is drawn from results.js now, and none of the eight currently carry
// one — this guard is for the ninth.
const hasItemSlot = (t) => textOf(t).includes('{item}');

// The mob's ONE golden line, wherever it lives. It is deliberately searched for across ALL tiers
// rather than read from `excellent`: seven of the eight live there and one lives in `funnyFailure`.
// Null for the Inspector — a once-a-day visitor was never given a golden (§54's flat four-tier
// batch, by design), so his entry simply ends at his fourth note.
export function goldenLineFor(id) {
  for (const pool of Object.values(MONSTER_RESULTS[id] ?? {})) {
    if (!Array.isArray(pool)) continue;
    for (const t of pool) if (isGolden(t) && !hasItemSlot(t)) return textOf(t);
  }
  return null;
}

// A full guide entry for one monster at one lifetime serve count. Pure; `served` is the only input
// that moves it, so the suite drives the whole ladder by passing numbers.
//
// RETURNS ONLY REVEALED CONTENT. A locked note is absent from the return value, not flagged inside
// it — by construction the renderer cannot spoil a note it was never handed. The skill's
// "by-construction beats by-analysis" rule, applied to a surface whose entire point is that things
// arrive later.
export function dossierFor(id, served = 0) {
  const m = MONSTERS[id];
  if (!m) return null;                                     // unknown id — the caller renders nothing
  const n = Number.isFinite(served) && served > 0 ? Math.floor(served) : 0;
  const isVip = m.special === true;
  const discovered = n > 0;
  const lastRung = MONSTER_BREAKPOINTS[MONSTER_BREAKPOINTS.length - 1];

  // VIPs have NO pips — binding since 2026-07-08 ("trophies, not ladders"), and the arithmetic
  // agrees: he arrives at most once per calendar day, so pip 3 would be 100 DAYS away and pip 5
  // would be a wall, not a rung. Discovery reveals his whole entry; everyone else climbs.
  const reached = (rung) => (isVip ? discovered : n >= rung);

  // A note past the table's end can never reveal (Infinity) rather than reveal immediately — a
  // fifth note added without a fifth rung degrades to invisible, never to a leak.
  const notes = discovered
    ? (m.lore?.notes ?? []).filter((_, i) => reached(MONSTER_BREAKPOINTS[i] ?? Infinity))
    : [];

  return {
    id,
    displayName: m.displayName ?? id,
    spriteId: m.spriteId ?? id,
    isVip,
    served: n,
    discovered,
    crossed: crossedCount(n, MONSTER_BREAKPOINTS),
    tagline: m.lore?.tagline ?? '',
    notes,
    golden: discovered && reached(lastRung) ? goldenLineFor(id) : null,
    // What the entry is still missing, for the guide's own honest footer. Without it an entry below
    // the first rung is a portrait and nothing else — indistinguishable from broken. Null for a VIP
    // (no ladder) and null once maxed. Same number the card's `next N` already shows: one fact.
    nextAt: isVip ? null : nextBreakpoint(n, MONSTER_BREAKPOINTS),
  };
}
