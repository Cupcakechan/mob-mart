// workers.js — worker registry + pure accessors. Data-driven exactly like items/upgrades: a new
// worker is a single entry that auto-flows through hire, save, and the auto-serve loop with no extra
// wiring. M4 ships Bob only (role 'serve'); the 'restock' role and worker leveling are later passes.
//
// Per-worker tunables (baseInterval, hireCost) live HERE next to the worker data — same convention as
// items.js (basePrice) and upgrades.js (baseCost). Global levers stay in config.js.
export const WORKERS = {
  mimic_merchant: {
    id: 'mimic_merchant',
    displayName: 'Bob',
    spriteId: 'mimic_merchant',   // reuses Bob's existing sprite; auto-serve replays his serve anim
    role: 'serve',                // 'serve' | 'restock' (each role has its own updateWorkers branch)
    baseInterval: 6,              // <-- TUNABLE: seconds between auto-serve attempts (before serveSpeed)
    hireCost: 50,                 // <-- TUNABLE: one-time gold cost to hire
    levels: {                     // Deep Sinks (Option 2, Daniel 2026-07-07): the repeatable gold
      name: 'Salesmanship',       //   sink. Research curve: GENTLE 1.15 growth so the ladder lasts
      desc: '+1\u25c6 tip per sale',   //   many purchases, with a x3 bump entering the deep band
      effect: { type: 'saleTip', perLevel: 1 },   // FLAT gold added per completed sale — linear
                                  //   production vs exponential cost, the genre seesaw. Rides the
                                  //   PAYOUT only (the milestone law): affordability never moves.
      baseCost: 2000, costGrowth: 1.15, maxLevel: 10,
      deepFrom: 6, deepTier: 6, deepCostMult: 3,  // levels 6+ need MYTHIC (tier index 6), cost x3 —
                                  //   the rung's content IS the deep band (fametrack chips it)
    },
  },
  restocker: {
    id: 'restocker',
    displayName: 'Greg',          // the Restocker's name (Daniel, 2026-07-04) — a small gargoyle
    spriteId: 'restocker',        // static frame (greg.png -> restocker.png, 112x112); the flight
                                  // strip lands as greg_fly.png (112px frames, count auto-sliced)
    role: 'restock',
    flying: true,                 // flyer conventions: hover bob + altitude padding (scene.js reads this)
    requiredTier: 2,              // <-- TUNABLE (Daniel, 2026-07-04): hire gated behind Trusted —
                                  //     fame-gated like licenses (canHireWorker checks it, the
                                  //     Workers card shows "Reach Trusted", and the Fame track
                                  //     auto-lists him on the Trusted node). Bob has no
                                  //     requiredTier: every read site guards with ?? 0.
    baseInterval: 8,              // <-- TUNABLE: seconds per trickle unit (mini round C1: shadows
                                  //     base-Bob's ~6s drain on ONE item; can't top a whole shelf —
                                  //     assists active play, never replaces it). No speed upgrades
                                  //     this pass (leveling stays deferred per the handoff guardrail).
    hireCost: 600,                // <-- TUNABLE (Daniel, 2026-07-04): mid-game goal purchase — raised
                                  //     from the doc's 100-150 second-purchase band, his call.
    levels: {                     // Deep Sinks: Greg's ladder mirrors Bob's numbers exactly.
      name: 'Deeper Backroom',
      desc: '+1 offline reserve refill',
      effect: { type: 'offlineReserve', perLevel: 1 },  // extends the SAME per-item effect Backroom
                                  //   Storage feeds — the reserve stays BOUNDED (a count of full
                                  //   refills, never time-derived), so the load-bearing
                                  //   stock-binds-before-time property is untouched.
      baseCost: 2000, costGrowth: 1.15, maxLevel: 10,
      deepFrom: 6, deepTier: 6, deepCostMult: 3,
    },
  },
};

export const WORKER_ORDER = ['mimic_merchant', 'restocker'];

// True only if the worker has been hired. Guarded so a missing/legacy save reads as "not owned".
export function isWorkerOwned(state, id) {
  return state.workers?.[id]?.owned === true;
}

// One-time hire cost. Infinity for unknown ids (guard), so canHireWorker fails closed.
export function workerHireCost(id) {
  return WORKERS[id]?.hireCost ?? Infinity;
}

// --- Worker training (Deep Sinks, 2026-07-07). Pure accessors, the upgrades.js contract. -------

export function workerLevel(state, id) {
  return state?.workers?.[id]?.level ?? 0;
}

// Cost to buy the NEXT level from the current one. cost(level) = base * growth^level, x deepCostMult
// once the level being bought sits in the deep band — the research's "make it bumpy," placed where
// the Mythic gate already marks a threshold.
export function workerLevelCost(id, level) {
  const L = WORKERS[id]?.levels;
  if (!L) return Infinity;                           // fail closed for unlevellable/unknown workers
  const bump = (level + 1) >= (L.deepFrom ?? Infinity) ? (L.deepCostMult ?? 1) : 1;
  return Math.round(L.baseCost * Math.pow(L.costGrowth, level) * bump);
}

export function isWorkerLevelMaxed(state, id) {
  return workerLevel(state, id) >= (WORKERS[id]?.levels?.maxLevel ?? 0);
}

// Sum a typed level effect across OWNED workers — sumEffect's shape, worker-side. Ownership gates
// on purpose: a tampered `level` on an unhired worker must stay inert (levels can only be bought
// while owned, so this is belt-and-braces, not a reachable state).
export function sumWorkerEffect(state, type) {
  let total = 0;
  for (const id of WORKER_ORDER) {
    const L = WORKERS[id]?.levels;
    if (!L || L.effect?.type !== type) continue;
    if (!isWorkerOwned(state, id)) continue;
    total += (L.effect.perLevel ?? 0) * workerLevel(state, id);
  }
  return total;
}
