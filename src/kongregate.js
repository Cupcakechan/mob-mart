// kongregate.js — M6: the isolated Kongregate bridge. THE one file that knows Kongregate exists.
//
// Design rule (PROJECT_HANDOFF §2/§8): the bridge NO-OPS when the API isn't present, so the local
// build, itch build, and headless tests never depend on it — and a Kongregate outage can't break
// the game. The API's loader global (window.kongregateAPI) only exists when the page included
// Kongregate's script tag (index.kongregate.html does; index.html does not), and per Kongregate's
// docs the API only functions on kongregate.com anyway.
//
// Kongregate-side setup note: every stat name submitted here must ALSO be created (same exact
// name) in the game's Kongregate edit page under Statistics, or submissions are ignored.

let kongregate = null;   // the live API object once loaded; null = not on Kongregate (or not ready)

// Initialize the bridge. Safe to call unconditionally from main.js on every platform:
// no loader global -> silent no-op. Never throws.
export function initKongregate(onReady) {
  const loader = (typeof window !== 'undefined') ? window.kongregateAPI : undefined;
  if (!loader) return;                       // local / itch / tests: not on Kongregate, do nothing
  try {
    loader.loadAPI(() => {
      try {
        kongregate = loader.getAPI();
        submitStat('loaded', 1);             // the M6 proof stat: one load ping per session
        if (onReady) onReady(kongregate);
      } catch { kongregate = null; }         // a broken API object degrades to "not on Kongregate"
    });
  } catch { /* loader misbehaving -> stay a no-op; the game must never care */ }
}

// Submit a statistic. No-ops (never throws) when not on Kongregate or before the API is ready.
export function submitStat(name, value) {
  try { kongregate?.stats?.submit(name, value); } catch { /* ignore */ }
}

// True only when running on Kongregate with the API ready (for future conditional UI, if ever).
export function isKongregate() {
  return kongregate !== null;
}
