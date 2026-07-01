// game.js — core loop logic. Operates on the state object; no DOM/canvas here (so it's testable).
import { CONFIG } from './config.js';
import { MONSTERS, MONSTER_IDS } from './data/monsters.js';
import { ITEMS } from './data/items.js';
import { randInt, pick, weightedPick } from './utils.js';
import { resolveCombat } from './combat.js';

// --- Customer spawning -------------------------------------------------------

// Roll a fresh customer instance from a random monster type.
export function spawnCustomer() {
  const monster = MONSTERS[pick(MONSTER_IDS)];
  const wantedItemId = weightedPick(monster.wantWeights) ?? MONSTER_IDS[0];
  const [minB, maxB] = monster.budgetRange ?? [10, 20];
  return {
    monsterId: monster.id,
    wantedItemId,
    budget: randInt(minB, maxB),
    patienceRemaining: CONFIG.queue.defaultPatienceSec,
    state: 'atCounter',
  };
}

// --- Serving -----------------------------------------------------------------

// Why serving is blocked, or null if servable. Used to guard the action AND label the button.
export function serveBlockReason(state) {
  const c = state.currentCustomer;
  if (!c) return 'no-customer';
  const item = ITEMS[c.wantedItemId];
  if (!item) return 'no-item';                                  // unknown item id
  if ((state.items[c.wantedItemId]?.stock ?? 0) <= 0) return 'out-of-stock';
  if (c.budget < item.basePrice) return 'cant-afford';
  return null;
}

// Serve the current customer: take payment, resolve combat off-screen, log it, clear the counter.
export function serveCurrent(state) {
  if (serveBlockReason(state) !== null) return false;
  const c = state.currentCustomer;
  const monster = MONSTERS[c.monsterId];
  const item = ITEMS[c.wantedItemId];

  state.items[c.wantedItemId].stock -= 1;                       // hand over the item
  state.gold += item.basePrice;                                 // take payment (gold in)

  const result = resolveCombat(monster, item);                 // the fight happens off-screen
  state.reputation = Math.max(0, state.reputation + result.repDelta);
  pushLog(state, { text: result.message, repDelta: result.repDelta, tier: result.tier, monsterId: monster.id });

  state.currentCustomer = null;                                 // they leave to battle
  state.nextCustomerTimer = CONFIG.queue.nextCustomerDelaySec;
  state.uiDirty = true;
  return true;
}

// Wave off the current customer with no sale — the escape hatch when you can't/won't serve them
// (e.g. they can't afford what they want). No rep penalty in M1; revisit when rep goes live in M2.
export function dismissCurrent(state) {
  const c = state.currentCustomer;
  if (!c) return false;
  const name = MONSTERS[c.monsterId]?.displayName ?? 'Someone';
  pushLog(state, { text: `${name} left without buying.`, repDelta: 0, tier: 'dismiss', monsterId: c.monsterId });
  state.currentCustomer = null;
  state.nextCustomerTimer = CONFIG.queue.nextCustomerDelaySec;
  state.uiDirty = true;
  return true;
}

// --- Restocking --------------------------------------------------------------

export function canRestock(state, itemId) {
  const item = ITEMS[itemId];
  const slot = state.items[itemId];
  if (!item || !slot) return false;
  return slot.stock < (item.maxStock ?? Infinity) && state.gold >= item.restockCost;
}

export function restockItem(state, itemId) {
  if (!canRestock(state, itemId)) return false;
  state.gold -= ITEMS[itemId].restockCost;
  state.items[itemId].stock += 1;
  state.uiDirty = true;
  return true;
}

// --- Per-frame update --------------------------------------------------------

// Advance timers. Called every frame with delta seconds. M1: one customer at a time.
export function update(state, dt) {
  if (state.screen !== 'shop') return;

  const c = state.currentCustomer;
  if (!c) {
    state.nextCustomerTimer -= dt;
    if (state.nextCustomerTimer <= 0) {
      state.currentCustomer = spawnCustomer();
      state.uiDirty = true;
    }
    return;
  }

  // Lenient patience is a safety net so the loop can't soft-lock; the player can also Send Away.
  c.patienceRemaining -= dt;
  if (c.patienceRemaining <= 0) {
    const name = MONSTERS[c.monsterId]?.displayName ?? 'Someone';
    state.reputation = Math.max(0, state.reputation - CONFIG.queue.leaveRepPenalty);
    pushLog(state, { text: `${name} got tired of waiting and left.`, repDelta: -CONFIG.queue.leaveRepPenalty, tier: 'leave', monsterId: c.monsterId });
    state.currentCustomer = null;
    state.nextCustomerTimer = CONFIG.queue.nextCustomerDelaySec;
    state.uiDirty = true;
  }
}

function pushLog(state, entry) {
  state.log.unshift(entry);                                     // newest first
  if (state.log.length > CONFIG.log.maxEntries) state.log.length = CONFIG.log.maxEntries;
}
