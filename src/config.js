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
      { label: 'Friendly', min: 25 },   // TUNING SWEEP: tiers stretched (were 20/50/100) so rep
      { label: 'Trusted',  min: 75 },   // stays meaningful past the first minutes; signage still
      { label: 'Beloved',  min: 200 },  // makes Beloved a session-one goal, not a minute-five one
      { label: 'Renowned', min: 500 },  // Fame (Pass 2): tiers read LIFETIME rep (never decreases);
      { label: 'Legendary', min: 1500 },// a Mythic ~5000 row is the reserved future rung
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
    // SPAWN DIRECTOR (replaces the flat spawnIntervalSec): next-spawn interval indexed by CURRENT
    // queue length (index clamps to the last entry). Self-balancing at every Bob speed — the flat
    // rate's equilibrium was min(1, throughput-limited) customers: maxed Bob served faster than
    // 2.6s arrivals, so the "spotlight" line was forever one mob. Empty shop -> hurry (1.2s);
    // healthy line -> relax (3.6s). Keeps 2-3 mobs on stage without flooding the slow early game.
    spawnIntervalByQueue: [1.2, 1.8, 2.6, 3.6],
    firstCustomerDelaySec: 0.4,// initial delay after opening the shop
    // Each mob waits this long (patience drains while in line, wherever they stand) then leaves.
    defaultPatienceSec: 24,    // sweep: was 20 — longer queues shouldn't bleed rep by themselves
    // With a serve-worker hired, a FRONT customer who can't afford their item is auto-waved (rep-
    // neutral) after this grace — the one blocker the player can't clear by restocking. Long enough
    // to read the "Can't afford it" state, short enough that they don't stall the line and make
    // affordable customers behind them time out (−rep). Manual-only play is unaffected.
    brokeGraceSec: 2,
  },

  combat: {
    encounterDifficulty: 10,   // fixed in M1; scales with progress later
    rngSpread: 6,              // +/- range added to the score
    // Tier drives the funny log line only — no effect on reputation or gold.
    thresholds: { excellent: 8, success: 2, partial: -1, failure: -6 },
  },

  offline: {
    // M5 "While you were away": a hired serve-worker keeps selling (capped, stock-consuming).
    capHours: 12,              // <-- BASE cap (Pass 3: raised from 2h — the research flags short
                               //     caps as a churn driver; 12h covers a work day + evening).
                               //     Stock still binds long before time; the cap is a safety rail.
    minAwaySec: 60,            // modal only shows after this much time away (quick reloads stay silent)
    efficiency: 1.0,           // multiplier on offline sale count (the classic "offline earns at X%"
                               // dial). 1.0 = full rate; lower it if offline ever outshines active play.
  },

  fame: {
    // Fame-scaled customer budgets (Pass 3): famous shops attract wealthier mobs. Budget rolls are
    // multiplied by 1 + perTierAboveBeloved x (tier index - 3), for tiers ABOVE Beloved (index 3).
    // At Renowned x1.15, Legendary x1.30 — tuned so tier-2 prices (26–30) are reachable on good
    // rolls without making base items trivial. THE dial if tier-2 sales feel too rare/common.
    budgetPerTierAboveBeloved: 0.15,
  },

  workers: {
    // The customer-visibility floor: a FRONT customer must stand at the counter this long before a
    // hired worker may serve them, no matter how fast upgrades make Bob. Guarantees every mob is
    // SEEN (name + want readable) — at max Faster Counter, serves had become invisible teleports to
    // the battle log. Manual serving is deliberately NOT gated: the player clicking is the player
    // looking, and staying faster than Bob keeps active play a strict bonus.
    greetSec: 1.2,
  },

  log: { maxEntries: 30,
    reportFallbackSec: 3.0 },  // battle-report safety valve: a pending report older than this is
                               // delivered by update() even if its celebrant never fires the
                               // door-entry event (dropped by the cap, tab hidden, art edge case).

  licenseAlerts: {
    // License alerts via BOB'S bubble (UX roadmap 3). Trigger is TIER ELIGIBILITY, never
    // affordability — gold fluctuates every serve and would spam the bubble.
    announceSec: 6,            // each crossing announcement holds the bubble this long
    reminderSec: 30,           // gentle recurring nudge while ANY eligible license sits unbought
  },
                               // Celebration runs ~2.15s (hop 700 + march ~1000 + enter 450), so
                               // 3.0 only ever fires when the visual didn't.
};
