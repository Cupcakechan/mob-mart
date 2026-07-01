// game.js — core loop logic. Operates on the state object; no DOM/canvas here (so it's testable).
import { CONFIG } from './config.js';
import { MONSTERS, MONSTER_IDS } from './data/monsters.js';
import { ITEMS, ITEM_ORDER } from './data/items.js';
import { UPGRADES, upgradeLevel, upgradeCost, isMaxed, sumEffect } from './data/upgrades.js';
import { WORKERS, WORKER_ORDER, isWorkerOwned, workerHireCost } from './data/workers.js';
import { randInt, pick, weightedPick } from './utils.js';
import { resolveCombat } from './combat.js';
import { reputationTier } from './reputation.js';
import { logLine } from './messages.js';

// --- Customer spawning -------------------------------------------------------

export function spawnCustomer() {
  const monster = MONSTERS[pick(MONSTER_IDS)];
  // Fallback must be an ITEM id (guards a monster shipped with missing/empty wantWeights). A monster
  // id here made the customer want a nonexistent item -> a permanent 'no-item' front blocker.
  const wantedItemId = weightedPick(monster.wantWeights) ?? ITEM_ORDER[0];
  const [minB, maxB] = monster.budgetRange ?? [10, 20];
  return {
    monsterId: monster.id,
    wantedItemId,
    budget: randInt(minB, maxB),
    patienceRemaining: CONFIG.queue.defaultPatienceSec,
    brokeWait: 0,               // seconds spent unaffordable at the front; drives the worker auto-wave
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

  const repGain = effectiveRepPerSale(state);                   // Better Signage may boost this
  state.items[c.wantedItemId].stock -= 1;                       // hand over the item
  state.gold += item.basePrice;                                 // take payment (gold in)
  state.reputation += repGain;                                  // a good sale earns reputation

  const { tier } = resolveCombat(monster, item);               // off-screen fight -> outcome tier
  const text = logLine(monster.id, tier, { name: monster.displayName, item: item.displayName });
  pushLog(state, { text, repDelta: repGain, tier, monsterId: monster.id });

  state.serveCooldown = effectiveServeCooldown(state);          // start the counter cooldown
  state.queue.shift();                                          // front leaves; line shifts forward
  state.uiDirty = true;
  return true;
}

export function dismissCurrent(state) {
  const c = state.queue[0];
  if (!c) return false;
  const name = MONSTERS[c.monsterId]?.displayName ?? 'Someone';
  pushLog(state, { text: logLine(c.monsterId, 'dismiss', { name }), repDelta: 0, tier: 'dismiss', monsterId: c.monsterId });
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

export function canRestock(state, itemId) {
  const item = ITEMS[itemId];
  const slot = state.items[itemId];
  if (!item || !slot) return false;
  return slot.stock < effectiveMaxStock(state, itemId) && state.gold >= item.restockCost;
}

export function restockItem(state, itemId) {
  if (!canRestock(state, itemId)) return false;
  state.gold -= ITEMS[itemId].restockCost;
  state.items[itemId].stock += 1;
  state.uiDirty = true;
  return true;
}

// --- Upgrades ----------------------------------------------------------------

// An upgrade unlocks once the player's reputation reaches its required tier (index into
// CONFIG.reputation.tiers). Derived from live reputation — nothing to persist.
export function isUpgradeUnlocked(state, id) {
  const u = UPGRADES[id];
  if (!u) return false;
  return reputationTier(state.reputation).index >= (u.requiredTier ?? 0);
}

export function canBuyUpgrade(state, id) {
  if (!UPGRADES[id] || isMaxed(state, id)) return false;
  if (!isUpgradeUnlocked(state, id)) return false;             // gated behind a reputation tier
  return state.gold >= upgradeCost(id, upgradeLevel(state, id));
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
  return base / (1 + sumEffect(state, 'serveSpeed'));
}

export function canHireWorker(state, id) {
  if (!WORKERS[id]) return false;
  if (isWorkerOwned(state, id)) return false;                  // already hired — no repeat purchase
  return state.gold >= workerHireCost(id);
}

export function hireWorker(state, id) {
  if (!canHireWorker(state, id)) return false;
  state.gold -= workerHireCost(id);                            // pay the one-time hire cost
  state.workers[id].owned = true;
  state.workers[id].timer = effectiveWorkerInterval(state, id); // wait one interval before the first serve
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
    if (!w.owned || WORKERS[id].role !== 'serve') continue;    // future restock role is skipped here
    w.timer -= dt;
    if (w.timer > 0) continue;
    if (serveCurrent(state)) {                                 // sold one -> pace the next by the interval
      w.timer = effectiveWorkerInterval(state, id);
      state.workerServed = true;                               // signal main.js to play Bob's serve anim
    } else {
      w.timer = 0;                                             // blocked -> stay ready, retry next frame
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

  if (state.serveCooldown > 0) {                    // count down the post-sale counter cooldown
    state.serveCooldown = Math.max(0, state.serveCooldown - dt);
    if (state.serveCooldown === 0) state.uiDirty = true;  // re-enable the Serve button
  }

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    if (state.queue.length < CONFIG.queue.maxLength) {
      state.queue.push(spawnCustomer());
      state.uiDirty = true;
    }
    state.spawnTimer = CONFIG.queue.spawnIntervalSec;
  }

  if (state.queue.length) {
    for (const c of state.queue) c.patienceRemaining -= dt;
    const stillWaiting = [];
    for (const c of state.queue) {
      if (c.patienceRemaining > 0) { stillWaiting.push(c); continue; }
      const name = MONSTERS[c.monsterId]?.displayName ?? 'Someone';
      state.reputation = Math.max(0, state.reputation - CONFIG.reputation.leavePenalty);
      pushLog(state, { text: logLine(c.monsterId, 'leave', { name }), repDelta: -CONFIG.reputation.leavePenalty, tier: 'leave', monsterId: c.monsterId });
    }
    if (stillWaiting.length !== state.queue.length) {
      state.queue = stillWaiting;
      state.uiDirty = true;
    }
  }

  if (anyServeWorkerOwned(state)) autoWaveBroke(state, dt);  // clear broke blockers so the line keeps flowing
  updateWorkers(state, dt);   // auto-serve runs last, on the settled queue (spawns in, leavers out)
}

function pushLog(state, entry) {
  state.log.unshift(entry);
  if (state.log.length > CONFIG.log.maxEntries) state.log.length = CONFIG.log.maxEntries;
}
