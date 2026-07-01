// test_m4.mjs — headless smoke test for the M4 auto-serve worker (Bob). Scratch/dev only, not shipped.
// Run: node test_m4.mjs   (exits non-zero on any failure)
import { createInitialState } from './src/state.js';
import { serializeSave, mergeSave } from './src/save.js';
import {
  update, serveCurrent, hireWorker, canHireWorker,
  effectiveWorkerInterval,
} from './src/game.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL:', msg); } };

// A servable customer: wants an in-stock, affordable item, effectively infinite patience for the test.
function customer(monsterId = 'skeleton', wantedItemId = 'club', budget = 99) {
  return { monsterId, wantedItemId, budget, patienceRemaining: 1e9, state: 'queued' };
}
// Park the world so update() doesn't spawn/timeout mid-assert: shop screen, no cooldown, far-off spawn.
function shopState() {
  const s = createInitialState();
  s.screen = 'shop';
  s.serveCooldown = 0;
  s.spawnTimer = 1e9;   // never spawn during the test
  return s;
}

console.log('M4 auto-serve worker — smoke test\n');

// 1. Fresh state shape ---------------------------------------------------------
{
  const s = createInitialState();
  ok(s.workers && s.workers.mimic_merchant, 'fresh state has workers.mimic_merchant');
  ok(s.workers.mimic_merchant.owned === false, 'Bob starts NOT owned');
  ok(s.workers.mimic_merchant.timer === 0, 'Bob timer starts at 0');
  ok(s.workerServed === false, 'workerServed flag starts false');
}

// 2. Save round-trip + backward compatibility ---------------------------------
{
  const s = createInitialState();
  s.workers.mimic_merchant.owned = true;
  const blob = JSON.parse(JSON.stringify(serializeSave(s)));      // simulate localStorage stringify
  ok(blob.workers && blob.workers.mimic_merchant.owned === true, 'serialize persists owned=true');
  ok(!('timer' in blob.workers.mimic_merchant), 'serialize does NOT persist the transient timer');

  const restored = mergeSave(createInitialState(), blob);
  ok(restored.workers.mimic_merchant.owned === true, 'load restores owned Bob');
  ok(restored.workers.mimic_merchant.timer > 0, 'resumed owned Bob gets a full interval (no instant fire)');

  // A pre-M4 save (no `workers` key) must load cleanly with Bob unowned.
  const legacy = { gold: 100, reputation: 5, items: {}, upgrades: {}, lastSeen: Date.now() };
  const fromLegacy = mergeSave(createInitialState(), legacy);
  ok(fromLegacy.workers.mimic_merchant.owned === false, 'pre-M4 save loads with Bob unowned (no crash)');
  ok(fromLegacy.gold === 100, 'pre-M4 save still restores gold');

  // Unknown worker id in a save is ignored, not injected.
  const weird = { workers: { ghost_worker: { owned: true } } };
  const fromWeird = mergeSave(createInitialState(), weird);
  ok(!('ghost_worker' in fromWeird.workers), 'unknown saved worker id is ignored');
}

// 3. Hire model (Option B) -----------------------------------------------------
{
  const s = shopState();
  s.gold = 40;                                    // below the 50 hire cost
  ok(canHireWorker(s, 'mimic_merchant') === false, 'cannot hire Bob with 40 gold (< 50)');
  ok(hireWorker(s, 'mimic_merchant') === false, 'hireWorker refuses when unaffordable');

  s.gold = 50;
  ok(canHireWorker(s, 'mimic_merchant') === true, 'can hire Bob at exactly 50 gold');
  ok(hireWorker(s, 'mimic_merchant') === true, 'hire succeeds');
  ok(s.gold === 0, 'hire deducts the 50 gold');
  ok(s.workers.mimic_merchant.owned === true, 'Bob now owned');
  ok(s.workers.mimic_merchant.timer > 0, 'hire starts the timer at a full interval');
  ok(canHireWorker(s, 'mimic_merchant') === false, 'cannot re-hire an owned Bob');
}

