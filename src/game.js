// game.js — core loop logic. Operates on the state object; no DOM/canvas here (so it's testable).
import { CONFIG } from './config.js';
import { PERKS, PERK_ORDER, perkLevel, perkCost, isPerkMaxed, sumPerkEffect } from './data/perks.js';
import { itemGoldMult, monsterRepMult, globalGoldMult, everythingTier,
  ITEM_BREAKPOINTS, MONSTER_BREAKPOINTS, EVERYTHING_TIERS, milestoneLine, licenseBubbleLine } from './data/milestones.js';
import { MONSTERS, MONSTER_IDS } from './data/monsters.js';
import { ITEMS, ITEM_ORDER } from './data/items.js';
import { UPGRADES, upgradeLevel, upgradeCost, isMaxed, sumEffect } from './data/upgrades.js';
import { WORKERS, WORKER_ORDER, isWorkerOwned, workerHireCost } from './data/workers.js';
import { randInt, pick, weightedPick } from './utils.js';
import { WORKER_HIRE_LINES } from './data/results.js';
import { resolveCombat } from './combat.js';
import { reputationTier } from './reputation.js';
import { logLine } from './messages.js';
import { MONSTER_RESULTS } from './data/results.js';   // line-unlock: scan for minServes batches at crossings (leaf registry, no cycle)

// --- Customer spawning -------------------------------------------------------

export function spawnCustomer(state) {
  const monster = MONSTERS[pick(MONSTER_IDS)];
  // Wants (A2, items-scaffold pass): CATEGORY affinity first, then an item WITHIN it. Two-stage on
  // purpose — a monster's personality share ("Froggo is half potions") holds no matter how big a
  // category grows; per-item share dilutes as the catalog does, which is how a real shop feels.
  // itemBias (?? 1) makes signature loves non-uniform within a category. The Pass-3 unlock filter
  // is unchanged: locked tier-2 items are invisible to customers; without state (older tests),
  // only license-free items count — the safe default.
  const unlockedIds = ITEM_ORDER.filter((id) =>
    state ? isItemUnlocked(state, id) : !ITEMS[id]?.license);
  const catEntries = Object.entries(monster.categoryWeights ?? {})
    .map(([cat, weight]) => ({
      value: cat, weight,
      ids: unlockedIds.filter((id) => ITEMS[id].category === cat),
    }))
    .filter((e) => e.ids.length > 0 && (e.weight ?? 0) > 0);
  let wantedItemId = null;
  if (catEntries.length > 0) {
    const cat = weightedPick(catEntries);
    const ids = catEntries.find((e) => e.value === cat)?.ids ?? [];
    wantedItemId = weightedPick(ids.map((id) => ({ value: id, weight: monster.itemBias?.[id] ?? 1 })));
  }
  // Fallback must be an ITEM id (guards a monster shipped with missing/empty categoryWeights). A
  // monster id here once made the customer want a nonexistent item -> a permanent 'no-item' front
  // blocker. ITEM_ORDER[0] is always license-free.
  wantedItemId = wantedItemId ?? ITEM_ORDER[0];
  const [minB, maxB] = monster.budgetRange ?? [10, 20];
  // Fame-scaled budgets: tiers ABOVE Beloved (index 3) attract wealthier mobs — the customer-side
  // answer to tier-2 prices. x1.15 at Renowned, x1.30 at Legendary (CONFIG.fame dial).
  const tierIdx = state ? reputationTier(fameOf(state)).index : 0;
  const budgetMult = 1 + (CONFIG.fame?.budgetPerTierAboveBeloved ?? 0) * Math.max(0, tierIdx - 3);
  return {
    monsterId: monster.id,
    wantedItemId,
    budget: Math.round(randInt(minB, maxB) * budgetMult),
    patienceRemaining: CONFIG.queue.defaultPatienceSec + (state ? sumPerkEffect(state, 'patience') : 0),  // Warm Welcome
    brokeWait: 0,               // seconds spent unaffordable at the front; drives the worker auto-wave
    frontWait: 0,               // seconds spent AT the front; gates the worker greet delay (feel fix)
    state: 'queued',
  };
}

// --- Serving (always acts on the FRONT of the line, queue[0]) -----------------

