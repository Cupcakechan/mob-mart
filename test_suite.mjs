// test_suite.mjs — the headless test suite (COMMITTED — the one test file that ships in the repo,
// via the !test_suite.mjs gitignore negation, so a fresh clone can verify itself; scratch probes
// stay test_*.mjs and stay ignored). Grown per pass since M4.
// Run: node test_suite.mjs   (exits non-zero on any failure)
import { createInitialState } from './src/state.js';
import { serializeSave, mergeSave } from './src/save.js';
import { ITEMS, ITEM_ORDER } from './src/data/items.js';   // live-derived trio fixture (below)
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
// Batch-1 fixture: EXACT-MATH tests pin the live shelf to the launch trio (the arithmetic is the
// assertion; the shelf composition is fixture). 'empty' zeroes the free batch's stock (offline
// sims — the robin skips empties, so the old sequences hold); 'full' caps them (Restock-All
// quotes — a full item quotes 0). RULE tests instead iterate the live registry; never pin those.
const TRIO = ['club', 'metal_helmet', 'hp_flask'];
// LIVE-DERIVED (2026-07-08): every free (license-free) item EXCEPT the trio, so a new free batch
// (the leather set, and any after) is auto-zeroed/filled by the fixture. Was a hardcoded four;
// batch 3a leaked its stock into the trio-only fixture (8 offline/quote failures) until this.
const FREE_BATCH = ITEM_ORDER.filter((id) => !ITEMS[id].license && !TRIO.includes(id));
function pinTrioShelf(s, mode = 'empty') {
  for (const id of FREE_BATCH) s.items[id].stock = (mode === 'full' ? s.items[id].maxStock ?? 5 : 0);
  return s;
}

console.log('M4 auto-serve worker — smoke test\n');

// 0. MODULE HEALTH: every src module must IMPORT cleanly. `node --check` doesn't do full
// module-binding analysis on .js files (a duplicate `import { CONFIG }` sailed through it and
// killed the game in the browser), and UI modules were never imported by this suite at all. A
// minimal DOM stub lets the UI modules load headlessly; any parse/binding/path error fails here.
{
  globalThis.window = globalThis.window ?? {};
  globalThis.document = globalThis.document ?? {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} } }),
    addEventListener: () => {},
  };
  const { readdirSync, statSync } = await import('node:fs');
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const p = `${dir}/${f}`;
    return statSync(p).isDirectory() ? walk(p) : (p.endsWith('.js') ? [p] : []);
  });
  for (const file of walk('./src')) {
    if (file.endsWith('/main.js')) continue;   // boot entry: needs a real canvas at import time;
                                               // every module it pulls in is covered individually
    let err = null;
    try { await import(file.replace('./src', './src')); } catch (e) { err = e; }
    ok(err === null, `module imports cleanly: ${file}${err ? ' — ' + err.message : ''}`);
  }
  delete globalThis.document;   // later sections manage their own window mocks
  delete globalThis.window;
}

// 0b. SPRITE REGISTRY PAIRING: every sprite id a consumer names must be REGISTERED in main.js.
// sprites.js is a registry — getSprite(id) only serves ids previously loadSprite()'d — and the
// graceful-fallback convention means a FORGOTTEN registration fails silently (shelf v2 shipped
// exactly this: the wall_shelf prop hook consumed an id main.js never registered; LESSONS.md
// 2026-07-03). Static scan of two shapes: literal getSprite('...') calls PLUS config-carried ids
// (propId:/spriteId: '...') — the config shape is the one the real bug wore, so literals alone
// would NOT have caught it. Template ids like `${monsterId}_idle` can't be checked statically;
// those stay covered by the anim-contract assertions in the monster-registry section.
{
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const p = `${dir}/${f}`;
    return statSync(p).isDirectory() ? walk(p) : (p.endsWith('.js') ? [p] : []);
  });
  const registered = new Set(
    [...readFileSync('./src/main.js', 'utf8').matchAll(/loadSprite\('([a-z_]+)'/g)].map((m) => m[1]),
  );
  const consumers = new Map();   // id -> first file naming it (makes a failure point at the culprit)
  for (const file of walk('./src')) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/getSprite\('([a-z_]+)'\)/g)) {
      if (!consumers.has(m[1])) consumers.set(m[1], file);
    }
    for (const m of src.matchAll(/(?:propId|spriteId):\s*'([a-z_]+)'/g)) {
      if (!consumers.has(m[1])) consumers.set(m[1], file);
    }
    // Door destinations are 'portal_glow_*' ids fed to getSprite via a variable (DOOR_VARIANTS),
    // so the literal getSprite scan above misses them; match the quoted ids as consumers too.
    for (const m of src.matchAll(/'(portal_glow_[a-z_]+)'/g)) {
      if (!consumers.has(m[1])) consumers.set(m[1], file);
    }
  }
  // Guard the guard: zero consumers means the regexes rotted, not that the code went clean.
  ok(consumers.size >= 1, `pairing scan found sprite consumers (found ${consumers.size})`);
  ok(consumers.has('portal_glow_mountain'),
     'pairing scan reached the DOOR_VARIANTS pool (variable-fed ids the literal scan would miss)');
  for (const [id, file] of consumers) {
    ok(registered.has(id), `sprite id '${id}' (named in ${file}) has a loadSprite registration in main.js`);
  }
}

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
  ok(s.log.length === 0 && s.pendingReports.length === 1
     && typeof s.pendingReports[0].entry.text === 'string',
     'auto-serve QUEUED one battle report (report-timing pass: the line lands at door entry / fallback)');
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

// 12. REGRESSION (audit): spawn fallback for a broken want config must be a real ITEM id -------
{
  const { spawnCustomer } = await import('./src/game.js');
  const { MONSTERS } = await import('./src/data/monsters.js');
  const { ITEMS } = await import('./src/data/items.js');
  const saved = MONSTERS.slime.categoryWeights;
  MONSTERS.slime.categoryWeights = {};             // simulate a registry entry with no affinities
  let sawSlime = false, allItemsValid = true;
  for (let i = 0; i < 60; i++) {                   // spawnCustomer picks a random monster; sample it
    const c = spawnCustomer();
    if (c.monsterId === 'slime') {
      sawSlime = true;
      if (!ITEMS[c.wantedItemId]) allItemsValid = false;
    }
  }
  MONSTERS.slime.categoryWeights = saved;          // restore the registry for any later cases
  ok(sawSlime, 'sample produced at least one slime (probabilistic; 60 draws)');
  ok(allItemsValid, 'empty categoryWeights falls back to a REAL item id (never an unservable want)');
}

// 13. M5 — offline earnings (pure compute + apply) --------------------------------------------
{
  const { computeOffline, applyOffline } = await import('./src/offline.js');
  const { CONFIG } = await import('./src/config.js');
  const HOUR = 3600 * 1000;
  const now = Date.now();

  // No worker -> zero result, regardless of time away.
  {
    const s = createInitialState();
    s.lastSeen = now - HOUR;
    const r = computeOffline(s, now);
    ok(r.sales === 0 && r.gold === 0 && r.rep === 0, 'offline: no worker -> zero earnings');
    ok(r.awaySec > 3599, 'offline: awaySec still reported (UI threshold uses it)');
  }

  // Worker + 1h away: STOCK-limited — default shelf (3+2+4=9) caps the payout, and stock is consumed.
  {
    const s = createInitialState();
    s.workers.mimic_merchant.owned = true;
    pinTrioShelf(s);                                // exact-math fixture: trio shelf only
    s.lastSeen = now - HOUR;                        // 600 possible sales at 6s... but only 9 in stock
    const r = computeOffline(s, now);
    ok(r.sales === 9, 'offline: stock-limits sales to the 9 on the shelf');
    ok(r.gold === 3 * 12 + 2 * 18 + 4 * 15, 'offline: gold = real basePrices of consumed stock (132)');
    ok(r.rep === 9 * 2, 'offline: rep = sales * perSale (18)');
    const gold0 = s.gold;
    ok(applyOffline(s, r) === true, 'applyOffline banks a non-zero result');
    ok(s.gold === gold0 + 132 && s.reputation === 18, 'apply adds gold + rep');
    ok(s.items.club.stock === 0 && s.items.metal_helmet.stock === 0 && s.items.hp_flask.stock === 0,
       'apply consumes the actual shelf stock (exploit guard)');
  }

  // TIME-limited: 30s away at 6s interval -> exactly 5 sales, round-robin (club,helm,flask,club,helm).
  {
    const s = createInitialState();
    s.workers.mimic_merchant.owned = true;
    pinTrioShelf(s);                                // exact-math fixture: trio robin sequence
    s.lastSeen = now - 30 * 1000;
    const r = computeOffline(s, now);
    ok(r.sales === 5, 'offline: time-limits sales (30s / 6s = 5)');
    ok(r.gold === 12 + 18 + 15 + 12 + 18, 'offline: deterministic round-robin gold (75)');
  }

  // CAP: beyond-cap absences pay exactly the cap (capHours raised 2 -> 12 in Pass 3; the research
  // flags short caps as a churn driver — stock still binds long before time in practice).
  {
    const mk = (ms) => { const s = createInitialState(); s.workers.mimic_merchant.owned = true;
      s.upgrades.extra_shelf = 5; for (const id of Object.keys(s.items)) s.items[id].stock = 10;
      s.lastSeen = now - ms; return s; };
    const r20 = computeOffline(mk(20 * HOUR), now);
    const r12 = computeOffline(mk(12 * HOUR), now);
    ok(r20.cappedSec === CONFIG.offline.capHours * 3600, 'offline: 20h away capped to capHours (12h)');
    ok(r20.sales === r12.sales && r20.gold === r12.gold, 'offline: beyond the cap pays nothing extra');
  }

  // Clock skew: lastSeen in the future -> zero, never negative.
  {
    const s = createInitialState();
    s.workers.mimic_merchant.owned = true;
    s.lastSeen = now + HOUR;
    const r = computeOffline(s, now);
    ok(r.awaySec === 0 && r.sales === 0, 'offline: future lastSeen (clock skew) -> zero, no negatives');
  }

  // Upgrades apply offline: Faster Counter L1 raises time-limited sales; Better Signage raises rep/sale.
  {
    const s = createInitialState();
    s.workers.mimic_merchant.owned = true;
    s.upgrades.faster_counter = 1;                  // interval 6 -> ~4.615s
    s.upgrades.better_signage = 1;                  // rep/sale 2 -> 3
    s.lastSeen = now - 30 * 1000;
    const r = computeOffline(s, now);
    ok(r.sales === 6, 'offline: Faster Counter L1 -> 6 sales in 30s (floor(30/4.615))');
    ok(r.rep === 6 * 3, 'offline: Better Signage boosts offline rep/sale (18)');
  }

  // Empty shelf -> zero (and applyOffline no-ops on a zero result).
  {
    const s = createInitialState();
    s.workers.mimic_merchant.owned = true;
    for (const id of Object.keys(s.items)) s.items[id].stock = 0;
    s.lastSeen = now - HOUR;
    const r = computeOffline(s, now);
    ok(r.sales === 0, 'offline: empty shelf -> nothing to sell');
    ok(applyOffline(s, r) === false, 'applyOffline no-ops cleanly on a zero result');
  }
}

// 14. REGRESSION: log lines never render the '{item}' fallback or article hazards ---------------
{
  const { dismissCurrent } = await import('./src/game.js');
  const { GENERIC_RESULTS, MONSTER_RESULTS } = await import('./src/data/results.js');

  // dismissCurrent now passes the wanted item -> "no something" can never render again.
  let sawSomething = false;
  for (let i = 0; i < 300; i++) {
    const s = shopState();
    s.queue = [customer('skeleton', 'hp_flask', 5)];
    dismissCurrent(s);
    if (s.log[0]?.text.includes('something')) sawSomething = true;
  }
  ok(!sawSomething, "dismiss lines never render 'no something' (item is passed; 300 draws)");

  // Registry-level guards, so a FUTURE line can't reintroduce either hazard:
  // Templates are string | { text, cats } since the item-aware pass — normalize for string guards.
  const txt = (tpl) => (typeof tpl === 'string' ? tpl : tpl.text);
  const all = [];
  for (const arr of Object.values(GENERIC_RESULTS)) all.push(...arr.map((s) => ['generic', txt(s)]));
  for (const tiers of Object.values(MONSTER_RESULTS))
    for (const [t, arr] of Object.entries(tiers)) all.push(...arr.map((s) => [t, txt(s)]));
  // (a) leave/dismiss are the only tiers whose call sites might omit item — dismiss now passes it,
  //     but LEAVE does not: no leave template may use {item}.
  const leaveWithItem = (GENERIC_RESULTS.leave ?? []).concat(
    ...Object.values(MONSTER_RESULTS).map((m) => m.leave ?? [])).filter((s) => txt(s).includes('{item}'));
  ok(leaveWithItem.length === 0, 'no leave template uses {item} (leave call site does not pass one)');
  // (b) "a {item}" breaks on vowel-sound items ("a HP Flask") -> always "the {item}" or rephrase.
  const articleHazards = all.filter(([, s]) => /\ba \{item\}/.test(s));
  ok(articleHazards.length === 0, 'no template contains the "a {item}" article hazard');
}

// 15. M6 — Kongregate bridge: no-op without the API, activates + submits 'loaded' with it --------
{
  const { initKongregate, submitStat, isKongregate } = await import('./src/kongregate.js');

  // Headless / local / itch: no window.kongregateAPI -> everything is a silent no-op.
  let threw = false;
  try { initKongregate(); submitStat('loaded', 1); } catch { threw = true; }
  ok(!threw, 'bridge: init + submit never throw without the API (local/itch/headless)');
  ok(isKongregate() === false, 'bridge: isKongregate() false when not on Kongregate');

  // Mock the loader global the Kongregate script tag would define -> bridge activates.
  const submitted = [];
  globalThis.window = {
    kongregateAPI: {
      loadAPI: (cb) => cb(),                            // docs: loadAPI(callback) then getAPI()
      getAPI: () => ({ stats: { submit: (n, v) => submitted.push([n, v]) } }),
    },
  };
  let ready = false;
  initKongregate(() => { ready = true; });
  ok(ready === true, 'bridge: onReady fires once the mocked API loads');
  ok(isKongregate() === true, 'bridge: isKongregate() true on (mocked) Kongregate');
  ok(submitted.some(([n, v]) => n === 'loaded' && v === 1, ), "bridge: submits the 'loaded' stat on init");
  submitStat('test_stat', 7);
  ok(submitted.some(([n, v]) => n === 'test_stat' && v === 7), 'bridge: submitStat forwards to the API');

  // A hostile/broken API object must degrade to a no-op, never a crash.
  globalThis.window = { kongregateAPI: { loadAPI: () => { throw new Error('boom'); } } };
  let threw2 = false;
  try { initKongregate(); } catch { threw2 = true; }
  ok(!threw2, 'bridge: a throwing loader is swallowed (game never depends on Kongregate health)');
  delete globalThis.window;                             // clean up for any later sections
}

// 16. Retention pass — worker greet delay + backroom_storage offline reserve --------------------
{
  const { CONFIG } = await import('./src/config.js');
  const { computeOffline } = await import('./src/offline.js');
  const { canBuyUpgrade, isUpgradeUnlocked } = await import('./src/game.js');

  // Greet: a worker may NOT serve a front customer who hasn't been visible greetSec yet.
  {
    const s = shopState();
    s.gold = 50; hireWorker(s, 'mimic_merchant');
    s.gold = 0;
    s.workers.mimic_merchant.timer = 0;             // worker READY the moment the customer lands
    s.queue = [customer('skeleton', 'club', 99)];
    update(s, 0.5);                                  // 0.5s at the counter < greetSec 1.2
    ok(s.queue.length === 1, 'greet: ready worker does NOT pounce an unseen customer (0.5s < 1.2s)');
    update(s, 0.5);                                  // 1.0s total — still under
    ok(s.queue.length === 1, 'greet: still holding at 1.0s');
    update(s, 0.3);                                  // 1.3s total — greet satisfied
    ok(s.queue.length === 0 && s.gold === 12, 'greet: worker serves the moment greetSec elapses');
  }

  // Greet does NOT gate manual serving (clicking = looking).
  {
    const s = shopState();
    s.queue = [customer('skeleton', 'club', 99)];    // frontWait 0 — just arrived
    ok(serveCurrent(s) === true, 'greet: manual serveCurrent is NOT gated by the greet delay');
  }

  // Backroom Storage v2: locked until Beloved (rep 100); effect = offline inventory RESERVE
  // (+1 full shelf-refill per item per level, sold after live stock at basePrice - restockCost).
  {
    const s = shopState();
    s.gold = 99999;
    ok(isUpgradeUnlocked(s, 'backroom_storage') === false, 'backroom: locked below Beloved');
    ok(canBuyUpgrade(s, 'backroom_storage') === false, 'backroom: not buyable while locked');
    s.reputation = 200; s.lifetimeRep = 200;        // Beloved — tiers read the LIFETIME track (Fame)
    ok(canBuyUpgrade(s, 'backroom_storage') === true, 'backroom: buyable at Beloved with gold');

    // Registry-derived expectations (batch 1 grew the free shelf — reserve conjures per UNLOCKED
    // item, so this block cannot be pinned to the trio; the formulas ARE the mechanic's spec).
    const { ITEMS: ITEMS16, ITEM_ORDER: ORDER16 } = await import('./src/data/items.js');
    const baseIds = ORDER16.filter((id) => !ITEMS16[id].license);
    const liveUnits = baseIds.reduce((a, id) => a + ITEMS16[id].startStock, 0);
    const liveGold  = baseIds.reduce((a, id) => a + ITEMS16[id].startStock * ITEMS16[id].basePrice, 0);
    const perLvlUnits = baseIds.reduce((a, id) => a + ITEMS16[id].maxStock, 0);
    const perLvlGold  = baseIds.reduce((a, id) => a + ITEMS16[id].maxStock * (ITEMS16[id].basePrice - ITEMS16[id].restockCost), 0);
    const now = Date.now();
    const mk = (lvl) => { const t = createInitialState(); t.workers.mimic_merchant.owned = true;
      t.upgrades.backroom_storage = lvl;
      t.lastSeen = now - 24 * 3600 * 1000; return t; };

    // L0: reserve plays no part — live units only, stock-limited exactly as before the upgrade.
    const r0 = computeOffline(mk(0), now);
    ok(r0.sales === liveUnits && r0.reserveUsed === 0,
       `backroom L0: ${liveUnits} live sales, no reserve involved`);

    // L1: live + one full shelf-refill per item; reserve pays basePrice - restockCost.
    const r1 = computeOffline(mk(1), now);
    ok(r1.sales === liveUnits + perLvlUnits, `backroom L1: ${liveUnits + perLvlUnits} sales (live + reserve)`);
    ok(r1.reserveUsed === perLvlUnits, `backroom L1: ${perLvlUnits} reserve units drawn`);
    ok(r1.gold === liveGold + perLvlGold, `backroom L1: gold ${liveGold + perLvlGold} (live + reserve net of restock)`);
    ok(r1.rep === (liveUnits + perLvlUnits) * 2, 'backroom L1: every sale grants rep (perSale 2)');
    ok((r1.consumed.club ?? 0) === 3 && (r1.consumed.metal_helmet ?? 0) === 2
       && (r1.consumed.hp_flask ?? 0) === 4,
       'backroom: consumed counts LIVE shelf units only (reserve never dents the real shelf)');

    // L3: three refills per item — the upgrade demonstrably scales offline income (vs L0).
    const r3 = computeOffline(mk(3), now);
    ok(r3.sales === liveUnits + 3 * perLvlUnits && r3.sales > r0.sales,
       `backroom L3: ${liveUnits + 3 * perLvlUnits} sales — real scaling, not a placebo`);
  }

  // Save round-trip: the fourth upgrade persists and clamps like the others.
  {
    const s = createInitialState();
    s.upgrades.backroom_storage = 3;
    const r = mergeSave(createInitialState(), JSON.parse(JSON.stringify(serializeSave(s))));
    ok(r.upgrades.backroom_storage === 3, 'backroom: level survives a save round-trip');
    const cheat = mergeSave(createInitialState(), { upgrades: { backroom_storage: 99 } });
    ok(cheat.upgrades.backroom_storage === 3, 'backroom: absurd saved level clamps to maxLevel 3');
  }
}

// 17. Pass 1 — Regulars' Loyalty: milestone math, payouts, crossings, ledger --------------------
{
  const { itemGoldMult, monsterRepMult, globalGoldMult, crossedCount, nextBreakpoint,
    ITEM_BREAKPOINTS, MILESTONE_LINES } = await import('./src/data/milestones.js');
  const { computeOffline, applyOffline } = await import('./src/offline.js');
  const { dismissCurrent } = await import('./src/game.js');

  // Math helpers.
  ok(crossedCount(9, ITEM_BREAKPOINTS) === 0 && crossedCount(10, ITEM_BREAKPOINTS) === 1
     && crossedCount(1000, ITEM_BREAKPOINTS) === 7, 'crossedCount: 9->0, 10->1, 1000->7');
  ok(nextBreakpoint(0, ITEM_BREAKPOINTS) === 10 && nextBreakpoint(10, ITEM_BREAKPOINTS) === 25
     && nextBreakpoint(1000, ITEM_BREAKPOINTS) === null, 'nextBreakpoint: 0->10, 10->25, 1000->null (maxed)');

  const near = (a, b) => Math.abs(a - b) < 1e-9;
  {
    const s = shopState();
    ok(near(itemGoldMult(s, 'club'), 1.0), 'fresh shop: item mult 1.0');
    s.stats.itemSales.club = 10;
    ok(near(itemGoldMult(s, 'club'), 1.08), '10 club sales: x1.08');
    s.stats.itemSales.club = 1000;
    ok(near(itemGoldMult(s, 'club'), 1.56), '1000 club sales: x1.56 (all 7 breakpoints)');
    // The "everything" tier is laggard-driven: 50/50/49 is NOT a full-shelf tier.
    for (const id of Object.keys(s.stats.itemSales)) s.stats.itemSales[id] = 50;   // ALL base >= 50
    s.stats.itemSales.hp_flask = 49;                                                // ...except the laggard
    ok(near(globalGoldMult(s), 1.0), 'everything: laggard at 49 -> still x1.0');
    s.stats.itemSales.hp_flask = 50;
    ok(near(globalGoldMult(s), 1.25), 'everything: all >= 50 -> x1.25');
    s.stats.monsterServes.skeleton = 100;
    ok(near(monsterRepMult(s, 'skeleton'), 1.3), '100 skeleton serves: rep x1.3');
  }

  // Live payout: multipliers apply to the PAYOUT; basePrice-based affordability is untouched.
  {
    const s = shopState();
    s.stats.itemSales.club = 25;                     // 2 breakpoints -> x1.16
    s.queue = [customer('skeleton', 'club', 12)];    // budget EXACTLY basePrice
    const gold0 = s.gold;
    ok(serveCurrent(s) === true, 'exact-budget customer still serves at high multipliers (price never rises)');
    ok(s.gold === gold0 + 14, 'payout: round(12 x 1.16) = 14 gold');
  }
  {
    const s = shopState();
    for (const id of Object.keys(s.stats.itemSales)) s.stats.itemSales[id] = 50;   // club x1.24, global x1.25
    s.queue = [customer('slime', 'club', 99)];
    const gold0 = s.gold;
    serveCurrent(s);
    ok(s.gold === gold0 + 19, 'stacked payout: round(12 x 1.24 x 1.25) = 19 gold');
  }
  {
    const s = shopState();
    s.stats.monsterServes.skeleton = 100;            // rep x1.3
    s.queue = [customer('skeleton', 'club', 99)];
    const rep0 = s.reputation;
    serveCurrent(s);
    ok(s.reputation === rep0 + 3, 'rep payout: round(2 x 1.3) = 3');
  }

  // Ledger + crossing announcements (announce exactly once, on the crossing sale).
  {
    const s = shopState();
    s.stats.itemSales.club = 9;
    s.items.club.stock = 5;
    s.queue = [customer('slime', 'club', 99)];
    serveCurrent(s);                                 // 10th club sale
    ok(s.stats.itemSales.club === 10 && s.stats.monsterServes.slime === 1,
       'ledger: item + monster counts increment on serve');
    ok(s.log.some((e) => e.tier === 'milestone'), 'crossing the 10-sale breakpoint announces in the log');
    const milestones0 = s.log.filter((e) => e.tier === 'milestone').length;
    s.queue = [customer('slime', 'club', 99)];
    serveCurrent(s);                                 // 11th — no breakpoint
    ok(s.log.filter((e) => e.tier === 'milestone').length === milestones0,
       'non-crossing sales announce nothing');
    const s2 = shopState();
    s2.queue = [customer('slime', 'club', 99)];
    dismissCurrent(s2);
    ok(s2.stats.itemSales.club === 0 && s2.stats.monsterServes.slime === 0,
       'dismiss counts nothing (only real serves feed the ledger)');
  }
  {
    const { CONFIG } = await import('./src/config.js');   // for the stagger beat below
    const s = shopState();
    for (const id of Object.keys(s.stats.itemSales)) s.stats.itemSales[id] = 50;   // laggard: flask at 49
    s.stats.itemSales.hp_flask = 49;
    s.items.hp_flask.stock = 3;
    s.queue = [customer('bat', 'hp_flask', 99)];
    serveCurrent(s);                                 // flask hits 50: item breakpoint + everything tier
    // Stagger (2026-07-05): double-gold delivers as BEATS — one instantly, the second queued and
    // released a spacing later, so each line gets read.
    ok(s.log.filter((e) => e.tier === 'milestone').length === 1 && s.milestoneQueue?.length === 1,
       'laggard crossing: first gold line instant, second queued (the stagger)');
    update(s, (CONFIG.log.milestoneSpacingSec ?? 2.5) + 0.01);
    ok(s.log.filter((e) => e.tier === 'milestone').length === 2,
       'laggard crossing announces both the item breakpoint AND the everything tier');
  }

  // Save round-trip + clamps.
  {
    const s = createInitialState();
    s.stats.itemSales.club = 137; s.stats.monsterServes.bat = 42;
    const r = mergeSave(createInitialState(), JSON.parse(JSON.stringify(serializeSave(s))));
    ok(r.stats.itemSales.club === 137 && r.stats.monsterServes.bat === 42,
       'ledger survives a save round-trip');
    const cheat = mergeSave(createInitialState(),
      { stats: { itemSales: { club: -5, metal_helmet: 12.7 }, monsterServes: { bat: 'zzz' } } });
    ok(cheat.stats.itemSales.club === 0 && cheat.stats.itemSales.metal_helmet === 12
       && cheat.stats.monsterServes.bat === 0, 'corrupt ledger clamps: -5 -> 0, 12.7 -> 12, junk -> 0');
  }

  // Offline: soldByItem feeds the ledger; frozen multipliers price the units.
  {
    const now = Date.now();
    const s = createInitialState();
    s.workers.mimic_merchant.owned = true;
    s.stats.itemSales.club = 100;                    // 4 breakpoints -> x1.32 on club, frozen
    s.items = { club: { stock: 1 }, metal_helmet: { stock: 0 }, hp_flask: { stock: 0 } };
    s.lastSeen = now - 3600 * 1000;
    const r = computeOffline(s, now);
    ok(r.sales === 1 && r.gold === 16, 'offline unit gold: round(12 x 1.32) = 16 (frozen mult)');
    ok((r.soldByItem.club ?? 0) === 1, 'offline returns soldByItem');
    applyOffline(s, r);
    ok(s.stats.itemSales.club === 101, 'applyOffline banks offline sales into the ledger');
  }

  // Registry guards for the announcement lines (same classes as the battle-line guards).
  {
    const all = Object.values(MILESTONE_LINES).flat();
    ok(all.every((t) => !/\ba \{item\}/.test(t)), 'milestone lines: no "a {item}" article hazard');
    const filled = all.map((t) => t.replace(/\{count\}/g, '1000').replace(/\{item\}/g, 'Metal Helmet')
      .replace(/\{name\}/g, 'Slimey').replace(/\{tier\}/g, '1000'));
    ok(filled.every((t) => t.length <= 84), 'milestone lines: worst-case fill stays log-friendly');
  }
}

