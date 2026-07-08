// fametrack.js — pure data for the Fame track panel (UX roadmap item 2). Fame is LINEAR, so the
// "unlock tree" is a vertical TRACK: one node per reputation tier, each fanning out what reaching
// it unlocks. REGISTRY-SCANNED by design: licenses (items.js), perks (perks.js), and upgrades
// (upgrades.js) auto-populate their nodes from requiredTier, and the fame budget bump derives from
// the CONFIG dial — new gated content appears on the track with ZERO wiring. DISPLAY ONLY:
// nothing here spends or gates; this module reads registries and returns plain data for
// panels.js / hud.js to render.
import { CONFIG } from '../config.js';
import { ITEMS, ITEM_ORDER } from './items.js';
import { UPGRADES, UPGRADE_ORDER } from './upgrades.js';
import { PERKS, PERK_ORDER } from './perks.js';
import { WORKERS, WORKER_ORDER } from './workers.js';

// One node per tier, ascending: { index, label, min, unlocks: [{ kind, label, detail }] }.
// kinds: 'upgrade' | 'perk' | 'license' | 'worker' | 'budget' — panels.js colors chips by kind.
export function trackByTier() {
  const tiers = CONFIG.reputation.tiers ?? [];
  const nodes = tiers.map((t, i) => ({ index: i, label: t.label, min: t.min, unlocks: [] }));
  if (nodes.length === 0) return nodes;            // guard: an empty ladder renders an empty track
  // Clamp a bad requiredTier onto the nearest real node — a typo'd registry row must degrade to a
  // misplaced chip, never crash the panel.
  const at = (i) => nodes[Math.min(Math.max(i ?? 0, 0), nodes.length - 1)];

  for (const id of UPGRADE_ORDER) {
    const u = UPGRADES[id];
    at(u.requiredTier).unlocks.push({ kind: 'upgrade', label: u.displayName, detail: u.description });
  }
  for (const id of PERK_ORDER) {
    const p = PERKS[id];
    at(p.requiredTier).unlocks.push({ kind: 'perk', label: p.displayName, detail: p.description });
  }
  for (const id of ITEM_ORDER) {
    const it = ITEMS[id];
    if (!it.license) continue;                     // license-free items are never tier-gated
    at(it.license.requiredTier).unlocks.push({
      kind: 'license', label: it.displayName, detail: `license \u25c6 ${it.license.cost}`,
    });
  }
  // Tier-gated HIRES (Greg, 2026-07-04): workers with a requiredTier join their node — the same
  // auto-flow promise. Ungated workers (Bob, requiredTier absent) are day-one staff, not unlocks,
  // so they stay off the track.
  for (const id of WORKER_ORDER) {
    const w = WORKERS[id];
    if (w.requiredTier === undefined) continue;
    at(w.requiredTier).unlocks.push({
      kind: 'worker', label: w.displayName, detail: `hire \u25c6 ${w.hireCost}`,
    });
  }

  // Deep training (Deep Sinks, 2026-07-07): a worker's DEEP level band is tier-gated content, so
  // it chips onto its gate's node — the Mythic rung's headline. Same auto-flow promise: a future
  // worker shipping a `levels` block with a deepTier lists itself with zero wiring.
  for (const id of WORKER_ORDER) {
    const w = WORKERS[id]; const L = w.levels;
    if (!L || L.deepTier === undefined) continue;
    at(L.deepTier).unlocks.push({
      kind: 'worker',
      label: `${w.displayName} \u2014 ${L.name} ${L.deepFrom}\u2013${L.maxLevel}`,
      detail: 'deep training',
    });
  }

  // Fame-scaled budgets — CONFIG-derived rather than registry, but the same auto-flow promise:
  // retune the dial (or add tiers) and these lines follow. The bump applies ABOVE Beloved (index
  // 3), mirroring spawnCustomer's math exactly: mult = 1 + per x (tierIndex - 3).
  const per = CONFIG.fame?.budgetPerTierAboveBeloved ?? 0;
  if (per > 0) {
    for (const n of nodes) {
      if (n.index <= 3) continue;
      const mult = (1 + per * (n.index - 3)).toFixed(2).replace(/0$/, '');
      n.unlocks.push({ kind: 'budget', label: 'Richer customers', detail: `budgets \u00d7${mult}` });
    }
  }
  return nodes;
}

// The HUD remainder ("· 32♛ to Trusted"): the next unreached tier for a LIFETIME fame value, or
// null at the top of the ladder. Pure function of the number — callers pass fameOf(state) (or the
// hud's equivalent inline expression), never the spendable wallet.
export function nextTierInfo(fame) {
  for (const t of CONFIG.reputation.tiers ?? []) {
    if (fame < t.min) return { label: t.label, remaining: t.min - Math.floor(fame) };
  }
  return null;
}
