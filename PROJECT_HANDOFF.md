# Mob Mart — PROJECT_HANDOFF.md

*Living source of truth. Read this in full (together with the code) at the start of every
session before doing any work. Update it as decisions change. Kept self-contained so a fresh
Claude or ChatGPT can parse it cold.*

**Status (current):** **M1–M6 MVP COMPLETE; idle roadmap Passes 1–4b SHIPPED**, plus spawn
director, serve celebration, shelf v3, Bestiary (4a + v2 showcase), grounding, crisp canvas —
and the ITEMS PHASE (2026-07-04, all browser-confirmed + committed): **(a) Pass 4b — Froggo the
grumpy frog** (fourth customer, Option-2 identity: combatMod 0, budget [16,30], tier-2-leaning
wants; comedy lever = professional dissatisfaction; art fully IN with footPad 15 MEASURED /
spriteScale 1.1; the `_walk_happy` strip is authored as a grumpy stomp — the naming mismatch IS
the joke, don't fix it). **(b) Battle-report timing (Option 2, render-synced):** the result line
lands when the celebrant ENTERS the door — `state.pendingReports` (transient, never saved) +
`deliverBattleReport`, fired by scene.js's door-entry callback with a fallback timer in update()
(`CONFIG.log.reportFallbackSec` 3.0); economy stays at serve; milestone lines stay instant.
**(c) Items scaffold:** A2 category-affinity wants (`categoryWeights` + optional `itemBias`,
two-stage picker — personality share holds as the catalog grows; `wantWeights` fully retired) and
B2 everything-tier RATCHET (`stats.everythingTierEarned`, written on live crossings, merge-seeded
from the PINNED `LEGACY_EVERYTHING_BASIS` so new free items can never regress an earned tier).
**(d) Item-aware comedy:** templates are string | { text, cats } — category tags scope
weapon-shaped jokes; tagging rule: tag only NONSENSE mismatches, never good absurdity (bible §
"Item-aware tags"). **(e) Content batch 1:** roster 6 → **15 items** — free four (Tattered Shirt /
Bandages / Wooden Shield / Rusty Key, all priced <= the min budget roll 10) + the Trusted/Beloved
license rung (Leather Bracer / Murk Tonic / Pickaxe @ 150-200, Quiver / Zip Tonic @ 300); ALL nine
64×64 icons IN. Shelf panel scrolls 2-row categories (`overflow-y: auto`, provisional — glow-clip
tradeoff noted in style.css). Suite: **288 assertions, green from repo root**; new doctrine: exact-
math tests PIN the trio shelf (`pinTrioShelf` fixture), rule tests derive from the LIVE registry.
**(f) Batch 2 chain tops:** Iron Buckler (Beloved 300, top of Wooden Shield) + Iron Gauntlet
(Renowned 500, top of Leather Bracer) — roster **17 items**, all icons IN; chain INVARIANT
suite-pinned (§30: top strictly beats base on eff + price). **(g) Shelf wiggle** (Option 2 of 3):
items rest still; every intervalMs ONE displayed good does a hop-and-settle — dials in
`WALL_SHELF.wiggle`, Daniel tuned durMs 800 / hopPx 4. **(h) Line-unlock ladder + GOLDEN lines**
(Options 1+3 combined): templates carry `minServes` (batches AT the loyalty breakpoints; Bestiary
pips double as new-material markers; registry-scanned unlock announcements) and each monster has
exactly ONE `golden: true` line at 100 serves that renders GOLD in the log; logLine returns
`{ text, golden }` and takes `serves`. Ladder shipped: 2-3 lines/monster @25 + one golden @100
(Froggo's five-star review is the crown). Suite **309**. **(i) Economy observation session**
(headless probe on the real modules, 5x40min): timeline HEALTHY (Trusted min 2, first license
min 5, Legendary min 23, long tail past 40); batch 1 cut early income ~27%/serve (dilution) but
the fast Trusted rung compensates — Daniel's verdict: early pace FEELS GOOD, no change; waves
~11.6% (fine); **Knight Helm 30 -> 26** (Daniel's pick, opens Slimey/Batty at Legendary — he
applies the one-value edit himself; NO suite pin on the price, verified).
**NEXT: the UX ROADMAP (Daniel's fresh-eyes reset, 2026-07-04)** — see §12's agreed order; ends
with the Rat. **Option-3 art polish: SCRUBBED** (see §9 — the 128px-frame + MEASURED-footPad
convention is PERMANENT, do not resurrect).
**Workflow note: NO DevLog for Mob Mart** — Daniel opted out (2026-07-03). Skip the DevLog draft
step at feature completion for this project.
**Last updated:** 2026-07-04 — items phase closed (batch 2, wiggle, line-unlock/golden, economy session); UX roadmap agreed.

---

## 1. Overview & premise

**Mob Mart** is a cozy idle shop-sim for the browser, designed **Kongregate-first**.

**Premise / wrapper:** You're a **mimic merchant** who's given up eating adventurers for the
safer life of retail. You run a little dungeon supply shop and sell gear to the weak monster
mobs — slimes, bats, skeletons, and friends — who are about to go get flattened by heroes
off-screen. A mob buys a club, a helmet, or a health flask, shuffles out the glowing
"To Battle" door, and combat resolves **off-screen** as a stream of funny result messages.
You earn gold and reputation, restock, buy shop upgrades, and hire **more mimic merchants**
(Bob is your first) to automate the shop so it keeps earning while you're away.

**Tone:** cozy, funny, slightly pathetic, charming. The monsters are cute starter mobs trying
their best, not scary enemies. The comedy — above all the **battle-results log** — is the
point.

**Strategic fit:** idle/incremental with a strong thematic wrapper. The Kongregate opportunity
report identifies this as the best small-team pattern (deep evergreen loop + a memorable fantasy
skin, the *Crush Crush* lesson). The wrapper is the moat, not the mechanics. **Not** an MMO,
**no** PvP, **no** live-ops backend.

---

## 2. Key decisions (with rationale)

- **Stack:** plain HTML / CSS / JavaScript, **HTML5 Canvas** + **ES modules**. No framework,
  no bundler, no build step. Served over http locally (VS Code **Live Server**), never `file://`.
- **UI architecture — Hybrid (Option C):** a single **canvas** renders the animated shop
  diorama; **DOM/HTML/CSS** renders the text/number/list-heavy panels (top bar, Current Customer,
  Workers, Upgrades, Battle Results, bottom nav). *Why:* the game's identity is the animated
  diorama (canvas's strength) but the moment-to-moment play and tuning is panels of text and
  numbers (DOM's strength), and idle games live on UI clarity.
- **Fixed internal stage 1280×720** inside a **scale-to-fit** wrapper that scales the canvas and
  the DOM overlay *together*, so the two layers can't drift.
- **View / perspective — PixelLab "low top-down" (~20°), front-facing, single facing.** Author the
  whole scene (characters, props, backdrop) at the same low top-down.
- **Kongregate is the PRIMARY (and possibly only) publish target.** itch.io is undecided (see §13).
  The Kongregate API is wrapped in one module (`src/kongregate.js`) that no-ops when the API isn't
  present, so local/itch builds stay dependency-free.
- **Save:** `localStorage`, namespaced + versioned key **`mobmart.save.v1`**, every field
  default-filled on load, load wrapped in try/catch → fresh save on parse failure.
- **Folder layout uses `src/` + root `style.css` + `assets/`** (matches the Kongregate packaging
  script's expected paths).
- **Internal slug `mobmart`** for the save namespace and asset/folder naming, decoupled from the
  display name "Mob Mart".

---

## 3. Core loop & state flow

**Screen state machine:** `Boot/Load → (minimal Title) → Shop`. The bottom-nav items
(Shop / Workers / Upgrades / Bestiary) are **tabs/panels inside the Shop state**. Overlays:
`OfflineEarnings` modal on return, `Settings`.

**Update loop:** a fixed-timestep accumulator driven by `requestAnimationFrame` with delta time
— deliberately **not** `setInterval`-per-generator. One master `update(dt)` advances the spawn
timer, patience countdowns, worker auto-serve timers, and animation state; then `render()` draws
the canvas and syncs only the DOM that changed. **Offline is the same math** applied once over the
elapsed real-time delta on load, capped.

**Transaction flow (the loop):**

```
spawn timer fires -> pick monster type (weighted) -> roll wanted item + budget + patience
      -> enqueue -> advance to counter (Current Customer)
      -> [player clicks SERVE  OR  a hired serve-worker auto-serves on its interval]
            -> in stock?  AND  budget >= item price?
               |-- YES -> decrement stock, add gold, mark served, monster walks to portal
               |          -> resolve combat -> tier ; append funny log line; +perSale rep
               |          -> monster exits; next customer advances
               '-- NO  -> lost sale (out of stock / can't afford)
                          -> patience keeps ticking; hits 0 -> monster leaves unhappy (minor rep ding)
      -> spend gold: restock items | buy upgrades | hire a mimic worker
      -> repeat
on quit   -> store lastSeenTimestamp + state
on return -> elapsed = now - lastSeen (capped) -> estimate sales -> award gold/rep -> modal
```

---

## 4. Data model

Everything content-facing is a **data-driven registry**, not a subclass, so a new
monster/item/upgrade/worker auto-flows through spawns, menus, and icons with no extra wiring. Asset
filenames match the `id` (lowercase). Every optional field is read with a fallback (`?? default`).

**Monster registry** (`src/data/monsters.js`): `id` · `displayName` · `spriteId` · `budgetRange`
[min,max] · `patience` · `categoryWeights` (A2 — category affinity map; replaced `wantWeights`
2026-07-04) · `itemBias` (optional per-item multiplier within a category) · `combatMod` ·
`baseRep` (optional) · `flying` (optional — keeps the idle hover bob) · `footPad` (optional,
MEASURED) · `spriteScale` (optional) · `anim` (shared 4-frame idle contract).

**Customer instance** (runtime): `monsterId` · `wantedItemId` · `budget` · `patienceRemaining` ·
`state`. Held in `state.queue`, a capped FIFO array; `queue[0]` is the front the Serve / Send Away
buttons — and the auto-serve worker — act on.

**Item registry** (`src/data/items.js`): `id` · `displayName` · `iconId` · `category` · `basePrice` ·
`restockCost` · `stock` (runtime) · `maxStock` · `combatEffect` · `monsterCompatibility` (optional).

**Upgrade registry** (`src/data/upgrades.js`): `id` · `displayName` · `description` · `baseCost` +
`costGrowth` · `maxLevel` · `requiredTier` · level in `state.upgrades[id]` · `effect` — a typed,
per-level effect: `{type:'maxStock',perLevel:1}`, `{type:'serveSpeed',perLevel:0.3}`,
`{type:'repMult',perLevel:0.5}`. Systems query `sumEffect(state,type)`. Consumers: `effectiveMaxStock`,
`effectiveServeCooldown = base/(1+serveSpeed)`, `effectiveRepPerSale = round(perSale·(1+repMult))`,
and now `effectiveWorkerInterval = baseInterval/(1+serveSpeed)`. `isUpgradeUnlocked` gates on
`requiredTier`.

**Worker registry** (`src/data/workers.js`) — **IMPLEMENTED (M4)**; first entry is "Bob":
`id` (`mimic_merchant`) · `displayName` ("Bob") · `spriteId` · `role` (**`serve`** for Bob;
**`restock`** reserved for a later worker — the auto-serve loop skips non-serve roles) · `baseInterval`
(seconds per auto-serve attempt, before serveSpeed) · `hireCost`. Per-worker tunables live in the
registry next to the data (same convention as items `basePrice` / upgrades `baseCost`). Level /
`upgradeCost` are NOT present yet — worker leveling is a later pass. Runtime state is
`state.workers[id] = { owned, timer }`: `owned` persists, `timer` (seconds to next auto-serve attempt)
is transient. Accessors: `isWorkerOwned`, `workerHireCost` (workers.js); `canHireWorker`, `hireWorker`,
`effectiveWorkerInterval`, `updateWorkers` (game.js).

**Auto-serve behavior (M4):** each owned serve-worker ticks its `timer` down in `update(dt)`; on
expiry it attempts **one** sale through the *exact* manual path (`serveCurrent`), so payout, rep,
log line, and the **shared serve cooldown** all match a manual serve. A success re-arms the timer to a
full `effectiveWorkerInterval`; a blocked attempt (no customer / cooling down / out of stock / can't
afford) leaves the timer ready (0) to retry next frame — the worker fires as soon as conditions allow,
without ever re-running the sale. The **serve cooldown is the anti-spam / pacing guard**; the interval
is the steady cadence. Because the interval divides by the same `serveSpeed` sum, **Faster Counter
speeds automation too** (compounding — see §5 for the switch). A successful auto-serve sets the
transient `state.workerServed` flag; `main.js` reads it to fire Bob's existing serve one-shot
(`playBobServe`). The manual click still fires that animation directly in `onServe`, so the two paths
don't double-trigger.

**Broke auto-wave (M4 follow-up):** with a serve-worker hired, a FRONT customer whose block reason is
`cant-afford` is auto-waved via the rep-neutral `dismissCurrent` (+ its dismiss log line) after
`CONFIG.queue.brokeGraceSec` (2s), so broke customers don't stall the line and cascade patience
timeouts (−rep) onto the affordable customers behind them. Gated on `anyServeWorkerOwned` — manual-only
play is unchanged. Keys off `serveBlockReason`, so it fires on exactly the "Can't afford it" state:
**out-of-stock is deliberately NOT auto-waved** (restock is the intended fix), and cooldowns pause it.
Customers carry a transient `brokeWait` accumulator (never persisted).

**Line picker (post-M4 polish):** `logLine` in `src/messages.js` remembers the last template dealt per
`monsterId|tier` pool and re-draws once on a match, so the log never shows the same line twice in a row
within a pool. Module-level, ephemeral presentation memory — resets on reload, never saved.

**Combat resolver** (`src/combat.js`): `score = itemEffect + monster.combatMod − encounterDifficulty
+ rng(−spread..+spread)` → tier enum. `resolveCombat` returns `{tier,score}`; flavour text is chosen
by `src/messages.js` (`logLine`), pooling generic + per-monster lines with graceful fallback. Gold and
reputation come from the **sale**; the tier only picks the flavour line.

**Save schema** (`src/save.js`, `mobmart.save.v1`): persists `{version, gold, reputation,
items:{id:{stock}}, upgrades:{id:level}, workers:{id:{owned}}, lastSeen}`. Queue, spawn timer, serve
cooldown, **worker auto-serve timers**, transient flags (`uiDirty`, `workerServed`), and log are
**ephemeral**. Every field default-filled + guarded on load (gold/rep floored at 0, **stock clamped to
the EFFECTIVE cap — base `maxStock` + restored Extra-Shelf effect; upgrades are merged before items so
the cap is known** (audit fix — the old base-cap clamp ate above-base stock on every reload),
upgrade levels clamped, worker `owned` coerced to a strict boolean, unknown ids ignored); a **pre-M4
save with no `workers` key loads with every worker unowned**. On resume, an owned worker's `timer`
starts at a full `baseInterval` so he doesn't fire the instant the shop opens. **SAVE_VERSION stays 1**
— `workers` is an additive field handled by default-fill, exactly like `upgrades` in M3 (no bump).
`lastSeen` drives M5. Future, same pattern: worker `level` and a reserved `scrap` field (§7).

---

## 5. Content & suggested starting values

All numbers below are **suggested starting values** and live as named constants in `src/config.js`
(global levers) or the matching data registry (per-entry numbers) — balancing is a one-value change.

**Starter customers (3):** `slime` (Slimey, combatMod −2, budget 10–20) · `bat` (Batty, −1, 12–22) ·
`skeleton` (Skele, +1, 12–24). Roster (not MVP): `goblin` (Gobbo), `rat`.

**Starter items (3):** `club` (weapon, 12/6, stock 3/5, +6) · `metal_helmet` (armor, 18/9, 2/5, +5) ·
`hp_flask` (consumable, 15/8, 4/5, +4).

**First worker (M4, live):** `mimic_merchant` — display "Bob", `role: 'serve'`, **`baseInterval` 6s**,
**`hireCost` 50 gold**. Both tunables live in `src/data/workers.js`. Hire model is **Option B — hire
with gold** (no rep gate; upgrades already carry rep gating). Effective interval =
`baseInterval / (1 + serveSpeed)`, so Faster Counter shortens it (6s → ~4.6s at L1 → 2.4s at L5).
**serveSpeed compounding switch:** currently Faster Counter shortens *both* the counter cooldown and
Bob's interval. To make it affect only one, change what `effectiveWorkerInterval` /
`effectiveServeCooldown` divide by — they're the two consumers of the `serveSpeed` sum. **Greet gate (retention pass — RESOLVES the old "pounce" feel note):** `CONFIG.workers.greetSec`
= 1.2 — a FRONT customer must be visible at the counter this long before a hired worker may serve
them (customers carry a transient `frontWait`, accrued on the settled queue[0] each tick). At max
Faster Counter, serves had become invisible teleports to the battle log; now every mob is SEEN.
Manual serving is deliberately NOT gated — clicking is looking, and active play stays a strict bonus.
**Auto-wave tunable:** `CONFIG.queue.brokeGraceSec` = 2 — seconds an unaffordable FRONT customer
lingers before a hired worker waves them off (rep-neutral). Lower toward 0 for a snappier clear.

**Shipped upgrades:** `extra_shelf` (+1 maxStock), `faster_counter` (serveSpeed 0.3), `better_signage`
(repMult 0.5), `backroom_storage` (**offlineReserve +1 shelf-refill/level** — 250g, growth 1.8, max
L3, Beloved-gated). Backroom v2 rationale: the planned '+capHours' effect was PROVEN INERT by the
suite — offline sales = min(time/interval, stock) and Bob empties any shelf in ~3 min, so STOCK
always binds; hours were placebo. The reserve sells AFTER live stock at basePrice − restockCost
(always profitable: club +6 / helm +9 / flask +7 net), scales with `effectiveMaxStock` (Extra Shelf
compounds), and returns `reserveUsed` (live-shelf `consumed` untouched). The 'offlineCap' consumer
plumbing remains in offline.js (sums 0) for a future restock-worker era. Future: `hire_goblin` →
"hire mimic worker" (unlock/discount a second worker).

**Combat tuning (M1 start):** `encounterDifficulty` 10, `rng spread` ±6; tiers ≥8 excellent / 2..7
success / −1..1 partial / −6..−2 failure / ≤−7 funnyFailure. Tier drives the log line only, never rep.

**Reputation model (Option A — service):** sale grants `perSale` (+2); a timeout costs `leavePenalty`
(−1); Send Away and the battle outcome are rep-neutral. Floors at 0.

**Reputation tiers:** Neutral 0 · Friendly 20 · Trusted 50 · Beloved 100. Rep is a tier-unlock gate
(M3). Later: high rep triggers special "visits" (no schema change).

**Economy start:** gold ~40, reputation 0.

**Battle-log voice:** full spec + shipped batch in `COMEDY_BIBLE.md` (reference) and the live copy in
`src/data/results.js`. Cozy, dry, PG; lines ~50–70 chars, hard cap ~80.

---

## 6. Milestone plan

Each milestone is a **single-purpose, individually tested, individually committed** pass.

- **M1 — "The loop breathes." DONE.** One customer at a time, manual serve, funny battle result, gold
  in; shell + diorama placeholders + DOM panels + Send Away + restock + config.
- **M2 — Persistence + full queue + reputation. DONE.** `localStorage` (versioned/guarded), capped
  FIFO queue + per-mob patience, reputation HUD (service-based). Three passes; committed.
- **M3 — Upgrades + spend economy. DONE.** Extra Shelf / Faster Counter / Better Signage, data-driven,
  rep-tier gated. Three passes; committed.
- **M4 — First mimic worker (auto-serve). DONE.** Bob auto-serves
  the front customer on a hire-to-activate interval, reusing `serveCurrent` (payout / rep / log /
  cooldown unchanged) and the shared serve cooldown (so Faster Counter speeds automation too).
  **Model B — hire with gold** (`hireCost` 50; no rep gate). New `src/data/workers.js` (Bob =
  `mimic_merchant`, role `serve`, `baseInterval` 6s). Workers tab activated; single Bob card
  (Hire → Active). No worker leveling, no restock automation, no second worker. **Includes the broke
  auto-wave follow-up:** hired worker → unaffordable front customers rep-neutrally waved after 2s.
- **M5 — Offline earnings. committed.** `src/offline.js`:
  `computeOffline(state, now)` (pure) → elapsed since `lastSeen`, clamped ≥ 0 (clock-skew guard) and
  capped at `CONFIG.offline.capHours` (2h) → sales = min(floor(cappedSec / effectiveWorkerInterval)
  × efficiency, total shelf stock), consumed round-robin at real basePrices; rep = sales ×
  effectiveRepPerSale. **Stock-consuming is the exploit guard** (no minting gold off a token shelf);
  deterministic (no RNG), so reload-spam recomputes identically. Worker-only (no worker → 0 → silent
  boot); no offline timeouts or rep losses (player-forgiving). Banked once at boot and saved
  IMMEDIATELY (fresh `lastSeen` → no double-collect); modal only when sales > 0 AND away ≥
  `minAwaySec` (60s). Upgrades compose offline: Faster Counter → more sales, Extra Shelf → more
  sellable stock, Better Signage → more rep.
- **M6 — Kongregate no-op bridge. committed.** `src/kongregate.js`:
  `initKongregate()` (called unconditionally from main.js) no-ops unless `window.kongregateAPI`
  exists — i.e. unless the page is `index.kongregate.html`, a copy of index.html plus ONE script tag
  (`https://cdn1.kongregate.com/javascripts/kongregate_api.js`, verified against live Kongregate
  docs). On Kongregate: `loadAPI` → `getAPI` → submit the `loaded` stat. `submitStat(name, value)`
  + `isKongregate()` exported for future stats. Every path try/caught — a broken/absent API can
  never crash the game. **Kongregate-side setup at submission time:** create a statistic named
  exactly `loaded` in the game's edit page (Statistics section), or submissions are ignored; upload
  with `index.kongregate.html` as the entry page. **Sync rule:** any edit to index.html must be
  mirrored in index.kongregate.html (they are identical apart from the script tag).

---

## 7. Scope guardrails — explicitly OUT of the MVP

- **Scrap (third resource)** — defer; reserve a data slot.
- **Punishing fail economy** — no rent/debt/hard-fail; a bad visit costs a sale + minor rep.
- **"Today's Goal" daily-quest hook** — later.
- **Bestiary panel** — nav stub through the MVP; **SHIPPED post-MVP as intended** (Pass 4a + v2, 2026-07-03) — the guardrail held.
- **Worker leveling** ("Lv 2, +25%") — hire first, level later. (M4 hires; no leveling.)
- **Second / restock worker** — the `restock` role is reserved in the registry and the auto-serve loop
  skips non-serve roles, but no restock worker exists yet. A restocker also needs a visual-home
  decision (DOM-only avatar vs a canvas backroom/shelf prop vs standing beside Bob).
- **Special "visits"** — later; no schema change when added.
- **Prestige / reset** — loop must be fun for one run first.
- **Free furniture placement, multiple rooms, large monster roster, complex crafting, real-time
  combat, PvP, multiplayer, external accounts** — all out.

---

## 8. Risks & scope traps (watch-list)

1. **Scrap creeping into MVP** → defer; reserve a data slot.
2. **Punishing fail economy (Recettear trap)** → no hard-fail; always recoverable.
3. **Auto-resolution with no feedback (Shop Titans trap)** → the funny log IS the payoff.
4. **Canvas-UI overreach** → hybrid; panels stay in DOM.
5. **`setInterval`-per-generator timing** → single delta-time accumulator (M4 worker timers ride this
   same `update(dt)` loop — no `setInterval`).
6. **Save/offline exploit + corruption** → cap offline; clamp deltas; version + default-fill; try/catch
   → fresh save. Strict-privacy browsers may block iframe `localStorage`; try/catch degrades gracefully.
7. **Premature prestige** → out of MVP.
8. **Content-as-subclasses** → registries + typed effects (workers now follow the same pattern).
9. **Over-designing want/compatibility** → category match + light weights; guard optional fields.
10. **Kongregate bolted in mid-code** → isolated no-op bridge as its own pass; AI-use disclosure at
    submission.

---

## 9. Asset specs (Daniel authors all assets)

Stage **1280×720**; everything **PNG-32 (RGBA)**; filenames **lowercase, matching the data `id`**.
**Perspective: PixelLab low top-down (~20°), front-facing, single facing** — author characters,
props, and backdrop at the same angle. Placeholders-first: a missing image degrades to a placeholder,
never a crash. Sheet convention: **one horizontal strip per animation**, frames left-to-right at
equal width, auto-sliced by frame count in code (no pixel sizes to enter); static prop = `<id>.png`,
animation = `<id>_<anim>.png`.

**IMPORTANT (measured, supersedes the original spec):** the shipped `shop_bg.png` has its wall/floor
seam at **y=462**, not the originally spec'd 446 — `FLOOR_Y` in scene.js is 462 and all floor-contact
anchoring keys off it. Author the backdrop with the seam at 462 (wall 0→462, floor 462→720).

**Option-3 art polish — SCRUBBED (Daniel's call, 2026-07-04).** A full re-export spec (native-size
frames, feet-at-edge, strict art+code-together sequence) was drafted, then dropped before any work:
the crisp-canvas pass had already captured most of the visible win, and nine re-exports plus a
draw-convention flip wasn't worth the marginal "bake and polish" gain. **The PERMANENT mob-art
convention is therefore the current one — do not resurrect the re-export plan:** frames authored at
**128×128** (strips 4 × 128 → 512×128), drawn at `QUEUE.size` × per-monster `spriteScale`, with
bottom padding compensated by a **MEASURED `footPad`** registry field (pngjs alpha-scan at
integration; guarded `?? 0`) — flyers skip `footPad` and may carry deliberate altitude padding.
**New mobs (the frog) follow this same convention.** The one piece of the analysis that stands:
**item icons stay 64px** — the icon files serve THREE consumers (shelf slots 48px, purchase float
32px, DOM cards 32px); a 48px re-export fixes one and turns both clean ×0.5 consumers into crunchy
×0.667. The shelf's ×0.75 is the accepted residual.

| Asset | Target size (authoring) | Animations | Filename(s) | Status |
|---|---|---|---|---|
| Froggo (4th customer, Pass 4b) | 128×128/frame (permanent convention) | shared 4-frame idle @6fps + walk strip | `frog.png`, `frog_idle.png`, `frog_walk_happy.png` (the walk is authored as a GRUMPY STOMP — naming kept by convention, mismatch intended) | **ALL IN** (2026-07-04) — `footPad` 15 MEASURED, `spriteScale` 1.1 (content 76% of frame) |
| Slimey / Batty / Skele (customers) | 128×128/frame (PERMANENT convention — see the Option-3 scrub note above) | shared 4-frame idle strips (6fps) | statics `slime.png` etc. + `slime_idle.png` etc. | **ALL IN** (statics + all three idle strips, 2026-07-03); drawn 88px (`QUEUE.size`), Slimey/Skele `spriteScale` 1.15, `footPad` MEASURED slime 18 / skeleton 12 (grounding pass), Batty `flying: true` (padding = hover altitude) |
| Bob (mimic merchant) | 128×128 or 160×160/frame | idle 6f · serve 6f (one-shot) | `mimic_merchant.png` (static fallback), `bob_idle.png`, `bob_serve.png` (6-frame strips) | **IN** — 240px on-screen (`BOB.height`), feet anchored to `COUNTER.baseY` − 50 |
| Counter / desk | ~480px wide (author 2× ≈ 960 for crisp) | static | `counter.png` | **IN** — 480px (`COUNTER.width`), base at H*0.74 (~533) + contact shadow |
| Battle door (ex-portal) | **160×160/frame**, 4 frames → **640×160 strip**; frame 0 CLOSED → 3 OPEN; **frame 0 must be pixel-identical across variants** | one-shot open/hold/close on paid serve; destination re-rolled per opening | `portal_glow.png` (base/void), `portal_glow_mountain/_forest/_dungeon.png` (destination variants — a new biome = one strip + one `DOOR_VARIANTS` entry), `portal.png` (static fallback) | **IN** — 320px on-screen (2×); bottom = `FLOOR_Y + 6` (art has 3px bottom padding ×2 scale) |
| Shop backdrop | 1280×720, **seam at y=462** | optional torch flicker later | `shop_bg.png` | **IN (WIP)** — iterating |
| Item icons (all FIFTEEN — base trio, tier-2 three, batch-1 nine) | 64×64 — **STAYS 64** (batch-B decision above) | static | `<item_id>.png` for every ITEM_ORDER id (e.g. `club.png`, `murk_tonic.png`, `quiver.png`) | **IN — ALL FIFTEEN** (batch-1 nine landed 2026-07-04, dimension-verified 64×64) — shelf-v3 wall slots at **48px** (×0.75), DOM cards + canvas purchase float at 32px (×0.5; float rises 46px, fades 900ms) |
| Wall-shelf plank prop | authored **486×37 (MEASURED)**; Shelf v3 stretches it to **312×30** per row (`plankBoxH` dial) | static | `wall_shelf.png` | **IN** — all THREE v3 rows reuse it; absent → code-drawn plank |
| Happy-walk strips (celebration pass) | 4 equal frames, 128×128/frame (512×128 strip — PERMANENT convention) | 4-frame loop @ 8fps (`CELEBRATE.walkAnim`; per-monster `walkHappy` override, guarded) | `slime_walk_happy.png`, `bat_walk_happy.png`, `skeleton_walk_happy.png`, **RIGHTWARD-facing** (the march is left→right; code doesn't mirror) | **ALL IN** (2026-07-03) — pads re-MEASURED consistent with statics (slime walk 20 vs 18: 1.6px on screen, negligible); fallback chain walk strip → idle strip → static → rect |
| UI icons (gold, rep crown, scrap-reserved) | 32×32 | static | `icon_gold.png`, `icon_rep.png`, `icon_scrap.png` | **NOT YET USED** — HUD uses text glyphs |
| Panel / button chrome | — | — | — | CSS-styled (DOM), few image assets needed |

Item icons are the one exception to the perspective rule — they live in DOM cards, so a clean
front/slightly-angled icon is fine. The Aseprite fitting pass sets exact sizes and aligns every
customer's baseline to the same floor plane (queue feet currently ~495; see `QUEUE.y`).

**Art integration status:** Bob's scale is locked (`BOB.height` 240px in `scene.js`, feet anchored to
`COUNTER.baseY`). Bob is animated — idle loop + serving one-shot, each a 6-frame horizontal strip
(`bob_idle.png` / `bob_serve.png`), auto-sliced; serving fires on a successful Serve (manual OR auto —
**M4 reuses `playBobServe` via the `workerServed` flag**), then returns to idle. Missing sheet → static
`mimic_merchant.png` → placeholder. **M4 added NO new art** — the auto-serve worker reuses the existing
shopkeeper sprite/animation.

All diorama sprites are wired with graceful fallback under `assets/sprites/`: `shop_bg` (1280×720,
**WIP**), `mimic_merchant` / `bob_idle` / `bob_serve`, `slime` / `bat` / `skeleton`, `counter`,
`portal`. Tunable size/position blocks at the top of `scene.js` (`QUEUE`, `BOB`, `COUNTER`, `PORTAL`,
`WALL_SHELF`, `FLOOR_Y` = y=**462**, MEASURED — see the seam note above). Authoring sizes: backdrop
1280×720 (wall 0→462, floor 462→720); counter ~480px wide; mobs 128×128 frames drawn 88–101
(PERMANENT — see the Option-3 scrub note); door to the 160×160/frame strip spec.

---

## 10. Project structure & conventions

```
mob-mart/
├── index.html              <- entry: canvas + DOM panel containers, scale-to-fit wrapper
├── style.css               <- all DOM/panel styling (M4: + .workers-panel / .worker-card block)
├── PROJECT_HANDOFF.md      <- this doc (tracked; NOT shipped)
├── COMEDY_BIBLE.md         <- voice spec + line batch reference (tracked; NOT shipped)
├── MOB_MART_RESEARCH.md    <- idle-progression design research (tracked; NOT shipped) — the
│                              source for the gameplay roadmap in "Next up"
├── .gitignore
├── src/
│   ├── main.js             <- entry point + game loop            [M1] (M4: hire wiring + worker anim flag)
│   ├── config.js           <- ALL global tunable constants        [M1]
│   ├── state.js            <- state machine + game-state object   [M1] (M4: workers sub-state + workerServed)
│   ├── game.js             <- core loop: spawn/serve/tick         [M1] (M4: hire + effectiveWorkerInterval + updateWorkers)
│   ├── combat.js           <- off-screen combat resolver          [M1]
│   ├── messages.js         <- logLine(): picks + fills a line     [voice]
│   ├── utils.js            <- rng, clamp, number formatting       [M1]
│   ├── save.js             <- localStorage load/save              [M2] (M4: workers:{id:{owned}} persist + guard)
│   ├── offline.js          <- timestamp-delta offline earnings    [M5 — IN]
│   ├── kongregate.js       <- isolated no-op bridge stub          [M6 — IN]
│   ├── data/
│   │   ├── monsters.js     <- customer registry                   [M1]
│   │   ├── items.js        <- item registry                       [M1]
│   │   ├── results.js      <- tiered log-line batch               [voice]
│   │   ├── upgrades.js     <- upgrade registry + typed effects     [M3]
│   │   └── workers.js      <- worker registry (Bob)               [M4 — created this pass]
│   ├── render/
│   │   ├── scene.js        <- diorama; sprites + Bob strip anim    [M1+art]
│   │   └── sprites.js      <- image loader + fallback             [M1]
│   └── ui/
│       ├── hud.js          <- top resource bar                    [M1]
│       ├── panels.js       <- DOM panels                          [M1] (M4: Workers panel + Bob card)
│       └── nav.js          <- bottom nav                          [M3] (M4: Workers tab activated)
└── assets/  (sprites/ · ui/ · audio/)
```

**Conventions:** one responsibility per file, small focused functions, comment the *why*. Global
tunables in `config.js`; per-entry numbers in the matching registry. Visual params separate from logic
params. Data-driven by ID; new content auto-flows. Graceful fallback everywhere. Namespace + version
persistence keys; default missing save fields on load. No secrets on the client.

---

## 11. Git & deploy

- **Git from day one.** Small commits after each tested milestone; specific, feature-named messages.
  Daniel owns commit/ship timing — Claude proposes commands, never commits. Inline git blocks omit the
  `cd` (Daniel runs git from the repo directory already). Repo: `github.com/Cupcakechan/mob-mart`.
- **`.gitignore`** excludes `builds/`, `node_modules/`, `.vscode/` / `.idea/`, OS cruft.
  `PROJECT_HANDOFF.md` + `COMEDY_BIBLE.md` + `MOB_MART_RESEARCH.md` are tracked but NOT shipped. Scratch tests
  (`test_*.mjs`) are dev-only — EXCEPT `test_suite.mjs`, which is COMMITTED (gitignore negation) so a
  fresh clone can verify itself; still not shipped to the host.
- **Ship folder** = the folder holding `index.html` + `src/` + `style.css` + `assets/`. No build step.
- **Publish (primary): Kongregate** — manual upload via the Developer Portal. Bridge/loader at M6.
- **itch.io: undecided** (§13). If added, a `butler` push of the same ship folder.
- **No DevLog for Mob Mart** — Daniel opted out (2026-07-03). Skip the dev-method's DevLog draft
  step at feature completion for this project; the handoff + build history are the only records.
- **Recover before diagnosing:** restore the last good build first, then debug.
- **Pre-flight before "Released":** clean load, no console errors, links + mobile check, DEBUG/log
  flags off, `node --check` on changed JS.

---

## 12. Current state & next steps

### Current state (read first)

Playable end-to-end with the full idle lattice live: mobs queue → Serve (manual or Bob's
auto-serve) → celebration hop + march through the battle door → comedy result + gold/rep →
restock/upgrades/perks/licenses. Loyalty (Pass 1), dual-track Fame + perks (Pass 2), tier-2 licensed
stock (Pass 3), Restock All (3.5), spawn director, offline earnings, Kongregate no-op bridge — all
shipped. **Roster: FOUR customers** (Slimey / Batty / Skele / **Froggo**, all art IN) and
**FIFTEEN items** (base trio + tier-2 three + batch-1 nine, all icons IN). Battle results land at
DOOR ENTRY (render-synced + fallback). Wants are A2 category-affinity; the everything tier is B2
ratcheted; comedy is item-aware (category-tagged templates). Save `mobmart.save.v1`, additive
schema, clamped merges (ratchet merge-seeded from the pinned legacy basis). Suite:
**`test_suite.mjs` at repo root, 288 assertions green** — a fresh clone self-verifies with
`node test_suite.mjs`. Suite doctrine (batch-1 lesson, 19 fixtures broke at once): EXACT-MATH
tests pin the trio shelf via `pinTrioShelf`; RULE tests derive expectations from the live
registry — never hand-type a roster-dependent number into a rule test.

### Next up — the idle-progression roadmap (from MOB_MART_RESEARCH.md)

**Agreed immediate order — THE UX ROADMAP (Daniel's fresh-eyes full-reset findings, 2026-07-04;
all shapes below are HIS refinements of the options rounds, decided):**
1. **Bob's hire arc (pseudo-tutorial).** Bob is NOT visible until hired (drawBob + serve anims
   gate on `workers.mimic_merchant.owned`); the empty counter carries a persistent goal chip
   ("The counter needs a merchant! Hire Bob — 50◆", DOM, click -> Workers tab); on hire Bob
   appears. Teaches manual serve THEN automation, and keeps the first-purchase beat.
   startingGold 40 vs hireCost 50 = 1-2 manual serves fund it (deliberate). Old saves
   (owned: true) see nothing. Suite: M4 sections assume unowned start — already compatible.
2. **Fame track panel ("unlock tree" — Daniel's twist on Option 3).** Fame is LINEAR, so the tree
   is a vertical TRACK: one node per tier (Newcomer..Legendary), each node fanning out what it
   unlocks — REGISTRY-SCANNED (licenses' + perks' requiredTier auto-populate; new content
   auto-appears). Centered showcase presentation (the Bestiary-v2 pattern; documented actor-band
   exception). Plus a one-line HUD remainder ("· 32♛ to Trusted"). NOT a branching spend-tree —
   that would be a new system; display only. Must visually separate spendable ♛ vs lifetime Fame.
3. **License alerts via BOB'S SPEECH BUBBLE (Daniel's twist on Option 2).** On a tier crossing
   with newly eligible licenses, Bob gets his own bubble (drawBubble variant anchored at Bob):
   queued announcements ~6s each, PLUS a gentle recurring reminder (~30s dial) while any eligible
   license sits unbought, PLUS the milestone log line as the permanent record. NOT clickable
   (canvas has zero click handling — by design); if click-to-shop ever matters, a DOM chip is the
   fallback. Trigger = TIER ELIGIBILITY, never affordability (gold fluctuates -> spam).
4. **The Restocker (second worker).** SMALLER than Bob, a FLYING something (art undecided —
   flyer conventions apply: `flying: true`-style hover, altitude padding). Passive slow
   auto-restock trickle + the "Restock now" clickable DOM chip over the diorama for active play
   ("Club out — Restock 6◆" -> restockItem). Upgrade specifics deferred to the pass (mini options
   round at build: chip stacking, affordability graying, trickle rate). Hire cost ~100-150 = the
   second-purchase beat. Registry row auto-appears on the Workers tab.
5. **Menus — Option 3, future-proof.** Title screen (menu screen state over dimmed diorama:
   Play/Continue, Credits, Kongregate sign-in status) + pause overlay (Esc / button; update()
   already gates on `state.screen`) + a SETTINGS section seeded only with REAL toggles (wiggle
   on/off is a candidate) — no placeholder rows. Kongregate sign-in per the platform reference
   (load references/kongregate.md at build). Credits section required for Kong.
6. **The RAT (fifth customer).** Registry row + full comedy voice (fifth distinct lever — the
   real cost) + @25 ladder batch + one golden @100 + 3 PNGs (128-frame convention, footPad
   MEASURED at integration). Everything else auto-flows (A2 wants, spawns -> 20% each, bestiary
   reveal, milestones).

The problem it solves: the game has ONE growth axis (gold -> 4 upgrades -> done at ~10.6k). The
research's answer is a lattice of small bolt-on layers on existing hooks, staged so every pass
leaves 2–3 affordable-soon wants visible. One system per pass, in this order:

- **Pass 1 — Milestone sales bonuses ("Regulars' Loyalty") — committed.** New
  `src/data/milestones.js`: item breakpoints 10/25/50/100/250/500/1000 -> +8% gold on that item
  each; monster breakpoints 25/50/100/250/500 -> +10% rep serving that monster each; "everything"
  tiers (ALL items past 50/250/1000, laggard-driven) -> global gold x1.25 each (~x3 gold at full
  ladder). THE RULE: bonuses multiply the PAYOUT, never basePrice — affordability untouched, so
  loyalty can never lock customers out (fiction: tips/bestseller tags, never markups — bible rule).
  `state.stats` lifetime ledger { itemSales, monsterServes } (persisted, clamped in mergeSave,
  additive schema; pre-ledger saves start at 0). Live serve pays with pre-sale multipliers, then
  counts, then announces crossings as gold `tier:'milestone'` log lines (10 lines in
  milestones.js, mirrored in the bible). Offline: soldByItem returned + banked by applyOffline;
  multipliers FROZEN at absence start (deterministic); offline crossings silent by design; monster
  counts live-only (sim sells items, not buyers). Shelf cards show "Sold N · next bonus: M".
  Suite at **128** (24 new: mult math, laggard tier, exact payouts 14/19/3, exact-budget
  affordability guard, once-only announcements, dismiss counts nothing, double announcement on
  laggard crossing, save clamps, offline frozen-mult unit gold + ledger banking, line guards).
- **Pass 2 — Fame — committed. DUAL-TRACK:** `state.lifetimeRep` (never decreases;
  drives ALL tier gates via `fameOf`) vs `state.reputation` (spendable balance). Gains feed both
  (live + offline); the leave penalty hits the balance only. Migration: pre-Fame saves seed
  lifetime from current rep — no earned gate is ever lost (tested at 3600). New tiers: **Renowned
  500 / Legendary 1500** (Mythic ~5000 reserved); HUD badge reads lifetime, number stays the wallet.
  New `src/data/perks.js` (upgrades-shaped registry, REP-costed): **Haggler's Charm** (-1 restock
  gold/level, floor 1 — protects the reserve-margin invariant; 200/1.6x/max3, Trusted),
  **Velvet Rope** (+1 queue slot; 300/max2, Beloved), **Warm Welcome** (+4s patience; 250/max2,
  RENOWNED — the new tier gates something on day one). Consumers: `effectiveRestockCost` (canRestock/
  restockItem/card labels all live), queue-cap + spawn-patience in game.js (spawnCustomer now takes
  state, guarded). "Fame Perks" section in the Upgrades panel (perk-card, rep-purple costs, Reach-
  Tier locks). Perk levels persisted + clamped. Suite at **151** (23 new: dual-track, lifetime
  gates at wallet-0, migration, spend math + curve 200/320/512, maxLevel stop, all three consumers
  incl. same-tick patience decay, clamps, offline lifetime banking). All costs/thresholds are dials,
  provisional pending feel.
- **Pass 3 — Better Stock — committed.** THREE tier-2 registry rows: **Iron Sword**
  (26/13, eff 10, license 800g @ Renowned), **Greater Flask** (27/13, eff 8, license 800g @
  Renowned), **Knight Helm** (30/15, eff 9, license 1200g @ Legendary). Items carry a `license:
  { cost, requiredTier }` field; `state.licenses` booleans (persisted; merge is STRICT ===true —
  tampered truthy strings unlock nothing). Until licensed an item is INERT everywhere: spawn wants
  filter to unlocked items (locked rows can't create unservable wants), canRestock false, offline
  reserve conjures nothing. Locked shelf cards grey out and sell their LICENSE (gold button;
  "Reach <Tier>" below the gate). **Fame budgets:** rolls x(1 + 0.15 x tiers above Beloved) —
  Renowned x1.15 / Legendary x1.30 (`CONFIG.fame.budgetPerTierAboveBeloved`), the customer-side
  answer to tier-2 prices; occasional can't-afford window-shoppers are handled by the existing
  auto-wave. **Regression guard:** the "everything" milestone tier keys off BASE (license-free)
  items only — new rows at 0 sales can't drop an earned global tier, and the ladder can't stall
  behind an unbought license. **Riders shipped:** offline capHours 2 -> **12** (research churn
  warning); "Sold N" card line restyled (gold count, no-wrap). Shelf = 3-col grid, scrolls within
  max-height 300 (actor band protected). Want-weights: tier-2 added modestly per monster (base
  stays the volume business). Icons pending: `iron_sword.png`, `greater_flask.png`,
  `knight_helm.png` (64x64 — cards degrade to text, floats skip). Suite at **185** (12+ new:
  license gates/one-time, 400-spawn locked-want filter, registry-driven Legendary budget bounds,
  base-only everything tier, offline reserve gating, tier-2 serve + own ladder, strict-boolean
  saves; cap test moved to 12h). A hand-typed test range map failed once (Batty is [12,22]) —
  bounds now read the live registry.
- **Shelf 2.0 (Pass 3.5, committed; Daniel picked Option 3):** the 6-item shelf broke
  the SPEECH BUBBLE's airspace (bubble top ~y328 worst case — now a documented layout budget beside
  the actor band). Three pieces: (1) **category sub-tabs** (Weapons/Armor/Potions from the
  registry's dormant `category` field) — one row per category, the shelf never stacks vertically
  again; panel max-height 224 (bottom ~320, clear of the bubble); compact card CSS. (2) **Collapsible
  center panels** — clicking the ACTIVE nav tab dismisses it; boot is COLLAPSED (the diorama is the
  resting state); attention pulses summon the player back. (3) **Restock All** in the shelf header:
  quote = full fill at effective costs (Haggler + licenses respected); short purse fills ROUND-ROBIN
  one unit per item per pass (the offline sim's fairness loop); disabled only when no unit is
  buyable. Attention now hops THREE levels: nav pulse (panel closed) -> category-tab pulse (wrong
  tab) -> card pulse. New game API: restockAllCost/canRestockAll/restockAll; handlers onRestockAll
  + onDirty. Suite at **203** (10 new: quote 47 exact + Haggler 29, full fill 6-for-47, round-robin
  23-gold one-each, no-op on full, licensed joins/locked excluded, cap respect).
- **Spawn director (committed; the "spotlight" fix).** Flat spawn rate's equilibrium
  was ONE customer at maxed Bob (throughput >= arrivals). `CONFIG.queue.spawnIntervalByQueue:
  [1.2, 1.8, 2.6, 3.6]` — next interval indexed by post-spawn queue length (clamped to last).
  Self-balancing at every Bob speed: empty -> hurry, deep -> relax; keeps ~2-3 mobs on stage.
  FLAGGED economy nudge: a maxed shop sells more per minute (arguably what maxed should feel like).
  Suite proves it: 120s maxed-Bob sim must be non-empty most of the time.
- **Diegetic wall shelf, C-LITE (committed; Daniel's "art should be the centerpiece").**
  `drawWallShelf` in scene.js: code-drawn plank on the upper-left wall (`WALL_SHELF` dials, icons
  at y176, below HUD / above bubble airspace) showing every item's icon + a stock bar (gold, red
  sliver when dry); unlicensed items = dim empty slots (silent tease); the STARVED slot breathes
  gold (attention system, level 0 — visible with all panels closed). DISPLAY ONLY by design: no
  canvas click region (that's the deferred C-full upgrade); SHOP still opens the management panel,
  which overlays the prop when open (top-left, deliberate). No new art required — icons reused;
  a shelf sprite is optional future polish. Suite at **208**. Batty idle-strip pass queued next
  by name.
- **Pass 4 — Bestiary + new monsters ("Field Guide" + Gobbo/rat, MED, both).** Fill the stubbed
  tab: per-monster served counts unlock new comedy lines, per-monster bonuses, completion %.
  Ship Gobbo (+ rat) alongside — new monsters multiply milestones + bestiary at near-zero marginal
  cost. (Gobbo is order-flexible: it can ship earlier as pure content if wanted.)
- **Pass 5 — Restock worker + automation tiers ("The Back Room", MED, check-in).** The reserved
  role becomes real (visual: the flying companion behind the counter — decided earlier); then
  worker tiers (serve/restock speed) as the gold sink for the larger economy.
- **Pass 6 — Daily supplier delivery + market events ("Market Day", LOW–MED, check-in).** Once-a-day
  free crate/bonus on check-in (streak-friendly, NEVER punishes missed days) + rotating demand
  events ("everyone wants HP Flasks today"). Bolts onto lastSeen + the item registry.
- **Pass 7 (distant, optional) — light prestige ("Franchise").** Only after 1–6 and only if players
  reach buyout and keep playing; sqrt-based multiplier, reset at +50–200% gain.

**Number-curve rule for all of it (research §Recommendations):** repeatable sinks use GENTLE
multipliers (~1.1–1.15) so they last; the steep 2.1x stays reserved for the small fixed core-upgrade
set. Add "bumpy" x2 spikes at 25/50-style breakpoints. Never add decay/backward progress.

### Polish / art track (parallel, order-flexible)

- **Mob idle animations — committed, art IN (`bat_idle.png` shipped; Batty flaps).** drawMob
  generalizes Bob's strip pattern:
  optional `anim: { frames, fps }` per monster; chain = `<id>_idle.png` strip (auto-sliced,
  +x*37ms phase offset so a line of same-species mobs never flaps in lockstep) -> static `<id>.png`
  -> rect. Batty declares `{ frames: 4, fps: 6 }`; **bat_idle.png PENDING from Daniel** (4 frames
  x 128 = 512x128, PNG-32, left-to-right, body high in frame — the existing ~15px bottom padding
  gives the hover). Slimey/Skele declare nothing (guarded absence, tested). Gobbo later = one field
  + one PNG.
- **Shelf decoration v2 — SHIPPED 2026-07-03** (was parked here; Daniel picked Option 2 —
  rotation + crossfade + prop hook). Full detail in the build-history entry; `wall_shelf.png` IN.
- **Skele mass (art):** measured verdict — he's the TALLEST mob but a 37px-wide stick (~2.8k px²
  vs Slimey ~6.3k). Fix is silhouette, not scale: bigger skull / wider stance / chunkier bones.
  spriteScale stopgap 1.3 available; Daniel parked it for now.
- **Shadow-float (art):** all mobs carry 15–18px dead padding below the feet (~11px float on
  screen); trim bottom rows in Aseprite.
- **Backdrop iteration** (seam MEASURED y=462), **itch.io dual-publish decision**, **Kongregate
  submission pass** (entry `index.kongregate.html`, create the `loaded` stat, AI-use disclosure).

### Build history (chronological)

- **M1** vertical slice built + logic-tested (node --check + headless smoke test); pushed. Plus a Send
  Away dismiss and a static-sprite Bob path (scale locked, 240px on-screen).
- **M2** (three passes, all done): reputation HUD (service-based, +2/−1); full capped FIFO queue +
  per-mob patience; localStorage save (versioned, guarded, Reset, `lastSeen`). Pushed.
- **Voice pass** (pre-M3): `COMEDY_BIBLE.md` + ~150 PG lines across 7 tiers into `src/data/results.js`;
  line selection refactored into `src/messages.js`.
- **M3 pass 1:** bottom nav + data-driven Upgrades view; Extra Shelf wired (`effectiveMaxStock`).
- **M3 pass 2:** Faster Counter (serve cooldown via `serveSpeed`) + Better Signage (rep/sale via
  `repMult`); compact upgrade rows.
- **Background hook:** `scene.js` draws `shop_bg.png` with flat-color fallback at `FLOOR_Y` y=462 (MEASURED — see §9).
- **M3 pass 3 (M3 COMPLETE):** rep-tier gating — `isUpgradeUnlocked`; Extra Shelf → Neutral, Faster
  Counter → Friendly, Better Signage → Trusted; locked cards dimmed "Reach &lt;Tier&gt;".
- **M4 (DONE, committed `6748ef5`):** first mimic worker / auto-serve. New
  `src/data/workers.js` (Bob = `mimic_merchant`, role `serve`, `baseInterval` 6s, `hireCost` 50).
  Hire-with-gold (Option B). `game.js` gained `canHireWorker` / `hireWorker` /
  `effectiveWorkerInterval` / an `updateWorkers` tick appended to `update()`, all reusing the manual
  `serveCurrent` path + shared serve cooldown (Faster Counter compounds onto the worker interval).
  `state.js` gained the `workers` sub-state + transient `workerServed` flag; `save.js` persists
  `workers:{id:{owned}}` with default-fill (pre-M4 saves load unowned; SAVE_VERSION unchanged);
  `nav.js` activated the Workers tab; `panels.js` added the Workers panel + Bob card (Hire → Active,
  shows rough interval); `main.js` wired `onHireWorker` and plays Bob's serve one-shot on the auto
  path via `workerServed`; `style.css` gained a `.workers-panel` / `.worker-card` block. Verified:
  `node --check` clean on all 7 changed files + a 46-assertion headless smoke test (`test_m4.mjs`).
- **M4 follow-up — broke auto-wave (committed `a49e62c`):** with a serve-worker hired, an unaffordable
  FRONT customer is rep-neutrally dismissed after `CONFIG.queue.brokeGraceSec` (2s), reusing
  `dismissCurrent` + its log line; keyed off `serveBlockReason === 'cant-afford'`, so out-of-stock is
  never waved. Fixes the "broke customer blocks the line → everyone behind times out (−rep)" cascade.
  Customers gained a transient `brokeWait`; `game.js` gained `anyServeWorkerOwned` + `autoWaveBroke`.
- **Comedy v2 (committed `6956d04`):** batch grown 111 → 148 lines, all originals preserved. Dismiss
  6→14 generic (+Bob-voiced wave-offs; the hot tier since the auto-wave), leave 6→10, ~13 genre-trope
  lines (rule: **tropes, never trademarks**), running gags seeded to payoff threshold (pebble ×3,
  femur ×3, coupon ×2, gear-eating ×2). `COMEDY_BIBLE.md` gained the genre-parody section, Bob as a
  documented fourth (shop-side-only) voice, and a gag status tracker. Files kept in verified sync.
- **Picker micro-pass (committed `be48e7a`):** `logLine` remembers the last template per
  `monsterId|tier` pool and re-draws once on a match — never the same line twice in a row per pool.
  Property-tested: 105k draws, zero back-to-back repeats.
- **Audit-fixes pass (this commit):** post-model-swap audit of the pushed repo found and fixed:
  **(1) real save bug** — `mergeSave` clamped stock to the BASE `maxStock`, so reloading ate any stock
  bought above it via Extra Shelf (repro: L2 + stock 7 → reload → 5, 12g of restocks lost). Fix:
  upgrades merge before items; the clamp uses base + `sumEffect(fresh,'maxStock')`. **(2) latent
  wrong-registry fallback** — `spawnCustomer`'s `wantedItemId` fell back to `MONSTER_IDS[0]` (a
  monster id) → now `ITEM_ORDER[0]`; the old value would have made a customer with broken
  `wantWeights` an unservable `'no-item'` front blocker the auto-wave can't clear. **(3)** deleted
  three stray duplicate files committed by accident in M4 (`src/nav.js`, `src/panels.js`,
  `src/workers.js` — exact copies of the `ui/`/`data/` originals, unimported). **(4)** `.gitignore`
  now excludes `test_*.mjs`; `messages.js` trailing newline restored. Smoke test grown to
  **61 assertions** incl. regressions for (1) and (2).
- **M5 (committed):** offline earnings, Option 2 (gold + rep,
  worker-only, stock-consuming, 2h cap). New `src/offline.js` (`computeOffline` pure +
  `applyOffline` + `formatAway`); `CONFIG.offline` (capHours 2 / minAwaySec 60 / efficiency 1.0);
  boot hook in `main.js` (bank → save immediately → modal); modal markup in `index.html` +
  appended styles in `style.css`. Suite grown to **78 assertions** (17 new: zero cases, stock-limit,
  time-limit, cap equality, clock skew, upgrade composition offline, apply/no-op).
- **Battle door + grounding + comedy-grammar era (committed):** door art replaces the swirl (one-shot
  open/hold/close on paid serve only); grounding pass (FLOOR_Y measured = 462, counter/Bob to
  mid-ground H*0.74 + contact shadow, queue to feet ~495); comedy grammar fixes (dismiss lines get
  the real item — "no something" bug — store-policy line rewritten, "a {item}" article hazard) with
  registry-level test guards. Strays finally removed at `efc69d5`.
- **M6 (committed): the Kongregate bridge — MVP ROADMAP COMPLETE.**
  New `src/kongregate.js` (no-op bridge, verified against live Kongregate docs) +
  `index.kongregate.html` (index.html + one script tag) + one `initKongregate()` line in main.js.
  Suite grown to **88 assertions** (7 new: headless no-op, mocked-API activation, 'loaded' stat,
  submitStat forwarding, throwing-loader containment).
- **Retention pass (committed):** greet gate (`workers.greetSec` 1.2; `frontWait` on
  customers; worker-only — manual ungated) + **Backroom Storage v2** (offlineReserve; the suite
  PROVED the planned +capHours effect inert — stock always binds — so the effect was rethemed to an
  offline inventory reserve with Daniel's approval; same costs/gate). offline.js sells live shelf
  first, then reserve at net margin; returns `reserveUsed`.
- **Item-icons pass (committed):** shelf cards render `assets/sprites/<itemId>.png` at
  32px (onerror hides; text-only degrade) + canvas purchase float (`spawnItemFloat`, 32px, rise
  46px / fade 900ms, cap 8 alive, skips silently without art). Auto-path float reads the pre-update
  front item — reliable BECAUSE the greet gate forbids same-tick serve of a just-promoted customer.
  Suite at **104 assertions** (greet hold/release, manual ungated, backroom exact-math L0/L1/L3,
  live-only consumed, save clamp).
- **UI edge-frame (hybrid stage 1, committed):** Daniel picked the HYBRID after a
  visualized Option-3 exploration (decision: Option 2 edge-frame skeleton now, Option 3's speech
  bubble as a queued follow-up; door destinations stay RANDOM — per-monster mapping rejected).
  Layout rule: nothing may cover the actor band (mob tops y~407 to counter base y~533). Customer
  panel -> horizontal bottom bar (left:24 bottom:16 w:520; info flex + fixed 186px action column;
  template reflowed in panels.js, all IDs unchanged); nav docked beside it (left:556); log -> right
  column (w:300, top ~474, clears the door at 462); center panels raised to top:96 (upgrades/workers
  max-height 280). Seven CSS edits + one template reflow; no game-logic changes.
  **Browser-test fixes (same pass):** the nav's real width is ~465px (estimate was ~380) and it
  overlapped the log — nav is now RIGHT-anchored (right:340, edge 940, growth goes leftward; buttons
  slimmed to 8x12px pad / 13px font) with the customer bar at 500px; the log gets FIXED height:230
  (bottom-anchored max-height made a sparse log float as a lone title). Layout is robust to a future
  5th tab.
- **Tuning sweep (committed):** sink-side + pacing only, payouts untouched. All four
  upgrades `costGrowth` 1.8 -> **2.1**; `extra_shelf`/`better_signage` maxLevel 5 -> **7** (long-tail
  sinks); `faster_counter` max **stays 5** (the legibility cap); spawn 3 -> **2.6s**; patience 20 ->
  **24**; rep tiers 20/50/100 -> **25/75/200** (existing saves above 200 unaffected). Total buyout
  roughly ~6.9k -> ~10.6k+ gold. All provisional pending feel-check.
- **Mob calibration (committed):** optional per-monster `spriteScale` in monsters.js
  (slime/skeleton 1.15, bat omitted = 1.0 reference), multiplied into drawMob guarded `?? 1` —
  data-driven, future mobs need nothing. Suite still 104 (one tier assertion updated to Beloved 200).
- **Speech bubble (hybrid stage 2, INFO-ONLY variant — committed):** canvas bubble above
  the front mob: gold name, "wants <item> ◆ <budget>", plus an alert line for the mob's dilemma
  ("out of stock!" / "can't afford it!", computed inline — render stays free of game imports). Width
  measured from text per frame; tail bobs in phase with the mob; clamped to stage edges; `BUBBLE`
  dial block in scene.js (fonts mirror --font). Serve/Send Away STAY as DOM buttons (full-bubble
  variant with canvas hit-targets deliberately not built). Gold front-chevron RETIRED (bubble does
  its job); customer panel slimmed to name + line count (want/budget live in the bubble). Known
  cosmetic: a purchase float crosses the bubble for ~0.9s on serve — deliberate. Uses
  ctx.roundRect (Chrome 99+/FF 112+; fine for Kongregate's browser floor).
- **Research pass (doc tracked):** idle-progression design research completed (genre survey:
  AdCap/Clicker Heroes/Kittens/NGU/Melvor + Recettear/Moonlighter/Shop Titans + Pecorella pacing) ->
  `MOB_MART_RESEARCH.md` at repo root; "Next up" rewritten as its staged 7-pass roadmap.
- **Attention system (committed; Daniel: "assume users WILL miss things"):** the
  bubble's system text was disliked and REMOVED — the bubble is now pure character voice (name +
  want/budget only; the unused alert dial was dropped). The blocked-sale signal moved to WHERE THE
  FIX IS: when the FRONT customer's item has stock 0, that shelf card breathes gold (border +
  Restock button, 1.2s, keyframe `attn-breathe`) and — the tab-blindness guard — the SHOP nav
  button pulses via `setShopAttention()` (exported from nav.js, called each renderPanels) whenever
  the shelf panel isn't visible; switching to Shop clears the nav pulse and the card takes over.
  Deliberately FRONT-ONLY (= "a sale is blocked right now") so the pulse stays rare and meaningful.
  "can't afford it!" removed with no replacement (Bob's auto-wave self-resolves it).
  prefers-reduced-motion falls back to a static gold border. Chosen over bubble-text after an
  options pass (dials: card border+button / breathe / gold / front-only / include nav pulse).
- **Door destinations (committed):** three variant strips (mountain/forest/dungeon —
  identical door, different world through the opening) rolled per PAID serve in `playPortalOpen`
  via `pickDoorVariant` (picks only among LOADED strips; anti-repeat re-draw like the log picker;
  none loaded -> base void strip). `DOOR_VARIANTS` list in scene.js; 3 loadSprite lines in main.js.
  Upgrade path noted: variants can later gain per-monster weights (destination-as-characterization).
- **Shelf decoration v2 (this session, 2026-07-03; Daniel picked Option 2 of 3 — rotation +
  crossfade + prop hook):** the C-lite shelf block in scene.js replaced wholesale. TWO staggered
  planks (`WALL_SHELF.shelves`: A at 84/168, B at 128/244; plank width 244; lowest pixel y≈312,
  16px clear of bubble airspace 328), 4 slots each, showing a random rotating sample of the
  UNLOCKED pool: boot + any pool-signature change (license bought → the new good crossfades onto
  the wall, no event wiring) dress both planks; every `rotateSec` 45s ONE shelf re-rolls
  (alternating, log-picker-style one-re-draw anti-repeat); changed slots crossfade `crossfadeMs`
  300. Slot squares REMOVED; locked-teases REMOVED (the greyed Shop card owns the tease); stock
  bars + starved-glow KEPT — the front customer's dry, unlocked want force-swaps into shelf A
  slot 0 (self-idempotent: fires only while not displayed). New pure export `sampleShelf(pool,
  count, avoid, rand)`: Fisher-Yates, prefers ids not on the other shelf, tops up only when the
  pool is too small, order is part of the sample (small catalogs still visibly rearrange). Prop
  hook: `getSprite('wall_shelf')` fills the `plankBoxH` 24 band, else the code plank. **Shipped
  bug + plug (LESSONS.md):** the prop hook landed WITHOUT its `loadSprite('wall_shelf')`
  registration in main.js — sprites.js is a registry, and graceful fallback hid the miss silently;
  fix = one registration line, sweep = all literal `getSprite` ids verified registered (dynamic
  sites audited clean), guard = pairing assertion queued into the `test_suite.mjs` housekeeping
  commit. Scratch probe `test_shelf_v2.mjs` (329 assertions: module-import health, sampler
  exact-behavior incl. seeded determinism, rotation/starved/license smoke). Art: `wall_shelf.png`
  authored 486×37 (**MEASURED**), drawn 244×24 — slight vertical stretch; `plankBoxH` 18 is the
  one-dial exact-2:1 option if the chunkier board bothers on review.
- **Housekeeping: suite committed (2026-07-03, same session):** `test_m4.mjs` (211) renamed to
  **`test_suite.mjs`**, COMMITTED via `!test_suite.mjs` gitignore negation (after the `test_*.mjs`
  pattern; verified with `git check-ignore` — suite tracked, scratch probes still ignored). Grown
  to **223 assertions** with new **section 0b — sprite registry pairing** (the LESSONS.md guard,
  broadened beyond the original spec): scans ALL of `src/` for literal `getSprite('…')` ids AND
  config-carried `propId:`/`spriteId:` ids, asserts each has a `loadSprite` registration in
  main.js. The config shape is the one the wall_shelf bug actually wore — a literals-only check
  would have missed it. Negative-tested: registration removed → exactly 1 failure naming id +
  culprit file; restored → 223 green. Fresh clones self-verify with `node test_suite.mjs`.
  Template ids (`` `${monsterId}_idle` ``) remain statically uncheckable — covered by the
  anim-contract assertions. Daniel's local `test_m4.mjs` deleted post-confirmation (one suite).
- **Suite-location fix (2026-07-03; landed WITH the Pass B commit, not standalone — the standalone
  fix command was lost to a client rendering drop):** the housekeeping commit had placed the suite at
  `src/test_suite.mjs` — inside the SHIP folder, and unrunnable there (its imports and section-0
  walk resolve from repo root). Relocated across two commits: Pass B placed the current suite
  at root (225 green from root confirmed); the stale `src/` copy was removed in a follow-up cleanup commit.
- **Serve-celebration pass (2026-07-03; Daniel picked Option 2 of 3 — hop + march-through-the-door;
  refined across three confirmed feel iterations):** a paid serve spawns a render-side celebrant
  ghost — game state untouched, `queue.shift()` unchanged, ZERO economy impact; dismissals spawn
  nothing (happy-only per Daniel). Three phases, all dials in `CELEBRATE` (scene.js): **HOP**
  (`hopMs` 700, 2 hops, 16px air, squash-and-stretch on landing; +`nudgeX` 70 sidestep over
  `nudgeMs` 150 so the next-in-line's index-snap never overlaps), **WALK** (`walkSpeed` 650 px/s,
  ~1.0s; feet ease onto the counter's floor-contact plane over `sinkMs` 250 — iterations: wall-plane
  drift read as "walking ON the counter", queue-plane read as "on a ledge up its face"; the march
  belongs on `COUNTER.baseY`, derived not copied, so it tracks the counter dial), **ENTER**
  (`enterMs` 450: x locks at door center, feet climb to `PORTAL.baseY`, shrink to `depthScale` 0.85 —
  re-enabled here where the mob genuinely recedes — fade from `enterFadeFrom` 0.4 so the turn is
  SEEN before the dissolve). Door hold LATCHES (`portalAnim.holdLatch`, reset per one-shot in
  `playPortalOpen`) until the last celebrant finishes entering + `arriveBufferMs` 150 — latched
  because an unlatched hold snaps the close animation when a celebrant despawns. Cap `max` 4,
  oldest dropped. Triggers: `spawnCelebrant(monsterId)` at both serve sites in main.js (pre-shift
  capture, mirroring `preFrontItem`); 3 `loadSprite` registrations for the walk strips (registered
  before art exists — the wall_shelf lesson; template ids aren't statically checkable by the
  pairing guard, registration is the runtime half). Art fallback chain: `<id>_walk_happy.png`
  strip → idle strip → static → placeholder rect — the full arc plays TODAY with zero art (code
  hop + static march). Scratch probe `test_react.mjs`: spawn guard, three-phase frame sweep,
  overlapping serves vs the hold latch, cap spam, late idle. Suite unchanged at 223.
- **Pass 4a — Bestiary panel (2026-07-03):** tab enabled (stub retired); one parchment card per
  `MONSTER_IDS` entry — portrait, `Served N · +X0% rep`, five gold breakpoint pips (25/50/100/250/
  500), `next M`/`maxed`; header "N% studied" via new PURE `bestiaryCompletion` (milestones.js) —
  registry-driven, so the % DROPS when a new mob joins (deliberate field-guide feel, commented so
  a later pass doesn't "fix" it). Never-served mobs render as ??? silhouettes (Gobbo debuts as a
  reveal). DISPLAY LAYER ONLY over the Pass-1 `state.stats.monsterServes` ledger — no new counting,
  no save change. Suite **231** (+6, §23: roster-scaled totals, exact crossings, floor-not-round,
  legacy no-stats shape).
- **Bestiary v2 (same session, Daniel's ask "a fun little place to check out the mobs"):** centered
  showcase — 640 wide × ≤500 @ top:96 (`left:50% + translateX`), 72px portraits, bigger type/pips.
  A DELIBERATE documented exception to the actor-band rule while open (collapse-on-reclick restores
  the diorama). CSS-only.
- **Grounding pass (2026-07-03):** two float sources fixed. (1) The ±4px idle sine bob is now a
  FLYER behavior — registry `flying: true` on Batty only; grounded mobs sit still (their motion is
  the idle strips). (2) New registry `footPad` (?? 0): MEASURED bottom transparent rows (pngjs
  alpha-scan — slime 18, skeleton 12; bat none, its 15px IS the hover altitude) shift the draw down
  so real feet meet the shadow, in drawMob AND the celebrant march. Serve hop/squash untouched.
  Suite **236** (+5, §24: values PINNED so a later pass can't "correct" a measurement from memory —
  the Batty-budget lesson; plus a non-negative-finite contract guard for future mobs).
- **Crisp-canvas pass (2026-07-03, Option 2 of 3):** backing store = 1280×720 × min(3,
  devicePixelRatio × fitScale); CSS size stays pinned; `setTransform(bw/1280, …)` bridges so ALL
  draw code keeps logical coords — scene.js untouched, no canvas input mapping existed. THE GOTCHA,
  handled: assigning canvas width/height RESETS context state, so smoothing-off + transform are
  re-applied on EVERY resize. Result: the browser never resamples the frame. Residual ×0.79 art
  crunch left for Option 3 (below). Diagnosis note: smoothing was already off — the softness was
  the final-frame resample plus non-integer art ratios.
- **Art drop (Daniel, 2026-07-03):** `slime_idle`, `skeleton_idle`, `slime_walk_happy`,
  `skeleton_walk_happy` + an updated skeleton static. Re-MEASURED before further work: idle pads
  match the statics (18/12 — footPads stay correct); slime walk 20 vs 18 = ~1.6px on screen,
  accepted.
- **Shelf v3 + bubble gate (2026-07-04, Daniel picked Option 2 of 3 for size, then added the third
  row + centering):** 48px goods (`slotStep` 76, `plankPad` 18, `plankBoxH` 30, `barW` 48); THREE
  rows on one common center axis (x:78, y:38/134/230; row height 90; bottoms 128/224/320) replacing
  v2's stagger. Ceiling derivation now MEASURED and documented in the `WALL_SHELF` comment: bubble
  box top = tip(407−18−4bob) − tail 11 − body 51 = **y322 worst case** over x270–450 — cleared by
  2px; queue heads ~y394 pass below; the HUD chip (x≈490–790) never overlaps. Dressing code
  verified shelf-count-agnostic BEFORE the row was added (init maps `shelves`, rotation `%
  nShelves`, short samples pad to empty). Known visual: 12 slots vs the 3–6 item catalog = repeats
  across rows (shared-pool dilution, noted in config; `slotsPerShelf: 3` is the one-value out).
  Same commit: `drawBubble`'s bob gated to the front mob's `flying` (finishes the grounding pass —
  the bubble no longer hovers over a stationary Slimey).
- **Option-3 art polish SCRUBBED (Daniel, 2026-07-04):** a full spec (native-size re-exports at
  87/92/88px, feet-at-edge, strict art+code-together sequence) shipped into this doc, then Daniel
  weighed the Aseprite workload against the marginal gain — the crisp-canvas pass had already
  captured most of the visible win — and scrubbed it before any work started. The 128px-frame +
  MEASURED-`footPad` convention is now PERMANENT (§9). The batch-B icon analysis (64px master
  stays; three consumers at 48/32/32) remains valid and recorded. In the same message: **Gobbo
  redesigned as a GRUMPY FROG**, id/PNG naming `frog`; rat still an open call (§13).
- **Pass 4b — Froggo the grumpy frog (2026-07-04):** fourth customer, Option-2 identity (combatMod
  0, budget [16,30], wants leading with licensed items — pre-license the unlock filter hides them).
  Comedy lever: PROFESSIONAL DISSATISFACTION (review gag seeded ×3). Sprites registered before art
  (wall_shelf lesson); ??? Bestiary reveal worked as designed. Flushed a REAL pre-existing suite
  bug: section 19's base-tier budget bound was hard-coded 24 (old roster max) — now reads the live
  registry per spawn. Art landed same day: static + walk, then idle (pads 15/13/15 — consistent);
  `footPad: 15` + `spriteScale: 1.1` (content 76% of frame; 1.1 matches Slimey's visible mass).
  NOTE the art-integration micro-pass initially FAILED TO LAND on Daniel's machine (suite pin
  caught it: 1 fail at his HEAD) — re-cut from current HEAD, not the stale zip. Suite 249.
- **Battle-report timing (2026-07-04, Daniel picked Option 2 — render-synced):** the result line
  lands the frame the celebrant finishes ENTERING the door. `serveCurrent` queues
  `state.pendingReports` (TRANSIENT like uiDirty — never serialized; reload inside the ~2s window
  drops the LINE only, never economy); `deliverBattleReport` is the single delivery path, fired by
  scene.js's door-entry callback (`setCelebrantEnteredCallback`, wired in main.js — render->game
  stays callback-only) with a HEAD-only fallback tick in update() (`CONFIG.log.reportFallbackSec`
  3.0 vs the ~2.15s celebration). Deliberately ID-LESS FIFO: a cap-dropped ghost's report rides the
  next arrival, one slot late, visually indistinguishable. Economy stays at serve; milestone lines
  stay instant (battle line stacks on top ~2s later). Known nuance: HUD rep ticks ~2s before the
  crown on the line. Suite 265 (+16 §26; one M4 assertion migrated).
- **Items scaffold — A2 + B2 (2026-07-04, one approved pass):** (A2) `categoryWeights` +
  optional `itemBias` replace `wantWeights` everywhere; two-stage picker (category by weight ->
  item within, bias-weighted) so personality SHARE holds as the catalog grows; same unlock filter,
  same real-id fallback. (B2) `everythingTier = max(computed, stats.everythingTierEarned)`;
  written ONLY in serveCurrent on a live crossing; serialized + clamped; mergeSave seeds from the
  PINNED `LEGACY_EVERYTHING_BASIS` (launch trio, never grows) so an update shipping new free items
  can't regress a pre-ratchet save on first load. Suite 274 (+9 §27, 3x-stable statistical runs).
- **Item-aware comedy (2026-07-04, Option 2 — line-trust granted, no review):** templates are
  string | { text, cats }; logLine takes itemId, filters the pool by the item's category BEFORE the
  anti-repeat pick; no-item calls exclude tagged templates entirely. Audit: 24 {item} templates ->
  only 5 genuinely category-shaped (tagged); good-absurdity mismatches deliberately left neutral
  (the tagging rule, bible § 'Item-aware tags'). +7 new category lines (potion/armor registers).
  A scripted-edit SILENT NO-OP was caught by the in-file count check (10 vs 12) and re-landed —
  the landing-zone rule earning its keep. Suite 280 (+6 §28).
- **Content batch 1 (2026-07-04):** roster 6 -> 15. Free four (Tattered Shirt 5/2 eff1, Bandages
  6/3, Wooden Shield 8/4, Rusty Key 10/5 — INVARIANT: free price <= min budget roll, suite-pinned
  from the live registry) + Trusted/Beloved license rung (Bracer/Murk 150, Pickaxe 200 @ tier 2;
  Quiver/Zip 300 @ tier 3). Chain bases noted for batch 2. Shelf panel: categories are now 2 grid
  rows -> `overflow-y: auto` at 224 (PROVISIONAL: attention-pulse glow clips at the panel edge;
  dials named in style.css). THE SUITE MIGRATION: 19 hand-computed fixtures broke at once ->
  doctrine split: exact-math tests pin the trio shelf (`pinTrioShelf` helper — offline robin skips
  empties so old sequences hold), rule tests derive from the live registry (backroom reserve
  conjures per UNLOCKED item and cannot be pinned; §27's bias threshold now registry-derived).
  End-to-end payoffs asserted: a pre-batch save keeps its earned everything tier over four new free
  items; new items enter the want pool with zero wiring. All nine 64×64 icons IN (dimension-
  verified). Suite 288 (4x-stable).
- **Batch 2 — chain tops (2026-07-04):** Iron Buckler (armor 18/9 eff6, Beloved 300) + Iron
  Gauntlet (armor 24/12 eff8, Renowned 500), slotted into the 300->800 license-cost gap. Chain =
  naming + pricing, NO mechanic; the pricing RELATION is suite-pinned (§30 chain invariant).
  Daniel caught his own `iron_gaunlet.png` typo (renamed at origin — the gremlin lives). ALSO:
  §29's own day-old `ITEM_ORDER.length === 15` broke — the hand-typed-total lesson recurring
  IN-SUITE within a day; rule now WRITTEN: exact roster totals belong ONLY to the newest batch's
  section. Suite 291.
- **Shelf wiggle (2026-07-04, Daniel picked Option 2 of 3):** goods rest still; every intervalMs
  ONE displayed slot plays a bottom-anchored hop-and-settle (airborne 70% / landing squash 30% —
  the celebrant hop's language at shelf scale; idle math reduces to the exact old blit). Scarce on
  purpose: occasional motion draws the eye, constant bob numbs it AND levitates (the grounding
  rule extends to set dressing). Dials in `WALL_SHELF.wiggle`; Daniel tuned durMs 450->800,
  hopPx 3->4. Scheduler tolerates stale picks by design. Suite unchanged 291.
- **Line-unlock ladder + golden lines (2026-07-04, Daniel combined Options 1+3; line-trust, no
  review):** templates gain `minServes` (?? 0) filtered beside `cats`; logLine takes `serves`
  (serve-site passes count INCLUDING the current one) and returns `{ text, golden }`; golden
  entries outrank tier classes in the log render (gold + glow). Batches AT the loyalty breakpoints
  (Bestiary pips = new-material markers); registry-scanned unlock announcement (no false hype on
  batchless breakpoints). Shipped: 2-3 gated lines/monster @25 (in-voice escalations: Slimey's
  eat-gag matures, Froggo hits two stars) + ONE golden @100 each, written TIMELESS (they keep
  firing) — Froggo's five-star review is the crown; his gag chain is COMPLETE (bible tracker).
  Build catches worth keeping: a partial scripted batch left game.js referencing an unimported
  symbol (caught by the verify pass); and a FAIL-grep masked a mid-suite CRASH — always read the
  run's TAIL, a grep for failures is not a completion check. Suite 309 (3x-stable).
- **Economy observation session (2026-07-04):** scratch probe (`probe_economy.mjs`, NOT
  committed/gitignored — DELETE before any `git add .` or add a `probe_*.mjs` ignore line) simmed
  5x40min active play on the REAL modules + registry-math tables. Findings: timeline HEALTHY
  (Trusted ~min 2, first license ~5, Beloved ~6, Renowned ~12, Legendary ~23, 800g pair ~36-40,
  Knight Helm beyond 40 — a real long tail); batch 1 diluted early income ~27%/serve (15.0 ->
  10.89 analytic), compensated by the fast Trusted rung — Daniel's verdict: FEELS GOOD, no change
  and no honest single lever anyway; cant-afford waves ~11.6% observed (the 43% analytic is a
  base-budget worst case that fame scaling erases); Knight Helm was a permanent two-buyer good
  (Skele+Froggo only, even at x1.3) — **Daniel: 30 -> 26** (opens Slimey at exactly Legendary max,
  Batty comfortably; verified NO suite pin on the price; Daniel applies the edit himself).

---

## 13. Open questions / pending decisions

- **Rat: coming, but later** (Daniel, 2026-07-04) — a future content pass; the cost is a fifth
  distinct comedy voice, everything else is one registry row + 3 PNGs.
- **Line-unlock mechanic design** — deferred from the old Pass 4 bundle; needs its own options
  round (gating comedy pools by serve count touches the no-repeat picker).
- **Knight Helm 26 — Daniel's edit, verify landed:** next session, confirm `basePrice: 26` is at
  HEAD (items.js line ~18; restockCost stays 15 — margin holds; no suite change needed).
- **probe_economy.mjs is scratch and NOT gitignored** — if Daniel ran it locally, it must be
  deleted before `git add .` (or add `probe_*.mjs` to .gitignore).
- **Restocker build-time mini round owed:** chip stacking (list vs one-at-a-time), affordability
  graying, passive trickle rate + upgrade shape. Art is a small FLYER, undecided — placeholder-
  first per the standing pattern.
- **@50 line batches** whenever Daniel wants more comedy content (Batty's pebble escalation is
  teed up in the bible tracker).
- **Shelf-panel scroll tradeoff (provisional):** `overflow-y: auto` clips the attention-pulse glow
  at the panel edge — confirm on feel or adjust the dials named in style.css.
- **Feel verdicts logged 2026-07-04:** early pace GOOD (no dilution lever); wiggle tuned 800/4;
  golden styling unconfirmed on feel (ships, revisit only if it reads wrong).
- **Potion display names locked:** Murk Tonic, Zip Tonic (Daniel approved 2026-07-04).
- **itch.io dual-publish: yes or Kongregate-only?** Decides whether the `butler` deploy path is added.
- **Repo:** `github.com/Cupcakechan/mob-mart` (local folder `mob-mart`).
- **Offline earning model — DECIDED (M5):** worker-only, no drip. Bob is hireable within minutes, so
  a no-worker drip had a negligible window; revisit only if a rebalance moves `hireCost` far up.
- **Restock worker visual home:** DOM-only avatar vs canvas backroom/shelf prop vs beside Bob (decide
  when a second/restock worker is on the table).
- **Special "visits"** design (high-rep rare customers) — deferred.