// 18. Pass 2 — Fame: dual-track rep, tiers from lifetime, perk registry + consumers -------------
{
  const { buyPerk, canBuyPerk, isPerkUnlocked, isUpgradeUnlocked, effectiveRestockCost,
    restockItem, fameOf } = await import('./src/game.js');
  const { perkCost } = await import('./src/data/perks.js');
  const { MONSTERS } = await import('./src/data/monsters.js');   // Beetley-proof patience derive
  const { computeOffline, applyOffline } = await import('./src/offline.js');

  // Dual track: gains feed both; losses (patience leave) hit the spendable balance only.
  {
    const s = shopState();
    s.queue = [customer('slime', 'club', 99)];
    serveCurrent(s);
    ok(s.reputation === 2 && s.lifetimeRep === 2, 'serve: both tracks gain rep');
    s.queue = [customer('bat', 'club', 99)];
    s.queue[0].patienceRemaining = 0.01;
    update(s, 0.1);                                   // patience timeout -> leave penalty
    ok(s.reputation === 1, 'leave penalty: spendable balance drops');
    ok(s.lifetimeRep === 2, 'leave penalty: lifetime NEVER decreases');
  }

  // Tiers read lifetime: a spent-down balance keeps every earned gate.
  {
    const s = shopState();
    s.lifetimeRep = 500; s.reputation = 0;            // Renowned earned, wallet empty
    ok(isUpgradeUnlocked(s, 'backroom_storage') === true, 'tier gates read LIFETIME (wallet at 0)');
    ok(isPerkUnlocked(s, 'warm_welcome') === true, 'Renowned (new tier) unlocks Warm Welcome');
    ok(isPerkUnlocked(s, 'velvet_rope') === true && isPerkUnlocked(s, 'haggler_charm') === true,
       'lower-tier perks unlocked too');
    const low = shopState();
    low.lifetimeRep = 200;                            // Beloved only
    ok(isPerkUnlocked(low, 'warm_welcome') === false, 'Warm Welcome stays locked below Renowned');
  }

  // Migration: pre-Fame saves seed lifetime from current rep — tiers survive the schema change.
  {
    const r = mergeSave(createInitialState(), { reputation: 3600 });
    ok(r.lifetimeRep === 3600, 'migration: old save (rep only) seeds lifetimeRep = 3600');
    const r2 = mergeSave(createInitialState(), { reputation: 50, lifetimeRep: 900 });
    ok(r2.lifetimeRep === 900 && r2.reputation === 50, 'both tracks round-trip independently');
  }

  // Buying: spends the balance only; respects gates, cost curve, and maxLevel.
  {
    const s = shopState();
    s.lifetimeRep = 500; s.reputation = 150;
    ok(canBuyPerk(s, 'haggler_charm') === false, 'insufficient rep: not buyable (needs 200)');
    s.reputation = 2000;                              // full curve costs 200+320+512 = 1032
    ok(buyPerk(s, 'haggler_charm') === true, 'perk purchase succeeds');
    ok(s.reputation === 1800 && s.lifetimeRep === 500, 'spend: balance -200, lifetime untouched');
    ok(perkCost('haggler_charm', 1) === 320, 'cost curve: L1->L2 = round(200 x 1.6) = 320');
    buyPerk(s, 'haggler_charm'); buyPerk(s, 'haggler_charm');
    ok(s.perks.haggler_charm === 3 && canBuyPerk(s, 'haggler_charm') === false,
       'maxLevel 3 reached: no further purchases');
  }

  // Consumers: Haggler's Charm (restock cost, floored), Velvet Rope (queue), Warm Welcome (patience).
  {
    const s = shopState();
    s.perks.haggler_charm = 3;                        // -3 gold per restock
    ok(effectiveRestockCost(s, 'club') === 3, "Haggler L3: club restock 6 -> 3");
    ok(effectiveRestockCost(s, 'metal_helmet') === 6, 'helm restock 9 -> 6');
    const gold0 = s.gold = 100;
    s.items.club.stock = 0;
    restockItem(s, 'club');
    ok(s.gold === gold0 - 3, 'restockItem charges the EFFECTIVE cost');
  }
  {
    const s = shopState();
    s.perks.velvet_rope = 2;                          // maxLength 4 + 2 = 6
    s.spawnTimer = 0.1;                               // shopState() defaults to never-spawn; opt in
    s.queue = Array.from({ length: 5 }, () => customer('slime', 'club', 99));
    s.queue.forEach((c) => { c.patienceRemaining = 999; });
    update(s, 3.0);                                   // spawn tick with room -> 6th joins
    ok(s.queue.length === 6, 'Velvet Rope L2: a 6th customer can join the line');
    update(s, 3.0);
    ok(s.queue.length === 6, '...but a 7th cannot (effective cap 6)');
  }
  {
    const s = shopState();
    s.perks.warm_welcome = 2;                         // +8s patience
    s.spawnTimer = 0.1;                               // opt back into spawning
    update(s, 3.0);                                   // let one spawn
    const spawned = s.queue[s.queue.length - 1];
    const bonus = MONSTERS[spawned.monsterId].patienceBonus ?? 0;   // Beetley-proof (2026-07-06):
    ok(s.queue.length >= 1 && spawned.patienceRemaining === 29 + bonus,   // the mob is random, so
       'Warm Welcome L2: spawns at 24 + 8 (+ any Steadfast bonus) - the 3.0s tick');  // derive from ITS row
  }

  // Perk levels persist and clamp.
  {
    const s = createInitialState();
    s.perks.velvet_rope = 2;
    const r = mergeSave(createInitialState(), JSON.parse(JSON.stringify(serializeSave(s))));
    ok(r.perks.velvet_rope === 2, 'perk levels survive a save round-trip');
    const cheat = mergeSave(createInitialState(), { perks: { haggler_charm: 99, velvet_rope: -4 } });
    ok(cheat.perks.haggler_charm === 3 && cheat.perks.velvet_rope === 0,
       'perk clamp: 99 -> maxLevel 3, -4 -> 0');
  }

  // Offline rep banks into the lifetime track too.
  {
    const now = Date.now();
    const s = createInitialState();
    s.workers.mimic_merchant.owned = true;
    s.lastSeen = now - 3600 * 1000;
    const r = computeOffline(s, now);
    const life0 = s.lifetimeRep;
    applyOffline(s, r);
    ok(s.lifetimeRep === life0 + r.rep && r.rep > 0, 'applyOffline: lifetime gains the banked rep');
  }
}

// 19. Pass 3 — Better Stock: supplier licenses, fame budgets, tier-2 integration ----------------
{
  const { isItemUnlocked, canBuyLicense, buyLicense, canRestock, spawnCustomer } = await import('./src/game.js');
  const { everythingTier } = await import('./src/data/milestones.js');
  // In-loop bound check: counts FAILURES only (600+ loop iterations shouldn't inflate the tally).
  const ok2 = (cond) => { if (!cond) { fail++; console.log('  ✗ FAIL: in-loop bound violated'); } };
  const { computeOffline } = await import('./src/offline.js');
  const { ITEMS } = await import('./src/data/items.js');

  // License basics: base items always unlocked; tier-2 locked until bought, exactly once.
  {
    const s = shopState();
    ok(isItemUnlocked(s, 'club') === true, 'base items need no license');
    ok(isItemUnlocked(s, 'iron_sword') === false, 'tier-2 starts locked');
    ok(canRestock(s, 'iron_sword') === false, 'locked items cannot be restocked');
    s.gold = 5000;
    // Specimen note (reform Pass A): the RESTOCK half of this block moved to greater_flask —
    // same license cost (800) and tier (Renowned), but still gold-acquired. iron_sword is
    // trade-tier now, and "never gold-restockable" is exactly what §59(f) pins for it.
    ok(canBuyLicense(s, 'greater_flask') === false, 'license gated behind Renowned (lifetime tier)');
    s.lifetimeRep = 500;                              // Renowned
    ok(canBuyLicense(s, 'greater_flask') === true && canBuyLicense(s, 'knight_helm') === false,
       'Renowned licenses the flask; the helm waits for Legendary');
    ok(buyLicense(s, 'greater_flask') === true && s.gold === 4200 && s.licenses.greater_flask === true,
       'license purchase: -800 gold, flag set');
    ok(canBuyLicense(s, 'greater_flask') === false, 'a license is one-time');
    ok(canRestock(s, 'greater_flask') === true, 'licensed item becomes restockable');
  }

  // Spawn filter: locked items are invisible to customers; licensing makes them wantable.
  {
    const locked = shopState();
    let sawTier2 = false;
    for (let i = 0; i < 400; i++) {
      const c = spawnCustomer(locked);
      if (ITEMS[c.wantedItemId]?.license) sawTier2 = true;
    }
    ok(!sawTier2, 'no customer ever wants a locked item (400 spawns)');
    const open = shopState();
    open.lifetimeRep = 500; open.gold = 800;
    buyLicense(open, 'iron_sword');
    let sawSword = false;
    for (let i = 0; i < 400; i++) if (spawnCustomer(open).wantedItemId === 'iron_sword') sawSword = true;
    ok(sawSword, 'licensed items enter the want pool');
  }

  // Fame budgets: x1.30 at Legendary; unscaled at Beloved and below. Bounds come from the LIVE
  // registry (a hand-typed range map failed here once — Batty is [12,22], not remembered [8,18]).
  {
    const { MONSTERS } = await import('./src/data/monsters.js');
    const s = shopState();
    s.lifetimeRep = 1500;                             // Legendary (index 5) -> x1.30
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 600; i++) {
      const c = spawnCustomer(s);
      const [minB, maxB] = MONSTERS[c.monsterId].budgetRange;
      ok2(c.budget >= Math.round(minB * 1.3) && c.budget <= Math.round(maxB * 1.3));
      lo = Math.min(lo, c.budget); hi = Math.max(hi, c.budget);
    }
    ok(true, `fame budgets: 600 Legendary spawns all within x1.30 bounds (saw ${lo}..${hi})`);
    const base = shopState();                         // Neutral: unscaled — bound from the LIVE
    for (let i = 0; i < 200; i++) {                   // registry (the hard-coded 24 was the OLD
      const c = spawnCustomer(base);                  // roster max; Froggo's [16,30] broke it —
      ok2(c.budget <= MONSTERS[c.monsterId].budgetRange[1]);   // same lesson as the x1.30 loop above)
    }
    ok(true, 'fame budgets: unscaled at base tiers (200 spawns within own registry ranges)');
  }

  // The regression guard: three new items at 0 sales must NOT drop an earned everything-tier.
  {
    const s = shopState();
    for (const id of Object.keys(s.stats.itemSales)) {
      s.stats.itemSales[id] = ITEMS[id]?.license ? 0 : 60;   // every license-FREE item at 60
    }
    ok(everythingTier(s) === 1, 'everything tier keys off BASE items only (tier-2 at 0 is harmless)');
  }

  // Offline: unlicensed items generate no reserve sales; licensed ones join the sim.
  {
    const now2 = Date.now();
    const mk = () => { const t = createInitialState(); t.workers.mimic_merchant.owned = true;
      t.upgrades.backroom_storage = 1;
      for (const id of Object.keys(t.items)) t.items[id].stock = 0;   // reserve-only absence
      t.lastSeen = now2 - 3600 * 1000; return t; };
    const lockedR = computeOffline(mk(), now2);
    ok((lockedR.soldByItem.iron_sword ?? 0) === 0 && (lockedR.soldByItem.knight_helm ?? 0) === 0,
       'offline reserve conjures nothing for unlicensed items');
    const s2 = mk();
    s2.licenses.greater_flask = true;   // specimen swap (reform Pass A): iron_sword's reserve is
                                        // deliberately ZERO now — §59(g) pins that; the flask
                                        // proves the licensed-gold reserve path still lives.
    const openR = computeOffline(s2, now2);
    ok((openR.soldByItem.greater_flask ?? 0) > 0, 'licensed tier-2 sells from the backroom reserve');
  }

  // Serving tier-2 pays its price and feeds its own milestone ladder.
  {
    const s = shopState();
    s.licenses.iron_sword = true;
    s.items.iron_sword.stock = 2;
    s.queue = [customer('skeleton', 'iron_sword', 30)];
    const gold0 = s.gold;
    ok(serveCurrent(s) === true, 'a licensed tier-2 item serves normally');
    ok(s.gold === gold0 + 26, 'iron sword pays its basePrice (26, no milestones yet)');
    ok(s.stats.itemSales.iron_sword === 1, 'tier-2 has its own milestone ladder from sale #1');
  }

  // Persistence: strict-boolean coercion (a tampered truthy string unlocks nothing).
  {
    const s = createInitialState();
    s.licenses.iron_sword = true;
    const r = mergeSave(createInitialState(), JSON.parse(JSON.stringify(serializeSave(s))));
    ok(r.licenses.iron_sword === true && r.licenses.knight_helm === false,
       'licenses survive a save round-trip');
    const tampered = mergeSave(createInitialState(), { licenses: { iron_sword: 'yes', knight_helm: 1 } });
    ok(tampered.licenses.iron_sword === false && tampered.licenses.knight_helm === false,
       'tampered truthy strings/numbers do NOT unlock (strict === true)');
  }
}

// 20. Pass 3.5 — Restock All: quote math, round-robin fairness, gates ---------------------------
{
  const { restockAllCost, canRestockAll, restockAll, buyLicense } = await import('./src/game.js');

  // Quote: full fill at EFFECTIVE costs (Haggler applies), unlicensed items excluded.
  {
    const s = pinTrioShelf(shopState(), 'full');      // fixture: batch four at cap quote 0
    // need: club 2x6 + helm 3x9 + flask 1x8 = 12+27+8 = 47; tier-2 locked -> excluded
    ok(restockAllCost(s) === 47, 'quote: 47 gold to fill the base shelf (locked items excluded)');
    s.perks.haggler_charm = 3;                        // costs 3/6/5
    ok(restockAllCost(s) === 2 * 3 + 3 * 6 + 1 * 5, 'quote respects the Haggler discount (29)');
  }

  // Full fill when gold covers the quote.
  {
    const s = pinTrioShelf(shopState(), 'full');      // fixture: only the trio has room to fill
    s.gold = 100;
    const bought = restockAll(s);
    ok(bought === 6 && s.gold === 53, 'full fill: 6 units bought, exactly the 47-gold quote spent');
    ok(s.items.club.stock === 5 && s.items.metal_helmet.stock === 5 && s.items.hp_flask.stock === 5,
       'every unlocked item at cap');
    ok(canRestockAll(s) === false, 'nothing left to buy -> Restock All disabled');
    ok(restockAll(s) === 0, 'restockAll on a full shelf is a no-op');
  }

  // Partial fill: round-robin spreads a short purse evenly (one unit per item per pass).
  {
    const s = shopState();
    for (const id of ['club', 'metal_helmet', 'hp_flask']) s.items[id].stock = 0;
    s.gold = 23;                                      // pass1: 6+9+8=23 -> exactly one unit EACH
    const bought = restockAll(s);
    ok(bought === 3 && s.gold === 0, 'partial: 23 gold buys one full round (6+9+8)');
    ok(s.items.club.stock === 1 && s.items.metal_helmet.stock === 1 && s.items.hp_flask.stock === 1,
       'round-robin: every item got its unit before any got a second');
  }

  // Licensed tier-2 joins the pool; caps are respected.
  {
    const s = shopState();
    s.lifetimeRep = 500; s.gold = 800;
    buyLicense(s, 'greater_flask');                   // gold now 0 (specimen swap, reform Pass A:
                                                      // the sword never gold-fills — §59(f) pins it)
    s.gold = 5000;
    restockAll(s);
    ok(s.items.greater_flask.stock === 5, 'licensed tier-2 fills to cap with the rest');
    ok(s.items.knight_helm.stock === 0, 'still-locked items get nothing');
  }
}

// 21. Spawn director: interval follows queue depth (the "spotlight" fix) -----------------------
{
  const { CONFIG } = await import('./src/config.js');
  const { hireWorker } = await import('./src/game.js');
  const table = CONFIG.queue.spawnIntervalByQueue;
  ok(Array.isArray(table) && table.length === 4, 'director: 4-entry interval table exists');

  // After a spawn, the NEXT interval is indexed by the post-spawn queue length (clamped).
  const spawnOnce = (preLen) => {
    const s = shopState();
    s.queue = Array.from({ length: preLen }, () => customer('slime', 'club', 99));
    s.queue.forEach((q) => { q.patienceRemaining = 999; });
    s.spawnTimer = 0.01;
    update(s, 0.02);
    return s;
  };
  ok(Math.abs(spawnOnce(0).spawnTimer - table[1]) < 0.001,
     'empty shop: spawn -> next interval reads table[1] (line of 1 now)');
  ok(Math.abs(spawnOnce(2).spawnTimer - table[3]) < 0.001,
     'line of 2: spawn -> table[3] (relaxed; index clamps to last)');
  ok(Math.abs(spawnOnce(5).spawnTimer - table[3]) < 0.001,
     'full line (no room): timer still resets to the clamped last entry');

  // The equilibrium claim in one assertion: a maxed Bob (2.4s serves) with the director never
  // leaves the stage empty for long — simulate 120s and require customers present most of the time.
  {
    const s = shopState();
    s.gold = 50; hireWorker(s, 'mimic_merchant');
    s.gold = 999999;
    s.upgrades.faster_counter = 5;
    for (const id of Object.keys(s.items)) s.items[id].stock = 999;  // stock never the binder here
    s.spawnTimer = 0.01;
    let framesEmpty = 0, frames = 0;
    for (let t = 0; t < 120; t += 0.1) {
      update(s, 0.1);
      frames++;
      if (s.queue.length === 0) framesEmpty++;
    }
    ok(framesEmpty / frames < 0.35,
       `director: maxed Bob's stage is populated most of the time (empty ${Math.round(100 * framesEmpty / frames)}% of frames)`);
  }
}

// 22. Mob idle animations: registry contract for the optional anim field ------------------------
{
  const { MONSTERS, MONSTER_IDS } = await import('./src/data/monsters.js');
  for (const id of MONSTER_IDS) {
    const a = MONSTERS[id].anim;
    if (a !== undefined) {
      ok(Number.isInteger(a.frames) && a.frames > 0 && a.fps > 0,
         `anim contract: ${id} declares valid frames/fps`);
    }
  }
  ok(MONSTERS.bat.anim.frames === 4, 'Batty declares the 4-frame wing-flap');
  // Pass B (idle wiring) changed this data's shape: statics no longer exist — ALL monsters share
  // the 4-frame idle contract (Daniel's confirmed convention; strips optional, absent -> static).
  // The `anim` FIELD remains optional in code (drawMob guards it) — that contract is now proven by
  // the guards, not by absent data.
  ok(Object.values(MONSTERS).every((m) => m.anim?.frames === 4 && m.anim?.fps > 0),
     'shared idle contract: every monster declares the 4-frame idle');
}

// 23. Pass 4a — Bestiary completion: pure math over the Pass-1 serve ledger ---------------------
{
  const { bestiaryCompletion, MONSTER_BREAKPOINTS } = await import('./src/data/milestones.js');
  const { MONSTERS, MONSTER_IDS } = await import('./src/data/monsters.js');
  // Special Visits (2026-07-07): SPECIAL rows are off the grid — completion and its totals derive
  // over the non-special roster (the §33 evolution pattern: the derivation grows a source rule).
  const gridIds = MONSTER_IDS.filter((id) => !MONSTERS[id].special);
  const total = gridIds.length * MONSTER_BREAKPOINTS.length;

  const s0 = createInitialState();
  const c0 = bestiaryCompletion(s0);
  ok(c0.crossed === 0 && c0.pct === 0, 'bestiary: fresh state is 0 crossed, 0%');
  ok(c0.total === total,
     `bestiary: total scales with the roster (${MONSTER_IDS.length} x ${MONSTER_BREAKPOINTS.length} = ${total})`);

  const s1 = createInitialState();
  s1.stats.monsterServes.slime = 100;   // crosses 25 / 50 / 100 -> exactly 3
  const c1 = bestiaryCompletion(s1);
  ok(c1.crossed === 3, 'bestiary: 100 slime serves cross exactly 3 breakpoints');
  ok(c1.pct === Math.floor((100 * 3) / total), 'bestiary: pct floors, never rounds up');

  const s2 = createInitialState();
  for (const id of MONSTER_IDS) s2.stats.monsterServes[id] = 999999;
  const c2 = bestiaryCompletion(s2);
  ok(c2.crossed === total && c2.pct === 100, 'bestiary: full ledger reads 100%');

  // Pre-Pass-1 save shape: no stats ledger at all — must read as 0, never crash (guarded ?. chain).
  const cl = bestiaryCompletion({ stats: undefined });
  ok(cl.crossed === 0 && cl.pct === 0, 'bestiary: absent stats ledger reads as 0 (legacy save shape)');
}

// 24. Grounding pass — flyer bob gate + MEASURED footPad registry contract ----------------------
// footPad values are MEASURED from the shipped PNGs (pngjs alpha scan, 2026-07-03): transparent
// rows below the lowest opaque pixel. Pinning them here stops a later pass from "correcting" a
// measured value back to a remembered one (the Batty-budget lesson). Art trimmed later -> update
// registry + this test together.
{
  const { MONSTERS, MONSTER_IDS } = await import('./src/data/monsters.js');
  ok(MONSTERS.bat.flying === true, 'grounding: Batty declares flying (keeps the idle hover bob)');
  ok(MONSTERS.bat.footPad === undefined,
     'grounding: Batty declares NO footPad (its 15px padding is the hover altitude)');
  ok(MONSTERS.slime.footPad === 18, 'grounding: Slimey footPad pinned at MEASURED 18');
  ok(MONSTERS.skeleton.footPad === 12, 'grounding: Skele footPad pinned at MEASURED 12');
  // Contract guard for future mobs: footPad, when declared, is a non-negative finite number
  // (drawMob multiplies it — a NaN here would silently un-draw the mob).
  ok(MONSTER_IDS.every((id) => {
    const fp = MONSTERS[id].footPad;
    return fp === undefined || (Number.isFinite(fp) && fp >= 0);
  }), 'grounding: every declared footPad is a non-negative finite number');
}

