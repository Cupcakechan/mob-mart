// marketevents.js — Market Day (retention pass, Option 2 — Daniel 2026-07-06): one DEMAND EVENT
// per calendar day plus the once-a-day supplier crate. This module is the pure/leaf half: the
// event registry, the deterministic date -> event math, and the announcement line pools. The
// stateful half (payout hook, want bias, crate grant) lives in game.js.
//
// THE LAW (inherited from milestones.js): a demand event multiplies the PAYOUT of matching-
// category sales, NEVER basePrice — affordability is untouched, so a demand spike can never
// price a customer out. Fiction to match: the dungeon outside shifts (a scare, a season, a
// parade) and grateful mobs TIP — prices never move.
//
// Determinism rule: the event is derived from the LOCAL calendar date alone (no RNG, no save
// field), so a reload recomputes the identical event — nothing to farm, nothing to reroll. Every
// player on the same date sees the same market, which is the "market day" feel.

// One row per event. `category` must be a live items.js category; `payoutMult` is optional (the
// CONFIG.market.payoutMult dial is the default). A new event is one row here — it auto-joins the
// daily rotation with zero extra wiring.
export const MARKET_EVENTS = {
  dragon_scare: {
    id: 'dragon_scare', displayName: 'Dragon Scare', category: 'consumable',
    announce: [
      'A dragon was spotted two valleys over. Tonics and snacks pay extra today.',
      'Dragon scare in the hills — mobs tip extra for anything swallowable today.',
    ],
    bubble: ['Dragon scare! Consumables are hot today.',
      'Nothing calms nerves like a swallowable.',
      'Big lizard rumors. Tonics moving fast.'],
  },
  dungeon_sniffles: {
    id: 'dungeon_sniffles', displayName: 'Dungeon Sniffles', category: 'consumable',
    announce: [
      'The dungeon sniffles are going around. Remedies of every kind pay a bonus.',
      'Sniffles season below. Anything swallowable sells at a happy premium today.',
    ],
    bubble: ['Sniffles season — tonics tip well today.',
      'Every cough buys a remedy. Good day.',
      'Get well soon, dungeon. Buy something.'],
  },
  hero_parade: {
    id: 'hero_parade', displayName: 'Hero Parade', category: 'weapon',
    announce: [
      'A hero parade passes the dungeon today. Mobs tip extra to look armed.',
      'Heroes parading nearby — nothing sells like a weapon held bravely. Tips up.',
    ],
    bubble: ['Hero parade! Weapons tip extra today.',
      'Look armed, feel brave. Weapons move.',
      'Parade day. Every mob wants a prop sword.'],
  },
  dueling_season: {
    id: 'dueling_season', displayName: 'Dueling Season', category: 'weapon',
    announce: [
      'Dueling season opens. Every polite challenge needs a weapon — they pay extra.',
      "It's dueling season below. Weapons leave the shelf with a bonus attached.",
    ],
    bubble: ['Dueling season — weapons pay a bonus.',
      'Polite duels, impolite demand. Weapons up.',
      'Duels at dawn. Weapons selling by dusk.'],
  },
  porcupine_migration: {
    id: 'porcupine_migration', displayName: 'Porcupine Migration', category: 'armor',
    announce: [
      'The porcupines are migrating. Suddenly everyone appreciates armor — tips up.',
      'Porcupine migration week: padding is priceless, and armor pays a bonus.',
    ],
    bubble: ['Porcupines migrating! Armor pays extra.',
      'Quill season. Padding is beyond price.',
      'Hug a porcupine once. Then buy armor.'],
  },
  falling_rock_season: {
    id: 'falling_rock_season', displayName: 'Falling Rock Season', category: 'armor',
    announce: [
      'Falling-rock season in the caves. Helmets and shields earn a grateful bonus.',
      'Rocks are falling on schedule again. Armor sells with extra thanks today.',
    ],
    bubble: ['Falling rocks! Armor tips well today.',
      'The ceiling is generous. Helmets are wise.',
      'Rocks fall, everyone shops. Armor up.'],
  },
};

export const MARKET_EVENT_ORDER = [
  'dragon_scare', 'dungeon_sniffles', 'hero_parade',
  'dueling_season', 'porcupine_migration', 'falling_rock_season',
];

// Display labels for the HUD banner / away modal — kept in lockstep with the shelf tabs in
// panels.js ("Weapons / Armor / Consumables"). Guarded read sites fall back to the raw category.
export const CATEGORY_LABELS = { weapon: 'Weapons', armor: 'Armor', consumable: 'Consumables' };

// The crate's log line ({units} free restock units dealt + {gold} sweetener). The 'full' pool
// covers landed === 0 (every unlocked shelf at cap) — the crate never arrives empty-handed
// because undealt units convert to gold (CONFIG.market.crateUnitGoldFallback).
export const CRATE_LINES = {
  stocked: [
    'The morning supplier crate: {units} items shelved, plus {gold} gold in the straw.',
    'Supplier crate came early: {units} items stocked, {gold} gold under the lid.',
  ],
  full: [
    'Shelves already full — the supplier left {gold} gold and a compliment.',
  ],
};