export function serveBlockReason(state) {
  const c = state.queue[0];
  if (!c) return 'no-customer';
  if (state.serveCooldown > 0) return 'cooling-down';           // counter busy after the last sale
  const item = ITEMS[c.wantedItemId];
  if (!item) return 'no-item';
  if ((state.items[c.wantedItemId]?.stock ?? 0) <= 0) return 'out-of-stock';
  if (c.budget < item.basePrice) return 'cant-afford';
  return null;
}

// Base serve cooldown shortened by Faster Counter. Asymptotic (divide by 1+speed) so it never
// hits zero no matter how many levels stack.
export function effectiveServeCooldown(state) {
  return CONFIG.serve.cooldownSec / (1 + sumEffect(state, 'serveSpeed'));
}

// Reputation gained per sale, boosted by Better Signage. Rounded so the HUD stays whole-number.
export function effectiveRepPerSale(state) {
  return Math.round(CONFIG.reputation.perSale * (1 + sumEffect(state, 'repMult')));
}

export function serveCurrent(state) {
  if (serveBlockReason(state) !== null) return false;
  const c = state.queue[0];
  const monster = MONSTERS[c.monsterId];
  const item = ITEMS[c.wantedItemId];

  // Milestone bonuses (Regulars' Loyalty) multiply the PAYOUT, never the price — affordability
  // above keeps checking basePrice, so loyalty growth can never lock customers out. This sale pays
  // with the multipliers earned BEFORE it; the ledger increments after, so a crossing kicks in from
  // the NEXT sale (and announces below).
  const repGain = Math.round(effectiveRepPerSale(state) * monsterRepMult(state, c.monsterId));
  const goldGain = Math.round(item.basePrice * itemGoldMult(state, c.wantedItemId) * globalGoldMult(state));
  state.items[c.wantedItemId].stock -= 1;                       // hand over the item
  state.gold += goldGain;                                       // take payment (base + loyalty on top)
  const prevTierIdx = reputationTier(fameOf(state)).index;      // tier BEFORE this sale's fame lands —
  // captured before EITHER rep write: fameOf falls back to state.reputation when lifetimeRep is
  // absent (a pre-Fame save's first serve), and that fallback must not already include this gain.
  state.reputation += repGain;                                  // spendable balance...
  state.lifetimeRep = fameOf(state) + repGain;                  // ...and the tier track (never falls)

  // License alerts (UX roadmap 3): a FAME TIER CROSSING that brings newly eligible licenses gets
  // the permanent milestone line here, plus queued speech for BOB'S bubble (transient, like
  // pendingReports — never serialized; a reload mid-announcement drops the bubble, never the log
  // line). Trigger is TIER ELIGIBILITY, never affordability. The range check (prev < req <= now)
  // keeps a multi-tier jump honest, and already-owned licenses never re-announce.
  const nowTierIdx = reputationTier(fameOf(state)).index;
  if (nowTierIdx > prevTierIdx) {
    const newly = ITEM_ORDER.filter((id) => {
      const req = ITEMS[id].license?.requiredTier;
      return req !== undefined && state.licenses?.[id] !== true
        && req > prevTierIdx && req <= nowTierIdx;
    });
    if (newly.length) {
      pushLog(state, { text: milestoneLine('fame',
        { items: newly.map((id) => ITEMS[id].displayName).join(', ') }),
        repDelta: 0, tier: 'milestone', monsterId: monster.id });
      const bs = (state.bobSpeech ??= { queue: [], current: null });
      // Each entry carries its license's itemId — the DOM bubble (panels.js) is CLICKABLE and
      // routes to exactly this license on the shelf.
      for (const id of newly) bs.queue.push({ text: licenseBubbleLine('announce', { item: ITEMS[id].displayName }), itemId: id });
    }
  }

  const { tier } = resolveCombat(monster, item);               // off-screen fight -> outcome tier
  // serves INCLUDES this one (the ledger increments below): the 25th serve draws from the 25-batch.
  const { text, golden } = logLine(monster.id, tier, { name: monster.displayName,
    item: item.displayName, itemId: c.wantedItemId,
    serves: (state.stats.monsterServes[c.monsterId] ?? 0) + 1 });
  // Battle-report timing (Daniel, 2026-07-04): the RESULT line lands when the celebrant ENTERS the
  // battle door — not at the counter. The fight is decided here (same math, same moment) but the
  // report is queued; delivery = the render's door-entry event (main.js wires it) OR the fallback
  // timer below in update(). Economy stays at serve on purpose: they PAY at the counter; only the
  // news travels slow. Milestone lines below stay INSTANT — they're shop-side voice ("Sale #N!"),
  // which happens at the sale. Net log order: milestone at serve, result ~2s later on top of it.
  (state.pendingReports ??= []).push({
    entry: { text, golden, repDelta: repGain, tier, monsterId: monster.id },
    fallback: CONFIG.log?.reportFallbackSec ?? 3.0,
  });

  // Lifetime ledger + crossing announcements (gold lines in the log, above the battle line).
  const prevEvery = everythingTier(state);
  const soldNow = (state.stats.itemSales[c.wantedItemId] ?? 0) + 1;
  const servedNow = (state.stats.monsterServes[c.monsterId] ?? 0) + 1;
  state.stats.itemSales[c.wantedItemId] = soldNow;
  state.stats.monsterServes[c.monsterId] = servedNow;
  if (ITEM_BREAKPOINTS.includes(soldNow)) {
    pushLog(state, { text: milestoneLine('item', { count: soldNow, item: item.displayName }),
      repDelta: 0, tier: 'milestone', monsterId: monster.id });
  }
  if (MONSTER_BREAKPOINTS.includes(servedNow)) {
    pushLog(state, { text: milestoneLine('monster', { count: servedNow, name: monster.displayName }),
      repDelta: 0, tier: 'milestone', monsterId: monster.id });
    // Line-unlock ladder: if this crossing unlocks authored material (any template tagged
    // minServes === servedNow), say so — discoverability for the comedy payoff, and the Bestiary
    // pip that just filled doubles as the marker. Registry-scanned, so future batches auto-announce.
    const unlocks = Object.values(MONSTER_RESULTS[monster.id] ?? {})
      .some((arr) => arr.some((t) => typeof t !== 'string' && t.minServes === servedNow));
    if (unlocks) {
      pushLog(state, { text: milestoneLine('lines', { name: monster.displayName }),
        repDelta: 0, tier: 'milestone', monsterId: monster.id });
    }
  }
  const nowEvery = everythingTier(state);
  if (nowEvery > prevEvery) {                                   // this sale's item was the laggard
    // B2 ratchet: persist the newly earned tier so future roster growth can never take it back.
    state.stats.everythingTierEarned = Math.max(state.stats.everythingTierEarned ?? 0, nowEvery);
    pushLog(state, { text: milestoneLine('everything', { tier: EVERYTHING_TIERS[nowEvery - 1] }),
      repDelta: 0, tier: 'milestone', monsterId: monster.id });
  }

  state.serveCooldown = effectiveServeCooldown(state);          // start the counter cooldown
  state.queue.shift();                                          // front leaves; line shifts forward
  state.uiDirty = true;
  return true;
}

