# Mob Mart — PROJECT_HANDOFF.md

*Living source of truth. Read this in full (together with the code) at the start of every
session before doing any work. Update it as decisions change. Kept self-contained so a fresh
Claude or ChatGPT can parse it cold.*

**Status:** **M1–M4 complete and pushed.** The core loop, `localStorage` save, full FIFO queue +
reputation, all three rep-gated upgrades, and the M4 automation proof — **Bob hired for gold,
auto-serving the front of the line on an interval through the manual serve path** — are live,
browser-confirmed, and committed. M4 also shipped the **rep-neutral auto-wave** of unaffordable front
customers (worker-gated, 2s grace). Post-M4 polish is in: **comedy v2** (148 lines: dismiss/leave
expanded, Bob voice, genre-trope lines, gags seeded), the **no-repeat line picker**, and an **audit
pass** (fixed a real save bug — reload used to clamp stock to the BASE cap, eating Extra-Shelf stock;
fixed a wrong-registry spawn fallback; removed stray duplicate files). 61-assertion headless smoke
test + `node --check` clean on every module.
**M1–M6 MVP roadmap COMPLETE (all committed).** Post-MVP work now: the **retention pass** (worker
greet delay + Backroom Storage v2 offline reserve) and the **item-icons pass** (shelf-card icons +
purchase float) are BUILT — browser-confirm + two commits pending (no file overlap by design).
**M5 (offline earnings) is DONE (committed):** on return, a hired Bob's
capped, stock-consuming sales are banked and shown in a "While you were away" modal (Option 2 —
gold + rep, worker-only, 2h cap; the no-worker "drip" was decided AGAINST: Bob is hireable within
minutes, so it had no window).
**Next action:** commit M5 (browser-confirmed) + the portal micro-pass (built; drop
`portal_glow.png` to see it), then `backroom_storage` or **M6 — Kongregate no-op bridge**.
**Last updated:** M5 built (`src/offline.js` + `CONFIG.offline` + modal); 78-assertion suite
passes. NOTE: the audit's stray-file `git rm` never ran and a mis-placed `src/test_m4.mjs` is
tracked — cleanup commit queued (§12).

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
[min,max] · `patience` · `wantWeights` · `combatMod` · `baseRep` (optional).

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
- **M5 — Offline earnings. BUILT — browser-confirm + commit pending.** `src/offline.js`:
  `computeOffline(state, now)` (pure) → elapsed since `lastSeen`, clamped ≥ 0 (clock-skew guard) and
  capped at `CONFIG.offline.capHours` (2h) → sales = min(floor(cappedSec / effectiveWorkerInterval)
  × efficiency, total shelf stock), consumed round-robin at real basePrices; rep = sales ×
  effectiveRepPerSale. **Stock-consuming is the exploit guard** (no minting gold off a token shelf);
  deterministic (no RNG), so reload-spam recomputes identically. Worker-only (no worker → 0 → silent
  boot); no offline timeouts or rep losses (player-forgiving). Banked once at boot and saved
  IMMEDIATELY (fresh `lastSeen` → no double-collect); modal only when sales > 0 AND away ≥
  `minAwaySec` (60s). Upgrades compose offline: Faster Counter → more sales, Extra Shelf → more
  sellable stock, Better Signage → more rep.
- **M6 — Kongregate no-op bridge. BUILT — browser-confirm + commit pending.** `src/kongregate.js`:
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
- **Bestiary panel** — nav stub only; content post-MVP.
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

| Asset | Target size (authoring) | Animations | Filename(s) | Status |
|---|---|---|---|---|
| Slimey / Batty / Skele (customers) | 128×128/frame | idle 2–4 · shuffle 4–6 · react 3–4 (strips) | `slime.png` (static) or `slime_idle.png` etc.; same for `bat_`, `skeleton_` | **PLACEHOLDER RECTS** — drawn at 88px (`QUEUE.size`) |
| Bob (mimic merchant) | 128×128 or 160×160/frame | idle 6f · serve 6f (one-shot) | `mimic_merchant.png` (static fallback), `bob_idle.png`, `bob_serve.png` (6-frame strips) | **IN** — 240px on-screen (`BOB.height`), feet anchored to `COUNTER.baseY` − 50 |
| Counter / desk | ~480px wide (author 2× ≈ 960 for crisp) | static | `counter.png` | **IN** — 480px (`COUNTER.width`), base at H*0.74 (~533) + contact shadow |
| Battle door (ex-portal) | **160×160/frame**, 4 frames → **640×160 strip**; frame 0 CLOSED → 3 OPEN; **frame 0 must be pixel-identical across variants** | one-shot open/hold/close on paid serve; destination re-rolled per opening | `portal_glow.png` (base/void), `portal_glow_mountain/_forest/_dungeon.png` (destination variants — a new biome = one strip + one `DOOR_VARIANTS` entry), `portal.png` (static fallback) | **IN** — 320px on-screen (2×); bottom = `FLOOR_Y + 6` (art has 3px bottom padding ×2 scale) |
| Shop backdrop | 1280×720, **seam at y=462** | optional torch flicker later | `shop_bg.png` | **IN (WIP)** — iterating |
| Item icons (Club / Metal Helmet / HP Flask) | 64×64 | static | `club.png`, `metal_helmet.png`, `hp_flask.png` | **WIRED, art pending** — shelf cards show them at 32px (2:1; missing PNG hides itself) + canvas purchase float (32px, rises 46px, fades 900ms) |
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
`FLOOR_Y` = y=446). Authoring sizes: backdrop 1280×720 (wall 0→446, floor 446→720); counter ~480px
wide; mobs ~128×128 drawn at 88px; portal to the ~141×245 box.