// 4. Auto-serve fires on interval, through the real serve path -----------------
{
  const s = shopState();
  s.gold = 50; hireWorker(s, 'mimic_merchant');
  s.gold = 0;                                     // isolate: only a sale can add gold
  s.queue = [customer('skeleton', 'club', 99)];   // club in stock (start 3), price 12, budget 99
  const stock0 = s.items.club.stock;

  // Not enough elapsed yet -> no serve.
  update(s, 1.0);
  ok(s.queue.length === 1, 'no auto-serve before the interval elapses');
  ok(s.gold === 0, 'gold unchanged before the interval elapses');

  // Push past the ~6s interval -> exactly one sale.
  update(s, 6.0);
  ok(s.queue.length === 0, 'auto-serve consumed the front customer');
  ok(s.items.club.stock === stock0 - 1, 'auto-serve decremented stock by 1');
  ok(s.gold === 12, 'auto-serve took payment (club basePrice 12)');
  ok(s.reputation >= 2, 'auto-serve granted reputation (perSale)');
  ok(s.log.length === 1 && typeof s.log[0].text === 'string', 'auto-serve wrote one battle-log line');
  ok(s.workerServed === true, 'workerServed flag set for main.js to play the serve anim');
  ok(s.serveCooldown > 0, 'auto-serve started the shared serve cooldown');
}

// 5. Auto-serve respects the serve cooldown (no double-fire, no spam) ----------
{
  const s = shopState();
  s.gold = 50; hireWorker(s, 'mimic_merchant');
  s.queue = [customer(), customer()];             // two servable customers back to back
  update(s, 6.0);                                 // first sale; cooldown now active, timer reset to ~6s
  const goldAfterFirst = s.gold;
  const cd = s.serveCooldown;
  ok(cd > 0, 'cooldown active after first auto-serve');

  update(s, cd / 2);                              // still cooling down AND timer not elapsed
  ok(s.gold === goldAfterFirst, 'no second sale while cooling down / mid-interval');
  ok(s.queue.length === 1, 'second customer still waiting during cooldown');

  // Even if the interval is forced ready during cooldown, serveCurrent must block on the cooldown.
  s.workers.mimic_merchant.timer = 0;
  s.serveCooldown = 0.4;
  update(s, 0.05);                                // timer ready, but cooldown > 0
  ok(s.gold === goldAfterFirst, 'ready worker still blocked by an active cooldown');
}

// 6. Faster Counter shortens the auto-serve interval (shared serveSpeed) -------
{
  const s = shopState();
  const base = effectiveWorkerInterval(s, 'mimic_merchant');
  s.upgrades.faster_counter = 1;                  // one level of Faster Counter (serveSpeed +0.3)
  const lvl1 = effectiveWorkerInterval(s, 'mimic_merchant');
  s.upgrades.faster_counter = 5;
  const lvl5 = effectiveWorkerInterval(s, 'mimic_merchant');
  ok(Math.abs(base - 6) < 1e-9, 'base worker interval is 6s');
  ok(lvl1 < base, 'Faster Counter L1 shortens Bob\'s interval');
  ok(lvl5 < lvl1 && lvl5 > 0, 'Faster Counter L5 shortens it further, never to zero');
}

// 7. Out of stock does not break automation -----------------------------------
{
  const s = shopState();
  s.gold = 50; hireWorker(s, 'mimic_merchant');
  s.gold = 0;
  s.items.club.stock = 0;                         // nothing to sell
  s.queue = [customer('skeleton', 'club', 99)];
  update(s, 6.0);
  ok(s.queue.length === 1, 'out-of-stock: customer not served, no crash');
  ok(s.gold === 0, 'out-of-stock: no gold gained');
  ok(s.workers.mimic_merchant.timer === 0, 'out-of-stock: worker stays ready (retries)');

  s.items.club.stock = 3;                         // restock; next tick should now sell
  update(s, 0.1);
  ok(s.queue.length === 0, 'after restock the ready worker serves immediately');
  ok(s.gold === 12, 'after restock the sale goes through');
}

// 8. Unaffordable customer -> the SERVE tick makes no sale (the auto-wave is covered in 10) --------
{
  const s = shopState();
  s.gold = 50; hireWorker(s, 'mimic_merchant');
  s.gold = 0;
  s.queue = [customer('skeleton', 'club', 5)];    // budget 5 < club price 12
  const stock0 = s.items.club.stock;
  update(s, 1.0);                                  // under both the 6s serve interval and the 2s wave grace
  ok(s.queue.length === 1, 'unaffordable: still at front (no sale, not yet waved), no crash');
  ok(s.gold === 0, 'unaffordable: no gold gained (serve tick made no sale)');
  ok(s.items.club.stock === stock0, 'unaffordable: stock unchanged');
}

// 9. Manual serve still works (unchanged path) --------------------------------
{
  const s = shopState();                          // Bob NOT hired
  s.queue = [customer('skeleton', 'club', 99)];
  const stock0 = s.items.club.stock;
  const served = serveCurrent(s);
  ok(served === true, 'manual serveCurrent returns true on a valid sale');
  ok(s.items.club.stock === stock0 - 1, 'manual serve decremented stock');
  ok(s.gold === 40 + 12, 'manual serve took payment on top of starting gold');
  ok(s.workerServed === false, 'manual serve does NOT set the worker anim flag (handled directly by main.js)');
}

