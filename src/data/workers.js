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
  },
  restocker: {
    id: 'restocker',
    displayName: 'Restocker',
    spriteId: 'restocker',        // art pending (small FLYER) — registered in main.js, placeholder
                                  // until the PNG lands (drop-a-png convention, same as Bob's anims)
    role: 'restock',
    flying: true,                 // flyer conventions: hover bob + altitude padding (scene.js reads this)
    baseInterval: 8,              // <-- TUNABLE: seconds per trickle unit (mini round C1: shadows
                                  //     base-Bob's ~6s drain on ONE item; can't top a whole shelf —
                                  //     assists active play, never replaces it). No speed upgrades
                                  //     this pass (leveling stays deferred per the handoff guardrail).
    hireCost: 600,                // <-- TUNABLE (Daniel, 2026-07-04): mid-game goal purchase — raised
                                  //     from the doc's 100-150 second-purchase band, his call.
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
