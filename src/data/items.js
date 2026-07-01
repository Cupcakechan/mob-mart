// items.js — item registry. A new item here auto-flows through cards, serving, and combat.
// Prices/stock mirror the mockup.
export const ITEMS = {
  club:         { id:'club',         displayName:'Club',         iconId:'club',         category:'weapon',     basePrice:12, restockCost:6, startStock:3, maxStock:5, combatEffect:6 },
  metal_helmet: { id:'metal_helmet', displayName:'Metal Helmet', iconId:'metal_helmet', category:'armor',      basePrice:18, restockCost:9, startStock:2, maxStock:5, combatEffect:5 },
  hp_flask:     { id:'hp_flask',     displayName:'HP Flask',     iconId:'hp_flask',     category:'consumable', basePrice:15, restockCost:8, startStock:4, maxStock:5, combatEffect:4 },
};

// Display order for the shelf cards.
export const ITEM_ORDER = ['club', 'metal_helmet', 'hp_flask'];