// 25. Pass 4b — Froggo the grumpy frog: registry contract + roster auto-flow ---------------------
{
  const { MONSTERS, MONSTER_IDS } = await import('./src/data/monsters.js');
  const { spawnCustomer } = await import('./src/game.js');
  const { ITEMS } = await import('./src/data/items.js');
  const { MONSTER_RESULTS } = await import('./src/data/results.js');

  ok(MONSTER_IDS.includes('frog'), 'roster: frog joined (exact roster count is the NEWEST batch section\'s job)');
  const f = MONSTERS.frog;
  // Values from the registry, not memory (the Batty-budget lesson): Option 2 identity pinned.
  ok(f.combatMod === 0 && f.budgetRange[0] === 16 && f.budgetRange[1] === 30,
     'frog: Option-2 identity pinned (combatMod 0, budget [16,30])');
  ok(f.flying === undefined && f.footPad === 15 && f.spriteScale === 1.1,
     'frog: grounded; footPad pinned at MEASURED 15, spriteScale 1.1 (art integration 2026-07-04)');
  const realCats = new Set(Object.values(ITEMS).map((i) => i.category));
  ok(Object.keys(f.categoryWeights).every((c) => realCats.has(c))
     && Object.keys(f.itemBias).every((id) => ITEMS[id] !== undefined),
     'frog: category + bias keys are all real (the no-item front-blocker guard)');
  ok(Object.keys(f.itemBias).some((id) => ITEMS[id]?.license),
     'frog: itemBias leads with licensed items (the tier-2 customer, A2 shape)');

  // Pre-license behavior: a fresh state has NO licenses, so 200 spawns forced to frog must all
  // want license-free items — the Pass-3 filter is what makes the tier-2-leaning row safe day one.
  {
    const realRandom = Math.random;
    let frogWantedLocked = false;
    for (let i = 0; i < 200; i++) {
      const s = shopState();                      // fresh: licenses all false
      // spawnCustomer picks the monster uniformly; force frog by monkey-patching pick's source
      // would couple to utils internals — instead spawn until we draw frogs (uniform => ~50 of 200).
      const c = spawnCustomer(s);
      if (c.monsterId !== 'frog') continue;
      if (ITEMS[c.wantedItemId]?.license) frogWantedLocked = true;
      ok(c.budget >= 16 && c.budget <= 30, `frog budget in range (got ${c.budget})`);
      break;                                      // one asserted sample per state is enough here
    }
    // Statistical spread: over 400 spawns, frog must actually appear AND never want locked items.
    let seen = 0;
    for (let i = 0; i < 400; i++) {
      const s = shopState();
      const c = spawnCustomer(s);
      if (c.monsterId !== 'frog') continue;
      seen++;
      if (ITEMS[c.wantedItemId]?.license) frogWantedLocked = true;
    }
    Math.random = realRandom;
    // Floor DERIVES from the live spawnable roster (frozen `> 40` went flaky at nine monsters —
    // expected 400/8 = 50, and a routine -1.5σ draw of 40 failed ~1 run in 15). Four sigma
    // under the uniform expectation: fails only on a genuinely broken picker, never on luck.
    const spawnable = MONSTER_IDS.filter((id) => !MONSTERS[id].special).length;
    const expect = 400 / spawnable;
    const floor = Math.floor(expect - 4 * Math.sqrt(400 * (1 / spawnable) * (1 - 1 / spawnable)));
    ok(seen > floor, `frog spawns at a real rate (uniform pick; saw ${seen}/400, floor ${floor} @ 4σ)`);
    ok(!frogWantedLocked, 'pre-license: frog never wants a locked tier-2 item (filter holds)');
  }

  // Legacy save (no frog key in monsterServes) merges to 0, never NaN/crash — merge iterates the
  // FRESH state's keys, so a new roster entry is additive by construction.
  {
    const { mergeSave } = await import('./src/save.js');
    const legacy = { stats: { itemSales: {}, monsterServes: { slime: 40, bat: 10, skeleton: 5 } }, gold: 77 };
    const merged = mergeSave(createInitialState(), legacy);
    ok(merged.stats.monsterServes.frog === 0, 'legacy save: frog serves merge to 0');
    ok(merged.stats.monsterServes.slime === 40, 'legacy save: existing serve counts survive');
  }

  // Comedy: frog pool exists with the same tier keys as the trio (picker pools it with generic).
  const tiers = ['excellent', 'success', 'partial', 'failure', 'funnyFailure', 'leave', 'dismiss'];
  ok(tiers.every((t) => (MONSTER_RESULTS.frog?.[t] ?? []).length >= 2),
     'frog: every comedy tier has at least 2 lines (section-14 hazard guards auto-cover them)');
}

// 26. Battle-report timing (Daniel, 2026-07-04): the result lands at DOOR ENTRY, not at the sale --
{
  const { deliverBattleReport, dismissCurrent } = await import('./src/game.js');
  const { serializeSave } = await import('./src/save.js');
  const { CONFIG } = await import('./src/config.js');

  // A paid serve: economy INSTANT (they pay at the counter), report PENDING (news travels slow).
  {
    const s = shopState();
    s.gold = 0;                                     // isolate the sale's payment (fresh states start with seed gold)
    s.queue = [customer('skeleton', 'club', 99)];
    ok(serveCurrent(s) === true, 'report timing: serve succeeds');
    ok(s.gold === 12 && s.reputation > 0, 'economy applies AT the serve (gold + rep instant)');
    ok(s.log.length === 0, 'battle line is NOT in the log at serve time');
    ok(s.pendingReports.length === 1 && s.pendingReports[0].entry.monsterId === 'skeleton',
       'the report is pending, carrying the full entry');

    // Door-entry delivery (what main.js's celebrant callback calls).
    s.uiDirty = false;
    ok(deliverBattleReport(s) === true, 'door entry delivers the report');
    ok(s.log.length === 1 && s.log[0].monsterId === 'skeleton' && typeof s.log[0].repDelta === 'number',
       'delivered line is the full battle entry');
    ok(s.uiDirty === true, 'delivery requests a panel re-render');
    ok(deliverBattleReport(s) === false, 'nothing pending -> deliver is a no-op returning false');
  }

  // Milestone lines stay INSTANT (shop-side voice at the sale); the battle line arrives on top later.
  {
    const s = shopState();
    s.stats.itemSales.club = 9;                     // next club sale crosses the 10-sale breakpoint
    s.queue = [customer('slime', 'club', 99)];
    serveCurrent(s);
    ok(s.log.length === 1 && s.log[0].tier === 'milestone',
       'milestone announces at the SALE (instant), battle line still pending');
    deliverBattleReport(s);
    ok(s.log[0].tier !== 'milestone' && s.log[1].tier === 'milestone',
       'battle line lands ON TOP of the earlier milestone line (log order matches fiction)');
  }

  // Fallback: with no door-entry event, update() delivers after CONFIG.log.reportFallbackSec.
  {
    const s = shopState();
    s.queue = [customer('bat', 'club', 99)];
    serveCurrent(s);
    for (let t = 0; t < (CONFIG.log.reportFallbackSec ?? 3) - 0.2; t += 0.1) update(s, 0.1);
    ok(s.log.length === 0, 'fallback: not yet delivered just before the deadline');
    for (let t = 0; t < 0.5; t += 0.1) update(s, 0.1);
    ok(s.log.length === 1 && s.pendingReports.length === 0,
       'fallback: update() delivered the report past the deadline (no render event needed)');
  }

  // FIFO across two serves — the head is always the oldest report.
  {
    const s = shopState();
    s.queue = [customer('skeleton', 'club', 99), customer('slime', 'club', 99)];
    serveCurrent(s);
    s.serveCooldown = 0;                            // clear the counter cooldown between sales
    serveCurrent(s);
    ok(s.pendingReports.length === 2, 'two serves -> two pending reports');
    deliverBattleReport(s); deliverBattleReport(s);
    ok(s.log[1].monsterId === 'skeleton' && s.log[0].monsterId === 'slime',
       'FIFO: first serve delivered first (oldest deepest in the log)');
  }

  // Dismiss lines are shop-side and stay instant; and the pending queue is never serialized.
  {
    const s = shopState();
    s.queue = [customer('frog', 'club', 5)];
    dismissCurrent(s);
    ok(s.log.length === 1 && s.log[0].tier === 'dismiss' && s.pendingReports.length === 0,
       'dismiss logs instantly (no battle, no pending report)');
    s.queue = [customer('bat', 'club', 99)];
    serveCurrent(s);
    ok(!('pendingReports' in serializeSave(s)),
       'pendingReports is transient — never serialized (reload drops the line only, never economy)');
  }
}

// 27. Items scaffold (A2 + B2, 2026-07-04): category wants + the everything ratchet ------------
{
  const { spawnCustomer, serveCurrent: serve2 } = await import('./src/game.js');
  const { MONSTERS } = await import('./src/data/monsters.js');
  const { ITEMS } = await import('./src/data/items.js');
  const { everythingTier, globalGoldMult, EVERYTHING_TIERS } = await import('./src/data/milestones.js');
  const { mergeSave, serializeSave } = await import('./src/save.js');

  // A2 — category affinity is absolute: a consumable-only monster never wants anything else.
  {
    const saved = MONSTERS.slime.categoryWeights;
    MONSTERS.slime.categoryWeights = { consumable: 1 };
    let checked = 0, allConsumable = true;
    for (let i = 0; i < 600 && checked < 60; i++) {
      const c = spawnCustomer(shopState());
      if (c.monsterId !== 'slime') continue;
      checked++;
      if (ITEMS[c.wantedItemId].category !== 'consumable') allConsumable = false;
    }
    MONSTERS.slime.categoryWeights = saved;
    ok(checked >= 40 && allConsumable,
       `A2: consumable-only slime wants only consumables (${checked} sampled)`);
  }

  // A2 — itemBias steers WITHIN a category once the item is unlocked (the tier-2 customer).
  {
    const s = shopState();
    s.licenses.greater_flask = true;                // frog's bias-3 flask is now in the pool
    let flaskWants = 0, consumableWants = 0;
    for (let i = 0; i < 12000 && consumableWants < 150; i++) {   // cap raised 2026-07-06: the
      // budget>=flask conditioning qualifies only ~3% of draws; 12k keeps the >=100 sample floor
      const c = spawnCustomer(s);
      if (c.monsterId !== 'frog') continue;
      if (ITEMS[c.wantedItemId].category !== 'consumable') continue;
      // Budget-aware wants (2026-07-06): condition on purses that AFFORD the flask — there every
      // consumable carries the same x4, so relative weights are pure itemBias again. This
      // isolates the itemBias contract from the affordability contract (section 49 owns that).
      if (c.budget < ITEMS.greater_flask.basePrice) continue;
      consumableWants++;
      if (c.wantedItemId === 'greater_flask') flaskWants++;
    }
    // Expectation from the LIVE registry (a hand-typed 2-item-category threshold broke once when
    // batch 1 grew the pool — same lesson as the budget bound): dominance = comfortably above the
    // uniform per-item share.
    const cPool = Object.values(ITEMS).filter((it) =>
      it.category === 'consumable' && (!it.license || s.licenses[it.id] === true));
    const uniform = 1 / cPool.length;
    ok(consumableWants >= 100 && flaskWants / consumableWants > uniform * 1.4,
       `A2: itemBias dominates within the category (${flaskWants}/${consumableWants}; uniform would be ${Math.round(uniform * 100)}%)`);
  }

  // B2 — the ratchet, pure math: earned floor holds when computed drops to 0.
  {
    const s = createInitialState();                 // all sales 0 -> computed tier 0
    s.stats.everythingTierEarned = 2;
    ok(everythingTier(s) === 2, 'B2: earned tier floors the computed tier');
    ok(Math.abs(globalGoldMult(s) - 1.5625) < 1e-9, 'B2: gold mult follows the ratcheted tier (1.25^2)');
    for (const id of Object.keys(s.stats.itemSales)) s.stats.itemSales[id] = 999999;
    ok(everythingTier(s) === EVERYTHING_TIERS.length, 'B2: computed still wins when it exceeds earned');
  }

  // B2 — a live crossing WRITES the ratchet (serveCurrent is the single writer).
  {
    const s = shopState();
    for (const id of Object.keys(s.stats.itemSales)) s.stats.itemSales[id] = 50;
    s.stats.itemSales.club = 49;                    // club is the laggard, one sale from tier 1
    s.queue = [customer('slime', 'club', 99)];
    serve2(s);
    ok(s.stats.everythingTierEarned === 1, 'B2: crossing the everything tier persists it (earned = 1)');
  }

  // B2 — merge seeds earned from the PINNED legacy basis (pre-ratchet saves keep their tier even
  // if the update that introduces the ratchet ALSO ships new free items), and clamps garbage.
  {
    const legacy = { stats: { itemSales: { club: 60, metal_helmet: 60, hp_flask: 60 }, monsterServes: {} } };
    const m1 = mergeSave(createInitialState(), legacy);
    ok(m1.stats.everythingTierEarned === 1, 'B2 migration: 60-each pre-ratchet save seeds earned = 1');
    const garbage = { stats: { itemSales: {}, monsterServes: {}, everythingTierEarned: 999 } };
    const m2 = mergeSave(createInitialState(), garbage);
    ok(m2.stats.everythingTierEarned === EVERYTHING_TIERS.length,
       'B2 migration: hand-edited 999 clamps to the ladder length');
    const s = createInitialState();
    s.stats.everythingTierEarned = 2;
    ok(serializeSave(s).stats.everythingTierEarned === 2, 'B2: the ratchet round-trips through the save');
  }
}

// 28. Item-aware comedy: category-tagged templates filter by the sold item's category ------------
{
  const { logLine } = await import('./src/messages.js');
  const { GENERIC_RESULTS, MONSTER_RESULTS } = await import('./src/data/results.js');
  const { ITEMS } = await import('./src/data/items.js');

  // Shape contract: every non-string template carries text + a non-empty cats array of REAL
  // categories (a typo'd category would silently never fire — this is the guard that catches it).
  const realCats = new Set(Object.values(ITEMS).map((i) => i.category));
  const everyTemplate = [];
  for (const arr of Object.values(GENERIC_RESULTS)) everyTemplate.push(...arr);
  for (const tiers of Object.values(MONSTER_RESULTS))
    for (const arr of Object.values(tiers)) everyTemplate.push(...arr);
  // Four tag kinds since the cameo pass (2026-07-10): cats (item-aware), minServes (loyalty
  // ladder), greg (hire-gated staff voice), and dougOut (out-on-a-run cameos); any combination.
  const tagged = everyTemplate.filter((t) => typeof t !== 'string');
  ok(tagged.every((t) => typeof t.text === 'string'
       && (Array.isArray(t.cats) || Number.isInteger(t.minServes) || t.greg === true || t.dougOut === true)),
     'templates: every object template has text + at least one tag (cats | minServes | greg | dougOut)');
  const catTagged = tagged.filter((t) => t.cats !== undefined);
  ok(catTagged.length >= 12, `item-aware: cats-tagged templates exist (${catTagged.length})`);
  ok(catTagged.every((t) => Array.isArray(t.cats) && t.cats.length > 0
       && t.cats.every((c) => realCats.has(c))),
     'item-aware: every cats tag is real and non-empty');
  ok(catTagged.every((t) => t.text.includes('{item}')),
     'item-aware: only {item} templates carry cats (a cats tag on an item-less line is dead weight)');

  // Filtering, negative direction: a consumable serve can NEVER render a weapon-tagged line.
  // 400 draws of the hottest weapon-shaped text across tiers with tags.
  const weaponTexts = tagged.filter((t) => t.cats?.includes('weapon') && !t.cats?.includes('consumable'))
    .map((t) => t.text.replace('{name}', 'Skele').replace(/\{item\}/g, 'HP Flask'));
  let leaked = false;
  for (let i = 0; i < 400; i++) {
    for (const tier of ['excellent', 'success', 'partial', 'funnyFailure']) {
      const line = logLine('skeleton', tier, { name: 'Skele', item: 'HP Flask', itemId: 'hp_flask' });
      if (weaponTexts.includes(line.text)) leaked = true;
    }
  }
  ok(!leaked, 'item-aware: weapon-tagged lines never fill with a consumable (1600 draws)');

  // Filtering, positive direction: a weapon serve still reaches its weapon lines.
  let sawWeaponLine = false;
  for (let i = 0; i < 600 && !sawWeaponLine; i++) {
    const line = logLine('skeleton', 'excellent', { name: 'Skele', item: 'Club', itemId: 'club' });
    if (line.text.includes('swung the Club once')) sawWeaponLine = true;
  }
  ok(sawWeaponLine, 'item-aware: weapon serves still draw the weapon jokes (600 draws)');

  // No item in play (leave-shaped call): tagged templates are excluded entirely, so a tagged line
  // can never render with the 'something' fallback.
  let sawTaggedWithoutItem = false;
  const taggedRaw = tagged.map((t) => t.text);
  for (let i = 0; i < 400; i++) {
    const line = logLine('bat', 'funnyFailure', { name: 'Batty' });   // no itemId on purpose
    if (taggedRaw.some((raw) => line.text === raw.replace(/\{name\}/g, 'Batty').replace(/\{item\}/g, 'something'))) {
      sawTaggedWithoutItem = true;
    }
  }
  ok(!sawTaggedWithoutItem, 'item-aware: no itemId -> tagged templates never fire (400 draws)');
}

// 29. Content batch 1: nine rows on the scaffold — the A2/B2 payoffs, end to end ----------------
{
  const { ITEMS, ITEM_ORDER } = await import('./src/data/items.js');
  const { MONSTERS, MONSTER_IDS } = await import('./src/data/monsters.js');
  const { spawnCustomer } = await import('./src/game.js');
  const { mergeSave } = await import('./src/save.js');
  const { everythingTier } = await import('./src/data/milestones.js');
  const { CONFIG } = await import('./src/config.js');

  const batch = ['tattered_shirt', 'bandages', 'wooden_shield', 'rusty_key',
    'leather_bracer', 'murk_tonic', 'pickaxe', 'quiver', 'zip_tonic'];
  ok(batch.every((id) => ITEMS[id] !== undefined) && ITEM_ORDER.length >= 15,
     'batch 1: all nine rows exist (exact roster total is the NEWEST batch section\'s job)');
  const realCats = new Set(['weapon', 'armor', 'consumable']);
  ok(batch.every((id) => realCats.has(ITEMS[id].category)
       && ITEMS[id].basePrice > ITEMS[id].restockCost && Number.isFinite(ITEMS[id].combatEffect)),
     'batch 1: real categories, restock < price (margin invariant), finite eff');

  // Free-tier affordability INVARIANT, RE-SCOPED for budget-aware wants (2026-07-06): the old
  // form (every free price <= the minimum roll, i.e. strands NEVER happen) retired with the
  // soft bias — rare mismatches are now BY DESIGN, handled by the auto-wave. What must still
  // hold: every mob's floor affords AT LEAST ONE free-tier item, so the affordability bias
  // always has a target and no purse is unservable by construction.
  const minRoll = Math.min(...MONSTER_IDS.map((id) => MONSTERS[id].budgetRange[0]));
  const free = batch.filter((id) => !ITEMS[id].license);
  const cheapestFree = Math.min(...free.map((id) => ITEMS[id].basePrice));
  ok(free.length === 4 && cheapestFree <= minRoll,
     `batch 1: every purse has a free-tier target (cheapest free ${cheapestFree} <= min roll ${minRoll})`);

  // The license rung: five gated rows, valid tier indices, empty shelves until bought, and the
  // NEW Trusted rung actually exists below the old 800g Renowned tier.
  const lic = batch.filter((id) => ITEMS[id].license);
  ok(lic.length === 5 && lic.every((id) => {
    const l = ITEMS[id].license;
    return Number.isInteger(l.requiredTier) && l.requiredTier < CONFIG.reputation.tiers.length
      && l.cost > 0 && ITEMS[id].startStock === 0;
  }), 'batch 1: licensed five gated on real tiers and start empty');
  ok(lic.some((id) => ITEMS[id].license.requiredTier === 2)
     && lic.some((id) => ITEMS[id].license.requiredTier === 3),
     'batch 1: the Trusted AND Beloved license rungs opened');

  // B2 payoff, end to end: a pre-batch save (trio at 60 sales) keeps its earned everything tier
  // even though four new FREE items now sit in the laggard set at 0 sales. This exact scenario is
  // why the ratchet + pinned legacy basis exist.
  const legacy = { stats: { itemSales: { club: 60, metal_helmet: 60, hp_flask: 60 }, monsterServes: {} } };
  const m = mergeSave(createInitialState(), legacy);
  ok(everythingTier(m) === 1, 'batch 1 x B2: earned everything tier survives four new free items');

  // A2 payoff: new free items get WANTED with zero per-monster wiring...
  let sawNewFree = false;
  for (let i = 0; i < 600 && !sawNewFree; i++) {
    if (free.includes(spawnCustomer(shopState()).wantedItemId)) sawNewFree = true;
  }
  ok(sawNewFree, 'batch 1 x A2: new free items enter the want pool with no wiring (600 spawns)');
  // ...while locked rows stay invisible, then enter the pool once licensed.
  let lockedLeak = false;
  for (let i = 0; i < 400; i++) {
    if (lic.includes(spawnCustomer(shopState()).wantedItemId)) lockedLeak = true;
  }
  const open = shopState();
  for (const id of lic) open.licenses[id] = true;
  let sawLicensed = false;
  for (let i = 0; i < 800 && !sawLicensed; i++) {
    if (lic.includes(spawnCustomer(open).wantedItemId)) sawLicensed = true;
  }
  ok(!lockedLeak && sawLicensed, 'batch 1: license gate holds locked; licensed rows become wantable');
}

// 30. Content batch 2 — chain tops: the chain INVARIANT (top strictly beats base on eff + price) --
{
  const { ITEMS, ITEM_ORDER } = await import('./src/data/items.js');
  const { CONFIG } = await import('./src/config.js');
  ok(ITEM_ORDER.length >= 17 && ITEMS.iron_buckler && ITEMS.iron_gauntlet,
     'batch 2: both chain tops exist (exact total lives in the newest batch section)');
  // A chain is naming + pricing, NOT a mechanic — but the pricing RELATION is the content promise:
  // the top must strictly beat its base on combatEffect AND basePrice, be licensed, share category.
  const chains = [['iron_buckler', 'wooden_shield'], ['iron_gauntlet', 'leather_bracer']];
  ok(chains.every(([top, base]) =>
    ITEMS[top].combatEffect > ITEMS[base].combatEffect
    && ITEMS[top].basePrice > ITEMS[base].basePrice
    && ITEMS[top].category === ITEMS[base].category
    && ITEMS[top].license && ITEMS[top].startStock === 0
    && (!ITEMS[base].license || ITEMS[top].license.requiredTier > ITEMS[base].license.requiredTier)),
     'batch 2: chain invariant holds (top > base on eff + price, same category, gated later or from free)');
  ok(chains.every(([top]) => ITEMS[top].license.requiredTier < CONFIG.reputation.tiers.length
       && ITEMS[top].basePrice > ITEMS[top].restockCost),
     'batch 2: chain tops on real tiers with the margin invariant');
}

// 31. Line-unlock ladder + golden lines: loyalty pays out in comedy -----------------------------
{
  const { logLine } = await import('./src/messages.js');
  const { MONSTER_RESULTS } = await import('./src/data/results.js');
  const { MONSTERS: LADDER_MONSTERS, MONSTER_IDS } = await import('./src/data/monsters.js');
  const { MONSTER_BREAKPOINTS } = await import('./src/data/milestones.js');

  // Contract: every monster has a ladder (>=1 minServes line) AND exactly one golden line; goldens
  // sit at the 100-serve breakpoint (the memorable payoff Daniel asked for) and every minServes
  // value is a real loyalty breakpoint, so the Bestiary pips always mark real material.
  // SPECIAL rows (the Inspector) are exempt: once-a-day visitors can never climb serve ladders,
  // so their batches are deliberately FLAT — §54 pins that shape from the other side.
  for (const id of MONSTER_IDS.filter((mid) => !LADDER_MONSTERS[mid].special)) {
    const all = Object.values(MONSTER_RESULTS[id] ?? {}).flat().filter((t) => typeof t !== 'string');
    const laddered = all.filter((t) => Number.isInteger(t.minServes));
    const goldens = all.filter((t) => t.golden === true);
    ok(laddered.length >= 2, `${id}: has a line-unlock ladder (${laddered.length} gated lines)`);
    ok(goldens.length === 1 && goldens[0].minServes === 100,
       `${id}: exactly one golden line, gated at 100 serves`);
    ok(laddered.every((t) => MONSTER_BREAKPOINTS.includes(t.minServes)),
       `${id}: every minServes sits on a real loyalty breakpoint`);
  }

  // Gating, negative: a fresh monster (0 serves) can never draw a gated line — 600 draws across
  // the tiers that carry them.
  const gatedTexts = Object.values(MONSTER_RESULTS).flatMap((tiers) =>
    Object.values(tiers).flat().filter((t) => typeof t !== 'string' && Number.isInteger(t.minServes))
      .map((t) => t.text));
  let leak = false;
  for (let i = 0; i < 150; i++) {
    for (const tier of ['excellent', 'success', 'funnyFailure', 'dismiss']) {
      for (const id of MONSTER_IDS) {
        const line = logLine(id, tier, { name: 'X', item: 'Club', itemId: 'club', serves: 0 });
        if (gatedTexts.some((raw) => line.text === raw.replace(/\{name\}/g, 'X').replace(/\{item\}/g, 'Club'))) leak = true;
      }
    }
  }
  ok(!leak, 'ladder: 0 serves never draws a gated line (2400 draws)');

  // Gating, positive: at 100+ serves the golden line is reachable, and it comes back golden.
  let sawGolden = false;
  for (let i = 0; i < 800 && !sawGolden; i++) {
    const line = logLine('frog', 'excellent', { name: 'Froggo', item: 'Club', itemId: 'club', serves: 100 });
    if (line.golden === true && line.text.includes('five-star review')) sawGolden = true;
  }
  ok(sawGolden, 'ladder: at 100 serves the golden line fires, flagged golden (800 draws)');

  // Ungated lines are never golden-flagged.
  const plain = logLine('slime', 'leave', { name: 'Slimey', serves: 0 });
  ok(plain.golden === false && typeof plain.text === 'string',
     'return shape: { text, golden } with golden false on ungated pools');

  // Unlock announcement: crossing a breakpoint WITH a batch pushes the extra milestone line;
  // crossing one WITHOUT (250 — no batch authored there yet) does not.
  {
    const { CONFIG } = await import('./src/config.js');   // for the stagger beat below
    const s = shopState();
    s.stats.monsterServes.slime = 24;                // the 25th serve crosses the batch threshold
    s.queue = [customer('slime', 'club', 99)];
    serveCurrent(s);
    update(s, (CONFIG.log.milestoneSpacingSec ?? 2.5) + 0.01);   // stagger (2026-07-05): the second gold line lands one beat later
    ok(s.log.filter((e) => e.tier === 'milestone').length === 2,
       'unlock: crossing 25 announces the monster milestone AND the new-stories line');
  }
  {
    const s = shopState();
    s.stats.monsterServes.slime = 249;               // 250 is a breakpoint but carries NO batch
    s.queue = [customer('slime', 'club', 99)];
    serveCurrent(s);
    ok(s.log.filter((e) => e.tier === 'milestone').length === 1,
       'unlock: a batchless crossing announces the milestone only (registry-scanned, no false hype)');
  }
}