---

## 10. Project structure & conventions

```
mob-mart/
├── index.html              <- entry: canvas + DOM panel containers, scale-to-fit wrapper
├── style.css               <- all DOM/panel styling (M4: + .workers-panel / .worker-card block)
├── PROJECT_HANDOFF.md      <- this doc (tracked; NOT shipped)
├── COMEDY_BIBLE.md         <- voice spec + line batch reference (tracked; NOT shipped)
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
│   ├── offline.js          <- timestamp-delta offline earnings    [M5 — not yet created]
│   ├── kongregate.js       <- isolated no-op bridge stub          [M6 — not yet created]
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
  `PROJECT_HANDOFF.md` + `COMEDY_BIBLE.md` are tracked but NOT shipped. Scratch tests (e.g.
  `test_m4.mjs`) are dev-only — not shipped.
- **Ship folder** = the folder holding `index.html` + `src/` + `style.css` + `assets/`. No build step.
- **Publish (primary): Kongregate** — manual upload via the Developer Portal. Bridge/loader at M6.
- **itch.io: undecided** (§13). If added, a `butler` push of the same ship folder.
- **Recover before diagnosing:** restore the last good build first, then debug.
- **Pre-flight before "Released":** clean load, no console errors, links + mobile check, DEBUG/log
  flags off, `node --check` on changed JS.

---

## 12. Current state & next steps

### Current state (read first)

Playable end-to-end: open the shop → mobs queue (capped FIFO, patience) → Serve the front one (brief
"Serving…" cooldown, then they leave to battle) → a funny result lands → gold + rep come in → restock,
buy upgrades. **All three upgrades live + rep-gated.** **M4 (auto-serve, committed): hire Bob from the
Workers tab for 50 gold; once hired he auto-serves the front of the line ~every 6s, using the same
serve path (payout / rep / log / cooldown / animation), sped up by Faster Counter — and rep-neutrally
waves off unaffordable front customers after 2s so they can't stall the line.** Comedy v2 is shipped
(148 lines; expanded dismiss/leave, Bob voice, genre tropes, seeded gags) with a **no-repeat picker**
(never the same line twice in a row per monster/tier pool). An **audit pass** fixed two real issues:
the save loader now clamps stock to the **effective** cap (upgrades merged before items — reloads no
longer eat Extra-Shelf stock), and the spawn fallback for a broken `wantWeights` is a real item id.
Progress auto-saves (`mobmart.save.v1`), survives reload; Reset clears it. Bob is animated (idle +
serving) with a WIP `shop_bg.png`; mob/portal sprites are still placeholders (art WIP). `node --check`
clean on every module; a **61-assertion** headless smoke test (`test_m4.mjs`, scratch — gitignored,
not shipped) passes, including regressions for both audit fixes.

### Next up

- **Commit the two pending passes** (retention, then icons — no file overlap; see checkpoints).
- **Author the item icons** — 64×64 PNG-32: `club.png`, `metal_helmet.png`, `hp_flask.png` in
  `assets/sprites/`. Everything is wired; cards and floats light up the moment the files drop.
- **Mob shadow-float (remaining art nit):** all three statics carry 15–18px dead padding below the
  feet, so mobs float ~11px above their shadows. Fix is art-side: trim the bottom rows in Aseprite
  (the spriteScale calibration shipped in the tuning-sweep era; padding trim is the other half).
- **Gobbo (recommended first content add):** one `monsters.js` entry auto-flows everywhere; comedy
  lever already defined (cocky over-promoter). Placeholder rect until art.
- **Customer mob art:** slime/bat/skeleton are the last placeholder rects standing (specs in §9).
- **Ladder rungs 2–3 (post-backroom):** restock worker (role reserved in workers.js; visual-home
  decision pending), then worker leveling.
- **Outstanding (non-blocking):** backdrop iteration (floor seam MEASURED at y=462 — supersedes the
  446 spec), itch.io dual-publish decision (§13), Bestiary tab stub, Kongregate submission pass
  (entry page `index.kongregate.html`; create the `loaded` stat; AI-use disclosure).

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
- **Background hook:** `scene.js` draws `shop_bg.png` with flat-color fallback at `FLOOR_Y` y=446.
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
- **M5 (BUILT — browser-confirm + commit pending):** offline earnings, Option 2 (gold + rep,
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
- **M6 (BUILT — browser-confirm + commit pending): the Kongregate bridge — MVP ROADMAP COMPLETE.**
  New `src/kongregate.js` (no-op bridge, verified against live Kongregate docs) +
  `index.kongregate.html` (index.html + one script tag) + one `initKongregate()` line in main.js.
  Suite grown to **88 assertions** (7 new: headless no-op, mocked-API activation, 'loaded' stat,
  submitStat forwarding, throwing-loader containment).
- **Retention pass (BUILT — commit pending):** greet gate (`workers.greetSec` 1.2; `frontWait` on
  customers; worker-only — manual ungated) + **Backroom Storage v2** (offlineReserve; the suite
  PROVED the planned +capHours effect inert — stock always binds — so the effect was rethemed to an
  offline inventory reserve with Daniel's approval; same costs/gate). offline.js sells live shelf
  first, then reserve at net margin; returns `reserveUsed`.
- **Item-icons pass (BUILT — commit pending):** shelf cards render `assets/sprites/<itemId>.png` at
  32px (onerror hides; text-only degrade) + canvas purchase float (`spawnItemFloat`, 32px, rise
  46px / fade 900ms, cap 8 alive, skips silently without art). Auto-path float reads the pre-update
  front item — reliable BECAUSE the greet gate forbids same-tick serve of a just-promoted customer.
  Suite at **104 assertions** (greet hold/release, manual ungated, backroom exact-math L0/L1/L3,
  live-only consumed, save clamp).
- **UI edge-frame (hybrid stage 1, BUILT — commit pending):** Daniel picked the HYBRID after a
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
- **Tuning sweep (BUILT — commit pending):** sink-side + pacing only, payouts untouched. All four
  upgrades `costGrowth` 1.8 -> **2.1**; `extra_shelf`/`better_signage` maxLevel 5 -> **7** (long-tail
  sinks); `faster_counter` max **stays 5** (the legibility cap); spawn 3 -> **2.6s**; patience 20 ->
  **24**; rep tiers 20/50/100 -> **25/75/200** (existing saves above 200 unaffected). Total buyout
  roughly ~6.9k -> ~10.6k+ gold. All provisional pending feel-check.
- **Mob calibration (BUILT — commit pending):** optional per-monster `spriteScale` in monsters.js
  (slime/skeleton 1.15, bat omitted = 1.0 reference), multiplied into drawMob guarded `?? 1` —
  data-driven, future mobs need nothing. Suite still 104 (one tier assertion updated to Beloved 200).
- **Speech bubble (hybrid stage 2, INFO-ONLY variant — BUILT, commit pending):** canvas bubble above
  the front mob: gold name, "wants <item> ◆ <budget>", plus an alert line for the mob's dilemma
  ("out of stock!" / "can't afford it!", computed inline — render stays free of game imports). Width
  measured from text per frame; tail bobs in phase with the mob; clamped to stage edges; `BUBBLE`
  dial block in scene.js (fonts mirror --font). Serve/Send Away STAY as DOM buttons (full-bubble
  variant with canvas hit-targets deliberately not built). Gold front-chevron RETIRED (bubble does
  its job); customer panel slimmed to name + line count (want/budget live in the bubble). Known
  cosmetic: a purchase float crosses the bubble for ~0.9s on serve — deliberate. Uses
  ctx.roundRect (Chrome 99+/FF 112+; fine for Kongregate's browser floor).
- **Attention system (BUILT — commit pending; Daniel: "assume users WILL miss things"):** the
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
- **Door destinations (BUILT — commit pending):** three variant strips (mountain/forest/dungeon —
  identical door, different world through the opening) rolled per PAID serve in `playPortalOpen`
  via `pickDoorVariant` (picks only among LOADED strips; anti-repeat re-draw like the log picker;
  none loaded -> base void strip). `DOOR_VARIANTS` list in scene.js; 3 loadSprite lines in main.js.
  Upgrade path noted: variants can later gain per-monster weights (destination-as-characterization).

---

## 13. Open questions / pending decisions

- **itch.io dual-publish: yes or Kongregate-only?** Decides whether the `butler` deploy path is added.
- **Repo:** `github.com/Cupcakechan/mob-mart` (local folder `mob-mart`).
- **Offline earning model — DECIDED (M5):** worker-only, no drip. Bob is hireable within minutes, so
  a no-worker drip had a negligible window; revisit only if a rebalance moves `hireCost` far up.
- **Restock worker visual home:** DOM-only avatar vs canvas backroom/shelf prop vs beside Bob (decide
  when a second/restock worker is on the table).
- **Special "visits"** design (high-rep rare customers) — deferred.
