// config.js — ALL tunable values live here so balancing is a one-value change.
export const CONFIG = {
  stage: { width: 1280, height: 720 },

  economy: {
    startingGold: 40,          // enough to restock a couple of times; the mockup's 126 is mid-game
    startingReputation: 0,
  },

  reputation: {
    // Option A: reputation rewards *service*, not the off-screen battle outcome (which the player
    // doesn't control and is tuned to usually lose). Serving climbs rep; only neglect lowers it.
    perSale: 2,                // rep gained per completed sale
    leavePenalty: 1,           // rep lost when a customer leaves unserved (patience timeout)
    // Ascending by `min`; the HUD shows the highest tier whose threshold reputation has reached.
    // Display-only in M2 — M3 content will gate availability against these tiers.
    tiers: [
      { label: 'Neutral',  min: 0 },
      { label: 'Friendly', min: 20 },
      { label: 'Trusted',  min: 50 },
      { label: 'Beloved',  min: 100 },
    ],
  },

  queue: {
    // M1: one customer at a time.
    nextCustomerDelaySec: 1.2, // gap after one leaves before the next walks up
    firstCustomerDelaySec: 0.4,// how soon the first customer arrives after opening the shop
    // Patience is lenient — its only job in M1 is to stop the loop soft-locking if a customer
    // can't be served (out of stock / can't afford). They leave; never a hard fail.
    defaultPatienceSec: 20,
  },

  combat: {
    encounterDifficulty: 10,   // fixed in M1; scales with progress later
    rngSpread: 6,              // +/- range added to the score
    // score = itemEffect + monster.combatMod - encounterDifficulty + rng(-spread..+spread)
    // Tier drives the funny log line only — it has no effect on reputation or gold.
    thresholds: { excellent: 8, success: 2, partial: -1, failure: -6 },
  },

  log: { maxEntries: 30 },
};
