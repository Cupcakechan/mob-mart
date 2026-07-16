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
                  acquisition: 'trade',   // TRADE-TIER PROOF (reform Pass A): stock arrives ONLY via the
                                          // Market Board (materials + gold at today's rate) — never gold
                                          // restock, never crates, never offline reserve. The license
                                          // below stays the SELL gate (TRADE_MARKET_DESIGN.md §5).
                                          // Field is guarded everywhere: (acquisition ?? 'gold').
                  license: { cost: 800,  requiredTier: 4 } },   // Renowned
  greater_flask:{ id:'greater_flask', acquisition:'trade',displayName:'Greater Flask',iconId:'greater_flask',category:'consumable', basePrice:27, restockCost:13, startStock:0, maxStock:5, combatEffect:8,
                  license: { cost: 800,  requiredTier: 4 } },   // Renowned
  knight_helm:  { id:'knight_helm', acquisition:'trade',  displayName:'Knight Helm',  iconId:'knight_helm',  category:'armor',      basePrice:26, restockCost:15, startStock:0, maxStock:5, combatEffect:9,
                  license: { cost: 1200, requiredTier: 5 } },   // Legendary — the top-shelf goal

  // --- Batch 1 (items phase, 2026-07-04): FREE TIER. Priced <= the roster's MINIMUM budget roll
  // (10), so a free-tier want can never strand a customer at 'cant-afford'. Remember combatEffect
  // is COMEDY TEXTURE, not economy (the outcome tier only picks the log line — payout is computed
  // before resolveCombat): eff-1 gear exists to lose hilariously, at zero economic cost.
  tattered_shirt:{ id:'tattered_shirt', displayName:'Tattered Shirt', iconId:'tattered_shirt', category:'armor',      basePrice:5,  restockCost:2, startStock:3, maxStock:5, combatEffect:1 },
  bandages:      { id:'bandages',       displayName:'Bandages',       iconId:'bandages',       category:'consumable', basePrice:6,  restockCost:3, startStock:3, maxStock:5, combatEffect:2 },
  wooden_shield: { id:'wooden_shield',  displayName:'Wooden Shield',  iconId:'wooden_shield',  category:'armor',      basePrice:8,  restockCost:4, startStock:2, maxStock:5, combatEffect:3 },
  rusty_key:     { id:'rusty_key',      displayName:'Rusty Key',      iconId:'rusty_key',      category:'consumable', basePrice:10, restockCost:5, startStock:2, maxStock:5, combatEffect:1 },
                  // (keys are one-use consumables — Daniel's call; chain base for nothing, pure curio)

  // --- Batch 1: the TRUSTED/BELOVED license rung — cheap early licenses between the free shelf
  // and the 800g Renowned tier, so "affordable-soon" wants exist at every stage (idle research
  // rule). Chain bases live here: wooden_shield -> Iron Buckler, leather_bracer -> Iron Gauntlet
  // (batch 2; a chain is just a pricier licensed row — no mechanic).
  leather_bracer:{ id:'leather_bracer', displayName:'Leather Bracer', iconId:'leather_bracer', category:'armor',      basePrice:14, restockCost:7,  startStock:0, maxStock:5, combatEffect:5,
                  license: { cost: 150, requiredTier: 2 } },   // Trusted
  murk_tonic:    { id:'murk_tonic',     displayName:'Murk Tonic',     iconId:'murk_tonic',     category:'consumable', basePrice:13, restockCost:6,  startStock:0, maxStock:5, combatEffect:4,
                  license: { cost: 150, requiredTier: 2 } },   // Trusted
  pickaxe:       { id:'pickaxe',        displayName:'Pickaxe',        iconId:'pickaxe',        category:'weapon',     basePrice:16, restockCost:8,  startStock:0, maxStock:5, combatEffect:6,
                  license: { cost: 200, requiredTier: 2 } },   // Trusted
  quiver:        { id:'quiver', acquisition:'trade',         displayName:'Quiver of Arrows', iconId:'quiver',       category:'weapon',     basePrice:20, restockCost:10, startStock:0, maxStock:5, combatEffect:7,
                  license: { cost: 300, requiredTier: 3 } },   // Beloved
  zip_tonic:     { id:'zip_tonic', acquisition:'trade',      displayName:'Zip Tonic',      iconId:'zip_tonic',      category:'consumable', basePrice:22, restockCost:11, startStock:0, maxStock:5, combatEffect:7,
                  license: { cost: 300, requiredTier: 3 } },   // Beloved

  // --- Batch 2 (chain tops, 2026-07-04): an "upgrade chain" is NAMING + PRICING, not a mechanic —
  // each top is just a pricier licensed row that strictly beats its base on eff AND price (the
  // chain invariant, suite-pinned). Slotted into the license-cost gap between Beloved 300 and
  // Renowned 800. (Optional \`upgradeOf\` field deferred until the shop UI ever groups chains.)
  iron_buckler:  { id:'iron_buckler', acquisition:'trade',   displayName:'Iron Buckler',   iconId:'iron_buckler',   category:'armor',      basePrice:18, restockCost:9,  startStock:0, maxStock:5, combatEffect:6,
                  license: { cost: 300, requiredTier: 3 } },   // Beloved — chain top of Wooden Shield (8/eff 3)
  iron_gauntlet: { id:'iron_gauntlet', acquisition:'trade',  displayName:'Iron Gauntlet',  iconId:'iron_gauntlet',  category:'armor',      basePrice:24, restockCost:12, startStock:0, maxStock:5, combatEffect:8,
                  license: { cost: 500, requiredTier: 4 } },   // Renowned — chain top of Leather Bracer (14/eff 5)

  // --- Batch 3a (leather starter set, 2026-07-08): FREE TIER slot-fillers, all priced <= 10.
  // combatEffect is COMEDY TEXTURE (which log line), not economy. Rounds out equipment slots
  // (FEET is new) and adds three free chain-BASES existing licensed rows already top:
  // cap -> Metal Helmet, gloves -> Leather Bracer, sling -> Quiver. Roster-wide floor stays
  // afforded: the Rat purse is 6, and tattered_cloak at 5 keeps every mob a free-tier target.
  tattered_cloak:{ id:'tattered_cloak', displayName:'Tattered Cloak', iconId:'tattered_cloak', category:'armor',  basePrice:5, restockCost:2, startStock:3, maxStock:5, combatEffect:1 },
  leather_boots: { id:'leather_boots',  displayName:'Leather Boots',  iconId:'leather_boots',  category:'armor',  basePrice:6, restockCost:3, startStock:3, maxStock:5, combatEffect:2 },
  leather_cap:   { id:'leather_cap',    displayName:'Leather Cap',    iconId:'leather_cap',    category:'armor',  basePrice:7, restockCost:3, startStock:3, maxStock:5, combatEffect:2 },
  leather_gloves:{ id:'leather_gloves', displayName:'Leather Gloves', iconId:'leather_gloves', category:'armor',  basePrice:8, restockCost:4, startStock:3, maxStock:5, combatEffect:3 },
  leather_sling: { id:'leather_sling',  displayName:'Leather Sling',  iconId:'leather_sling',  category:'weapon', basePrice:9, restockCost:4, startStock:3, maxStock:5, combatEffect:3 },

  // --- Batch 3b (upgrades + curios, 2026-07-08): LICENSED rows. Three chain tops that strictly
  // beat their base on eff + price (the chain invariant), plus two standalone curios. All start
  // empty (startStock 0) and unlock at a fame rung. Licensed => they do NOT join the everything
  // laggard ladder (that stays the free set), so they add reach without diluting the global tier.
  silver_key:  { id:'silver_key', acquisition:'trade',  displayName:'Silver Key',  iconId:'silver_key',  category:'consumable', basePrice:20, restockCost:10, startStock:0, maxStock:5, combatEffect:3,
                 license: { cost: 200, requiredTier: 2 } },   // Trusted -- chain top of Rusty Key (10/eff 1)
  spiked_club: { id:'spiked_club', acquisition:'trade', displayName:'Spiked Club', iconId:'spiked_club', category:'weapon',     basePrice:24, restockCost:12, startStock:0, maxStock:5, combatEffect:9,
                 license: { cost: 300, requiredTier: 3 } },   // Beloved -- chain top of Club (12/eff 6)
  iron_shield: { id:'iron_shield', acquisition:'trade', displayName:'Iron Shield', iconId:'iron_shield', category:'armor',      basePrice:32, restockCost:16, startStock:0, maxStock:5, combatEffect:9,
                 license: { cost: 600, requiredTier: 4 } },   // Renowned -- chain top of Iron Buckler (18/eff 6): 3-link w/ Wooden Shield
  map:         { id:'map',         displayName:'Map',         iconId:'map',         category:'consumable', basePrice:18, restockCost:9,  startStock:0, maxStock:5, combatEffect:1,
                 license: { cost: 150, requiredTier: 2 } },   // Trusted -- standalone curio
  salt:        { id:'salt',        displayName:'Bag of Salt', iconId:'salt',        category:'consumable', basePrice:15, restockCost:7,  startStock:0, maxStock:5, combatEffect:2,
                 license: { cost: 150, requiredTier: 2 } },   // Trusted -- standalone curio (anti-slime gag)
};

// Moved from game.js (shop deal pass, 2026-07-16): this is pure registry+state logic and the leaf
// data modules (marketevents' deal picker, trademarket's board) need it without importing game.js
// — the "leaf, no cycle" architecture the render layer pins. game.js re-exports it, so its ~30
// existing import sites are untouched.
export function isItemUnlocked(state, itemId) {
  const item = ITEMS[itemId];
  if (!item) return false;
  if (!item.license) return true;                     // base items need no license
  return state?.licenses?.[itemId] === true;
}

// Display order for the shelf cards (base row, tier-2 row, batch-1 free four + license rung, batch-2 chain tops).
export const ITEM_ORDER = ['club', 'metal_helmet', 'hp_flask', 'iron_sword', 'greater_flask', 'knight_helm',
  'tattered_shirt', 'bandages', 'wooden_shield', 'rusty_key',
  'leather_bracer', 'murk_tonic', 'pickaxe', 'quiver', 'zip_tonic',
  'iron_buckler', 'iron_gauntlet',
  'tattered_cloak', 'leather_boots', 'leather_cap', 'leather_gloves', 'leather_sling',
  'silver_key', 'spiked_club', 'iron_shield', 'map', 'salt'];
