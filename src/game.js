// game.js — core loop logic. Operates on the state object; no DOM/canvas here (so it's testable).
import { CONFIG } from './config.js';
import { MONSTERS, MONSTER_IDS } from './data/monsters.js';
import { ITEMS } from './data/items.js';
import { UPGRADES, upgradeLevel, upgradeCost, isMaxed, sumEffect } from './data/upgrades.js';
import { randInt, pick, weightedPick } from './utils.js';
import { resolveCombat } from './combat.js';
import { logLine } from './messages.js';

// --- Customer spawning -------------------------------------------------------

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

export function serveBlockReason(state) {
  const c = state.queue[0];
  if (!c) return 'no-customer';
  const item = ITEMS[c.wantedItemId];
  if (!item) return 'no-item';
  if ((state.items[c.wantedItemId]?.stock ?? 0) <= 0) return 'out-of-stock';
  if (c.budget < item.basePrice) return 'cant-afford';
  return null;
}

export function serveCurrent(state) {
  if (serveBlockReason(state) !== null) return false;
  const c = state.queue[0];
  const monster = MONSTERS[c.monsterId];
  const item = ITEMS[c.wantedItemId];

  state.items[c.wantedItemId].stock -= 1;                       // hand over the item
  state.gold += item.basePrice;                                 // take payment (gold in)
  state.reputation += CONFIG.reputation.perSale;                // a good sale earns reputation

  const { tier } = resolveCombat(monster, item);               // off-screen fight -> outcome tier
  const text = logLine(monster.id, tier, { name: monster.displayName, item: item.displayName });
  pushLog(state, { text, repDelta: CONFIG.reputation.perSale, tier, monsterId: monster.id });

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

export function canBuyUpgrade(state, id) {
  if (!UPGRADES[id] || isMaxed(state, id)) return false;
  return state.gold >= upgradeCost(id, upgradeLevel(state, id));
}

export function buyUpgrade(state, id) {
  if (!canBuyUpgrade(state, id)) return false;
  state.gold -= upgradeCost(id, upgradeLevel(state, id));       // pay the current-level cost
  state.upgrades[id] = upgradeLevel(state, id) + 1;
  state.uiDirty = true;
  return true;
}

// --- Per-frame update --------------------------------------------------------

export function update(state, dt) {
  if (state.screen !== 'shop') return;

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
}

function pushLog(state, entry) {
  state.log.unshift(entry);
  if (state.log.length > CONFIG.log.maxEntries) state.log.length = CONFIG.log.maxEntries;
}