// 32. Bob's hire arc — the first-purchase beat: fresh-start gate + the funding invariant ---------
// The UX arc (drawBob hidden, goal chip) is render/DOM and lives in the browser test plan; what the
// suite pins is the DESIGN math underneath it: a fresh shop must start Bob unowned (the gate's
// input), the starting purse must NOT cover the hire (forcing >= 1 manual serve — the tutorial),
// and 1-2 worst-case manual serves must always close the gap (registry-derived, never hand-typed:
// worst case income per serve = the cheapest license-free, boot-stocked item's basePrice, since
// loyalty multipliers only ever raise a payout).
{
  const { CONFIG } = await import('./src/config.js');
  const { ITEMS } = await import('./src/data/items.js');
  const { workerHireCost } = await import('./src/data/workers.js');

  const s = createInitialState();
  ok(s.workers.mimic_merchant.owned === false,
     'hire arc: a fresh save starts Bob unowned (the hidden-until-hired gate reads this)');

  const hire = workerHireCost('mimic_merchant');
  ok(CONFIG.economy.startingGold < hire,
     `hire arc: starting gold (${CONFIG.economy.startingGold}) cannot buy Bob outright (${hire}) — the first serve is mandatory`);

  const minServeIncome = Math.min(...Object.values(ITEMS)
    .filter((it) => !it.license && it.startStock > 0)
    .map((it) => it.basePrice));
  ok(CONFIG.economy.startingGold + 2 * minServeIncome >= hire,
     `hire arc: two worst-case serves fund the hire (${CONFIG.economy.startingGold} + 2x${minServeIncome} >= ${hire})`);
}

// 33. Fame track (UX roadmap 2): registry-scanned nodes + the HUD remainder math ----------------
// RULE TESTS throughout — every expectation derives from the LIVE registries and the live tier
// ladder (the batch-1 doctrine: never hand-type a roster-dependent number). The DOM presentation
// is browser test-plan territory; what's pinned here is the scan's auto-flow contract: everything
// tier-gated appears on the track, exactly once, on ITS tier's node.
{
  const { trackByTier, nextTierInfo } = await import('./src/data/fametrack.js');
  const { CONFIG } = await import('./src/config.js');
  const { ITEMS } = await import('./src/data/items.js');
  const { UPGRADES, UPGRADE_ORDER } = await import('./src/data/upgrades.js');
  const { PERKS, PERK_ORDER } = await import('./src/data/perks.js');

  const nodes = trackByTier();
  ok(nodes.length === CONFIG.reputation.tiers.length, 'fame track: one node per live tier');
  ok(nodes.every((n, i) => n.label === CONFIG.reputation.tiers[i].label
                        && n.min   === CONFIG.reputation.tiers[i].min),
     'fame track: node labels + thresholds mirror the tier ladder, ascending');

  // Auto-flow, counted: nothing lost, nothing doubled.
  const licensed = Object.values(ITEMS).filter((it) => it.license);
  const { WORKERS: TRACK_WORKERS } = await import('./src/data/workers.js');
  const gatedWorkers = Object.values(TRACK_WORKERS).filter((w) => w.requiredTier !== undefined);
  // Deep Sinks (2026-07-07): deep-training bands are a NEW chip source — a worker with a levels
  // block carrying deepTier lists one chip on its gate's node. Derived like every other term.
  const deepBands = Object.values(TRACK_WORKERS).filter((w) => w.levels?.deepTier !== undefined);
  const budgetLines = nodes.reduce((a, n) => a + n.unlocks.filter((u) => u.kind === 'budget').length, 0);
  const total = nodes.reduce((a, n) => a + n.unlocks.length, 0);
  ok(total === UPGRADE_ORDER.length + PERK_ORDER.length + licensed.length + gatedWorkers.length
       + deepBands.length + budgetLines,
     'fame track: unlock count = upgrades + perks + licenses + gated hires + deep bands + budget lines');
  ok(gatedWorkers.every((w) => nodes[w.requiredTier].unlocks
       .some((u) => u.kind === 'worker' && u.label === w.displayName)),
     'fame track: every tier-gated worker sits on its requiredTier node (ungated staff stay off)');

  // Auto-flow, placed: each gated thing sits on ITS requiredTier node (a new registry row with a
  // requiredTier lands on the track with zero wiring — the panel's whole promise).
  ok(licensed.every((it) => nodes[it.license.requiredTier].unlocks
       .some((u) => u.kind === 'license' && u.label === it.displayName)),
     'fame track: every license sits on its requiredTier node');
  ok(UPGRADE_ORDER.every((id) => nodes[UPGRADES[id].requiredTier].unlocks
       .some((u) => u.kind === 'upgrade' && u.label === UPGRADES[id].displayName)),
     'fame track: every upgrade sits on its requiredTier node');
  ok(PERK_ORDER.every((id) => nodes[PERKS[id].requiredTier].unlocks
       .some((u) => u.kind === 'perk' && u.label === PERKS[id].displayName)),
     'fame track: every perk sits on its requiredTier node');

  // Budget lines mirror spawnCustomer's dial exactly: tiers ABOVE Beloved (index 3), only while
  // the CONFIG dial is non-zero.
  ok(nodes.every((n) => n.unlocks.some((u) => u.kind === 'budget')
                     === (n.index > 3 && (CONFIG.fame?.budgetPerTierAboveBeloved ?? 0) > 0)),
     'fame track: budget lines exactly on tiers above Beloved');

  // The remainder ("· 32♛ to Trusted" was the design example): pure math on the lifetime number.
  ok(nextTierInfo(0)?.label === CONFIG.reputation.tiers[1].label,
     'remainder: at fame 0 the next tier is tier 1');
  const t2 = CONFIG.reputation.tiers[2];
  const r = nextTierInfo(t2.min - 32);
  ok(r?.label === t2.label && r?.remaining === 32,
     `remainder: 32 short of ${t2.label} reads exactly 32`);
  ok(nextTierInfo(CONFIG.reputation.tiers.at(-1).min) === null,
     'remainder: at the top of the ladder there is no next tier');
}

// 34. License alerts via Bob's bubble (UX roadmap 3): crossing detection + queue + reminder ------
// The bubble's DRAW (anchored at Bob, ownership-gated) is browser test-plan territory; what's
// pinned here is the game-side contract: a fame-tier crossing that brings NEW licenses logs the
// permanent milestone line and queues one announcement per license; the trigger is ELIGIBILITY,
// never gold; update() runs the 6s/30s dials; and none of it serializes.
{
  const { eligibleUnboughtLicenses } = await import('./src/game.js');
  const { CONFIG } = await import('./src/config.js');
  const { ITEMS } = await import('./src/data/items.js');
  const { LICENSE_BUBBLE_LINES } = await import('./src/data/milestones.js');

  // Live-registry fixtures: the licenses gated at tier 2 (Trusted) and the tier-2 threshold.
  const t2 = CONFIG.reputation.tiers[2];
  const tier2Licenses = Object.values(ITEMS).filter((it) => it.license?.requiredTier === 2);
  ok(tier2Licenses.length > 0, 'license alerts: the registry has tier-2 licenses to announce (fixture sanity)');

  // A serve that CROSSES into Trusted: milestone 'fame' line + one bubble entry per new license —
  // at ZERO gold (eligibility, never affordability).
  {
    const s = shopState();
    s.gold = 0;
    s.reputation = t2.min - 1; s.lifetimeRep = t2.min - 1;      // 1 rep short of the crossing
    s.queue = [customer('skeleton', 'club', 99)];
    serveCurrent(s);                                            // perSale rep >= 1 -> crossing
    ok(s.log.some((e) => e.tier === 'milestone' && tier2Licenses.every((it) => e.text.includes(it.displayName))),
       'crossing: the permanent fame line names every newly eligible license, at 0 gold');
    ok(s.bobSpeech?.queue?.length === tier2Licenses.length,
       'crossing: one bubble announcement queued per newly eligible license');
    // The queue drains on the announce dial: first promote, then expire, then promote the next.
    update(s, 0.001);
    ok(s.bobSpeech.current !== null && s.bobSpeech.queue.length === tier2Licenses.length - 1,
       'ticking: update() promotes the first announcement into the bubble');
    const held = s.bobSpeech.current.text;
    update(s, (CONFIG.licenseAlerts.announceSec ?? 6) + 0.01);
    ok(s.bobSpeech.current !== null && s.bobSpeech.current.text !== held,
       'ticking: after announceSec the next queued announcement takes over');
  }

  // No-false-hype: crossing into Friendly (tier 1 — no licenses there) announces nothing.
  {
    const s = shopState();
    const t1 = CONFIG.reputation.tiers[1];
    s.reputation = t1.min - 1; s.lifetimeRep = t1.min - 1;
    s.queue = [customer('slime', 'club', 99)];
    serveCurrent(s);
    ok(!s.log.some((e) => e.tier === 'milestone') && !s.bobSpeech,
       'crossing: a tier with no new licenses stays silent (no line, no bubble)');
  }

  // Already-owned licenses never re-announce: own one tier-2 license, cross into Trusted.
  {
    const s = shopState();
    const owned = tier2Licenses[0].id;
    s.licenses[owned] = true;
    s.reputation = t2.min - 1; s.lifetimeRep = t2.min - 1;
    s.queue = [customer('skeleton', 'club', 99)];
    serveCurrent(s);
    ok(s.bobSpeech?.queue?.length === tier2Licenses.length - 1
       && s.log.some((e) => e.tier === 'milestone' && !e.text.includes(ITEMS[owned].displayName)),
       'crossing: an already-owned license is excluded from line and bubble');
  }

  // Eligibility helper: registry-scanned, gold-blind.
  {
    const s = shopState();
    s.gold = 0;
    s.lifetimeRep = t2.min;                                     // Trusted, flat broke
    const elig = eligibleUnboughtLicenses(s);
    ok(elig.length === tier2Licenses.length
       && elig.every((id) => ITEMS[id].license.requiredTier <= 2),
       'eligibility: all tier-2 licenses eligible at Trusted with 0 gold, higher tiers excluded');
  }

  // The recurring reminder: at Trusted with unbought licenses, the 30s dial raises a reminder line
  // in an idle bubble; with everything bought, it stays quiet.
  {
    const s = shopState();
    s.lifetimeRep = t2.min;
    s.queue = [];                                               // idle shop; no announcements queued
    update(s, (CONFIG.licenseAlerts.reminderSec ?? 30) + 0.01);
    const reminders = LICENSE_BUBBLE_LINES.reminder.map((t) => t.split('{item}'));
    ok(s.bobSpeech?.current
       && reminders.some((parts) => parts.every((p) => s.bobSpeech.current.text.includes(p))),
       'reminder: after reminderSec an idle bubble nags about an unbought eligible license');
  }
  {
    const s = shopState();
    s.lifetimeRep = t2.min;
    for (const it of Object.values(ITEMS)) if (it.license) s.licenses[it.id] = true;
    s.queue = [];
    update(s, (CONFIG.licenseAlerts.reminderSec ?? 30) + 0.01);
    ok(!s.bobSpeech?.current, 'reminder: with every eligible license bought, the dial stays quiet');
  }

  // Transience: neither the speech queue nor the reminder timer survives a save round-trip.
  {
    const s = shopState();
    s.bobSpeech = { queue: ['x'], current: { text: 'y', remaining: 3 } };
    s.licenseReminderIn = 7;
    const data = serializeSave(s);
    ok(!('bobSpeech' in data) && !('licenseReminderIn' in data),
       'transience: bobSpeech and the reminder timer are never serialized');
  }
}

// 35. Bob's bubble, DOM/clickable variant (Daniel's pick over the canvas draw): the game-side
// contract the DOM depends on — every speech entry carries the license itemId it should route to,
// and every bubble transition marks uiDirty (the DOM only updates on dirty renders, so a missed
// flag means a bubble that lingers or never shows).
{
  const { CONFIG } = await import('./src/config.js');
  const { ITEMS } = await import('./src/data/items.js');
  const t2 = CONFIG.reputation.tiers[2];
  const tier2Ids = Object.keys(ITEMS).filter((id) => ITEMS[id].license?.requiredTier === 2);

  // Crossing announcements carry their license ids, registry order.
  const s = shopState();
  s.reputation = t2.min - 1; s.lifetimeRep = t2.min - 1;
  s.queue = [customer('skeleton', 'club', 99)];
  serveCurrent(s);
  ok(s.bobSpeech.queue.every((e, i) => e.itemId === tier2Ids[i]),
     'click route: each queued announcement carries its license itemId, registry order');

  // Promotion marks uiDirty and surfaces the id.
  s.uiDirty = false;
  update(s, 0.001);
  ok(s.uiDirty === true && s.bobSpeech.current.itemId === tier2Ids[0],
     'click route: promotion sets uiDirty and the current entry keeps its itemId');

  // Expiry (with an empty queue) marks uiDirty too — the DOM must hide the bubble.
  s.bobSpeech.queue = [];
  s.uiDirty = false;
  update(s, (CONFIG.licenseAlerts.announceSec ?? 6) + 0.01);
  ok(s.uiDirty === true && s.bobSpeech.current === null,
     'click route: expiry clears the bubble and sets uiDirty');

  // The reminder carries the FIRST unbought eligible license as its target.
  const s2 = shopState();
  s2.lifetimeRep = t2.min; s2.queue = [];
  update(s2, (CONFIG.licenseAlerts.reminderSec ?? 30) + 0.01);
  ok(s2.bobSpeech?.current?.itemId === tier2Ids[0],
     'click route: the reminder targets the first unbought eligible license');
}

// 36. The Restocker (UX roadmap 4): trickle contract + target priority + role isolation ---------
// The chip and flyer are browser test-plan territory; pinned here: trickleTarget's priority rules,
// the paid-trickle economics (a worker restock spends gold like a click does), role isolation
// (serveSpeed never touches the restock pace; the serve branch is untouched), and save/migration.
{
  const { trickleTarget, hireWorker, effectiveWorkerInterval } = await import('./src/game.js');
  const { WORKERS } = await import('./src/data/workers.js');
  const { ITEMS, ITEM_ORDER } = await import('./src/data/items.js');

  const hired = () => { const s = shopState(); s.workers.restocker.owned = true;
                        s.workers.restocker.timer = 0.5; s.queue = []; return s; };
  const iv = WORKERS.restocker.baseInterval;

  // Priority 1: the front customer's OUT want wins, even over emptier items.
  {
    const s = hired(); s.gold = 999;
    const [a, b] = ITEM_ORDER.filter((id) => !ITEMS[id].license);   // two boot-unlocked items
    s.items[a].stock = 0;
    s.items[b].stock = 0;
    s.queue = [customer('slime', b, 99)];                           // front wants b; a is also out
    ok(trickleTarget(s) === b, 'trickle: the front customer\u2019s out-of-stock want outranks registry order');
  }
  // Priority 2: no blocked front -> most-starved by stock-to-cap ratio.
  {
    const s = hired(); s.gold = 999;
    const [a, b] = ITEM_ORDER.filter((id) => !ITEMS[id].license);
    for (const id of Object.keys(s.items)) s.items[id].stock = Math.max(1, s.items[id].stock);
    s.items[a].stock = 1; s.items[b].stock = 0;                     // b is the starved one
    ok(trickleTarget(s) === b, 'trickle: with no blocked front, the lowest stock-to-cap item wins');
  }
  // Broke -> null (a worker restock is PAID; it can never overdraft).
  {
    const s = hired(); s.gold = 0;
    s.items[ITEM_ORDER[0]].stock = 0;
    ok(trickleTarget(s) === null, 'trickle: a broke shop has no target (paid restocks only)');
  }
  // The tick: after baseInterval, one unit lands and the restock cost leaves the purse.
  {
    const s = hired(); s.gold = 999;
    const [a] = ITEM_ORDER.filter((id) => !ITEMS[id].license);
    for (const id of Object.keys(s.items)) s.items[id].stock = 5;
    s.items[a].stock = 0;
    const goldBefore = s.gold;
    update(s, iv + 0.01);
    ok(s.items[a].stock === 1 && s.gold === goldBefore - ITEMS[a].restockCost,
       'trickle tick: one unit restocked, normal cost paid');
  }
  // Full shelf -> nothing happens, and the worker idles on the 1s recheck (no thrash, no spend).
  {
    const s = hired(); s.gold = 999;
    for (const id of Object.keys(s.items)) s.items[id].stock = 99;  // above any cap
    const goldBefore = s.gold;
    update(s, iv + 0.01);
    ok(s.gold === goldBefore && s.workers.restocker.timer > 0,
       'trickle tick: a full shelf spends nothing and re-checks on a timer');
  }
  // Role isolation: serveSpeed upgrades never speed the restocker.
  {
    const s = shopState();
    s.upgrades.faster_counter = 99;                                 // absurd serveSpeed stack
    ok(effectiveWorkerInterval(s, 'restocker') === iv,
       'role isolation: serveSpeed leaves the restock interval untouched');
    ok(effectiveWorkerInterval(s, 'mimic_merchant') < WORKERS.mimic_merchant.baseInterval,
       'role isolation: the same upgrades DO speed the serve worker');
  }
  // Hire + the fame gate + persistence + migration: the registry row auto-flows end to end.
  {
    const { CONFIG } = await import('./src/config.js');
    const trustedMin = CONFIG.reputation.tiers[WORKERS.restocker.requiredTier].min;
    const s = shopState(); s.gold = WORKERS.restocker.hireCost;
    ok(!hireWorker(s, 'restocker'),
       'fame gate: full purse below the tier cannot hire Greg (gold is not the gate)');
    s.lifetimeRep = trustedMin;                                     // reach the tier — wallet untouched
    ok(hireWorker(s, 'restocker') && s.workers.restocker.owned === true && s.gold === 0,
       'hire: at the tier, Greg hires at exactly hireCost through the generic path');
    const restored = mergeSave(createInitialState(), serializeSave(s));
    ok(restored.workers.restocker.owned === true, 'save: restocker ownership round-trips');
    const legacy = mergeSave(createInitialState(), { workers: { mimic_merchant: { owned: true } } });
    ok(legacy.workers.restocker.owned === false,
       'migration: a pre-Restocker save seeds the new row unowned');
  }
}

// 37. Greg's errand + bubble duty cycle (Option 1, 2026-07-05): the game-side contract -----------
// The flight path itself is render-only (main.js consumes gregRestocked -> playGregErrand; browser
// test plan). Pinned here: the trickle raises the errand signal; the bubble runs its duty cycle
// (pops for showSec once per cycleSec) and stays silent when unowned / nothing out; transience.
{
  const { CONFIG } = await import('./src/config.js');
  const { ITEMS, ITEM_ORDER } = await import('./src/data/items.js');
  const { WORKERS } = await import('./src/data/workers.js');
  const cycle = CONFIG.gregBubble.cycleSec, show = CONFIG.gregBubble.showSec;
  const boot = (owned, out) => {
    const s = shopState(); s.gold = 999; s.queue = [];
    s.workers.restocker.owned = owned;
    s.workers.restocker.timer = 1e9;                            // park the trickle; test the cycle alone
    if (out) s.items[ITEM_ORDER.find((id) => !ITEMS[id].license)].stock = 0;
    return s;
  };

  // The cycle raises a report, holds it showSec, and re-raises next cycle while still out.
  {
    const s = boot(true, true);
    update(s, cycle + 0.01);
    ok(s.gregBubble.showFor > 0, 'duty cycle: with Greg hired and an item out, the cycle raises a report');
    s.uiDirty = false;
    update(s, show + 0.01);
    ok(s.gregBubble.showFor === 0 && s.uiDirty === true,
       'duty cycle: the report retires after showSec and marks uiDirty for the DOM');
    update(s, cycle + 0.01);
    ok(s.gregBubble.showFor > 0, 'duty cycle: still out next cycle -> it re-raises (a way, not the way)');
  }
  // Gates: unhired Greg never reports; a stocked shelf never reports.
  {
    const s = boot(false, true);
    update(s, cycle * 2 + 0.1);
    ok((s.gregBubble?.showFor ?? 0) === 0, 'duty cycle: no Greg, no report');
  }
  {
    const s = boot(true, false);
    update(s, cycle * 2 + 0.1);
    ok((s.gregBubble?.showFor ?? 0) === 0, 'duty cycle: fully stocked, no report');
  }
  // The errand signal: a successful trickle raises gregRestocked for main.js to consume.
  {
    const s = boot(true, true);
    s.workers.restocker.timer = 0.5;
    update(s, WORKERS.restocker.baseInterval + 0.01);
    ok(s.gregRestocked === true, 'errand: a landed trickle raises the render signal');
  }
  // Transience: neither the cycle nor the signal survives a save round-trip.
  {
    const s = boot(true, true);
    s.gregRestocked = true;
    update(s, cycle + 0.01);
    const data = serializeSave(s);
    ok(!('gregBubble' in data) && !('gregRestocked' in data),
       'transience: gregBubble and gregRestocked are never serialized');
  }
}

// 38. Greg's Fame perks (Pass B Option 2, 2026-07-05): Swift Wings + Bulk Satchel ---------------
// Both rows already auto-flowed onto the perks panel and the fame track (section 33's totals
// derive from PERK_ORDER — they absorbed the rows with zero edits). Pinned here: the interval
// math, the satchel's per-unit economics (re-target, per-unit pay, cap and purse respected), and
// effect scoping (trickleSpeed never touches Bob).
{
  const { PERKS } = await import('./src/data/perks.js');
  const { WORKERS } = await import('./src/data/workers.js');
  const { effectiveWorkerInterval } = await import('./src/game.js');
  const { ITEMS, ITEM_ORDER } = await import('./src/data/items.js');
  const iv = WORKERS.restocker.baseInterval;
  const per = PERKS.swift_wings.effect.perLevel;
  const hired = () => { const s = shopState(); s.workers.restocker.owned = true;
                        s.workers.restocker.timer = 0.5; s.queue = []; s.gold = 999; return s; };

  // Swift Wings: the divisor form, per level, restock-scoped.
  {
    const s = hired();
    s.perks.swift_wings = 2;
    ok(Math.abs(effectiveWorkerInterval(s, 'restocker') - iv / (1 + per * 2)) < 1e-9,
       'swift wings: interval = base / (1 + perLevel x level)');
    ok(effectiveWorkerInterval(s, 'mimic_merchant') === WORKERS.mimic_merchant.baseInterval,
       'swift wings: trickleSpeed never touches the serve worker');
  }
  // Bulk Satchel: two units, two payments, one errand signal.
  {
    const s = hired();
    s.perks.bulk_satchel = 1;
    const [a] = ITEM_ORDER.filter((id) => !ITEMS[id].license);
    for (const id of Object.keys(s.items)) s.items[id].stock = 99;
    s.items[a].stock = 0;
    const goldBefore = s.gold;
    update(s, iv + 0.01);
    ok(s.items[a].stock === 2 && s.gold === goldBefore - 2 * ITEMS[a].restockCost,
       'bulk satchel: one run lands 2 units and pays for both');
    ok(s.gregRestocked === true, 'bulk satchel: one errand signal per run, not per unit');
  }
  // Per-unit purse: gold for exactly one unit buys exactly one.
  {
    const s = hired();
    s.perks.bulk_satchel = 1;
    const [a] = ITEM_ORDER.filter((id) => !ITEMS[id].license);
    for (const id of Object.keys(s.items)) s.items[id].stock = 99;
    s.items[a].stock = 0;
    s.gold = ITEMS[a].restockCost;                              // one unit's worth, exactly
    update(s, iv + 0.01);
    ok(s.items[a].stock === 1 && s.gold === 0,
       'bulk satchel: a one-unit purse lands one unit — never an overdraft');
  }
  // Per-unit re-target: the second unit follows the priority rules afresh.
  {
    const s = hired();
    s.perks.bulk_satchel = 1;
    const [a, b] = ITEM_ORDER.filter((id) => !ITEMS[id].license);
    for (const id of Object.keys(s.items)) s.items[id].stock = 99;
    s.items[a].stock = 0; s.items[b].stock = 0;                 // two starved items
    update(s, iv + 0.01);
    ok(s.items[a].stock === 1 && s.items[b].stock === 1,
       'bulk satchel: units re-target — two starved items get one each, not one item both');
  }
}

