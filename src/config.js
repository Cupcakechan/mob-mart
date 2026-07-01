// config.js — ALL tunable values live here so balancing is a one-value change.
export const CONFIG = {
  stage: { width: 1280, height: 720 },

  economy: {
    startingGold: 40,          // enough to restock a couple of times; the mockup's 126 is mid-game
    startingReputation: 0,
  },

  reputation: {
    // Option A: reputation rewards *service*, not the off-screen battle outcome.
    perSale: 2,                // rep gained per completed sale
    leavePenalty: 1,           // rep lost when a customer leaves unserved (patience timeout)
    tiers: [
      { label: 'Neutral',  min: 0 },
      { label: 'Friendly', min: 20 },
      { label: 'Trusted',  min: 50 },
      { label: 'Beloved',  min: 100 },
    ],
  },

  serve: {
    // Base pause after a completed sale, during which Serve is disabled (Bob wrapping up).
    // Faster Counter shortens it: effective = base / (1 + serveSpeed effect). ~0.5s ~= Bob's
    // 6-frame serving animation at 12fps, so a fresh serve lines up with the animation.
    cooldownSec: 0.5,
  },

  queue: {
    maxLength: 4,              // most mobs that can wait in line at once
    spawnIntervalSec: 3,       // a new mob joins the back this often, if there's room
    firstCustomerDelaySec: 0.4,// initial delay after opening the shop
    // Each mob waits this long (patience drains while in line, wherever they stand) then leaves.
    defaultPatienceSec: 20,
  },

  combat: {
    encounterDifficulty: 10,   // fixed in M1; scales with progress later
    rngSpread: 6,              // +/- range added to the score
    // Tier drives the funny log line only — no effect on reputation or gold.
    thresholds: { excellent: 8, success: 2, partial: -1, failure: -6 },
  },

  log: { maxEntries: 30 },
};