export function dismissCurrent(state) {
  const c = state.queue[0];
  if (!c) return false;
  const name = MONSTERS[c.monsterId]?.displayName ?? 'Someone';
  // Pass the wanted item too — two dismiss templates use {item} ("...off with no {item}..."), and
  // without it logLine's 'something' fallback produced "no something". wantedItemId is always a
  // valid item id (spawn guarantees it since the audit fix), so displayName always resolves.
  const item = ITEMS[c.wantedItemId]?.displayName;
  pushLog(state, { ...logLine(c.monsterId, 'dismiss', { name, item, itemId: c.wantedItemId,
    serves: state.stats.monsterServes[c.monsterId] ?? 0,
    gregHired: state.workers?.restocker?.owned === true }),   // Greg's shoo lines exist once he does
    repDelta: 0, tier: 'dismiss', monsterId: c.monsterId });
  state.queue.shift();
  state.uiDirty = true;
  return true;
}

// --- Restocking (cap is base maxStock + summed maxStock upgrades) --------------

// Effective stock cap for an item = its base cap plus any maxStock upgrade effects.
export function effectiveMaxStock(state, itemId) {
  const base = ITEMS[itemId]?.maxStock ?? Infinity;
  return base + sumEffect(state, 'maxStock');
}

// --- Supplier licenses (Pass 3). A tier-2 item exists on the shelf but is INERT until its
// one-time gold license is bought: customers never want it, it can't be restocked, and the
// offline sim skips it. License-free items are always unlocked. -------------------------------
export function isItemUnlocked(state, itemId) {
  const item = ITEMS[itemId];
  if (!item) return false;
  if (!item.license) return true;                     // base items need no license
  return state?.licenses?.[itemId] === true;
}

