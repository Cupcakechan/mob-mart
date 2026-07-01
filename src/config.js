// config.js — ALL tunable values live here so balancing is a one-value change.
export const CONFIG = {
  stage: { width: 1280, height: 720 },

  economy: {
    startingGold: 40,          // enough to restock a couple of times; the mockup's 126 is mid-game
    startingReputation: 0,
  },

  queue: {
    // M1: one customer at a time.
    nextCustomerDelaySec: 1.2, // gap after one leaves before the next walks up
    firstCustomerDelaySec: 0.4,// how soon the first customer arrives after opening the shop
    // Patience is lenient in M1 — its only job here is to stop the loop soft-locking if a
    // customer can't be served (out of stock / can't afford). They leave; never a hard fail.
    defaultPatienceSec: 20,
    leaveRepPenalty: 1,        // rep ding when a customer gives up waiting (tracked; shown in log)
  },

  combat: {
    encounterDifficulty: 10,   // fixed in M1; scales with progress later
    rngSpread: 6,              // +/- range added to the score
    // score = itemEffect + monster.combatMod - encounterDifficulty + rng(-spread..+spread)
    thresholds: { excellent: 8, success: 2, partial: -1, failure: -6 },
    repByTier: { excellent: 5, success: 2, partial: 1, failure: -1, funnyFailure: -2 },
  },

  log: { maxEntries: 30 },
};
