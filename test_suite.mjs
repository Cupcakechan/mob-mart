// test_suite.mjs — the headless test suite (COMMITTED — the one test file that ships in the repo,
// via the !test_suite.mjs gitignore negation, so a fresh clone can verify itself; scratch probes
// stay test_*.mjs and stay ignored). Grown per pass since M4.
// Run: node test_suite.mjs   (exits non-zero on any failure)
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
// Batch-1 fixture: EXACT-MATH tests pin the live shelf to the launch trio (the arithmetic is the
// assertion; the shelf composition is fixture). 'empty' zeroes the free batch's stock (offline
// sims — the robin skips empties, so the old sequences hold); 'full' caps them (Restock-All
// quotes — a full item quotes 0). RULE tests instead iterate the live registry; never pin those.
const FREE_BATCH = ['tattered_shirt', 'bandages', 'wooden_shield', 'rusty_key'];
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
  }
  // Guard the guard: zero consumers means the regexes rotted, not that the code went clean.
  ok(consumers.size >= 1, `pairing scan found sprite consumers (found ${consumers.size})`);
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
    const s = shopState();
    for (const id of Object.keys(s.stats.itemSales)) s.stats.itemSales[id] = 50;   // laggard: flask at 49
    s.stats.itemSales.hp_flask = 49;
    s.items.hp_flask.stock = 3;
    s.queue = [customer('bat', 'hp_flask', 99)];
    serveCurrent(s);                                 // flask hits 50: item breakpoint + everything tier
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
    ok(s.queue.length >= 1 && s.queue[s.queue.length - 1].patienceRemaining === 29,
       'Warm Welcome L2: spawns at 24 + 8 = 32s (29 after the same 3.0s tick that spawned them)');
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
    ok(canBuyLicense(s, 'iron_sword') === false, 'license gated behind Renowned (lifetime tier)');
    s.lifetimeRep = 500;                              // Renowned
    ok(canBuyLicense(s, 'iron_sword') === true && canBuyLicense(s, 'knight_helm') === false,
       'Renowned licenses the sword; the helm waits for Legendary');
    ok(buyLicense(s, 'iron_sword') === true && s.gold === 4200 && s.licenses.iron_sword === true,
       'license purchase: -800 gold, flag set');
    ok(canBuyLicense(s, 'iron_sword') === false, 'a license is one-time');
    ok(canRestock(s, 'iron_sword') === true, 'licensed item becomes restockable');
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
    s2.licenses.iron_sword = true;
    const openR = computeOffline(s2, now2);
    ok((openR.soldByItem.iron_sword ?? 0) > 0, 'licensed tier-2 sells from the backroom reserve');
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
    buyLicense(s, 'iron_sword');                      // gold now 0
    s.gold = 5000;
    restockAll(s);
    ok(s.items.iron_sword.stock === 5, 'licensed tier-2 fills to cap with the rest');
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
  const { MONSTER_IDS } = await import('./src/data/monsters.js');
  const total = MONSTER_IDS.length * MONSTER_BREAKPOINTS.length;

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

  ok(MONSTER_IDS.includes('frog') && MONSTER_IDS.length === 4, 'roster: frog joined, four mobs');
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
    ok(seen > 40, `frog spawns at a real rate (uniform pick; saw ${seen}/400)`);
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
    for (let i = 0; i < 2000 && consumableWants < 150; i++) {
      const c = spawnCustomer(s);
      if (c.monsterId !== 'frog') continue;
      if (ITEMS[c.wantedItemId].category !== 'consumable') continue;
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
  // Two tag kinds since the line-unlock pass: cats (item-aware) and minServes (loyalty ladder);
  // a template may carry either or both. Guards per kind.
  const tagged = everyTemplate.filter((t) => typeof t !== 'string');
  ok(tagged.every((t) => typeof t.text === 'string'
       && (Array.isArray(t.cats) || Number.isInteger(t.minServes))),
     'templates: every object template has text + at least one tag (cats | minServes)');
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

  // Free-tier affordability INVARIANT: price <= the roster's minimum budget roll, from the LIVE
  // registry — a free-tier want can never strand a customer at cant-afford.
  const minRoll = Math.min(...MONSTER_IDS.map((id) => MONSTERS[id].budgetRange[0]));
  const free = batch.filter((id) => !ITEMS[id].license);
  ok(free.length === 4 && free.every((id) => ITEMS[id].basePrice <= minRoll),
     `batch 1: free four never strand (every price <= min roll ${minRoll})`);

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
  ok(ITEM_ORDER.length === 17 && ITEMS.iron_buckler && ITEMS.iron_gauntlet,
     'batch 2: both chain tops exist, ITEM_ORDER at 17');
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
  const { MONSTER_IDS } = await import('./src/data/monsters.js');
  const { MONSTER_BREAKPOINTS } = await import('./src/data/milestones.js');

  // Contract: every monster has a ladder (>=1 minServes line) AND exactly one golden line; goldens
  // sit at the 100-serve breakpoint (the memorable payoff Daniel asked for) and every minServes
  // value is a real loyalty breakpoint, so the Bestiary pips always mark real material.
  for (const id of MONSTER_IDS) {
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
    const s = shopState();
    s.stats.monsterServes.slime = 24;                // the 25th serve crosses the batch threshold
    s.queue = [customer('slime', 'club', 99)];
    serveCurrent(s);
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
  const budgetLines = nodes.reduce((a, n) => a + n.unlocks.filter((u) => u.kind === 'budget').length, 0);
  const total = nodes.reduce((a, n) => a + n.unlocks.length, 0);
  ok(total === UPGRADE_ORDER.length + PERK_ORDER.length + licensed.length + budgetLines,
     'fame track: unlock count = upgrades + perks + licenses + budget lines');

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