export function canBuyLicense(state, itemId) {
  const lic = ITEMS[itemId]?.license;
  if (!lic || isItemUnlocked(state, itemId)) return false;
  if (reputationTier(fameOf(state)).index < (lic.requiredTier ?? 0)) return false;
  return state.gold >= lic.cost;
}

// License alerts (UX roadmap 3): every license the shop's FAME already qualifies for but hasn't
// bought. Deliberately ignores gold — the alert trigger is eligibility, never affordability
// (canBuyLicense above is the purchase gate; this is the nag gate). Registry-scanned, so new
// licensed rows join the reminder pool with zero wiring.
export function eligibleUnboughtLicenses(state) {
  const tierIdx = reputationTier(fameOf(state)).index;
  return ITEM_ORDER.filter((id) => {
    const req = ITEMS[id].license?.requiredTier;
    return req !== undefined && state.licenses?.[id] !== true && req <= tierIdx;
  });
}

export function buyLicense(state, itemId) {
  if (!canBuyLicense(state, itemId)) return false;
  state.licenses[itemId] = true;
  state.gold -= ITEMS[itemId].license.cost;           // one-time gold sink
  state.uiDirty = true;
  return true;
}

// Haggler's Charm perk: gold off every restock, floored at 1 so an item can never restock free
// (the offline reserve margin math and the "always profitable" invariant both rely on cost >= 1).
export function effectiveRestockCost(state, itemId) {
  const base = ITEMS[itemId]?.restockCost ?? 0;
  return Math.max(1, base - sumPerkEffect(state, 'restockDiscount'));
}

export function canRestock(state, itemId) {
  const item = ITEMS[itemId];
  const slot = state.items[itemId];
  if (!item || !slot) return false;
  if (!isItemUnlocked(state, itemId)) return false;   // licensed goods only (Pass 3)
  return slot.stock < effectiveMaxStock(state, itemId) && state.gold >= effectiveRestockCost(state, itemId);
}

export function restockItem(state, itemId) {
  if (!canRestock(state, itemId)) return false;
  state.gold -= effectiveRestockCost(state, itemId);
  state.items[itemId].stock += 1;
  state.uiDirty = true;
  return true;
}

// --- Restock All (Pass 3.5). The quote is the FULL fill (every unlocked item to cap at effective
// cost); the action fills as much as gold allows, ROUND-ROBIN one unit per item per pass — the
// same fairness loop the offline sim uses — so a short purse spreads evenly across the shelf
// instead of topping up the first card and starving the last. ----------------------------------
// The Restocker's brain (mini round C1): pick ONE item to trickle a unit into. Priority: the front
// customer's wanted item if it's OUT (unblocks the actual queue), else the most-starved unlocked
// item (lowest stock-to-cap ratio; registry order breaks ties). Affordability is part of the pick —
// canRestock covers gold + cap — so a broke shop returns null and the worker idles, never overdrafts.
// Pure and exported: the suite pins the priority contract here, not in the tick loop.
export function trickleTarget(state) {
  const front = state.queue[0]?.wantedItemId;
  if (front && isItemUnlocked(state, front)
      && state.items[front].stock === 0 && canRestock(state, front)) return front;

  let best = null, bestRatio = 1;                    // ratio 1 = full; only below-cap items beat it
  for (const id of ITEM_ORDER) {
    if (!isItemUnlocked(state, id) || !canRestock(state, id)) continue;
    const ratio = state.items[id].stock / Math.max(1, effectiveMaxStock(state, id));
    if (ratio < bestRatio) { bestRatio = ratio; best = id; }
  }
  return best;
}

