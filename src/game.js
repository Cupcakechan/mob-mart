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
    state: 'queued',
  };
}

// --- Serving (always acts on the FRONT of the line, queue[0]) -----------------

// Why serving the front is blocked, or null if servable. Guards the action AND labels the button.
export function serveBlockReason(state) {
  const c = state.queue[0];
  if (!c) return 'no-customer';
  const item = ITEMS[c.wantedItemId];
  if (!item) return 'no-item';                                  // unknown item id
  if ((state.items[c.wantedItemId]?.stock ?? 0) <= 0) return 'out-of-stock';
  if (c.budget < item.basePrice) return 'cant-afford';
  return null;
}

// Serve the front customer: take payment, grant service rep, resolve the (flavour-only) fight,
// log it, and drop them from the line so everyone behind shifts forward.
export function serveCurrent(state) {
  if (serveBlockReason(state) !== null) return false;
  const c = state.queue[0];
  const monster = MONSTERS[c.monsterId];
  const item = ITEMS[c.wantedItemId];

  state.items[c.wantedItemId].stock -= 1;                       // hand over the item
  state.gold += item.basePrice;                                 // take payment (gold in)
  state.reputation += CONFIG.reputation.perSale;                // a good sale earns reputation

  const result = resolveCombat(monster, item);                 // off-screen fight -> funny line only
  pushLog(state, { text: result.message, repDelta: CONFIG.reputation.perSale, tier: result.tier, monsterId: monster.id });

  state.queue.shift();                                          // front leaves; line shifts forward
  state.uiDirty = true;
  return true;
}

// Wave off the front customer with no sale — the escape hatch when you can't/won't serve them.
// No rep change; it's a neutral no-sale. The next mob steps up.
export function dismissCurrent(state) {
  const c = state.queue[0];
  if (!c) return false;
  const name = MONSTERS[c.monsterId]?.displayName ?? 'Someone';
  pushLog(state, { text: `${name} left without buying.`, repDelta: 0, tier: 'dismiss', monsterId: c.monsterId });
  state.queue.shift();
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

// Advance the line: back-fill on a cadence, and drain every waiting mob's patience.
export function update(state, dt) {
  if (state.screen !== 'shop') return;

  // Back-fill the line on a steady cadence, up to the cap.
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    if (state.queue.length < CONFIG.queue.maxLength) {
      state.queue.push(spawnCustomer());
      state.uiDirty = true;
    }
    state.spawnTimer = CONFIG.queue.spawnIntervalSec;
  }

  // Everyone in line loses patience independently; whoever runs out leaves (neglect -> -rep, at 0).
  if (state.queue.length) {
    for (const c of state.queue) c.patienceRemaining -= dt;
    const stillWaiting = [];
    for (const c of state.queue) {
      if (c.patienceRemaining > 0) { stillWaiting.push(c); continue; }
      const name = MONSTERS[c.monsterId]?.displayName ?? 'Someone';
      state.reputation = Math.max(0, state.reputation - CONFIG.reputation.leavePenalty);
      pushLog(state, { text: `${name} got tired of waiting and left.`, repDelta: -CONFIG.reputation.leavePenalty, tier: 'leave', monsterId: c.monsterId });
    }
    if (stillWaiting.length !== state.queue.length) {
      state.queue = stillWaiting;                              // drop the leavers; line closes the gap
      state.uiDirty = true;
    }
  }
}

function pushLog(state, entry) {
  state.log.unshift(entry);                                     // newest first
  if (state.log.length > CONFIG.log.maxEntries) state.log.length = CONFIG.log.maxEntries;
}
