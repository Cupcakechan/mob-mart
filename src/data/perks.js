// perks.js — "Fame Perks" (idle-roadmap Pass 2). A second purchase registry, deliberately the same
// shape as upgrades.js, but COSTED IN REPUTATION instead of gold — the spend half of the dual-track
// Fame system (state.reputation = spendable balance; state.lifetimeRep = the never-decreasing
// number that drives tiers, so spending can never cost you a gate you earned).
//
// requiredTier indexes into CONFIG.reputation.tiers:
// 0 Neutral · 1 Friendly · 2 Trusted · 3 Beloved · 4 Renowned · 5 Legendary
// warm_welcome is deliberately gated at RENOWNED so the first new tier gates something on day one.
export const PERKS = {
  haggler_charm: {
    id: 'haggler_charm',
    displayName: "Haggler's Charm",
    description: 'Cheaper restocks (-1 gold each)',
    effect: { type: 'restockDiscount', perLevel: 1 },  // gold off every restock (floored at 1 in game.js)
    baseCost: 200,
    costGrowth: 1.6,     // 200 -> 320 -> 512 rep
    maxLevel: 3,
    requiredTier: 2,     // Trusted
  },
  velvet_rope: {
    id: 'velvet_rope',
    displayName: 'Velvet Rope',
    description: 'A longer line (+1 queue slot)',
    effect: { type: 'queueLength', perLevel: 1 },
    baseCost: 300,
    costGrowth: 1.6,     // 300 -> 480 rep
    maxLevel: 2,
    requiredTier: 3,     // Beloved
  },
  warm_welcome: {
    id: 'warm_welcome',
    displayName: 'Warm Welcome',
    description: 'Patient customers (+4s patience)',
    effect: { type: 'patience', perLevel: 4 },
    baseCost: 250,
    costGrowth: 1.6,     // 250 -> 400 rep
    maxLevel: 2,
    requiredTier: 4,     // Renowned — the new tier's first purchase
  },
};

export const PERK_ORDER = ['haggler_charm', 'velvet_rope', 'warm_welcome'];

export function perkLevel(state, id) {
  return state.perks?.[id] ?? 0;
}

export function perkCost(id, level) {
  const p = PERKS[id];
  if (!p) return Infinity;
  return Math.round(p.baseCost * Math.pow(p.costGrowth ?? 1, level));
}

export function isPerkMaxed(state, id) {
  const p = PERKS[id];
  if (!p) return true;
  return perkLevel(state, id) >= (p.maxLevel ?? Infinity);
}

// Sum an effect type across all owned perk levels (mirror of upgrades' sumEffect).
export function sumPerkEffect(state, type) {
  let total = 0;
  for (const id of PERK_ORDER) {
    const p = PERKS[id];
    if (p?.effect?.type === type) total += (p.effect.perLevel ?? 0) * perkLevel(state, id);
  }
  return total;
}