// --- Date -> event math (pure, deterministic) ---------------------------------------------------

// Local calendar date as 'YYYY-MM-DD'. LOCAL on purpose: "a new market day" should flip at the
// player's midnight, not UTC's — the same convention a shop sign would use.
export function dayKeyOf(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// FNV-1a over the day key — tiny, stable, and spreads consecutive dates well. >>> 0 keeps it an
// unsigned 32-bit int so the modulo below can never see a negative. Exported since the Trade
// Market (trademarket.js) seeds its daily offers from the same hash family — one date-math home.
export function hashDayKey(key) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// Today's event id. Pure function of the date string: same day -> same event, everywhere, always.
// Occasional back-to-back repeats across days are accepted (real markets have runs on flasks);
// an anti-repeat rule was considered and skipped as complexity without payoff.
export function eventIdForDay(dayKey) {
  return MARKET_EVENT_ORDER[hashDayKey(dayKey) % MARKET_EVENT_ORDER.length];
}

// --- Line picks + fills (milestoneLine's contract: rare events, plain random pick) ---------------

const pickFrom = (pool) => pool[Math.floor(Math.random() * pool.length)] ?? '';

export function marketAnnounceLine(event) {
  return pickFrom(event?.announce ?? []);
}

export function marketBubbleLine(event) {
  return pickFrom(event?.bubble ?? []);
}

export function crateLine(units, gold) {
  const pool = units > 0 ? CRATE_LINES.stocked : CRATE_LINES.full;
  return pickFrom(pool)
    .replace(/\{units\}/g, String(units))
    .replace(/\{gold\}/g, String(gold));
}

// HUD banner text: "Dragon Scare · Consumables +50%". The mult arrives resolved (registry
// override ?? CONFIG default) so this stays a pure formatter. Used for the chip's TOOLTIP since
// the layout pass — the visible chip carries the compact form below.
export function marketBannerText(event, mult) {
  const pct = Math.round(((mult ?? 1) - 1) * 100);
  const label = CATEGORY_LABELS[event?.category] ?? event?.category ?? '';
  return `${event?.displayName ?? ''} \u00b7 ${label} +${pct}%`;
}

// Compact chip form: "Armor +50%" — the actionable fact (which shelf, how much) in the smallest
// footprint. Born of the HUD layout budget (2026-07-07): the full-name chip pushed the centered
// cluster into the wall shelf's airspace; the event NAME stays on the tooltip, the log line,
// Bob's bubble, and the away modal.
export function marketBannerCompact(event, mult) {
  const pct = Math.round(((mult ?? 1) - 1) * 100);
  const label = CATEGORY_LABELS[event?.category] ?? event?.category ?? '';
  return `${label} +${pct}%`;
}

// The Special-of-the-Day board's quip (Daniel's board, 2026-07-07): DETERMINISTIC per
// (day, event) — a sign chalked in the morning must not re-write itself on every reload, which
// a Math.random pick would. Same FNV as the event pick, salted with the event id so a growing
// pool reshuffles per-event rather than in lockstep. Draws from the bubble pool (authored
// board-short, <=48 chars, suite-pinned).
export function boardQuipFor(event, dayKey) {
  const pool = event?.bubble ?? [];
  if (pool.length === 0) return '';
  return pool[hashDayKey(`${dayKey ?? ''}:${event.id}`) % pool.length];
}

// DEMAND SURFACE — PROMOTED TO THE HEADLINE (board restructure, Daniel's Option 2, 2026-07-16).
// The old three-line board mixed three registers with no hierarchy — a trade deal, a world event
// and a forecast, all chalked alike, anchored by calendar words ("TODAY... Tomorrow") instead of
// meaning. The demand line is the one with no other persistent ambient home (the HUD chip retired
// at 18be9de) AND the one that changes what happens in the room the sign hangs in — so it leads.
// Still board-voiced, COMPACT and category-driven ("Armor selling hot" — worst case is
// "Consumables selling hot", 23 chars, structurally immune to the iconic rows' overflow class),
// and still carries NO percentage (the board advertises; the overlay informs — the standing
// sale-sign doctrine, pinned since F4). The event's NAME stays on the overlay banner, the log
// line and Bob's bubble — the board carries the actionable shelf, not the lore.
// Pure and deterministic: the event is date-derived, so this recomputes identically on reload,
// and the caller folds its key into the board's write-on/rewrite trigger. Empty string when no
// event resolves (defensive; a live day always has one) so the row simply doesn't draw.
export function boardEventLine(event) {
  const label = CATEGORY_LABELS[event?.category] ?? event?.category ?? '';
  return label ? `${label} selling hot` : '';
}
