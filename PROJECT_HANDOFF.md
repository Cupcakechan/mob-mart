# Mob Mart — PROJECT_HANDOFF.md

*Living source of truth. Read this in full (together with the code) at the start of every
session before doing any work. Update it as decisions change. Kept self-contained so a fresh
Claude or ChatGPT can parse it cold.*

**Status:** M1 (vertical slice) built and logic-tested; awaiting in-browser confirmation.
**Next action:** test M1 in the browser (Live Server). On confirmation: git checkpoint, then M2.
**Last updated:** M1 scaffold delivered.

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
  numbers (DOM's strength), and idle games live on UI clarity. Building the battle log / upgrade
  lists on canvas would be the slowest, least-maintainable path for the surfaces that change most.
- **Fixed internal stage 1280×720** inside a **scale-to-fit** wrapper that scales the canvas and
  the DOM overlay *together*, so the two layers can't drift. *Why:* one coordinate model, matches
  the asset-scale plan, and drops cleanly into Kongregate's iframe (comfortably under ~1100×700
  once letterboxed).
- **View / perspective — PixelLab "low top-down" (~20°), front-facing.** *Why:* the shallow angle
  keeps the cute mob faces readable while grounding everyone on a floor plane for diorama depth;
  it matches the mockup and the mimic prototype (both front-on, not profile). Characters use a
  **single facing** (forward, toward the counter) — no rotation sets. Walk/shuffle is a
  forward-facing sideways hop as the queue advances. **Author the whole scene at the same low
  top-down** (characters, props, backdrop) — mismatched perspective is the classic "off" tell.
- **Kongregate is the PRIMARY (and possibly only) publish target.** itch.io is undecided (see §13).
  Regardless, we keep the **isolated no-op Kongregate bridge** discipline from the start: the
  Kongregate API is wrapped in one module (`src/kongregate.js`) that no-ops when the API isn't
  present, so local/itch builds stay dependency-free and the bridge can't break other builds.
  This also means we need the no-op path just to run locally.
- **Save:** `localStorage`, namespaced + versioned key **`mobmart.save.v1`**, every field
  default-filled on load (old saves stay forward-compatible), load wrapped in try/catch →
  fresh save on parse failure.
- **Folder layout uses `src/` + root `style.css` + `assets/`** (not the generic `js/` + `css/`).
  *Why:* this matches the Kongregate packaging script's expected paths, so dual-publish packaging
  is frictionless later; Kongregate is primary.
- **Internal slug `mobmart`** for the save namespace and asset/folder naming, **decoupled from the
  display name** "Mob Mart" — a future rename never touches internal IDs.

---

## 3. Core loop & state flow

**Screen state machine:** `Boot/Load → (minimal Title) → Shop`. The bottom-nav items
(Shop / Workers / Upgrades / Bestiary) are **tabs/panels inside the Shop state**, not separate
game states. Overlays: `OfflineEarnings` modal on return, `Settings`.

**Update loop:** a fixed-timestep accumulator driven by `requestAnimationFrame` with delta time
— deliberately **not** `setInterval`-per-generator (that throttles in background tabs, batches
increments, and drifts). One master `update(dt)` advances the spawn timer, patience countdowns,
worker auto-serve timers, and animation state; then `render()` draws the canvas and syncs only the
DOM that changed. **Offline is the same math** applied once over the elapsed real-time delta on
load, capped.

**Transaction flow (the loop):**

```
spawn timer fires -> pick monster type (weighted) -> roll wanted item + budget + patience
      -> enqueue -> advance to counter (Current Customer)
      -> [player clicks SERVE  OR  worker auto-serves on its interval]
            -> in stock?  AND  budget >= item price?
               |-- YES -> decrement stock, add gold, mark served, monster walks to portal
               |          -> resolve combat (monster mod + item effect + difficulty + rng -> tier)
               |          -> append funny log line, apply rep delta (crowns), (rare) excellent bonus
               |          -> monster exits; next customer advances
               '-- NO  -> lost sale (out of stock / can't afford)
                          -> patience keeps ticking; hits 0 -> monster leaves unhappy
                             (minor rep ding, always recoverable — never a hard fail)
      -> spend gold: restock items | buy upgrades | hire/level a mimic worker
      -> repeat
on quit   -> store lastSeenTimestamp + state
on return -> elapsed = now - lastSeen (capped) -> estimate sales
             = avg sale rate x available stock x worker throughput x shop level
             -> award gold/rep -> show "While you were away" modal
```

---

## 4. Data model

