// game.js — core loop logic. Operates on the state object; no DOM/canvas here (so it's testable).
import { CONFIG } from './config.js';
import { PERKS, PERK_ORDER, perkLevel, perkCost, isPerkMaxed, sumPerkEffect } from './data/perks.js';
import { itemGoldMult, monsterRepMult, globalGoldMult, everythingTier,
  ITEM_BREAKPOINTS, MONSTER_BREAKPOINTS, EVERYTHING_TIERS, milestoneLine } from './data/milestones.js';
import { MONSTERS, MONSTER_IDS } from './data/monsters.js';
import { ITEMS, ITEM_ORDER } from './data/items.js';
import { UPGRADES, upgradeLevel, upgradeCost, isMaxed, sumEffect } from './data/upgrades.js';
import { WORKERS, WORKER_ORDER, isWorkerOwned, workerHireCost } from './data/workers.js';
import { randInt, pick, weightedPick } from './utils.js';
import { resolveCombat } from './combat.js';
import { reputationTier } from './reputation.js';
import { logLine } from './messages.js';

// --- Customer spawning -------------------------------------------------------

export function spawnCustomer(state) {
  const monster = MONSTERS[pick(MONSTER_IDS)];
  // Fallback must be an ITEM id (guards a monster shipped with missing/empty wantWeights). A monster
  // id here made the customer want a nonexistent item -> a permanent 'no-item' front blocker.
  const wantedItemId = weightedPick(monster.wantWeights) ?? ITEM_ORDER[0];
  const [minB, maxB] = monster.budgetRange ?? [10, 20];
  return {
    monsterId: monster.id,
    wantedItemId,
    budget: randInt(minB, maxB),
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
  state.reputation += repGain;                                  // spendable balance...
  state.lifetimeRep = fameOf(state) + repGain;                  // ...and the tier track (never falls)

  const { tier } = resolveCombat(monster, item);               // off-screen fight -> outcome tier
  const text = logLine(monster.id, tier, { name: monster.displayName, item: item.displayName });
  pushLog(state, { text, repDelta: repGain, tier, monsterId: monster.id });

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
  }
  const nowEvery = everythingTier(state);
  if (nowEvery > prevEvery) {                                   // this sale's item was the laggard
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
  pushLog(state, { text: logLine(c.monsterId, 'dismiss', { name, item }), repDelta: 0, tier: 'dismiss', monsterId: c.monsterId });
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
  return slot.stock < effectiveMaxStock(state, itemId) && state.gold >= effectiveRestockCost(state, itemId);
}

export function restockItem(state, itemId) {
  if (!canRestock(state, itemId)) return false;
  state.gold -= effectiveRestockCost(state, itemId);
  state.items[itemId].stock += 1;
  state.uiDirty = true;
  return true;
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
    if (state.queue.length < CONFIG.queue.maxLength + sumPerkEffect(state, 'queueLength')) {  // Velvet Rope
      state.queue.push(spawnCustomer(state));
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
