// reputation.js — reputation tier logic (pure). Thresholds live in config.
import { CONFIG } from './config.js';

// Current tier { label, min, index } for a reputation value.
// Tiers are ascending by `min`; returns the highest tier whose threshold is met.
export function reputationTier(reputation) {
  const tiers = CONFIG.reputation.tiers;
  if (!tiers || tiers.length === 0) return { label: '', min: 0, index: 0 };   // guard: empty ladder
  let current = tiers[0], index = 0;
  for (let i = 0; i < tiers.length; i++) {
    if (reputation >= tiers[i].min) { current = tiers[i]; index = i; }
    else break;                       // ascending list: first unmet threshold ends the scan
  }
  return { label: current.label, min: current.min, index };
}

// --- FAME LEVELS (F1a — FAME_ECONOMY_DESIGN.md §4, Daniel's Option 3, 2026-07-12) ---------------
// Fame is the game's LEVEL track: an infinite generated curve the seven named rungs anchor onto
// (config derives each rung's min from this same math at load). Lifetime fame only — the tier
// convention — so spending on perks can never lower a level.

// Lifetime fame required to BE level n (n >= 1). Level 0 is the floor below the first threshold.
export function levelThreshold(n) {
  const L = CONFIG.reputation?.levels ?? { base: 25, growth: 1.6 };
  return n <= 0 ? 0 : Math.round(L.base * L.growth ** (n - 1));
}

// Current fame level for a lifetime-rep value. Loop, not log: exact at every boundary (float
// log at a threshold can land a hair under and misreport the level the player just earned),
// and the cap is a runaway guard, not a design ceiling — 999 levels ≈ 10^204 fame.
export function fameLevel(reputation) {
  let n = 0;
  while (n < 999 && reputation >= levelThreshold(n + 1)) n++;
  return n;
}

// The HUD remainder's data: how far to the NEXT level — and when that level is a named rung,
// its label rides along so the line can say "to Renowned" instead of "to Lv 13".
export function nextLevelInfo(reputation) {
  const next = fameLevel(reputation) + 1;
  const rung = (CONFIG.reputation.tiers ?? []).find((t) => t.level === next);
  return { level: next, remaining: levelThreshold(next) - Math.floor(reputation),
    rungLabel: rung?.label ?? null };
}
