// test_suite.mjs — the headless test suite (COMMITTED — the one test file that ships in the repo,
// via the !test_suite.mjs gitignore negation, so a fresh clone can verify itself; scratch probes
// stay test_*.mjs and stay ignored). Grown per pass since M4.
// Run: node test_suite.mjs   (exits non-zero on any failure)
import { createInitialState } from './src/state.js';
import { serializeSave, mergeSave } from './src/save.js';
import { CONFIG } from './src/config.js';   // F1a: threshold reads derive from the LIVE table
import { ITEMS, ITEM_ORDER } from './src/data/items.js';   // live-derived trio fixture (below)
import {
  update, serveCurrent, hireWorker, canHireWorker,
  effectiveWorkerInterval,
} from './src/game.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL:', msg); } };

// ---- THE SOURCE LAW (§88, 2026-07-16 — Daniel's Option 3). Every source pin reads through here.
// A pin matching RAW file text collides with comments in BOTH directions: a positive pin sails
// green because a comment contains the removed symbol (§72(f)), and a negative pin fails a correct
// tree because the comment retiring a dead claim quotes it (§79, then §85 the same day). Three
// instances in two days, and the recorded plug both early times was to REWORD THE PROSE — which is
// backwards: the comment was right and the scanner was wrong. A source pin wants to know about
// CODE, so it reads code. srcOf() strips comments per extension and caches per path (the suite
// used to re-read style.css ~10 times). rawSrc() is the NAMED escape hatch for the one contract
// that is ABOUT full file text: the Kong mirror subsequence, where comments must match too.
// §88 counts both: any new raw utf8 read, or any new rawSrc caller, goes red until it either
// migrates to srcOf or earns a place on the allow-list. The line-comment strip spares '://' so
// URLs in string literals survive (§85's proven pattern; the hazard scan of every read source
// found no other comment-lookalikes inside strings, 2026-07-16).
import { readFileSync as fsReadRaw } from 'node:fs';
const SRC_CACHE = new Map();
const srcOf = (path) => {
  if (SRC_CACHE.has(path)) return SRC_CACHE.get(path);
  let t = fsReadRaw(path, 'utf8');
  if (/\.html$/.test(path)) t = t.replace(/<!--[\s\S]*?-->/g, '');
  t = t.replace(/\/\*[\s\S]*?\*\//g, '');                       // block comments, all extensions
  if (/\.(js|mjs)$/.test(path)) t = t.replace(/(^|[^:])\/\/.*$/gm, '$1');   // line comments, JS only
  SRC_CACHE.set(path, t);
  return t;
};
const rawSrc = (path) => fsReadRaw(path, 'utf8');   // mirror-only; §88 counts its callers


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
    [...srcOf('./src/main.js').matchAll(/loadSprite\('([a-z_]+)'/g)].map((m) => m[1]),
  );
  const consumers = new Map();   // id -> first file naming it (makes a failure point at the culprit)
  for (const file of walk('./src')) {
    const src = srcOf(file);
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
  // MATERIAL iconIds reach the canvas board via getSprite(seg.iconId) — a VARIABLE, invisible to
  // the literal scan (the Pass B board-icon bug: registrations were missing and the graceful
  // "×n" fallback hid it). The registry IS the consumer list; every iconId must be registered.
  {
    const { MATERIALS, MATERIAL_ORDER } = await import('./src/data/materials.js');
    for (const mid of MATERIAL_ORDER) consumers.set(MATERIALS[mid].iconId, 'trademarket board (getSprite)');
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
    ok(r.rep === Math.round(9 * 2 * (CONFIG.offline?.repFraction ?? 1)),
       'offline: rep = sales × perSale × the fame haircut (F1a)');
    const gold0 = s.gold;
    ok(applyOffline(s, r) === true, 'applyOffline banks a non-zero result');
    ok(s.gold === gold0 + 132 && s.reputation === Math.round(18 * (CONFIG.offline?.repFraction ?? 1)),
       'apply adds gold + rep');
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
    ok(r.rep === Math.round(6 * 3 * (CONFIG.offline?.repFraction ?? 1)),
       'offline: Better Signage boosts offline rep/sale (× the fame haircut)');
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
    s.reputation = s.lifetimeRep = CONFIG.reputation.tiers[3].min;   // Beloved (live threshold) — tiers read the LIFETIME track (Fame)
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
    ok(r1.rep === Math.round((liveUnits + perLvlUnits) * 2 * (CONFIG.offline?.repFraction ?? 1)),
       'backroom L1: every sale grants rep (perSale × the fame haircut)');
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
    s.lifetimeRep = CONFIG.reputation.tiers[4].min; s.reputation = 0;   // Renowned earned (live
    ok(isUpgradeUnlocked(s, 'backroom_storage') === true, 'tier gates read LIFETIME (wallet at 0)');   // threshold), wallet empty
    ok(isPerkUnlocked(s, 'warm_welcome') === true, 'Renowned (new tier) unlocks Warm Welcome');
    ok(isPerkUnlocked(s, 'velvet_rope') === true && isPerkUnlocked(s, 'haggler_charm') === true,
       'lower-tier perks unlocked too');
    const low = shopState();
    low.lifetimeRep = CONFIG.reputation.tiers[3].min;                   // Beloved only (live threshold)
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
    // Specimen DERIVES (Pass B doctrine fix): greater_flask joined the trade tier, breaking the
    // Pass A swap — so the subject is now "the first licensed item that still gold-restocks",
    // and every number below reads from ITS registry row. No future tier move can break this.
    const spec = ITEM_ORDER.find((id) => ITEMS[id].license && (ITEMS[id].acquisition ?? 'gold') === 'gold');
    ok(!!spec, 'a licensed gold-acquired item exists to test the license flow');
    const lic = ITEMS[spec].license;
    s.lifetimeRep = 0;                                // tier 0: everything tier-gated
    ok(canBuyLicense(s, spec) === false, 'license gated behind its fame tier (lifetime tier)');
    s.lifetimeRep = 1e9;                              // every tier passed
    ok(canBuyLicense(s, spec) === true, 'the tier passed licenses the specimen');
    const g0 = s.gold;
    ok(buyLicense(s, spec) === true && s.gold === g0 - lic.cost && s.licenses[spec] === true,
       'license purchase: exactly the registry cost, flag set');
    ok(canBuyLicense(s, spec) === false, 'a license is one-time');
    ok(canRestock(s, spec) === true, 'licensed item becomes restockable');
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
    open.lifetimeRep = CONFIG.reputation.tiers[4].min; open.gold = 800;   // Renowned (live threshold)
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
    s.lifetimeRep = CONFIG.reputation.tiers[5].min;   // Legendary (live threshold, index 5) -> x1.30
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
    // Derived specimen (Pass B): the first licensed item still gold-acquired — the reserve path
    // must live for gold goods; the trade tier's zero-reserve is §59(g)'s pin.
    const spec2 = ITEM_ORDER.find((id) => ITEMS[id].license && (ITEMS[id].acquisition ?? 'gold') === 'gold');
    s2.licenses[spec2] = true;
    const openR = computeOffline(s2, now2);
    ok((openR.soldByItem[spec2] ?? 0) > 0, 'licensed tier-2 sells from the backroom reserve');
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
    const spec = ITEM_ORDER.find((id) => ITEMS[id].license && (ITEMS[id].acquisition ?? 'gold') === 'gold');
    s.lifetimeRep = 1e9;
    s.gold = ITEMS[spec].license.cost;
    buyLicense(s, spec);                              // gold now 0 (derived specimen, Pass B —
                                                      // the trade tier never gold-fills; §59(f))
    s.gold = 5000;
    restockAll(s);
    ok(s.items[spec].stock === 5, 'licensed tier-2 fills to cap with the rest');
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
     `bestiary: total scales with the GRID roster (${gridIds.length} x ${MONSTER_BREAKPOINTS.length} = ${total})`);

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
    s.items.greater_flask.stock = 5;                // DEMAND HONESTY (F2, 2026-07-13): stocked
      // -> x supplyWantBias.stocked (1), conditioning the SUPPLY contract out exactly as the
      // budget filter below conditions affordability out — §73 owns the supply contract; this
      // section stays a pure itemBias probe.
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
    // rawSrc ON PURPOSE (§88's allow-list): the mirror contract is about FULL file text —
    // comments included — so this is the one read that must NOT strip.
    const shellLines = rawSrc('./index.html').split('\n').map((l) => l.trimEnd());
    const kong = rawSrc('./index.kongregate.html').split('\n').map((l) => l.trimEnd());
    let k = 0;
    let missing = null;
    for (const line of shellLines) {
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

  // (a) The Mythic row: last rung, its min DERIVED from the level curve (F1a softened this
  // section's old 5000 pin to a rule — the exact curve pins live in the newest batch, §72);
  // Legendary players get their HUD goal line back.
  const top = CONFIG.reputation.tiers.at(-1);
  const L72 = CONFIG.reputation.levels;
  ok(top.label === 'Mythic' && top.min === Math.round(L72.base * L72.growth ** (top.level - 1)),
     'mythic: the reserved rung is live, min derived from the level curve');
  ok(reputationTier(top.min).index === CONFIG.reputation.tiers.length - 1
     && reputationTier(top.min - 1).label === 'Legendary',
     'mythic: the live threshold crosses, one below stays Legendary');
  ok(nextTierInfo(CONFIG.reputation.tiers[5].min)?.label === 'Mythic',
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
    s.gold = 1e9; s.lifetimeRep = CONFIG.reputation.tiers[5].min;   // Legendary (live), deep band still shut
    const g0 = s.gold;
    for (let i = 0; i < 5; i++) ok(buyWorkerLevel(s, 'mimic_merchant'), `sinks: level ${i + 1} buys at Legendary`);
    ok(g0 - s.gold === 13485, `sinks: the shallow band costs exactly 13485 (spent ${g0 - s.gold})`);
    ok(canBuyWorkerLevel(s, 'mimic_merchant') === false, 'sinks: level 6 refuses below Mythic');
    s.lifetimeRep = CONFIG.reputation.tiers[6].min;              // cross the rung (live Mythic)
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
    s.lifetimeRep = CONFIG.reputation.tiers[5].min;              // Legendary (live, requiredTier 5)
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
    s.lifetimeRep = CONFIG.reputation.tiers[6].min;              // Mythic (live): x1.45
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

  // Unhired card copy (2026-07-13): every worker carries an authored in-voice pitch, and Doug's
  // never mislabels him as a restocker (the bug the pitch field replaced — panels.js line 579).
  ok(WORKER_ORDER.every((id) => typeof WORKERS[id].pitch === 'string' && WORKERS[id].pitch.length > 0
       && WORKERS[id].pitch.length <= 80),
     'workers: every worker has an authored unhired pitch (<=80 chars, the log-width law)');
  ok(!/restock/i.test(WORKERS.scavenger.pitch) && /good bits|finds|shinies/i.test(WORKERS.scavenger.pitch),
     'doug: the unhired pitch is in Doug\u2019s voice, never "restocker" (the line-579 regression guard)');

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
  // (Softened for the relic rework: restores now also cost MATERIALS — granted here from the
  // live registry so this section keeps owning the scrap/gold math; §69 owns the material laws.)
  ok(!canRestoreRelic(run, 'yesterday_potion'), 'forge: an unfound relic cannot be restored');
  run.scrap = RELICS.skeleton_key.restoreCost.scrap - 1; run.gold = 1e9;
  run.materials ??= {};
  for (const [mid, n] of Object.entries(RELICS.skeleton_key.restoreCost.materials ?? {})) run.materials[mid] = n;
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
  ok(MONSTERS.dragon.special === true,
    'market: the dragon row stays special — the serve-drop law\'s !special guard covers his materials');
  ok(tradeItemIds().includes('iron_sword') && tradeItemIds().length >= 1,
    'market: the Pass A proof stays in the tier (exact tier size lives in the newest batch — §63)');
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

// 62. EXPEDITIONS MVP (reform step 4, 2026-07-11) — one monster, one door, one slot ---------------
// The targeted-supply loop: family pick IS the targeting; fee is a service price; a mishap is
// half haul rounded up, never zero, NEVER death (split loops — the battle log's gag untouched).
{
  const { MONSTERS, MONSTER_IDS } = await import('./src/data/monsters.js');
  const { canStartExpedition, startExpedition, resolveExpedition } = await import('./src/game.js');
  const { EXPEDITION_VOICE, EXPEDITION_DESTINATIONS } = await import('./src/data/results.js');
  const { CONFIG } = await import('./src/config.js');
  const E = CONFIG.expedition;
  ok(!!E && E.fee > 0 && E.durationSec > 0 && E.haul > 0 && E.mishapChance >= 0 && E.mishapChance < 1,
    'expedition: the config block exists with sane dials');
  ok(EXPEDITION_DESTINATIONS.length === 6, 'expedition: six door destinations (the flavor law)');
  ok(Object.values(EXPEDITION_VOICE).flat().every((t) => t.length <= 80),
    'expedition: every voice line respects the 80-char log budget');

  // Gates.
  {
    const s = shopState();
    s.gold = E.fee - 1;
    ok(canStartExpedition(s, 'slime') === false, 'expedition: fee-short refuses');
    s.gold = E.fee;
    ok(canStartExpedition(s, 'dragon') === false, 'expedition: the Inspector NEVER runs errands (special)');
    ok(canStartExpedition(s, 'nonsense') === false, 'expedition: unknown family refuses');
    ok(canStartExpedition(s, 'slime') === true, 'expedition: a funded slime run is a go');
  }

  // Start effects + the one-slot law.
  {
    const s = shopState();
    s.gold = 100;
    ok(startExpedition(s, 'bat') === true, 'expedition: starts');
    ok(s.gold === 100 - E.fee, 'expedition: exactly the fee paid');
    ok(s.expedition?.monsterId === 'bat' && s.expedition.remaining === E.durationSec
       && EXPEDITION_DESTINATIONS.includes(s.expedition.dest),
      'expedition: the slot carries family, a real destination, the full clock');
    ok(s.log.some((l) => l.text.includes('Batty')), 'expedition: the departure speaks');
    ok(canStartExpedition(s, 'slime') === false && startExpedition(s, 'slime') === false,
      'expedition: ONE slot — a second run refuses while the first is out');
  }

  // Resolve, both paths (Math.random forced — the mishap die is the only RNG in the system).
  {
    const real = Math.random;
    const s = shopState();
    s.gold = 100;
    startExpedition(s, 'slime');
    s.expedition.remaining = 0.05;
    Math.random = () => 0.99;                          // above mishapChance: clean return
    update(s, 0.1);
    Math.random = real;
    ok(s.expedition === null, 'expedition: the tick at zero resolves and frees the slot');
    ok(s.materials.slime_core === E.haul, `expedition: clean return lands the FULL haul (${E.haul})`);
    ok(s.stats.expeditions.slime === 1, 'expedition: the run ledger counts the family');
    ok(s.log.some((l) => l.text.includes(`${E.haul} Condensed Slime Core`)),
      'expedition: the return line reports the haul');
  }
  {
    const real = Math.random;
    const s = shopState();
    s.gold = 100;
    startExpedition(s, 'frog');
    s.expedition.remaining = 0;
    Math.random = () => 0.0;                           // below mishapChance: the pratfall
    update(s, 0.1);
    Math.random = real;
    const half = Math.ceil(E.haul / 2);
    ok(s.materials.bogstone_bauble === half,
      `expedition: a mishap lands HALF rounded up (${half}) — never zero, never death`);
    ok(s.stats.expeditions.frog === 1, 'expedition: a mishap still counts as a run');
  }

  // Cap interplay: the store clamps; the ledger stays honest (the addMaterial law, unchanged).
  {
    const real = Math.random;
    const s = shopState();
    s.gold = 100;
    s.materials.echo_fang = (CONFIG.materials?.baseCap ?? 10) - 1;   // room for ONE
    startExpedition(s, 'bat');
    s.expedition.remaining = 0;
    Math.random = () => 0.99;
    update(s, 0.1);
    Math.random = real;
    ok(s.materials.echo_fang === (CONFIG.materials?.baseCap ?? 10),
      'expedition: a nearly-full store clamps the haul at cap (the cap law bites bursts too)');
  }

  // The away credit: main.js subtracts the absence; the first tick resolves. Modeled here.
  {
    const real = Math.random;
    const s = shopState();
    s.gold = 100;
    startExpedition(s, 'rat');
    s.expedition.remaining = Math.max(0, s.expedition.remaining - 3600);   // an hour away
    Math.random = () => 0.99;
    update(s, 0.1);
    Math.random = real;
    ok(s.expedition === null && s.materials.stolen_trinket === E.haul,
      'expedition: a run that finished while away completes on the first tick after boot');
  }

  // Save: an in-flight run round-trips; corruption drops the run, never crashes.
  {
    const s = shopState();
    s.gold = 100;
    startExpedition(s, 'beetle');
    s.expedition.remaining = 17.5;
    s.stats.expeditions.beetle = 4;
    const loaded = mergeSave(createInitialState(), JSON.parse(JSON.stringify(serializeSave(s))));
    ok(loaded.expedition?.monsterId === 'beetle' && Math.abs(loaded.expedition.remaining - 17.5) < 0.01
       && loaded.stats.expeditions.beetle === 4,
      'expedition: an in-flight run + the ledger round-trip the save');
    const corrupt = mergeSave(createInitialState(),
      { expedition: { monsterId: 'dragon', remaining: 1e9 } });
    ok(corrupt.expedition === null,
      'expedition: a corrupt run (special/unknown family) drops whole — fee gone, crash never');
    const clamped = mergeSave(createInitialState(),
      { expedition: { monsterId: 'slime', dest: 'x', remaining: 1e9 } });
    ok(clamped.expedition.remaining === E.durationSec,
      'expedition: an edited clock clamps into the config band');
  }
}

// 63. MARKET PASS B (2026-07-11) — the full tier, derived recipe gold, the Inspector's drops,
// the forecast. Newest batch: the tier/eligibility EXACTS live here (§59 now derives).
{
  const { MONSTERS } = await import('./src/data/monsters.js');
  const { tradeItemIds, eligibleMaterialIds, offersForDay, forecastDayKey, featuredOffer }
    = await import('./src/data/trademarket.js');
  const { effectiveMaxStock } = await import('./src/game.js');
  const { CONFIG } = await import('./src/config.js');

  // (a) The tier line, exactly as Daniel confirmed: ten trade, base + workman's goods gold.
  const TIER = ['iron_sword', 'greater_flask', 'knight_helm', 'quiver', 'zip_tonic',
    'iron_buckler', 'iron_gauntlet', 'silver_key', 'spiked_club', 'iron_shield'];
  const tier = tradeItemIds();
  ok(tier.length === 10 && TIER.every((id) => tier.includes(id)),
    'passB: the trade tier is EXACTLY the confirmed ten');
  for (const id of ['murk_tonic', 'leather_bracer', 'pickaxe', 'map', 'salt']) {
    ok((ITEMS[id].acquisition ?? 'gold') === 'gold', `passB: ${id} stays gold (workman's goods)`);
  }
  ok((ITEMS.bandages.acquisition ?? 'gold') === 'gold' && (ITEMS.club.acquisition ?? 'gold') === 'gold',
    'passB: the license-free basics stay gold forever');

  // (b) Derived recipe gold: every offer's PRE-DISCOUNT gold sits inside basePrice × the mult
  // band. (Softened for the daily special — the discount pass legally prices the featured offer
  // BELOW the band floor; its exact laws live in the newest batch, §65.)
  {
    const lo = CONFIG.trade.goldMultMin, hi = CONFIG.trade.goldMultMax;
    let bad = 0;
    for (let d = 1; d <= 10; d++) {
      for (const off of offersForDay(`sim-day-${d}`)) {
        const g = off.origGold ?? off.gold;
        const bp = ITEMS[off.itemId].basePrice;
        if (g < Math.round(bp * lo) || g > Math.round(bp * hi)) bad++;
      }
    }
    ok(bad === 0, 'passB: 10 days × 10 offers — every gold component derives from its item\'s value');
    ok(offersForDay('sim-day-1').length === 10, 'passB: ten offers posted per day (one per tier item)');
  }

  // (c) The Inspector's drops: Scale per visit; Seal ONLY at top grade; both recipe-excluded.
  ok(MONSTERS.dragon.material === 'dragon_scale' && MONSTERS.dragon.gradeMaterial === 'inspectors_seal',
    'passB: the dragon row carries both VIP drops (registry-driven)');
  ok(!eligibleMaterialIds().includes('dragon_scale') && !eligibleMaterialIds().includes('inspectors_seal'),
    'passB: the Inspector\'s materials NEVER enter trade recipes (reserved — Seal is for relics)');
  {
    const s = shopState();
    for (const id of ITEM_ORDER) s.items[id].stock = 0;   // near-empty shelves (the club below
                                       // stocks for the serve, so fullness is small, NOT zero)
    s.items.club.stock = 5;
    s.queue = [customer('dragon', 'club', 999)];
    s.serveCooldown = 0;
    // Softened for the relic rework's SEAL SLOPE: sub-guarantee fullness is a CHANCE now, so
    // the die is forced HIGH — the rule this section keeps is "a shabby shelf never guarantees
    // the Seal"; the slope's own math lives in §69.
    const realRand = Math.random;
    try { Math.random = () => 0.99; serveCurrent(s); } finally { Math.random = realRand; }
    ok(s.materials.dragon_scale === 1, 'passB: a visit drops ONE Dragon Scale (standard shedding)');
    ok((s.materials.inspectors_seal ?? 0) === 0, 'passB: a shabby inspection earns NO Seal');
    // Now a top-grade shelf: fill every unlocked item to cap before he walks in.
    const s2 = shopState();
    for (const id of ITEM_ORDER) {
      if (!ITEMS[id].license) s2.items[id].stock = effectiveMaxStock(s2, id);
    }
    s2.queue = [customer('dragon', 'club', 999)];
    s2.serveCooldown = 0;
    serveCurrent(s2);
    ok(s2.materials.inspectors_seal === 1, 'passB: a TOP-GRADE inspection stamps the Seal');
    ok(s2.materials.dragon_scale === 1, 'passB: the Scale rides that visit too');
    ok(s2.log.some((l) => l.text.includes('Seal')), 'passB: the Seal moment speaks');
  }

  // (d) The forecast: deterministic tomorrow, both key branches; the featured pick is stable.
  ok(forecastDayKey({ tradeDayKeyOverride: 'sim-day-7' }) === 'sim-day-8',
    'passB: the synthetic-day branch increments (headless forecast)');
  ok(typeof forecastDayKey({}) === 'string' && forecastDayKey({}).length >= 8,
    'passB: the live branch yields a calendar key');
  {
    const f1 = featuredOffer('sim-day-4'), f2 = featuredOffer('sim-day-4');
    ok(!!f1 && JSON.stringify(f1) === JSON.stringify(f2)
       && offersForDay('sim-day-4').some((o) => o.key === f1.key),
      'passB: the featured offer is deterministic and one of the day\'s ten');
  }

  // (e) The iconic segment form (Pass B UI-fix — the board + list both render it): text/icon
  // parts, one icon per material with its count, gold in the tail.
  {
    const { describeOfferSegments } = await import('./src/data/trademarket.js');
    const off = offersForDay('sim-day-4').find((o) => o.itemId === 'iron_sword');
    const segs = describeOfferSegments(off);
    const icons = segs.filter((s) => s.t === 'icon');
    ok(icons.length === Object.keys(off.materials).length,
      'passB: one icon segment per recipe material');
    ok(icons.every((s) => s.iconId && s.n >= 1 && s.mid),
      'passB: each icon segment carries its art id, count, and material id');
    ok(segs.some((s) => s.t === 'text' && s.s.includes(`${off.gold}g`)),
      'passB: the gold component rides a trailing text segment');
    ok(describeOfferSegments(null).length === 0, 'passB: a null offer yields no segments (guard)');
  }
  // (f) The cascade guard, RETARGETED by §87 (2026-07-16): the scoped .offer-row.hidden override
  // this pin used to demand is retired — the utility is !important now, so .offer-row's own
  // display:flex cannot out-cascade a hide. The pin softens to the law that replaced it
  // (exact residence: §87). Original defect for the record (late display:flex beat .hidden by
  // order) shipped once and cost a full QA round. Text-pin, the Kongregate-subsequence style.
  {
    const { readFileSync } = await import('node:fs');
    const css = srcOf('./style.css');
    ok(css.includes('.hidden{display:none !important;}'),
      'passB: the hide utility out-cascades .offer-row\u2019s own display (§87\u2019s law \u2014 the scoped override this pin used to check is retired)');
  }
}

// ================= SECTION 64 — the Trade Market OVERLAY (D6-B pulled forward, 2026-07-12) =====
// The relocation pass: the offer list moved from the Shop strip to a dedicated overlay opened by
// the canvas board (hit-tested) or the strip's Open Market button. Exact tier totals stay §63's;
// this section owns the hit-rect derivation law, the FULL-NAME row law, and the wiring pins.
{
  // (a) The board hit rect DERIVES from the draw constants — inside the stage, non-degenerate,
  // and the point test agrees with the rect (center hits, outside misses).
  const { boardHitRect, pointOnBoard } = await import('./src/render/scene.js');
  const r = boardHitRect();
  ok(r.w > 0 && r.h > 0, 'overlay: board hit rect has area');
  ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1280 && r.y + r.h <= 720,
    'overlay: hit rect sits inside the 1280x720 stage');
  ok(pointOnBoard(r.x + r.w / 2, r.y + r.h / 2), 'overlay: the board center hits');
  ok(!pointOnBoard(0, 0) && !pointOnBoard(r.x - 1, r.y) && !pointOnBoard(r.x, r.y + r.h + 1),
    'overlay: points outside the rect miss');

  // (b) The FULL-NAME row law (this pass's reason to exist): every recipe material renders its
  // registry displayName — the strip's icon-only rows taught nothing. Derived from the live
  // registries via a fixed sim-day, never hand-typed.
  const { offerRowHtml } = await import('./src/ui/market.js');
  const { offersForDay } = await import('./src/data/trademarket.js');
  const { MATERIALS: MATS64 } = await import('./src/data/materials.js');
  const { ITEMS: ITEMS64 } = await import('./src/data/items.js');
  const offers64 = offersForDay('sim-day-4');
  ok(offers64.length > 0, 'overlay: sim-day-4 posts offers (the fixture day)');
  for (const off of offers64) {
    const html = offerRowHtml(off, { gold: 0, materials: {} });
    ok(html.includes(ITEMS64[off.itemId].displayName),
      `overlay: ${off.itemId} row carries the item display name`);
    for (const mid of Object.keys(off.materials))
      ok(html.includes(MATS64[mid].displayName),
        `overlay: ${off.itemId} row spells out '${MATS64[mid].displayName}' (the full-name law)`);
    ok(html.includes(`${off.gold}g`), `overlay: ${off.itemId} row carries the gold component`);
  }
  const probe = offers64[0];
  ok(offerRowHtml(probe, { gold: 0, materials: {} }).includes('mat-short'),
    'overlay: empty pockets tint short');
  const fullPockets = { gold: 1e9, materials: Object.fromEntries(Object.keys(probe.materials).map((m) => [m, 999])) };
  ok(!offerRowHtml(probe, fullPockets).includes('mat-short'), 'overlay: full pockets never tint short');
  ok(offerRowHtml(null, { gold: 0 }) === '', 'overlay: a null offer yields empty html (guard)');

  // (c) Wiring pins (the §63f house pattern — text, not behavior, where headless can't reach):
  // the scoped .hidden override (the overlay sets its own display — the cascade-tie law), the
  // shell's overlay root, the strip's door, the pure relocation, and the derived hit test.
  const { readFileSync: rf64 } = await import('node:fs');
  const css64 = srcOf('./style.css');
  ok(css64.includes('.hidden{display:none !important;}'),
    'overlay: the hide utility out-cascades .market-overlay\u2019s own display:flex (§87\u2019s law; the scoped override is retired)');
  ok(srcOf('./index.html').includes('id="market-overlay"'),
    'overlay: the shell carries the overlay root');
  const pnl64 = srcOf('./src/ui/panels.js');
  ok(pnl64.includes('open-market-btn'), 'overlay: the strip keeps its Open Market door');
  ok(!pnl64.includes('id="market-offers"'),
    'overlay: the strip no longer hosts the offer list (the pure-relocation law)');
  ok(srcOf('./src/main.js').includes('pointOnBoard'),
    'overlay: the canvas click routes through the DERIVED hit test, never hand-copied numbers');
}

// ============ SECTION 65 — the DAILY SPECIAL discount (Pass B of the overlay arc, Option 3) ====
// Daniel's call: gold discounts alone decay (gold is the runaway currency), so the special cuts
// BOTH — gold × feature.goldMult, plus one unit off the largest material stack where one exists.
// The discount lives on the offer object in offersForDay (one price, every surface); this section
// owns its exact laws. All expectations DERIVE from the live CONFIG dials, never hand-typed.
{
  const { offersForDay: off65, featuredOffer: feat65, describeOffer: desc65, describeOfferSegments: segs65 }
    = await import('./src/data/trademarket.js');
  const { CONFIG: CFG65 } = await import('./src/config.js');
  const { offerRowHtml: row65 } = await import('./src/ui/market.js');
  const F = CFG65.trade.feature;
  ok(F && F.goldMult > 0 && F.goldMult < 1, 'special: goldMult is a real discount (0 < mult < 1)');
  ok((F.matUnitsOff ?? 1) >= 1, 'special: matUnitsOff cuts at least one unit');

  let cutDays = 0, all1sDays = 0;
  for (let d = 1; d <= 40; d++) {
    const offers = off65(`sim-day-${d}`);
    const featured = offers.filter((o) => o.featured);
    ok(featured.length === 1, `special: sim-day-${d} marks exactly ONE featured offer`);
    const f = featured[0];
    ok(f.gold === Math.round(f.origGold * F.goldMult),
      `special: sim-day-${d} featured gold = round(orig × ${F.goldMult}) (derived, one dial)`);
    ok(feat65(`sim-day-${d}`).key === f.key, 'special: featuredOffer finds the marked one (one hash, one mark)');
    for (const n of Object.values(f.materials)) ok(n >= 1, 'special: no stack ever cut below 1 (the clamp law)');
    if (f.origMaterials) {
      cutDays++;
      const cutMids = Object.keys(f.origMaterials).filter((m) => f.origMaterials[m] !== f.materials[m]);
      ok(cutMids.length === 1, 'special: exactly one stack takes the cut');
      ok(f.origMaterials[cutMids[0]] - f.materials[cutMids[0]] === Math.min(F.matUnitsOff, f.origMaterials[cutMids[0]] - 1),
        'special: the cut is matUnitsOff deep, clamp respected');
      ok(Object.values(f.origMaterials).every((n) => n <= f.origMaterials[cutMids[0]]),
        'special: the cut lands on the LARGEST stack');
    } else {
      all1sDays++;
      ok(Object.values(f.materials).every((n) => n === 1),
        'special: no origMaterials means an all-1s recipe (the gold-only fallback)');
    }
    for (const o of offers) if (!o.featured) {
      ok(o.origGold === undefined && o.origMaterials === undefined,
        'special: non-featured offers carry no discount fields (the mark is exclusive)');
    }
  }
  ok(cutDays > 0, `special: the material cut occurs in 40 days (found ${cutDays}) — guard-the-guard`);
  // (all-1s fallback days may legitimately be zero at current unit bands; counted, not required)

  // Determinism survives the mutation-in-place: two calls, identical JSON.
  ok(JSON.stringify(off65('sim-day-7')) === JSON.stringify(off65('sim-day-7')),
    'special: offersForDay stays a pure function of the day key');

  // The displays sell the deal: the shared describers append the was-price; the overlay row
  // strikes the original gold (and the cut stack's count where one was cut).
  const f7 = feat65('sim-day-7');
  ok(desc65(f7).includes(`(was ${f7.origGold}g)`), 'special: describeOffer appends the was-price');
  ok(segs65(f7).some((s) => s.t === 'text' && s.s.includes(`(was ${f7.origGold}g)`)),
    'special: the iconic segments carry the was-price (describer contract; the ticker\'s likely consumer)');
  const html65 = row65(f7, { gold: 0, materials: {} });
  ok(html65.includes(`<s class="offer-was">${f7.origGold}g</s>`), 'special: the overlay row strikes the original gold');
  if (f7.origMaterials) {
    const cut = Object.keys(f7.origMaterials).find((m) => f7.origMaterials[m] !== f7.materials[m]);
    ok(html65.includes(`<s class="offer-was">${f7.origMaterials[cut]}</s>`),
      'special: the overlay row strikes the cut stack\'s original count');
  }
}

// ================== SECTION 66 — the Market Board SALE SIGN (board rework, Option 2) ==========
// The board advertises, the overlay informs (Daniel's framing): two short derived lines, no
// recipes — structurally immune to the recipe-length overflow class. Every expectation derives
// from the live registries and dials.
{
  const { boardLines: bl66, featuredOffer: feat66, tradeDayKey: tdk66, forecastDayKey: fdk66 }
    = await import('./src/data/trademarket.js');
  const { eventIdForDay: eid66 } = await import('./src/data/marketevents.js');   // F4: contentKey pin
  const { CONFIG: CFG66 } = await import('./src/config.js');
  const { ITEMS: ITEMS66 } = await import('./src/data/items.js');
  const pct66 = Math.round((1 - CFG66.trade.feature.goldMult) * 100);
  // RETARGETED by the board restructure (Daniel's Option 2, 2026-07-16): today->deal (demoted to
  // the second line), tomorrow->GONE from the plank (the overlay's footer carries it — pinned in
  // §90), headline/quip are §90's to pin. The overflow and no-recipe laws carry over unchanged.
  for (const d of [1, 7, 23]) {
    const s = { tradeDayKeyOverride: `sim-day-${d}` };
    const L = bl66(s);
    const t = feat66(tdk66(s));
    ok(L.deal === `Deal: ${ITEMS66[t.itemId].displayName} — ${pct66}% off`,
      `sign: sim-day-${d} deal line derives from the featured item + the live dial`);
    ok(L.tomorrow === undefined,
      `sign: sim-day-${d} the forecast is OFF the plank (the overlay footer is its home now)`);
    ok(!L.deal.includes('⇐') && !(L.headline ?? '').includes('⇐'),
      `sign: sim-day-${d} no recipe glyphs on the sign — the board advertises, the overlay informs`);
    ok(L.contentKey === `${t.key}|${eid66(tdk66(s))}`,
      `sign: sim-day-${d} contentKey composes the offer + today's event (the chalk re-write trigger)`);
  }
  // The scene consumes boardLines, not the recipe segments (the wiring pin, §64's style).
  const { readFileSync: rf66 } = await import('node:fs');
  const scene66 = srcOf('./src/render/scene.js');
  ok(scene66.includes('boardLines'), 'sign: scene.js renders the sale sign via boardLines');
  ok(!scene66.includes('describeOfferSegments'),
    'sign: scene.js no longer builds recipe segments for the board (the ad, not the data)');
}

// ========== SECTION 67 — the LED TICKER (Pass C, Option 3: real movement) + the two riders =====
// The crawl's segments derive from ACTUAL day-over-day rates (pre-discount gold both sides — the
// special's cut is a sale, not a market move) interleaved with day-seeded quips. Riders: the
// card trade-hint is a door; the board gets hover-cursor feedback.
{
  const { tickerSegments: tick67, yesterdayKey: yk67, offersForDay: off67, tradeDayKey: tdk67 }
    = await import('./src/data/trademarket.js');
  const { TRADE_VOICE: TV67 } = await import('./src/data/results.js');
  const { MATERIALS: M67, MATERIAL_ORDER: MO67 } = await import('./src/data/materials.js');

  // (a) yesterdayKey mirrors the forecast contract.
  ok(yk67({ tradeDayKeyOverride: 'sim-day-7' }) === 'sim-day-6', 'ticker: yesterday of sim-day-7 is sim-day-6');
  ok(yk67({ tradeDayKeyOverride: 'weird-key' }) === 'weird-key-1', 'ticker: odd overrides get the stable -1 suffix');

  // (b) Movement math: every move segment's pct re-derives from the two days' PRE-DISCOUNT golds.
  {
    const s = { tradeDayKeyOverride: 'sim-day-7' };
    const segs = tick67(s);
    const today = off67('sim-day-7'), yest = off67('sim-day-6');
    const moves = segs.filter((x) => x.t === 'move');
    ok(moves.length === today.length, 'ticker: one move segment per posted offer');
    const { ITEMS: I67 } = await import('./src/data/items.js');
    let discountDiffers = 0;
    for (const o of today) {
      const tg = o.origGold ?? o.gold;
      const yg = (() => { const y = yest.find((x) => x.itemId === o.itemId); return y ? (y.origGold ?? y.gold) : tg; })();
      const expect = yg > 0 ? Math.round(((tg - yg) / yg) * 100) : 0;
      const m = moves.find((x) => x.name === I67[o.itemId].displayName.toUpperCase());
      ok(m && m.pct === expect, `ticker: ${o.itemId} movement derives from pre-discount golds (${expect}%)`);
      if (o.featured) {
        const wrong = Math.round(((o.gold - yg) / yg) * 100);
        if (wrong !== expect) { discountDiffers++; ok(m.pct !== wrong, 'ticker: the special\'s SALE price never leaks into the movement'); }
      }
    }
    ok(discountDiffers >= 0, 'ticker: discount-exclusion checked where derivable');
    ok(JSON.stringify(tick67(s)) === JSON.stringify(tick67(s)), 'ticker: segments are a pure function of the day');
    ok(segs.some((x) => x.t === 'quip'), 'ticker: quips interleave the movers');
    ok(!segs.some((x) => (x.s ?? x.name).includes('{mat}') || (x.s ?? '').includes('undefined') || String(x.pct).includes('NaN')),
      'ticker: no unresolved templates, undefineds, or NaNs in the crawl');
  }

  // (c) The bible's length law holds at render: every pool line, substituted with the LONGEST
  // eligible material name, stays <= 80 chars (derived from the live registry, never hand-typed).
  {
    const longest = MO67.map((id) => M67[id].displayName).reduce((a, b) => (b.length > a.length ? b : a), '');
    for (const line of TV67.ticker) {
      const rendered = line.replaceAll('{mat}', longest.toUpperCase());
      ok(rendered.length <= 80, `ticker: pool line stays <=80 rendered ("${rendered.slice(0, 30)}…" = ${rendered.length})`);
    }
    ok(TV67.ticker.length >= 8, 'ticker: the pool is deep enough to vary day-to-day');
  }

  // (d) Wiring pins (the house pattern).
  const { readFileSync: rf67 } = await import('node:fs');
  const css67 = srcOf('./style.css');
  ok(css67.includes('ticker-crawl') && css67.includes('.market-ticker'), 'ticker: the crawl CSS shipped');
  ok(css67.includes('.ticker-track{animation:none;}'), 'ticker: prefers-reduced-motion shows the strip static');
  const mkt67 = srcOf('./src/ui/market.js');
  ok(mkt67.includes('tickerKey'), 'ticker: the crawl rebuilds on day rollover only (the animation-restart guard)');
  const pnl67 = srcOf('./src/ui/panels.js');
  ok(pnl67.includes(`querySelectorAll('.trade-hint')`), 'rider: every card hint is wired as a Market door');
  ok(srcOf('./src/main.js').includes('mousemove'), 'rider: the board hit rect drives the hover cursor');
}

// ============ SECTION 68 — Greg's GOLD-ONLY bubble (the Greg-chip fix, Option-2 retirement) ====
// The shipped bug: the bubble quoted a gold restock for material-made stock. The first fix (a
// trade-mode door) proved a nag — trade outages are the STEADY STATE under single-unit trading,
// so Greg cycled the tier forever. Retirement law: Greg reports only what a gold click can fix;
// the filter lives on BOTH sides (the render target pick and the game-side cycle trigger).
{
  const { gregBubbleFor: gb68 } = await import('./src/ui/panels.js');
  const { ITEMS: I68 } = await import('./src/data/items.js');
  const { effectiveRestockCost: erc68 } = await import('./src/game.js');
  const tradeId = Object.keys(I68).find((id) => (I68[id].acquisition ?? 'gold') !== 'gold');
  const goldId = Object.keys(I68).find((id) => (I68[id].acquisition ?? 'gold') === 'gold');
  ok(!!tradeId && !!goldId, 'greg: both acquisition kinds exist in the registry (fixture)');

  const s = shopState();
  s.gold = 1e9;
  ok(gb68(s, tradeId) === null,
    'greg: a trade target yields NO bubble (the retirement law — never a quote, never a nag)');
  const g = gb68(s, goldId);
  ok(g && g.html.includes(`Restock &#9670; ${erc68(s, goldId)}`),
    'greg: a gold target quotes the live effective cost (derived, never hand-typed)');
  ok(!g.html.includes('Trade at the Market'), 'greg: the door mode is fully retired');
  s.gold = 0;
  ok(gb68(s, goldId).clickable === false, 'greg: a broke shop cannot click-restock (affordability gate intact)');

  // BOTH filter sides carry the predicate (wiring pins): the game-side cycle trigger and the
  // render-side target pick each exclude trade acquisition — one side alone leaves either a
  // ghost window (cycle fires, nothing shows) or the original nag.
  const { readFileSync: rf68 } = await import('node:fs');
  const game68 = srcOf('./src/game.js');
  ok(/anyOut[\s\S]{0,220}acquisition/.test(game68),
    'greg: the cycle trigger counts gold-restockable outages only');
  const pnl68 = srcOf('./src/ui/panels.js');
  ok(/const isOut[\s\S]{0,120}acquisition/.test(pnl68),
    'greg: the render target pick excludes the trade tier');
}

// ============= SECTION 69 — THE RELIC REWORK (reform step 5 — "the gag IS the effect") ========
// Daniel's locked table (2026-07-12): scrap ×3, gold raised, materials + ONE Seal each; four
// effects that literalize the card gags; the Seal cliff becomes a fullness slope; relics carry
// over in Prestige (a DOC law for step 8 — nothing mechanical to pin yet). Exact cost pins live
// HERE (the newest batch); older sections softened to rules.
{
  const { RELICS: R69, RELIC_ORDER: RO69 } = await import('./src/data/relics.js');
  const { relicEffects, canRestoreRelic: crr69, restoreRelic: rr69, materialCap: mc69,
    currentTradeOffers: cto69, serveCurrent: sc69, effectiveMaxStock } = await import('./src/game.js');
  const { resolveCombat: rc69 } = await import('./src/combat.js');
  const { CONFIG: C69 } = await import('./src/config.js');
  const { MATERIALS: M69 } = await import('./src/data/materials.js');
  const { MONSTERS } = await import('./src/data/monsters.js');

  // (a) The cost table — the newest batch's EXACT pins (Daniel's locked numbers).
  const TABLE = { skeleton_key: [60, 5000], hero_magnet: [90, 10000],
    yesterday_potion: [135, 20000], everything_cloak: [180, 40000] };
  for (const id of RO69) {
    const r = R69[id];
    ok(r.restoreCost.scrap === TABLE[id][0] && r.restoreCost.gold === TABLE[id][1],
      `relicwork: ${id} costs ⚙${TABLE[id][0]} + ◆${TABLE[id][1]} (the locked table)`);
    ok((r.restoreCost.materials?.inspectors_seal ?? 0) === 1,
      `relicwork: ${id} requires exactly ONE Inspector's Seal (the current-batch law)`);
    for (const [mid, n] of Object.entries(r.restoreCost.materials)) {
      ok(!!M69[mid], `relicwork: ${id} cost line '${mid}' resolves in the registry`);
      ok(n <= (C69.materials?.baseCap ?? 10),
        `relicwork: ${id} needs ${n} ${mid} — under the BASE cap (a cost can never require its own effect)`);
    }
    ok(!!r.effect && !!r.effectCard, `relicwork: ${id} carries an effect + its player-visible card`);
  }

  // (b) relicEffects folds guardedly: identity with none restored; the full set with all four.
  const none = shopState();
  const idn = relicEffects(none);
  ok(idn.mishapChanceMult === 1 && idn.combatBonus === 0 && idn.capBonus === 0 && idn.yesterdayRates === false,
    'relicwork: no restored relics fold to the identity');
  const all = shopState();
  all.relics = Object.fromEntries(RO69.map((id) => [id, 'restored']));
  const fx = relicEffects(all);
  ok(fx.mishapChanceMult === 0.5 && fx.combatBonus === 1 && fx.capBonus === 2 && fx.yesterdayRates === true,
    'relicwork: all four fold to the slate (0.5 / +1 / +2 / yesterday)');

  // (c) The Seal SLOPE — dice DERIVED from the live grade math (inspectionGrade is the same
  // function the serve uses), forced ±0.01 around the crafted shop's chance. Fixed points
  // (0 and >=0.9) are §63's surviving cliff tests; this owns the middle.
  {
    const { inspectionGrade } = await import('./src/game.js');
    const mkShop = () => {
      const s = shopState();
      for (const id of ITEM_ORDER) s.items[id].stock = 0;
      for (const id of ITEM_ORDER) if (!ITEMS[id].license) s.items[id].stock = Math.floor(effectiveMaxStock(s, id) / 2);
      s.queue = [customer('dragon', 'club', 999)];
      s.items.club.stock = Math.max(s.items.club.stock, 1);
      s.serveCooldown = 0;
      return s;
    };
    const probe = mkShop();
    const chance = Math.min(1, inspectionGrade(probe).fullness / (C69.visits?.sealFullness ?? 0.9));
    ok(chance > 0.05 && chance < 0.95,
      `relicwork: the mid-slope fixture sits mid-slope (chance ${chance.toFixed(2)}) — guard-the-guard`);
    const real = Math.random;
    try {
      Math.random = () => chance - 0.01;              // just under: the Seal drops
      const sLow = mkShop(); sc69(sLow);
      const gotLow = (sLow.materials.inspectors_seal ?? 0);
      Math.random = () => chance + 0.01;              // just over: same shelf, no Seal
      const sHigh = mkShop(); sc69(sHigh);
      const gotHigh = (sHigh.materials.inspectors_seal ?? 0);
      ok(gotLow === 1 && gotHigh === 0,
        `relicwork: the slope pays mid-fullness by CHANCE (under → ${gotLow}, over → ${gotHigh})`);
    } finally { Math.random = real; }
  }

  // (d) The four effects, each on forced state.
  {
    // Skeleton Key: a die between the halved and original mishap chance returns CLEAN.
    const { startExpedition, resolveExpedition, canStartExpedition } = await import('./src/game.js');
    const s = shopState();
    s.relics = { skeleton_key: 'restored' };
    s.gold = 1000;
    const real = Math.random;
    try {
      if (canStartExpedition(s, 'slime')) {
        startExpedition(s, 'slime');
        s.expedition.remaining = 0;
        const base = C69.expedition?.mishapChance ?? 0.25;
        Math.random = () => base * 0.75;              // mishap WITHOUT the Key; clean WITH it
        resolveExpedition(s);
        ok((s.materials.slime_core ?? 0) === (C69.expedition?.haul ?? 3),
          'relicwork: the Skeleton Key turns a would-be mishap into a full haul (the halved die)');
      } else { ok(false, 'relicwork: expedition fixture could not start'); }
    } finally { Math.random = real; }

    // Hero Magnet: +1 to the score under identical dice.
    const real2 = Math.random;
    try {
      Math.random = () => 0.5;
      const a = rc69(MONSTERS.slime, ITEMS.club, 0).score;
      const b = rc69(MONSTERS.slime, ITEMS.club, 1).score;
      ok(b === a + 1, 'relicwork: the Hero Magnet adds exactly +1 to the combat score');
    } finally { Math.random = real2; }

    // Yesterday Potion: scan days for a pair where yesterday is cheaper somewhere; the swapped
    // offer carries the tag, the lower gold, NO featured mark; the list keeps ONE featured.
    const p = shopState();
    p.relics = { yesterday_potion: 'restored' };
    let proved = 0;
    for (let d = 2; d <= 30 && proved === 0; d++) {
      p.tradeDayKeyOverride = `sim-day-${d}`;
      const plain = (await import('./src/data/trademarket.js')).offersForDay(`sim-day-${d}`);
      const offers = cto69(p);
      for (const o of offers) {
        if (o.rateDay === 'yesterday') {
          const t = plain.find((x) => x.itemId === o.itemId);
          ok(o.gold < t.gold, 'relicwork: the Potion only ever swaps to a CHEAPER gold');
          ok(o.featured === undefined, 'relicwork: an imported offer drops the featured mark');
          proved++;
        }
      }
      ok(offers.filter((o) => o.featured).length === 1,
        `relicwork: sim-day-${d} keeps exactly ONE featured offer under the Potion`);
    }
    ok(proved > 0, 'relicwork: a yesterday-cheaper case exists within 30 days (guard-the-guard)');

    // Everything Cloak: +2 on every cap, and only when restored.
    const c1 = shopState();
    const c2 = shopState();
    c2.relics = { everything_cloak: 'restored' };
    ok(mc69(c2, 'slime_core') === mc69(c1, 'slime_core') + 2,
      'relicwork: the Cloak raises every material cap by exactly +2');
  }

  // (e) Hard-restore deduction: every currency, exactly; a missing Seal refuses.
  {
    const s = shopState();
    s.relics = { skeleton_key: 'found' };
    const r = R69.skeleton_key;
    s.scrap = r.restoreCost.scrap; s.gold = r.restoreCost.gold;
    s.materials = {};
    for (const [mid, n] of Object.entries(r.restoreCost.materials)) s.materials[mid] = n + 1;
    s.materials.inspectors_seal = 0;
    ok(!crr69(s, 'skeleton_key'), 'relicwork: a missing Seal refuses the restore (hard means hard)');
    s.materials.inspectors_seal = 1;
    ok(rr69(s, 'skeleton_key'), 'relicwork: fully funded restores');
    ok(s.scrap === 0 && s.gold === 0 && s.materials.inspectors_seal === 0
      && Object.entries(r.restoreCost.materials).every(([mid, n]) => mid === 'inspectors_seal' || s.materials[mid] === 1),
      'relicwork: every currency deducts EXACTLY (the +1 cushion survives)');
  }

  // (f) Wiring pins: the overlay's yesterday tag; the Forge spells out the material lines.
  const { readFileSync: rf69 } = await import('node:fs');
  ok(srcOf('./src/ui/market.js').includes('rate-yesterday'),
    'relicwork: the overlay tags yesterday-rate offers');
  ok(srcOf('./src/ui/panels.js').includes('restoreCost.materials'),
    'relicwork: the Forge cost line spells out the material lines');
}

// ============= SECTION 70 — COMMISSIONS (reform step 6 — the NAMED CLIENT, Option 2) ==========
// One order slot; day-seeded roster client; LICENSED trade-tier goods only; market-day deadline;
// fulfillment consumes SHELF stock and pays premium gold + fame; a lapse is a comic line and
// ZERO penalty. Exact terms math + config-band pins live HERE (the newest batch).
{
  const { commissionForDay, dayIndexOf } = await import('./src/data/commissions.js');
  const { refreshCommission, fulfillCommission, canFulfillCommission, commissionTerms,
    commissionDaysLeft, eligibleCommissionItemIds, update: up70 } = await import('./src/game.js');
  const { COMMISSION_VOICE } = await import('./src/data/results.js');
  const { CONFIG: C70 } = await import('./src/config.js');
  const { ITEMS: I70 } = await import('./src/data/items.js');
  const { MONSTERS: M70, MONSTER_IDS: MI70 } = await import('./src/data/monsters.js');
  const { tradeItemIds } = await import('./src/data/trademarket.js');
  const { itemGoldMult, globalGoldMult } = await import('./src/data/milestones.js');
  const CB = C70.commission;

  // (a) dayIndexOf — both key families become comparable integers; anything else is null.
  ok(dayIndexOf('sim-day-7') === 7 && dayIndexOf('sim-day-1') === 1,
    'commission: dayIndexOf parses the synthetic family');
  ok(dayIndexOf('2026-07-12') - dayIndexOf('2026-07-11') === 1,
    'commission: adjacent calendar days differ by exactly 1');
  ok(dayIndexOf('2026-08-01') - dayIndexOf('2026-07-31') === 1,
    'commission: the month boundary still steps by 1 (Date.UTC math, DST-proof)');
  ok(dayIndexOf('garbage') === null && dayIndexOf('sim-day-3+1') === null && dayIndexOf(null) === null,
    'commission: odd keys (incl. the forecast fallback family) yield null — the machinery idles');

  // (b) commissionForDay — pure, deterministic, band-legal, eligibility-respecting.
  const tier70 = tradeItemIds();
  const a1 = commissionForDay('sim-day-5', tier70);
  const a2 = commissionForDay('sim-day-5', tier70);
  ok(JSON.stringify(a1) === JSON.stringify(a2),
    'commission: same day + same list -> the identical order (pure, no Math.random)');
  ok(commissionForDay('sim-day-5', []) === null && commissionForDay('sim-day-5', null) === null,
    'commission: nothing eligible -> no order (early game commission-free by construction)');
  {
    let varied = false, legal = true;
    for (let d = 1; d <= 60; d++) {
      const c = commissionForDay(`sim-day-${d}`, tier70);
      if (JSON.stringify(c) !== JSON.stringify(a1)) varied = true;
      if (!tier70.includes(c.itemId) || M70[c.monsterId]?.special
        || c.count < CB.countMin || c.count > CB.countMax
        || c.days < CB.daysMin || c.days > CB.daysMax) legal = false;
    }
    ok(varied, 'commission: orders vary across days (the rotation is real)');
    ok(legal, 'commission: 60 days of orders — item from the passed list, client non-special, count/days in the config bands');
  }

  // (c) The machinery — arming, placement, the once-a-day latch.
  const armed = () => {
    const s = shopState();
    s.licenses.iron_buckler = true;              // one licensed trade item = eligible
    s.tradeDayKeyOverride = 'sim-day-3';         // the harness seam arms the machinery
    return s;
  };
  {
    const s = shopState();
    s.licenses.iron_buckler = true;
    refreshCommission(s);                        // NO override, NO marketDayKey
    ok(s.commission === null && s.log.length === 0,
      'commission: unarmed refresh is a no-op (headless tests never see commissions)');
  }
  {
    const s = armed();
    refreshCommission(s);
    ok(!!s.commission && s.commission.placedIndex === 3 && s.lastCommissionIndex === 3,
      'commission: an armed, eligible day places the order and advances the latch');
    ok(s.commission.itemId === 'iron_buckler',
      'commission: the order respects eligibility (only the licensed item can be asked for)');
    ok(s.log.length === 1 && s.log[0].tier === 'market',
      'commission: placement announces once, tier market (stagger-bypassing)');
    const logCount = s.log.length;
    refreshCommission(s);
    ok(s.log.length === logCount, 'commission: a second refresh the same day changes nothing');
  }

  // (d) Fulfillment — the exact terms math; the ledger stays untouched; the farm guard holds.
  {
    const s = armed();
    refreshCommission(s);
    const c = s.commission;
    s.items[c.itemId].stock = c.count;
    const per = Math.round(I70[c.itemId].basePrice * itemGoldMult(s, c.itemId)
      * globalGoldMult(s) * CB.premiumMult);
    const t = commissionTerms(s);
    ok(t.gold === per * c.count && t.rep === CB.repPerUnit * c.count,
      'commission: terms = round(base × loyalty mults × premiumMult) × count + flat fame (the payout law)');
    const g0 = s.gold, lr0 = s.lifetimeRep, sales0 = s.stats.itemSales[c.itemId];
    ok(canFulfillCommission(s) && fulfillCommission(s), 'commission: a stocked shelf fulfills');
    ok(s.gold - g0 === t.gold && s.lifetimeRep - lr0 === t.rep && s.items[c.itemId].stock === 0,
      'commission: gold + dual-track fame land exactly; the stock leaves the shelf');
    ok(s.stats.itemSales[c.itemId] === sales0,
      'commission: itemSales UNTOUCHED — loyalty ladders count counter sales only');
    ok(s.commission === null, 'commission: the slot rests after fulfillment');
    refreshCommission(s);
    ok(s.commission === null,
      'commission: no instant re-placement — the courier cooldown gates the seat (REPEAT/\u00a789 retargeted '
      + 'this from the old once-a-day latch: same protection, new mechanism, and it persists)');
    s.tradeDayKeyOverride = 'sim-day-4';
    refreshCommission(s);
    ok(s.commission === null,
      'commission: the courier gates the ROLLOVER seat too (the 23:59 fulfill cannot conjure a midnight '
      + 'order — the seat-rule law, \u00a789)');
    s.commissionCooldownSec = 0;
    refreshCommission(s);
    ok(!!s.commission && s.commission.placedIndex === 4,
      'commission: the next rollover seats the next order once the courier is home');
  }

  // (e) The lapse — zero penalty, comic line, and the same refresh seats today's order.
  {
    const s = armed();
    refreshCommission(s);
    const c = s.commission;
    const g0 = s.gold, r0 = s.reputation, lr0 = s.lifetimeRep;
    s.tradeDayKeyOverride = `sim-day-${3 + c.days}`;
    refreshCommission(s);
    ok(s.gold === g0 && s.reputation === r0 && s.lifetimeRep === lr0,
      'commission: a lapse costs NOTHING (player-forgiving law)');
    ok(!!s.commission && s.commission.placedIndex === 3 + c.days,
      'commission: lapse-then-place in one refresh — the world moves on the same morning');
    ok(s.log.length === 3 && s.log.every((l) => l.tier === 'market'),
      'commission: placed + lapsed + placed = three market-tier lines');
  }

  // (e2) daysLeft display math: placed day D with N days reads N, then N-1, then lapses.
  {
    const s = armed();
    refreshCommission(s);
    const n = s.commission.days;
    ok(commissionDaysLeft(s) === n, 'commission: daysLeft reads the full span on placement day');
    s.tradeDayKeyOverride = 'sim-day-4';
    ok(commissionDaysLeft(s) === n - 1, 'commission: daysLeft steps down with the trade day');
  }

  // (f) Short shelf refuses, mutation-free.
  {
    const s = armed();
    refreshCommission(s);
    const c = s.commission;
    s.items[c.itemId].stock = c.count - 1;
    const g0 = s.gold, st0 = s.items[c.itemId].stock;
    ok(!canFulfillCommission(s) && !fulfillCommission(s)
      && s.gold === g0 && s.items[c.itemId].stock === st0 && !!s.commission,
      'commission: one unit short refuses and mutates nothing');
  }

  // (g) Save round-trip + the corruption guards (the expedition slot's own family).
  {
    const s = armed();
    refreshCommission(s);
    s.items.iron_buckler.stock = 2;
    const data = serializeSave(s);
    const back = mergeSave(createInitialState(), data);
    ok(['itemId', 'monsterId', 'count', 'days', 'placedIndex']
        .every((k) => back.commission?.[k] === s.commission[k])
      && back.lastCommissionIndex === s.lastCommissionIndex,
      'commission: the slot + the placement latch survive a save round-trip');
    const corrupt = (patch) => mergeSave(createInitialState(),
      { ...data, commission: { ...data.commission, ...patch } }).commission;
    ok(corrupt({ itemId: 'nonsense' }) === null, 'commission: an unknown itemId drops the order whole');
    ok(corrupt({ itemId: 'club' }) === null, 'commission: a GOLD-tier itemId drops the order (trade tier only)');
    ok(corrupt({ monsterId: 'dragon' }) === null, 'commission: a special client drops the order (the Inspector inspects)');
    ok(corrupt({ count: 999 }).count === CB.countMax && corrupt({ count: 0 }).count === CB.countMin,
      'commission: count clamps into the config band');
    ok(corrupt({ days: 999 }).days === CB.daysMax && corrupt({ days: 0 }).days === CB.daysMin,
      'commission: days clamps into the config band');
  }

  // (h) Voice laws at RENDER (the ticker's precedent): worst-case substitution against the LIVE
  // registries must fit the 80-char log budget; no second person (§42's rule, same whitelist);
  // every current non-special client has a keyed register, and the generic pool stands ready for
  // the NEXT roster monster (the auto-flow law).
  {
    const longestItem = tradeItemIds().map((id) => I70[id].displayName)
      .reduce((a, b) => (b.length > a.length ? b : a));
    const longestName = MI70.filter((id) => !M70[id].special).map((id) => M70[id].displayName)
      .reduce((a, b) => (b.length > a.length ? b : a));
    const sub = (t) => t.replaceAll('{name}', longestName).replaceAll('{n}', String(CB.countMax))
      .replaceAll('{item}', longestItem).replaceAll('{days}', String(CB.daysMax));
    const pools = [...Object.values(COMMISSION_VOICE.placed),
      COMMISSION_VOICE.fulfilled, COMMISSION_VOICE.lapsed];
    const texts = pools.flat();
    ok(texts.every((t) => sub(t).length <= 80),
      `commission voice: every line fits 80 chars at worst-case render (${longestName} × ${CB.countMax}× ${longestItem})`);
    ok(texts.every((t) => !/\byou\b/i.test(t.replace(/you'd/gi, ''))),
      'commission voice: no second person outside the you\'d idiom');
    ok(MI70.filter((id) => !M70[id].special)
      .every((id) => (COMMISSION_VOICE.placed[id]?.length ?? 0) >= 2),
      'commission voice: every non-special roster monster has its own placed register (2+ lines)');
    ok((COMMISSION_VOICE.placed.generic?.length ?? 0) >= 2
      && COMMISSION_VOICE.fulfilled.length >= 3 && COMMISSION_VOICE.lapsed.length >= 3,
      'commission voice: generic fallback + fulfilled + lapsed pools are stocked');
  }

  // (i) Wiring text-pins: the overlay row, its scoped hidden override (the cascade-tie law),
  // and main.js's handler.
  {
    const { readFileSync: rf70 } = await import('node:fs');
    const mkt = srcOf('./src/ui/market.js');
    ok(mkt.includes('mkt-comm-fulfill') && mkt.includes('market-commission'),
      'commission: the overlay carries the Special Order row + Fulfill button');
    ok(srcOf('./style.css').includes('.hidden{display:none !important;}'),
      'commission: the hide utility out-cascades .market-commission\u2019s own display (§87\u2019s law; the scoped override is retired)');
    ok(srcOf('./src/main.js').includes('onFulfill'),
      'commission: main.js wires the Fulfill handler');
  }

  // (j) update() integration: the throttled check places via the normal tick path.
  {
    const s = shopState();
    s.licenses.iron_buckler = true;
    s.tradeDayKeyOverride = 'sim-day-9';
    for (let i = 0; i < 7; i++) up70(s, 1);      // past the checkSec throttle
    ok(!!s.commission && s.commission.placedIndex === 9,
      'commission: update() runs the machinery through the throttle (the live path)');
  }
}

// ============= SECTION 71 — Market Day HUD chip RETIRED (Daniel, 2026-07-12) ==================
// The floating "Weapons +50%" pill leaves the HUD — the board/forecast/ticker carry the market's
// story now. The EVENT SYSTEM stays: this section pins BOTH directions (chip absent, announce
// surfaces present) so a future HUD pass can't half-resurrect it and an overzealous cleanup
// can't take the announcements with it.
{
  const { readFileSync: rf71 } = await import('node:fs');
  const hud = srcOf('./src/ui/hud.js');
  ok(!hud.includes('hud-market-chip') && !hud.includes('marketBannerCompact'),
    'chip retirement: hud.js renders no Market Day chip and imports no banner formatter');
  ok(!srcOf('./style.css').includes('.hud-chip.market'),
    'chip retirement: the chip\'s CSS left with it (no dead selectors)');
  const game71 = srcOf('./src/game.js');
  ok(game71.includes('marketAnnounceLine') && game71.includes('marketBubbleLine'),
    'chip retirement: the event still speaks — morning log line + Bob\'s bubble survive');
  const { marketBannerCompact: mbc71 } = await import('./src/data/marketevents.js');
  ok(typeof mbc71 === 'function',
    'chip retirement: the pure formatter stays exported (tested above; the chip may return)');
}

// ============= SECTION 72 — FAME LEVELS (F1a — the fame & demand reform, Option 3) ============
// Fame becomes the LEVEL track: levelThreshold(n) = round(base × growth^(n−1)), rungs anchored
// at levels with min DERIVED at config load, offline fame haircut. Exact curve pins live HERE
// (older sections softened to live-table reads this same pass). FAME_ECONOMY_DESIGN.md §4.
{
  const { levelThreshold, fameLevel, nextLevelInfo, reputationTier: rt72 } =
    await import('./src/reputation.js');
  const L = CONFIG.reputation.levels;

  // (a) The curve — dial pins (newest batch) + formula law + monotonicity.
  ok(L.base === 25 && L.growth === 1.6, 'fame levels: the curve dials (base 25, growth 1.6)');
  ok(levelThreshold(0) === 0 && levelThreshold(1) === 25 && levelThreshold(2) === 40
     && levelThreshold(20) === 188895,
     'fame levels: threshold exacts (L1 25, L2 40, L20 188895)');
  for (let n = 1; n <= 40; n++) {
    if (levelThreshold(n) !== Math.round(L.base * L.growth ** (n - 1))
        || levelThreshold(n) <= levelThreshold(n - 1)) {
      ok(false, `fame levels: threshold law broke at L${n}`); break;
    }
    if (n === 40) ok(true, 'fame levels: 40 thresholds match the formula, strictly ascending');
  }

  // (b) fameLevel — exact at every boundary (the loop-not-log law).
  ok(fameLevel(0) === 0 && fameLevel(24) === 0 && fameLevel(25) === 1,
     'fame levels: level 0 floor, L1 at exactly 25');
  {
    let exact = true;
    for (let n = 1; n <= 30; n++) {
      if (fameLevel(levelThreshold(n)) !== n || fameLevel(levelThreshold(n) - 1) !== n - 1) exact = false;
    }
    ok(exact, 'fame levels: every threshold crosses exactly (n at min, n−1 one below)');
  }

  // (c) Rung placement — the seven names at their design levels; min derives from the curve;
  // index semantics 0-6 preserved for every gate consumer.
  const RUNGS = [['Neutral', 0], ['Friendly', 2], ['Trusted', 6], ['Beloved', 10],
    ['Renowned', 13], ['Legendary', 17], ['Mythic', 20]];
  ok(CONFIG.reputation.tiers.length === RUNGS.length
     && CONFIG.reputation.tiers.every((t, i) => t.label === RUNGS[i][0] && t.level === RUNGS[i][1]
        && t.min === levelThreshold(t.level)),
     'fame levels: seven rungs at levels 0/2/6/10/13/17/20, min = levelThreshold(level)');
  ok(rt72(levelThreshold(20)).index === 6 && rt72(levelThreshold(20) - 1).index === 5,
     'fame levels: rung indices still 0-6 (gates keep their contract)');

  // (d) nextLevelInfo — rung levels carry their label; plain levels don't; remaining is exact.
  {
    const atL12 = levelThreshold(12);
    const info = nextLevelInfo(atL12);
    ok(info.level === 13 && info.rungLabel === 'Renowned'
       && info.remaining === levelThreshold(13) - atL12,
       'fame levels: next-level info names a rung level (L13 = Renowned)');
    const info2 = nextLevelInfo(levelThreshold(13));
    ok(info2.level === 14 && info2.rungLabel === null,
       'fame levels: a plain next level carries no rung label');
  }

  // (e) The offline fame haircut — dial pin (newest batch); behavior is asserted where the
  // offline sections already compute through the dial.
  ok(CONFIG.offline.repFraction === 0.5,
     'fame levels: offline pays half fame (the haircut dial, F1a)');

  // (f) Wiring pins: the level track REACHES THE PLAYER. The badge rides it in the HUD; the
  // next-level REMAINDER moved to the Fame panel on 2026-07-15 (§79 owns that pass's exacts), so
  // this names BOTH surfaces now — refined to what the probe always MEANT, not softened.
  // The SHAPE matters: these read the IMPORT LIST, not raw file text. The old form
  // (`hud.includes('nextLevelInfo')`) is satisfied by a COMMENT that merely mentions the symbol —
  // it sailed green straight through the move that invalidated it. A pin that cannot fail
  // certifies nothing.
  {
    const { readFileSync: rf72 } = await import('node:fs');
    const namedImports = (src, mod) => {
      const m = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*'${mod}'`, 's').exec(src);
      return m ? m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean) : [];
    };
    const hud72 = srcOf('./src/ui/hud.js');
    const pnl72 = srcOf('./src/ui/panels.js');
    const hudRep = namedImports(hud72, '\\.\\./reputation\\.js');
    const pnlRep = namedImports(pnl72, '\\.\\./reputation\\.js');
    ok(hudRep.length > 0 && pnlRep.length > 0,
       'fame levels: guard-the-guard — the import scanner found both reputation.js import lists');
    ok(hudRep.includes('fameLevel') && hud72.includes('fameLevel(fame)'),
       'fame levels: the HUD badge rides the level track');
    ok(!hudRep.includes('nextLevelInfo'),
       'fame levels: the HUD no longer imports the remainder (it moved to the Fame panel — §79)');
    ok(pnlRep.includes('nextLevelInfo') && pnl72.includes('nextLevelInfo(fame)'),
       'fame levels: the Fame panel remainder rides the level track');
  }
}

// ========== SECTION 73 — DEMAND HONESTY (F2 Option 1 — the fame & demand reform) ==========
// The want-pick's item stage gains a SUPPLY weight for trade-tier goods: on-shelf x stocked(1),
// sold-before x known, never-sold x unknown — a floor, never zero ("a stray ask teaches the
// market exists"). Gold-tier and stateless picks stay x1. FAME_ECONOMY_DESIGN.md §6.
{
  const { supplyWantWeight, spawnCustomer: spawn73 } = await import('./src/game.js');
  const { createInitialState: cis73 } = await import('./src/state.js');
  const { ITEMS: IT73, ITEM_ORDER: ORD73 } = await import('./src/data/items.js');
  const { tradeItemIds, mulberry32: rng73 } = await import('./src/data/trademarket.js');
  const dial = CONFIG.queue.supplyWantBias;

  // (a) Dial contract (newest batch, exact) + the never-to-zero law.
  ok(!!dial && dial.stocked === 1 && dial.known === 0.7 && dial.unknown === 0.4,
     'demand honesty: dial exacts (stocked 1, known 0.7, unknown 0.4 — the Option B retune)');
  ok(dial.unknown > 0 && dial.unknown < dial.known && dial.known < dial.stocked,
     'demand honesty: the never-to-zero law (0 < unknown < known < stocked)');

  // (b) THE ROSTER RULE (the options round's suite-enforced contract): every category holding
  // a trade-tier item must also hold a gold-tier item — the bias redistributes demand WITHIN
  // a category, so each such category needs a stockable sibling. A future all-trade category
  // must fail HERE and force the category-stage upgrade before it ships.
  {
    const cats = {};
    for (const id of ORD73) {
      const c = IT73[id].category;
      (cats[c] ??= { gold: 0, trade: 0 })[IT73[id].acquisition ?? 'gold']++;
    }
    ok(Object.values(cats).every((c) => c.trade === 0 || c.gold > 0),
       'demand honesty: ROSTER RULE — every trade-bearing category keeps a gold sibling');
  }

  // (c) The weight function — all levels, every id derived from the live registry.
  {
    const s = cis73();
    const tId = tradeItemIds()[0];
    const gId = ORD73.find((id) => (IT73[id].acquisition ?? 'gold') === 'gold');
    ok(supplyWantWeight(null, tId) === 1,
       'demand honesty: stateless picks stay x1 (legacy math untouched)');
    s.items[gId].stock = 0; delete s.stats.itemSales[gId];
    ok(supplyWantWeight(s, gId) === 1,
       'demand honesty: gold tier x1 even out-of-stock never-sold — the bias never touches gold');
    s.items[tId].stock = 0; delete s.stats.itemSales[tId];
    ok(supplyWantWeight(s, tId) === dial.unknown,
       'demand honesty: never-sold trade item asks at the unknown floor');
    s.stats.itemSales[tId] = 1;
    ok(supplyWantWeight(s, tId) === dial.known,
       'demand honesty: sold-before shelf-empty asks at known');
    s.items[tId].stock = 1;
    ok(supplyWantWeight(s, tId) === dial.stocked,
       'demand honesty: on the shelf = full personality-driven demand');
  }

  // (d) The effect probe — the REAL spawn path, seeded and deterministic: the same fresh state
  // spawns N customers twice; the only change between runs is stocking the starved trade item.
  // Asserted as RELATIONS (share rises; floor still asks), never hand-typed counts — robust to
  // unrelated upstream RNG consumers.
  {
    const s = cis73();
    s.screen = 'shop';
    // Every trade item is LICENSED (measured at the live registry — fresh saves see none), so
    // the fixture grants the license: a shop that OWNS the license but has never stocked or
    // sold the item is exactly F2's target case.
    const tId = tradeItemIds()[0];
    s.licenses[tId] = true;
    const realRandom = Math.random;
    const N = 400;
    s.items[tId].stock = 0; delete s.stats.itemSales[tId];
    Math.random = rng73(73001);
    let starvedAsks = 0;
    for (let i = 0; i < N; i++) if (spawn73(s)?.wantedItemId === tId) starvedAsks++;
    s.items[tId].stock = 5;
    Math.random = rng73(73001);
    let stockedAsks = 0;
    for (let i = 0; i < N; i++) if (spawn73(s)?.wantedItemId === tId) stockedAsks++;
    Math.random = realRandom;
    ok(starvedAsks > 0,
       `demand honesty: the stray-ask floor still asks (${starvedAsks}/${N} starved)`);
    ok(stockedAsks > starvedAsks,
       `demand honesty EFFECT: stocking raises the ask share (${stockedAsks} > ${starvedAsks} of ${N})`);
  }

  // (e) Wiring pin: the item stage actually rides the weight.
  {
    const { readFileSync: rf73 } = await import('node:fs');
    const src = srcOf('./src/game.js');
    ok(src.includes('* supplyWantWeight(state, id)'),
       'demand honesty: the want pick multiplies the supply weight (wiring pin)');
  }
}

// ========== SECTION 74 — SCARCITY TEETH (F3 Option 1 — the fame & demand reform) ==========
// The leave penalty scales with the shop's RUNG: base + perTier x tier index, charged to
// SPENDABLE fame only — the lifetime tier track never falls, and auto-wave/dismissal stay
// penalty-free (service, not failure). FAME_ECONOMY_DESIGN.md §7 (re-scoped).
{
  const { leavePenaltyOf, spawnCustomer: spawn74, dismissCurrent: dismiss74,
    update: update74 } = await import('./src/game.js');
  const { createInitialState: cis74 } = await import('./src/state.js');
  const { mulberry32: rng74 } = await import('./src/data/trademarket.js');
  const base = CONFIG.reputation.leavePenalty;
  const perTier = CONFIG.reputation.leavePenaltyPerTier;

  // (a) Dial contract (newest batch, exact).
  ok(base === 1 && perTier === 1,
     'scarcity teeth: dial exacts (leavePenalty 1, leavePenaltyPerTier 1)');
  ok(perTier >= 0, 'scarcity teeth: the scale never inverts (perTier >= 0)');

  // (b) The scaling function at every rung — thresholds read from the LIVE tier table.
  {
    const s = cis74();
    for (let i = 0; i < CONFIG.reputation.tiers.length; i++) {
      s.lifetimeRep = CONFIG.reputation.tiers[i].min;
      ok(leavePenaltyOf(s) === base + perTier * i,
         `scarcity teeth: rung ${i} (${CONFIG.reputation.tiers[i].label}) charges ${base + perTier * i}`);
    }
  }

  // (c) The REAL leave path, seeded: a queued customer times out inside update(); spendable
  // fame drops by exactly leavePenaltyOf, the LIFETIME track does not move (the never-falls
  // law), and the log line reports the true charge.
  {
    const s = cis74();
    s.screen = 'shop';
    s.lifetimeRep = CONFIG.reputation.tiers[4].min;      // Renowned-band shop: pen = base+4
    s.reputation = 500;
    const realRandom = Math.random;
    Math.random = rng74(74001);
    const c = spawn74(s);
    Math.random = realRandom;
    ok(!!c, 'scarcity teeth: probe fixture spawned a customer');
    c.patienceRemaining = 0.001;
    s.queue.push(c);
    const pen = leavePenaltyOf(s);
    const repBefore = s.reputation, lifeBefore = s.lifetimeRep;
    update74(s, 0.01);
    ok(s.reputation === repBefore - pen && pen === base + perTier * 4,
       `scarcity teeth: the leaver charged the tier-scaled ${pen} to spendable fame`);
    ok(s.lifetimeRep === lifeBefore,
       'scarcity teeth: the LIFETIME track never falls (a bad afternoon costs goodwill, not levels)');
    const line = (s.log ?? []).find((l) => l.tier === 'leave');
    ok(!!line && line.repDelta === -pen,
       'scarcity teeth: the log line reports the true charge');
  }

  // (d) Auto-wave/dismissal stay penalty-free (they route through dismissCurrent, repDelta 0).
  {
    const s = cis74();
    s.screen = 'shop';
    const realRandom = Math.random;
    Math.random = rng74(74002);
    const c = spawn74(s);
    Math.random = realRandom;
    s.queue.push(c);
    s.reputation = 300;
    dismiss74(s);
    ok(s.reputation === 300 && s.queue.length === 0,
       'scarcity teeth: dismissal waves penalty-free — service, not failure');
  }

  // (e) Wiring pins: one derivation per leaver, both log branches honest.
  {
    const { readFileSync: rf74 } = await import('node:fs');
    const src = srcOf('./src/game.js');
    ok(src.includes('const pen = leavePenaltyOf(state)')
       && (src.match(/repDelta: -pen, tier: 'leave'/g) ?? []).length === 2,
       'scarcity teeth: the leave block derives once and logs -pen in both branches (wiring pin)');
  }
}

// ========== SECTION 75 — DEMAND SURFACE (F4 Option 1 — the fame & demand reform) ==========
// The market board's third chalk row names today's demand event ("HOT TODAY: Weapons"),
// and the overlay echoes it WITH the number ("Hero Parade · Weapons +50%") — the sale-sign
// doctrine pair: the board advertises, the overlay informs. FAME_ECONOMY_DESIGN.md §8.
{
  const { boardEventLine, eventIdForDay, marketBannerText, MARKET_EVENTS, MARKET_EVENT_ORDER,
    CATEGORY_LABELS } = await import('./src/data/marketevents.js');
  const { boardLines } = await import('./src/data/trademarket.js');
  const { createInitialState: cis75 } = await import('./src/state.js');

  // (a) Every event's board line is board-SHORT (the chalk face fits ~one short line; the iconic
  // rows' overflow bug is the cautionary tale) and names its category label.
  for (const id of MARKET_EVENT_ORDER) {
    const ev = MARKET_EVENTS[id];
    const line = boardEventLine(ev);
    ok(line.length > 0 && line.length <= 32,
       `demand surface: ${id} board line is board-short (${line.length} <= 32)`);
    ok(line.includes(CATEGORY_LABELS[ev.category] ?? ev.category),
       `demand surface: ${id} board line names its shelf`);
  }
  // The board line carries NO percentage — advertising, not informing (the doctrine split).
  ok(MARKET_EVENT_ORDER.every((id) => !/\d/.test(boardEventLine(MARKET_EVENTS[id]))),
     'demand surface: board lines carry no number (the board advertises; the overlay informs)');
  // Empty event → empty row (defensive: the row simply doesn't draw).
  ok(boardEventLine(null) === '' && boardEventLine({}) === '',
     'demand surface: a missing event yields an empty row, never a crash');

  // (b) boardLines folds the demand row + its event id into the composed contentKey, so a new
  // market day (which flips the event) triggers the single chalk write-on across all rows.
  {
    const s = cis75();
    s.tradeDayKeyOverride = 'sim-day-7';
    const L1 = boardLines(s), L2 = boardLines(s);
    ok(L1.headline === boardEventLine(MARKET_EVENTS[eventIdForDay('sim-day-7')]),
       'demand surface: boardLines.headline IS the day-derived event line (promoted to the top row, '
       + 'board restructure 2026-07-16)');
    ok(L1.contentKey.includes(eventIdForDay('sim-day-7')),
       'demand surface: the event id rides the contentKey (chalk rewrite fires on event change)');
    ok(L1.contentKey === L2.contentKey && L1.demand === L2.demand,
       'demand surface: deterministic per day (a sign chalked once, not per reload)');
    // A different day generally shifts the composed key (offer and/or event move).
    const s2 = cis75(); s2.tradeDayKeyOverride = 'sim-day-8';
    ok(boardLines(s2).contentKey !== L1.contentKey,
       'demand surface: a new market day recomposes the board key');
  }

  // (c) The overlay's informative echo agrees with the board on WHICH event, and carries the
  // number the board omits — derived from the same eventIdForDay∘tradeDayKey the board uses.
  {
    const ev = MARKET_EVENTS[eventIdForDay('sim-day-7')];
    const echo = marketBannerText(ev, ev.payoutMult ?? 1.5);
    ok(echo.includes(ev.displayName) && /\d/.test(echo),
       'demand surface: the overlay echo names the event and carries the percentage');
  }

  // (d) Wiring pins: the render actually draws the demand row + the overlay element exists.
  {
    const { readFileSync: rf75 } = await import('node:fs');
    const scene = srcOf('./src/render/scene.js');
    ok(scene.includes('headSegs') && scene.includes('L.headline'),
       'demand surface: scene.js draws the demand HEADLINE from boardLines (wiring pin — the top row '
       + 'since the board restructure, 2026-07-16)');
    const market = srcOf('./src/ui/market.js');
    ok(market.includes('mkt-demand') && market.includes('marketBannerText'),
       'demand surface: the overlay renders the informative echo (wiring pin)');
  }
}

// ========== SECTION 76 — COMMISSION HARD RESERVE (B1 — Option 1, decision log design doc §9) ==========
// A pending order SETS ASIDE its `count` units from EVERY counter path (serves, bulk, offline,
// leave-theft), so Bob can't sell an order's goods to a walk-in and F2 can't steer traffic onto a
// shelf being held. reservedFor/sellableStock derive live from state.commission — nothing new
// persisted. RAW stock still drives shelf-room, fulfillment, and the inspection grade. Exact reserve
// math lives HERE (the newest batch). FAME_ECONOMY_DESIGN.md §9.
{
  const { reservedFor, sellableStock, serveBlockReason: sbr76, serveCurrent: serve76,
    canFulfillCommission: canFill76, fulfillCommission: fill76, supplyWantWeight: sww76,
    refreshCommission: refresh76, update: up76 } = await import('./src/game.js');
  const { computeOffline: off76, applyOffline: applyOff76 } = await import('./src/offline.js');
  const { tradeItemIds: tii76 } = await import('./src/data/trademarket.js');
  const { CONFIG: C76 } = await import('./src/config.js');
  const { ITEMS: I76 } = await import('./src/data/items.js');
  const TID = 'iron_buckler';   // a licensed trade-tier item (acquisition 'trade', basePrice 18)

  // A shop that OWNS the trade license and carries a crafted order for exact count control (the
  // placement path itself is §70's; this section isolates the RESERVE). No override armed, so the
  // deadline machinery idles — the reserve is a pure function of the commission object + stock.
  const withOrder = (stock, count) => {
    const s = shopState();
    s.licenses[TID] = true;
    s.items[TID].stock = stock;
    s.commission = { itemId: TID, count, monsterId: 'slime', days: 2, placedIndex: 3 };
    return s;
  };
  // Park an affordable, patient front customer wanting `itemId` so the serve gate can be read.
  const withFront = (s, monsterId, itemId) => { s.queue = [customer(monsterId, itemId, 999)]; return s; };

  // (a) The reserve math — clamp, subtraction, and the no-order / other-item / kill-switch zeros.
  {
    const s = withOrder(5, 3);
    ok(reservedFor(s, TID) === 3 && sellableStock(s, TID) === 2,
       'reserve: stock 5, order 3 -> 3 reserved, 2 sellable');
    const short = withOrder(1, 3);
    ok(reservedFor(short, TID) === 1 && sellableStock(short, TID) === 0,
       'reserve: a shelf SHORT of the order reserves only what it holds (min(count,stock)), 0 sellable');
    ok(reservedFor(s, 'club') === 0 && sellableStock(s, 'club') === (s.items.club.stock ?? 0),
       'reserve: an item the order does NOT name is fully sellable (reserve is per-item)');
    const noOrder = shopState(); noOrder.items[TID].stock = 5;
    ok(reservedFor(noOrder, TID) === 0 && sellableStock(noOrder, TID) === 5,
       'reserve: no live order -> reserved 0, sellable == raw stock (transparent when idle)');
  }

  // (a2) The kill switch (CONFIG.commission.hardReserve false) reverts every read to raw stock.
  {
    ok((C76.commission.hardReserve ?? true) === true,
       'reserve: hardReserve config flag is present and defaults true');
    const saved = C76.commission.hardReserve;
    try {
      C76.commission.hardReserve = false;
      const s = withOrder(5, 3);
      ok(reservedFor(s, TID) === 0 && sellableStock(s, TID) === 5,
         'reserve: kill switch OFF -> reservedFor 0, sellable == raw (the F3 perTier-0 pattern)');
      ok(sbr76(withFront(withOrder(3, 3), 'slime', TID)) === null,
         'reserve: kill switch OFF -> a would-be-reserved shelf serves normally');
    } finally { C76.commission.hardReserve = saved; }
  }

  // (b) The serve gate — 'reserved' is its OWN reason (raw-empty stays 'out-of-stock'), and a
  // fully-reserved serve is refused mutation-free. Partial reserve serves from the sellable pool.
  {
    const full = withFront(withOrder(3, 3), 'slime', TID);   // stock 3, order 3 -> sellable 0
    ok(sbr76(full) === 'reserved',
       'reserve: a fully-held shelf blocks with the distinct reason "reserved" (not out-of-stock)');
    const st0 = full.items[TID].stock;
    ok(serve76(full) === false && full.items[TID].stock === st0,
       'reserve: serveCurrent refuses a reserved item and touches no stock');
    const empty = withFront(withOrder(0, 3), 'slime', TID);  // raw empty
    ok(sbr76(empty) === 'out-of-stock',
       'reserve: a raw-empty shelf still reads out-of-stock (the reason meanings stay disjoint)');
    const partial = withFront(withOrder(5, 3), 'slime', TID); // sellable 2
    ok(sbr76(partial) === null && serve76(partial) === true,
       'reserve: a partially-held shelf serves the walk-in from the sellable pool');
    ok(partial.items[TID].stock === 4 && reservedFor(partial, TID) === 3
       && sellableStock(partial, TID) === 1,
       'reserve: the counter sale came from sellable (5->4); the order-3 reserve is intact');
  }

  // (c) Bulk-buyer (Leggsy) can never dip into the reserve: sellable 1 buys ONE, sellable 2+ buys two.
  {
    const one = withFront(withOrder(4, 3), 'spider', TID);   // sellable 1
    ok(serve76(one) === true && one.items[TID].stock === 3 && reservedFor(one, TID) === 3,
       'reserve: a bulk-buyer with 1 sellable buys ONE unit — the reserve is untouched (4->3)');
    const two = withFront(withOrder(6, 3), 'spider', TID);   // sellable 3
    ok(serve76(two) === true && two.items[TID].stock === 4 && reservedFor(two, TID) === 3,
       'reserve: a bulk-buyer with 3 sellable takes its two, reserve still 3 (6->4)');
  }

  // (d) F2 stays DECOUPLED from the reserve — demand reads PHYSICAL stock, so a reserved shelf (full
  // OR partial) still reads STOCKED. Coupling it (a fully-reserved shelf reads unstocked) was built
  // and reverted: the acceptance sim showed it concentrated demand onto the cheap shelves and cost
  // throughput (market-blind 21%->0%), while the dead-queue it targeted stayed ~0% either way
  // (decision log §9). These pins GUARD against re-coupling — the reserve must not touch demand.
  {
    const dial = CONFIG.queue.supplyWantBias;
    const full = withOrder(3, 3); delete full.stats.itemSales[TID];   // sellable 0, but raw stock 3
    ok(sww76(full, TID) === dial.stocked,
       'reserve+F2 DECOUPLED: a fully-reserved shelf STILL reads stocked (demand = physical stock, not sellable)');
    const partial = withOrder(5, 3);
    ok(sww76(partial, TID) === dial.stocked,
       'reserve+F2 DECOUPLED: a partially-reserved shelf reads stocked too (reserve is orthogonal to demand)');
    const empty = withOrder(0, 3); delete empty.stats.itemSales[TID];   // raw empty, never sold
    ok(sww76(empty, TID) === dial.unknown,
       'reserve+F2: a raw-empty never-sold shelf still falls to the UNKNOWN floor (F2 logic itself unchanged by B1)');
  }

  // (e) Leave-theft respects the reserve — a thief (Ratty) timing out on a fully-held shelf pockets
  // NOTHING; on a sellable shelf he still takes his one unit (the reserve caps the loss).
  {
    const held = withOrder(3, 3);   // sellable 0
    held.queue = [{ monsterId: 'rat', wantedItemId: TID, budget: 99, patienceRemaining: 0.01, state: 'queued' }];
    up76(held, 0.05);
    ok(held.items[TID].stock === 3 && held.log[0]?.tier === 'leave',
       'reserve: a thief cannot pocket a RESERVED unit — an honest leave, shelf whole (3)');
    const some = withOrder(5, 3);   // sellable 2
    some.queue = [{ monsterId: 'rat', wantedItemId: TID, budget: 99, patienceRemaining: 0.01, state: 'queued' }];
    up76(some, 0.05);
    ok(some.items[TID].stock === 4 && reservedFor(some, TID) === 3,
       'reserve: a thief still steals from the SELLABLE pool (5->4); the order-3 reserve survives');
  }

  // (f) Offline honors the reserve — Bob sells only sellable units while away; the held units
  // survive the absence (a hard reserve is hard even with the tab closed).
  {
    const HOUR = 3600 * 1000, now = Date.now();
    const base = () => {
      const s = shopState();
      s.workers.mimic_merchant.owned = true;
      s.licenses[TID] = true;
      for (const id of ITEM_ORDER) s.items[id].stock = 0;   // isolate the trade item
      s.items[TID].stock = 5;
      s.lastSeen = now - HOUR;                               // ample time — stock is the binder
      return s;
    };
    const free = base();
    const rFree = off76(free, now);
    ok((rFree.consumed[TID] ?? 0) === 5,
       'reserve+offline: with no order, Bob sells all 5 shelf units away (time-ample control)');
    const withComm = base();
    withComm.commission = { itemId: TID, count: 3, monsterId: 'slime', days: 2, placedIndex: 3 };
    const rComm = off76(withComm, now);
    ok((rComm.consumed[TID] ?? 0) === 2,
       'reserve+offline: an order-3 reserve caps offline sales at the 2 sellable units');
    applyOff76(withComm, rComm);
    ok(withComm.items[TID].stock === 3,
       'reserve+offline: the 3 reserved units survive the absence on the real shelf');
  }

  // (g) Fulfillment is unaffected — canFulfill / fulfill read RAW stock (the reserve's own consumer),
  // and a fulfilled order releases the reserve by taking the units.
  {
    const s = withOrder(3, 3);   // exactly enough; every unit reserved AND every unit fulfillable
    ok(canFill76(s) === true, 'reserve: a shelf covering the order fulfills (fulfillment reads RAW stock)');
    ok(fill76(s) === true && s.items[TID].stock === 0 && s.commission === null,
       'reserve: fulfilling consumes the count and clears the order (the reserve releases)');
  }

  // (g2) Integration through the REAL placement path (§70's machinery) — a placed order reserves too.
  {
    const s = shopState();
    s.licenses[TID] = true;
    s.tradeDayKeyOverride = 'sim-day-3';
    refresh76(s);                                  // seats a real day-seeded order (only TID eligible)
    const c = s.commission;
    ok(!!c && c.itemId === TID, 'reserve: the armed machinery seats a real order for the licensed item');
    s.items[TID].stock = c.count;                  // stock it to exactly the order
    ok(reservedFor(s, TID) === c.count && sellableStock(s, TID) === 0,
       'reserve: a REAL placed order reserves its whole count off the counter');
  }

  // (h) Awareness wiring (the §63f house pattern — text where headless can't reach the render):
  // the shop-side indicator + its scoped hidden override, the overlay clause, and the serve label.
  {
    const { readFileSync: rf76 } = await import('node:fs');
    const panels = srcOf('./src/ui/panels.js');
    ok(panels.includes('item-reserve') && panels.includes('reservedFor')
       && panels.includes("'reserved': 'Held for order'"),
       'reserve: panels.js carries the shop-side indicator, the reservedFor read, and the serve label');
    const css = srcOf('./style.css');
    ok(css.includes('.hidden{display:none !important;}') && css.includes('.comm-reserved'),
       'reserve: .item-reserve (0-2-0!) hides under §87\u2019s !important law \u2014 the ONE case moving .hidden could never fix \u2014 and .comm-reserved is styled');
    const market = srcOf('./src/ui/market.js');
    ok(market.includes('comm-reserved') && market.includes('reservedFor'),
       'reserve: the overlay Special Order row shows the held-from-counter clause');
    const off = srcOf('./src/offline.js');
    ok(off.includes('sellableStock(state, id)'),
       'reserve: offline sells sellableStock, not raw stock (wiring pin)');
  }
}

// 77. DOUG LEVELING (Fleet Feet — the scavengeSpeed dial, 2026-07-14). Doug was the only worker
// without a training ladder; this pass adds his `levels` block (Bob/Greg's exact shape) with a NEW
// scavengeSpeed effect that shortens his run interval via effectiveWorkerInterval's scavenge branch.
// Exact ladder COSTS stay pinned in the Bob section (same constants, not roster-dependent); this
// newest section owns the NEW content: the effect, the interval math (the "upgrade matters" probe),
// the scavenge-role scoping, and Doug's gate/persistence/fametrack flow. Economy-touching
// (faster runs => more scrap + relic-find rolls) -> certified 3x bit-identical alongside this pass.
{
  const { WORKERS, workerLevel, workerLevelCost, isWorkerLevelMaxed, sumWorkerEffect } =
    await import('./src/data/workers.js');
  const { canBuyWorkerLevel, buyWorkerLevel } = await import('./src/game.js');
  const { trackByTier } = await import('./src/data/fametrack.js');

  const L = WORKERS.scavenger.levels;

  // (a) The gap closes: Doug ships a training ladder now (he was the last untrainable worker).
  ok(!!L, 'doug levels: Doug now ships a training ladder (the last untrainable worker, closed)');

  // (b) Ladder-shape contract — Doug reuses Bob/Greg's exact ladder. The exact COST figures live in
  // the Bob section (ladder constants, not roster-dependent); here one cost check DERIVES from the
  // live formula over Doug's own params, so no exact is hand-typed twice ("derive never hand-type").
  ok(L.baseCost === 2000 && L.costGrowth === 1.15 && L.maxLevel === 10
     && L.deepFrom === 6 && L.deepTier === 6 && L.deepCostMult === 3,
     'doug levels: Bob/Greg ladder shape — 2000/1.15, max 10, deep band 6-10 x3, Mythic-gated');
  ok(typeof L.name === 'string' && L.name.length > 0 && typeof L.desc === 'string' && L.desc.length > 0,
     'doug levels: an authored name + effect desc are present');
  ok(workerLevelCost('scavenger', 0) === L.baseCost
     && workerLevelCost('scavenger', 9) === Math.round(L.baseCost * L.costGrowth ** 9 * L.deepCostMult),
     'doug levels: cost derives from the shared formula over Doug\u2019s params (deep bump on L10)');

  // (c) The NEW effect (genuinely new content, so its exact lives here): scavengeSpeed +0.25/level.
  ok(L.effect?.type === 'scavengeSpeed' && L.effect.perLevel === 0.25,
     'doug levels: the new effect is scavengeSpeed +0.25/level');

  // (d) The upgrade MATTERS — the interval math, expected DERIVED from the live formula over Doug's
  // fixture (base/(1+0.25L)), and max must be materially faster than L0 (never an inert top level).
  {
    const base = WORKERS.scavenger.baseInterval;
    const per = L.effect.perLevel;
    const ivAt = (lvl) => effectiveWorkerInterval({ workers: { scavenger: { owned: true, level: lvl } } }, 'scavenger');
    ok(ivAt(0) === base, 'doug speed: level 0 is the plain 24s dial — no effect until trained');
    ok(ivAt(1) === base / (1 + per * 1) && ivAt(2) === base / (1 + per * 2),
       'doug speed: L1/L2 shorten to base/(1+0.25L) — the -20%/-33% honest curve');
    ok(ivAt(L.maxLevel) === base / (1 + per * L.maxLevel) && ivAt(L.maxLevel) < base * 0.5,
       'doug speed: max level runs materially faster than level 0 (the upgrade is not inert)');
  }

  // (e) The leak guard (the seam's whole reason): a maxed Doug must NOT speed Bob's serve or Greg's
  // restock — scavengeSpeed is scoped to the scavenge role. (§57 pins the reverse: trickleSpeed
  // never speeds Doug.)
  {
    const dougMax = { workers: { scavenger: { owned: true, level: L.maxLevel } } };
    ok(effectiveWorkerInterval(dougMax, 'mimic_merchant') === WORKERS.mimic_merchant.baseInterval
       && effectiveWorkerInterval(dougMax, 'restocker') === WORKERS.restocker.baseInterval,
       'doug speed: scavengeSpeed never bleeds into Bob serve or Greg restock (scoped)');
  }

  // (f) Ownership gate — a level on an unowned Doug sums to nothing (mirror of the saleTip inert pin).
  {
    const inert = createInitialState();
    inert.workers.scavenger.level = 5;                          // level without ownership
    ok(sumWorkerEffect(inert, 'scavengeSpeed') === 0,
       'doug speed: an unowned scavengeSpeed level is inert (sums to 0)');
  }

  // (g) The gate + purchase path, both ways (mirrors Bob's): L1-5 open at hire below Mythic, L6
  // demands Mythic, MAX closes; an unhired Doug cannot train. The shallow-band total DERIVES from
  // the live formula (no hand-typed 13485).
  {
    const s = shopState();
    s.workers.scavenger.owned = true;
    s.gold = 1e9; s.lifetimeRep = CONFIG.reputation.tiers[5].min;   // Legendary — deep band still shut
    const shallow = [0, 1, 2, 3, 4].reduce((t, l) => t + workerLevelCost('scavenger', l), 0);
    const g0 = s.gold;
    for (let i = 0; i < 5; i++) ok(buyWorkerLevel(s, 'scavenger'), `doug train: level ${i + 1} buys below Mythic`);
    ok(g0 - s.gold === shallow, `doug train: the shallow band costs the live-summed ${shallow} (spent ${g0 - s.gold})`);
    ok(canBuyWorkerLevel(s, 'scavenger') === false, 'doug train: level 6 refuses below Mythic (deep gate)');
    s.lifetimeRep = CONFIG.reputation.tiers[6].min;                // cross into Mythic
    ok(canBuyWorkerLevel(s, 'scavenger') === true, 'doug train: Mythic opens the deep band');
    while (canBuyWorkerLevel(s, 'scavenger')) buyWorkerLevel(s, 'scavenger');
    ok(workerLevel(s, 'scavenger') === L.maxLevel && isWorkerLevelMaxed(s, 'scavenger'),
       'doug train: the ladder tops out at maxLevel and closes');
    ok(canBuyWorkerLevel(shopState(), 'scavenger') === false,
       'doug train: an unhired Doug cannot train (fail-closed)');
  }

  // (h) Persistence — the scavenger level round-trips, a hand-edited 999 clamps to the ladder, and a
  // pre-pass save reads level 0 (the additive-schema guard, now covering Doug too).
  {
    const rt = shopState(); rt.workers.scavenger.owned = true; rt.workers.scavenger.level = 4;
    ok(mergeSave(createInitialState(), serializeSave(rt)).workers.scavenger.level === 4,
       'doug save: the scavenger level round-trips');
    const tampered = mergeSave(createInitialState(), { workers: { scavenger: { owned: true, level: 999 } } });
    ok(tampered.workers.scavenger.level === L.maxLevel, 'doug save: a hand-edited 999 clamps to the ladder');
    const legacy = mergeSave(createInitialState(), { workers: { scavenger: { owned: true } } });
    ok(legacy.workers.scavenger.level === 0, 'doug save: a pre-pass save reads level 0 (additive schema)');
  }

  // (i) The fametrack chip — Doug's deep band now lists itself on the Mythic node with zero wiring
  // (the registry scan keys off any levels block carrying a deepTier). Derived name, not hand-typed.
  {
    const node = trackByTier().at(-1);                           // Mythic (Doug's deepTier)
    ok(node.unlocks.some((u) => u.detail === 'deep training' && u.label.includes(WORKERS.scavenger.displayName)),
       'doug track: Doug\u2019s deep band auto-lists on the Mythic node (registry-scanned)');
  }
}

// ============================================================================================
// §78 — DOUG'S CLOCK: render/logic agreement (the desync the BROWSER caught, 2026-07-14)
// WHY THIS SECTION EXISTS: §77 asserted the interval MATH and passed 24/24 while Doug was
// visibly broken on screen — he walked home from the portal, popped, and re-emerged from the
// door with no idle beat. The renderer (scene.js drawScavenger) and the cameo gate (isDougOut)
// each hardcoded baseInterval, which was CORRECT until training gave scavenge a speed dial.
// Once it had one, `elapsed = 24 - timer` could never fall below (24 - trained), stranding the
// idle and out-leg phases at every timer value. §77 could not see it: it tested the mechanism
// (the interval number), never the effect (whether Doug is ever visibly home).
// These pins assert the EFFECT. scene.js can't be imported headlessly (canvas), so the phase
// budget is reconstructed from the SAME registry fields and the SAME shared clock the renderer
// consumes — if those agree, the choreography does too.
// ============================================================================================
{
  const { WORKERS, scavengeClock } = await import('./src/data/workers.js');
  const { effectiveWorkerInterval: effIntClock, isDougOut } = await import('./src/game.js');
  const d = WORKERS.scavenger;
  const DL = d.levels;
  const mkD = (level) => ({ workers: { scavenger: { owned: true, level, timer: 0 } } });
  const rungs = [0, DL.deepFrom - 1, DL.maxLevel];   // base / pre-deep max / trained max — DERIVED

  // (a) ONE SOURCE OF TRUTH — the clock the renderer reads IS the clock that fires runs. This is
  // the pin that would have caught the original defect on the bench instead of in the browser.
  for (const lv of rungs) {
    const st = mkD(lv);
    ok(Math.abs(scavengeClock(st) - effIntClock(st, 'scavenger')) < 1e-9,
       `doug clock: L${lv} scavengeClock === effectiveWorkerInterval (render/logic agree)`);
  }

  // (b) The dial reaches the clock at all — a wrong state shape would read as level 0 and let
  // every ratio pin below pass vacuously.
  ok(Math.abs(scavengeClock(mkD(0)) - d.baseInterval) < 1e-9,
     'doug clock: L0 is exactly baseInterval (untrained Doug keeps the authored cadence)');
  ok(scavengeClock(mkD(DL.maxLevel)) < scavengeClock(mkD(0)),
     'doug clock: a trained Doug runs strictly faster than an untrained one');

  // (c) PHASE BUDGET at EVERY rung, rebuilt from the renderer's own registry fields. The legs
  // must never overlap (scene.js's own walk guard) and an idle beat must survive to the top rung.
  for (let lv = 0; lv <= DL.maxLevel; lv++) {
    const interval = scavengeClock(mkD(lv));
    const walk = Math.min(d.walkSec, interval / 4);      // scene.js's degenerate-interval guard
    const idleSec = interval * d.idleFrac;
    ok(idleSec > 0 && idleSec + walk <= interval - walk,
       `doug clock: L${lv} phases fit — idle ${idleSec.toFixed(2)}s, legs never overlap`);
  }

  // (d) THE REGRESSION ITSELF — sweep a whole cycle at the trained max; every phase must be
  // reachable. Pre-fix, 'idle' and 'out' were unreachable at ANY timer value: that was the pop.
  {
    const interval = scavengeClock(mkD(DL.maxLevel));
    const walk = Math.min(d.walkSec, interval / 4);
    const idleSec = interval * d.idleFrac;
    const outEnd = idleSec + walk, backStart = interval - walk;
    const seen = new Set();
    for (let i = 0; i <= 2000; i++) {
      const elapsed = interval - Math.max(0, Math.min(interval * (1 - i / 2000), interval));
      if (elapsed < idleSec) seen.add('idle');
      else if (elapsed < outEnd) seen.add('out');
      else if (elapsed < backStart) seen.add('gone');
      else seen.add('back');
    }
    for (const phase of ['idle', 'out', 'gone', 'back']) {
      ok(seen.has(phase), `doug clock: a fully trained Doug still reaches the ${phase} phase`);
    }
  }

  // (e) The cameo gate must TOGGLE across a cycle at every rung. Permanently-out (or
  // permanently-home) is the same desync wearing a different hat — §14 battle cameos read this.
  for (const lv of rungs) {
    const st = mkD(lv);
    const interval = scavengeClock(st);
    let outN = 0, n = 0;
    for (let i = 0; i <= 2000; i++, n++) {
      st.workers.scavenger.timer = interval * (1 - i / 2000);
      if (isDougOut(st)) outN++;
    }
    ok(outN > 0 && outN < n,
       `doug clock: L${lv} isDougOut toggles across the cycle (out ${(100 * outN / n).toFixed(0)}%)`);
  }

  // (f) The hire gate outranks the clock at every rung — an unhired Doug is never out there.
  ok(isDougOut({ workers: { scavenger: { owned: false, level: DL.maxLevel, timer: 0 } } }) === false,
     'doug clock: an unhired Doug is never out (hire gate outranks the clock)');

  // (g) SOURCE PIN (§0b precedent) — (a)-(f) prove the shared clock is CORRECT; only this proves
  // the two former hardcode sites actually CONSUME it. Without this, re-deriving a clock from
  // baseInterval in the renderer would sail through every pin above — precisely the false-green
  // that let this ship: a headless suite cannot draw Doug, so the contract is pinned in source.
  {
    const { readFileSync } = await import('node:fs');
    const sceneSrc = srcOf('./src/render/scene.js');
    const gameSrc = srcOf('./src/game.js');
    ok(/scavengeClock\(state\)/.test(sceneSrc),
       'doug clock: scene.js drawScavenger consumes the shared scavengeClock');
    ok(!/const\s+interval\s*=\s*WORKERS\.scavenger\?\.baseInterval/.test(sceneSrc),
       'doug clock: scene.js never re-derives Doug\u2019s clock from baseInterval');
    ok(!/const\s+interval\s*=\s*d\.baseInterval/.test(gameSrc),
       'doug clock: isDougOut never re-derives Doug\u2019s clock from baseInterval');
  }
}


// ===== SECTION 79 — THE HUD BAND: Menu-button reservation + the remainder's move (2026-07-15) =====
// Daniel's browser: the Scrap chip sat UNDER the Menu button. MEASURED in a real browser at stage
// scale 1 — the cause was NOT "three chips don't fit" (three chips at fresh numbers clear the
// button by ~32px). Two faults compounded:
//   (1) .hud and #menu-btn were BOTH anchored right:16px, so the band ran to the button's own
//       right edge — the button (z6) simply painted over whatever reached it. Nothing reserved it.
//   (2) F1a widened the Rep chip by ~213px two days AFTER the 2026-07-10 budget was measured
//       (the badge gained "· Lv N"; #hud-next went from '' past the last rung to ALWAYS populated
//       because the level curve is infinite). The budget's "~770px" was accurate when written and
//       expired unnoticed — nothing headless measures CSS geometry.
// The fix Daniel picked: MOVE the next-level remainder to the Fame panel (which already owned the
// next-rung one), and reserve the button's column. Exact totals for this pass live HERE.
{
  const { readFileSync: rf79 } = await import('node:fs');
  const { fameStandingHtml: fsh79 } = await import('./src/ui/panels.js');
  const { levelThreshold: lt79, fameLevel: fl79 } = await import('./src/reputation.js');
  const { nextTierInfo: nti79 } = await import('./src/data/fametrack.js');
  const css79 = srcOf('./style.css');
  const hud79 = srcOf('./src/ui/hud.js');
  const tiers79 = CONFIG.reputation.tiers;

  // --- (a) The HUD markup: the remainder span is GONE; the badge survives; still three chips. ---
  ok(!hud79.includes('hud-next'),
     'hud band: the #hud-next span is gone from the HUD markup');
  ok(hud79.includes('id="hud-tier"') && hud79.includes('id="hud-gold"') && hud79.includes('id="hud-rep"')
     && hud79.includes('id="hud-scrap"'),
     'hud band: Gold / Rep / badge / Scrap all survive the cut');
  ok((hud79.match(/class="hud-chip/g) ?? []).length === 3,
     'hud band: the row is still exactly three chips (Gold, Rep, Scrap)');

  // --- (b) THE STRUCTURAL LAW this pass exists to encode: the band must STOP before #menu-btn.
  // Expressible headlessly only as an ORDERING law (hud.right > menu.right by at least the
  // button's width). The width itself is MEASURED (~72px in a fallback face; Segoe UI renders it
  // narrower, so the reservation over-reserves — the safe direction) and cannot be derived
  // without a layout engine, which is exactly why fault (1) went unseen for so long. ---
  const cssRight = (sel) => {
    const m = new RegExp(`\\${sel}\\{([^}]*)\\}`, 's').exec(css79);
    const r = m && /right:\s*(\d+)px/.exec(m[1]);
    return r ? Number(r[1]) : null;
  };
  const hudRight = cssRight('.hud');
  const menuRight = cssRight('.menu-btn');
  const MENU_BTN_W = 72;                       // MEASURED 71.34px (fallback face), rounded up
  ok(hudRight !== null && menuRight !== null,
     'hud band: guard-the-guard — the CSS scanner found both right: offsets');
  ok(hudRight > menuRight,
     'hud band: the HUD band stops SHORT of #menu-btn (the fault was: both equal at 16px)');
  ok(hudRight - menuRight >= MENU_BTN_W,
     `hud band: the reservation clears the Menu button's own width (>= ${MENU_BTN_W}px)`);

  // --- (c) "Don't shrink" is now ENFORCED, not merely asserted in prose. Without flex-shrink:0
  // an over-full row squeezed the chips and wrapped their text (45px -> 58px tall) instead of
  // failing visibly — a deformation nobody files a bug about. ---
  ok(/\.hud-chip\{[^}]*flex-shrink:\s*0/s.test(css79),
     'hud band: .hud-chip carries flex-shrink:0 (the budget\u2019s "don\u2019t shrink" law made real)');

  // --- (d) The cascade-tie law (the .offer-row.hidden precedent): .hud-chip sets its own
  // display, so the bare .hidden utility only wins by SOURCE ORDER. The Scrap chip toggles
  // .hidden, so it needs the scoped form. ---
  ok(css79.includes('.hidden{display:none !important;}'),
     'hud band: the hide utility out-cascades .hud-chip\u2019s own display (§87\u2019s law; the scoped override is retired)');

  // --- (e) The budget comment's FALSIFIED claims are actually retired, not just contradicted.
  // A comment at a live seam is a claim with an expiry date; these three expired.
  // rawSrc ON PURPOSE (§88's allow-list): these pins' SUBJECT IS PROSE — they assert the budget
  // COMMENT was re-dated and its dead claims removed. srcOf would make the negative pins vacuous
  // (a stripped comment "passes" any absence test) and the positive pin impossible. The migration
  // itself caught this: pin (e3) went red on stripped text, which is how it earned this hatch. ---
  const cssProse79 = rawSrc('./style.css');
  ok(!/the market chip docks at top:68/.test(cssProse79),
     'hud band: the dead "market chip docks at top:68" claim is gone (that chip retired at 18be9de)');
  ok(!/reach ~770px at endgame/.test(cssProse79),
     'hud band: the expired "~770px at endgame" figure is gone (F1a added ~213px)');
  ok(/LAYOUT BUDGET \(re-measured 2026-07-15/.test(cssProse79),
     'hud band: the budget is re-dated to its measurement, not its first authoring');

  // --- (f) THE STANDING LINE — behavioural, at all three shapes, every number DERIVED from the
  // live curve. This is the effect the player reads, not the mechanism that produces it. ---
  const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/&#9819;/g, '\u265b');
  const stateAt = (fame) => ({ reputation: fame, lifetimeRep: fame });

  // (f1) Next level is PLAIN (not a rung) -> BOTH remainders, level first, rung second.
  {
    const rungLevels = new Set(tiers79.map((t) => t.level));
    const lastRung = Math.max(...rungLevels);
    // a level below the last rung whose NEXT level is not itself a rung
    const lv = [...Array(lastRung).keys()].find((n) => n > 0 && !rungLevels.has(n + 1)
                                                  && nti79(lt79(n) + 1) !== null);
    ok(lv !== undefined, 'hud band: fixture — a plain-next-level rung exists on the live curve');
    const fame = lt79(lv) + 1;
    const line = strip(fsh79(stateAt(fame)));
    const expLvl = `\u00b7 ${lt79(lv + 1) - fame}\u265b to Lv ${lv + 1}`;
    const expRung = `\u00b7 ${nti79(fame).remaining}\u265b to ${nti79(fame).label}`;
    ok(line.includes(expLvl), `hud band: standing line carries the LEVEL remainder ("${expLvl}")`);
    ok(line.includes(expRung), `hud band: standing line carries the RUNG remainder ("${expRung}")`);
    ok(line.indexOf(expLvl) < line.indexOf(expRung),
       'hud band: the frequent beat (level) reads before the rare one (rung)');
    ok(line.includes(`lifetime \u265b ${fame}`) && line.includes(`to spend \u265b ${fame}`),
       'hud band: the dual-track header survives the move');
  }

  // (f2) Next level IS a rung -> ONE remainder. nextLevelInfo and nextTierInfo return the SAME
  // number for the SAME destination here, so a naive append stutters
  // ("· 17293♛ to Legendary · 17293♛ to Legendary"). THE no-stutter law.
  {
    const rungLv = tiers79.find((t) => t.level > 0).level;
    const fame = lt79(rungLv - 1) + 1;
    ok(fl79(fame) === rungLv - 1, 'hud band: fixture — one level below a rung (guard-the-guard)');
    const label = tiers79.find((t) => t.level === rungLv).label;
    const line = strip(fsh79(stateAt(fame)));
    const expect = `\u00b7 ${lt79(rungLv) - fame}\u265b to ${label}`;
    ok(line.includes(expect), `hud band: next-level-IS-a-rung names the rung ("${expect}")`);
    ok(line.split(`to ${label}`).length - 1 === 1,
       'hud band: the rung is named exactly ONCE — no stutter when both remainders agree');
    ok(!/to Lv \d+/.test(line),
       'hud band: no redundant "to Lv N" beside the rung it already names');
  }

  // (f3) Past the last rung -> the ladder line, but the LEVEL remainder keeps counting (the curve
  // is infinite; the rung ladder is not). This is the case F1a created and the HUD used to render
  // as an empty span pre-F1a.
  {
    const lastRung = Math.max(...tiers79.map((t) => t.level));
    const fame = lt79(lastRung + 2) + 1;
    ok(nti79(fame) === null, 'hud band: fixture — past the last rung (guard-the-guard)');
    const line = strip(fsh79(stateAt(fame)));
    ok(line.includes('top of the ladder'),
       'hud band: past the last rung the standing line says "top of the ladder"');
    ok(line.includes(`\u00b7 ${lt79(lastRung + 3) - fame}\u265b to Lv ${lastRung + 3}`),
       'hud band: the level remainder keeps counting past the last rung (infinite curve)');
  }

  // --- (g) The cache-bust must move in BOTH shells or Daniel tests a stale sheet — this pass
  // changed style.css, so the version is pinned ABOVE the value it had at the previous tip. ---
  {
    const idx79 = srcOf('./index.html');
    const kong79 = srcOf('./index.kongregate.html');
    const ver = (s) => { const m = /style\.css\?v=(\d+)/.exec(s); return m ? Number(m[1]) : null; };
    ok(ver(idx79) !== null && ver(idx79) === ver(kong79),
       'hud band: both entry shells carry the SAME style.css cache-bust');
    ok(ver(idx79) >= 15,
       'hud band: the cache-bust advanced for this pass\u2019s style.css change (>= v15)');
  }
}


// ===== SECTION 80 — THE BESTIARY / EXPEDITION SPLIT (Daniel, 2026-07-15 — Option 3, pass one) =====
// One card was two things: a loyalty ledger AND an expedition job card — the expedition surface
// wearing the Bestiary label. Now the tab is "Mobs" with two sub-views (Expeditions / Field Guide).
// The obvious shape — a 6th nav tab — is FORBIDDEN by the 2026-07-04 law ("panel ends 454, 5-tab
// nav reaches ~470-480, a 6th tab does NOT fit — redesign, don't shrink"), which MEASURED true
// again on 2026-07-15: a 6th tab overlaps the customer panel in every fallback face, and even in
// Segoe UI at any label longer than ~4 characters. So the split is VERTICAL, not horizontal.
// A headless suite cannot draw a panel (the §0b/§78 precedent), so the DOM contract is pinned in
// SOURCE. Exact totals for this pass live HERE.
{
  const { readFileSync: rf80 } = await import('node:fs');
  const nav80 = srcOf('./src/ui/nav.js');
  const pnl80 = srcOf('./src/ui/panels.js');
  const css80 = srcOf('./style.css');

  // --- (a) THE 6TH-TAB LAW, encoded. The nav is right-anchored and grows LEFTWARD into the
  // customer panel, so tab COUNT is a layout constraint, not a menu preference. ---
  const tabsBlock = /const TABS = \[([\s\S]*?)\];/.exec(nav80)?.[1];
  ok(!!tabsBlock, 'split: guard-the-guard — the TABS block was found in nav.js');
  const tabCount = (tabsBlock.match(/\{\s*id:/g) ?? []).length;
  ok(tabCount === 5,
     `split: the nav holds exactly 5 tabs — a 6th does NOT fit the bottom-bar budget (found ${tabCount})`);
  ok(/\{\s*id:\s*'bestiary',\s*label:\s*'Mobs'\s*\}/.test(tabsBlock),
     'split: the tab is labelled "Mobs" (id stays \u2018bestiary\u2019 — internal, and the panel still is)');
  ok(!/label:\s*'Bestiary'/.test(nav80),
     'split: no tab still claims the "Bestiary" label (the surface was never one)');

  // --- (b) THE SPLIT ITSELF: each sub-view's card carries its OWN job and not the other's.
  // Sliced out of the source so a Send button drifting back onto a guide card fails here.
  // NOTE the anchor: the outer close is `</div>`).join('');` — a lazy match to the first
  // `.join('')` truncates the guide template mid-way, because it builds its pips with an INNER
  // .join(''). That cut the capture before `beast-sub` and the pin failed honestly first time. ---
  const sliceTpl = (which) => {
    const start = pnl80.indexOf(`getElementById('${which}').innerHTML =`);
    if (start === -1) return null;
    const end = pnl80.indexOf("\n  }).join('');", start);
    return end === -1 ? null : pnl80.slice(start, end);
  };
  const jobTpl = sliceTpl('beast-cards');
  const guideTpl = sliceTpl('guide-cards');
  ok(!!jobTpl && !!guideTpl && jobTpl !== guideTpl,
     'split: guard-the-guard — both card templates were found in panels.js, and they are distinct');
  ok(jobTpl.includes('beast-send') && jobTpl.includes('beast-exp'),
     'split: the Expeditions card carries the Send button and the runs/away line');
  ok(!jobTpl.includes('beast-pip') && !jobTpl.includes('beast-sub'),
     'split: the Expeditions card carries NO ledger (no pips, no served count)');
  ok(guideTpl.includes('beast-pip') && guideTpl.includes('beast-sub'),
     'split: the Field Guide card carries the ledger (pips + served count)');
  ok(!guideTpl.includes('beast-send'),
     'split: the Field Guide card carries NO Send button (it is not a job list)');

  // --- (c) VIPs ride the FIELD GUIDE. Binding (Daniel, 2026-07-08): special rows get their own
  // section, never rows in the grid, and never a Send button. They were never jobs — so when the
  // surface split, they belong with the trophies. ---
  ok(/getElementById\('guide-cards'\)\?\.insertAdjacentHTML/.test(pnl80),
     'split: the VIP section is inserted under the FIELD GUIDE, not the job grid');
  ok(!/getElementById\('beast-cards'\)\?\.insertAdjacentHTML/.test(pnl80),
     'split: the VIP section never attaches to the Expeditions grid');

  // --- (d) THE CASCADE-TIE LAW, live: .beast-cards sets its own display and is declared AFTER the
  // bare .hidden utility, so it WINS the 0-1-0 tie — a .hidden toggle on a card container would be
  // a silent no-op. The sub-views toggle exactly this, so the scoped overrides are load-bearing. ---
  ok(css80.includes('.hidden{display:none !important;}'),
     'split: the hide utility out-cascades .beast-cards\u2019/.mob-view\u2019s own display (§87\u2019s law; the scoped overrides are retired)');
  // (The source-order guard that lived here asserted the OLD premise — ".beast-cards is declared
  // after .hidden, so the tie is real". §87's !important makes source order irrelevant to this
  // toggle, so the guard retired with the override it guarded.)

  // --- (e) The render loop must address BOTH cards per monster. querySelector (singular) silently
  // updated only the first card in the DOM and stranded the Field Guide's silhouette forever —
  // caught before delivery; pinned so it cannot come back. ---
  ok(/querySelectorAll\(`\.beast-card\[data-beast="\$\{id\}"\]`\)/.test(pnl80),
     'split: the render loop walks querySelectorAll — both sub-views\u2019 cards update');
  ok(!/const card = document\.querySelector\(`\.beast-card\[data-beast/.test(pnl80),
     'split: the singular querySelector card lookup is gone (it updated only the first view)');

  // --- (f) The completion hint belongs to the Field Guide ("a field guide of REGULARS"), so it
  // rides that view rather than the panel title — the title must not advertise a ledger the
  // current view isn't showing. ---
  ok(/bestiary-completion'\)\?\.classList\.toggle\('hidden'/.test(pnl80),
     'split: the completion hint follows the Field Guide view');

  // --- (g) style.css changed, so the cache-bust must advance in BOTH shells. ---
  {
    const ver = (s) => { const m = /style\.css\?v=(\d+)/.exec(s); return m ? Number(m[1]) : null; };
    const vi = ver(srcOf('./index.html'));
    const vk = ver(srcOf('./index.kongregate.html'));
    ok(vi !== null && vi === vk, 'split: both entry shells carry the SAME style.css cache-bust');
    ok(vi >= 16, 'split: the cache-bust advanced for this pass\u2019s style.css change (>= v16)');
  }
}

// ===== SECTION 81 — THE WRONG-PALETTE LAW: .beast-exp's contrast (Daniel, 2026-07-15) =====
// Daniel: "the font for 'Runs' is far too light and difficult to see." MEASURED in a real browser
// (Chromium, live cascade) at 1.28:1 against the card it sits on — invisible, not "muted". AA wants
// 4.5:1; the sibling .beast-name on the same card measures 10.19:1.
//
// THE MECHANISM (measured, and it falsified the handoff's guess). This was NOT a tertiary tone that
// lost its context when the split decluttered the card. Expeditions MVP (c4905f9) transplanted the
// Market strip's row wholesale onto a PARCHMENT card: .beast-exp took .mat-chip's `10px/#cfc3e0`
// and .beast-send took .trade-btn's dark-purple treatment. Those read correctly on the market's
// DARK panel. The button carried its own background, so it survived the move intact; the TEXT
// inherited a dark-panel foreground onto tan and has been illegible since the day it shipped.
// The split didn't cause it — the split decluttered the card enough that Daniel finally SAW it.
//
// WHY A GUARD AND NOT JUST A FIX: this is a CLASS, and it has bitten before. On 2026-07-12 Daniel
// QA'd `gold-deep on tan` and .item-price moved to #6b4a1e — the instance was fixed and the sweep
// never ran. The parchment cards are the only light surfaces in a dark-purple UI, so a dark-panel
// colour looks right in the file and goes invisible on the card. This pins the EFFECT (a computed
// contrast ratio), never the hex — a pin on `#6b4a1e` would be satisfied by the comment above it
// (the §72(f) lesson: a source pin must match a structure, and comments are text too).
// SCOPE: this section owns the FIXED instance. The sweep's other live instances are Daniel's call
// as their own pass — see the handoff's NEXT block.
{
  const { readFileSync: rf81 } = await import('node:fs');
  const css81 = srcOf('./style.css');

  // WCAG 2.x relative luminance + contrast, the same math the browser probe used.
  const lin81 = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum81 = ([r, g, b]) => 0.2126 * lin81(r / 255) + 0.7152 * lin81(g / 255) + 0.0722 * lin81(b / 255);
  const contrast81 = (a, b) => {
    const [hi, lo] = [lum81(a), lum81(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const rgb81 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const ruleOf = (sel) => new RegExp(`^\\${sel}\\s*\\{([^}]*)\\}`, 'm').exec(css81)?.[1] ?? null;
  const declOf = (body, prop) => (body ? new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(body)?.[1]?.trim() ?? null : null);

  // --- (a) DERIVED, never hand-typed: the card's own background resolves through :root. ---
  const rootBody = /:root\s*\{([\s\S]*?)\}/.exec(css81)?.[1] ?? '';
  const parchHex = /--parchment\s*:\s*(#[0-9a-fA-F]{6})/.exec(rootBody)?.[1] ?? null;
  ok(!!parchHex, 'palette: guard-the-guard — :root declares --parchment');

  const cardBg = declOf(ruleOf('.beast-card'), 'background');
  ok(cardBg !== null && cardBg.includes('var(--parchment)'),
     'palette: guard-the-guard — .beast-card still renders on var(--parchment) (if this moves, the '
     + 'ratio below is measuring the wrong surface)');

  // --- (b) THE FIX, asserted as the EFFECT the player sees — a ratio, not a hex. ---
  const expColor = declOf(ruleOf('.beast-exp'), 'color');
  ok(!!expColor && /^#[0-9a-fA-F]{6}$/.test(expColor),
     'palette: guard-the-guard — .beast-exp declares a plain hex colour');
  const ratio81 = contrast81(rgb81(expColor), rgb81(parchHex));
  ok(ratio81 >= 4.5,
     `palette: .beast-exp ("N runs") clears WCAG AA on the parchment card — ${ratio81.toFixed(2)}:1 `
     + `(needs 4.5; it shipped at 1.28 and Daniel could not read it)`);

  // --- (c) THE TRANSPLANT ITSELF. The defect was not "a bad hex" — it was a DARK-PANEL colour
  // reused on tan. Derive the market strip's own foregrounds from the live CSS and assert the card
  // never borrows one. This is the rule that would have caught the bug at birth. ---
  const darkPanelColors = ['.mat-chip', '.market-forecast', '.tick-quip']
    .map((s) => declOf(ruleOf(s), 'color'))
    .filter((c) => c && /^#[0-9a-fA-F]{6}$/.test(c))
    .map((c) => c.toLowerCase());
  ok(darkPanelColors.length >= 2,
     `palette: guard-the-guard — the dark-panel foregrounds were found (${darkPanelColors.length})`);
  ok(!darkPanelColors.includes(expColor.toLowerCase()),
     'palette: .beast-exp does not borrow a DARK-PANEL foreground — the card is parchment, and a '
     + 'colour authored for the market strip is invisible on it');

  // --- (d) style.css changed again, so the bust advances again. This section owns the current
  // floor (the exact-totals doctrine: the newest batch holds the exact, older ones soften). ---
  {
    const ver81 = (s) => { const m = /style\.css\?v=(\d+)/.exec(s); return m ? Number(m[1]) : null; };
    const vi81 = ver81(srcOf('./index.html'));
    const vk81 = ver81(srcOf('./index.kongregate.html'));
    ok(vi81 !== null && vi81 === vk81, 'palette: both entry shells carry the SAME style.css cache-bust');
    ok(vi81 >= 17, `palette: the cache-bust advanced for this pass\u2019s style.css change (>= v17, found ${vi81})`);
  }
}

// ===== SECTION 82 — THE FIELD GUIDE TAGLINE (Daniel, 2026-07-15 — Option 2 staged, pass 2a) =====
// Daniel: "we need to put short but funny descriptions + as players reach new story milestones -
// more is revealed." This is pass 2a: the registry field and the card line. Pass 2b (the Dossier)
// carries the reveal — lore.beats on the pips, plus the 233 MONSTER_RESULTS lines that currently
// flash past the battle log ONCE and are gone.
// EVERY assertion here DERIVES from MONSTER_IDS: the roster has grown from 3 to 9 and will grow
// again, and a hand-typed "9 taglines" is the exact defect the 2026-07-04 batch-2 lesson recorded
// (§29's own day-old ITEM_ORDER.length === 15 broke within a day). Exact totals for this pass live
// HERE per doctrine; older sections keep the softened rules.
{
  const { readFileSync: rf82 } = await import('node:fs');
  const { MONSTERS: M82, MONSTER_IDS: IDS82 } = await import('./src/data/monsters.js');
  const pnl82 = srcOf('./src/ui/panels.js');
  const css82 = srcOf('./style.css');
  const taglines = IDS82.map((id) => M82[id]?.lore?.tagline);

  // --- (a) THE CONTRACT: every mob in the guide has a line. The Inspector included — he rides the
  // Field Guide (2026-07-08: VIPs are trophies, their own section, never the grid). ---
  ok(taglines.every((t) => typeof t === 'string' && t.length > 0),
     `lore: every monster in the live roster carries lore.tagline (${taglines.filter(Boolean).length}/${IDS82.length})`);

  // --- (b) THE BIBLE'S LAWS, applied to a new surface. 80 chars is the log's budget; the guide
  // card measured ~50 chars/line in the widest fallback face, so a tagline may wrap to two lines
  // but must never become a paragraph. ---
  ok(taglines.every((t) => (t ?? '').length <= 80),
     `lore: every tagline fits the 80-char budget (longest ${Math.max(...taglines.map((t) => (t ?? '').length))})`);
  ok(taglines.every((t) => !/\byou\b/i.test((t ?? '').replace(/you'd/gi, ''))),
     'lore: no tagline breaks the no-second-person hygiene law (the guide describes, never addresses)');
  ok(new Set(taglines).size === taglines.length,
     'lore: every tagline is distinct — a duplicated line means a copy-pasted row, not a character');

  // --- (c) THE WRITE AND THE READ. A registry field with no consumer is a dropped step wearing a
  // feature's clothes (the always-on law), so pin BOTH ends: the template that makes the element
  // and the writer that fills it. A headless suite cannot draw a card (the §0b/§78/§80 precedent). ---
  ok(/id="beast-lore-\$\{id\}"/.test(pnl82),
     'lore: the guide card template emits the beast-lore element (the WRITE)');
  ok(/beast-lore-\$\{id\}`\)[\s\S]{0,200}?lore\?\.tagline/.test(pnl82),
     'lore: panels.js READS lore?.tagline into that element — guarded, so a lore-less mob renders empty');

  // --- (d) THE SPLIT'S LAW HOLDS (§80). The job card is portrait + name + runs + Send. Lore is a
  // LEDGER concern; a tagline drifting onto the Expeditions card re-merges the two surfaces the
  // 2026-07-15 split just separated. Sliced with the §80 anchor (the outer `</div>`).join('') —
  // a lazy match to the first .join('') truncates the guide template at its inner pips join. ---
  const slice82 = (marker) => {
    const i = pnl82.indexOf(marker);
    const j = pnl82.indexOf("</div>`;\n  }).join('')", i);
    return i < 0 || j < 0 ? null : pnl82.slice(i, j);
  };
  const jobTpl82 = slice82("document.getElementById('beast-cards').innerHTML");
  const guideTpl82 = slice82("document.getElementById('guide-cards').innerHTML");
  ok(!!jobTpl82 && !!guideTpl82, 'lore: guard-the-guard — both sub-view templates were sliced');
  ok(guideTpl82.includes('beast-lore'),
     'lore: the FIELD GUIDE card carries the tagline (the ledger surface owns the character)');
  ok(!jobTpl82.includes('beast-lore'),
     'lore: the EXPEDITIONS job card does NOT — it is a job card, and §80 keeps it one');

  // --- (e) THE WRONG-PALETTE LAW (§81), applied to the line this pass adds. New text on the
  // parchment card is exactly where the .beast-exp defect was born, so it is asserted at birth
  // this time — as a computed ratio, never a hex. ---
  const rootBody82 = /:root\s*\{([\s\S]*?)\}/.exec(css82)?.[1] ?? '';
  const parch82 = /--parchment\s*:\s*(#[0-9a-fA-F]{6})/.exec(rootBody82)?.[1] ?? null;
  const loreBody = /^\.beast-lore\s*\{([^}]*)\}/m.exec(css82)?.[1] ?? null;
  const loreColor = loreBody ? /(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{6})/.exec(loreBody)?.[1] ?? null : null;
  ok(!!parch82 && !!loreColor, 'lore: guard-the-guard — .beast-lore declares a hex colour and :root a parchment');
  {
    const lin82 = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const lum82 = ([r, g, b]) => 0.2126 * lin82(r / 255) + 0.7152 * lin82(g / 255) + 0.0722 * lin82(b / 255);
    const rgb82 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [hi, lo] = [lum82(rgb82(loreColor)), lum82(rgb82(parch82))].sort((a, b) => b - a);
    const ratio = (hi + 0.05) / (lo + 0.05);
    ok(ratio >= 4.5,
       `lore: .beast-lore clears WCAG AA on the parchment card — ${ratio.toFixed(2)}:1 (the §81 law, `
       + 'asserted at birth rather than four days later)');
  }

  // --- (f) style.css changed again; this section owns the current floor. ---
  {
    const ver82 = (s) => { const m = /style\.css\?v=(\d+)/.exec(s); return m ? Number(m[1]) : null; };
    const vi82 = ver82(srcOf('./index.html'));
    const vk82 = ver82(srcOf('./index.kongregate.html'));
    ok(vi82 !== null && vi82 === vk82, 'lore: both entry shells carry the SAME style.css cache-bust');
    ok(vi82 >= 18, `lore: the cache-bust advanced for this pass\u2019s style.css change (>= v18, found ${vi82})`);
  }
}

// ===== SECTION 83 — THE DIORAMA OVERLAY GATE (Daniel, 2026-07-15 — Option 1) =====
// His screenshot: the hire chip painting through an open Field Guide. The three diorama DOM
// overlays (hire chip / Greg's bubble / Bob's bubble) are SIBLINGS of #shop-ui at z5 vs its z4, so
// they render over any open center panel. MEASURED in a real browser: all three sit FULLY inside
// the panel's box (640x500 @ 320,96) and win elementFromPoint at their own centres — the panel
// column is the diorama's centre, which is exactly where things worth pointing at live.
//
// THE COMMENT THAT CAUSED IT (style.css, .hire-goal-chip): "z5 keeps it above the panels (z4) and
// under the title overlay (z10), so it only shows in-shop." Two claims fused into one number —
// staying under the title is a REQUIREMENT; being above the panels was a CONSEQUENCE of picking 5,
// recorded as though it were the intent. The third comment this project has retired for reasoning
// about the world as it stood (cf. scavenge's "this IS the clock", isDougOut's "~12s dwarfs that").
//
// WHY NOT z-index: full containment means "under the panel" and "hidden" look identical, so lowering
// z buys nothing and costs pointer-events:none on a full-stage container (#shop-ui is inset:0 and
// the file sets pointer-events NOWHERE) — where one missed interactive descendant goes silently
// dead. The fix is the house attention doctrine instead: a signal stands down when the player is
// already looking (setShopAttention's nav-pulse precedent).
// SOURCE PINS, per §0b/§78/§80: a headless suite cannot paint a panel. They match STRUCTURE, never
// bare symbol names — §72(f) stayed green through the removal that invalidated it because the
// COMMENT explaining the move contained the string, and the comments above are full of these names.
{
  const { readFileSync: rf83 } = await import('node:fs');
  const nav83 = srcOf('./src/ui/nav.js');
  const pnl83 = srcOf('./src/ui/panels.js');
  const main83 = srcOf('./src/main.js');
  const navMod = await import('./src/ui/nav.js');

  // --- (a) THE READER, tested for real. isPanelOpen touches no DOM (a pure read of module state),
  // so unlike the rest of this section it does not need a source pin. ---
  ok(typeof navMod.isPanelOpen === 'function', 'overlay: nav.js exports isPanelOpen()');
  ok(typeof navMod.isPanelOpen() === 'boolean', 'overlay: isPanelOpen() returns a boolean');
  ok(/export function isPanelOpen\(\)\s*\{\s*return activeTab !== null;\s*\}/.test(nav83),
     'overlay: isPanelOpen derives from activeTab — setTab\u2019s own collapsed contract, not a second flag');

  // --- (b) THE RE-RENDER. A tab change was a pure visibility swap and is not one any more: the
  // overlays gate on isPanelOpen(), which panels.js only re-reads on a render. Without this an
  // overlay lingers across the panel until the next unrelated uiDirty (a spawn, a serve). ---
  ok(/let dirty = \(\) => \{\};/.test(nav83),
     'overlay: nav.js holds a dirty callback defaulted to a no-op (a caller that omits it cannot crash)');
  ok(/dirty = typeof onDirty === 'function' \? onDirty : \(\) => \{\};/.test(nav83),
     'overlay: initNav stores onDirty defensively — a non-function argument degrades, never throws');
  ok(/root\.querySelectorAll\('\.nav-btn'\)\.forEach\([\s\S]{0,160}?\);\s*(?:\/\/[^\n]*\n\s*)*dirty\(\);\s*\}/.test(nav83),
     'overlay: setTab marks the UI dirty, so the overlays stand down on the NEXT FRAME, not the next spawn');

  // --- (c) THE WIRING. The import LIST is the structure; a bare-name search would pass on prose. ---
  ok(/import \{[^}]*\bisPanelOpen\b[^}]*\} from '\.\/nav\.js';/.test(pnl83),
     'overlay: panels.js imports isPanelOpen from nav.js (the import list, not a mention)');
  ok(/const panelOpen = isPanelOpen\(\);/.test(pnl83),
     'overlay: panels.js reads the gate ONCE per render and shares it across the three overlays');
  ok(/initNav\(document\.getElementById\('nav'\),\s*\(\) => \{ state\.uiDirty = true; \}\)/.test(main83),
     'overlay: main.js passes the onDirty handler into initNav');

  // --- (d) ALL THREE OVERLAYS GATED. Fixing only the reported one leaves the door open — and the
  // two Daniel did NOT report are the ones that fire forever (Greg ~10s per ~45s, Bob's reminder
  // every ~30s) over whatever panel is open. ---
  ok(/hireChip\.classList\.toggle\('hidden', bobOwned \|\| panelOpen\)/.test(pnl83),
     'overlay: the hire chip stands down while a panel is open (the instance Daniel caught)');
  ok(/const showing = \(state\.gregBubble\?\.showFor \?\? 0\) > 0 && isWorkerOwned\(state, 'restocker'\)\s*\n?\s*&& !panelOpen;/.test(pnl83),
     'overlay: Greg\u2019s bubble gates at `showing` — which collapses BOTH branches, including the '
     + 'quip branch that force-REMOVES .hidden and would otherwise paint through');
  ok(/const show = !!cur && isWorkerOwned\(state, 'mimic_merchant'\) && !panelOpen;/.test(pnl83),
     'overlay: Bob\u2019s license bubble stands down while a panel is open');

  // --- (e) THE ORDERING THIS PASS MADE LOAD-BEARING. activeTab is 'shop' at module load, so
  // isPanelOpen() is TRUE until initNav's boot `setTab(root, null)` collapses it. Render first and
  // the chip is hidden on a fresh save — the pseudo-tutorial silently gone, with nothing to see. ---
  {
    const iNav = main83.indexOf("initNav(document.getElementById('nav')");
    const iRender = main83.search(/^renderPanels\(state\);/m);
    ok(iNav > 0 && iRender > 0, 'overlay: guard-the-guard — both call sites were found in main.js');
    ok(iNav < iRender,
       'overlay: initNav runs BEFORE the first renderPanels — nav boots collapsed, and a render '
       + 'ahead of it would read activeTab\u2019s module default (\u2018shop\u2019) and hide the hire chip at boot');
  }
}

// ===== SECTION 84 — THE DOSSIER (Daniel, 2026-07-15 — Option 2, pass 2b) =====
// The card advertises, the Dossier informs. Pass 2a gave every mob a tagline; 2b unfolds four
// labelled field notes on the serve pips, then the mob's golden line as the capstone.
//
// THIS SECTION EXISTS BECAUSE THE FIRST DRAFT WAS WRONG, and in a way no test would have caught:
// it wrote three more TAGLINES per mob and bucketed 211 recycled battle-log lines underneath them.
// Daniel rejected both halves. The two defects are different and both are pinned below:
//   (1) A tagline STATES what a creature permanently is; a note tells you about a time it DID
//       something. The first draft's "beats" averaged 64 chars — captions wearing a paragraph's
//       clothes. (b) pins a length FLOOR for exactly this, which is an unusual thing to assert and
//       the whole reason it is here: the failure mode is writing SHORT, not writing long.
//   (2) A battle-log line is the mob's POV IN A MOMENT; the guide speaks in permanent truths.
//       Recycling the log into the guide put the wrong voice on the page no matter how good the
//       lines were. (h) pins that no results.js content reaches this surface except the golden —
//       which was always authored as a bestiary capstone.
//
// EVERY assertion DERIVES from MONSTER_IDS / MONSTER_BREAKPOINTS / MONSTER_RESULTS. The roster has
// grown 3 -> 9 and the breakpoint table is config, so a hand-typed "9 mobs" or "500 serves" is the
// exact defect the 2026-07-04 batch-2 lesson recorded. Exact totals for this pass live HERE.
{
  const { readFileSync: rf84 } = await import('node:fs');
  const { MONSTERS: M84, MONSTER_IDS: IDS84 } = await import('./src/data/monsters.js');
  const { MONSTER_RESULTS: MR84 } = await import('./src/data/results.js');
  const { MONSTER_BREAKPOINTS: BP84 } = await import('./src/data/milestones.js');
  const { dossierFor, goldenLineFor, DOSSIER_NOTES_PER_MOB } = await import('./src/data/dossier.js');
  const { dossierHtml } = await import('./src/ui/panels.js');
  const pnl84 = srcOf('./src/ui/panels.js');
  const css84 = srcOf('./style.css');
  const dsr84 = srcOf('./src/data/dossier.js');

  const at84 = (id, n) => dossierFor(id, n);
  const st84 = (id, n) => ({ stats: { monsterServes: { [id]: n } } });
  const LAST84 = BP84[BP84.length - 1];
  const gridIds84 = IDS84.filter((id) => !M84[id].special);
  const vipIds84 = IDS84.filter((id) => M84[id].special);
  const allNotes84 = IDS84.flatMap((id) => M84[id]?.lore?.notes ?? []);

  // --- (a) THE CONTRACT: four labelled notes per mob, one per pip below the golden's rung. The
  // Inspector included — he rides the Field Guide, so he gets an entry (2026-07-08). ---
  ok(DOSSIER_NOTES_PER_MOB === BP84.length - 1,
     `dossier: the notes-per-mob count derives from the breakpoint table — one note per rung below `
     + `the golden's (${DOSSIER_NOTES_PER_MOB} notes, ${BP84.length} rungs)`);
  const noteSets = IDS84.map((id) => M84[id]?.lore?.notes);
  ok(noteSets.every((ns) => Array.isArray(ns) && ns.length === DOSSIER_NOTES_PER_MOB),
     `dossier: every mob in the live roster carries exactly ${DOSSIER_NOTES_PER_MOB} lore.notes `
     + `(${noteSets.filter((ns) => ns?.length === DOSSIER_NOTES_PER_MOB).length}/${IDS84.length})`);
  ok(allNotes84.every((n) => typeof n?.label === 'string' && n.label.length > 0
                          && typeof n?.text === 'string' && n.text.length > 0),
     'dossier: every note is a { label, text } pair and neither half is empty');

  // --- (b) THE STORY LAW. The 80-char budget is the LOG's — a small scrolling widget — and it does
  // NOT apply to a page. Applying it here is what produced the rejected draft. So this pass pins a
  // FLOOR as well as a ceiling: a note short enough to be a tagline IS a tagline, and that is the
  // regression this section was written to catch. Measured spread at authoring: 167-193. ---
  {
    const lens = allNotes84.map((n) => n.text.length);
    ok(Math.min(...lens) >= 120,
       `dossier: no note is short enough to be a tagline (floor 120, shortest ${Math.min(...lens)}) `
       + '\u2014 a caption is not a paragraph, which is exactly how the first draft failed');
    ok(Math.max(...lens) <= 200,
       `dossier: no note has grown into an essay (ceiling 200, longest ${Math.max(...lens)})`);
    ok(allNotes84.every((n) => n.label.length <= 22),
       `dossier: every label stays a heading, not a sentence (longest ${Math.max(...allNotes84.map((n) => n.label.length))})`);
  }
  ok(allNotes84.every((n) => !/\byou\b/i.test(n.text.replace(/you'd/gi, ''))),
     'dossier: no note breaks the no-second-person hygiene law (the guide describes, never addresses)');
  ok(new Set(allNotes84.map((n) => n.text)).size === allNotes84.length,
     'dossier: every note is distinct — a duplicate means a copy-pasted row, not a character');
  const taglines84 = IDS84.map((id) => M84[id]?.lore?.tagline);
  ok(allNotes84.every((n) => !taglines84.includes(n.text)),
     'dossier: no note is a restatement of a tagline — the caption and the paragraph are different jobs');
  // The labels are AUTHORED PER MOB and carry half the joke (a straight-faced dossier heading over
  // absurd content). A roster-wide schema would flatten it, so: distinct within a mob, and the
  // roster must not converge on one shared set.
  ok(IDS84.every((id) => new Set((M84[id]?.lore?.notes ?? []).map((n) => n.label)).size === DOSSIER_NOTES_PER_MOB),
     'dossier: a mob\u2019s four labels are distinct from each other');
  {
    const distinctLabels = new Set(allNotes84.map((n) => n.label)).size;
    ok(distinctLabels > DOSSIER_NOTES_PER_MOB * 2,
       `dossier: the labels are tailored per mob, not a roster-wide schema — ${distinctLabels} distinct `
       + `across ${IDS84.length} mobs (a shared form would collapse toward ${DOSSIER_NOTES_PER_MOB})`);
  }

  // --- (c) THE LADDER: one note per rung, in order, and nothing at all below the first. ---
  ok(gridIds84.every((id) => BP84.slice(0, DOSSIER_NOTES_PER_MOB)
       .every((rung, i) => at84(id, rung).notes.length === i + 1)),
     `dossier: the notes reveal one per pip across the first ${DOSSIER_NOTES_PER_MOB} rungs (${BP84.slice(0, -1).join('/')})`);
  ok(gridIds84.every((id) => at84(id, BP84[0] - 1).notes.length === 0),
     `dossier: no note reveals below the first rung (${BP84[0]})`);
  ok(gridIds84.every((id) => at84(id, LAST84).notes.length === DOSSIER_NOTES_PER_MOB),
     'dossier: the last rung adds the golden, not a fifth note');
  // Order is content: the four escalate deliberately (ordinary -> stranger -> deeper -> the one that
  // recontextualises), so a shuffle breaks the writing without breaking a type, a symbol, or a
  // count. Asserted against the RENDERED HTML, not dossierFor's return: an earlier draft of this pin
  // checked the data layer's array order and a negative control walked straight past it by reversing
  // in the renderer. The order the player READS is the effect; the array is only the mechanism.
  ok(gridIds84.every((id) => {
    const html = dossierHtml(st84(id, LAST84), id);
    const positions = M84[id].lore.notes.map((n) => html.indexOf(`>${n.label}<`));
    return positions.every((p) => p > -1) && positions.every((p, i) => i === 0 || p > positions[i - 1]);
  }), 'dossier: the notes RENDER in registry order — they escalate, so the order IS the writing');

  // --- (d) THE MONOTONE REVEAL: content only ever arrives. A ladder that takes a note back is a
  // bug no player would report and everyone would feel. ---
  {
    const rungs = [1, ...BP84];
    const shrinks = gridIds84.filter((id) => rungs.some((r, i) =>
      i > 0 && at84(id, r).notes.length < at84(id, rungs[i - 1]).notes.length));
    ok(shrinks.length === 0,
       `dossier: the notes never un-reveal as serves climb (regressed: ${shrinks.join(', ') || 'none'})`);
  }

  // --- (e) THE GOLDEN IS THE CAPSTONE, held for the last rung. It is the ONE recycled line, and it
  // earns the place because it was already authored as a permanent truth rather than a moment. ---
  {
    const withGolden = gridIds84.filter((id) => goldenLineFor(id) !== null);
    ok(withGolden.length === gridIds84.length,
       `dossier: guard-the-guard — every grid mob has a golden to crown the entry (${withGolden.length}/${gridIds84.length})`);
    ok(withGolden.every((id) => at84(id, LAST84 - 1).golden === null),
       `dossier: the golden is withheld one serve below the last rung (${LAST84})`);
    ok(withGolden.every((id) => at84(id, LAST84).golden === goldenLineFor(id)),
       `dossier: the golden lands exactly at the last rung — pip ${BP84.length} IS the Legend`);
    ok(gridIds84.every((id) => !at84(id, LAST84).notes.some((n) => n.text === goldenLineFor(id))),
       'dossier: no note duplicates the mob\u2019s own golden — the capstone is spent once');
  }

  // --- (f) THE REGISTER GUARD — the pin that encodes the rejection. results.js is the mob's POV in
  // a MOMENT; the guide speaks in permanent truths. The first draft bucketed 211 log lines under the
  // notes and the page read wrong even where the lines were funny. NOTHING from results.js may reach
  // this surface except the golden. Asserted against the rendered HTML, not the source, so a future
  // "just a few of the good ones" re-import fails here rather than in Daniel's browser. ---
  {
    const logLines = (id) => Object.values(MR84[id] ?? {}).flat()
      .map((t) => (typeof t === 'string' ? t : t?.text ?? ''))
      .filter((t) => t && t !== goldenLineFor(id));
    ok(logLines('slime').length > 20,
       `dossier: guard-the-guard — the log pool really is large enough for this to be live ammunition `
       + `(${logLines('slime').length} non-golden lines for slime alone)`);
    const leaks = gridIds84.filter((id) => {
      const html = dossierHtml(st84(id, LAST84), id);
      return logLines(id).some((l) => html.includes(l));
    });
    ok(leaks.length === 0,
       `dossier: no battle-log line reaches a maxed entry except the golden — the guide is NEW `
       + `writing, not a highlights reel (leaked: ${leaks.join(', ') || 'none'})`);
    ok(!/MONSTER_RESULTS\[id\]\?\.\[|DOSSIER_TIERS_BY_PIP|DOSSIER_BUCKET_LABEL/.test(dsr84),
       'dossier: dossier.js carries no tier-bucketing machinery — the Greatest Hits are gone, and '
       + 'their absence is the design, not an oversight to be helpfully restored');
    ok(!/dossier-bucket|dossier-lines|dossier-beat/.test(pnl84) && !/dossier-bucket|dossier-lines|dossier-beat\b/.test(css84),
       'dossier: no bucket render or beat style survives in panels.js or style.css');
  }

  // --- (g) UNDISCOVERED: nothing at all. The silhouette exists to protect a reveal; dossier.js
  // returns only REVEALED content by construction, so this cannot be defeated by a renderer bug. ---
  {
    const d0 = at84('slime', 0);
    ok(d0.discovered === false && d0.notes.length === 0 && d0.golden === null,
       'dossier: an undiscovered mob\u2019s entry carries no notes and no golden');
    ok(dossierHtml(st84('slime', 0), 'slime') === '',
       'dossier: dossierHtml renders NOTHING for an undiscovered mob');
    ok(dossierFor('not_a_mob', 500) === null && dossierHtml(st84('not_a_mob', 500), 'not_a_mob') === '',
       'dossier: an unknown id degrades to nothing, never a crash');
    ok(at84('slime', -5).served === 0 && at84('slime', 1.9).served === 1,
       'dossier: a nonsense serve count is floored and clamped, never trusted');
  }

  // --- (h) THE VIP: no pips, no ladder, no golden. Binding since 2026-07-08 — and the arithmetic
  // agrees: he arrives at most once a CALENDAR DAY, so pip 3 would be 100 days and pip 5 a wall. ---
  {
    ok(vipIds84.length > 0, 'dossier: guard-the-guard — the roster has a VIP to check');
    for (const id of vipIds84) {
      const v1 = at84(id, 1);
      ok(v1.isVip === true && v1.notes.length === DOSSIER_NOTES_PER_MOB,
         `dossier: ${id} reveals all ${DOSSIER_NOTES_PER_MOB} notes on his FIRST visit — a trophy has no ladder to climb`);
      ok(v1.golden === null && goldenLineFor(id) === null,
         `dossier: ${id} has no golden — a once-a-day visitor was never given one (\u00a754), so his entry ends at his last note`);
      ok(v1.nextAt === null, `dossier: ${id} promises no further notes — there is no rung to promise`);
      ok(!dossierHtml(st84(id, 1), id).includes('beast-pip'),
         `dossier: ${id}\u2019s entry draws NO pips (VIPs are trophies, not ladders)`);
    }
  }

  // --- (i) THE WRITE AND THE READ. A registry field with no consumer is a dropped step wearing a
  // feature's clothes; a headless suite cannot draw a panel (the §0b/§78/§80/§82 precedent), so the
  // DOM contract is pinned in SOURCE — and, per §72(f), against a STRUCTURE, never a bare symbol. ---
  ok(/id="mob-view-dossier"/.test(pnl84) && /id="dossier-body"/.test(pnl84),
     'dossier: the third sub-view and its body exist in the panel template (the WRITE)');
  ok(/id="dossier-back"/.test(pnl84) && /dossier-back'\)\?\.addEventListener/.test(pnl84),
     'dossier: the back button exists AND is wired — the only way out of the view');
  ok(/dossierBody\.innerHTML = dossierHtml\(state, dossierId\)/.test(pnl84),
     'dossier: renderPanels writes dossierHtml into the body (the READ)');
  ok(/setMobView\('dossier', card\.dataset\.beast\)/.test(pnl84),
     'dossier: a Field Guide card click opens that mob\u2019s entry');
  ok(/classList\.contains\('undiscovered'\)/.test(pnl84),
     'dossier: the card click refuses an undiscovered mob (the silhouette\u2019s reveal is protected)');
  ok(/getElementById\('mob-view-guide'\)\?\.addEventListener/.test(pnl84),
     'dossier: the click listener is delegated on the VIEW, not the grid — the VIP section is a '
     + 'SIBLING of #guide-cards and is inserted after init, so a listener on the grid would miss the Inspector');
  ok(/getElementById\('mob-views'\)\?\.classList\.toggle\('hidden', view === 'dossier'\)/.test(pnl84),
     'dossier: the two-view toggle hides while inside a third view');
  ok(/class="dossier-note-label"/.test(pnl84) && /class="dossier-note-text"/.test(pnl84),
     'dossier: the label and the story are rendered as separate elements — the label is content '
     + 'carrying half the joke, not chrome');

  // --- (j) THE CASCADE-TIE LAW, third instance (.offer-row, .beast-cards, now .mob-views). The
  // toggle above was a SILENT NO-OP under the old bare utility (.mob-views set its own display and
  // was declared later — a 0-1-0 tie order resolved against the hide). §87 restructured the law:
  // the utility is !important, the scoped overrides and their source-order guards are retired. ---
  ok(css84.includes('.hidden{display:none !important;}'),
     'dossier: the hide utility out-cascades .mob-views\u2019/.mob-view\u2019s own display (§87\u2019s law; the '
     + 'scoped overrides and the source-order guard are retired — order no longer decides these toggles)');

  // --- (k) THE WRONG-PALETTE LAW (§81) on every ink this page adds. .beast-exp spent four days
  // invisible because a dark-panel colour was reused on a parchment card; asserted at birth. ---
  {
    const lin84 = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const rgb84 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const lum84 = (h) => { const [r, g, b] = rgb84(h); return 0.2126 * lin84(r / 255) + 0.7152 * lin84(g / 255) + 0.0722 * lin84(b / 255); };
    const ratio84 = (a, b) => { const [hi, lo] = [lum84(a), lum84(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
    const rootBody84 = /:root\s*\{([\s\S]*?)\}/.exec(css84)?.[1] ?? '';
    const varOf = (n) => new RegExp(`--${n}\\s*:\\s*(#[0-9a-fA-F]{6})`).exec(rootBody84)?.[1] ?? null;
    const parch84 = varOf('parchment');
    const ruleColor = (sel) => {
      const body = new RegExp(`^\\${sel}\\s*\\{([^}]*)\\}`, 'm').exec(css84)?.[1] ?? null;
      if (!body) return null;
      const c = /(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{6}|var\(--[a-z-]+\))/.exec(body)?.[1] ?? null;
      if (!c) return null;
      const v = /^var\(--([a-z-]+)\)$/.exec(c);
      return v ? varOf(v[1]) : c;
    };
    const onParchment = ['.dossier-note-label', '.dossier-note-text', '.dossier-next'];
    const parchColors = onParchment.map((s) => [s, ruleColor(s)]);
    ok(!!parch84 && parchColors.every(([, c]) => !!c),
       `dossier: guard-the-guard — :root declares a parchment and every parchment-ink rule resolves a `
       + `colour (${parchColors.map(([s, c]) => `${s}=${c ?? 'MISS'}`).join(' ')})`);
    for (const [sel, c] of parchColors) {
      const r = ratio84(c, parch84);
      ok(r >= 4.5, `dossier: ${sel} clears WCAG AA on the parchment page — ${r.toFixed(2)}:1 (\u00a781's law)`);
    }
    // ...and the ONE gold on the page, legal only because it brings a dark surface with it. The law
    // is "no dark-panel colour on a LIGHT card", not "no gold" — the plaque changes the card.
    {
      const legendBody = /^\.dossier-legend\s*\{([^}]*)\}/m.exec(css84)?.[1] ?? '';
      const bgVar = /background\s*:\s*var\(--([a-z-]+)\)/.exec(legendBody)?.[1] ?? null;
      const legendBg = bgVar ? varOf(bgVar) : null;
      const legendFg = ruleColor('.dossier-legend-line');
      ok(!!legendBg && !!legendFg,
         'dossier: guard-the-guard — the Legend plaque declares its own dark background and a gold ink');
      ok(ratio84(legendFg, legendBg) >= 4.5,
         `dossier: the Legend\u2019s gold clears AA on its OWN dark plaque — ${ratio84(legendFg, legendBg).toFixed(2)}:1 `
         + '(gold on parchment measures 1.12:1; the plaque brings the surface the colour was authored for)');
      ok(legendBg !== parch84,
         'dossier: the Legend plaque is NOT parchment — that is the entire reason its gold is legal');
    }
  }

  // --- (l) §80's law holds: the job card stays a job card. §82 pins that the tagline never drifts
  // onto it; the Dossier must not either. ---
  {
    const start84 = pnl84.indexOf("getElementById('beast-cards').innerHTML =");
    const end84 = pnl84.indexOf("\n  }).join('');", start84);
    const jobTpl84 = start84 < 0 || end84 < 0 ? null : pnl84.slice(start84, end84);
    ok(!!jobTpl84, 'dossier: guard-the-guard — the Expeditions job template was sliced');
    ok(!/dossier/i.test(jobTpl84),
       'dossier: the Expeditions job card carries no Dossier of any kind — \u00a780 keeps it a job card');
    ok(!/getElementById\('mob-view-expeditions'\)\?\.addEventListener/.test(pnl84),
       'dossier: no click-to-open on the Expeditions view — its cards are jobs, and its Send button '
       + 'would fight a card-level handler for the same click');
  }

  // --- (m) style.css changed; this section owns the current floor. ---
  {
    const ver84 = (s) => { const m = /style\.css\?v=(\d+)/.exec(s); return m ? Number(m[1]) : null; };
    const vi84 = ver84(srcOf('./index.html'));
    const vk84 = ver84(srcOf('./index.kongregate.html'));
    ok(vi84 !== null && vi84 === vk84, 'dossier: both entry shells carry the SAME style.css cache-bust');
    ok(vi84 >= 19, `dossier: the cache-bust advanced for this pass\u2019s style.css change (>= v19, found ${vi84})`);
  }
}

// ===== SECTION 85 — DOUG'S REPEATS (Daniel, 2026-07-15 — Option 2) =====
// Daniel: "since Doug is leaving more often and coming back (higher level) he repeats his lines very
// often, sometimes the same line." That sentence is TWO defects and this section pins both.
//
//   (1) "very often" — THE GATE WAS A DEAD CONSTANT. `Math.random() < 0.25` was tuned against
//       Doug's 24s base interval (24 / 0.25 = one line about every 96s — the call site's own comment
//       said "at a 24s cadence"). Doug leveling (2026-07-14) then took the interval to ~6.9s at cap
//       via scavengeSpeed WITHOUT retuning the gate: 6.3 -> 21.9 lines per 10 minutes, 3.5x the
//       intended rate. The premise the constant was measured against moved, and nothing noticed.
//   (2) "sometimes the same line" — THE PICKER WAS MEMORYLESS. `pick()` is uniform over a 6-line
//       pool, so P(exact back-to-back repeat) = 1-in-6 = 16.7%, CONSTANT at every level. Leveling
//       did not change those odds; it changed how often the dice get rolled, so the repeat went from
//       roughly every 10 minutes to every 3.
//
// WHY THIS SECTION DRIVES THE REAL LOOP. `updateWorkers` is exported as a test seam (the
// spawnCustomer/dismissCurrent precedent) so the anti-repeat is asserted END-TO-END, through the
// actual call site. Pinning that the call site MENTIONS pickNot would be the flag; pinning that Doug
// never says the same line twice is the result. That distinction cost a pin earlier today (§84's
// order assertion tested `.filter()`'s output — an order `.filter()` cannot break — and a negative
// control walked straight past it), so it is applied deliberately here.
{
  const { readFileSync: rf85 } = await import('node:fs');
  const { updateWorkers, dougLineChance, effectiveWorkerInterval } = await import('./src/game.js');
  const { createInitialState: fresh85 } = await import('./src/state.js');
  const { serializeSave } = await import('./src/save.js');
  const { pickNot } = await import('./src/utils.js');
  const { DOUG_RETURN_LINES: POOL } = await import('./src/data/results.js');
  const { WORKERS: W85 } = await import('./src/data/workers.js');
  // COMMENTS ARE TEXT TOO — §72(f)'s lesson, which bit again writing this section: a positive pin
  // green off a comment, and this section's own negative pin red off the comment retiring the dead
  // constant. The local stripper that lived here became §88's shared srcOf() — one law, one reader.
  const game85 = srcOf('./src/game.js');
  const utils85 = srcOf('./src/utils.js');

  const CAP = W85.scavenger?.levels?.maxLevel ?? 0;
  const stateAt = (level) => {
    const s = fresh85();
    s.workers.scavenger.owned = true; s.workers.scavenger.level = level; s.workers.scavenger.timer = 0;
    return s;
  };
  // Drive the real tick and collect the Doug lines in the order they were SPOKEN. Consecutive-Doug
  // is the right unit, not consecutive-log: Daniel's report had four unrelated lines between his two
  // identical ones, and it still read as a repeat.
  const speak = (level, seconds) => {
    const s = stateAt(level);
    const said = []; let prevTop = null;
    for (let i = 0; i < seconds; i++) {
      updateWorkers(s, 1);
      const top = s.log[0];
      if (top && top !== prevTop && POOL.includes(top.text)) said.push(top.text);
      prevTop = top;
    }
    return said;
  };

  // --- (a) THE EFFECT, end to end: Doug never says the same line twice in a row. DETERMINISTIC —
  // pickNot cannot return the exclusion, so the count is exactly 0, not "usually low". ---
  {
    const said = speak(CAP, 20000);
    ok(said.length > 50,
       `doug: guard-the-guard — the run actually produced lines to check (${said.length} in 20000s at level ${CAP}), `
       + 'so the repeat assertion below is not vacuously true');
    let backToBack = 0;
    for (let i = 1; i < said.length; i++) if (said[i] === said[i - 1]) backToBack++;
    ok(backToBack === 0,
       `doug: no back-to-back repeat across ${said.length} lines through the REAL call site `
       + `(found ${backToBack}; a memoryless pick from ${POOL.length} would give ~${Math.round(said.length / POOL.length)})`);
    ok(new Set(said).size === POOL.length,
       `doug: every line in the pool is still reachable (${new Set(said).size}/${POOL.length}) — an anti-repeat `
       + 'that strands a line trades one bug for a quieter one');
  }

  // --- (b) THE OTHER HALF, end to end: the LINE cadence no longer tracks Doug's speed. Stochastic,
  // so the band is wide on purpose — the defect it catches is 3.5x, and a tight band would flake. ---
  {
    const SECS = 20000;
    const atZero = speak(0, SECS).length, atCap = speak(CAP, SECS).length;
    ok(atZero > 50 && atCap > 50,
       `doug: guard-the-guard — both ends of the ladder produced lines (${atZero} at level 0, ${atCap} at level ${CAP})`);
    const ratio = atCap / atZero;
    ok(ratio > 0.6 && ratio < 1.4,
       `doug: the line rate is LEVEL-INDEPENDENT — level ${CAP} spoke ${atCap} times vs level 0's ${atZero} `
       + `(ratio ${ratio.toFixed(2)}, band 0.6-1.4). Before this pass the ratio was ~3.5: the gate was a `
       + 'constant tuned to a cadence Doug outgrew.');
  }

  // --- (c) THE TUNING IS PRESERVED, NOT OVERRIDDEN. This is the pin that makes the derivation
  // honest: at level 0 the derived gate must reproduce the historical literal 0.25 EXACTLY. It fails
  // if DOUG_LINE_EVERY_S drifts or if Doug's baseInterval changes without a decision. ---
  ok(dougLineChance(stateAt(0)) === 0.25,
     `doug: at level 0 the derived gate reproduces the old literal exactly — 0.25 (got `
     + `${dougLineChance(stateAt(0))}). The fix RESTORES the existing tuning rather than replacing it.`);
  ok(dougLineChance(stateAt(CAP)) < dougLineChance(stateAt(0)),
     'doug: the gate falls as Doug speeds up — it reads the LIVE interval, not baseInterval');
  {
    // The identity interval/chance == the target cadence is algebra UNLESS the clamp engages. So what
    // this actually asserts is that the clamp never fires on the live ladder — i.e. the cadence
    // really is being held, rather than silently pinned at certainty by a too-long interval.
    const clamped = [];
    for (let lv = 0; lv <= CAP; lv++) {
      const c = dougLineChance(stateAt(lv));
      if (c >= 1) clamped.push(lv);
      ok(c > 0 && c <= 1, `doug: the gate is a probability at level ${lv} (${c.toFixed(4)})`);
    }
    ok(clamped.length === 0,
       `doug: the safety clamp never engages anywhere on the live ladder (levels 0-${CAP}), so the `
       + `cadence is genuinely held — a clamped level would be a level whose rate silently ran free`);
  }

  // --- (d) pickNot's own contract. Deterministic: exhaustive over the pool. ---
  {
    for (const ex of POOL) {
      let hit = 0;
      for (let i = 0; i < 300; i++) if (pickNot(POOL, ex) === ex) hit++;
      ok(hit === 0, `doug: pickNot never returns its exclusion (300 draws excluding "${ex.slice(0, 28)}...")`);
    }
    const reach = new Set();
    for (let i = 0; i < 600; i++) reach.add(pickNot(POOL, POOL[0]));
    ok(reach.size === POOL.length - 1 && !reach.has(POOL[0]),
       `doug: pickNot reaches every OTHER entry and only those (${reach.size}/${POOL.length - 1})`);
    ok(pickNot([], 'x') === undefined, 'doug: pickNot on an empty pool degrades to undefined, never a throw');
    ok(pickNot(['only'], 'only') === 'only',
       'doug: a one-entry pool returns its entry even when excluded — an unavoidable repeat is not a bug');
    ok(pickNot(['a', 'a'], 'a') === 'a', 'doug: an all-excluded pool falls back rather than returning undefined');
    ok(pickNot(POOL, null) !== undefined && POOL.includes(pickNot(POOL, null)),
       'doug: a null exclusion (the first line of a session) draws normally');
  }

  // --- (e) THE MEMORY IS TRANSIENT BY CONSTRUCTION, and that is the design, not an oversight.
  // serializeSave picks fields explicitly, so lastLine never reaches localStorage — no save-schema
  // change, and no module-level container (which is the cross-run mutable state the sim's
  // stdout-divergence hunt already suspects). ---
  {
    const s = stateAt(CAP);
    // 4000 ticks, not 400 — this guard FLAKED red on a green tree (caught 2026-07-16 during \u00a787's
    // negative controls, which run the suite ~20 times). Doug's gate is probabilistic BY DESIGN
    // (\u00a785 drives the real loop, no stubbed random): chance \u2248 interval/96 \u2248 7% per completed
    // run, so 400 ticks \u2248 58 draws and P(no line) \u2248 0.93^58 \u2248 1.5% \u2014 one lying-red commit in
    // seventy. 4000 ticks \u2248 580 draws: P \u2248 4e-19. Runtime cost is milliseconds.
    for (let i = 0; i < 4000; i++) updateWorkers(s, 1);
    ok(typeof s.workers.scavenger.lastLine === 'string',
       'doug: guard-the-guard — the run really did set lastLine, so the persistence check below has a subject');
    const saved = serializeSave(s);
    ok(saved.workers.scavenger.lastLine === undefined,
       'doug: lastLine is NOT persisted — serializeSave writes only { owned, level }, so the memory is '
       + 'transient by construction and old saves need no migration');
    ok(saved.workers.scavenger.owned === true && typeof saved.workers.scavenger.level === 'number',
       'doug: ...while the fields that SHOULD persist still do');
  }
  // The sim doctrine's guard: the helper must stay a function of its arguments. A "last seen"
  // container at module scope in utils.js is exactly the shape suspected of cross-run stdout
  // divergence, and it is the obvious way someone would "improve" pickNot later.
  ok(!/^(let|var)\s|^const\s+\w+\s*=\s*new\s+(Map|Set|WeakMap)/m.test(utils85),
     'doug: utils.js declares no module-level mutable state — pickNot takes its memory as an argument, '
     + 'and a memo container here would be the sim-divergence shape');

  // --- (f) THE WRITE AND THE READ, and the dead constant's grave. ---
  ok(/const line = pickNot\(DOUG_RETURN_LINES, w\.lastLine \?\? null\)/.test(game85),
     'doug: the call site draws with pickNot and reads the memory (the READ), guarded for a fresh session');
  ok(/w\.lastLine = line;/.test(game85), 'doug: ...and writes it back (the WRITE)');
  ok(/Math\.random\(\) < dougLineChance\(state, id\)/.test(game85),
     'doug: the gate at the call site is the derived chance');
  ok(!/Math\.random\(\) < 0\.25/.test(game85),
     'doug: the literal 0.25 gate is gone from game.js — the constant that outlived its premise');
  ok(/const DOUG_LINE_EVERY_S = 96;/.test(game85),
     'doug: the cadence is a NAMED constant — the rate is a decision, not a side effect of Doug\u2019s speed');
}

// ===== SECTION 86 — THE CONTRAST CLASS (Daniel, 2026-07-15 — Option 2 of the round) =====
// §81 fixed ONE instance of the wrong-palette class (.beast-exp) and swept the UI for the rest.
// This section owns the five survivors that sweep found, plus a sixth this pass measured.
//
// THE CLASS: a colour authored for the DARK panel palette, reused for text on a PARCHMENT card.
// The cards are the only light surfaces in a dark-purple UI, so a dark-panel colour looks right in
// the file and dies on the card.
//
// WHY THIS IS NOT A SWEEP-AND-REPLACE (Daniel's call, and it is the whole design of the section):
// the obvious fix is "everything to the house ink #6b4a1e". That FLATTENS a legible system — the
// upgrade cost spends diamonds, the perk cost spends crowns, and the colour says so at a glance.
// So the two costs are NOT flattened: each is darkened along its OWN hue ray until it clears AA.
// (d) is the pin that makes this Option 2 rather than Option 1 — if a later pass quietly flattens
// both to one ink, the ratios all still pass and only (d) fires. It should.
//
// WHAT THE ARTIFACT SAID THAT THE PLAN DID NOT (measured, and it moved the design twice):
//   1. The "meaning" worry is 2-of-5, not 5-of-5. .item-sold b renders state.stats.itemSales[id] —
//      a COUNT, not money; .beast-next.vip renders the literal word "VIP"; .item-sold renders
//      "\u00b7 next 50". Three of the five carried no currency at all, so nothing flattens by
//      giving them the house ink. Only .upg-cost and .perk-cost are costs — and BOTH already name
//      their currency with a glyph (\u25c6 / \u265b) in the same string, so colour is the second
//      copy of a fact the text states. That is why (d)'s floor is generous rather than tight.
//   2. Deriving the inks against --parchment ALONE was wrong, and (c) exists because of it. A
//      locked card is #e6dcc6, DARKER than parchment, and .perk-cost renders "Reach Trusted" on it.
//      Parchment-derived inks measured 4.37/4.34 there — passing the common surface and missing the
//      real one. Both inks are now derived against the LOCKED card, so they clear AA on either.
//
// EVERY RATIO IS COMPUTED, NEVER A HEX PIN — §81's law. A pin on `#795c1c` would be satisfied by
// the comment above the rule (§72(f), and §79/§85 the same week). For the same reason this section
// reads COMMENT-STRIPPED css: the comments here deliberately quote every retired value, so a raw
// text scan would find `#ffd9a8` and `#cfa8ff` alive and well in the prose that retired them.
{
  const css86 = srcOf('./style.css');   // §88's shared stripped read (this section's local stripper was its prototype)

  // THE PARSER MODELS THE CASCADE, because a pin that reads CSS differently from the browser is
  // measuring a page that does not exist. At equal specificity the LAST declaration wins, and a
  // selector may be declared more than once: .item-card is declared twice (the base card, then the
  // Shelf 2.0 compaction), and reading only the FIRST rule got the right background by luck — the
  // compaction happens not to set one. The day it does, a first-rule reader certifies a surface
  // nothing renders. So: collect every rule for the selector, take the last declaration found.
  const esc86 = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rulesOf86 = (sel) =>
    [...css86.matchAll(new RegExp('^' + esc86(sel) + '\\s*\\{([^}]*)\\}', 'gm'))].map((m) => m[1]);
  const hasRule86 = (sel) => rulesOf86(sel).length > 0;
  const declOf86 = (sel, prop) => {
    let found = null;
    for (const body of rulesOf86(sel)) {
      const m = new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)').exec(body);
      if (m) found = m[1].trim();
    }
    return found;
  };

  // WCAG 2.x contrast — the same math §81 uses and the same the browser probe used.
  const lin86 = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum86 = ([r, g, b]) => 0.2126 * lin86(r / 255) + 0.7152 * lin86(g / 255) + 0.0722 * lin86(b / 255);
  const contrast86 = (a, b) => {
    const [hi, lo] = [lum86(a), lum86(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const rgb86 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  // CIELAB + CIE76 distance. Only (d) needs it: "are these still two different colours to a player".
  const lab86 = (rgb) => {
    const [r, g, b] = rgb.map((v) => lin86(v / 255));
    let x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
    let y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    const f86 = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    [x, y, z] = [f86(x), f86(y), f86(z)];
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const dE86 = (a, b) => {
    const [A, B] = [lab86(rgb86(a)), lab86(rgb86(b))];
    return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
  };

  // --- (a) GUARD-THE-GUARDS: every surface below is DERIVED from the live CSS, never hand-typed.
  // If a card stops being parchment, these ratios are measuring the wrong thing and must fail here
  // rather than quietly certify a colour against a surface it no longer lands on. ---
  const rootBody86 = /:root\s*\{([\s\S]*?)\}/.exec(css86)?.[1] ?? '';
  const parch86 = /--parchment\s*:\s*(#[0-9a-fA-F]{6})/.exec(rootBody86)?.[1] ?? null;
  ok(!!parch86, 'contrast: guard-the-guard — :root declares --parchment (every ratio below resolves through it)');

  for (const card of ['.upgrade-card', '.beast-card', '.item-card']) {
    const bg = declOf86(card, 'background');
    ok(!!bg && bg.includes('var(--parchment)'),
       `contrast: guard-the-guard — ${card} still renders on var(--parchment)`);
  }
  const lockedBg86 = declOf86('.upgrade-card.locked', 'background');
  ok(!!lockedBg86 && /^#[0-9a-fA-F]{6}$/.test(lockedBg86),
     'contrast: guard-the-guard — .upgrade-card.locked declares its own plain-hex background (the DARKER card surface)');
  ok(contrast86(rgb86(lockedBg86), rgb86(parch86)) > 1,
     'contrast: guard-the-guard — the locked card is a genuinely different surface from parchment, so (c) is a real second test');

  // --- (b) THE FIX, asserted as the EFFECT a player sees: a computed ratio on the surface the ink
  // actually lands on. Five instances from §81's sweep; the sixth is (e). AA body text = 4.5:1.
  //
  // OPACITY IS PART OF THE EFFECT, so it is part of the sum. A ratio pin on the declared hex alone
  // is the mechanism, not the result — and this is the exact section where that would bite:
  // .beast-next sets opacity:.6, so .beast-next.vip's #8c5620 renders at 2.42:1 unless the .vip
  // rule overrides it. A colour-only pin stays GREEN through that, certifying a tag the player
  // still cannot read. HALF of the original 1.01:1 was this opacity, not the hex. ---
  const over86 = (fg, bg, a) => fg.map((v, i) => v * a + bg[i] * (1 - a));
  const opacityOf86 = (sel) => {
    const v = declOf86(sel, 'opacity');
    return v === null ? null : Number(v);
  };
  const INSTANCES86 = [
    { sel: '.upg-cost',       was: 1.97, what: 'the upgrade cost \u25c6 250' },
    { sel: '.perk-cost',      was: 1.50, what: 'the perk cost \u265b 200' },
    { sel: '.item-sold',      was: 2.62, what: 'the sold line "\u00b7 next 50" (it wore the dark-panel disabled-grey)' },
    { sel: '.item-sold b',    was: 1.12, what: 'the sold COUNT (a count, not money \u2014 weight carries the pop)' },
    { sel: '.beast-next.vip', was: 1.01, what: 'the VIP tag (the worst ink in the game)', inherits: '.beast-next' },
  ];
  for (const inst of INSTANCES86) {
    const col = declOf86(inst.sel, 'color');
    ok(!!col && /^#[0-9a-fA-F]{6}$/.test(col),
       `contrast: guard-the-guard — ${inst.sel} declares a plain hex colour (a var() would defeat the ratio below)`);
    // Own opacity wins; otherwise the one it inherits; otherwise fully opaque.
    const alpha = opacityOf86(inst.sel) ?? (inst.inherits ? opacityOf86(inst.inherits) : null) ?? 1;
    const r = contrast86(over86(rgb86(col), rgb86(parch86), alpha), rgb86(parch86));
    ok(r >= 4.5,
       `contrast: ${inst.sel} clears WCAG AA AS RENDERED on the parchment card — ${r.toFixed(2)}:1 at `
       + `opacity ${alpha} (needs 4.5; it shipped at ${inst.was.toFixed(2)} \u2014 ${inst.what})`);
  }

  // (b2) The VIP tag's opacity override is load-bearing, so it is named rather than left implicit:
  // it beats .beast-next's .6 on SPECIFICITY (0-2-0 vs 0-1-0), not on order, so unlike (e2) it is
  // safe from the .hidden class of tie. Pinned because deleting it looks like tidying.
  ok(opacityOf86('.beast-next.vip') === 1,
     'contrast: .beast-next.vip declares opacity:1 — .beast-next sets .6, which was half of why the '
     + 'tag measured 1.01:1; the colour fix alone does not reach AA');
  ok(opacityOf86('.beast-next') !== null && opacityOf86('.beast-next') < 1,
     'contrast: guard-the-guard — bare .beast-next is still the dimmed one (if that ever changes, the '
     + 'override above is dead weight and (b) is testing nothing)');

  // --- (c) THE WORST-SURFACE LAW. The two meaning inks land on BOTH card surfaces, and the locked
  // card is darker. This is the pin the first derivation of this pass would have failed: inks tuned
  // against parchment measured 4.37/4.34 here. Derive against the worst surface, not the common one. ---
  for (const sel of ['.upg-cost', '.perk-cost']) {
    const col = declOf86(sel, 'color');
    const r = contrast86(rgb86(col), rgb86(lockedBg86));
    ok(r >= 4.5,
       `contrast: ${sel} clears AA on the LOCKED card too (${lockedBg86}) — ${r.toFixed(2)}:1. A cost ink `
       + `is derived against the DARKER of the surfaces it lands on, never against parchment alone`);
  }

  // (c2) THE OTHER LOCKED SURFACE. A locked ITEM card dims differently — opacity:.75 AND
  // filter:saturate(.55) over the dark --panel-bg — and .item-sold is NOT hidden there (unlike the
  // price and stock, which are). The house ink survives it at 4.57:1 where the old dark-panel grey
  // read 2.30:1, so the locked state came free with the fix. Pinned rather than left as a comment
  // because 0.07 above AA is thin: a nudge to the ink, to --panel-bg, or to either dial breaks it
  // silently, and this is the only place that composite is checked.
  {
    const panelBg86 = /--panel-bg\s*:\s*(#[0-9a-fA-F]{6})/.exec(rootBody86)?.[1] ?? null;
    ok(!!panelBg86, 'contrast: guard-the-guard — :root declares --panel-bg (the locked item card composites over it)');
    const lockA86 = Number(declOf86('.item-card.locked', 'opacity'));
    const satM86 = /saturate\(\s*([\d.]+)\s*\)/.exec(declOf86('.item-card.locked', 'filter') ?? '')?.[1];
    ok(Number.isFinite(lockA86) && satM86 !== undefined,
       'contrast: guard-the-guard — .item-card.locked still dims via opacity + saturate() (both dials read live)');
    // CSS filter: saturate(s) — the spec's linear matrix. Applied to the element, then composited.
    const sat86 = (rgb, s) => {
      const [r, g, b] = rgb, L = 0.213, M = 0.715, N = 0.072;
      return [
        (L + (1 - L) * s) * r + (M - M * s) * g + (N - N * s) * b,
        (L - L * s) * r + (M + (1 - M) * s) * g + (N - N * s) * b,
        (L - L * s) * r + (M - M * s) * g + (N + (1 - N) * s) * b,
      ];
    };
    const s86 = Number(satM86);
    const cardSeen = over86(sat86(rgb86(parch86), s86), rgb86(panelBg86), lockA86);
    for (const sel of ['.item-sold', '.item-sold b']) {
      const inkSeen = over86(sat86(rgb86(declOf86(sel, 'color')), s86), rgb86(panelBg86), lockA86);
      const r = contrast86(inkSeen, cardSeen);
      ok(r >= 4.5,
         `contrast: ${sel} clears AA on a LOCKED item card too — ${r.toFixed(2)}:1 through opacity `
         + `${lockA86} + saturate(${s86}) over --panel-bg (the old grey read 2.30 here)`);
    }
  }

  // --- (d) THE MEANING LAW — the reason this pass is not a sweep-and-replace. The upgrade cost
  // spends diamonds and the perk cost spends crowns; the glyph is the primary carrier and the
  // colour is the second copy, but the second copy is the one that works at a glance. Flattening
  // both to one ink passes every ratio above and fails ONLY here. ---
  const goldInk86 = declOf86('.upg-cost', 'color');
  const repInk86 = declOf86('.perk-cost', 'color');
  const spread86 = dE86(goldInk86, repInk86);
  ok(spread86 >= 25,
     `contrast: the gold cost and the rep cost are still two different colours to a player — CIE76 `
     + `\u0394E ${spread86.toFixed(1)} (floor 25; flattening both to the house ink gives 0). This is `
     + `the pin that says Daniel picked Option 2, not Option 1`);

  // --- (e) THE SIXTH INSTANCE — PARITY, not a new judgment. Both card kinds gate on a tier; only
  // the upgrade card was ever readable while gated (its cost renders '' and its BUTTON carries
  // "Reach <Tier>" at opacity 1). A perk's button says only "Locked", so .perk-cost is the SOLE
  // statement of the requirement — and .upg-meta's .45 took it to 1.18:1.
  // The fix MUST live on .upg-meta: opacity composites the whole subtree, so a child cannot undo
  // its parent's. An opacity:1 on .perk-cost itself is a silent no-op. The button escapes only
  // because it is a SIBLING of .upg-meta, never a child. ---
  ok(hasRule86('.perk-card.locked .upg-meta') && declOf86('.perk-card.locked .upg-meta', 'opacity') === '1',
     'contrast: a locked PERK card un-dims .upg-meta — the column holding the only statement of its '
     + 'tier requirement ("Reach Trusted", which sat at 1.18:1)');
  ok(!hasRule86('.perk-card.locked .perk-cost'),
     'contrast: the un-dim is NOT attempted on .perk-cost — a child cannot undo its parent\u2019s '
     + 'composited opacity, so that rule would be a silent no-op that looks like a fix');

  // (e2) ORDER IS THE TIE-BREAKER, so order is pinned. Both selectors are 0-3-0; the perk rule wins
  // only by being declared later. This is the .hidden cascade's exact shape (handoff NEXT item 5),
  // and nothing headless catches a specificity tie — so it gets a guard rather than a hope.
  {
    const iBase = css86.search(/^\.upgrade-card\.locked \.upg-info,\s*$/m);
    const iFix = css86.search(/^\.perk-card\.locked \.upg-meta\s*\{/m);
    ok(iBase !== -1 && iFix !== -1 && iFix > iBase,
       'contrast: .perk-card.locked .upg-meta is declared AFTER .upgrade-card.locked .upg-meta — they '
       + 'tie at 0-3-0 and the later one wins, so declaration order is load-bearing here');
  }

  // --- (f) THE DEAD DUPLICATE. .item-sold was declared twice (an older #b6abc9 rule, fully
  // overridden by the restyle below it at equal specificity, contributing nothing). Removed with
  // this pass; pinned so it cannot drift back and give the next reader two candidate answers. ---
  ok((css86.match(/^\.item-sold\s*\{/gm) ?? []).length === 1,
     'contrast: .item-sold is declared exactly ONCE — the dead duplicate is gone and stays gone');

  // --- (g) style.css changed, so the bust advances. This section owns the current floor (the
  // exact-totals doctrine: the newest batch holds the exact, older sections soften to rules). ---
  {
    const ver86 = (s) => { const m = /style\.css\?v=(\d+)/.exec(s); return m ? Number(m[1]) : null; };
    const vi86 = ver86(srcOf('./index.html'));
    const vk86 = ver86(srcOf('./index.kongregate.html'));
    ok(vi86 !== null && vi86 === vk86, 'contrast: both entry shells carry the SAME style.css cache-bust');
    ok(vi86 >= 20, `contrast: the cache-bust advanced for this pass\u2019s style.css change (>= v20, found ${vi86})`);
  }
}

// ===== SECTION 87 — THE .hidden LAW (Daniel, 2026-07-16 — Option 3 of the round) =====
// The cascade-tie class, killed at the ROOT instead of instance-by-instance. The old bare
// `.hidden{display:none}` sat at line 244 of an 800+ line file, so every component below it that
// set its own display tied at 0-1-0 and WON — a .hidden toggle on it was a silent no-op. The file
// had accumulated THIRTEEN scoped X.hidden overrides treating a structural property as a run of
// coincidences, and the class still bit a FOURTH time: #forge-section (class "worker-cards hidden")
// shipped VISIBLE pre-hire, because .worker-cards' display:flex won the tie and renderForge's
// toggle did nothing. "Doug's Forge — found relics restored here go on display, forever" was on
// screen from save-slot zero: a spoiler wearing a bug's clothes. Nobody filed it because every
// progressed save hires Doug.
//
// THE MEASUREMENT THAT DECIDED THE OPTION (jsdom, calibrated against the known-true .mob-views
// no-op before being trusted; all 25 toggle consumers swept, 2026-07-16):
//   - Zero rules in the file legitimately beat .hidden — the handoff's stated risk ("a component
//     that relies on winning that tie would break silently") is EMPTY, measured not assumed.
//   - "Move .hidden to the end" (Option 2) retires only 12 of 13 overrides: .item-card
//     .item-reserve is 0-2-0 and beats a bare utility at ANY source order. The codebase already
//     writes that shape, so the order fix leaves the trap it was built to remove.
//   - !important retires all 13, needs no move, and is checkable STATICALLY — no DOM, no jsdom in
//     the suite, one text pin. A utility whose one job is "hidden means hidden" is the textbook
//     legitimate !important; the smell case is component styles fighting each other, which this
//     is not.
// THE TRADE, eyes open: a future component that wants to override .hidden (exit animation) cannot,
// short of its own scoped !important. If that day comes, the component should stop using .hidden
// rather than fight it — this section's failure message says so.
{
  const css87 = srcOf('./style.css');
  const pnl87 = srcOf('./src/ui/panels.js');   // the template pin matches a STRING literal — stripping cannot touch it

  // --- (a) THE LAW ITSELF, verbatim. If someone "tidies" the !important away, every component
  // that sets its own display and is declared later silently stops hiding — that is the exact
  // pre-§87 world, and it shipped four real bugs. ---
  ok(css87.includes('.hidden{display:none !important;}'),
     'law: .hidden declares display:none !important — hidden means hidden at every specificity. '
     + '(If a component needs to override this, it should stop using .hidden, not fight it.)');

  // --- (b) THE LAW IS ALONE. Exactly one rule in the file may set display on a .hidden selector.
  // A second one is either a resurrected scoped override (dead weight that will rot into a wrong
  // answer, the §86(f) duplicate lesson) or a component fighting the utility (the trade above,
  // taken without a decision). Both deserve a red. ---
  {
    const hiddenDisplayRules = [...css87.matchAll(/^[^\n{]*\.hidden[^\n{]*\{[^}]*display[^}]*\}/gm)];
    ok(hiddenDisplayRules.length === 1,
       `law: exactly ONE .hidden display rule exists in style.css (found ${hiddenDisplayRules.length} — `
       + 'the 13 scoped overrides retired with \u00a787 and must not drift back)');
  }

  // --- (c) THE FOURTH INSTANCE, fixed by the law: #forge-section hides pre-hire. Static halves of
  // an effect the container cannot render: the template ships the section born-hidden, and
  // renderForge drives the toggle off Doug's owned flag. With (a), born-hidden + a working toggle
  // IS the effect. NOT VERIFIED HEADLESS: the rendered panel — the browser test plan carries it. ---
  ok(/id="forge-section" class="worker-cards hidden"/.test(pnl87),
     'forge: #forge-section is born hidden in the template (pre-\u00a787 the class was decoration — '
     + '.worker-cards won the 0-1-0 tie and the Forge shipped VISIBLE on a fresh save)');
  ok(/section\.classList\.toggle\('hidden', !show\)/.test(pnl87) && /scavenger\?\.owned === true/.test(pnl87),
     'forge: renderForge toggles .hidden off Doug\u2019s owned flag — under \u00a787\u2019s law that toggle '
     + 'now actually does something');

  // --- (d) style.css changed, so the bust advances. Newest section holds the exact floor. ---
  {
    const ver87 = (s) => { const m = /style\.css\?v=(\d+)/.exec(s); return m ? Number(m[1]) : null; };
    const vi87 = ver87(srcOf('./index.html'));
    const vk87 = ver87(srcOf('./index.kongregate.html'));
    ok(vi87 !== null && vi87 === vk87, 'law: both entry shells carry the SAME style.css cache-bust');
    ok(vi87 >= 21, `law: the cache-bust advanced for this pass\u2019s style.css change (>= v21, found ${vi87})`);
  }
}

// ===== SECTION 88 — THE SOURCE LAW'S GUARD (Daniel, 2026-07-16 — Option 3 of the round) =====
// The migration (65 reads onto srcOf) fixed today's instances; this section stops tomorrow's. A
// new section written next month with a raw utf8 read + a text match would reintroduce the class
// silently — so the suite scans ITSELF, through its own stripper, and counts. §87(b)'s law-is-alone
// shape, applied one level up.
//
// THE ALLOW-LIST, and why each entry exists (a hatch without a why is just a hole):
//   rawSrc \u00d7 2 — the Kong mirror subsequence: its contract is FULL file text, comments included.
//   rawSrc \u00d7 1 — \u00a779(e): pins whose SUBJECT is prose (the layout-budget comment was re-dated,
//                its falsified claims removed). A doc pin must read docs; the migration itself
//                proved it — (e3) went red on stripped text, which is how it earned the hatch.
// Everything else reads srcOf. The migration also surfaced that \u00a779(e) had been GREEN off prose
// all along — the class's fourth live instance, found by the fix, not the sweep.
{
  const suite88 = srcOf('./test_suite.mjs');

  // Sentinel first: srcOf just comment-stripped a file whose job is to contain tricky patterns
  // (regex literals with //-adjacency corrupt their own line's tail in the stripped view). Before
  // counting anything in this text, prove the strip did not eat a structural block: the suite's
  // final tally template must survive, exactly once. The probe is a REGEX whose escaped source
  // (backslash-dollar) cannot match itself in the stripped text — a plain string probe here would
  // find its own literal and pass forever (caught in review before this section ever ran: the
  // first draft probed 'SECTION 88', whose only stripped survivor WAS the probe).
  {
    const tally = [...suite88.matchAll(/passed, \$\{fail\} failed/g)].length;
    ok(tally === 1,
       `source law: sentinel — the stripped suite still ends with its tally template, exactly once `
       + `(found ${tally}; 0 means the stripper ate a block, 2+ means something echoes the tail)`);
  }

  // --- (a) THE LAW IS ALONE: raw utf8 reads exist ONLY inside the two helpers. fsReadRaw is the
  // helpers' private alias; any other utf8 read is a new section bypassing the law.
  // NOTE the assert MESSAGES below deliberately avoid the exact tokens being counted — a message
  // string survives stripping, so a message containing the counted call shape would count itself
  // (the \u00a772(f) lesson one level down: even the guard's own prose is text too). ---
  {
    const rawReads = [...suite88.matchAll(/fsReadRaw\(/g)].length;
    ok(rawReads === 2,
       `source law: the private raw-read alias is called exactly twice — inside the two helpers (found ${rawReads}; `
       + 'a third call is a section bypassing the source law)');
    const directReads = [...suite88.matchAll(/readFileSync\([^)]*'utf8'/g)].length;
    ok(directReads === 0,
       `source law: zero direct utf8 file reads outside the helper block (found ${directReads} — `
       + 'new source pins read the stripped helper, or the raw hatch with an allow-list entry and a why)');
  }

  // --- (b) THE HATCH IS COUNTED: the raw hatch has exactly the three call sites the allow-list
  // names. A fourth is either a new prose pin (add it HERE with its why) or a leak (fix it). ---
  {
    const hatchCalls = [...suite88.matchAll(/rawSrc\(/g)].length;
    ok(hatchCalls === 3,
       `source law: the raw hatch has exactly 3 call sites — the mirror pair + \u00a779(e)'s prose pins `
       + `(found ${hatchCalls}; a new one joins the \u00a788 allow-list with a why, or it is a leak)`);
  }

  // --- (c) THE STRIPPER'S OWN CONTRACT, bitten into: srcOf must actually remove comments — every
  // migrated pin leans on exactly this. Probed on live reads, not re-derived. ---
  {
    ok(!srcOf('./src/game.js').includes('/*'),
       'source law: a JS read through the helper carries no block comment (a pin matching one would be matching prose)');
    ok(!/^\s*\/\//m.test(srcOf('./src/utils.js')),
       'source law: a JS read through the helper carries no line comment');
  }
}

// ===== SECTION 89 — COMMISSION REPEAT (Daniel's Option A, 2026-07-16) =====
// Fulfill -> the courier travels (repeatCooldownSec, real seconds, PERSISTED) -> the next client's
// order seats the SAME day with a salted seed. The cooldown gates EVERY placement, rollover
// included (the 23:59 seam), and survives reload + absence (offline credits it at boot — the
// expedition convention, source-pinned here because a headless suite cannot boot main.js).
// Economy note: this multiplies the 2\u00d7 premium faucet by active play; the commission-blind sim
// bot MEASURES that (certification is this pass's follow-up, per the deliver-before-certify law).
{
  const { update: up89, fulfillCommission: fulfill89, refreshCommission: refresh89, eligibleCommissionItemIds: elig89 } = await import('./src/game.js');
  const { commissionForDay: forDay89 } = await import('./src/data/commissions.js');
  const { hashDayKey: hash89 } = await import('./src/data/marketevents.js');
  const CD89 = CONFIG.commission?.repeatCooldownSec ?? 0;

  ok(CD89 > 0 && CD89 <= 86400,
     `repeat: the courier dial exists and fits inside a day (repeatCooldownSec=${CD89})`);

  // --- (a) THE SEED LAW: seq 0 is byte-identical to legacy (every existing day's first order is
  // unchanged), and each salt is a genuinely different rng stream. ---
  {
    const ids = ITEM_ORDER.filter((id) => (ITEMS[id].acquisition ?? 'gold') === 'trade');
    const legacy = forDay89('sim-day-9', ids);
    const seq0 = forDay89('sim-day-9', ids, 0);
    ok(JSON.stringify(legacy) === JSON.stringify(seq0),
       'repeat: the default arg IS seq 0 (two-arg callers and three-arg callers agree)');
    // The pin above compares the function to ITSELF, so it cannot see the branch collapsing into
    // the salted form (both calls drift together — its own negative control caught it silent).
    // The drift-visible half is the SOURCE: the seed expression must still contain the UN-salted
    // legacy template as the seq-0 branch, or every existing day's first order silently changes.
    ok(/seq > 0 \? `commission:\$\{dayKey\}#\$\{seq\}` : `commission:\$\{dayKey\}`/.test(srcOf('./src/data/commissions.js')),
       'repeat: the seq-0 seed is the LEGACY string, verbatim, as the ternary\u2019s else-branch — '
       + '"tidying" it into `#0` re-rolls every pre-repeat day\u2019s first order');
    ok(hash89('commission:sim-day-9#1') !== hash89('commission:sim-day-9')
       && hash89('commission:sim-day-9#1') !== hash89('commission:sim-day-9#2'),
       'repeat: each salt hashes to its own rng stream (the # cannot occur in a real day key)');
  }

  // --- (b) THE LOOP, END TO END, through the REAL machinery: seat -> fulfill -> courier ->
  // tick the cooldown away -> the SAME DAY seats the next order -> its seed is the salted one. ---
  {
    const s = shopState();
    s.tradeDayKeyOverride = 'sim-day-9';
    s.licenses.iron_buckler = true;               // one licensed trade item = eligible (the armed() convention)
    refresh89(s);
    ok(!!s.commission && s.commissionSeq === 1,
       'repeat: day 9 seats its first order (seq advances to 1 on placement)');
    const first = { ...s.commission };
    s.items[first.itemId].stock = first.count;              // stock it, then deliver
    ok(fulfill89(s), 'repeat: the first order fulfills');
    ok(s.commissionCooldownSec === CD89,
       `repeat: fulfillment starts the courier at exactly the dial (${CD89}s)`);
    refresh89(s);
    ok(s.commission === null, 'repeat: the courier gates the same-day seat while traveling');
    // Tick the REAL update loop just past the cooldown (coarse dt — the decrement is per-tick).
    for (let i = 0; i < Math.ceil(CD89 / 60) + 1; i++) up89(s, 60);
    ok(s.commissionCooldownSec === 0, 'repeat: update() ticks the courier home (dt-based, offline-creditable)');
    refresh89(s);
    ok(!!s.commission && s.commissionSeq === 2,
       'repeat: the SAME day seats the second order once the courier is home');
    // The expectation derives from the SAME eligible list the game seeds from (unlocked items
    // only) — deriving from the full trade roster was this pin's first red: right seed, wrong pool.
    const expected = forDay89('sim-day-9', elig89(s), 1);
    ok(JSON.stringify({ ...s.commission, placedIndex: 0 }) === JSON.stringify({ ...expected, placedIndex: 0 }),
       'repeat: the second order IS the seq-1 seed\u2019s order (deterministic, not a re-roll of the first '
       + '\u2014 same-day orders MAY coincide by rng; determinism is the pin, not novelty)');
  }

  // --- (c) THE SEQ RESET: a new day starts over at the legacy seed. ---
  {
    const s = shopState();
    s.tradeDayKeyOverride = 'sim-day-9';
    s.licenses.iron_buckler = true;               // one licensed trade item = eligible (the armed() convention)
    refresh89(s);
    s.items[s.commission.itemId].stock = s.commission.count;
    fulfill89(s);
    s.commissionCooldownSec = 0;
    s.tradeDayKeyOverride = 'sim-day-10';
    refresh89(s);
    ok(!!s.commission && s.commissionSeq === 1
       && JSON.stringify({ ...s.commission, placedIndex: 0 })
          === JSON.stringify({ ...forDay89('sim-day-10', elig89(s), 0), placedIndex: 0 }),
       'repeat: the new day resets the sequence — its first order is the legacy seq-0 seed');
  }

  // --- (d) PERSISTENCE: the courier survives the reload (anti-refarm), clamped to the dial;
  // corrupt saves land on safe defaults. ---
  {
    const s = shopState();
    s.commissionCooldownSec = 1234; s.commissionSeq = 2;
    const m = mergeSave(createInitialState(), serializeSave(s));
    ok(m.commissionCooldownSec === 1234 && m.commissionSeq === 2,
       'repeat: cooldown + seq round-trip the save (a reload cannot refresh the courier)');
    ok(mergeSave(createInitialState(), { commissionCooldownSec: 1e9 }).commissionCooldownSec === CD89
       && mergeSave(createInitialState(), { commissionCooldownSec: -5 }).commissionCooldownSec === 0
       && mergeSave(createInitialState(), { commissionSeq: 'lol' }).commissionSeq === 0,
       'repeat: merge clamps the courier to 0..dial and defaults corrupt seq (pause forever, mint never)');
  }

  // --- (e) THE SURFACES, source-pinned (headless cannot render them; the browser plan carries the
  // visual half). srcOf per §88 — these are CODE pins. ---
  {
    const mkt89 = srcOf('./src/ui/market.js');
    ok(/commissionCooldownSec/.test(mkt89) && /courier/.test(mkt89),
       'repeat: the overlay renders a courier countdown row (discoverability — a vanished row taught '
       + '"orders are daily")');
    ok(/classList\.toggle\('comm-target', state\.commission\?\.itemId === offer\.itemId\)/.test(mkt89),
       'repeat: the target-row toggle compares against offer.itemId — the loop\u2019s real variable (the '
       + 'first version pinned a bare itemId VERBATIM: a source pin certifies presence, not correctness, '
       + 'and it matched a ReferenceError that froze the overlay)');
    const css89 = srcOf('./style.css');
    ok(/\.market-offer-list \.offer-row\.comm-target\{[^}]*var\(--good\)/.test(css89),
       'repeat: .comm-target wears the commission family\u2019s green (var(--good), never a raw hex)');
    const iFeat = css89.indexOf('.offer-row.featured{');
    const iComm = css89.indexOf('.offer-row.comm-target{');
    ok(iFeat !== -1 && iComm !== -1 && iComm > iFeat,
       'repeat: .comm-target is declared AFTER .featured — 0-3-0 tie, so the ORDER\u2019s green beats the '
       + 'deal\u2019s gold when one row is both (source order is load-bearing; the \u00a786(e2) precedent)');
    const main89 = srcOf('./src/main.js');
    ok(/commissionCooldownSec = Math\.max\(0, state\.commissionCooldownSec - offline\.awaySec\)/.test(main89),
       'repeat: boot credits the courier for the full absence (the expedition convention). NOT VERIFIED '
       + 'HEADLESS: the live boot path — the browser test plan carries it');
  }

  // --- (f) style.css changed; the bust advances (newest section holds the floor). ---
  {
    const ver89 = (s) => { const m = /style\.css\?v=(\d+)/.exec(s); return m ? Number(m[1]) : null; };
    const vi = ver89(srcOf('./index.html'));
    ok(vi !== null && vi === ver89(srcOf('./index.kongregate.html')) && vi >= 22,
       `repeat: both shells carry the same cache-bust, >= v22 (found ${vi})`);
  }
}

// ===== SECTION 90 — THE BOARD RESTRUCTURE (Daniel's round 1, Option 2 — 2026-07-16) =====
// The old board mixed three registers with no hierarchy (a trade deal, a world event, a forecast,
// all chalked alike, framed by calendar words). Now: the DEMAND headlines (nameFont + demand
// chalk — the one line with no other persistent ambient home since the HUD chip retired at
// 18be9de, and the one that changes the room the sign hangs in), the DEAL rides in gold (the ad
// that pulls players into the overlay), the FORECAST is off the plank (the overlay footer carries
// it verbatim — the redundancy is PINNED below, because the retirement leans on it), and the
// chalk QUIP is home in the freed row (Market Day's comedy home, event+day-keyed).
{
  const { boardLines: bl90, tradeDayKey: tdk90 } = await import('./src/data/trademarket.js');
  const { boardEventLine: bel90, boardQuipFor: bqf90, eventIdForDay: eid90, MARKET_EVENTS: MEV90,
    MARKET_EVENT_ORDER: MEO90, CATEGORY_LABELS: CL90 } = await import('./src/data/marketevents.js');

  // --- (a) THE HEADLINE'S LAWS, carried over and tightened: category-driven, board-short BY
  // CONSTRUCTION (the longest label bounds it — the container font caveat means measured pixel
  // widths are not trustworthy here, so the cap is structural), digit-free (the standing
  // advertises/informs doctrine — the +50% lives on the overlay banner). ---
  {
    const longest = Math.max(...Object.values(CL90).map((l) => `${l} selling hot`.length));
    ok(longest <= 26,
       `board: the headline is bounded by the longest category label (${longest} <= 26 chars — `
       + 'structurally immune to the iconic rows\u2019 overflow class)');
    ok(MEO90.every((id) => !/\d/.test(bel90(MEV90[id]))),
       'board: the headline carries no number (the board advertises; the overlay informs — the '
       + 'law survives the promotion)');
  }

  // --- (b) THE SHAPE: headline = the day's event line; deal = the featured item + the live dial;
  // quip = the event's deterministic morning line; NO tomorrow field; 2-part contentKey. ---
  {
    const s = { tradeDayKeyOverride: 'sim-day-7' };
    const L = bl90(s);
    const evId = eid90(tdk90(s));
    ok(L.headline === bel90(MEV90[evId]), 'board: headline IS the day-derived event line');
    ok(L.quip === bqf90(MEV90[evId], tdk90(s)),
       'board: the quip is home — boardQuipFor\u2019s deterministic morning line rides boardLines');
    ok(!('tomorrow' in L) && !('today' in L) && !('demand' in L),
       'board: the old three-register fields are GONE from the shape (a consumer still reading '
       + 'them gets undefined, not stale text)');
    ok(L.contentKey.split('|').length === 2,
       'board: the contentKey is offer|event — the forecast no longer triggers chalk rewrites');
  }

  // --- (c) THE REDUNDANCY THE RETIREMENT LEANS ON: the overlay footer still renders Tomorrow.
  // If a later pass removes that, the forecast has NO surface and this design's premise is gone —
  // this pin is the tripwire. srcOf per §88. ---
  {
    const mkt90 = srcOf('./src/ui/market.js');
    ok(/mkt-forecast/.test(mkt90) && /Tomorrow:/.test(mkt90) && /forecastDayKey/.test(mkt90),
       'board: the overlay footer still carries "Tomorrow: ..." (the forecast\u2019s ONLY home now — '
       + 'removing it re-opens the planning gap the board line used to cover)');
  }

  // --- (d) THE SCENE'S WIRING: headline + deal rows, the quip's wrapped homecoming, and the
  // forecast row genuinely deleted (not just empty). ---
  {
    const scene90 = srcOf('./src/render/scene.js');
    ok(scene90.includes('L.headline') && scene90.includes('L.deal'),
       'board: scene draws the headline and deal rows from boardLines');
    ok(scene90.includes('wrapBoardText(ctx, L.quip'),
       'board: the quip renders through wrapBoardText (<=2 lines — the pre-F4 pattern, and the '
       + 'overflow guard for the authored pool)');
    ok(!scene90.includes('fcSegs') && !scene90.includes('L.tomorrow'),
       'board: the forecast row is deleted from the scene, not left as a dead branch');
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
