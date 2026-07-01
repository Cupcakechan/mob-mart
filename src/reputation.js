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