// 10. Broke auto-wave — worker-gated, after the grace, rep-neutral, line keeps flowing ------------
{
  // No worker hired -> a broke front customer is NOT auto-waved (manual play is unchanged).
  const s = shopState();
  s.queue = [customer('skeleton', 'club', 5)];    // budget 5 < club price 12 -> broke
  const rep0 = s.reputation;
  update(s, 5.0);                                  // well past the 2s grace
  ok(s.queue.length === 1, 'no worker: broke front is NOT auto-waved');
  ok(s.reputation === rep0, 'no worker: reputation unchanged (no auto-wave path ran)');
}
{
  // Worker hired -> broke front is waved after the grace; the affordable customer behind is served.
  const s = shopState();
  s.gold = 50; hireWorker(s, 'mimic_merchant');
  s.gold = 0;
  s.queue = [customer('skeleton', 'club', 5), customer('skeleton', 'club', 99)]; // broke, then affordable
  const rep0 = s.reputation;

  update(s, 1.0);                                  // under the 2s grace
  ok(s.queue.length === 2, 'worker: broke front NOT waved before the grace elapses');

  update(s, 1.5);                                  // 2.5s total -> past grace -> wave
  ok(s.queue[0] && s.queue[0].budget === 99, 'worker: broke front auto-waved; affordable customer now at front');
  ok(s.reputation === rep0, 'auto-wave is rep-neutral (no penalty)');
  ok(s.log.some((e) => e.tier === 'dismiss'), 'auto-wave wrote a rep-neutral dismiss log line');

  update(s, 6.0);                                  // worker serves the revealed affordable customer
  ok(s.queue.length === 0, 'worker serves the affordable customer that was stuck behind the broke one');
  ok(s.gold === 12, 'that sale went through (club 12)');
}
{
  // Out-of-stock front is NOT auto-waved even with a worker — that pressure is intended (restock fixes).
  const s = shopState();
  s.gold = 50; hireWorker(s, 'mimic_merchant'); s.gold = 0;
  s.items.club.stock = 0;
  s.queue = [customer('skeleton', 'club', 99)];   // affordable, but out of stock
  update(s, 5.0);
  ok(s.queue.length === 1, 'out-of-stock front is NOT auto-waved (restock is the intended fix)');
}

// 11. REGRESSION (audit): reload must NOT eat stock bought above the BASE cap via Extra Shelf -----
{
  const s = createInitialState();
  s.upgrades.extra_shelf = 2;                      // effective cap = 5 + 2 = 7
  s.items.club.stock = 7;                          // restocked to the effective cap
  const blob = JSON.parse(JSON.stringify(serializeSave(s)));
  const restored = mergeSave(createInitialState(), blob);
  ok(restored.items.club.stock === 7, 'reload preserves stock above the BASE cap (Extra Shelf L2, stock 7)');
  ok(restored.upgrades.extra_shelf === 2, 'Extra Shelf level restored alongside');

  // Absurd saved stock is still clamped — to the EFFECTIVE cap, not the base one.
  const cheat = { upgrades: { extra_shelf: 2 }, items: { club: { stock: 999 } } };
  const clamped = mergeSave(createInitialState(), cheat);
  ok(clamped.items.club.stock === 7, 'absurd saved stock clamps to the effective cap (7), not base (5)');
}

// 12. REGRESSION (audit): spawn fallback for a broken wantWeights must be a real ITEM id ----------
{
  const { spawnCustomer } = await import('./src/game.js');
  const { MONSTERS } = await import('./src/data/monsters.js');
  const { ITEMS } = await import('./src/data/items.js');
  const saved = MONSTERS.slime.wantWeights;
  MONSTERS.slime.wantWeights = [];                 // simulate a registry entry with empty weights
  let sawSlime = false, allItemsValid = true;
  for (let i = 0; i < 60; i++) {                   // spawnCustomer picks a random monster; sample it
    const c = spawnCustomer();
    if (c.monsterId === 'slime') {
      sawSlime = true;
      if (!ITEMS[c.wantedItemId]) allItemsValid = false;
    }
  }
  MONSTERS.slime.wantWeights = saved;              // restore the registry for any later cases
  ok(sawSlime, 'sample produced at least one slime (probabilistic; 60 draws)');
  ok(allItemsValid, 'empty wantWeights falls back to a REAL item id (never an unservable want)');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