// 39. Greg offline (review Option 2, 2026-07-05): bounded refills into the existing reserve ------
// The decision under test: a hired restock-worker grants +1 full shelf-refill per item for the
// absence (+1 more with Bulk Satchel), through the SAME margin-paying reserve mechanism as
// Backroom Storage — deliberately bounded, never time-derived, so the model's safety property
// (stock binds long before time) survives. Exact math on the trio fixture, all registry-derived.
{
  const { computeOffline } = await import('./src/offline.js');
  const { ITEMS } = await import('./src/data/items.js');
  const { effectiveMaxStock } = await import('./src/game.js');
  const HOUR = 3600 * 1000;
  const now = Date.now();
  const trioBoot = (greg, satchel) => {
    const s = createInitialState();
    s.workers.mimic_merchant.owned = true;
    s.workers.restocker.owned = greg;
    if (satchel) s.perks.bulk_satchel = 1;
    pinTrioShelf(s);
    s.lastSeen = now - HOUR;                       // time is ample; stock/reserve is the binder
    return s;
  };
  const base = computeOffline(trioBoot(false, false), now);     // Bob alone: the 9-unit shelf
  // Refill math derives over EVERY unlocked item — the reserve tops the whole license-free roster
  // (pinTrioShelf zeroes other stocks but doesn't lock anything), exactly like Backroom Storage.
  const unlockedIds = (s) => Object.keys(ITEMS).filter((id) => !ITEMS[id].license || s.licenses?.[id] === true);
  const refillUnits = (s) => unlockedIds(s).reduce((a, id) => a + effectiveMaxStock(s, id), 0);
  const refillMargin = (s) => unlockedIds(s).reduce((a, id) =>
    a + effectiveMaxStock(s, id) * (ITEMS[id].basePrice - ITEMS[id].restockCost), 0);
  // Greg owned: exactly one full refill set on top — units and margin both registry-derived.
  {
    const s = trioBoot(true, false);
    const r = computeOffline(s, now);
    ok(r.sales === base.sales + refillUnits(s),
       'greg offline: +1 refill per item — sales grow by exactly one full shelf set');
    ok(r.gold === base.gold + refillMargin(s),
       'greg offline: refill units pay basePrice minus restockCost (the reserve margin math)');
    ok(r.gregRefills === 1, 'greg offline: the result reports his refill count for the modal');
  }
  // Bulk Satchel doubles the bonus — but only WITH Greg (a perk without its fetcher fetches nothing).
  {
    const s = trioBoot(true, true);
    const r = computeOffline(s, now);
    ok(r.sales === base.sales + 2 * refillUnits(s) && r.gregRefills === 2,
       'greg offline: Bulk Satchel grants the second refill set');
  }
  {
    const s = trioBoot(false, true);
    const r = computeOffline(s, now);
    ok(r.sales === base.sales && r.gregRefills === 0,
       'greg offline: the satchel perk alone (no Greg) changes nothing');
  }
  // Determinism holds on the new path: recompute is identical (nothing to farm by reloading).
  {
    const s = trioBoot(true, true);
    const r1 = computeOffline(s, now), r2 = computeOffline(s, now);
    ok(r1.sales === r2.sales && r1.gold === r2.gold && r1.reserveUsed === r2.reserveUsed,
       'greg offline: recompute is deterministic');
  }
}

// 40. Line batch @50 (2026-07-05): the second rung of the unlock ladder --------------------------
// Batch-N doctrine: EXACT totals live here, in the NEWEST batch's section (older sections derive).
// This batch: 3 gated lines per monster (12 total) at minServes 50 — pebble and femur escalations,
// the kid-with-the-sword seed — plus the coupon's ungated rule-of-three closer in generic leave.
{
  const { logLine } = await import('./src/messages.js');
  const { GENERIC_RESULTS, MONSTER_RESULTS } = await import('./src/data/results.js');
  const { MONSTER_IDS } = await import('./src/data/monsters.js');

  const { MONSTERS: B50 } = await import('./src/data/monsters.js');
  const grid50 = MONSTER_IDS.filter((id) => !B50[id].special);   // specials ship flat batches (§54)
  const at50 = (id) => Object.values(MONSTER_RESULTS[id] ?? {}).flat()
    .filter((t) => typeof t !== 'string' && t.minServes === 50);
  ok(grid50.every((id) => at50(id).length === 3)
     && grid50.reduce((a, id) => a + at50(id).length, 0) === grid50.length * 3,
     'batch @50: exactly 3 gated lines per monster, 12 total');
  ok(grid50.flatMap(at50).every((t) => t.text.length <= 80 && t.golden !== true),
     'batch @50: every line respects the 80-char log budget; goldens stay a 100-serve privilege');

  // Gating both ways, sampled: 49 serves never draws an @50 line; 50 reaches one (per monster).
  const texts50 = new Set(grid50.flatMap(at50).map((t) => t.text));
  const fills = (raw) => raw.replace(/\{name\}/g, 'X').replace(/\{item\}/g, 'Club');
  let leak = false;
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    for (const id of MONSTER_IDS) {
      for (const tier of ['excellent', 'success', 'partial', 'funnyFailure', 'leave', 'dismiss']) {
        const low = logLine(id, tier, { name: 'X', item: 'Club', itemId: 'club', serves: 49 });
        if ([...texts50].some((raw) => low.text === fills(raw))) leak = true;
        const hi = logLine(id, tier, { name: 'X', item: 'Club', itemId: 'club', serves: 50 });
        const hit = [...texts50].find((raw) => hi.text === fills(raw));
        if (hit) seen.add(id);
      }
    }
  }
  ok(!leak, 'batch @50: 49 serves never draws a gated-50 line (9600 draws)');
  ok(grid50.every((id) => seen.has(id)),
     'batch @50: at 50 serves every non-special monster can reach its new material');

  // The 50 crossing now announces (the registry scan sees a real batch there — no false hype).
  {
    const { CONFIG } = await import('./src/config.js');   // for the stagger beat below
    const s = shopState();
    s.stats.monsterServes.slime = 49;
    s.queue = [customer('slime', 'club', 99)];
    serveCurrent(s);
    update(s, (CONFIG.log.milestoneSpacingSec ?? 2.5) + 0.01);   // stagger (2026-07-05): the second gold line lands one beat later
    ok(s.log.filter((e) => e.tier === 'milestone').length === 2,
       'batch @50: crossing 50 announces the monster milestone AND the new-stories line');
  }
  // The coupon's third appearance: closed out in generic leave (rule of three, new tier).
  ok(GENERIC_RESULTS.leave.some((t) => (typeof t === 'string' ? t : t.text).includes('coupon')),
     'batch @50: the coupon gag has its leave-tier closer');
}

// 41. Greg's voice (Option 2, 2026-07-05): hire-gated staff lines + the hire beat ----------------
// The newest voice batch owns its exact totals: 3 greg-tagged dismiss + 2 leave (generic pools),
// 2 hire log lines + 3 bubble quips. Pinned: the gate both ways (his lines literally don't exist
// pre-hire), the gold hire line, the quip's one-window lifecycle, and char budgets.
{
  const { logLine } = await import('./src/messages.js');
  const { GENERIC_RESULTS, WORKER_HIRE_LINES } = await import('./src/data/results.js');
  const { WORKERS } = await import('./src/data/workers.js');
  const { CONFIG } = await import('./src/config.js');
  const { hireWorker } = await import('./src/game.js');

  const gregOf = (arr) => arr.filter((t) => typeof t !== 'string' && t.greg === true);
  const gregDismiss = gregOf(GENERIC_RESULTS.dismiss), gregLeave = gregOf(GENERIC_RESULTS.leave);
  ok(gregDismiss.length === 3 && gregLeave.length === 2,
     'greg voice: 3 dismiss shoos + 2 leave remarks (exact totals, newest batch section)');
  ok(gregDismiss.concat(gregLeave).every((t) => t.text.length <= 80)
     && WORKER_HIRE_LINES.restocker.log.every((t) => t.length <= 80)
     && WORKER_HIRE_LINES.restocker.bubble.every((t) => t.length <= 40),
     'greg voice: log lines fit the 80-char budget, bubble quips the ~40-char bubble');

  // The gate, both ways: unhired never draws his lines; hired can reach them.
  const gregTexts = new Set(gregDismiss.concat(gregLeave).map((t) => t.text));
  const fills = (raw) => raw.replace(/\{name\}/g, 'X').replace(/\{item\}/g, 'Club');
  let leak = false, reached = false;
  for (let i = 0; i < 300; i++) {
    for (const tier of ['dismiss', 'leave']) {
      const off = logLine('slime', tier, { name: 'X', item: 'Club', itemId: 'club', gregHired: false });
      if ([...gregTexts].some((raw) => off.text === fills(raw))) leak = true;
      const on = logLine('slime', tier, { name: 'X', item: 'Club', itemId: 'club', gregHired: true });
      if ([...gregTexts].some((raw) => on.text === fills(raw))) reached = true;
    }
  }
  ok(!leak, 'greg voice: unhired, his lines never fire (1200 draws)');
  ok(reached, 'greg voice: hired, his lines are reachable');

  // The hire beat: a gold milestone log line from the pool + the bubble quip for one window.
  {
    const s = shopState();
    s.lifetimeRep = CONFIG.reputation.tiers[WORKERS.restocker.requiredTier].min;
    s.gold = WORKERS.restocker.hireCost;
    ok(hireWorker(s, 'restocker'), 'greg voice: hire fixture sanity');
    ok(s.log.some((e) => e.tier === 'milestone'
         && WORKER_HIRE_LINES.restocker.log.includes(e.text)),
       'greg voice: hiring logs a GOLD intro line from the authored pool');
    ok(WORKER_HIRE_LINES.restocker.bubble.includes(s.gregBubble?.quip)
         && s.gregBubble.showFor === (CONFIG.gregBubble?.showSec ?? 10),
       'greg voice: the bubble quip is set for exactly one showFor window');
    update(s, (CONFIG.gregBubble?.showSec ?? 10) + 0.01);
    ok(s.gregBubble.quip === null && s.gregBubble.showFor === 0,
       'greg voice: the quip clears when its window expires — a one-time beat');
  }
}

