// upgrades.js — upgrade registry + pure accessors. Effects are TYPED and summed generically, so
// adding an upgrade is a data change; a new effect type only needs one consumer wired somewhere.
export const UPGRADES = {
  extra_shelf: {
    id: 'extra_shelf',
    displayName: 'Extra Shelf',
    description: '+1 max stock per item',
    effect: { type: 'maxStock', perLevel: 1 },
    baseCost: 60,
    costGrowth: 1.8,       // cost(level) = round(baseCost * costGrowth^level)
    maxLevel: 5,
    requiredTier: 0,       // rep-tier index needed to unlock (gating lands in M3 pass 3)
  },
  faster_counter: {
    id: 'faster_counter',
    displayName: 'Faster Counter',
    description: 'Shorter serve cooldown',
    effect: { type: 'serveSpeed', perLevel: 0.3 },   // effective cooldown = base / (1 + 0.3*level)
    baseCost: 80,
    costGrowth: 1.8,
    maxLevel: 5,
    requiredTier: 1,       // unlocks at Friendly (rep 20)
  },
  better_signage: {
    id: 'better_signage',
    displayName: 'Better Signage',
    description: 'More reputation per sale',
    effect: { type: 'repMult', perLevel: 0.5 },      // rep/sale = round(perSale * (1 + 0.5*level))
    baseCost: 100,
    costGrowth: 1.8,
    maxLevel: 5,
    requiredTier: 2,       // unlocks at Trusted (rep 50)
  },
  backroom_storage: {
    id: 'backroom_storage',
    displayName: 'Backroom Storage',
    description: 'Bob restocks offline from the backroom',
    // +1 full shelf-restock of RESERVE per level, sold while you're away (offline.js). Chosen over
    // the originally-planned '+capHours' effect, which the test suite proved inert: Bob's interval
    // empties any shelf in minutes, so STOCK — never time — binds offline earnings. Reserve units
    // pay basePrice minus restockCost (Bob buys the restock out of the margin). Scales with
    // effectiveMaxStock, so Extra Shelf compounds into the backroom.
    effect: { type: 'offlineReserve', perLevel: 1 },
    baseCost: 250,
    costGrowth: 1.8,       // 250 -> 450 -> 810 (total 1510 to max)
    maxLevel: 3,           // L3 ~= 4x offline income on a same-size shelf
    requiredTier: 3,       // unlocks at Beloved (rep 100) — finally gives the top tier a purchase
  },
};

export const UPGRADE_ORDER = ['extra_shelf', 'faster_counter', 'better_signage', 'backroom_storage'];

export function upgradeLevel(state, id) {
  return state.upgrades?.[id] ?? 0;
}

// Cost to buy the NEXT level from `level`. Infinity for unknown ids (guard).
export function upgradeCost(id, level) {
  const u = UPGRADES[id];
  if (!u) return Infinity;
  return Math.round(u.baseCost * Math.pow(u.costGrowth ?? 1, level));
}

export function isMaxed(state, id) {
  const u = UPGRADES[id];
  if (!u) return true;
  return upgradeLevel(state, id) >= (u.maxLevel ?? Infinity);
}

// Sum of all active upgrade effects of a given type (perLevel * level). Generic — new effect
// types don't touch this; they just need a consumer that reads sumEffect(state, 'theType').
export function sumEffect(state, type) {
  let total = 0;
  for (const id of UPGRADE_ORDER) {
    const eff = UPGRADES[id].effect;
    if (eff?.type === type) total += (eff.perLevel ?? 0) * upgradeLevel(state, id);
  }
  return total;
}
