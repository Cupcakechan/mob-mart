// items.js — item registry. A new item here auto-flows through cards, serving, and combat.
// Prices/stock mirror the mockup.
//
// TIER-2 items (Pass 3, "Better Stock") carry a `license` field: { cost (gold, one-time),
// requiredTier (Fame tier index) }. Until licensed (state.licenses[id] === true) the item can't be
// restocked, wanted by customers, or sold offline — its card shows the license as the visible want.
// License-FREE items are the stable base set (the "everything" milestone tier keys off them — see
// milestones.js). Tier-2 prices are chosen against Fame-scaled budgets: at Legendary (x1.3) even
// Batty's 8–18 roll tops out at 23, so tier-2 stays a premium sale, not the volume business.
export const ITEMS = {
  club:         { id:'club',         displayName:'Club',         iconId:'club',         category:'weapon',     basePrice:12, restockCost:6, startStock:3, maxStock:5, combatEffect:6 },
  metal_helmet: { id:'metal_helmet', displayName:'Metal Helmet', iconId:'metal_helmet', category:'armor',      basePrice:18, restockCost:9, startStock:2, maxStock:5, combatEffect:5 },
  hp_flask:     { id:'hp_flask',     displayName:'HP Flask',     iconId:'hp_flask',     category:'consumable', basePrice:15, restockCost:8, startStock:4, maxStock:5, combatEffect:4 },
  iron_sword:   { id:'iron_sword',   displayName:'Iron Sword',   iconId:'iron_sword',   category:'weapon',     basePrice:26, restockCost:13, startStock:0, maxStock:5, combatEffect:10,
                  license: { cost: 800,  requiredTier: 4 } },   // Renowned
  greater_flask:{ id:'greater_flask',displayName:'Greater Flask',iconId:'greater_flask',category:'consumable', basePrice:27, restockCost:13, startStock:0, maxStock:5, combatEffect:8,
                  license: { cost: 800,  requiredTier: 4 } },   // Renowned
  knight_helm:  { id:'knight_helm',  displayName:'Knight Helm',  iconId:'knight_helm',  category:'armor',      basePrice:30, restockCost:15, startStock:0, maxStock:5, combatEffect:9,
                  license: { cost: 1200, requiredTier: 5 } },   // Legendary — the top-shelf goal
};

// Display order for the shelf cards (base row, then the licensed tier-2 row).
export const ITEM_ORDER = ['club', 'metal_helmet', 'hp_flask', 'iron_sword', 'greater_flask', 'knight_helm'];
