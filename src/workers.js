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
    role: 'serve',                // 'serve' | 'restock' (restock is a future worker; loop skips it)
    baseInterval: 6,              // <-- TUNABLE: seconds between auto-serve attempts (before serveSpeed)
    hireCost: 50,                 // <-- TUNABLE: one-time gold cost to hire
  },
};

export const WORKER_ORDER = ['mimic_merchant'];

// True only if the worker has been hired. Guarded so a missing/legacy save reads as "not owned".
export function isWorkerOwned(state, id) {
  return state.workers?.[id]?.owned === true;
}

// One-time hire cost. Infinity for unknown ids (guard), so canHireWorker fails closed.
export function workerHireCost(id) {
  return WORKERS[id]?.hireCost ?? Infinity;
}
