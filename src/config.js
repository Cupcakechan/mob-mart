// config.js — ALL tunable values live here so balancing is a one-value change.
export const CONFIG = {
  stage: { width: 1280, height: 720 },

  economy: {
    startingGold: 40,          // enough to restock a couple of times; the mockup's 126 is mid-game
    startingReputation: 0,
  },

  // TRADE MARKET (reform Pass A — TRADE_MARKET_DESIGN.md). Every material/trade number is a dial
  // here; the harness re-measures after any change (the reform's acceptance law).
  materials: {
    baseCap: 10,               // per-material store cap (law §4.2: hoarding must not dissolve
                               // decisions). A full store LOSES further drops — that's the
                               // pressure. Per-material overrides: MATERIALS[id].cap (guarded).
    defaultEveryNServes: 5,    // fallback drop cadence when a monster row omits its own N
  },
  trade: {                     // daily-offer recipe bands (offerForDay, trademarket.js)
    typesMin: 1, typesMax: 2,  // distinct materials per offer
    unitsMin: 1, unitsMax: 2,  // units per material
    goldMultMin: 1.2,          // gold component = round(basePrice × [multMin..multMax]) — derived
    goldMultMax: 3.5,          // per item (D5-A, Pass B): a helm recipe prices like a helm, a
                               // tonic like a tonic; THE margin dial the harness flagged.
    feature: {                 // the daily SPECIAL's discount (Daniel's Option 3, 2026-07-12):
                               // the featured offer trades below the posted band ON PURPOSE —
                               // gold discounts alone decay (gold is the runaway currency, the
                               // audit's oldest finding), so the special also cuts materials.
      goldMult: 0.6,           // featured gold = round(band gold × this). <1 always.
      matUnitsOff: 1,          // units off the featured offer's LARGEST material stack, clamped
                               // to min 1 — an all-1s recipe gets the gold cut alone.
    },
  },
  expedition: {                // EXPEDITIONS MVP (reform step 4 — one monster, one door, one slot)
    fee: 25,                   // gold, paid at departure. The fee prices it as a SERVICE — the
                               // real constraint is the slot + the clock (law: never a converter)
    durationSec: 60,           // one run's wall-clock length (ticks live; away time credits at boot)
    haul: 3,                   // materials on a clean return — ~30+ serves' worth of one family,
                               // the targeted burst that makes choosing WHO to send a decision
    mishapChance: 0.25,        // comic mishap on return: HALF haul rounded up, never zero,
                               // NEVER death (split-loops law — the battle log's gag is untouched)
  },
  commission: {                // COMMISSIONS (reform step 6 — design doc §8; Daniel's Option 2:
                               // the NAMED CLIENT). One order slot; day-seeded; trade-tier only.
    countMin: 2, countMax: 4,  // order size band (seeded per day, commissions.js)
    daysMin: 2, daysMax: 3,    // deadline band in MARKET DAYS — the clock is the trade day, so
                               // the forecast is part of the plan (hold? trade? send a run?)
    premiumMult: 2.0,          // fulfillment pays the normal PER-UNIT payout (basePrice × loyalty
                               // mults — the payout law holds, basePrice untouched) × this. The
                               // premium buys TENSION, not wealth (finding ii, 2026-07-12): worker
                               // wages, not commissions, are the planned perpetual drain.
    repPerUnit: 3,             // flat fame bonus per unit — modest beside serve rep by design
    checkSec: 5,               // update()'s rollover-check throttle (the market check's cadence)
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
      { label: 'Renowned', min: 500 },  // Fame (Pass 2): tiers read LIFETIME rep (never decreases)
      { label: 'Legendary', min: 1500 },
      { label: 'Mythic',   min: 5000 }, // Deep Sinks (Option 2, Daniel 2026-07-07): the reserved
                                        // rung, now LIVE — gates the workers' DEEP training band
                                        // (levels 6-10, workers.js). Budgets (x1.45), the crate
                                        // (9 units / 70 gold), the Fame track node, and the HUD
                                        // remainder all auto-flow from this one row.
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
    returnCooldownSec: 8,      // QUEUE UNIQUENESS (Option 2, Daniel 2026-07-05): after ANY queue
                               // exit (served/left/dismissed) a mob can't respawn for this long —
                               // the served-Skele-respawns-mid-march fix. THE MATH THAT SET 8:
                               // steady-state cooling count = cooldown / serve interval, and it
                               // must stay well under the roster (6) at MAXED throughput (~2.5s
                               // serves): 18 starved the endgame stage (director test caught it,
                               // ~7 cooling); 8 -> ~3 cooling, pool sustained. Still 2x the
                               // celebrant march, so the fiction holds. Transient.
    affordableWantBias: 4,     // BUDGET-AWARE WANTS (Option 2 soft bias, Daniel 2026-07-06): at
                               // the want pick's item stage, affordable items weigh x this. SOFT
                               // (not a hard filter) so the broke state survives as texture —
                               // the auto-wave, brokeGrace, and the broke-comedy register all
                               // live on it. 1 disables the bias entirely.
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

  market: {
    // Market Day (retention pass Option 2, Daniel 2026-07-06): one day-seeded demand event per
    // calendar day + a once-a-day supplier crate on first open. THE LAW (same as milestones):
    // the event multiplies the PAYOUT of matching-category sales, never basePrice — so a demand
    // spike can never price a customer out. Event choice is derived from the LOCAL date alone
    // (deterministic — reloads recompute the identical market; nothing to reroll).
    payoutMult: 1.5,           // default event bonus (+50%); a registry row's payoutMult overrides
    wantBias: 2,               // want-pick CATEGORY stage: today's category weighs x this. SOFT,
                               // same philosophy as affordableWantBias — flavor, not a filter
    crateBaseUnits: 3,         // free restock units in the crate at Neutral...
    crateUnitsPerTier: 1,      // ...plus this many per fame tier (Legendary = 3 + 5 = 8)
    crateGoldBase: 10,         // gold sweetener at Neutral...
    crateGoldPerTier: 10,      // ...plus this per fame tier (Legendary = 60)
    crateUnitGoldFallback: 6,  // full shelves: each UNDEALT unit converts to this much gold
                               // (~an average restock cost — the crate never arrives empty-handed)
    rolloverCheckSec: 5,       // how often update() checks the calendar (leave-it-open players
                               // get their new market + crate at local midnight)
  },

  visits: {
    // Special Visits (Option 2, "The Inspection" — Daniel 2026-07-07): the dragon VIP. Once per
    // LOCAL calendar day at Legendary+, a spawn beat may be him instead; his tip is a GRADE of
    // the shelves at the moment of service (inspectionGrade, game.js) — payout-side by law.
    requiredTier: 5,           // Legendary opens visits (index into reputation.tiers)
    chancePerSpawn:  0.02,      // roll per spawn beat until the day's visit lands (latched after)
    tipPerFullness: 100,       // gold at 100% shelf fullness (scales linearly with fullness)
    tipPerCategory: 25,        // gold per category with stock >= 1 (variety pays)
    fameBonus: 25,             // flat lifetime-rep bonus on serving him (a VIP's word travels)
    sealFullness: 0.9,         // TOP-GRADE line (Pass B, §13.1): an inspection at/above this
                               // fullness drops the Inspector's Seal — the report card's stakes
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
    reportFallbackSec: 3.0,    // battle-report safety valve: a pending report older than this is
                               // delivered by update() even if its celebrant never fires the
                               // door-entry event (dropped by the cap, tab hidden, art edge case).
    milestoneSpacingSec: 2.5 },// gold-line stagger (Daniel, 2026-07-05): when one serve earns
                               // several milestone lines (breakpoint + new-stories + fame can
                               // stack), the first lands instantly and the rest wait this long
                               // between beats — each gold moment gets read.

  licenseAlerts: {
    // License alerts via BOB'S bubble (UX roadmap 3). Trigger is TIER ELIGIBILITY, never
    // affordability — gold fluctuates every serve and would spam the bubble.
    announceSec: 6,            // each crossing announcement holds the bubble this long
    reminderSec: 30,           // gentle recurring nudge while ANY eligible license sits unbought
  },

  gregBubble: {
    // Greg's restock report (Option 1 duty cycle, Daniel 2026-07-05): the bubble is A way to
    // restock, not THE way — while something is out it pops periodically instead of standing.
    showSec: 10,               // how long each report stays up
    cycleSec: 45,              // time between reports while something remains out
  },
                               // Celebration runs ~2.15s (hop 700 + march ~1000 + enter 450), so
                               // 3.0 only ever fires when the visual didn't.
};