// 42. Line hygiene rules (revision pass, 2026-07-05): attribution + roster-safe verbs -----------
// Two rules born from Daniel's audit, pinned so they hold for every FUTURE batch:
// (a) No second-person in pool templates — shop-side actors are Bob or Greg now (the "you" era
//     predates the hire arc). Whitelisted: the "you'd" idiom (audience figure of speech, not an
//     actor). Greg's bubble quip "You sell" is in-fiction dialogue and lives outside the pools.
// (b) Consumable-tagged lines must work for the WHOLE consumable roster — the Rusty Key is
//     category 'consumable' (single-use; the shelf has three buckets), so liquid-only verbs
//     (drank/chugged/sipped/gulped, plus pour/spill verbs) are banned in tagged texts; swallow-verbs are the register.
{
  const { GENERIC_RESULTS, MONSTER_RESULTS } = await import('./src/data/results.js');
  const all = [];
  for (const arr of Object.values(GENERIC_RESULTS)) all.push(...arr);
  for (const tiers of Object.values(MONSTER_RESULTS)) for (const arr of Object.values(tiers)) all.push(...arr);
  const texts = all.map((t) => (typeof t === 'string' ? t : t.text));

  const secondPerson = texts.filter((t) => /\byou\b/i.test(t.replace(/you'd/gi, '')));
  ok(secondPerson.length === 0,
     `hygiene: no second-person outside the you'd idiom (found ${secondPerson.length})`);

  const tagged = all.filter((t) => typeof t !== 'string' && t.cats?.includes('consumable'));
  ok(tagged.every((t) => !/\b(drank|drink|chug|chugged|sipped|gulped|spill|spilled|pour|poured|splash|splashed)\b/i.test(t.text)),
     'hygiene: consumable-tagged lines carry no drink OR pour/spill verbs (keys/maps are consumables too)');
}

// 43. Milestone stagger (Daniel's pick, 2026-07-05): gold lines land as BEATS ---------------------
// One serve can earn several milestone lines; simultaneous gold reads as a blob. Contract: the
// first delivers instantly; the rest queue and release FIFO every milestoneSpacingSec; only
// milestone-tier lines participate (battle/dismiss lines bypass, even mid-cooldown); transience.
{
  const { CONFIG } = await import('./src/config.js');
  const { dismissCurrent } = await import('./src/game.js');
  const gap = (CONFIG.log.milestoneSpacingSec ?? 2.5) + 0.01;

  // A triple stack drains FIFO, one per beat, with uiDirty on each release.
  {
    const s = shopState();
    const laggard = { text: 'gold-A', repDelta: 0, tier: 'milestone' };
    // Drive three golds through the real chokepoint via a crossing that stacks two, plus a
    // synthetic third: 25-crossing (monster milestone + stories) then a hand-pushed entry.
    s.stats.monsterServes.slime = 24;
    s.queue = [customer('slime', 'club', 99)];
    serveCurrent(s);                                    // gold #1 instant, #2 queued
    ok(s.log.filter((e) => e.tier === 'milestone').length === 1 && s.milestoneQueue.length === 1,
       'stagger: first gold instant, second queued');
    s.uiDirty = false;
    update(s, gap);
    ok(s.log.filter((e) => e.tier === 'milestone').length === 2 && s.uiDirty === true,
       'stagger: one beat later the second gold lands, uiDirty set');
    update(s, gap);
    ok(s.milestoneQueue.length === 0 && (s.milestoneCooldown ?? 0) === 0,
       'stagger: an empty queue winds the cooldown down to rest');
  }
  // Non-milestone lines bypass: a dismiss mid-cooldown lands instantly.
  {
    const s = shopState();
    s.stats.monsterServes.slime = 24;
    s.queue = [customer('slime', 'club', 99), customer('bat', 'club', 0)];
    serveCurrent(s);                                    // cooldown armed, one gold queued
    const before = s.log.length;
    dismissCurrent(s);                                  // the broke bat gets waved mid-cooldown
    ok(s.log.length === before + 1 && s.log[0].tier === 'dismiss',
       'stagger: non-milestone lines bypass the queue entirely');
  }
  // Transience: neither the queue nor the cooldown survives a save round-trip.
  {
    const s = shopState();
    s.milestoneQueue = [{ text: 'x', repDelta: 0, tier: 'milestone' }];
    s.milestoneCooldown = 2;
    const data = serializeSave(s);
    ok(!('milestoneQueue' in data) && !('milestoneCooldown' in data),
       'stagger: queue and cooldown are never serialized (effects already applied)');
  }
}

// 44. Fold pass (2026-07-05): compactGold + the Option-3 lampshade lines -------------------------
{
  const { compactGold } = await import('./src/utils.js');
  ok(compactGold(999) === '999' && compactGold(1000) === '1k'
     && compactGold(1116) === '1.1k' && compactGold(12500) === '12.5k',
     'compactGold: exact under 1000, one-decimal k above, no trailing .0');

  const { GENERIC_RESULTS } = await import('./src/data/results.js');
  const texts = [...GENERIC_RESULTS.leave, ...GENERIC_RESULTS.dismiss]
    .map((t) => (typeof t === 'string' ? t : t.text));
  ok(texts.some((t) => t.includes('Nobody checks')) && texts.some((t) => t.includes('impostor')),
     'lampshade: both Option-3 canon lines are live (leave + dismiss)');
}

// 45. Ratty's debut (roadmap 6 Pass A, 2026-07-05): the NEWEST batch owns the exact totals -------
// Row invariants + the debut ladder. The theft MECHANIC is Pass B (separate commit); this pass
// makes him a complete roster member: sections 31/40's per-monster contracts already scaled to
// include him and pass — pinned here are the exacts and the row's design constraints.
{
  const { MONSTERS, MONSTER_IDS } = await import('./src/data/monsters.js');
  const { MONSTER_RESULTS } = await import('./src/data/results.js');
  const { ITEMS } = await import('./src/data/items.js');

  ok(MONSTER_IDS.includes('rat'),
     'ratty: on the roster (exact roster count is the NEWEST batch section\u2019s job)');

  // The floor itself is guarded by batch 1's live-derived strand test (free-batch prices <= the
  // roster's min roll — it failed at floor 6 and passes at 10); one law, one home. Pinned here:
  // the ceiling identity only.
  ok(MONSTERS.rat.budgetRange[1] < MONSTERS.frog.budgetRange[1],
     'ratty: ceiling below Froggo\u2019s — the scrounger is the anti-big-spender');
  ok(Object.keys(MONSTERS.rat.categoryWeights ?? {}).length > 0,
     'ratty: categoryWeights present — without them every want falls back to ITEM_ORDER[0]');

  // Debut ladder exacts: 2 @25 + 3 @50 + one golden @100 (sections 31/40 hold the generic rules).
  const all = Object.values(MONSTER_RESULTS.rat).flat().filter((t) => typeof t !== 'string');
  ok(all.filter((t) => t.minServes === 25).length === 2
     && all.filter((t) => t.minServes === 50).length === 3
     && all.filter((t) => t.golden === true && t.minServes === 100).length === 1,
     'ratty: debut ladder — 2 @25, 3 @50, one golden @100');
  const everyText = Object.values(MONSTER_RESULTS.rat).flat()
    .map((t) => (typeof t === 'string' ? t : t.text));
  ok(everyText.every((t) => t.length <= 80), 'ratty: every debut line fits the 80-char budget');
}

// 46. The leave-theft (roadmap 6 Pass B, 2026-07-05): Ratty's mechanic ---------------------------
// Contract: a THIEF-flagged mob's patience timeout pockets one unit of his wanted item (in-stock
// only, unpaid, leave penalty still applies, theft-tier line replaces the leave line); DISMISSAL
// prevents it; non-thieves are untouched; offline reports the fiction number deterministically.
{
  const { MONSTERS, MONSTER_IDS } = await import('./src/data/monsters.js');
  const { MONSTER_RESULTS } = await import('./src/data/results.js');
  const { dismissCurrent } = await import('./src/game.js');
  const { computeOffline } = await import('./src/offline.js');
  const { CONFIG } = await import('./src/config.js');

  ok(MONSTERS.rat.thief === true, 'theft: the mechanic is registry-driven (thief flag on the row)');

  const timedOut = (monsterId) => {
    const s = shopState();
    s.items.club.stock = 3;
    s.queue = [{ ...customer(monsterId, 'club', 0), patienceRemaining: 0.01 }];
    update(s, 0.05);                                 // the timeout fires inside update's patience loop
    return s;
  };
  // The theft: stock -1, no payment, leave penalty applies, the theft-tier line lands.
  {
    const goldBefore = shopState().gold;
    const s = timedOut('rat');
    const theftTexts = MONSTER_RESULTS.rat.theft.map((t) => t.replace(/\{name\}/g, 'Ratty').replace(/\{item\}/g, 'Club'));
    ok(s.items.club.stock === 2, 'theft: the timed-out thief pockets exactly one unit');
    ok(s.gold === goldBefore, 'theft: pocketed, not purchased — gold untouched');
    ok(theftTexts.includes(s.log[0].text) && s.log[0].repDelta === -CONFIG.reputation.leavePenalty,
       'theft: the theft-tier line replaces the leave line and carries the leave penalty');
  }
  // Guards: out-of-stock steals nothing (a normal leave); non-thieves never steal.
  {
    const s = shopState();
    s.items.club.stock = 0;
    s.queue = [{ ...customer('rat', 'club', 0), patienceRemaining: 0.01 }];
    update(s, 0.05);
    ok(s.items.club.stock === 0 && s.log[0].tier === 'leave',
       'theft: an empty shelf forces an honest leave — stock never goes negative');
  }
  ok(timedOut('skeleton').items.club.stock === 3, 'theft: non-thief timeouts touch nothing');
  // The prevention: dismissing the thief keeps the shelf whole (Send Away = anti-theft).
  {
    const s = shopState();
    s.items.club.stock = 3;
    s.queue = [customer('rat', 'club', 0)];
    dismissCurrent(s);
    ok(s.items.club.stock === 3, 'theft: dismissal prevents it — the whole point of the mechanic');
  }
  // Offline: the fiction number derives from sales x the roster's thief share; deterministic.
  {
    const s = shopState();
    s.workers.mimic_merchant.owned = true;
    s.lastSeen = Date.now() - 3600 * 1000;
    const r1 = computeOffline(s, Date.now()), r2 = computeOffline(s, Date.now());
    const thieves = MONSTER_IDS.filter((id) => MONSTERS[id]?.thief === true).length;
    ok(r1.ratsFoiled === Math.round(r1.sales * thieves / MONSTER_IDS.length)
       && r1.ratsFoiled === r2.ratsFoiled,
       'theft offline: ratsFoiled = sales x thief share, recompute-stable');
  }
}

// 47. Beetley's debut (roadmap 6.5, 2026-07-05): the NEWEST batch owns the exact totals ----------
// The Goblin's slot went to the beetle (Daniel's call). Row invariants, the debut ladder, and the
// Steadfast quirk's spawn math. Sections 31/40's per-monster contracts scaled to include him.
{
  const { MONSTERS, MONSTER_IDS } = await import('./src/data/monsters.js');
  const { MONSTER_RESULTS } = await import('./src/data/results.js');
  const { spawnCustomer } = await import('./src/game.js');
  const { CONFIG } = await import('./src/config.js');

  ok(MONSTER_IDS.length >= 6 && MONSTER_IDS.includes('beetle'),   // exact moved to §54 (doctrine:
     'beetley: at least six mobs, Beetley among them');              // newest batch owns the total)
  ok(Object.keys(MONSTERS.beetle.categoryWeights ?? {}).length > 0,
     'beetley: categoryWeights present (the Ratty lesson — the fallback wants only clubs)');
  ok((MONSTERS.beetle.categoryWeights.armor ?? 0) > (MONSTERS.beetle.categoryWeights.weapon ?? 0),
     'beetley: armor-lead identity — armor outweighs everything else in his wants');

  // The Steadfast quirk: spawned patience = default + bonus (+ perks when owned). Sampled through
  // the REAL factory (it picks the monster internally; 1-in-6 per try makes 300 tries certain).
  {
    const s = shopState();
    let beetle = null, other = null;
    for (let i = 0; i < 300 && !(beetle && other); i++) {
      const c = spawnCustomer(s);
      if (c.monsterId === 'beetle') beetle = c;
      else other = other ?? c;
    }
    ok(beetle && beetle.patienceRemaining ===
         CONFIG.queue.defaultPatienceSec + MONSTERS.beetle.patienceBonus,
       'beetley: the guard holds the line — patience = default + patienceBonus');
    ok(other && other.patienceRemaining === CONFIG.queue.defaultPatienceSec,
       'beetley: the quirk is his alone — everyone else spawns at the default');
  }

  // Debut ladder exacts: 2 @25 + 3 @50 + one golden @100; every line inside the log budget.
  const all = Object.values(MONSTER_RESULTS.beetle).flat().filter((t) => typeof t !== 'string');
  ok(all.filter((t) => t.minServes === 25).length === 2
     && all.filter((t) => t.minServes === 50).length === 3
     && all.filter((t) => t.golden === true && t.minServes === 100).length === 1,
     'beetley: debut ladder — 2 @25, 3 @50, one golden @100');
  ok(Object.values(MONSTER_RESULTS.beetle).flat()
       .map((t) => (typeof t === 'string' ? t : t.text)).every((t) => t.length <= 80),
     'beetley: every debut line fits the 80-char budget');
}

// 48. Queue uniqueness (Option 2, 2026-07-05): never two of him, never him in two places --------
// Contract: spawns exclude types in line AND types on return cooldown; every queue exit arms the
// cooldown (serve / dismiss / timeout-leave); an empty candidate pool skips the beat gracefully;
// the cooldown map is transient.
{
  const { MONSTER_IDS } = await import('./src/data/monsters.js');
  const { spawnCustomer, dismissCurrent } = await import('./src/game.js');
  const { CONFIG } = await import('./src/config.js');
  const cd = CONFIG.queue.returnCooldownSec;

  // Dedup: with a type in line, 200 spawns never duplicate it.
  {
    const s = shopState();
    s.queue = [customer('skeleton', 'club', 99)];
    ok(Array.from({ length: 200 }, () => spawnCustomer(s)).every((c) => c.monsterId !== 'skeleton'),
       'uniqueness: a type in line never spawns again (200 draws)');
  }
  // Empty pool: all six types in line -> null, and the spawn beat skips without pushing.
  {
    const s = shopState();
    s.queue = MONSTER_IDS.map((id) => customer(id, 'club', 99));
    ok(spawnCustomer(s) === null, 'uniqueness: a full-roster line empties the pool -> null');
    s.spawnTimer = 0.01;
    const len = s.queue.length;
    update(s, 0.05);
    ok(s.queue.length === len && s.spawnTimer > 0,
       'uniqueness: the skipped beat pushes nothing and the director timer still rearms');
  }
  // Every exit arms the cooldown; expiry restores the type to the pool.
  {
    const s = shopState();
    s.items.club.stock = 3;
    s.queue = [customer('skeleton', 'club', 99)];
    serveCurrent(s);
    ok((s.mobCooldowns?.skeleton ?? 0) > 0, 'uniqueness: SERVING arms the return cooldown');
    ok(Array.from({ length: 120 }, () => spawnCustomer(s)).every((c) => c.monsterId !== 'skeleton'),
       'uniqueness: a cooling type never spawns (120 draws) — no Skele in two places');
    update(s, cd + 0.05);
    ok(!('skeleton' in (s.mobCooldowns ?? {})), 'uniqueness: expiry cleans the transient map');
    ok(Array.from({ length: 300 }, () => spawnCustomer(s)).some((c) => c?.monsterId === 'skeleton'),
       'uniqueness: after the cooldown he can return (300 draws)');
  }
  {
    const s = shopState();
    s.queue = [customer('rat', 'club', 0)];
    dismissCurrent(s);
    ok((s.mobCooldowns?.rat ?? 0) > 0, 'uniqueness: DISMISSAL arms it (the auto-wave path too)');
  }
  {
    const s = shopState();
    s.items.club.stock = 0;
    s.queue = [{ ...customer('bat', 'club', 0), patienceRemaining: 0.01 }];
    update(s, 0.05);
    ok((s.mobCooldowns?.bat ?? 0) > 0, 'uniqueness: a timeout LEAVE arms it');
  }
  // Transience: the comings and goings never serialize.
  {
    const s = shopState();
    s.mobCooldowns = { slime: 5 };
    ok(!('mobCooldowns' in serializeSave(s)), 'uniqueness: mobCooldowns is never serialized');
  }
}

// 49. Budget-aware wants (Option 2 soft bias, 2026-07-06): the affordability contract -----------
// The want pick's item stage weighs affordable items x affordableWantBias. Pinned: mismatched
// wants (price > purse) became RARE but stayed POSSIBLE — both halves are the design (a hard
// filter would amputate the broke state that the auto-wave, brokeGrace, and the broke-comedy
// register live on). Plus the visible payoff: Ratty's floor is FREED below the old strand pin.
{
  const { MONSTERS } = await import('./src/data/monsters.js');
  const { spawnCustomer } = await import('./src/game.js');
  const { ITEMS } = await import('./src/data/items.js');
  const { CONFIG } = await import('./src/config.js');

  ok((CONFIG.queue.affordableWantBias ?? 1) > 1, 'wants: the bias dial exists and is active');
  ok(MONSTERS.rat.budgetRange[0] < 10,
     'wants: Ratty\u2019s floor is freed — the liberation this pass was flagged for');

  // Statistical, derived margins: sample the real spawner; mismatch share must be well under the
  // unbiased world's (~25-40% at low fame) yet nonzero. 4000 samples: <15% and >0 are both
  // orders-of-magnitude safe against noise.
  {
    const s = shopState();
    let mismatched = 0, total = 0;
    for (let i = 0; i < 4000; i++) {
      const c = spawnCustomer(s);
      total++;
      if (ITEMS[c.wantedItemId].basePrice > c.budget) mismatched++;
    }
    ok(mismatched / total < 0.15,
       `wants: mismatches are RARE under the bias (${mismatched}/${total})`);
    ok(mismatched > 0,
       'wants: mismatches remain POSSIBLE — the broke state survives as texture (soft, not a filter)');
  }
}

// 50. Market Day (retention pass Option 2, 2026-07-06): daily demand event + supplier crate ------
// The event is a pure function of the LOCAL calendar date (deterministic, reroll-proof); the
// crate is once per day, latched by the PERSISTED lastMarketDay. Two laws pinned here: the event
// multiplies PAYOUT only (never basePrice — inherited from milestones), and offline earnings are
// EVENT-FREE (the sim is a frozen estimate; the event is a come-play-today hook). Exact totals
// below (crate gold 10 / 28, flask 23) belong to THIS newest section per the suite doctrine.
{
  const M = await import('./src/data/marketevents.js');
  const { refreshMarketDay, marketPayoutMult, dealCrateUnits, activeMarketEvent,
    spawnCustomer, effectiveMaxStock, update: upd } = await import('./src/game.js');
  const { computeOffline } = await import('./src/offline.js');
  const { ITEMS, ITEM_ORDER } = await import('./src/data/items.js');
  const { CONFIG } = await import('./src/config.js');

  // (a) Registry contract + deterministic date math
  ok(M.MARKET_EVENT_ORDER.length >= 3
     && M.MARKET_EVENT_ORDER.every((id) => M.MARKET_EVENTS[id]?.id === id),
     'market: every ordered id resolves to a registry row');
  const validCats = ['weapon', 'armor', 'consumable'];
  ok(M.MARKET_EVENT_ORDER.every((id) => validCats.includes(M.MARKET_EVENTS[id].category)),
     'market: every event targets a live shelf category');
  const epoch = Date.parse('2026-07-06T12:00:00');
  ok(/^\d{4}-\d{2}-\d{2}$/.test(M.dayKeyOf(epoch)), 'market: day key is YYYY-MM-DD');
  ok(M.eventIdForDay('2026-07-06') === M.eventIdForDay('2026-07-06'),
     'market: same day -> same event (deterministic, nothing to reroll)');
  {
    const ids = new Set(); const cats = new Set();
    for (let d = 0; d < 365; d++) {
      const id = M.eventIdForDay(M.dayKeyOf(epoch + d * 86400000));
      ids.add(id);
      if (d < 60) cats.add(M.MARKET_EVENTS[id].category);
    }
    ok(ids.size === M.MARKET_EVENT_ORDER.length,
       `market: a year of days covers the whole roster (${ids.size}/${M.MARKET_EVENT_ORDER.length})`);
    ok(cats.size === validCats.length,
       'market: 60 days cover every category — each shelf gets its days');
  }

  // (b) Payout law (pinned trio): the event multiplies the PAYOUT of its category only, never
  // the price. Flask 15 -> 23 (round(15 x 1.5)) under a consumable event; club stays 12; a
  // budget of exactly basePrice still buys (affordability untouched).
  {
    const evId = M.MARKET_EVENT_ORDER.find((id) => M.MARKET_EVENTS[id].category === 'consumable');
    const s = pinTrioShelf(shopState(), 'full');
    s.marketEventId = evId;
    ok(marketPayoutMult(s, 'consumable') === 1.5 && marketPayoutMult(s, 'weapon') === 1
       && marketPayoutMult({ marketEventId: null }, 'consumable') === 1,
       'market: mult is 1.5 on the event category, 1 elsewhere, 1 with no event');
    s.queue = [customer('slime', 'hp_flask', 15)];             // budget EXACTLY basePrice
    const g0 = s.gold;
    ok(serveCurrent(s) === true, 'market: exact-budget customer still buys under the event (price untouched)');
    ok(s.gold - g0 === 23, `market: flask pays 23 under the event (got ${s.gold - g0})`);
    s.serveCooldown = 0;
    s.queue = [customer('skeleton', 'club', 99)];
    const g1 = s.gold;
    serveCurrent(s);
    ok(s.gold - g1 === 12, `market: club (off-category) still pays base 12 (got ${s.gold - g1})`);
    ok(activeMarketEvent(s)?.id === evId, 'market: activeMarketEvent resolves the derived id');
  }

  // (c) Want bias (statistical, derived margins — probe-verified true shifts are 0.14-0.17 at
  // 4000 samples; sigma of the share diff ~0.01, so >0.06 is orders-of-magnitude safe): under an
  // event, that category's want share rises materially and strictly, for every category.
  for (const cat of validCats) {
    const evId = M.MARKET_EVENT_ORDER.find((id) => M.MARKET_EVENTS[id].category === cat);
    const share = (eventId) => {
      const s = shopState();
      s.marketEventId = eventId;
      let hit = 0;
      for (let i = 0; i < 4000; i++) {
        if (ITEMS[spawnCustomer(s).wantedItemId].category === cat) hit++;
      }
      return hit / 4000;
    };
    const base = share(null), biased = share(evId);
    ok(biased > base, `market: ${cat} share rises under its event (${base.toFixed(3)} -> ${biased.toFixed(3)})`);
    ok(biased - base > 0.06, `market: ${cat} shift is material (${(biased - base).toFixed(3)} > 0.06)`);
  }

  // (d) The crate: exact math at Neutral (tier 0 -> 3 units + 10 gold), round-robin fairness,
  // cap + license respect, the full-shelf gold fallback (10 + 3x6 = 28), and the once-a-day latch.
  {
    const s = shopState();
    const total = () => ITEM_ORDER.reduce((t, id) => t + (s.items[id]?.stock ?? 0), 0);
    const before = total(); const g0 = s.gold;
    const res = refreshMarketDay(s, epoch);
    ok(res?.crate?.units === 3 && total() - before === 3,
       `market: Neutral crate deals exactly 3 units (${res?.crate?.units})`);
    ok(s.gold - g0 === 10, `market: Neutral crate gold is exactly 10 (got ${s.gold - g0})`);
    ok(ITEM_ORDER.every((id) => (s.items[id]?.stock ?? 0) <= effectiveMaxStock(s, id)),
       'market: crate never exceeds the effective cap');
    ok(ITEM_ORDER.filter((id) => ITEMS[id].license).every((id) => s.items[id].stock === 0),
       'market: licensed-unbought items are invisible to the crate');
    ok(s.lastMarketDay === M.dayKeyOf(epoch), 'market: the persisted latch records the day');
    ok(s.log.length === 2 && s.log.every((e) => e.tier === 'market'),
       'market: new-day boot writes exactly two market lines (event over crate)');
    ok(s.bobSpeech?.queue?.length === 1
       && ITEMS[s.bobSpeech.queue[0].itemId]?.category === res.event.category,
       'market: Bob\u2019s bubble queued once, click-routed to the event\u2019s category');
    ok(refreshMarketDay(s, epoch) === null && s.gold - g0 === 10,
       'market: same session, same day -> no-op (no double crate)');
    const nextRes = refreshMarketDay(s, epoch + 86400000);
    ok(nextRes?.crate !== null && s.lastMarketDay === M.dayKeyOf(epoch + 86400000),
       'market: the next calendar day grants again');
  }
  {
    // Round-robin exactness on a constructed shelf: only club (-2) and helmet (-1) have room.
    const s = shopState();
    for (const id of ITEM_ORDER) s.items[id].stock = ITEMS[id].license ? 0 : effectiveMaxStock(s, id);
    s.items.club.stock -= 2;
    s.items.metal_helmet.stock -= 1;
    ok(dealCrateUnits(s, 5) === 3
       && s.items.club.stock === effectiveMaxStock(s, 'club')
       && s.items.metal_helmet.stock === effectiveMaxStock(s, 'metal_helmet'),
       'market: round-robin tops the gaps and stops at the caps (3 of 5 land)');
  }
  {
    // Full shelves: zero units land; every undealt unit converts to gold. 10 + 3x6 = 28.
    const s = shopState();
    for (const id of ITEM_ORDER) s.items[id].stock = ITEMS[id].license ? 0 : effectiveMaxStock(s, id);
    const g0 = s.gold;
    const res = refreshMarketDay(s, epoch);
    ok(res?.crate?.units === 0 && s.gold - g0 === 28,
       `market: full shop converts the crate to 28 gold (got ${s.gold - g0})`);
  }
  {
    // Same-day RELOAD (latch already today's key): event derives, crate + announcements do not.
    const s = shopState();
    s.lastMarketDay = M.dayKeyOf(epoch);
    const g0 = s.gold;
    const res = refreshMarketDay(s, epoch);
    ok(res?.crate === null && s.gold === g0 && s.log.length === 0 && !!s.marketEventId,
       'market: a same-day reload gets the banner, not a re-run of the morning');
  }

  // (e) update() gating: an UNARMED state (no boot refresh) never trips the market machinery —
  // this is what keeps every pre-market headless test byte-identical. An ARMED state with a stale
  // day key rolls over via the real clock.
  {
    const s = shopState();
    for (let i = 0; i < 30; i++) upd(s, 1);
    ok(s.lastMarketDay === '' && s.gold === CONFIG.economy.startingGold,
       'market: unarmed update() ticks grant nothing (headless tests stay untouched)');
  }
  {
    const s = shopState();
    const keyBefore = M.dayKeyOf(Date.now());
    s.marketDayKey = '1999-01-01';                    // armed, but the calendar has "flipped"
    const g0 = s.gold;
    upd(s, (CONFIG.market?.rolloverCheckSec ?? 5) + 1);
    const keyAfter = M.dayKeyOf(Date.now());
    ok((s.lastMarketDay === keyBefore || s.lastMarketDay === keyAfter)
       && s.gold - g0 >= (CONFIG.market?.crateGoldBase ?? 0),
       'market: an armed session rolls the day over mid-play (midnight crate)');
  }

  // (f) Persistence: the latch round-trips; the derived fields never serialize; tampering heals.
  {
    const s = shopState();
    refreshMarketDay(s, epoch);
    const saved = serializeSave(s);
    ok(typeof saved.lastMarketDay === 'string' && saved.lastMarketDay === M.dayKeyOf(epoch),
       'market: lastMarketDay serializes');
    ok(!('marketEventId' in saved) && !('marketDayKey' in saved),
       'market: derived event/day fields are transient — the date IS the save');
    ok(mergeSave(createInitialState(), saved).lastMarketDay === M.dayKeyOf(epoch),
       'market: the latch survives a save/load round-trip');
    ok(mergeSave(createInitialState(), { lastMarketDay: 12345 }).lastMarketDay === '',
       'market: a tampered non-string latch heals to never-collected');
  }

  // (g) Offline independence: the away sim is byte-identical with and without an active event.
  {
    const s = shopState();
    s.workers.mimic_merchant.owned = true;
    s.lastSeen = epoch - 2 * 3600 * 1000;
    const noEv = JSON.stringify(computeOffline(s, epoch));
    s.marketEventId = M.MARKET_EVENT_ORDER[0];
    ok(noEv === JSON.stringify(computeOffline(s, epoch)),
       'market: offline earnings are event-free (a bonus is for playing, not for sleeping)');
  }

  // (h) Line hygiene for the new pools (section-42 laws applied at the source: no second person;
  // log lines fit the width; bubbles stay one-liners; fills present where the math needs them).
  {
    const announces = M.MARKET_EVENT_ORDER.flatMap((id) => M.MARKET_EVENTS[id].announce ?? []);
    const bubbles = M.MARKET_EVENT_ORDER.flatMap((id) => M.MARKET_EVENTS[id].bubble ?? []);
    const crates = [...M.CRATE_LINES.stocked, ...M.CRATE_LINES.full];
    const all = [...announces, ...bubbles, ...crates];
    ok(all.every((t) => !/\byou\b/i.test(t.replace(/you'd/gi, ''))),
       'market hygiene: no second person in any market pool');
    ok(announces.every((t) => t.length <= 80), 'market hygiene: announce lines fit the log width (<=80)');
    ok(bubbles.every((t) => t.length <= 48), 'market hygiene: bubble lines stay one-liners (<=48)');
    ok(M.CRATE_LINES.stocked.every((t) => t.includes('{units}') && t.includes('{gold}'))
       && M.CRATE_LINES.full.every((t) => t.includes('{gold}')),
       'market hygiene: crate templates carry their fills');
    ok(M.marketBannerText(M.MARKET_EVENTS[M.MARKET_EVENT_ORDER[0]], 1.5).includes('+50%'),
       'market: the HUD banner formats the bonus percent');
    {
      // Compact chip form (layout pass 2026-07-07): category label + percent, NO event name —
      // the name moved to the tooltip when the full-width chip broke the shelf's airspace.
      const ev0 = M.MARKET_EVENTS[M.MARKET_EVENT_ORDER[0]];
      const compact = M.marketBannerCompact(ev0, 1.5);
      ok(compact.includes('+50%') && compact.includes(M.CATEGORY_LABELS[ev0.category])
         && !compact.includes(ev0.displayName),
         'market: the compact banner is label + percent, name-free');
    }
  }

  // (i) THE MIRROR GUARD (LESSONS 2026-07-06): index.kongregate.html is index.html + Kong-only
  // insertions, nothing less. Subsequence check: every index.html line must appear IN ORDER in
  // the Kong shell — extras (the API tag) are allowed anywhere; missing or stale content fails.
  {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('./index.html', 'utf8').split('\n').map((l) => l.trimEnd());
    const kong = readFileSync('./index.kongregate.html', 'utf8').split('\n').map((l) => l.trimEnd());
    let k = 0;
    let missing = null;
    for (const line of src) {
      while (k < kong.length && kong[k] !== line) k++;
      if (k >= kong.length) { missing = line; break; }
      k++;
    }
    ok(missing === null,
       `mirror: index.kongregate.html contains index.html in order (first missing: ${JSON.stringify(missing)})`);
  }
}

// 51. Special-of-the-Day board (Daniel's board, 2026-07-07): the quip is chalked ONCE a morning --
// The board's line is a pure function of (day, event) — a reload must show the identical sign.
// The render half is canvas (browser-tested); the pure picker and its pool contract pin here.
// The sprite pairing (getSprite('special_board') <-> main.js loadSprite) is covered by 0b.
{
  const M = await import('./src/data/marketevents.js');
  const ev = M.MARKET_EVENTS[M.MARKET_EVENT_ORDER[0]];
  const a = M.boardQuipFor(ev, '2026-07-07');
  ok(a === M.boardQuipFor(ev, '2026-07-07') && typeof a === 'string' && a.length > 0,
     'board: same day + same event -> the identical quip (deterministic, reload-stable)');
  ok(ev.bubble.includes(a), 'board: the quip is drawn from the event\u2019s authored pool');
  ok(M.boardQuipFor(null, '2026-07-07') === '' && M.boardQuipFor({ id: 'x', bubble: [] }, '2026-07-07') === '',
     'board: no event / empty pool -> empty string, never a crash');
}

// 52. Board life pass (Option 2, 2026-07-07): grown pools + the chalk handshake -----------------
// Content half: every event's bubble pool grew to 3+ lines (this batch's exact — hygiene rules
// for these pools live in section 50h and cover the newcomers automatically), and the day-hash
// SPREADS them: probe-verified, all 3 lines of every event surface inside 60 days (pinned >=2,
// noise-free margin — it's deterministic). Handshake half: a FRESH market day arms the transient
// boardChalkPending flag for main.js; a same-day reload must NOT (the sign was chalked already),
// and the flag never serializes.
{
  const M = await import('./src/data/marketevents.js');
  const { refreshMarketDay } = await import('./src/game.js');
  const epoch = Date.parse('2026-07-07T12:00:00');

  for (const id of M.MARKET_EVENT_ORDER) {
    const ev = M.MARKET_EVENTS[id];
    ok((ev.bubble?.length ?? 0) >= 3, `board life: ${id} carries a 3+ line pool`);
    const seen = new Set();
    for (let d = 0; d < 60; d++) seen.add(M.boardQuipFor(ev, M.dayKeyOf(epoch + d * 86400000)));
    ok(seen.size >= 2, `board life: ${id}'s calendar spreads its pool (${seen.size} distinct over 60 days)`);
  }

  {
    const s = shopState();
    ok(s.boardChalkPending === false, 'chalk: the flag rests false on a fresh state');
    refreshMarketDay(s, epoch);
    ok(s.boardChalkPending === true, 'chalk: a fresh market day arms the write-on');
    s.boardChalkPending = false;                       // main.js consumed it
    const s2 = shopState();
    s2.lastMarketDay = M.dayKeyOf(epoch);              // a same-day reload: latch already today
    refreshMarketDay(s2, epoch);
    ok(s2.boardChalkPending === false, 'chalk: a same-day reload never re-arms (chalked this morning already)');
    ok(!('boardChalkPending' in serializeSave(s)), 'chalk: the handshake flag is transient — never serialized');
  }
}

// 53. Deep Sinks (Option 2, 2026-07-07): worker training + the Mythic rung ----------------------
// The repeatable gold sink: per-worker levels on a GENTLE 1.15 curve with a x3 bump entering the
// deep band (L6-10), which is gated behind the new Mythic tier — the rung's content. Exact curve
// numbers (2000/2300/12068/21107, band-1 total 13485) are THIS newest section's pins. Two effect
// laws: Bob's tip is FLAT and lands AFTER the rounded multiplier product (linear production,
// payout-side only); Greg's training extends the BOUNDED offline reserve (never time-derived).
{
  const { WORKERS, workerLevel, workerLevelCost, isWorkerLevelMaxed, sumWorkerEffect } =
    await import('./src/data/workers.js');
  const { canBuyWorkerLevel, buyWorkerLevel, effectiveMaxStock } = await import('./src/game.js');
  const { computeOffline } = await import('./src/offline.js');
  const { reputationTier } = await import('./src/reputation.js');
  const { trackByTier, nextTierInfo } = await import('./src/data/fametrack.js');
  const { CONFIG } = await import('./src/config.js');
  const { ITEMS, ITEM_ORDER } = await import('./src/data/items.js');

  // (a) The Mythic row: last rung, min 5000; Legendary players get their HUD goal line back.
  const top = CONFIG.reputation.tiers.at(-1);
  ok(top.label === 'Mythic' && top.min === 5000, 'mythic: the reserved rung is live at 5000');
  ok(reputationTier(5000).index === CONFIG.reputation.tiers.length - 1
     && reputationTier(4999).label === 'Legendary',
     'mythic: 5000 crosses, 4999 stays Legendary');
  ok(nextTierInfo(1500)?.label === 'Mythic',
     'mythic: a Legendary shop sees "to Mythic" again (the horizon returns)');

  // (b) Registry + curve contract (exact pins live here, the newest section).
  ok(!!WORKERS.mimic_merchant.levels && !!WORKERS.restocker.levels,
     'sinks: both workers ship a training ladder');
  ok(workerLevelCost('mimic_merchant', 0) === 2000 && workerLevelCost('mimic_merchant', 1) === 2300,
     'sinks: shallow rungs price 2000 / 2300 (1.15 curve)');
  ok(workerLevelCost('mimic_merchant', 5) === 12068 && workerLevelCost('mimic_merchant', 9) === 21107,
     'sinks: deep rungs carry the x3 bump (12068 / 21107)');
  ok(workerLevelCost('nobody', 0) === Infinity, 'sinks: unknown workers price Infinity (fail closed)');

  // (c) The gate, both ways: L1-5 open at hire; L6 demands Mythic; MAX closes the ladder.
  {
    const s = shopState();
    s.workers.mimic_merchant.owned = true;
    s.gold = 1e9; s.lifetimeRep = 1500;                          // Legendary, deep band still shut
    const g0 = s.gold;
    for (let i = 0; i < 5; i++) ok(buyWorkerLevel(s, 'mimic_merchant'), `sinks: level ${i + 1} buys at Legendary`);
    ok(g0 - s.gold === 13485, `sinks: the shallow band costs exactly 13485 (spent ${g0 - s.gold})`);
    ok(canBuyWorkerLevel(s, 'mimic_merchant') === false, 'sinks: level 6 refuses below Mythic');
    s.lifetimeRep = 5000;                                        // cross the rung
    ok(canBuyWorkerLevel(s, 'mimic_merchant') === true, 'sinks: Mythic opens the deep band');
    while (canBuyWorkerLevel(s, 'mimic_merchant')) buyWorkerLevel(s, 'mimic_merchant');
    ok(workerLevel(s, 'mimic_merchant') === WORKERS.mimic_merchant.levels.maxLevel
       && isWorkerLevelMaxed(s, 'mimic_merchant'),
       'sinks: the ladder tops out at maxLevel and closes');
    ok(canBuyWorkerLevel(s, 'restocker') === false, 'sinks: an unhired worker cannot train (gold alone is not enough)');
  }

  // (d) Tip law (pinned trio): flat, AFTER the rounded product, on every serve path.
  {
    const s = pinTrioShelf(shopState(), 'full');
    s.workers.mimic_merchant.owned = true;
    s.workers.mimic_merchant.level = 3;
    s.queue = [customer('skeleton', 'club', 99)];
    const g0 = s.gold; serveCurrent(s);
    ok(s.gold - g0 === 15, `sinks: club pays 12 + 3 tip (got ${s.gold - g0})`);
    s.serveCooldown = 0;
    const M = await import('./src/data/marketevents.js');
    s.marketEventId = M.MARKET_EVENT_ORDER.find((id) => M.MARKET_EVENTS[id].category === 'consumable');
    s.queue = [customer('slime', 'hp_flask', 15)];
    const g1 = s.gold; serveCurrent(s);
    ok(s.gold - g1 === 26, `sinks: event flask pays round(15x1.5)+3 = 26 — tip lands AFTER the product (got ${s.gold - g1})`);
  }

  // (e) Offline tip: Bob works offline — same sale count, +tip per sale, frozen like the mults.
  {
    const mk = (lvl) => {
      const s = shopState();
      s.workers.mimic_merchant.owned = true;
      s.workers.mimic_merchant.level = lvl;
      s.lastSeen = 0;
      return computeOffline(s, 3600 * 1000);                     // one hour away
    };
    const a = mk(0), b = mk(2);
    ok(a.sales === b.sales && a.sales > 0, 'sinks offline: the tip never changes the sale count');
    ok(b.gold - a.gold === a.sales * 2, `sinks offline: gold rises by exactly sales x tip (${b.gold - a.gold} = ${a.sales} x 2)`);
  }

  // (f) Greg's Deeper Backroom: +level full refills into the SAME bounded per-item pool.
  {
    const mk = (lvl) => {
      const s = shopState();
      s.workers.mimic_merchant.owned = true;                     // the pace
      s.workers.restocker.owned = true;                          // the pool (+1 base refill)
      s.workers.restocker.level = lvl;
      for (const id of ITEM_ORDER) s.items[id].stock = 0;        // reserve-only absence
      s.lastSeen = 0;
      return computeOffline(s, 12 * 3600 * 1000);
    };
    const capSum = (() => {                                      // live-registry derivation (rule test)
      const s = shopState();
      return ITEM_ORDER.filter((id) => !ITEMS[id].license)
        .reduce((t, id) => t + effectiveMaxStock(s, id), 0);
    })();
    const a = mk(0), b = mk(2);
    ok(b.sales - a.sales === 2 * capSum,
       `sinks offline: two training levels add exactly two full refills per item (${b.sales - a.sales} = 2 x ${capSum})`);
  }

  // (g) Persistence: levels round-trip, clamp, default, and stay inert unowned.
  {
    const s = shopState();
    s.workers.restocker.owned = true;
    s.workers.restocker.level = 4;
    const back = mergeSave(createInitialState(), serializeSave(s));
    ok(back.workers.restocker.level === 4, 'sinks save: the level round-trips');
    const tampered = mergeSave(createInitialState(),
      { workers: { restocker: { owned: true, level: 999 } } });
    ok(tampered.workers.restocker.level === WORKERS.restocker.levels.maxLevel,
       'sinks save: a hand-edited 999 clamps to the ladder');
    const legacy = mergeSave(createInitialState(), { workers: { restocker: { owned: true } } });
    ok(legacy.workers.restocker.level === 0, 'sinks save: pre-pass saves read level 0');
    const inert = createInitialState();
    inert.workers.mimic_merchant.level = 5;                      // level without ownership
    ok(sumWorkerEffect(inert, 'saleTip') === 0, 'sinks: an unowned level sums to nothing (inert)');
  }

  // (h) The Fame track headline: the Mythic node carries both deep-training chips.
  {
    const node = trackByTier().at(-1);
    ok(node.unlocks.some((u) => u.label.includes('Salesmanship'))
       && node.unlocks.some((u) => u.label.includes('Deeper Backroom')),
       'mythic: the track node lists both workers\u2019 deep bands');
  }
}

// 54. Special Visits (Option 2, "The Inspection" — 2026-07-07): the dragon VIP -------------------
// Contract: SPECIAL rows never enter the normal pool, the bestiary grid, or breakpoint milestones;
// the trigger is pure (roll passed in) with a PERSISTED once-a-day latch; the tip is a report card
// (fullness + variety, fame-scaled) landing payout-side AFTER the normal gains. Exact grade math
// (175 full / 254 Mythic / 187 club serve) is THIS newest section's pin set.
{
  const { MONSTERS, MONSTER_IDS } = await import('./src/data/monsters.js');
  const { visitEligible, trySpawnVisit, inspectionGrade, effectiveMaxStock, spawnCustomer } = await import('./src/game.js');
  const V = await import('./src/data/visits.js');
  const { MONSTER_RESULTS } = await import('./src/data/results.js');
  const { bestiaryCompletion } = await import('./src/data/milestones.js');
  const { CONFIG } = await import('./src/config.js');
  const { ITEMS, ITEM_ORDER } = await import('./src/data/items.js');

  // (a) Registry contract: the VIP row carries the measured integration numbers.
  const d = MONSTERS.dragon;
  // Reauthor (2026-07-08): the VIP is authored at DISPLAY size (160px frame) and drawn 1:1 --
  // no multiplier (the sizing saga's rule). On-screen ~132 visible, level with Bob, ~1.4x a mob.
  ok(d?.special === true && d.pixelScale === 1 && d.footPad === 14,
     'visits: the Inspector ships special, drawn 1:1 at pixelScale 1, measured footPad 14');
  ok(MONSTER_IDS.length === 9, 'visits: nine on the roster (updated at the Leggsy batch — §61 carries the live exact)');

  // (a2) FRAME-SIZE CONTRACT (the sizing-saga plug, 2026-07-08): a pixelScale VIP draws at
  // frame x pixelScale, so a re-export at a different frame size silently changes on-screen
  // size (the saga's 512px dragon). Read each such VIP's PNGs straight from disk (IHDR, no
  // pngjs) and assert the frame matches its declared frameSize -- a mismatch fails HERE.
  {
    const { readFileSync, existsSync } = await import('node:fs');
    const frameH = (f) => readFileSync(f).readUInt32BE(20);   // PNG IHDR height (bytes 20-23)
    const frameW = (f) => readFileSync(f).readUInt32BE(16);   // PNG IHDR width  (bytes 16-19)
    const scaled = MONSTER_IDS.filter((id) => MONSTERS[id]?.pixelScale);
    ok(scaled.length >= 1, 'frame-size: at least one pixelScale VIP is checked (guard-the-guard)');
    for (const id of scaled) {
      const m = MONSTERS[id];
      ok(Number.isFinite(m.frameSize) && m.frameSize > 0,
         `frame-size: ${id} declares a numeric frameSize expectation`);
      ok(existsSync(`./assets/sprites/${id}.png`), `frame-size: ${id} has its static sprite`);
      const files = [`./assets/sprites/${id}.png`, `./assets/sprites/${id}_idle.png`,
                     `./assets/sprites/${id}_walk_happy.png`];
      for (const f of files) {
        if (!existsSync(f)) continue;   // a VIP may ship without a walk strip; pin what exists
        const h = frameH(f), w = frameW(f);
        ok(h === m.frameSize, `frame-size: ${f} frame height ${h} === declared ${m.frameSize}`);
        ok(w % m.frameSize === 0, `frame-size: ${f} width ${w} is whole ${m.frameSize}-frames`);
      }
    }
  }

  // (b) Pool exclusion is absolute: thousands of spawns, never the dragon — both branches.
  {
    const s = shopState();
    let seen = false;
    for (let i = 0; i < 2000; i++) {
      const c = spawnCustomer(s);
      if (c?.monsterId === 'dragon') { seen = true; break; }
    }
    for (let i = 0; i < 1000 && !seen; i++) {
      if (spawnCustomer(null)?.monsterId === 'dragon') seen = true;
    }
    ok(!seen, 'visits: the normal pool never produces the Inspector (stateful + stateless)');
    const forced = spawnCustomer(shopState(), 'dragon');
    ok(forced?.monsterId === 'dragon' && ITEMS[forced.wantedItemId] !== undefined,
       'visits: the forced path spawns him with a real want on the shared pipeline');
  }

  // (c) Eligibility matrix + the trigger's two roll branches + the persisted latch.
  {
    const s = shopState();
    ok(visitEligible(s) === false, 'visits: an unarmed state (no marketDayKey) is never eligible');
    s.marketDayKey = '2026-07-07';
    ok(visitEligible(s) === false, 'visits: below the required tier, still ineligible');
    s.lifetimeRep = 1500;                                        // Legendary (requiredTier 5)
    ok(visitEligible(s) === true, 'visits: armed + Legendary = eligible');
    ok(trySpawnVisit(s, 0.99) === null && s.lastVisitDay === '',
       'visits: a failed roll spawns nothing and burns nothing');
    const c = trySpawnVisit(s, 0);
    ok(c?.monsterId === 'dragon' && s.lastVisitDay === '2026-07-07',
       'visits: a winning roll spawns him and sets the persisted latch');
    ok(s.log.length === 1 && s.log[0].tier === 'market'
       && s.bobSpeech?.queue?.length === 1
       && ITEMS[s.bobSpeech.queue[0].itemId] !== undefined,
       'visits: the arrival announces once — amber line + routed bubble');
    ok(visitEligible(s) === false && trySpawnVisit(s, 0) === null,
       'visits: the latch closes the day (once per calendar day)');
    const saved = serializeSave(s);
    ok(saved.lastVisitDay === '2026-07-07'
       && mergeSave(createInitialState(), saved).lastVisitDay === '2026-07-07'
       && mergeSave(createInitialState(), { lastVisitDay: 42 }).lastVisitDay === '',
       'visits: the latch serializes, round-trips, and heals from tampering');
  }

  // (d) The grade, exact: full shop at Neutral = 100x1.0 + 3x25 = 175; empty = 0 fullness, 0
  // categories -> tip 0; Mythic full = round(175 x 1.45) = 254.
  {
    const s = shopState();
    for (const id of ITEM_ORDER) s.items[id].stock = ITEMS[id].license ? 0 : effectiveMaxStock(s, id);
    let g = inspectionGrade(s);
    ok(g.fullness === 1 && g.categories === 3 && g.tip === 175,
       `visits: a full Neutral shop grades 175 (got ${g.tip})`);
    s.lifetimeRep = 5000;                                        // Mythic: x1.45
    g = inspectionGrade(s);
    ok(g.tip === 254, `visits: the same shelf at Mythic grades 254 (got ${g.tip})`);
    const empty = shopState();
    for (const id of ITEM_ORDER) empty.items[id].stock = 0;
    g = inspectionGrade(empty);
    ok(g.fullness === 0 && g.categories === 0 && g.tip === 0,
       'visits: an empty shop earns exactly nothing (the report card is honest)');
  }

  // (e) Serve integration, exact: grade reads the shelf BEFORE his own unit leaves it. Full
  // Neutral shop, dragon buys the club: 12 base + 175 tip = 187; rep = 1 + 25 fame bonus = 26;
  // the grade line lands as a second market-tier entry carrying the percent.
  {
    const s = pinTrioShelf(shopState(), 'full');
    for (const id of ITEM_ORDER) s.items[id].stock = ITEMS[id].license ? 0 : effectiveMaxStock(s, id);
    s.queue = [customer('dragon', 'club', 999)];
    const g0 = s.gold, r0 = s.reputation;
    ok(serveCurrent(s) === true, 'visits: the Inspector serves on the normal path');
    ok(s.gold - g0 === 187, `visits: club + full-shelf grade pays exactly 187 (got ${s.gold - g0})`);
    ok(s.reputation - r0 === 27, `visits: rep gains base 2 (perSale) + 25 fame bonus (got ${s.reputation - r0})`);
    ok(s.log.some((e) => e.tier === 'market' && e.text.includes('%')),
       'visits: the grade line reports its percent');
  }

  // (f) Off the grid: completion ignores him; a breakpoint count fires no milestone for him.
  {
    const a = bestiaryCompletion({ stats: { monsterServes: {} } });
    const withDragon = { stats: { monsterServes: { dragon: 100 } } };
    ok(JSON.stringify(bestiaryCompletion(withDragon)) === JSON.stringify(a),
       'visits: 100 Inspector serves move bestiary completion by exactly nothing');
    const s = pinTrioShelf(shopState(), 'full');
    s.stats.monsterServes.dragon = 9;                            // this serve is his 10th — a breakpoint
    s.queue = [customer('dragon', 'club', 999)];
    serveCurrent(s);
    ok(!s.log.some((e) => e.tier === 'milestone'),
       'visits: a special monster crossing a breakpoint fires no pip milestone');
  }

  // (g) Voice contracts: results batch flat (no minServes ladders he could never climb) + hygiene
  // on every new pool.
  {
    const batch = MONSTER_RESULTS.dragon;
    ok(['excellent', 'success', 'partial', 'failure'].every((t) => (batch?.[t]?.length ?? 0) >= 3),
       'visits: the Inspector covers all four combat tiers');
    ok(Object.values(batch).every((arr) => arr.every((t) => typeof t === 'string')),
       'visits: one flat batch — no minServes ladders a once-a-day visitor could never climb');
    const pools = [...V.VISIT_LINES.announce, ...V.VISIT_LINES.bubble, ...V.VISIT_LINES.grade,
      ...Object.values(batch).flat()];
    ok(pools.every((t) => !/\byou\b/i.test(String(t).replace(/you'd/gi, ''))),
       'visits hygiene: no second person anywhere');
    ok(V.VISIT_LINES.announce.every((t) => t.length <= 80)
       && V.VISIT_LINES.bubble.every((t) => t.length <= 48)
       && V.VISIT_LINES.grade.every((t) => t.includes('{pct}') && t.includes('{tip}')),
       'visits hygiene: widths hold and the grade carries its fills');
    ok(V.visitGradeLine(94, 170).includes('94') && V.visitGradeLine(94, 170).includes('170'),
       'visits: the grade line fills its numbers');
  }
}

// 55. Content batch 3a — the leather starter set: five FREE slot-fillers; the roster EXACT total --
{
  const { ITEMS, ITEM_ORDER } = await import('./src/data/items.js');
  const { MONSTERS, MONSTER_IDS } = await import('./src/data/monsters.js');
  const { spawnCustomer } = await import('./src/game.js');
  const batch = ['tattered_cloak', 'leather_boots', 'leather_cap', 'leather_gloves', 'leather_sling'];

  // THE NEWEST BATCH owns the exact roster total (doctrine: exact totals live only in this section).
  ok(ITEM_ORDER.length >= 22 && Object.keys(ITEMS).length >= 22,
     'batch 3a: the leather five are present (exact total lives in the newest batch section)');
  ok(batch.every((id) => ITEMS[id] !== undefined && ITEM_ORDER.includes(id)),
     'batch 3a: all five rows exist and sit in ITEM_ORDER');

  const realCats = new Set(['weapon', 'armor', 'consumable']);
  ok(batch.every((id) => realCats.has(ITEMS[id].category)
       && ITEMS[id].basePrice > ITEMS[id].restockCost && Number.isFinite(ITEMS[id].combatEffect)),
     'batch 3a: real categories, restock < price (margin invariant), finite eff');

  // All five are FREE tier: no license, start stocked, priced within the free ceiling (<=10).
  ok(batch.every((id) => !ITEMS[id].license && ITEMS[id].startStock > 0 && ITEMS[id].basePrice <= 10),
     'batch 3a: all five free, stocked, and within the 10-gold free ceiling');

  // Category mix: four armor + one weapon (the sling), no consumable this batch.
  ok(batch.filter((id) => ITEMS[id].category === 'armor').length === 4
     && batch.filter((id) => ITEMS[id].category === 'weapon').length === 1,
     'batch 3a: four armor + one weapon (the sling)');

  // Roster-wide affordability floor still holds: SOME free item affords the smallest purse, so no
  // mob is unservable by construction (live-derived across the WHOLE free set, incl. these five).
  const minRoll = Math.min(...MONSTER_IDS.map((id) => MONSTERS[id].budgetRange[0]));
  const allFree = ITEM_ORDER.filter((id) => !ITEMS[id].license);
  ok(Math.min(...allFree.map((id) => ITEMS[id].basePrice)) <= minRoll,
     `batch 3a: some free item still affords the smallest purse (min roll ${minRoll})`);

  // A2 payoff (as batch 1): new free items enter the want pool with zero per-monster wiring.
  let sawLeather = false;
  for (let i = 0; i < 800 && !sawLeather; i++) {
    if (batch.includes(spawnCustomer(shopState()).wantedItemId)) sawLeather = true;
  }
  ok(sawLeather, 'batch 3a: the leather set enters the want pool with no wiring (800 spawns)');
}

// 56. Content batch 3b — upgrades + curios: three chain tops + two licensed curios; roster EXACT --
{
  const { ITEMS, ITEM_ORDER } = await import('./src/data/items.js');
  const { CONFIG } = await import('./src/config.js');
  const { spawnCustomer } = await import('./src/game.js');
  const batch = ['silver_key', 'spiked_club', 'iron_shield', 'map', 'salt'];

  // THE NEWEST BATCH owns the exact roster total (doctrine: exact totals live only in this section).
  ok(ITEM_ORDER.length === 27 && Object.keys(ITEMS).length === 27,
     'batch 3b: roster at 27 (the 22 before + these five)');
  ok(batch.every((id) => ITEMS[id] !== undefined && ITEM_ORDER.includes(id)),
     'batch 3b: all five rows exist and sit in ITEM_ORDER');

  // All five are LICENSED: real tier index, positive cost, empty until bought, margin holds. Being
  // licensed, none join the everything laggard (BASE_ITEMS is the free set) — reach, not dilution.
  ok(batch.every((id) => {
    const l = ITEMS[id].license;
    return l && Number.isInteger(l.requiredTier) && l.requiredTier < CONFIG.reputation.tiers.length
      && l.cost > 0 && ITEMS[id].startStock === 0 && ITEMS[id].basePrice > ITEMS[id].restockCost
      && Number.isFinite(ITEMS[id].combatEffect);
  }), 'batch 3b: five licensed rows, valid tiers, start empty, margin + finite eff');

  // The three CHAIN tops: each strictly beats its base on eff AND price, same category, gated
  // later than its base (or the base is free). Iron Shield extends a 3-link chain.
  const chains = [['silver_key', 'rusty_key'], ['spiked_club', 'club'], ['iron_shield', 'iron_buckler']];
  ok(chains.every(([top, base]) =>
    ITEMS[top].combatEffect > ITEMS[base].combatEffect
    && ITEMS[top].basePrice > ITEMS[base].basePrice
    && ITEMS[top].category === ITEMS[base].category
    && (!ITEMS[base].license || ITEMS[top].license.requiredTier > ITEMS[base].license.requiredTier)),
     'batch 3b: chain invariant holds for all three tops (eff + price + category + gating)');

  // The 3-link shield chain is monotonic: Wooden Shield (free) -> Iron Buckler (Beloved) -> Iron Shield.
  ok(ITEMS.wooden_shield.combatEffect < ITEMS.iron_buckler.combatEffect
     && ITEMS.iron_buckler.combatEffect < ITEMS.iron_shield.combatEffect
     && ITEMS.wooden_shield.basePrice < ITEMS.iron_buckler.basePrice
     && ITEMS.iron_buckler.basePrice < ITEMS.iron_shield.basePrice,
     'batch 3b: the shield chain is monotonic across all three links (eff + price)');

  // The two curios are standalone licensed consumables (not chain tops).
  const curios = ['map', 'salt'];
  ok(curios.every((id) => ITEMS[id].category === 'consumable' && ITEMS[id].license),
     'batch 3b: Map + Bag of Salt are licensed consumables');

  // Locked rows stay OUT of the want pool; once licensed they become wantable (same as batch 1).
  let lockedLeak = false;
  for (let i = 0; i < 500; i++) if (batch.includes(spawnCustomer(shopState()).wantedItemId)) lockedLeak = true;
  const open = shopState();
  for (const id of batch) open.licenses[id] = true;
  let sawLicensed = false;
  for (let i = 0; i < 900 && !sawLicensed; i++) if (batch.includes(spawnCustomer(open).wantedItemId)) sawLicensed = true;
  ok(!lockedLeak && sawLicensed, 'batch 3b: license gate holds locked; the five become wantable once bought');
}

// 57. Doug + scrap (§14 Pass A) — the third worker, the second resource; worker-count EXACT lives here --
{
  const { WORKERS, WORKER_ORDER } = await import('./src/data/workers.js');
  const { createInitialState } = await import('./src/state.js');
  const { canHireWorker, hireWorker, effectiveWorkerInterval, update } = await import('./src/game.js');
  const { computeOffline, applyOffline } = await import('./src/offline.js');
  const { serializeSave, mergeSave } = await import('./src/save.js');
  const { WORKER_HIRE_LINES, DOUG_RETURN_LINES } = await import('./src/data/results.js');
  const { CONFIG } = await import('./src/config.js');

  // THE NEWEST STAFF PASS owns the exact worker total (the batch-section doctrine, applied to workers).
  const d = WORKERS.scavenger;
  ok(WORKER_ORDER.length === 3 && WORKER_ORDER.includes('scavenger'),
     'doug: three staff on the roster — Bob, Greg, Doug');
  ok(d?.role === 'scavenge' && d.requiredTier === 3 && d.hireCost === 1200
     && d.baseInterval === 24 && d.scrapPerRun === 2 && d.offlineRunsCap === 3,
     'doug: registry contract — Beloved gate, 1200g, 24s runs, 2 scrap/run, offline cap 3');

  // Fresh state: scrap exists at zero; Doug starts unhired.
  const fresh = createInitialState();
  ok(fresh.scrap === 0 && fresh.workers.scavenger?.owned === false,
     'doug: fresh state carries scrap 0 and an unhired scavenger');

  // The hire gate: rich but unknown (below Beloved) — no; at Beloved — yes, and the purse pays exactly.
  const poor = shopState(); poor.gold = 5000; poor.lifetimeRep = 0;
  ok(!canHireWorker(poor, 'scavenger'), 'doug: gold alone cannot hire below Beloved (fame gate holds)');
  const rich = shopState(); rich.gold = 1500;
  rich.lifetimeRep = CONFIG.reputation.tiers[3].min;                 // exactly Beloved
  ok(canHireWorker(rich, 'scavenger') && hireWorker(rich, 'scavenger')
     && rich.gold === 300 && rich.workers.scavenger.owned === true,
     'doug: hire lands at Beloved and deducts exactly 1200');

  // Interval scoping (regression pin for the trickleSpeed leak): Swift Wings speeds GREG, never Doug.
  const perky = shopState(); perky.perks.swift_wings = 2;
  ok(effectiveWorkerInterval(perky, 'scavenger') === d.baseInterval
     && effectiveWorkerInterval(perky, 'restocker') < WORKERS.restocker.baseInterval,
     'doug: trickleSpeed is scoped to the restock role — the scavenge clock never speeds up');

  // The scavenge tick: a completed run banks exactly scrapPerRun and re-arms a full interval.
  const run = shopState(); run.workers.scavenger.owned = true; run.workers.scavenger.timer = 0.1;
  const before = run.scrap ?? 0;
  update(run, 0.2);
  ok(run.scrap === before + d.scrapPerRun && run.workers.scavenger.timer > d.baseInterval - 1,
     'doug: a run banks 2 scrap and re-arms the 24s clock');

  // Offline (§14's runaway guard): BOUNDED — a week away pays the same cap as a night; a
  // sub-interval absence pays nothing; scrap banks even with ZERO sales (no serve-worker).
  const away = shopState(); away.workers.scavenger.owned = true;
  for (const id of Object.keys(away.workers)) if (id !== 'scavenger') away.workers[id].owned = false;
  away.lastSeen = Date.now() - 7 * 24 * 3600 * 1000;                 // a week
  const week = computeOffline(away, Date.now());
  ok(week.sales === 0 && week.scrap === d.offlineRunsCap * d.scrapPerRun,
     'doug: a week offline pays the bounded cap (3 runs x 2 = 6), never time-scaled');
  ok(applyOffline(away, week) === true && away.scrap === 6,
     'doug: a scrap-only absence still banks (applyOffline no longer needs sales)');
  const brief = shopState(); brief.workers.scavenger.owned = true;
  brief.lastSeen = Date.now() - 10 * 1000;                           // under one interval
  ok(computeOffline(brief, Date.now()).scrap === 0,
     'doug: a sub-interval absence scavenges nothing (time limits DOWN only)');

  // Save round-trip: scrap persists; a pre-Doug save (no field) loads as 0 — additive schema.
  const st = shopState(); st.scrap = 7;
  const back = mergeSave(createInitialState(), JSON.parse(JSON.stringify(serializeSave(st))));
  ok(back.scrap === 7, 'doug: scrap survives the save round-trip');
  const legacy = serializeSave(shopState()); delete legacy.scrap;
  ok(mergeSave(createInitialState(), legacy).scrap === 0,
     'doug: a pre-scrap save loads at scrap 0 (additive schema, no migration)');

  // The voice: hire lines authored; the return pool is nonempty, Doug-voiced, and pool-hygienic
  // (no second-person — bible law #2).
  ok((WORKER_HIRE_LINES.scavenger?.log?.length ?? 0) >= 1,
     'doug: hire lines ride the registry beat (zero new game.js wiring)');
  ok(DOUG_RETURN_LINES.length >= 4 && DOUG_RETURN_LINES.every((t) => t.includes('Doug') && !/\byou\b/i.test(t)),
     'doug: return quips — his register, no second-person');

  // Battle cameos (§14 cameo pass): dougOut-tagged lines live in the battle tiers, read as his
  // register, and the gate holds — no cameo can fire while he's home.
  {
    const { GENERIC_RESULTS } = await import('./src/data/results.js');
    const { logLine } = await import('./src/messages.js');
    const { isDougOut } = await import('./src/game.js');
    const cameos = ['excellent', 'success', 'partial', 'failure']
      .flatMap((t) => GENERIC_RESULTS[t].filter((x) => typeof x !== 'string' && x.dougOut === true));
    ok(cameos.length >= 5 && cameos.every((x) => x.text.includes('Doug')
         && !/\byou\b/i.test(x.text) && x.text.length <= 90),
       'cameos: >=5 dougOut lines across the battle tiers — Doug-voiced, pool-hygienic, log-width');

    // The gate window (one clock with the draw): home-idle no, gone yes, walking-back no, unhired no.
    const g = shopState(); g.workers.scavenger.owned = true;
    const I = WORKERS.scavenger.baseInterval;
    g.workers.scavenger.timer = I;      ok(!isDougOut(g), 'cameos: not out while idling at home');
    g.workers.scavenger.timer = I / 2;  ok(isDougOut(g),  'cameos: out mid-run (the gone window)');
    g.workers.scavenger.timer = 1;      ok(!isDougOut(g), 'cameos: not out while walking back in');
    ok(!isDougOut(shopState()), 'cameos: never out when unhired');

    // The filter: dougOut false NEVER deals a cameo (Doug appears in no other battle template);
    // dougOut true deals one within a few hundred draws (statistical — pool share ~10%+).
    let leaked = false, seen = false;
    for (let i = 0; i < 300; i++) if (logLine('slime', 'excellent', { name: 'S' }).text.includes('Doug')) leaked = true;
    for (let i = 0; i < 500 && !seen; i++) if (logLine('slime', 'excellent', { name: 'S', dougOut: true }).text.includes('Doug')) seen = true;
    ok(!leaked && seen, 'cameos: the dougOut gate holds shut when home and opens when he is out');
  }

  // Art contract (the dragon lesson, worker edition): 160px frames, whole-frame strips.
  // existsSync-guarded — pins activate as each PNG lands in assets/sprites/.
  {
    const { readFileSync, existsSync } = await import('node:fs');
    const dim = (f) => { const b = readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
    let checked = 0;
    for (const f of ['doug.png', 'doug_idle.png', 'doug_walk_happy.png']) {
      const p = `./assets/sprites/${f}`;
      if (!existsSync(p)) continue;                                  // lands with Daniel's art drop
      const [w, h] = dim(p);
      ok(h === 160 && w % 160 === 0, `doug art: ${f} is 160px frames, whole-frame width (${w}x${h})`);
      checked++;
    }
    ok(checked >= 1, 'doug art: at least one doug PNG is pinned (guard-the-guard)');
  }
}

// 58. The Relic Forge (§14 Pass B) — find/restore/display: the collection meta --
{
  const { RELICS, RELIC_ORDER, RELIC_FIND } = await import('./src/data/relics.js');
  const { RELIC_VOICE } = await import('./src/data/results.js');
  const { createInitialState } = await import('./src/state.js');
  const { update, canRestoreRelic, restoreRelic } = await import('./src/game.js');
  const { serializeSave, mergeSave } = await import('./src/save.js');

  // Registry contract: four one-of-ones, curated order, both currencies priced, unique spots.
  ok(RELIC_ORDER.length === 4 && RELIC_ORDER.every((id) => RELICS[id]?.id === id),
     'relics: four on the roster, order matches the registry');
  ok(RELIC_ORDER.every((id) => RELICS[id].restoreCost.scrap > 0 && RELICS[id].restoreCost.gold > 0
       && typeof RELICS[id].card === 'string' && RELICS[id].card.length > 0),
     'relics: every relic prices BOTH currencies and carries its card gag');
  const spots = RELIC_ORDER.map((id) => RELICS[id].spot.kind + ':' + RELICS[id].spot.x);
  ok(new Set(spots).size === 4 && RELIC_ORDER.filter((id) => RELICS[id].spot.kind === 'frame').length === 3,
     'relics: four unique display spots — three frames + the one desk slot (the Greg-Bob gap fits exactly one)');

  // Fresh state + the additive save: statuses round-trip; legacy saves load empty; a corrupt
  // save cannot invent relics or statuses (the merge guard).
  const fresh = createInitialState();
  ok(Object.keys(fresh.relics).length === 0 && fresh.relicPity === 0,
     'relics: fresh state — nothing found, pity at zero');
  const st = shopState(); st.relics = { skeleton_key: 'restored', hero_magnet: 'found' }; st.relicPity = 7;
  const back = mergeSave(createInitialState(), JSON.parse(JSON.stringify(serializeSave(st))));
  ok(back.relics.skeleton_key === 'restored' && back.relics.hero_magnet === 'found' && back.relicPity === 7,
     'relics: statuses + pity survive the save round-trip');
  const legacy = serializeSave(shopState()); delete legacy.relics; delete legacy.relicPity;
  const merged = mergeSave(createInitialState(), legacy);
  ok(Object.keys(merged.relics).length === 0 && merged.relicPity === 0,
     'relics: a pre-forge save loads empty (additive schema)');
  const corrupt = mergeSave(createInitialState(), { relics: { skeleton_key: 'banana', fake_relic: 'found' } });
  ok(Object.keys(corrupt.relics).length === 0,
     'relics: the merge guard drops unknown ids and illegal statuses');

  // The find: pity floor is deterministic — a run at the cap ALWAYS finds; order is curated
  // (skeleton_key first, hero_magnet second); pity resets after each find.
  const run = shopState(); run.workers.scavenger.owned = true;
  run.relicPity = RELIC_FIND.pityRuns - 1; run.workers.scavenger.timer = 0.1;
  update(run, 0.2);
  ok(run.relics.skeleton_key === 'found' && run.relicPity === 0,
     'relics: the pity floor lands the FIRST curated relic and resets the counter');
  run.relicPity = RELIC_FIND.pityRuns - 1; run.workers.scavenger.timer = 0.1;
  update(run, 0.2);
  ok(run.relics.hero_magnet === 'found' && !run.relics.yesterday_potion,
     'relics: the second find follows the curated order');

  // The Forge: unfound and underfunded both refuse; funded restore deducts EXACTLY and displays.
  ok(!canRestoreRelic(run, 'yesterday_potion'), 'forge: an unfound relic cannot be restored');
  run.scrap = RELICS.skeleton_key.restoreCost.scrap - 1; run.gold = 1e9;
  ok(!canRestoreRelic(run, 'skeleton_key'), 'forge: short on scrap refuses (gold alone is not enough)');
  run.scrap = RELICS.skeleton_key.restoreCost.scrap + 5; run.gold = RELICS.skeleton_key.restoreCost.gold + 100;
  ok(restoreRelic(run, 'skeleton_key') && run.scrap === 5 && run.gold === 100
       && run.relics.skeleton_key === 'restored',
     'forge: a funded restore deducts both currencies exactly and puts it on display');
  ok(!restoreRelic(run, 'skeleton_key'), 'forge: a restored relic cannot be restored twice');

  // The voice: found templates carry {relic}; every relic has a restored line + >=2 ambient
  // reactions; pool hygiene throughout (no second-person, log width).
  ok(RELIC_VOICE.found.length >= 2 && RELIC_VOICE.found.every((t) => t.includes('{relic}')),
     'relic voice: found lines exist and template the relic name');
  ok(RELIC_ORDER.every((id) => typeof RELIC_VOICE.byRelic[id]?.restored === 'string'
       && (RELIC_VOICE.byRelic[id]?.ambient?.length ?? 0) >= 2),
     'relic voice: every relic carries its restored line and ambient reactions');
  const allLines = [...RELIC_VOICE.found,
    ...RELIC_ORDER.flatMap((id) => [RELIC_VOICE.byRelic[id].restored, ...RELIC_VOICE.byRelic[id].ambient])];
  ok(allLines.every((t) => !/\byou\b/i.test(t) && t.length <= 95),
     'relic voice: pool-hygienic (no second-person, log width)');

  // Art contract: relics 64×64, the frame 80×80 with the 64px nest window (existsSync-guarded).
  {
    const { readFileSync, existsSync } = await import('node:fs');
    const dim = (f) => { const b = readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
    let checked = 0;
    for (const id of RELIC_ORDER) {
      const p = `./assets/sprites/${RELICS[id].spriteId}.png`;
      if (!existsSync(p)) continue;
      const [w, h] = dim(p);
      ok(w === 64 && h === 64, `relic art: ${RELICS[id].spriteId} is 64×64 (${w}×${h})`);
      checked++;
    }
    if (existsSync('./assets/sprites/wooden_frame.png')) {
      const [w, h] = dim('./assets/sprites/wooden_frame.png');
      ok(w === h && w >= 80, `relic art: the frame is square and >= 80 (${w}×${h}; the re-author lands drop-in)`);
      checked++;
    }
    ok(checked >= 1, 'relic art: at least one relic PNG is pinned (guard-the-guard)');
  }
}

// 59. THE TRADE MARKET (reform Pass A, 2026-07-11) — materials, drops, caps, offers, trades ------
// TRADE_MARKET_DESIGN.md is the contract: gold and materials never convert; drops follow the
// deterministic every-Nth-serve law; offers are pure functions of the day; and the trade tier
// never gold-restocks by ANY path (restock, quote, trickle, crates, offline reserve).
{
  const { MATERIALS, MATERIAL_ORDER } = await import('./src/data/materials.js');
  const { MONSTERS, MONSTER_IDS } = await import('./src/data/monsters.js');
  const { offersForDay, eligibleMaterialIds, tradeItemIds, describeOffer, tradeBoardLine }
    = await import('./src/data/trademarket.js');
  const { addMaterial, materialCap, currentTradeOffers, canTrade, executeTrade,
    canRestock, restockAll, restockAllCost, canRestockAll, trickleTarget, dealCrateUnits,
    effectiveMaxStock } = await import('./src/game.js');
  const { computeOffline } = await import('./src/offline.js');
  const { CONFIG } = await import('./src/config.js');

  // (a) Registry pairing — the auto-flow law's guard rails.
  for (const id of MONSTER_IDS) {
    const mat = MONSTERS[id].material;
    if (mat !== undefined) ok(!!MATERIALS[mat], `market: ${id}.material '${mat}' exists in MATERIALS`);
  }
  const liveFaucets = MONSTER_IDS.filter((id) => !MONSTERS[id].special && MONSTERS[id].material);
  ok(liveFaucets.length >= 6,
    'market: at least the Pass A six serve faucets are live (the exact count lives in the newest batch — §60)');
  ok(MONSTERS.dragon.material === undefined,
    'market: the Inspector (the dragon row) has NO serve faucet — VIP drops are Pass B');
  ok(tradeItemIds().length === 1 && tradeItemIds()[0] === 'iron_sword',
    'market: the trade tier is exactly the Pass A proof (iron_sword)');
  for (const id of MATERIAL_ORDER) ok(!!MATERIALS[id], `market: MATERIAL_ORDER '${id}' resolves`);

  // (b) The drop law: the Nth serve of a family sheds one material; earlier serves shed none.
  {
    const s = shopState();
    const N = MONSTERS.slime.materialEveryNServes ?? CONFIG.materials.defaultEveryNServes;
    for (let i = 1; i <= N; i++) {
      s.queue = [customer('slime', 'club', 99)];
      s.items.club.stock = 5;
      s.serveCooldown = 0;
      serveCurrent(s);
      if (i === 1) ok((s.materials.slime_core ?? 0) === 0, `market: serve 1/${N} drops nothing yet`);
      if (i === N) ok((s.materials.slime_core ?? 0) === 1, `market: serve ${N}/${N} drops ONE core (the modulo law)`);
    }
    ok(s.stats.materialEarned.slime_core === 1, 'market: the lifetime ledger counted the landed drop');
    ok(s.log.some((l) => l.text.includes('Condensed Slime Core')),
      'market: the FIRST-ever drop speaks (discovery line, once per material)');
  }

  // (c) Cap clamp: a full store LOSES the drop; lost drops are not "earned".
  {
    const s = shopState();
    const cap = materialCap(s, 'echo_fang');
    ok(cap === (CONFIG.materials?.baseCap ?? 10), 'market: the cap reads the CONFIG dial');
    s.materials.echo_fang = cap;
    ok(addMaterial(s, 'echo_fang', 1) === 0 && s.materials.echo_fang === cap,
      'market: a full store refuses the drop (the cap bites)');
    ok((s.stats.materialEarned.echo_fang ?? 0) === 0, 'market: a LOST drop never enters the ledger');
    ok(addMaterial(s, 'echo_fang', -3) === 0 && addMaterial(s, 'not_a_material', 1) === 0,
      'market: addMaterial guards junk (negative n, unknown id)');
  }

  // (d) Offer purity, eligibility, bands, rotation, voice.
  {
    const T = CONFIG.trade;
    const a1 = offersForDay('sim-day-1');
    ok(JSON.stringify(a1) === JSON.stringify(offersForDay('sim-day-1')),
      'market: same day -> byte-identical offers (pure function of the date)');
    const eligible = new Set(eligibleMaterialIds());
    ok(eligible.size === liveFaucets.length && !eligible.has('inspectors_seal') && !eligible.has('dragon_scale'),
      'market: eligibility = exactly the live faucet set; reserved materials can never be demanded');
    let badMat = 0, badBand = 0;
    const seen = new Set([JSON.stringify(a1)]);
    for (let d = 2; d <= 15; d++) {
      const dayOffers = offersForDay(`sim-day-${d}`);
      seen.add(JSON.stringify(dayOffers));
      for (const off of dayOffers) {
        const types = Object.keys(off.materials).length;
        if (types < T.typesMin || types > T.typesMax) badBand++;
        if (off.gold < T.goldMin || off.gold > T.goldMax) badBand++;
        for (const [mid, n] of Object.entries(off.materials)) {
          if (!eligible.has(mid)) badMat++;
          if (n < T.unitsMin || n > T.unitsMax) badBand++;
        }
      }
    }
    ok(badMat === 0, 'market: 15 days of offers demand ONLY live-faucet materials (eligibility law)');
    ok(badBand === 0, 'market: every recipe sits inside the CONFIG.trade bands');
    ok(seen.size > 1, 'market: rates ROTATE across days (the anti-greedy-bot property)');
    ok(describeOffer(a1[0]).includes('Iron Sword') && describeOffer(a1[0]).includes(`${a1[0].gold}g`),
      'market: the shared formatter names the item and the gold component');
    const voice = tradeBoardLine('sim-day-3');
    ok(voice.length > 0 && voice === tradeBoardLine('sim-day-3'),
      'market: the board voice line is deterministic per day');
  }

  // (e) Trade gates + exact execution math (built on the override seam — the headless day feed).
  {
    const s = shopState();
    s.tradeDayKeyOverride = 'sim-day-7';
    const offer = currentTradeOffers(s)[0];
    ok(!!offer && offer.key === 'sim-day-7:iron_sword', 'market: the override seam feeds a synthetic day');
    s.gold = 10000;
    for (const mid of Object.keys(offer.materials)) s.materials[mid] = 50;
    ok(canTrade(s, offer) === false, 'market: unlicensed -> no trade (the license stays the SELL gate)');
    s.licenses.iron_sword = true;
    const shortId = Object.keys(offer.materials)[0];
    s.materials[shortId] = offer.materials[shortId] - 1;
    ok(canTrade(s, offer) === false, 'market: one material short -> no trade');
    s.materials[shortId] = offer.materials[shortId];
    s.gold = offer.gold - 1;
    ok(canTrade(s, offer) === false, 'market: gold short -> no trade');
    s.gold = 10000;
    s.items.iron_sword.stock = effectiveMaxStock(s, 'iron_sword');
    ok(canTrade(s, offer) === false, 'market: full shelf -> no trade (stock cap holds)');
    s.items.iron_sword.stock = 0;
    const g0 = s.gold, mats0 = { ...s.materials };
    ok(executeTrade(s, offer.key) === true, 'market: the trade executes');
    ok(s.items.iron_sword.stock === 1, 'market: exactly +1 stock landed');
    ok(s.gold === g0 - offer.gold, 'market: exactly the gold component paid');
    let exact = true;
    for (const [mid, n] of Object.entries(offer.materials)) {
      if (s.materials[mid] !== mats0[mid] - n) exact = false;
    }
    ok(exact, 'market: exactly the recipe consumed, nothing else touched');
    ok(s.log.some((l) => l.text.includes('Iron Sword')), 'market: the trade speaks (TRADE_VOICE)');
    ok(executeTrade(s, 'sim-day-6:iron_sword') === false,
      'market: a STALE offer key refuses — nothing ever pays at yesterday\'s rate');
  }

  // (f) The exclusion sweep: no gold path can fill the trade tier.
  {
    const s = shopState();
    s.licenses.iron_sword = true;
    s.gold = 100000;
    s.items.iron_sword.stock = 0;
    ok(canRestock(s, 'iron_sword') === false, 'exclusion: canRestock refuses the trade tier');
    s.queue = [customer('slime', 'iron_sword', 99)];
    ok(trickleTarget(s) !== 'iron_sword', "exclusion: Greg's trickle never targets the trade tier");
    dealCrateUnits(s, 500);
    ok(s.items.iron_sword.stock === 0, 'exclusion: Market Day crates cannot mint trade-tier stock');
    restockAll(s);
    ok(s.items.iron_sword.stock === 0, 'exclusion: Restock All never fills the trade tier');
    // The quote prices only gold-fillable need: license everything, cap every gold item, leave
    // the trade item empty -> the quote is 0 and the button reads "Stocked".
    const s2 = shopState();
    for (const id of ITEM_ORDER) if (ITEMS[id].license) s2.licenses[id] = true;
    for (const id of ITEM_ORDER) {
      if ((ITEMS[id].acquisition ?? 'gold') === 'gold') s2.items[id].stock = effectiveMaxStock(s2, id);
    }
    s2.items.iron_sword.stock = 0;
    s2.gold = 10000;
    ok(restockAllCost(s2) === 0, 'exclusion: the quote ignores trade-tier need (empty sword quotes 0)');
    ok(canRestockAll(s2) === false, 'exclusion: "Stocked" stands even with the trade item empty');
  }

  // (g) Offline: the backroom reserve never conjures trade-tier units; REAL traded stock sells.
  {
    const s = shopState();
    s.workers.mimic_merchant.owned = true;
    s.licenses.iron_sword = true;
    s.upgrades.backroom_storage = 1;              // a reserve exists for every gold item
    s.items.iron_sword.stock = 2;                 // real, traded-for units on the shelf
    s.lastSeen = Date.now() - 3600 * 1000;        // one hour away
    const r = computeOffline(s, Date.now());
    ok((r.soldByItem.iron_sword ?? 0) === 2,
      'offline: trade-tier sales = the REAL shelf units exactly (reserve conjures nothing)');
  }

  // (h) Save round-trip + corrupt guards (the gold-guard pattern).
  {
    const s = shopState();
    s.materials.slime_core = 7;
    s.stats.materialEarned.slime_core = 9;
    const loaded = mergeSave(createInitialState(), JSON.parse(JSON.stringify(serializeSave(s))));
    ok(loaded.materials.slime_core === 7 && loaded.stats.materialEarned.slime_core === 9,
      'save: material stores + the lifetime ledger round-trip');
    const corrupt = mergeSave(createInitialState(),
      { materials: { slime_core: -5, fake_material: 3, echo_fang: 2.9 } });
    ok(corrupt.materials.slime_core === 0 && corrupt.materials.fake_material === undefined
      && corrupt.materials.echo_fang === 2,
      'save: corrupt materials clamp/drop/floor (negative -> 0, unknown -> gone, float -> int)');
  }
}

// 60. DEMMY the demon (reform step 3a, 2026-07-11) — the Apologetic Menace; roster/faucet exacts live here --
// The roster's first WINNER (combatMod +2 — the victory-as-apology register) and the market's
// demand engine (iron_sword signature on the new top budget). Exact-total doctrine: this is the
// newest batch, so the live roster/faucet/eligibility exacts are pinned HERE (§59 now derives).
{
  const { MONSTERS, MONSTER_IDS } = await import('./src/data/monsters.js');
  const { MATERIALS } = await import('./src/data/materials.js');
  const { eligibleMaterialIds } = await import('./src/data/trademarket.js');
  const { MONSTER_RESULTS } = await import('./src/data/results.js');
  const { spawnCustomer } = await import('./src/game.js');

  const d = MONSTERS.demon;
  ok(!!d && d.displayName === 'Demmy' && d.special === undefined,
    'demmy: registry row present, a NORMAL customer (never a special)');
  ok(d.combatMod === 2, 'demmy: combatMod +2 — the roster\'s first real threat');
  ok(d.budgetRange[0] === 20 && d.budgetRange[1] === 36 && d.budgetRange[0] > MONSTERS.frog.budgetRange[0],
    'demmy: the new top spender ([20,36], above Froggo)');
  ok(d.material === 'infernal_ember' && d.materialEveryNServes === 15 && !!MATERIALS.infernal_ember,
    'demmy: ember faucet paired, premium-rare N');
  ok(d.itemBias?.iron_sword === 3, 'demmy: the trade item leads his signature loves (the demand engine)');
  ok(d.footPad === 10 && d.spriteScale === undefined,
    'demmy: footPad 10 MEASURED; trio-class mass, no scale (the Beetley precedent)');
  ok(MONSTER_IDS.length >= 8 && MONSTER_IDS[6] === 'demon'
     && MONSTER_IDS[MONSTER_IDS.length - 1] === 'dragon',
    'demmy: demon at slot six; the special dragon row stays LAST (exact roster count lives in the newest batch)');
  ok(MONSTER_IDS.filter((id) => !MONSTERS[id].special && MONSTERS[id].material).length >= 7
     && eligibleMaterialIds().includes('infernal_ember'),
    'demmy: ember joined the live faucets and is recipe-eligible (exact faucet count: newest batch)');

  // Spawn membership: with the rest of the roster parked in-queue, only demon remains eligible.
  {
    const s = shopState();
    s.queue = MONSTER_IDS.filter((id) => id !== 'demon' && !MONSTERS[id].special)
      .map((id) => customer(id, 'club', 99));
    const c = spawnCustomer(s);
    ok(c?.monsterId === 'demon', 'demmy: in the normal spawn pool (uniqueness filter leaves only him)');
    ok(c.budget >= 20 && c.budget <= 36, 'demmy: budget rolls inside his band (no fame mult at tier 0)');
  }

  // Line ladder shape: the five battle tiers + leave + dismiss exist; exactly ONE golden, at 100.
  {
    const tiers = MONSTER_RESULTS.demon ?? {};
    ok(['excellent', 'success', 'partial', 'failure', 'funnyFailure', 'leave', 'dismiss']
      .every((t) => Array.isArray(tiers[t]) && tiers[t].length >= 2),
      'demmy: every tier authored (the win tiers are his home register)');
    const all = Object.values(tiers).flat().filter((t) => typeof t !== 'string');
    const goldens = all.filter((t) => t.golden === true);
    ok(goldens.length === 1 && goldens[0].minServes === 100,
      'demmy: exactly ONE golden line, a 100-serve privilege');
    ok(Object.values(tiers).flat().every((t) => (typeof t === 'string' ? t : t.text).length <= 80),
      'demmy: every line respects the 80-char log budget');
  }
}

// 61. LEGGSY the spider (reform step 3b, 2026-07-11) — the Overstocker; roster/faucet exacts live here --
// The bulkBuyer quirk: ONE serve moves TWO units when the shelf holds two and the purse covers
// double — one visit, one fight, one report, DOUBLE the sale. First demand-side pressure on
// stock depth. Exact-total doctrine: newest batch, so roster NINE / faucets EIGHT pin here.
{
  const { MONSTERS, MONSTER_IDS } = await import('./src/data/monsters.js');
  const { MATERIALS } = await import('./src/data/materials.js');
  const { eligibleMaterialIds } = await import('./src/data/trademarket.js');
  const { MONSTER_RESULTS } = await import('./src/data/results.js');
  const { ITEM_BREAKPOINTS } = await import('./src/data/milestones.js');

  const L = MONSTERS.spider;
  ok(!!L && L.displayName === 'Leggsy' && L.bulkBuyer === true && L.special === undefined,
    'leggsy: registry row present, bulkBuyer flagged, a NORMAL customer');
  ok(L.combatMod === 0 && L.budgetRange[0] === 14 && L.budgetRange[1] === 28,
    'leggsy: identity pins (mod 0, budget [14,28])');
  ok(L.material === 'silk_bundle' && L.materialEveryNServes === 12 && !!MATERIALS.silk_bundle,
    'leggsy: silk faucet paired, N 12');
  ok(L.itemBias?.bandages === 3 && L.footPad === 12 && L.spriteScale === 1.05,
    'leggsy: bandages lead the signatures; footPad 12 MEASURED; scale 1.05 PROVISIONAL');
  ok(MONSTER_IDS.length === 9 && MONSTER_IDS[7] === 'spider' && MONSTER_IDS[8] === 'dragon',
    'leggsy: roster EXACT nine; spider before the special dragon row');
  ok(MONSTER_IDS.filter((id) => !MONSTERS[id].special && MONSTERS[id].material).length === 8
     && eligibleMaterialIds().length === 8 && eligibleMaterialIds().includes('silk_bundle'),
    'leggsy: EIGHT live faucets — silk is recipe-eligible from day one');
  ok(Object.values(MONSTERS).filter((m) => m.bulkBuyer === true).length === 1,
    'leggsy: the only bulk buyer (the quirk stays hers until a row says otherwise)');

  // The bulk math, both ways. A parked shop (shopState) + a hand-built Leggsy at the counter.
  {
    const s = shopState();
    s.items.bandages.stock = 5;
    s.queue = [customer('spider', 'bandages', 28)];   // budget 28 >= 2x6: bulk fires
    const g0 = s.gold, sold0 = s.stats.itemSales.bandages;
    ok(serveCurrent(s) === true, 'bulk: the serve completes');
    ok(s.items.bandages.stock === 3, 'bulk: TWO units left the shelf');
    ok(s.stats.itemSales.bandages === sold0 + 2, 'bulk: the ledger counts both units');
    ok(s.gold - g0 === 12, 'bulk: exactly 2x the unit payout banked (2x6, no mults on a fresh save)');
    ok(s.stats.monsterServes.spider === 1, 'bulk: ONE visit on the serve ledger (rep rewards service)');
  }
  {
    const s = shopState();
    s.items.bandages.stock = 1;                        // shelf of one: graceful degrade, never a block
    s.queue = [customer('spider', 'bandages', 28)];
    serveCurrent(s);
    ok(s.items.bandages.stock === 0 && s.stats.itemSales.bandages === 1,
      'bulk: a single-unit shelf sells ONE (degrade, not deadlock)');
  }
  {
    const s = shopState();
    s.items.bandages.stock = 5;
    s.queue = [customer('spider', 'bandages', 11)];    // 11 < 12: covers one, not two
    serveCurrent(s);
    ok(s.items.bandages.stock === 4, 'bulk: a purse that covers one buys ONE');
  }
  {
    const s = shopState();                             // a non-bulk monster never doubles
    s.items.bandages.stock = 5;
    s.queue = [customer('slime', 'bandages', 99)];
    serveCurrent(s);
    ok(s.items.bandages.stock === 4, 'bulk: the flag gates the branch — Slimey buys one');
  }
  {
    // The skip-guard: a bulk sale jumping OVER a breakpoint still announces it (mult math is
    // total-derived either way; the LINE is what the guard protects).
    const bp = ITEM_BREAKPOINTS[0];
    const s = shopState();
    s.items.bandages.stock = 5;
    s.stats.itemSales.bandages = bp - 1;               // next bulk sale lands on bp+1, skipping bp
    s.queue = [customer('spider', 'bandages', 28)];
    serveCurrent(s);
    ok(s.stats.itemSales.bandages === bp + 1
       && s.log.some((l) => l.tier === 'milestone' && l.text.includes(String(bp))),
      `bulk: jumping over the ${bp}-sale breakpoint still speaks its milestone line`);
  }
  // Line ladder shape: five tiers + leave + dismiss; exactly ONE golden at 100; budgets hold.
  {
    const tiers = MONSTER_RESULTS.spider ?? {};
    ok(['excellent', 'success', 'partial', 'failure', 'funnyFailure', 'leave', 'dismiss']
      .every((t) => Array.isArray(tiers[t]) && tiers[t].length >= 2),
      'leggsy: every tier authored');
    const objs = Object.values(tiers).flat().filter((t) => typeof t !== 'string');
    const goldens = objs.filter((t) => t.golden === true);
    ok(goldens.length === 1 && goldens[0].minServes === 100,
      'leggsy: exactly ONE golden line, a 100-serve privilege');
    ok(Object.values(tiers).flat().every((t) => (typeof t === 'string' ? t : t.text).length <= 80),
      'leggsy: every line respects the 80-char log budget');
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