export function restockAllCost(state) {
  let total = 0;
  for (const id of ITEM_ORDER) {
    if (!isItemUnlocked(state, id)) continue;
    const need = Math.max(0, effectiveMaxStock(state, id) - (state.items[id]?.stock ?? 0));
    total += need * effectiveRestockCost(state, id);
  }
  return total;
}

export function canRestockAll(state) {
  // True when at least ONE unit somewhere is both needed and affordable.
  return ITEM_ORDER.some((id) => canRestock(state, id));
}

export function restockAll(state) {
  let bought = 0, boughtThisPass = true;
  while (boughtThisPass) {
    boughtThisPass = false;
    for (const id of ITEM_ORDER) {
      if (canRestock(state, id)) {                 // license, cap, and per-unit gold all checked
        state.gold -= effectiveRestockCost(state, id);
        state.items[id].stock += 1;
        bought += 1;
        boughtThisPass = true;
      }
    }
  }
  if (bought > 0) state.uiDirty = true;
  return bought;
}

// --- Upgrades ----------------------------------------------------------------

// Fame (dual-track): tiers are driven by LIFETIME rep — the never-decreasing track — so spending
// the current balance on perks can never revoke a gate the player already earned.
export const fameOf = (state) => state.lifetimeRep ?? state.reputation;

export function isUpgradeUnlocked(state, id) {
  const u = UPGRADES[id];
  if (!u) return false;
  return reputationTier(fameOf(state)).index >= (u.requiredTier ?? 0);
}

export function canBuyUpgrade(state, id) {
  if (!UPGRADES[id] || isMaxed(state, id)) return false;
  if (!isUpgradeUnlocked(state, id)) return false;             // gated behind a reputation tier
  return state.gold >= upgradeCost(id, upgradeLevel(state, id));
}

// --- Fame perks (rep-costed; see perks.js). Spending draws down state.reputation ONLY — the
// lifetime track is untouched, so tiers survive any spending spree. -----------------------------
export function isPerkUnlocked(state, id) {
  const p = PERKS[id];
  if (!p) return false;
  return reputationTier(fameOf(state)).index >= (p.requiredTier ?? 0);
}

export function canBuyPerk(state, id) {
  if (!PERKS[id] || isPerkMaxed(state, id)) return false;
  if (!isPerkUnlocked(state, id)) return false;
  return state.reputation >= perkCost(id, perkLevel(state, id));
}

export function buyPerk(state, id) {
  if (!canBuyPerk(state, id)) return false;
  state.reputation -= perkCost(id, perkLevel(state, id));   // spend the balance; lifetime unmoved
  state.perks[id] = perkLevel(state, id) + 1;
  state.uiDirty = true;
  return true;
}

export function buyUpgrade(state, id) {
  if (!canBuyUpgrade(state, id)) return false;
  state.gold -= upgradeCost(id, upgradeLevel(state, id));       // pay the current-level cost
  state.upgrades[id] = upgradeLevel(state, id) + 1;
  state.uiDirty = true;
  return true;
}

// --- Workers (auto-serve) ----------------------------------------------------

// Bob's auto-serve interval, shortened by Faster Counter via the SAME serveSpeed effect that shortens
// the counter cooldown — so counter upgrades speed automation too. Asymptotic; never reaches zero.
export function effectiveWorkerInterval(state, id) {
  const base = WORKERS[id]?.baseInterval ?? Infinity;
  // serveSpeed upgrades (Faster Counter) speed the COUNTER — they apply to the serve role only.
  // Without this scope, buying counter upgrades would silently speed the restock trickle too.
  // The restock role has its own dial: Swift Wings' trickleSpeed, same divisor form as serveSpeed
  // (0.25/level -> interval x0.8/x0.667 — the honest player-facing number is -20%/-33%).
  if (WORKERS[id]?.role !== 'serve') return base / (1 + sumPerkEffect(state, 'trickleSpeed'));
  return base / (1 + sumEffect(state, 'serveSpeed'));
}

