// materials.js — MONSTER MATERIALS registry (the Trade Market reform, Pass A — TRADE_MARKET_DESIGN.md).
// One identity material per monster FAMILY. The registry is the single source of truth: a monster
// row's `material` field points here, drops flow from serves (game.js), counts live in
// state.materials, and the Trade Market (trademarket.js) prices offers in these. A NEW customer
// family becomes a faucet by adding its row here + a `material` field on its monster row — no
// other wiring (the auto-flow law).
//
// Icons: Daniel's PixelLab art at assets/sprites/<iconId>.png (64×64, the item-icon convention).
// Every read site is graceful — a missing PNG hides the <img> / falls back to text, never crashes.
//
// LAW (TRADE_MARKET_DESIGN.md §4.1): materials NEVER convert to or from gold. No sellMaterial,
// no buyMaterial, ever — the moment gold buys these, gold is the universal solvent again and the
// reform is dead. Faucets: serves (Pass A), expeditions / Doug / VIP visits (Pass B+).
export const MATERIALS = {
  slime_core:       { id: 'slime_core',       displayName: 'Condensed Slime Core',    iconId: 'slime_core' },
  echo_fang:        { id: 'echo_fang',        displayName: 'Echo Fang',               iconId: 'echo_fang' },
  femur_charm:      { id: 'femur_charm',      displayName: 'Lucky Femur Charm',       iconId: 'femur_charm' },
  stolen_trinket:   { id: 'stolen_trinket',   displayName: 'Stolen Trinket',          iconId: 'stolen_trinket' },
  carapace_shard:   { id: 'carapace_shard',   displayName: 'Polished Carapace Shard', iconId: 'carapace_shard' },
  bogstone_bauble:  { id: 'bogstone_bauble',  displayName: 'Bogstone Bauble',         iconId: 'bogstone_bauble' },
  // Sources below are NOT live in Pass A. The rows exist so recipes, saves, and UI are ready the
  // moment their faucet lands (spider/demon customers; the Inspector's VIP drop — Scale vs Seal
  // split is Daniel's open call, TRADE_MARKET_DESIGN.md §3). eligibleMaterialIds() in
  // trademarket.js keys off LIVE monster rows, so these can never appear in an offer early.
  dragon_scale:     { id: 'dragon_scale',     displayName: 'Dragon Scale',            iconId: 'dragon_scale' },
  inspectors_seal:  { id: 'inspectors_seal',  displayName: "Inspector's Seal",        iconId: 'inspectors_seal' },
  silk_bundle:      { id: 'silk_bundle',      displayName: 'Silk Bundle',             iconId: 'silk_bundle' },
  infernal_ember:   { id: 'infernal_ember',   displayName: 'Infernal Ember',          iconId: 'infernal_ember' },
};

// Display order: live-faucet families first (queue-roster order), reserved rows after.
export const MATERIAL_ORDER = [
  'slime_core', 'echo_fang', 'femur_charm', 'stolen_trinket', 'carapace_shard', 'bogstone_bauble',
  'dragon_scale', 'inspectors_seal', 'silk_bundle', 'infernal_ember',
];