Everything content-facing is a **data-driven registry**, not a subclass, so a new
monster/item/upgrade auto-flows through spawns, menus, and icons with no extra wiring. Asset
filenames match the `id` (lowercase; hosts are case-sensitive). Every optional field is read with
a fallback (`?? default`) so a missing field never `NaN`s or crashes an existing entry.

**Monster registry** (`src/data/monsters.js`) — one entry per customer type:
`id` (stable) · `displayName` · `spriteId` · `budgetRange` [min,max] gold · `patience` (seconds in
queue) · `wantWeights` (weighting over item categories/ids they tend to want) · `combatMod`
(modifier into the resolver) · `baseRep` (optional).

**Customer instance** (runtime, spawned from a monster type):
`monsterId` · `wantedItemId` (rolled from `wantWeights`) · `budget` (rolled from `budgetRange`) ·
`patienceRemaining` · `state` (queued / atCounter / served / leaving).

**Item registry** (`src/data/items.js`):
`id` · `displayName` · `iconId` · `category` (weapon / armor / consumable, used for want-matching) ·
`basePrice` (what the monster pays) · `restockCost` · `stock` (runtime, seeded) · `maxStock`
(bounded by shelf upgrades — a bounding constant) · `combatEffect` (modifier into the resolver) ·
`monsterCompatibility` (optional; start absent, guarded).

**Upgrade registry** (`src/data/upgrades.js`):
`id` · `displayName` · `iconId` · `description` · `cost` (base + growth factor, centralized) ·
`maxLevel` · `currentLevel` (runtime) · `effect` — a **typed** effect the systems read, e.g.
`{type:'maxStock', delta:+1}`, `{type:'serveSpeed', mult:0.85}`, `{type:'repGain', mult:1.1}`,
`{type:'offlineCap', deltaHours:+2}`. Systems query the **sum of active effects** rather than
hard-coding each upgrade, so new upgrades slot in for free.