export function canHireWorker(state, id) {
  if (!WORKERS[id]) return false;
  if (isWorkerOwned(state, id)) return false;                  // already hired — no repeat purchase
  // Fame gate (Greg, 2026-07-04): same shape as licenses — LIFETIME tier, never the wallet.
  // ?? 0 keeps ungated workers (Bob) hireable from day one.
  if (reputationTier(fameOf(state)).index < (WORKERS[id].requiredTier ?? 0)) return false;
  return state.gold >= workerHireCost(id);
}

export function hireWorker(state, id) {
  if (!canHireWorker(state, id)) return false;
  state.gold -= workerHireCost(id);                            // pay the one-time hire cost
  state.workers[id].owned = true;
  state.workers[id].timer = effectiveWorkerInterval(state, id); // wait one interval before the first serve
  // Hire flavor (Greg's voice pass, 2026-07-05): a worker with authored WORKER_HIRE_LINES gets a
  // GOLD log line (tier 'milestone' — a 600-gold beat deserves the treatment), and Greg's intro
  // quip rides his own bubble for one normal showFor window (panels.js shows quip over report).
  // Registry-driven: a future worker with an entry here gets the same beat with zero new wiring.
  const flavor = WORKER_HIRE_LINES[id];
  if (flavor?.log?.length) pushLog(state, { text: pick(flavor.log), repDelta: 0, tier: 'milestone' });
  if (id === 'restocker' && flavor?.bubble?.length) {
    state.gregBubble = { cycleIn: CONFIG.gregBubble?.cycleSec ?? 45,
                         showFor: CONFIG.gregBubble?.showSec ?? 10,
                         quip: pick(flavor.bubble) };
  }
  state.uiDirty = true;
  return true;
}

// Tick every owned serve-worker. On timer expiry, attempt ONE sale through the exact manual path
// (serveCurrent) so payout/rep/log/cooldown all match. A success waits a full interval before the
// next; a blocked attempt (no customer / cooling down / out of stock / can't afford) leaves the timer
// ready so the worker fires as soon as conditions allow — without ever re-running the sale itself.
function updateWorkers(state, dt) {
  for (const id of WORKER_ORDER) {
    const w = state.workers[id];
    if (!w.owned) continue;
    const role = WORKERS[id].role;

    if (role === 'serve') {
      w.timer -= dt;
      if (w.timer > 0) continue;
      // Greet gate (feel fix): the front customer must have been VISIBLE at the counter for greetSec
      // before a worker may serve them — at max Faster Counter, serves had become invisible teleports
      // straight to the battle log. Worker stays ready and fires the moment the greet elapses.
      // Manual serving is deliberately NOT gated (clicking = looking; active play stays faster).
      if ((state.queue[0]?.frontWait ?? 0) < (CONFIG.workers?.greetSec ?? 0)) { w.timer = 0; continue; }
      if (serveCurrent(state)) {                                 // sold one -> pace the next by the interval
        w.timer = effectiveWorkerInterval(state, id);
        state.workerServed = true;                               // signal main.js to play Bob's serve anim
      } else {
        w.timer = 0;                                             // blocked -> stay ready, retry next frame
      }
      continue;
    }

    if (role === 'restock') {
      w.timer -= dt;
      if (w.timer > 0) continue;
      // The trickle: units per run = 1 + Bulk Satchel (trickleUnits). Each unit RE-TARGETS and
      // pays through restockItem individually — so the second unit follows the priority rules
      // afresh (it may top a different item), respects caps, and a purse that covers one unit
      // buys exactly one (no free stock, no overdraft — the economy invariants hold per unit).
      const units = 1 + sumPerkEffect(state, 'trickleUnits');
      let landed = 0;
      for (let u = 0; u < units; u++) {
        const target = trickleTarget(state);
        if (!target || !restockItem(state, target)) break;
        landed++;
      }
      if (landed > 0) {
        w.timer = effectiveWorkerInterval(state, id);            // Swift Wings shortens this dial
        state.gregRestocked = true;                              // render signal, consumed by main.js
                                                                 // -> ONE errand per run, however
                                                                 // many units the satchel carried
      } else {
        w.timer = 1;                                             // blocked (all full / broke) -> 1s recheck
      }
    }
  }
}

// True if any hired worker can serve (currently just Bob). Gates the broke auto-wave below, so it only
// runs once the shop is automated — manual play still manages unaffordable customers by hand.
function anyServeWorkerOwned(state) {
  for (const id of WORKER_ORDER) {
    if (WORKERS[id].role === 'serve' && isWorkerOwned(state, id)) return true;
  }
  return false;
}

// With a serve-worker on staff, auto-wave a front customer who can't afford their item — the one
// blocker the player can't clear by restocking. Reuses the rep-neutral dismiss (+ its "shooed" log
// line) after CONFIG.queue.brokeGraceSec, so the line keeps flowing and affordable customers behind
// them don't time out (−rep). Keys off the SAME reason the Serve button shows, so it fires on exactly
// the "Can't afford it" state — never on out-of-stock (restock fixes that) or during a cooldown.
function autoWaveBroke(state, dt) {
  const c = state.queue[0];
  if (!c) return;
  if (serveBlockReason(state) !== 'cant-afford') return;
  c.brokeWait = (c.brokeWait ?? 0) + dt;
  if (c.brokeWait >= CONFIG.queue.brokeGraceSec) dismissCurrent(state);
}

// --- Per-frame update --------------------------------------------------------

export function update(state, dt) {
  if (state.screen !== 'shop') return;

  // Battle-report fallback: deliver any pending report whose celebrant never fired the door-entry
  // event (dropped by the celebrant cap, tab hidden, art edge case). HEAD-ONLY delivery keeps the
  // log FIFO — reports share one duration, so the head is always the most overdue.
  if (state.pendingReports?.length) {
    for (const r of state.pendingReports) r.fallback -= dt;
    while (state.pendingReports.length && state.pendingReports[0].fallback <= 0) {
      deliverBattleReport(state);
    }
  }

  if (state.serveCooldown > 0) {                    // count down the post-sale counter cooldown
    state.serveCooldown = Math.max(0, state.serveCooldown - dt);
    if (state.serveCooldown === 0) state.uiDirty = true;  // re-enable the Serve button
  }

  // Bob's bubble (license alerts): tick the current line, promote the next from the queue. All
  // transient (never serialized) — the milestone log line is the permanent record, so a reload
  // mid-announcement loses only the bubble. Ticks even while Bob is unhired (the bubble simply
  // doesn't SHOW without its anchor — panels.js gates on ownership); the reminder below re-raises
  // anything that expired unseen, so nothing is lost, and in practice licenses start at Trusted,
  // long after the 50-gold hire. Every transition marks uiDirty: the bubble is a DOM element
  // rendered by renderPanels (Daniel's clickable pick, 2026-07-04), so show/hide/text changes
  // ride the dirty-render path.
  const bs = state.bobSpeech;
  if (bs) {
    if (bs.current && (bs.current.remaining -= dt) <= 0) { bs.current = null; state.uiDirty = true; }
    if (!bs.current && bs.queue.length) {
      const next = bs.queue.shift();
      bs.current = { text: next.text, itemId: next.itemId,
                     remaining: CONFIG.licenseAlerts?.announceSec ?? 6 };
      state.uiDirty = true;
    }
  }
  // The gentle recurring reminder: a free-running countdown (transient — boot restarts it, which
  // is also how a tier crossed OFFLINE gets announced ~30s into the next session). On expiry, if
  // any eligible license sits unbought AND the bubble is idle (never talk over the crossing
  // announcements), nudge about the first one. Trigger is eligibility, never gold.
  state.licenseReminderIn = (state.licenseReminderIn ?? CONFIG.licenseAlerts?.reminderSec ?? 30) - dt;
  if (state.licenseReminderIn <= 0) {
    state.licenseReminderIn = CONFIG.licenseAlerts?.reminderSec ?? 30;
    const unbought = eligibleUnboughtLicenses(state);
    if (unbought.length && !(state.bobSpeech?.current) && !(state.bobSpeech?.queue?.length)) {
      const bs2 = (state.bobSpeech ??= { queue: [], current: null });
      bs2.current = { text: licenseBubbleLine('reminder', { item: ITEMS[unbought[0]].displayName }),
                      itemId: unbought[0],
                      remaining: CONFIG.licenseAlerts?.announceSec ?? 6 };
      state.uiDirty = true;
    }
  }

  // Greg's restock report (Option 1 duty cycle, Daniel 2026-07-05): "a way to restock, not the
  // main way" — while Greg is hired and something unlocked sits OUT, the bubble pops for showSec
  // once per cycleSec instead of standing permanently. Transient like the license reminder (boot
  // restarts the cycle). renderPanels shows it only while showFor > 0 and re-derives the TARGET
  // per render — a mid-show restock retargets to the next out item or hides it early.
  const gb = (state.gregBubble ??= { cycleIn: CONFIG.gregBubble?.cycleSec ?? 45, showFor: 0 });
  if (gb.showFor > 0 && (gb.showFor -= dt) <= 0) {
    gb.showFor = 0; gb.quip = null;                 // the hire quip is a one-window beat
    state.uiDirty = true;
  }
  gb.cycleIn -= dt;
  if (gb.cycleIn <= 0) {
    gb.cycleIn = CONFIG.gregBubble?.cycleSec ?? 45;
    const anyOut = state.workers?.restocker?.owned === true
      && ITEM_ORDER.some((id) => isItemUnlocked(state, id) && state.items[id].stock === 0);
    if (anyOut && gb.showFor <= 0) {
      gb.showFor = CONFIG.gregBubble?.showSec ?? 10;
      state.uiDirty = true;
    }
  }

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    if (state.queue.length < CONFIG.queue.maxLength + sumPerkEffect(state, 'queueLength')) {  // Velvet Rope
      state.queue.push(spawnCustomer(state));
      state.uiDirty = true;
    }
    // Spawn director: the NEXT interval depends on how the line looks now (post-spawn length),
    // clamped to the table's last entry. Empty -> hurry, deep -> relax; see CONFIG.queue.
    const table = CONFIG.queue.spawnIntervalByQueue ?? [2.6];
    state.spawnTimer = table[Math.min(state.queue.length, table.length - 1)];
  }

  if (state.queue.length) {
    for (const c of state.queue) c.patienceRemaining -= dt;
    const stillWaiting = [];
    for (const c of state.queue) {
      if (c.patienceRemaining > 0) { stillWaiting.push(c); continue; }
      const name = MONSTERS[c.monsterId]?.displayName ?? 'Someone';
      state.reputation = Math.max(0, state.reputation - CONFIG.reputation.leavePenalty);
      pushLog(state, { ...logLine(c.monsterId, 'leave', { name,
        serves: state.stats.monsterServes[c.monsterId] ?? 0,
        gregHired: state.workers?.restocker?.owned === true }),  // Greg's leave remarks, hire-gated
        repDelta: -CONFIG.reputation.leavePenalty, tier: 'leave', monsterId: c.monsterId });
    }
    if (stillWaiting.length !== state.queue.length) {
      state.queue = stillWaiting;
      state.uiDirty = true;
    }
  }

  // The settled front customer accrues counter time (drives the worker greet gate). Accrued AFTER
  // spawns/leavers so a mob promoted to the front this tick starts its greet from ~0.
  if (state.queue[0]) state.queue[0].frontWait = (state.queue[0].frontWait ?? 0) + dt;

  if (anyServeWorkerOwned(state)) autoWaveBroke(state, dt);  // clear broke blockers so the line keeps flowing
  updateWorkers(state, dt);   // auto-serve runs last, on the settled queue (spawns in, leavers out)
}

function pushLog(state, entry) {
  state.log.unshift(entry);
  if (state.log.length > CONFIG.log.maxEntries) state.log.length = CONFIG.log.maxEntries;
}

// Deliver the OLDEST pending battle report to the log. Called from two places: main.js's
// door-entry callback (the celebrant just walked through — the normal path) and the fallback tick
// in update(). FIFO by design and ID-LESS on purpose: celebrants and reports are both
// serve-ordered, so "oldest report on each entry event" stays correct even when the celebrant cap
// drops a ghost — the NEXT entry event delivers the dropped one's report, one slot late and
// visually indistinguishable. Returns true if a report was delivered (main.js doesn't need it —
// uiDirty is set here — but the suite asserts on it).
export function deliverBattleReport(state) {
  const r = state.pendingReports?.shift();
  if (!r) return false;
  pushLog(state, r.entry);
  state.uiDirty = true;
  return true;
}