**Worker registry** (`src/data/workers.js`) — first entry is the mimic merchant "Bob":
`id` (`mimic_merchant`) · `displayName` ("Bob") · `spriteId` · `role` (serve / restock — start with
serve) · `baseInterval` (seconds per auto-action) · `hireCost` · `level` + `upgradeCost` (optional;
the mockup's "Lv 2, +25% Sell Price" fits here later).

**Combat resolver** (`src/combat.js`) — the off-screen result:
`resultScore = itemEffect + monster.combatMod − encounterDifficulty + rng(−spread..+spread)`,
mapped to a `resultTier` enum: `excellent` (rare) · `success` · `partial` · `failure` ·
`funnyFailure`. Each tier → a `repDelta` (crowns) and a `messageTemplate` pulled from the
**results-message registry** (`src/data/results.js`) keyed by (monsterId?, itemId?, tier) with
**graceful fallback** to a generic tier line — so a new monster/item degrades to a generic funny
message, never a missing-string crash. Gold comes from the **sale** (monster pays `basePrice` at
purchase); the tier affects **reputation + the flavor line** (and, later, a small gold tip on
`excellent`).

**Save schema** (`src/save.js`, `mobmart.save.v1`):
`{version, gold, reputation, items:{id:{stock,upgradeLevel}}, upgrades:{id:level},
workers:{id:{owned,level}}, lastSeenTimestamp}`. Every field default-filled on load;
load wrapped in try/catch → fresh save on failure. `lastSeenTimestamp` drives offline earnings.
A `scrap` field is **reserved but unused** until we decide to add the third resource (§7).

---

## 5. Content & suggested starting values

All numbers below are **suggested starting values** and live as named constants in
`src/config.js` — balancing is a one-value change. Prices/stock mirror the mockup.

**Starter customers (3):**

| id | display | combatMod | budgetRange | notes |
|---|---|---|---|---|
| `slime` | Slimey | −2 (squishy) | 10–20 | dim but sweet blob |
| `bat` | Batty | −1 (fragile flyer) | 12–22 | nervous, flighty |
| `skeleton` | Skele | +1 (already dead, hard to discourage) | 12–24 | brittle, rattly |

Roster (not MVP): `goblin` (Gobbo), `rat` — first content additions after the loop is fun.

**Starter items (3):**

| id | display | category | basePrice | restockCost | startStock | maxStock | combatEffect |
|---|---|---|---|---|---|---|---|
| `club` | Club | weapon | 12 | 6 | 3 | 5 | +6 (offense) |
| `metal_helmet` | Metal Helmet | armor | 18 | 9 | 2 | 5 | +5 (survivability) |
| `hp_flask` | HP Flask | consumable | 15 | 8 | 4 | 5 | +4 (sustain) |

**First worker:** `mimic_merchant` — display "Bob", role serve, `baseInterval` ~6s, `hireCost` ~50.

**Suggested upgrades (M3):** `extra_shelf` (+1 maxStock), `faster_counter` (serve speed ×0.85),
`better_signage` (repGain ×1.1), `backroom_storage` (offlineCap +2h), `hire_goblin` → becomes
**"hire mimic worker"** (unlock/discount a second worker).

**Combat tuning (M1 start):** `encounterDifficulty` 10, `rng spread` ±6, tier thresholds:
score ≥ 8 → excellent; 2..7 → success; −1..1 → partial; −6..−2 → failure; ≤ −7 → funnyFailure.
Rep (crowns) per tier: excellent +5, success +2, partial +1, failure −1, funnyFailure −2.

**Reputation tiers (example labels, tunable):** Neutral 0 · Friendly 20 · Trusted 50 · Beloved 100.
For MVP, reputation is a **tier-unlock gate** (thresholds unlock item/monster/upgrade tiers).
**Later:** high rep triggers special "visits" (rare customer events) — no schema change needed;
a "visit" is just a special customer instance gated behind a rep threshold.

**Economy start:** starting gold ~40 (enough to restock once or twice; the mockup's 126 is
mid-game). Starting reputation 0.

**Battle-log voice (writer reference — keep it short, cozy, a little pathetic):**
- "Slimey survived! Dealt 1 damage. So brave."
- "Batty bought a Metal Helmet. Survived the arrow. Not the wall."
- "Skele faceplanted. Bonus: Embarrassment."
- "Gobbo bought a Club. Bonked a Squire and immediately promoted himself." *(roster)*

---

## 6. Milestone plan

Each milestone is a **single-purpose, individually tested, individually committed** pass. Sprites
swap in continuously — every mechanic is built on placeholder rects first, then dressed once it
plays right (the ID+filename convention + graceful fallback means art never touches game logic).

- **M1 — "The loop breathes."** One customer at a time, manual serve, funny battle result, gold in.
  *In:* fixed stage + scale-to-fit shell; canvas diorama with **placeholder rects** (counter block,
  portal block, one customer slot); DOM panels (top bar = **Gold only**, Current Customer card,
  three item cards, **Serve** button, Battle Results log); registries for the 3 items, 3 monsters,
  results templates; spawn one customer at a time (no full queue yet); manual serve → stock/afford
  check → pay → combat resolve → log line → next customer; a lenient patience timeout that clears a
  stuck customer (never a hard fail); restock buttons; the `config.js` constants. *Out (M1):* save,
  worker, offline, upgrades. (Reputation is tracked internally and shown as **per-line crowns** in
  the log for payoff; the cumulative Reputation HUD stat + rep-gated unlocks arrive in M2.)
  **Success test:** load page → a mob appears wanting an item → click Serve → gold rises → a funny
  line lands → next mob appears; restock when stock hits 0.
- **M2 — Persistence + full queue + reputation.** `localStorage` (versioned), the multi-slot queue
  with patience, reputation accumulating from combat outcomes + tier labels.
- **M3 — Upgrades + spend economy.** Extra Shelf / Faster Counter / Better Signage as data-driven
  upgrades feeding a real gold sink.
- **M4 — First mimic worker (auto-serve).** Bob auto-serves on an interval — the automation/idle
  proof; the shop earns without clicking.
- **M5 — Offline earnings.** Timestamp delta → capped estimate → "While you were away" modal.
- **M6 — Kongregate no-op bridge stub + one `loaded` stat.** Purely additive; can't break
  local/itch. This is the "architecture that supports Kongregate stats later" line, done as its own
  isolated pass.

---

## 7. Scope guardrails — explicitly OUT of the MVP

Deferred (each is a scope-trap magnet; several appear in the mockup):
- **Scrap (third resource)** — mockup shows ⚙ +1/m; a second economy before the first loop is fun
  doubles balancing. Data slot reserved only.
- **"Today's Goal" daily-quest hook** — nice retention later; not loop-critical.
- **Bestiary panel** — nav tab can exist as a stub; content is post-MVP.
- **Worker leveling** (the mockup's "Lv 2, +25%") — hire first, level later.
- **Special "visits"** (high-rep rare customers) — later; no schema change when added.
- **Prestige / reset** — the loop must be fun for one run first. Don't fight a future prestige in
  the schema, but don't build it.
- **Free furniture placement, multiple rooms, large monster roster, complex crafting, real-time
  combat, PvP, multiplayer, external accounts** — all out (per the brief).

---

## 8. Risks & scope traps (watch-list)

1. **Scrap creeping into MVP** → defer; reserve a data slot.
2. **Punishing fail economy (the Recettear trap)** — good shop games reward attention without
   punishing exploration → no rent/debt/hard-fail; a bad visit costs a sale + minor rep, always
   recoverable.
3. **Auto-resolution with no feedback (the Shop Titans trap)** — the funny log IS the payoff →
   make it land in M1 before anything else.
4. **Canvas-UI overreach** → hybrid (Option C); panels stay in DOM.
5. **`setInterval`-per-generator timing** → single delta-time accumulator; offline = same math.
6. **Save/offline exploit + corruption** → cap offline; clamp negative/absurd deltas; version +
   default-fill; try/catch load → fresh save.
7. **Premature prestige** → out of MVP.
8. **Content-as-subclasses** → registries + typed effects.
9. **Over-designing the want/compatibility matrix** → category match + light weights; guard
   optional fields.
10. **Kongregate bolted in mid-code** → isolated no-op bridge as its own pass; local/itch stay
    dependency-free. Submission needs an **English description + in-game English option** and a
    **public AI-use disclosure** (AI-assisted); re-verify live submission rules at submission time.

---

## 9. Asset specs (Daniel authors all assets)

Stage **1280×720**; everything **PNG-32 (RGBA)**; filenames **lowercase, matching the data `id`**.
**Perspective: PixelLab low top-down (~20°), front-facing, single facing.** Author characters,
props, and backdrop at the same angle. Placeholders-first: M1 ships on flat rects at these exact
slot sizes; PNGs drop into the same slots later (missing image → placeholder, never a crash).

| Asset | PixelLab tool | Target size | Animations (suggested frames) | Filenames |
|---|---|---|---|---|
| Slime / Bat / Skeleton (customers) | `create_character`, forward-facing | 128×128 | idle 2–4 · shuffle 4–6 (forward-facing sideways hop) · react/buy 3–4 (one-shot) | `slime_idle.png`, `slime_shuffle.png`, `slime_react.png` (same for `bat_`, `skeleton_`) |
| Bob (mimic merchant / worker) | `create_character`, facing customers | 128×128 (or 160×160) | idle 2–4 · serve/restock 4–6 | `mimic_merchant_idle.png`, `mimic_merchant_serve.png` |
| Club / Metal Helmet / HP Flask | `create_map_object` | 64×64 | static | `club.png`, `metal_helmet.png`, `hp_flask.png` |
| "To Battle" portal/door | object + short glow loop | ~256×384 | glow/open 4–8 (loop) | `portal_glow.png` (strip) |
| Shop environment (walls, shelves, torches, clutter) | backdrop **or** modular props | 1280×720 backdrop, or 128–256 props | optional torch flicker 2–4 | `shop_bg.png` or per-prop |
| UI icons (gold, reputation crown, scrap-reserved) | small object | 32×32 | static | `icon_gold.png`, `icon_rep.png`, `icon_scrap.png` |
| Panel / button chrome | mostly CSS (DOM panels) | — | — | few image assets needed; CSS-styled |

Notes: author Bob as a full character; the counter prop occludes his lower body. Sheet layout:
one horizontal strip per animation at slot width (e.g. `slime_shuffle.png` = 6×128 = 768×128) so
canvas slicing is `frameIndex × 128`; static prop = `<id>.png`, animation = `<id>_<anim>.png`. The
Aseprite fitting pass sets exact size and aligns every customer's baseline to the same floor line.
Item icons are the one exception to the perspective rule — they live mostly in DOM item cards, so a
clean front/slightly-angled icon is fine.

---

## 10. Project structure & conventions

```
mob-mart/
├── index.html              <- entry: canvas + DOM panel containers, scale-to-fit wrapper
├── style.css               <- all DOM/panel styling + layout + scaling
├── PROJECT_HANDOFF.md      <- this doc (tracked in git; NOT shipped in the build)
├── .gitignore
├── src/
│   ├── main.js             <- entry point + game loop (rAF, fixed-timestep accumulator)   [M1]
│   ├── config.js           <- ALL tunable constants (one place to balance)                [M1]
│   ├── state.js            <- screen state machine + the shared game-state object          [M1]
│   ├── game.js             <- core loop: spawn -> serve -> transaction -> tick             [M1]
│   ├── combat.js           <- off-screen combat resolver -> result tier                    [M1]
│   ├── utils.js            <- seeded rng, clamp, number formatting                         [M1]
│   ├── save.js             <- localStorage load/save (versioned, default-fill, try/catch)  [M2]
│   ├── offline.js          <- timestamp-delta offline earnings (capped)                    [M5]
│   ├── kongregate.js       <- isolated no-op bridge stub                                   [M6]
│   ├── data/
│   │   ├── monsters.js     <- customer registry (Slime, Bat, Skeleton; Goblin/Rat later)   [M1]
│   │   ├── items.js        <- item registry (Club, Metal Helmet, HP Flask)                 [M1]
│   │   ├── results.js      <- combat result-message templates (+ fallback)                 [M1]
│   │   ├── upgrades.js     <- upgrade registry                                             [M3]
│   │   └── workers.js      <- worker registry (mimic_merchant "Bob")                       [M4]
│   ├── render/
│   │   ├── scene.js        <- canvas diorama (placeholder rects -> sprites)                [M1]
│   │   └── sprites.js      <- asset load + graceful fallback                          [first art]
│   └── ui/
│       ├── hud.js          <- top resource bar                                             [M1]
│       ├── panels.js       <- DOM panels (customer, workers, upgrades, log)                [M1]
│       └── nav.js          <- bottom nav tab switching                                     [M3]
└── assets/
    ├── sprites/            <- character + prop PNGs (filenames match data ids)
    ├── ui/                 <- UI icons (icon_gold.png, icon_rep.png, ...)
    └── audio/             <- sfx (later)
```

**[Mn]** tags show which milestone first creates each file — we don't create empty stubs early.

**Conventions:** one responsibility per file, small focused functions, comment the *why*. All
tunable numbers are named constants in `config.js`. Keep visual parameters separate from
logic parameters. Data-driven by ID; new content auto-flows through systems. Graceful fallback
everywhere (missing asset → placeholder/silence, never a crash). Namespace + version persistence
keys; default missing save fields on load. Keep secrets/server-only logic off the client (n/a for
now — fully local).

---

## 11. Git & deploy

- **Git from day one.** Small commits after each tested milestone; specific, feature-named
  messages. Daniel owns commit/ship timing — Claude proposes commands, never commits.
- **`.gitignore`** excludes build/packaging output (`builds/`), dependencies/caches
  (`node_modules/`), editor/IDE files (`.vscode/`, `.idea/`), and OS cruft (`.DS_Store`,
  `Thumbs.db`). `PROJECT_HANDOFF.md` is **tracked** but **not shipped** (the packaging step stages
  only `src/`, `style.css`, `assets/`).
- **Ship folder** = the folder holding `index.html` + `src/` + `style.css` + `assets/`. No build
  step; the source files are the deliverable. Never commit build output.
- **Publish (primary): Kongregate** — manual upload via the Developer Portal (two slots: Game Files
  = the entry `index.html` alone; Other Files = a root-level zip of `style.css` + `src/` + `assets/`
  with `index.html` excluded and forward-slash entries). Bridge/loader added at M6 (loading-strategy
  C: an `index.kongregate.html` = base index + one API `<script>` line).
- **itch.io: undecided** (see §13). If added, it's a `butler` push of the same ship folder; the
  isolated bridge keeps that build dependency-free.
- **Recover before diagnosing:** if a bad build goes live, restore the last good build first
  (re-upload / re-push), then debug.
- **Pre-flight before any "Released" flip:** clean load, no console errors, links + a mobile check
  pass, DEBUG/log flags off, `node --check` on changed JS.

---

## 12. Current state & next steps

- **Done:** research; MVP scoped; UI architecture locked (Hybrid / Option C); view locked (low
  top-down); premise finalized (mimic merchant, Bob replaces Grez); starter trio (Slime / Bat /
  Skeleton); design doc + `.gitignore`; GitHub repo created (`Cupcakechan/mob-mart`); **M1 vertical
  slice built** (`index.html`, `style.css`, the M1 `src/` modules) and **logic-tested** (`node
  --check` clean on all modules + an 8-case headless smoke test of the loop).
- **Next:** Daniel tests M1 in the browser (Live Server). On confirmation → git checkpoint (first
  commit + push), then **M2** (localStorage save + full queue + reputation HUD stat/unlocks).

---

## 13. Open questions / pending decisions

- **itch.io dual-publish: yes or Kongregate-only?** Doesn't block M1 (the bridge discipline covers
  both), but decides whether we add the `butler` deploy path later.
- **Repo:** created at `github.com/Cupcakechan/mob-mart` (local folder `mob-mart`).
- **Special "visits"** design (high-rep rare customers) — deferred; revisit after the base loop.
