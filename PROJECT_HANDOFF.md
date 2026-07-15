# Mob Mart — PROJECT_HANDOFF.md

Repo: https://github.com/Cupcakechan/mob-mart

*Living source of truth. Read this in full (together with the code) at the start of every
session before doing any work. Update it as decisions change. Kept self-contained so a fresh
Claude or ChatGPT can parse it cold.*

---

## §0 — START HERE (cold boot): where the project is, and what happens next

**State as of 2026-07-14, end of the DOUG LEVELING + SIM INSTRUMENT session (suite: 1797 green
at tip `8fe8012`; `node test_suite.mjs` self-verifies a fresh clone):** the MVP, the full UX roadmap,
Market Day, Deep Sinks, Special Visits (the Inspector, reauthored 1:1), the gear expansion
(27 items), six door destinations, the whole of **§14** (DOUG, SCRAP, the RELIC FORGE), **THE
ECONOMY AUDIT** (`sim_economy.mjs` + `ECONOMY_AUDIT.md`), **THE RETENTION RESET**
(`TRADE_MARKET_DESIGN.md` + `RETENTION_RESEARCH.md`), **MARKET PASS A**, **THE DROP-RATE
RETUNE**, **REFORM STEP 3** (DEMMY + LEGGSY — roster nine, faucets eight), **EXPEDITIONS MVP**
(step 4), **MARKET PASS B** (the ten-item trade tier; the Inspector's Scale/Seal drops), **THE
MARKET ARC** (2026-07-12, five passes — the overlay D6-B, the daily special, the sale sign,
the LED ticker + riders, Greg gold-only), **REFORM STEP 5 — THE RELIC REWORK** (51e2ec3 — the
HARD-restore table incl. one Seal each, the four gag effects, the Seal SLOPE, and the
**BINDING PRESTIGE LAW**: relics carry over; verdicts 3× bit-identical aware +34%/+29%, median
death 96:00 quantized to inspection days — its dated section below), **REFORM STEP 6 —
COMMISSIONS** (a5e6836, suite 1652 — the NAMED CLIENT: day-seeded deterministic orders against
market-day deadlines, live-derived premium terms, zero-penalty lapse), **the Market Day HUD
chip RETIREMENT** (18be9de, suite 1656 — board/forecast/ticker carry the market; F4 is the
chip's designed successor), and now **F1a — FAME LEVELS** (c10810b, suite 1667 — the FAME &
DEMAND REFORM's first pass): fame is a generated LEVEL track (`levelThreshold(n)`, base 25 ×
growth 1.6), the seven names survive as RUNGS anchored at levels with mins DERIVED from the
curve at load, the HUD badge reads "«Rung» · Lv N", and offline sales pay HALF fame
(`repFraction: 0.5` — gold untouched), **HARNESS-CERTIFIED 2026-07-12** (3× bit-identical via
the detached-run pattern; ~4.5 min wall per full run): market-blind **PASS +48%**,
expedition-blind **PASS +25%**, commission-blind **PASS +3.5%** (thin — certification finding
(i) in the NEXT block), median desire-death 96:00 (spread 72–120h), median death fame 636k =
**LEVEL 22** by the live curve — the design's ≈L23 calibration HELD. Built in a session that
died mid-certification and recovered from its delivery zip — the two 2026-07-12 sections at
the bottom carry both stories, and LESSONS.md gained six entries across the arc. And now **F2 — DEMAND HONESTY**
(e71beef, 2026-07-13, suite 1678 — arc pass two): the want-pick's item stage rides
`supplyWantWeight` — trade-tier asks weigh **stocked 1 / known 0.7 / unknown 0.4**
(CONFIG.queue.supplyWantBias), the ROSTER RULE is suite-enforced (§73: every trade-bearing
category keeps a gold sibling), and the sim gained the OOS-front + trade-share acceptance
metrics. Certified 3× bit-identical at the Option B dials: market-blind **+12%**, exp-blind
**+28%**, comm-blind **+6.0%** — all PASS — with THE finding of the arc: the first-cut dials
(0.4/0.15) flipped market-blind to −20%, proving the old +48% edge was mostly the
mispriced-scarcity TAX on non-participants; **+12% is the market's honest rate margin**, and
its completion bite is now the bigger tooth (blind deaths stretch to 144h/96h/cap-censored vs
the aware arc's 72:00 FLAT across all five seeds). OOS-front fell from a median 63% of each
run to ~51.5%. The 2026-07-13 dated section carries the whole story, including the two-round
shape (first cut failed the law; Option B restored it). And **F3 — SCARCITY TEETH** (7db7c21,
2026-07-13, suite 1693 — arc pass three, Option 1 of the RE-SCOPED round): the leave penalty
scales with the shop's rung — `leavePenaltyOf` = leavePenalty + leavePenaltyPerTier × tier
index (1 at Neutral → 5 at Renowned → 7 at Mythic), charged to SPENDABLE fame only (the perk
budget); **the lifetime track never falls** (suite-pinned through the real leave path in §74),
and auto-wave/dismissal stay penalty-free. The fiction-first option turned out to carry real
weight: the drain compounds through PERK TIMING (every blind bot leaks more goodwill than the
full player), widening every margin — market-blind **+21%**, exp-blind **+36%**, comm-blind
**+12.4%**, all 3× bit-identical. And **F4 — DEMAND SURFACE** (319083a, 2026-07-13, suite
1714 — arc pass four, the LAST): the market board's third chalk row names today's demand event
(`boardEventLine` → "HOT TODAY: Armor"), and the market overlay echoes it WITH the number
("Porcupine Migration · Armor +50%") — the sale-sign doctrine pair (the board advertises, the
overlay informs), closing the discovery gap the HUD chip's retirement left. A pure presentation
pass: its sim stdout came back BYTE-IDENTICAL to the F3 baseline (proof it moved no economy
path — the right certification for a display change). **THE FAME & DEMAND REFORM ARC IS
COMPLETE** (F1a→F4); the queue is now the parked (g)/(h) items, B1 first. **SUPERSEDED
2026-07-14:** B1 shipped (97a540f) and Doug leveling shipped + certified (b9ac048), closing the
queue's head. The live queue is the **HUD / BESTIARY UI ROUND** — see the NEXT block below.

**A follow-up TEXT PASS (635c574, 2026-07-13, suite 1716):** the board demand row reads "HOT
TODAY: «shelf»" (Daniel's read — "tip" was the internal mechanic word, broken English on the
sign), and the unhired Workers cards now show an authored IN-VOICE `pitch` per worker (Bob the
warm concierge, Greg the blunt gargoyle, Doug the good-bits gremlin) — fixing a real bug where
unhired Doug read "Restocks automatically" (panels.js's old role-ternary; the `pitch` field is
data-driven with a role fallback + a regression pin). Browser-confirmed.

**THE DESIGN RESET (Daniel, 2026-07-10) — MEASURED by the audit (2026-07-11):** passive play
reaches millions with nothing left to want. The sink stack is **228,483 gold** exactly; the
desire curve **dies at 8:18:03** of continuous idle play, then the shop earns **~53k gold/hour
forever** (the observed 6.4× purse ≈ 27.6h of post-death play); **variety dies at ~1h50m** —
the last 77% of the curve is the two training ladders alternating. Early game measured
healthy. The instrument is permanent: **`sim_economy.mjs`** (repo root — seconds to run,
bit-identical); findings F1–F7 + proposals P1–P6 in **`ECONOMY_AUDIT.md`**; detail in the two
2026-07-11 sections at the bottom.

**THE RETENTION RESET (Daniel, 2026-07-11) — supersedes the 2026-07-10 sequence.** Root cause,
Daniel's: **gold is a universal solvent** — every faucet pours gold, every sink accepts it,
and stock is gold in another shape (instant unlimited restock), so "strategy" collapses to a
timer and the greedy bot plays optimally. The reform is his TRADING model: monster-identity
MATERIALS (one per family; independent faucets — serves, targeted expeditions, Doug, VIP
visits) and a DAILY-ROTATING TRADE MARKET on the reworked Special board, where trade-tier
stock costs materials + gold at rates that change every day ("there is no crafting, only
trading" — Bob is a mimic-MERCHANT). Evidence base: **`RETENTION_RESEARCH.md`** (the ranked
genre framework — exclusive decisions first, new verbs, rule-changing prestige). The locked
direction, the economy LAWS (no gold↔material conversion EVER; caps; seeded + eligible +
forecast market; materials off the HUD; split loops / nobody dies), every system sketch, and
the disposition of all prior proposals live in **`TRADE_MARKET_DESIGN.md`** — read it together
with this §0.

**The locked sequence (one system per pass; §14's A/B split where a pass is big):**
1. **Market Pass A** — **DONE 2026-07-11**; 2. **Market Pass B** — **DONE 2026-07-12** (the
full tier + forecast + Inspector drops + the iconic filtered list; the Pass B section at the
bottom); 3. **Spider + Demon** — **DONE 2026-07-11**; 4. **Expeditions MVP** — **DONE
2026-07-11**; 5. **Relic rework** — **DONE 2026-07-12** (51e2ec3); 6. **Commissions** —
**DONE 2026-07-12** (a5e6836, the NAMED CLIENT); **then the FAME & DEMAND REFORM ARC**
(`FAME_ECONOMY_DESIGN.md` §3 — the arc's home): **F1a fame levels — DONE 2026-07-12**
(c10810b, harness-certified same day) → **F2 demand honesty — DONE 2026-07-13** (e71beef,
Option 1 + the Option B dial retune, all laws PASS) → **F3 scarcity teeth — DONE 2026-07-13**
(7db7c21, the re-scoped Option 1: tier-scaled leave penalty on spendable fame; margins widened
to +21/+36/+12.4; the auto-wave/dismissal economics review CLOSED with it — both stay free by
law and by pin) → **F4 demand surface — DONE 2026-07-13** (319083a, Option 1: board's demand
chalk row + overlay echo, sale-sign doctrine pair; economy byte-identical to F3). **← THE ARC
IS COMPLETE (F1a→F4).** 7. **Expedition depth** (parties, offline party management); 8. **Franchise**
(rule-changing prestige, six-door factions — designed last, against what the harness measures
then; **F1b — prestige spends fame — ships WITH it**, design already in the doc's §5).

**COMMISSION B1: HARD RESERVE — DONE 2026-07-14 (97a540f, suite 1746, 3× bit-identical
`7864f924…`).** A pending order hard-reserves its `count` units: `reservedFor(state,itemId)` =
min(count, stock) when the order names that item, and `sellableStock` = stock − reserved is the
single source of truth for "how many units may leave the counter." Sellable gates the serve path,
the bulk-buyer double-sale, leave-theft, AND offline (Bob won't sell held units while you're away);
raw stock still drives shelf-room, fulfillment (consumes the reserve), the inspection grade (held
units physically sit on the shelf), and the "Stock: N/max" display. A distinct `'reserved'` serve-
block reason ("Held for order") sits between out-of-stock and cant-afford. Awareness bundle: the
shelf card shows "N held for [client]" (green), the Market overlay row shows "N held from the
counter", plus the serve-button label. `CONFIG.commission.hardReserve` (?? true) is the kill switch.
No new persisted state (the reserve derives from the saved order). New suite **§76** (30 pins — exact
totals live here now).

**THE F2 DECISION WAS REVERSED BY THE SIM (2026-07-14) — a real finding, recorded.** The parked
spec's delegated call was to COUPLE F2 to the reserve (a fully-reserved shelf reads UNSTOCKED for
demand, steering walk-ins off the held item, to prevent a dead queue). Built that way first; it was
WRONG. The acceptance sim (kill-switch-off counterfactual reproduced HEAD's +21/+36/+12.4 exactly)
showed the coupling COLLAPSED all three margins → market-blind **+21%→0% (WEAK)**, exp-blind 36→15,
comm-blind **+12.4%→−1.83% (FLAT)**. Mechanism (verified against the sim code, NOT assumed): the bot
stocks demand-BLIND (`restockAll` + trade-everything), so the loss is not a restock artifact —
coupling concentrates walk-in demand onto the cheap gold shelves, which drain faster than the 1s
restock (serving runs at 0.1s) → OOS-front 50.9→58.6 while the pricey reserved stock sits idle. And
the dead-queue the coupling was meant to prevent is a NON-ISSUE either way (0.02–0.05% of run time).
**Decoupling F2 — demand reads PHYSICAL stock; the reserve gates only who may BUY — recovered every
margin to PASS** (+15/+26/+10.8) and is the cleaner model. §76(d) now GUARDS against re-coupling.
Two accepted costs of the shipped decoupled form: (1) a walk-in on a fully-held shelf gets a legible
"Held for order" block instead of being steered away (0.02% of queue time); (2) sim seed 4 runs to
the 168h cap one want short (73/74 — soft, deterministic, separable from B1).

**KNOWN LIMIT OF THE ACCEPTANCE SIM (record for future economy passes):** the greedy bot fulfills
orders the instant it can, so it never experiences the walk-in DRAIN that B1 exists to prevent — the
harness can only ever see B1's COST, never its benefit. A future sim enhancement (bot stocks toward
an order, walk-ins eat it before the deadline, measure fulfillment success with/without the reserve)
is the only thing that would measure B1's worth directly; not built. Two vetoable scope decisions
baked into B1, each a one-line revert: the reserve covers OFFLINE and LEAVE-THEFT, not just the live
counter.

**THE HUD / BESTIARY UI ROUND — BOTH PASSES DONE (2026-07-15).** Details in the dated section at
the bottom. In short: **(1)** the Scrap/Menu overlap is fixed (`6c0e74c`) — the next-LEVEL remainder
moved out of the HUD into the Fame panel and the Menu button's column is reserved; **(2)** the
Bestiary/Expedition split shipped (`5843f6e`) — the tab is now **Mobs**, holding two sub-views
(**Expeditions** = job cards, **Field Guide** = the ledger + VIPs). Suite **1797 → 1844**.

**THE MOBS FOLLOW-UP ROUND — THREE PASSES SHIPPED, ONE BUILD LEFT (2026-07-15, later the same day;
suite 1844 → 1879; its dated section is the LAST one at the bottom).** **(1) The Runs contrast**
(`401719c`): `.beast-exp` measured **1.28:1** in a real browser — invisible, not "muted". The
handoff's guessed mechanism was FALSIFIED: it was never a tertiary tone that lost its context, it
was the Market strip's row transplanted onto a parchment card at Expeditions MVP (`c4905f9`), and it
had been illegible since the day it shipped. One value → `#6b4a1e` (6.11:1), the house tan-card ink.
**A full-UI contrast sweep came with it** — five more live instances of the class, measured and
parked as NEXT item (4). **(2a) The Field Guide taglines** (`06108af`): `lore: { tagline }` on all
nine rows, each playing that mob's one documented comic lever, revealed on discovery — and it cost
**0px** of card height (the info column had headroom under the 72px portrait), so the split's
decluttered card survives the feature most likely to have undone it. **2b (the Dossier) is fully
scoped with every call registered — see the NEXT block.** **(3) The overlay stand-down** (`ecf1700`),
found by Daniel in Claude's own screenshot: the hire chip, Greg's bubble and Bob's bubble are z5
siblings of `#shop-ui`'s z4 and painted straight THROUGH any open panel — all three measured fully
INSIDE the panel's box. Fixed with the attention doctrine (`nav.js` exports `isPanelOpen()`; the
overlays stand down) rather than a z-index, because `#shop-ui` is `inset:0` with **no
`pointer-events` anywhere in the file** — the obvious `z5→z3` would have left a visible, unclickable
chip routing the whole Bob tutorial. Suite **§81 / §82 / §83**; **+5 LESSONS**.

**A CORRECTION THIS ROUND EARNED — read before touching any bar.** The old version of this block
told the next session that *"a new tab is nearly free (`nav.js` TABS + `PANEL_FOR` are a two-line
registry)"*. **That is true about the WIRING and false about the LAYOUT, and it nearly cost the
round.** The bottom bar is right-anchored and grows LEFTWARD into the customer panel. The binding
law (LESSONS 2026-07-04, and the budget at `style.css`'s `.nav` rule) is **"panel ends 454, 5-tab
nav reaches ~470-480, a 6th tab does NOT fit — redesign, don't shrink"**, and it MEASURED true again
on 2026-07-15: a 6th tab overlaps the customer panel in every fallback face, and even in Segoe UI at
any label longer than ~4 characters. That is why the split went VERTICAL (sub-views) instead of
horizontal (tabs). Suite §80 now pins the tab COUNT, so a future session that trusts "nearly free"
fails in the suite rather than in Daniel's browser. **Labels are load-bearing** (~7.5px/character in
the widest face); "Bestiary"→"Mobs" bought the bar back ~30px (slack 17.20 → 47.45).

**NEXT — 2b: THE DOSSIER (Daniel, 2026-07-15 — the Mobs follow-up round's last open build).**
Cold-boot ritual as always: this doc in full, the dev-method skill, sync-and-certify (suite must
read **1879** at HEAD, tip **ecf1700**). The round's other two items are CLOSED — (1) the Runs
contrast shipped (`401719c`) and (2a) the Field Guide taglines shipped (`06108af`); the tab-name
item survives below as (3). A fourth pass fell out of Daniel's browser mid-round: the overlay
stand-down (`ecf1700`).

  **2b IS FULLY SCOPED — every open call is already made. Start at the build.**
  Daniel picked **Option 2 staged** (2026-07-15): the card ADVERTISES (2a's tagline — shipped), the
  Dossier INFORMS. That is the sale-sign doctrine applied to a second surface, and it is why the
  card carries one line and not three.
   - **THE SURFACE — Option 1 REGISTERED (Daniel, 2026-07-15): a THIRD SUB-VIEW, inline.**
     `activeMobView` gains `'dossier'` + a `dossierId`; the card list swaps for the entry and a
     **← Field Guide** button returns; the Expeditions/Field Guide toggle hides while inside.
     Rejected: an overlay on the `market.js` precedent (a second full overlay, a new z-layer, and
     markup that would drag the Kong mirror in). **The registered reason matters more than the
     pick:** a sub-view lives INSIDE `#shop-ui`, so the bleed-through class that cost a whole pass
     this session (§83) **cannot recur here by construction**. Do not "upgrade" it to an overlay
     without re-reading that section first.
   - **THE LADDER — serve breakpoints, one ladder for both content types** (Daniel's picks). Fame
     rungs were rejected: fame is GLOBAL, and "more revealed about Slimey" must not unlock by
     trading swords. `crossedCount(served, MONSTER_BREAKPOINTS)` already exists and already draws
     the pips, so the ladder is visible before it is explained. Greatest Hits by pip:
     **1 (25)** excellent + success · **2 (50)** + partial + failure · **3 (100)** + funnyFailure ·
     **4 (250)** + leave + dismiss (+ theft) · **5 (500)** the golden line.
   - **THE `{item}` LINES — EXCLUDED (Daniel's pick).** 22 of the 233 carry a `{item}` placeholder
     and there is no item in a bestiary card. `itemBias` exists on only some rows, so a "signature
     item" is not cleanly derivable, and inventing a filler puts words in the line's mouth.
   - **MEASURED, so the build does not re-derive it:** usable lines per monster after the exclusion
     — Batty/Skele 28 (the worst case), Froggo 26, Beetley 25, Ratty/Demmy/Leggsy 24, Slimey 22,
     the Inspector 10. Worst case ≈ 476px of hits + ~160px of portrait/beats ≈ **636px in a 500px
     panel viewport → a maxed dossier SCROLLS on any surface** (which is why "more room" did not
     decide the surface). The common case is small: pip 1 is 9–11 lines ≈ 180px.
   - **STILL TO AUTHOR: `lore.beats`** — 3 progressive beats × 9 rows (27 lines), COMEDY_BIBLE
     voice, revealed at pips 1/2/3. The field is additive beside the shipped `lore.tagline`
     (`lore: { tagline, beats }`), so no consumer churn. Line trust is granted — no review round.
     The bible's new "Field Guide taglines" section carries the register and the standing warning:
     the tagline is the caption, the beats are the paragraphs; do not grow one into the other's job.
   - **Binding, still:** VIPs get their own section, never rows in the grid, never a Send button
     (Daniel, 2026-07-08) — the Inspector has a tagline and rides the guide, so he gets a Dossier
     too (10 usable lines, 4 buckets, no pips). The completion % stays a field guide of REGULARS,
     grid-only, suite-pinned. And §80's law holds: **the job card stays a job card** — §82 already
     pins that lore never drifts onto it, and the Dossier must not either.

  **(3) THE TAB NAME — "Mobs" IS PROVISIONAL.** Daniel: *"aside from Mob - any other name would
  fit?"* "Mobs" was picked under width pressure, not affection. Opens with an options round, and
  **every candidate must be MEASURED before it is offered** — the label's width is a layout decision
  (~7.5px/character in the widest face; the bar has 47.45px of slack in that face today). One
  candidate already in the codebase: the completion metric calls them *"a field guide of REGULARS"*.
  Note `nav.js`'s tab **id** stays `bestiary` regardless — it is internal, the panel is still
  `#bestiary-panel`, and renaming it churns consumers to buy nothing.

  **(4) THE CONTRAST CLASS — FIVE LIVE INSTANCES, MEASURED, AWAITING DANIEL'S CALL.** The §81 pass
  fixed `.beast-exp` and swept the whole UI in a real browser (388 text elements, six views). The
  class: **a colour authored for the DARK panel palette, reused for text on a PARCHMENT card** — the
  cards are the only light surfaces in a dark-purple UI, so a dark-panel colour looks right in the
  file and dies on the card. Survivors, with their measured ratios (AA needs 4.5:1):

  | element | colour | ratio | where |
  |---|---|---|---|
  | `.beast-next.vip` ("VIP") | `#ffd9a8` | **1.01** | Field Guide — the section the split just moved |
  | `.item-sold b` (the count) | `--gold` `#ffcf4a` | **1.12** | Shop |
  | `.perk-cost` | `#cfa8ff` | **1.50** | Upgrades |
  | `.upg-cost` | `--gold-deep` `#c99a2e` | **1.97** | Upgrades — *the exact colour Daniel already ruled on* |
  | `.item-sold` | `#8f86a3` (the disabled-grey) | **2.62** | Shop |

  Separately `.beast-next` (`--ink` @ `.6`) sits at **3.45** — right palette, over-dimmed, a
  DIFFERENT sub-class needing a different answer. Correctly exempt and NOT to be "fixed":
  `.serve-btn:disabled` / `.dismiss-btn:disabled` (WCAG 1.4.3 exempts inactive controls; both are
  deliberately greyed). Daniel was told and did NOT rule — he said don't broad-restyle, and that
  stands. When it opens: `#6b4a1e` is the house tan-card answer (6.11:1) but the golds and purples
  are carrying MEANING (gold = money, purple = rep), so a straight recolour flattens a legible
  system — that is the options round, not a sweep-and-replace.

**THEN the rest of the parked queue, in order:** results-box flooding (h) → B2 material payment →
B3 extra slots → Greg-perk visibility (g)①.

**DOUG LEVELING — DONE 2026-07-14 (b9ac048, suite 1797, certified 3× bit-identical).** Option 1 as
spec'd: `WORKERS.scavenger.levels` = **Fleet Feet** ("Faster scavenge runs (-20%)"), effect
`scavengeSpeed` +0.25/level, baseCost 2000, costGrowth 1.15, maxLevel 10, deepFrom 6/deepTier
6/deepCostMult 3. The clock: 24s → 10.67s (L5, the pre-Mythic max) → 6.86s (L10). Training UI,
fametrack chip, and save-clamp all lit up with ZERO wiring (every one is registry-scanned).
Accepted side effect held: faster runs = more scrap AND more relic rolls.

  **THE BUG THIS PASS TAUGHT — read before touching any dial.** `baseInterval` was hardcoded as
  "Doug's clock" in THREE places. That was CORRECT while scavenge had no speed dial, and
  scene.js's comment said so in as many words ("scavenge has no speed perks — this IS the clock").
  The ladder falsified that comment and only `effectiveWorkerInterval` got rewired, so the renderer
  kept dividing a 24s clock while the timer ran on 10.67s: `elapsed = 24 − timer` could never fall
  below 13.33, stranding the idle and out-leg phases at every timer value. Doug walked home from
  the portal, POPPED, and re-emerged from the door with no idle beat. **The suite passed 24/24
  through all of it** — §77 asserted the interval MATH and never asked whether Doug is ever
  visibly standing still. Daniel's browser was the first thing to actually look at him. The fix:
  `scavengeClock(state)` in `src/data/workers.js` (the LEAF — so the renderer reads it without
  importing game.js) is now the ONE source of truth, consumed by `effectiveWorkerInterval`,
  `isDougOut`, and `drawScavenger`. §78 guards it, including a SOURCE pin (§0b precedent) because
  a headless suite cannot draw Doug — pins (a)-(f) prove the helper is right, only (g) proves the
  renderer calls it. Negative control verified: re-inserting the hardcode drops the suite to
  1795/2.

  **CAMEO DRIFT — DECIDED, NOT A DEFECT (Daniel, 2026-07-14; recorded at the isDougOut seam).**
  The gone window scales with training (L0 11.6s/48% → L5 2.27s/21% → L10 1.37s/20%) because the
  walk legs are near-fixed while the cycle shrinks. Two consequences, BOTH accepted, neither to be
  "fixed": (1) FREQUENCY — a trained Doug cameos half as often; a maxed Doug is a blur, and
  glimpsing him less IS the joke. (2) TIMING — at L10 the gone window is shorter than the report
  delay (~1-2s, or `reportFallbackSec` 3.0s), so a cameo NEVER displays while he's visibly out;
  accepted because the battle log is RETROSPECTIVE — it reports a fight that already resolved, and
  Doug genuinely WAS beyond the door then. This retired a SECOND falsified comment ("the ~12s gone
  window dwarfs that, so a boundary straddle is rare and harmless" — true only at L0).

**THE SIM INSTRUMENT — REPAIRED 2026-07-14 (2784bec).** See the dated section at the bottom for
the whole story. The headline a cold session needs: **every acceptance margin recorded in this doc
before 2026-07-14 is VOID as a comparison — not beaten, VOID.**

**MEASURED FINDINGS STANDING FOR DANIEL'S JUDGMENT (final arc numbers, through F4 — F4 moved
none of them, being economy-neutral):**

  > **⚠ VOID AS COMPARISONS — READ THIS FIRST (2026-07-14).** Every margin in the two blocks
  > below, and every acceptance margin recorded anywhere in this doc dated before 2026-07-14,
  > was produced by the OLD sim instrument, which is now known to have been broken. It medianed
  > over 3 seeds and silently coerced a cap-hit into a sentinel (a blind cap-hit became ≈
  > +47800%, an aware cap-hit −100%), so with n=3 the "median" was simply THE LARGER OF THE TWO
  > REAL VALUES — a coin flip wearing a statistic's clothes. It ranked a build that beat its
  > control 2-of-2 BELOW one that beat it 1-of-2. These numbers are **VOID, not beaten**: do NOT
  > diff them against current output, do NOT treat a current margin as an improvement over them,
  > and do NOT retune anything toward them. They are kept only as the arc's narrative record.
  > The current certified numbers (repaired instrument, tip 8fe8012) are in the 2026-07-14 dated
  > section. Re-baselining any older claim means re-running the sim; there is no arithmetic that
  > converts an old number into a new one.

  (i)   **The commission margin compounded across the arc**: +3.5% (F1a) → +6.0% (F2) →
        **+12.4%** (F3) — scarcity of spendable rep makes the commission's fame bonus bite in
        perk timing. B2/B3 remain its designed depth, now on top of a healthy channel.
  (ii)  **The market-blind trajectory**: +34% → +48% (tax-inflated) → +12% (honest) →
        **+21%** (honest + teeth). The reform arc's whole story in four numbers.
  (iii) **Death-spread**: 96:00 (pre-arc) → 72:00 flat (F2's collapse) → **72–120h** (F3, median
        72:00). CAP_SEC 240h stays DEFERRED (one market-blind control seed right-censors at
        168h; its PASS is conservative — un-censoring isn't worth the sim runtime yet).
  (iv)  **F1a's calibration held all four passes**: median death fame ~662k = level 22 by the
        live curve; Mythic (L20) reached well before death.

**MEASURED FINDINGS STANDING FOR DANIEL'S JUDGMENT (F1a certification, amended through F2):**
  (i)   **The commission margin RECOVERED under F2**: comm-blind +3.5% → **+6.0%** — demand
        honesty concentrated counter traffic on stocked shelves and the premium channel
        strengthened. B2 (material payment) and B3 (extra slots) remain its designed depth.
  (ii)  **Attribution is a trajectory now, not a decomposition** — three passes deep
        (commissions, F1a, F2): market-blind +34% → +48% (tax-inflated) → **+12% (honest)**.
        The middle number was never real margin; the record shows why.
  (iii) **The aware death spread COLLAPSED to 72:00 flat across all five seeds** (from
        72–120h) — median down a full day, run variance gone: punchier arc, less texture; a
        pacing judgment for Daniel. Blind controls stretched the other way (one cap-censors at
        168h — its PASS stays conservative). CAP_SEC 240h stays DEFERRED.
  (iv)  **F1a's calibration keeps holding under the faster arc**: median death fame 659k =
        level 22 by the live curve; Mythic lands well before death.

**THREE MEASURED FINDINGS from the relic rework, for Daniel's judgment (raise them BEFORE
building anything that touches the economy):**
  (i)   **The trade-vs-hoard sign flip.** The market-blind bot now COMPLETES its checklist ~a
        day earlier than the aware one (it never spends materials on trades, so it hoards
        restores by default) while earning permanently less (+34% rate gap). Trading delays
        your relics but pays forever. Possibly good tension, possibly confusing — Daniel has
        NOT ruled on it yet.
  (ii)  **Purse at death is now ~1M+** (was ~20 gold): 3-4 days of income dwarfs the 303k sink
        stack. WORKER WAGES (the parked first perpetual drain) is now urgent, and step 8's
        prestige math should assume a millionaire at reset.
  (iii) **The desire curve is quantized to inspection days** (72-96h, the Seal cadence). More
        VIPs = more Seal-class sources = a smoother curve — Daniel already flagged this as the
        long-term shape ("as we add more VIPs and Relics, it will change").

**THE PARKED QUEUE (order is Daniel's call, raised when he asks):**
  (a) **Scarcity → dismissals → Rep bleed** — measure the dismissal rate in sim before/after
      the reform first; screenshot evidence 2026-07-12; interacts with (c).
  (b) **COMEDY BIBLE ANALYSIS** — Daniel's dedicated review session on the bible itself
      (voice spec, pool coverage, the market-era voices vs the four-cast design). Reading/
      design, not code.
  (c) **The churn / fill-to-cap pass** (design doc §13b) — doubly motivated: Greg's trade-mode
      retirement leans on it, and single-unit trading is the root of (a)'s steady-state
      outages.
  (d) **LAYERED MARKET DEPTH** (Daniel: simple surface, complex depth) — seeds: the forecast,
      §5's dials (per-offer stock; material↔material swaps), the ticker's real movement, and
      now the Yesterday Potion (the first depth mechanic SHIPPED).
  (e) **WORKER WAGES** — promoted by finding (ii); its own options round before any numbers.
  (f) Standing small: expedition pacing + fame-tier fee discounts; the Job Board's real home
      (pure-lore Bestiary); P2 Mythic → 40k one-value pass; Doug's door-open feel pass; the
      HUD compact-numbers option; the itch dual-publish decision.
  (g) **QUEUED BEHIND THE FAME & DEMAND ARC (order per FAME_ECONOMY_DESIGN.md §3's tail):**
      ① Greg perks hidden pre-hire; ② Commission B1 — hard reserve + awareness bundle
      (**Option 1 PICKED 2026-07-12**, decision log in the design doc §9; **priority RAISED
      2026-07-13** — F2 amplifies the collision: stocking an order's item attracts full-weight
      counter demand, and Daniel watched Bob serve away a Silver Key the order needed); ③ B2
      material payment; ④ B3 extra slots via Bob upgrade.
  (h) **Results-box flooding on material-item purchases** (Daniel, browser, 2026-07-13):
      buying several material-made objects fills the battle-results box, with duplicate lines
      for repeats of the same item. Wanted: aggregate/dedupe in the results renderer
      ("Iron Buckler ×3" style) — presentation-only, no economy surface; a clean small
      standalone pass.

**Steps 7-8 behind all of it:** Expedition depth (parties, offline management), then Franchise
(rule-changing prestige, six-door factions — designed against what the harness measures then,
BOUND by the prestige law: restored relics carry over, and carrying **F1b** — prestige spends
fame — whose design already lives in FAME_ECONOMY_DESIGN.md §5).

**PARKED, in Daniel's own words (2026-07-11, post-step-4):** (a) **expedition pacing retune**
— "up the gold charge," plus FAME-TIER DISCOUNTS on the fee (fame already carries budget
multipliers — the precedent exists); pairs with the pacing finding (60s/25g lets the optimal
bot run ~50/hour — `durationSec` is the other lever); one small tuning pass whenever his
browser feel says so. (b) **WORKER WAGES** — a recurring payroll as a permanent gold drain;
the first PERPETUAL sink ever proposed and the direct answer to the audit's oldest finding
(post-death income runs away); interacts with training levels and future prestige math —
earns its own options round before any numbers. (c) **the Job Board's real home** — the
Bestiary is the Job Card BY INTENT and temporarily; when the pure-lore Bestiary gets built,
the expedition console needs its own surface — options round owed then. Plus the standing:
**P2 (Mythic → 40k)** one-value pass anytime; P3 stands; old P4/P5/P6 superseded (design
doc §12).

**Small parked follow-ups (real, not urgent):** Doug’s door-open feel pass (playPortalOpen is a
celebrant-only one-shot — needs re-entrancy or a second anim to let Doug open the door); Doug’s
Deep-Sinks training ladder; the HUD compact-numbers option (7-digit gold); the itch.io
dual-publish decision; dragon idle footPad measures 13 vs registry 14 (1px — negligible, noted).

**Standing laws that bite (the short list; LESSONS.md has the full record):** artifact wins —
read files from HEAD, never from memory; exact totals live only in the newest batch’s suite
section; oversized characters author at display size, drawn 1:1, dims suite-pinned; scripted
edits verify their landing zone AND their survivors (print spliced blocks through the CLOSING
braces); `node --check` is script-mode — run the ESM import too; `git status` is a READ (scan
for `deleted:`); frames fill left-to-right in find order (the relic assignment law). The
reform's ECONOMY laws live in TRADE_MARKET_DESIGN.md §4 and carry the same weight.

---

**Status (ARCHIVED 2026-07-04 snapshot — superseded by §0 above; kept for the record):** **M1–M6 MVP COMPLETE; idle roadmap Passes 1–4b SHIPPED**, plus spawn
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
**Last updated:** 2026-07-15 (evening) — THE MOBS FOLLOW-UP ROUND: three passes shipped, all browser-confirmed (suite 1844 → **1879**, tip **ecf1700**). (1) Runs contrast (401719c): `.beast-exp` measured **1.28:1** — the handoff’s guessed cause was FALSIFIED; it was the Market strip’s row transplanted onto a parchment card at c4905f9 and illegible since. Fixed to #6b4a1e (6.11:1); §81 pins the COMPUTED RATIO, never the hex. The sweep that shipped with it found **five more live instances** — NEXT item (4), measured, awaiting Daniel’s call. (2a) Field Guide taglines (06108af): `lore: { tagline }` × 9, one comic lever each, **0px of card height**; §82. **2b (the Dossier) is FULLY SCOPED — Option 1 (a third inline sub-view) REGISTERED, ladder + exclusions decided, content measured; start at the build.** (3) Overlay stand-down (ecf1700), from Daniel’s read of Claude’s own screenshot: hire chip / Greg’s bubble / Bob’s bubble all painted through open panels; fixed via nav.js `isPanelOpen()` — NOT z-index (#shop-ui is inset:0 with no pointer-events; z5→z3 would have shipped a visible, unclickable chip). §83. **+5 LESSONS.** NEXT = 2b → the tab name (3) → the contrast class (4). Earlier: 2026-07-15 — the HUD band (6c0e74c) + the Bestiary/Expedition split (5843f6e), suite 1844; **a 6th nav tab does NOT fit**. Earlier: 2026-07-14 — DOUG LEVELING shipped + certified (b9ac048); THE SIM INSTRUMENT REPAIRED (2784bec — **every pre-2026-07-14 margin is VOID as a comparison**). Earlier: 2026-07-14 — Commission B1 SHIPPED (97a540f), F2 coupling reversed by the sim to decoupled.

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

**Special-visitor (VIP) sizing — recorded 2026-07-07 for the Visits pass (numbers verified at
HEAD):** keep the permanent 128×128 frame; author the VIP at **~90% frame fill** and give its
registry row **`spriteScale: 1.25`** → ~99px visible body, **+~33% over the regular cast's
~73–75px** — both draw sites (queue idle scene.js:696, celebration march :851) already multiply
by the guarded per-monster `spriteScale`, so this is zero-code. **Ceiling ~1.3** (Skele's parked
stopgap precedent); the binding constraint above that is **bubble airspace** (bubble box top
measured ~y322, see the WALL_SHELF ceiling comment + style.css:383) — measure clearance at
integration with pngjs, same session as `footPad`. Width is fine: queue `stepX` ~134px absorbs a
full-width 1.3× sprite. Size alone reads "somewhat bigger"; size + a distinct silhouette is the
"someone special" read — silhouette is Daniel's call.

**SUPERSEDED 2026-07-08 — the paragraph above and the update below are the FAILED spec (the
sizing saga, LESSONS 2026-07-08). The live VIP art contract is the REAUTHOR contract in §13:
author at display size, drawn 1:1 via pixelScale, dimensions suite-pinned. Do not re-apply the
128-frame + multiplier approach to oversized characters.**

**2026-07-07 update (historical): the VIP is a DRAGON.** Daniel has authored the PNG + animation strips
(landed + integrated 2026-07-08 - see §13). Flyer-vs-walker resolves from the art itself at integration — a flyer takes
the hover-bob + altitude-padding + shadow conventions and skips `footPad`; a grounded dragon
takes the measured-footPad path. Roster id `dragon` cannot collide with the marketevents id
`dragon_scare` (different registries) — and the crossover day is a comedy opportunity on file.

| Asset | Target size (authoring) | Animations | Filename(s) | Status |
|---|---|---|---|---|
| Froggo (4th customer, Pass 4b) | 128×128/frame (permanent convention) | shared 4-frame idle @6fps + walk strip | `frog.png`, `frog_idle.png`, `frog_walk_happy.png` (the walk is authored as a GRUMPY STOMP — naming kept by convention, mismatch intended) | **ALL IN** (2026-07-04) — `footPad` 15 MEASURED, `spriteScale` 1.1 (content 76% of frame) |
| Slimey / Batty / Skele (customers) | 128×128/frame (PERMANENT convention — see the Option-3 scrub note above) | shared 4-frame idle strips (6fps) | statics `slime.png` etc. + `slime_idle.png` etc. | **ALL IN** (statics + all three idle strips, 2026-07-03); drawn 88px (`QUEUE.size`), Slimey/Skele `spriteScale` 1.15, `footPad` MEASURED slime 18 / skeleton 12 (grounding pass), Batty `flying: true` (padding = hover altitude) |
| Bob (mimic merchant) | 160×160/frame | idle 6f · serve 6f (one-shot) | `mimic_merchant.png` (static fallback), `bob_idle.png`, `bob_serve.png` (6-frame strips) | **IN** - **160px on-screen, drawn 1:1** (`BOB.height` 160; art is 160/frame, no upscale = crisp), feet anchored to `COUNTER.baseY` − 82 (lifted onto a "stool", 2026-07-08) |
| Doug (the Scavenger) | 160×160/frame | idle 6f · walk 6f (walk reused FLIPPED for the return) | `doug.png` (static fallback), `doug_idle.png`, `doug_walk_happy.png` (960×160 strips) | **IN** (Pass A 2026-07-10; recolored same day, dims suite-pinned) — drawn 1:1, `footPad` MEASURED idle 9 / walk 10, home x870 behind the counter, trip staged in the celebrants’ floor grammar |
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

**Art integration status:** Bob's scale is locked (`BOB.height` **160px, drawn 1:1** in `scene.js`, feet anchored to
`COUNTER.baseY` − 82). Bob is animated — idle loop + serving one-shot, each a 6-frame horizontal strip
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
shipped. **Roster: SIX customers** (Slimey / Batty / Skele / Froggo / **Ratty** the rat
thief / **Beetley** the beetle guard — ALL art complete including idle + walk strips),
**FIFTEEN items** (all icons IN), and **TWO workers** (Bob the serve-mimic, **Greg** the
restock-gargoyle — full arc below). **THE ENTIRE UX ROADMAP (items 1–6) IS SHIPPED** (2026-07-04/05, as-built
deltas marked on each item below): Bob's hire arc, the Fame track panel (5th nav tab), license
alerts via Bob's clickable DOM bubble, and Greg — who grew into a full subsystem: Trusted-gated
600◆ hire, paid 8s trickle, duty-cycled clickable restock bubble, errand flights (random shelf
destination, north-facing work strip, apex-masked turn hops), flyer-only shadows, two Fame perks
(Swift Wings −20%/lvl interval, Bulk Satchel 2-unit runs), bounded offline reserve refills
(+1, +1 with satchel), and a hire-gated voice (blunt anti-Bob; shoo/leave lines + gold hire
intro + bubble quip). Gold milestone lines now land as staggered beats (2.5s dial). Comedy:
@25 AND @50 ladder batches live, goldens @100, two hygiene laws suite-pinned (no second person;
consumable verbs must fit the whole roster — the Rusty Key is a consumable). Save
`mobmart.save.v1`, additive schema, clamped merges. Suite: **`test_suite.mjs` at repo root,
645 assertions green** — a fresh clone self-verifies with `node test_suite.mjs`. Suite doctrine
(batch-1 lesson): EXACT-MATH tests pin the trio shelf via `pinTrioShelf`; RULE tests derive from
live registries — never hand-type a roster-dependent number; exact batch totals live only in the
NEWEST batch's section. New modules since the items phase: `src/data/fametrack.js` (registry-
scanned tier track) and `src/data/marketevents.js` (Market Day leaf registry). Workers now
persist `{ owned, level }` (training levels, clamped merge). Transient (never-serialized) state
fields now include: `bobSpeech`, `licenseReminderIn`, `gregBubble`, `gregRestocked`,
`workerServed`, `milestoneQueue`, `milestoneCooldown`, `marketDayKey`, `marketEventId`,
`marketCheckIn`, `boardChalkPending` — the serializer is an explicit field list, and suite
sections pin each exclusion.

**Shipped 2026-07-07/08 — SPECIAL VISITS ("The Inspection", Option 2; suite 531 -> 560,
section 54) — ROADMAP COMPLETE (the dragon art was reauthored + integrated 1:1 on 2026-07-08 - §13):** the dragon
VIP ("The Inspector", glasses + clipboard, Daniel's art + the design read straight off it).
**Mechanics (all suite-pinned):** `special: true` registry rows are invisible to the normal
spawn pool (both branches), breakpoint milestones, and the bestiary GRID; he arrives only via
`trySpawnVisit(state, roll)` — pure trigger (roll passed in, both branches pinned without
stubs), once per LOCAL calendar day at Legendary+ (CONFIG.visits.requiredTier 5, chancePerSpawn
0.02), **PERSISTED `lastVisitDay` latch** (string-coerced merge, the lastMarketDay pattern),
armed by `marketDayKey` so headless tests never see visits. Arrival = amber market-tier log
line + Bob bubble click-routed to his want. **THE GRADE** (`inspectionGrade`): tip = 100 x
shelf fullness + 25 per stocked category, x the fame budget mult, computed on the shelf AS HE
SEES IT (before his own unit decrements) — exact pins: full Neutral 175, Mythic 254, club serve
187, rep 27 (perSale 2 + fameBonus 25). Payout-side by law. **Voice:** `src/data/visits.js`
(leaf: announce/bubble/grade pools) + a FLAT four-tier results batch (no minServes ladders a
once-a-day visitor could climb — suite-pinned shape). **Bestiary VIP section (Daniel's call):**
specials get their own amber-ruled "VIP Visitors" section under the grid — same card system,
silhouette-until-first-visit reveal, "Visits N" + VIP tag, no pips; completion stays GRID-only.
Built JS-side (index.html + Kong mirror untouched). **Roster:** MONSTER_IDS = 7 (dragon), and
every roster-derived suite rule evolved to the non-special grid (bestiary totals, ladder
contract, batch@50, Beetley's roster exact yielded to §54 per doctrine). **THE SIZING SAGA
(LESSONS 2026-07-08 — read it):** three sizing iterations (1.25 -> 1.4 -> pixelScale 2) failed
to produce the VIP read cleanly; Daniel REAUTHORED at a 160 frame (as-built in §13). Render side that
STAYS: `mobDrawnBox` in scene.js is the ONE sizing formula (queue draw + celebration march +
want-bubble tail all share it; `pixelScale` = integer multiple of the AUTHORED frame), and the
want-bubble's tail now RIDES UP to taller-than-classic fronts (min() keeps every regular mob's
geometry pixel-identical). **RESOLVED 2026-07-08:** reauthored at a 160 frame, drawn 1:1
(pixelScale 1), frameSize:160 suite-pinned - 160px box / ~132px visible Inspector (as-built §13).

**Shipped 2026-07-07 (three passes after Market Day; suite 484 -> 488 -> 504 -> 531):**
- **SPECIAL-OF-THE-DAY BOARD (Daniel's idea + 640x220 art):** flush-mounted over Bob —
  `SPECIAL_BOARD` in scene.js (centerX W*0.57, topY 88, width 320; PNG MEASURED at integration:
  bbox x3..636 y3..218, face RGB 170,106,55 -> cream/gold ink with 1px shade). Header CODE-DRAWN
  behind `drawHeader: true` (flip false if the art ever carries lettering — one value). Quip =
  `boardQuipFor(event, dayKey)`, DETERMINISTIC per (day, event) via the salted FNV — a sign
  chalked once each morning, never re-rolled per reload. Pairing guard 0b auto-verified the new
  sprite consumer (+1 assertion, the wall_shelf lesson's guard catching its successor). Suite §51.
- **BOARD LIFE (Option 2):** morning CHALK write-on (char-by-char over 1.2s; armed by
  refreshMarketDay's crate branch via transient `boardChalkPending`, consumed by main.js only
  once `screen === 'shop'` — a boot's chalk waits through the title for Open Shop; same-day
  reloads show the sign already written) + DOOR THUMP (decaying x-rattle at celebrant door entry;
  TRANSLATE not rotate — flush-mount physics; dials `SPECIAL_BOARD.thump` durMs 600 / amp 3 /
  swings 3 / cooldownSec 25, amp 0 = kill switch) + **12 new quips** (every event pool 1 -> 3,
  day-hash surfaces all 3 within 60 days probe-verified, bible-mirrored). Suite §52.
- **DEEP SINKS (Option 2) — MYTHIC IS LIVE:** `{ Mythic, min 5000 }` appended; budgets x1.45,
  crate 9 units / 70◆, the track node, and the HUD remainder ALL auto-flowed from the one row.
  **Worker training:** registry `levels` blocks (workers.js) + pure accessors + `sumWorkerEffect`.
  Bob "Salesmanship" = **+1◆ FLAT tip per sale per level**, added AFTER the rounded multiplier
  product (order suite-pinned: event flask 26 = round(15x1.5)+3), applied manual/auto/OFFLINE
  (offline IS Bob working; frozen like the mults). Greg "Deeper Backroom" = **+1 bounded offline
  reserve refill per level** into Backroom Storage's exact pool — stock-binds-before-time intact.
  **Levels 1-5 at hire; 6-10 MYTHIC-gated with a x3 cost bump** (rungs 2000 / 2300 / ... / 12,068
  / ... / 21,107; shallow band 13,485; ~94.9k per worker, ~190k both — sized against a 321k
  endgame wallet). Saves: `{ owned, level }` with clamped merge (999 -> maxLevel, pre-pass -> 0,
  unowned levels inert). UI: worker cards grow a training row + Train button (compactGold label,
  exact tooltip, "Reach Mythic" gate text). Fame track: deep bands chip the Mythic node, and
  §33's derived chip-count grew the new SOURCE CLASS. Build catches for the record: a §53
  scope-import crash (the standing suite-scopes lesson — caught by reading the run's tail) and
  the §33 extension. Suite §53.

**Shipped 2026-07-06/07 — MARKET DAY (retention pass, Option 2 of Daniel's roadmap pick; suite
440 -> 484, section 50):** one **demand event per LOCAL calendar day** (pure function of the date
— FNV-1a over 'YYYY-MM-DD' in `marketevents.js`; deterministic, reroll-proof, same market for
every player that day; 6 events, 2 per shelf category, **a new event = one registry row**) +
the **once-a-day supplier crate** on first open (`3 + fameTier` free units dealt via the offline
round-robin, caps/licenses respected, + `10 + 10×fameTier` gold; **undealt units convert to 6◆
each** so a full shop still gets paid; latched by PERSISTED `lastMarketDay`, **saved immediately
on grant** — the offline bank's no-double-collect rule). **THE LAWS:** event multiplies
**PAYOUT only, never basePrice** (milestone law inherited; exact-budget buys suite-pinned);
want-pick CATEGORY stage leans ×2 toward the day (soft, `CONFIG.market.wantBias`); **offline is
event-free** (suite-pinned byte-identical) — the event rewards playing today, not sleeping;
absence is never punished. Surfaces: two amber `market`-tier log lines (bypass the milestone
stagger), Bob-bubble announcement click-routed to the event's shelf tab, away-modal augment
lines, and the HUD chip. Mid-session rollover: `update()` re-derives the day every 5s but is
**ARMED ONLY by the boot refresh** (`marketDayKey` set in main.js) — headless tests never trip
crates. **HUD LAYOUT BUDGET (2026-07-07, measured — the collision fix, Daniel picked Option 2):**
`.hud` is **band-bound, never stage-centered** (`left:396px` = shelf plank edge 372 + breath;
`right:16px`; cluster centers via justify-content — the long "to <tier>" remainder only exists
below Legendary where rep is ≤4 digits, so widths anticorrelate and the worst reachable cluster
~600px fits the ~780px band); the market chip is **absolute in that box** (`top:52; right:0` →
stage y68/right16, under Menu, clear of the fame panel's x960 edge) and shows the **compact form**
("Armor +50%", `marketBannerCompact`) with the full name on the tooltip. Numbers documented in
the style.css HUD comment — same status as the bubble-airspace ceiling. **KONG MIRROR INCIDENT:**
`index.kongregate.html` had silently drifted ~3 passes (old Reset button, no menus/chip/bubble);
regenerated MECHANICALLY from index.html + the two Kong-only insertions (diff-verified), and
**section 50 now suite-pins the mirror** (every index.html line must appear in order in the Kong
shell) — full write-up in LESSONS.md 2026-07-06. Files: `marketevents.js` (new), config, state,
save, game, main, hud, panels, both index pages, style.css, suite, COMEDY_BIBLE (Market Day
lines mirrored), LESSONS.

**Shipped since the 2026-07-05 mid-session sweep (all committed, suite 394 -> 436):** MENUS
(roadmap 5, Option 2 — tabbed Settings/Credits overlay at z15, reachable in-game and from a
title Credits link; Reset relocated inside with DOUBLE-CONFIRM arm/disarm; Back to Title saves
first, then recreates the boot state exactly since update() gates on screen === 'shop'; the
Menu button wears the HUD-capsule styling; NO sim pause by design — idle-honest). SHELF HEADER
hardening (Restock All quote COMPACTS at 1000+ via compactGold with the exact figure in the
tooltip; tab/button paddings budgeted; tabs went MIXED-CASE so the honest "Consumables" label
fits — a 4th category tab does NOT fit, redesign not shrink). LAMPSHADE LINES (Option 3 canon:
mascot logic; two generic winks). RATTY (roadmap 6): registry row (thief, [10,16] — floor 10 is
the strand invariant, want-picker is NOT budget-aware... yet), full debut ladder batch, art
measured (footPad 15, scale 1.1), LEAVE-THEFT Pass B (thief flag: a patience timeout pockets one
unit of his wanted in-stock item, theft-tier line replaces the leave line, DISMISSAL prevents
it — the auto-wave is anti-theft infrastructure), ratsFoiled away-modal flavor (offline never
simulates leaves, so the "Bob prevented N robberies" line is fiction over a true fact).
BEETLEY (roadmap 6.5 — Daniel SWAPPED THE GOBLIN for the beetle): armor-lead mid-spender
([14,26], armor 4/2/1 weights), the STEADFAST quirk (patienceBonus +8s on the 24s default —
the anti-Ratty: the guard forgives inattention), combatMod +1, footPad 9 at native scale, full
debut batch (the Ratty standoff crossover lives as COMEDY — the guard mechanic was deliberately
not built). QUEUE UNIQUENESS (Option 2: "never two of him, never him in two places") — spawns
exclude in-queue AND cooling types; every queue exit (serve/dismiss/timeout, auto-wave included)
arms a transient returnCooldownSec = 8 — THE DIAL'S MATH LIVES IN CONFIG: steady-state cooling
= cooldown / serve interval and must stay under the roster at maxed throughput; 18 starved the
endgame stage (the statistical director test caught it), 8 sustains the pool at 2x the celebrant
march. New suite sections 44-48.

### Next up — the idle-progression roadmap (from MOB_MART_RESEARCH.md)

**Agreed immediate order — THE UX ROADMAP (Daniel's fresh-eyes full-reset findings, 2026-07-04;
all shapes below are HIS refinements of the options rounds, decided):**
1. **SHIPPED 2026-07-04.** **Bob's hire arc (pseudo-tutorial).** Bob is NOT visible until hired (drawBob + serve anims
   gate on `workers.mimic_merchant.owned`); the empty counter carries a persistent goal chip
   ("The counter needs a merchant! Hire Bob — 50◆", DOM, click -> Workers tab); on hire Bob
   appears. Teaches manual serve THEN automation, and keeps the first-purchase beat.
   startingGold 40 vs hireCost 50 = 1-2 manual serves fund it (deliberate). Old saves
   (owned: true) see nothing. Suite: M4 sections assume unowned start — already compatible.
2. **SHIPPED 2026-07-04** (as-built: live tier labels start at NEUTRAL, not "Newcomer"; workers
   with a requiredTier scan onto the track too — Greg sits on the Trusted node).
   **Fame track panel ("unlock tree" — Daniel's twist on Option 3).** Fame is LINEAR, so the tree
   is a vertical TRACK: one node per tier (Newcomer..Legendary), each node fanning out what it
   unlocks — REGISTRY-SCANNED (licenses' + perks' requiredTier auto-populate; new content
   auto-appears). Centered showcase presentation (the Bestiary-v2 pattern; documented actor-band
   exception). Plus a one-line HUD remainder ("· 32♛ to Trusted"). NOT a branching spend-tree —
   that would be a new system; display only. Must visually separate spendable ♛ vs lifetime Fame.
3. **SHIPPED 2026-07-04** (as-built: the bubble became the CLICKABLE DOM variant same day —
   Daniel's call, superseding "not clickable"; headPad measured via pngjs; click routes to the
   license's shelf category; a blinking bright-gold card frame marks affordable licenses,
   eligible-but-broke keeps the subtle button gold; canvas click handling remains ZERO).
   **License alerts via BOB'S SPEECH BUBBLE (Daniel's twist on Option 2).** On a tier crossing
   with newly eligible licenses, Bob gets his own bubble (drawBubble variant anchored at Bob):
   queued announcements ~6s each, PLUS a gentle recurring reminder (~30s dial) while any eligible
   license sits unbought, PLUS the milestone log line as the permanent record. NOT clickable
   (canvas has zero click handling — by design); if click-to-shop ever matters, a DOM chip is the
   fallback. Trigger = TIER ELIGIBILITY, never affordability (gold fluctuates -> spam).
4. **SHIPPED 2026-07-04/05, expanded far beyond this spec — see Current state.** The Restocker
   is **GREG** (gargoyle, 112x112 native, greg_fly + greg_fly_n strips in). Deltas from the spec
   below: hire 600◆ (Daniel, up from the 100-150 band — a mid-game goal) gated behind TRUSTED;
   the standing chip became his duty-cycled clickable bubble (10s/45s dials); trickle is C1 flat
   8s, paid per unit. **The Restocker (second worker).** SMALLER than Bob, a FLYING something (art undecided —
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

**Resolved this session (2026-07-05), recorded for the log:** Knight Helm 26 landed at HEAD;
probe_economy.mjs never existed on Daniel's machine; the Restocker mini round was held and decided
(A1 one-at-a-time / B1 gray / C1 flat 8s — then the chip evolved into Greg's bubble); the @50
batch shipped; shelf-scroll glow-clip and golden styling both passed Daniel's feel checks; the
restock worker's visual home is canvas-beside-Bob (Greg at 490,330); the line-unlock mechanic
shipped as the minServes ladder; the offline model review picked BOUNDED refills for Greg (Option
2 — never time-derived; the "stock binds before time" property is load-bearing).

**Resolved 2026-07-05 (evening), recorded for the log:** MENUS shipped (Option 2, no pause by
design); the Rat shipped as RATTY with the leave-theft; the GOBLIN is OFF the roadmap — Daniel
swapped the slot for BEETLEY; lampshade lines shipped (Option 3 canon); QUEUE-UNIQUENESS shipped
(dedup + 8s return cooldown); the COMEDY_BIBLE was accidentally deleted at one commit and fully
recovered from history (LESSONS entry: git status is a READ — scan for deleted:).

**Resolved 2026-07-06:** BUDGET-AWARE WANTS shipped (Option 2 SOFT BIAS — Daniel's pick): the
budget now rolls BEFORE the want pick, and the item stage weighs affordable items x
CONFIG.queue.affordableWantBias (4). Soft on purpose — the broke state survives as texture
(auto-wave, brokeGrace, broke-comedy, theft-prevention-via-wave all live on). RATTY'S FLOOR
FREED to [6,16] (the liberation the pass was flagged for). Suite: the strand invariant
RE-SCOPED ('never strands' -> 'every purse has a free-tier target'; rare mismatches are by
design), the A2 itemBias test now conditions on affordability (isolating the two contracts),
and a LATENT FLAKE died: the Warm Welcome patience test had hand-expected 29s since Beetley's
quirk shipped — it now derives from the spawned mob's row. Section 49 owns the affordability
contract (mismatches rare AND possible). Suite 440.

**Resolved 2026-07-07:** the RETENTION ROADMAP is LOCKED — **Market Day -> Deep Sinks (worker
gold-tier leveling + the Mythic ~5000 rung) -> Special Visits**, with the check-in calendar as a
separable later mini-pass. MARKET DAY shipped as Option 2 (event + crate; as-built block in §12).
The HUD collision fix shipped as Option 2 (band-bound cluster + right-docked compact chip) —
measuring it also surfaced a LATENT pre-pass graze (mid-tier "to <tier>" remainder could reach
x~328 vs the 4th shelf icon at 354), now retired by the band. VIP sizing numbers recorded in §9
for the Visits pass. Kong mirror drift found + plugged (LESSONS 2026-07-06; suite-pinned).
LATER THE SAME DAY: the SPECIAL BOARD shipped (Option 2 quip board, Daniel's 640x220 art), then
BOARD LIFE (Option 2 — chalk write-on + door thump + 12 quips), then DEEP SINKS (Option 2 —
Mythic live, worker training ladders); the housekeeping pass landed 8 HARVESTED markers + the
Repo line and confirmed guard 0b already covered the queued pairing assertion (the LESSONS
wall_shelf entry closed SHIPPED). All as-built blocks in §12.

**SHIPPED 2026-07-08 - DRAGON REAUTHOR + 1:1 INTEGRATION.** The Inspector was reauthored (the
sizing saga - LESSONS 2026-07-08; the failure was Claude's spec, not the art). **As built:** Daniel
authored at frame **160×160** (idle + walk strips 4×160 = 640×160; static 160×160); body ~132px
visible, footPad 13-15 across all nine frames (pngjs-measured at integration). Drawn **1:1**
(`pixelScale: 1` - the Greg precedent, no multiplier), so on-screen **160px box / ~132px visible**
- level with Bob's ~125, ~1.4× a normal mob's ~90, under the 320 door. **`frameSize: 160`** was
added to the registry as the authored-frame expectation; `footPad: 14` unchanged. **The queued
plug SHIPPED:** the suite reads every pixelScale VIP's PNGs (IHDR, no pngjs) and asserts the frame
matches `frameSize` - a re-export at another size fails the BUILD, not draw time; §54(a)'s pin
flipped to `pixelScale === 1`. Files: monsters.js + main.js + test_suite.mjs + the 3 PNGs. Suite 569.

**Open:**
- **Special Visits: COMPLETE** - mechanics shipped (§12) and the Inspector's art reauthored +
  integrated 1:1 (2026-07-08, above). The live sizing contract is the §13 reauthor record above,
  NOT the superseded §9 `spriteScale: 1.25` spec. Adding MORE VIPs is the deferred item below.
- **itch.io dual-publish: STILL UNDECIDED** (asked 2026-07-05) — decides whether the `butler`
  deploy path is added.
- **Bob-voiced dismiss lines can fire pre-hire** (a ~2-serve window given 40g start vs 50g hire).
  Flagged, not fixed — a `bob: true` gate is the same four-line mechanism as Greg's tag if Daniel
  ever wants it airtight.
- **Swift Wings math note:** divisor form (matches serveSpeed) — 0.25/level reads as **−20%** per
  level, described honestly in the perk text; `perLevel: 1/3` is the lever for a true −25%.
- **Feel dials shipped provisional, confirm on play:** Greg's shadow (`shadowY: 472`), errand
  length (4400ms), turn hops (24px), milestone stagger (2.5s), Greg bubble duty cycle (10s/45s),
  flap fps (8), Beetley patienceBonus (8s), queue
  returnCooldownSec (8 — the steady-state math is in the CONFIG comment; raise with care).
- **DevLog: opted out** (standing — skip at every feature completion).
- **Repo:** `github.com/Cupcakechan/mob-mart` (local folder `mob-mart`).
- **Special "visits"** design (high-rep rare customers) — deferred.
---

## §14 — THE SCRAP SYSTEM + DOUG (design doc 2026-07-08 — **PASS A + PASS B SHIPPED 2026-07-10**)

The "new to obtain" lane (Daniel's call: gold is the only currency and too easily gained). Scrap is
a SCARCE second resource with a sink gold cannot buy, gated behind a third worker.

**Doug — the third worker (a GREMLIN).** A `WORKERS` registry entry (workers.js), third staff after
Bob (serve) and Greg (restock); fills the vacated goblin-worker slot (never actually plumbed).
- Art: 160×160, 6-frame IDLE + 6-frame WALK (960×160 each — matches Bob's bob_idle/bob_serve). Drawn
  1:1 (the sizing lesson — authored at display size, no multiplier; ~160px on screen). frameSize
  suite-pin applies, same as the dragon.
- Walk is reused FLIPPED for the return trip — no separate return anim. "Step into the portal" is
  Doug walking up and the existing portal swirl swallowing him (he occludes into it as it opens);
  the walk IS the step-in. He raids the same six door destinations.
- HIRE gate: a one-time gold cost (like Greg). No Doug, no scrap.
- VOICE: Gollum-esque but his OWN take — third-person self-talk ("Doug found it, Doug did"),
  sibilant + covetous, his own pet word for salvage (his "shinies"/"good bits", NOT "precious"). A
  third register beside Bob's warmth and Greg's bluntness; `doug: true` tag (Greg's mechanism).
  Line trust — written in Pass A.

**Scrap — the second resource.** New state field + a HUD counter using the reserved `icon_scrap.png`
(§9, currently unused).
- SOURCE: TIMED SCAVENGE RUNS — Doug heads out the door portal every N seconds and returns with
  scrap (mirrors Greg's restock timer; independent of sales, easy to tune). The "salvaging the
  aftermath" fiction lives in the FLAVOR, not wired to the sales rate. Offline accrual like Greg's.
- Deliberately SCARCE (slow vs gold's flow) — that scarcity is the whole point.

**The forge — the sink.** Spend scrap to unlock SPECIAL OBJECTS (Doug's salvage finds). WORKING MODEL
(confirm at Pass B): new registry items carrying a SCRAP unlock (like a license, paid in scrap)
instead of a fame-gated gold license; once unlocked they stock + sell with gold like everything
else. Reuses the item + license + shelf system → bounded, and scrap stays the exclusive key.

**Sequencing — two passes:**
1. Pass A — Doug: `WORKERS` entry + hire gate + scavenge duty cycle (scrap yield) + scrap field +
   HUD counter + offline accrual + draw/animation (a drawRunner mirroring drawRestocker) + Doug's
   voice lines. Gated on Daniel's art.
2. Pass B — the forge: the scrap sink (unlock panel + special-objects line + their 64×64 icons).
   Scrap is inert until B, so fold ONE object into A as a proof, or run A→B back-to-back.

**Art (Daniel):** Doug idle + walk (160×160, 6-frame, 960×160 each); 64×64 icons for special objects.

**PASS A — AS BUILT (shipped 2026-07-10; suite 617).** Matches the doc above, with these notes:
- Doug live: Beloved gate (tier 3), 1200g, 24s runs × 2 scrap, offline BOUNDED at 3 runs (6 max
  per absence). Choreography dials (idleFrac 0.3, walkSec 2.6) were PROMOTED into the WORKERS
  registry — the draw (scene.js) and the cameo gate (game.js) share one clock.
- The trickleSpeed LEAK: Swift Wings was scoped to the restock role — unscoped it would have
  silently sped Doug’s runs. Suite-pinned regression.
- HUD deviation from the doc: the scrap chip follows the TEXT-GLYPH convention (⚙); icon_scrap
  stays reserved. The chip broke the 2026-07-07 HUD width budget (the bottom-bar lesson replayed)
  → the row is now LEFT-ANCHORED, the market chip docks at top:68 (fully below the row), budget
  re-measured at the CSS site. **A 4th chip does NOT fit — redesign, don’t shrink.**
- Staging, three fixes: the DOOR moved to the wall layer (drawn with the wall, before all
  characters — Doug approaches in FRONT and melts through, fadeSec 0.45; the shared
  playPortalOpen stays celebrant-only); home x870 (clear of the door’s span, whole body behind
  the desk — window 867-876 documented at the config); his trip speaks the CELEBRANTS’ floor
  grammar (contact plane COUNTER.baseY → doorway climb to PORTAL.baseY with CELEBRATE.depthScale
  — legPos() stages it, sinkFrac/enterFrac are the dials).
- BATTLE CAMEOS (same day): `{ dougOut: true }` lines in the battle tiers fire ONLY while he is
  beyond the door (isDougOut, game.js — same registry clock as the draw). Touchstones + grammar
  in the bible (McGucket / BMO / Tree Trunks; Doug is never the subject — he IS the bathos).
  The template-schema pin now recognizes FOUR tag kinds (cats | minServes | greg | dougOut).
- footPads MEASURED at the 2026-07-10 art recolor (dragon + doug refreshed, dims unchanged,
  frame-size pins green): doug idle 9 (uniform — resolves the launch-day PROVISIONAL 12), walk
  10 (frames 9-12); dragon unchanged (footPad 14 holds).
- The DOUG.height incident → LESSONS 2026-07-10: a scripted deletion ate the neighbor line;
  NaN geometry renders as silent invisibility; the plug is the survivor audit.

**PASS B — THE RELIC FORGE, AS BUILT (shipped 2026-07-10; suite 645).** The working model was
REPLACED by the design reset (Daniel, 2026-07-10 — 'what is the purpose?'): relics are
**ONE-OF-ONES nobody can buy** — the collection meta, not more shelf stock. The loop:
- FIND: Doug's runs roll a find — chancePerRun 1/18 + a pity floor at 25 runs (RELIC_FIND,
  relics.js) — in CURATED order (RELIC_ORDER: key, magnet, potion, cloak); each find is a
  designed beat and a milestone-gold log line. Debug: set chancePerRun to 1, revert before commit.
- FORGE: a section in the Workers panel (no new tab — the 5-tab budget), visible once Doug is
  hired: ??? -> found (card + priced Restore) -> on display. Restoring costs SCRAP + GOLD — the
  two currencies' first shared sink (20⚙+3k up to 60⚙+25k; all TUNABLE, recalibrate at the audit).
- DISPLAY: 3 wall frames + 1 desk slot. THE STAGING MATH (three live corrections, all measured):
  the desk gap between Greg's documented hover box (434-546+sway) and Bob (676) is 125px — room
  for exactly ONE 64px object; frame v1's border box was itself 64×64 (window too small — Daniel
  re-authored at 96×96, window >= 64) and the draw now uses the sprite's NATURAL size so any
  re-author is a pure art drop (suite pins only 'square, >= 80'); desk objects base at y448
  (the surface starts at 413.8 — the sprite-box top 353 floats objects on the wall).
- THE ASSIGNMENT LAW (Daniel's catch): frames fill LEFT-TO-RIGHT in FIND ORDER and the desk goes
  to the object that naturally lives on a desk (the potion) — an empty frame between filled ones
  reads as 'the object fell out'. Recorded in relics.js; future relic batches inherit it.
- NO EFFECTS BY DESIGN: the effect slot stays empty for the Special-of-the-Day repurpose (the
  circle-back step) so the ECONOMY AUDIT measures a clean baseline. Voice: RELIC_VOICE
  (results.js) — found/restored/ambient; ambient fires on 5% of serves. Suite section 58.
- NEXT (locked order, Daniel 2026-07-10): **the ECONOMY AUDIT** (headless sim of a fresh passive
  save — chart when each unlock falls, find where the desire curve dies; total sink stack
  measured at 228,483 gold vs an observed endgame purse 6.4x that), THEN the Special-of-the-Day
  repurpose (relics become the buff carriers via the board/frames idea), with prestige/Franchise
  as the capstone candidate beyond.

---

## 2026-07-11 — THE ECONOMY AUDIT (§0 step 1) — AS RUN

**Shipped:** `sim_economy.mjs` (repo root — the PERMANENT balance harness, deliberately named
OUTSIDE the `test_*.mjs` ignore pattern so it commits with no gitignore change; not shipped —
the ship folder is untouched) + `ECONOMY_AUDIT.md` (the report). **ZERO game-file changes**
(the audit law); suite re-certified 645 green after the pass.

**Policy record (Daniel's options-round picks — B/B/B):**
- Player model = GREEDY-CHEAPEST: every sim-second, restock first (operating cost), then buy the
  single cheapest affordable unbought want per currency (gold: hire/license/upgrade/training/
  relic restore; rep: perks). One authored exception mirroring the tutorial: manual serves only
  until Bob is hired, then hands-off. Yields the EARLIEST-POSSIBLE fall time per want (the lower
  envelope) — a human buys slower, so real wall-clock runs longer, but the SHAPE is
  policy-independent, and the shape is the finding.
- Horizon = EVENT-DRIVEN: run to the last want, +60-min tail (measures the post-death
  accumulation rate), 48h hard cap (cap-hit exits non-zero).
- Report = ECONOMY_AUDIT.md; the harness's printed tables feed it (timeline transcription
  DIFF-VERIFIED against the run output — the landing-zone law applied to docs).

**Harness mechanics (for every future balance question):** drives the real `update()` headlessly
(the suite's technique) at dt 0.1s; `Math.random` swapped for seeded mulberry32 per run — output
is BIT-IDENTICAL across runs (verified 3×; determinism IS the stability proof, the statistical
band is the 5-seed min–max spread). Baseline is CALENDAR-FREE (`marketDayKey` never set → Market
Day + Inspector unarmed, their own headless convention). The want inventory derives LIVE from
the registries (74 purchases today) — new content auto-joins the audit. Dials at the top of the
file (SEEDS / DT / POLICY_SEC / TAIL_SEC / CAP_SEC). **Re-run after ANY economy retune;
before/after runs are the retuning passes' acceptance test.**

**Headline findings (F1–F7 in full in ECONOMY_AUDIT.md §4):**
- Desire curve DIES at **8:18:03** median (spread 8:06:38–8:19:08); post-death **884 gold/min
  ≈ 53k/hour**, still climbing (977 by the tail's end — the milestone ladder never stops). The
  observed 1.46M purse ≈ 27.6h of post-death play: the runaway is fully explained.
- **Variety dies at ~1h50m:** all fame tiers by 1:05, all hires by 1:30, all licenses by 1:35
  (Knight Helm — "the top-shelf goal" — falls 95 minutes in), all perks by 0:54, all upgrades by
  3:35. From 1:52 (first training rung) the curve is 77% training metronome + 3 restores; from
  3:55 it is PURELY ten deep rungs + the final restore (~4.4h of two alternating buttons).
- **The Mythic gate is INERT:** falls at 1:05, 47 min BEFORE the first training rung is
  affordable — the deep band's tier gate never gates anything. Lifetime rep at death ~135k vs
  the 5,000 threshold: the whole tier ladder sits in the first ~4% of a run's rep.
- **Scrap is a second runaway:** ~1,860 banked at death vs 155 ever spent (~12×); economically
  dead ~2h after Doug's hire. Doug supplies 5 scrap/min.
- **Relic finds burst, restores pace:** median seed finds all four within ~13 min of the hire
  (math agrees: pity-TRUNCATED geometric mean is 13.7 runs ≈ 5.5 min/find, not the naive 18);
  the RESTORES space themselves via gold (2:29 / 3:20 / 3:56 / 8:18) — the Everything Cloak
  restore IS the death event in all five seeds.
- **Early game verified healthy** (a want every 2–3 min across five systems for the first hour)
  — nothing in the first ~90 minutes needs touching.

**Proposals (P1–P6, full text ECONOMY_AUDIT.md §5 — NOT applied; each retune is its own pass):**
P1 size repurpose/prestige from the measured rates (prestige's first-reset anchor: 150k–400k
against ~53k/h); P2 re-seat Mythic's `tiers[6].min` (25k–40k band candidate — the ONE-VALUE
retune; re-place it with the harness); P3 do NOT nerf deep-rung prices (healthiest pacing on the
curve — the gap is variety, not cost); P4 recurring scrap sink at the repurpose (sized vs 5
scrap/min); P5 a Mythic-gated 5–10k license rung for future gear batches; P6 find pacing is a
feel call (chancePerRun 1/18 → ~1/45 spaces finds ~18 min apart, if wanted).

**Pass learnings:** (a) statistical claims in a report get PROBE-VERIFIED before shipping — the
F5 numbers looked too fast, a Doug-alone isolation probe showed the mechanic sound and MY
expectation wrong (the pity floor truncates the geometric: mean 13.7 runs, not 18); (b) machine
tables transcribed into a doc get diff-verified against the source output, whitespace-normalized
— same law as scripted edits: verify the landing, not the intention.

**NEXT:** economy retuning pass 1 — open with an options round over P1–P6 (Daniel's pick), one
lever-set per pass, harness before/after as acceptance.

---

## 2026-07-11 — THE RETENTION RESET — the Mythic sweep, the research, and the Trade Market design (doc pass)

**How the day went:** retuning pass 1 opened as planned with its options round — and got
redirected into the biggest design decision since 2026-07-10. Daniel challenged
prestige-onto-an-unchanged-loop ("what does prestige even do if the gameplay loop stays
exactly the same?"), named the symptom precisely (spider and demon would "add nothing other
than more quirky lines"; VIPs likewise; "we are missing a fundamental element"), commissioned
deep genre research, and then found the root cause himself: **gold is a universal solvent**,
and "always stocked with everything" kills commissions before they exist. His TRADING model —
daily-rotating material+gold rates for trade-tier stock; no crafting fiction, Bob TRADES —
became the locked direction.

**The Mythic sweep (measured before the redirect; P2 PARKED, data preserved here):**

| `tiers[6].min` | Mythic falls | first deep rung affordable | death |
|---:|---:|---:|---:|
| 5,000 (live) | 1:05 | 4:16 | 8:18 |
| 25,000 | 2:41 | 4:20 | 8:18 |
| 32,000 | 3:07 | 4:18 | 8:16 |
| 40,000 | 3:35 | 4:20 | 8:20 |

Death doesn't move — P2 is a HORIZON retune, not a curve extension. Even 40k opens ~45 min
before the deep band is affordable; a literally-binding gate needs ~50k+ and creates a WANT
DESERT (gold piling with nothing purchasable), which is worse than an inert gate. Rep is
serve-driven, so Mythic's fall time is nearly policy-independent — real players get wider
margins than greedy. Verdict when picked up: 40k recommended; cost is one config value + two
§53 suite assertions (the suite pins `min === 5000` literally). Validity note: the sweep ran
at 791ce2e; the missed ed8f243 was doc-only (verified `git show --stat`), so the data stands.

**The research:** `RETENTION_RESEARCH.md` — repo-resident from this pass (also lives in the
Claude project knowledge). Twelve reference games (Clickpocalypse II per Daniel's flag, Soda
Dungeon, Melvor, Cookie Clicker, Realm Grinder, Antimatter, Kittens, Paperclips, AdCap as the
cautionary case, NGU, Leaf Blower, Idle Slayer) distilled into a ranked framework: meaningful
EXCLUSIVE decisions first (our greedy-bot-optimal audit result is the textbook
counterexample), new VERBS unfolding over time, rule-changing prestige, discoverable
synergies, allocation, timed active moments, collection as a support beam, legibility,
humor/fair-F2P.

**The design:** `TRADE_MARKET_DESIGN.md` — locked at DIRECTION level, all numbers deferred to
per-pass options rounds with the harness as referee. Carries: the material roster (Daniel's
ten PixelLab icons, source-mapped and LOCKED same day — see NEXT), the six economy laws, the Trade Market spec (seeded daily rates + forecast on
the reworked Special board), expeditions (family mastery via Bestiary counts; NOBODY DIES —
the battle-log gag and the supply loop are split loops), hard relic restores + economy
effects, commissions, offline party management, Franchise-as-factions, the 8-step locked
sequence, and the disposition of P1–P6 and of the research's own pass order (inverted —
relics are now downstream of materials).

**Pass learnings:** `git pull 2>&1 | tail -1` MASKED AN ABORT — a pull can print
"Updating x..y" and still abort on a dirty tree, leaving HEAD behind; caught only when the
log line contradicted the pull line one command later. Standing rule now: after every pull,
confirm `git log -1` equals the expected remote tip before any work. (Benign this time — the
skipped commit was doc-only, verified — but only by luck.)

**NEXT:** MARKET PASS A opens with its options round. Design doc §13 was answered the same
day: Dragon → Dragon Scale (tenth icon authored); Skeleton, Rat, and Beetle named as future
customers owning Femur / Trinket / Carapace; the Inspector — himself a dragon, glasses and
clipboard — keeps the Seal as the first VIP rare-material faucet (drop-per-visit vs
drop-on-passed-inspection is a later dial). This also closes the ancient "rat still an open
call" note from the §13 art record: the rat is in, as a thief.

---

## 2026-07-11 — MARKET PASS A — AS BUILT (the reform's first shipped system; suite 645 → 701)

**The build (18 files; commit 3bd9307):** the materials substrate + the Trade Market, per
TRADE_MARKET_DESIGN.md with Daniel's B/A/A/A options-round picks (per-Nth-serve drops / flat
CONFIG caps / board + Shelf-panel-strip surface / Iron Sword as the proof).
- **Registries:** `src/data/materials.js` (all ten materials; six live) + `material` /
  `materialEveryNServes` fields on the six live monster rows (slime 4, bat 4, rat 4,
  skeleton 5, beetle 5, frog 6 — RETUNE PENDING, see §0). A new customer family becomes a
  faucet by one registry field — the auto-flow law held.
- **The drop law** (serveCurrent): `servedNow % N === 0` sheds one material — deterministic and
  plannable; SPECIAL rows never drop (the Inspector's faucet is Pass B). First-ever landed drop
  per material speaks a TRADE_VOICE discovery line (the lifetime ledger `stats.materialEarned`
  is the latch — no new save flag). A FULL store LOSES the drop; lost drops never enter the
  ledger (the cap must bite — CONFIG.materials.baseCap 10, per-material override guarded).
- **The market** (`src/data/trademarket.js`, pure): offers are a pure function of
  (dayKey, itemId) via the board's own FNV hash family — no Math.random anywhere in the file;
  recipes draw ONLY from live-faucet materials (eligibility law); bands are CONFIG.trade dials
  (1–2 types × 1–2 units + 30–90g). `state.tradeDayKeyOverride` (transient) is the headless
  seam — the calendar-free baseline law holds with zero arming.
- **The proof:** iron_sword `acquisition: 'trade'` — the license stays the SELL gate; stock
  arrives only via `executeTrade` (validated against the CURRENT day's offers by key, so a
  button held across midnight refuses at yesterday's rate). **The exclusion sweep:** canRestock
  is the single gate (restockItem / restockAll / canRestockAll / Greg's trickle inherit), plus
  the three bypass sites the recon flagged — restockAllCost (the quote), dealCrateUnits
  (Market Day crates), and the OFFLINE BACKROOM RESERVE (real traded shelf stock still sells;
  the reserve conjures nothing).
- **Surfaces:** the canvas board is the MARKET BOARD — header + today's offer, chalk rewrite on
  midnight rollover, and (Daniel's browser-QA call) **CURRENT TRADES ONLY**: the voice /
  daily-special row was CUT as clutter; the Market-Day event keeps its log/payout/crate and
  gets a designed board home (or retirement) at Pass B. The Shelf panel gained the Market
  strip: offer text, per-material `n/cap` chips (auto-built from the monster registry; icons
  drop-in via the item convention), Trade button with block-reason tooltips. Materials stay
  OFF the HUD (law 4). All ten icon PNGs are IN (the reserved four wait for their faucets).
- **QA fixes shipped inside the pass:** the board voice-row OVERPRINT (probe-confirmed root
  cause: `wrapBoardText`'s ellipsize guard fires after the first push, so `maxLines=1` returns
  every wrapped row — the trap is now documented at the function; single-row callers must
  self-ellipsize) and a font-mismatch overflow (offer rows measured in quipFont, drawn in the
  wider nameFont — measurement now font-correct).

**Suite 701** (645 + 56, section 59): registry pairing, the drop law, cap clamp + honest
ledger, offer purity / eligibility / bands / rotation, exact trade math + the stale-key
refusal, the full exclusion sweep, offline reserve, save round-trip + corrupt guards. Three
old license tests were RE-POINTED to greater_flask as their specimen (same 800 / Renowned
math) — iron_sword's new behavior is §59's to pin, per the derive-don't-pin doctrine.

**ACCEPTANCE — PASS (the reform's first measured proof):** the harness grew the market-aware
policy plus a market-BLIND control (`runSim(seed, { tradeAware:false })`), synthetic
`sim-day-N` keys rotating every 24 sim-hours. The blind bot dies **3:32 later** (median;
11:52–12:25 vs 8:19–8:55), forfeits **all ~350–400 sword sales**, and its post-death rate
craters to **~545 vs ~870 gold/min** (the queue-stall tax of an empty trade shelf). For the
first time, ignoring a system costs the optimal player. Aware median death moved 8:18 → 8:32:
trades are a genuine RECURRING gold sink (~360–410 per run). 3× bit-identical.

**Corrections recorded (LESSONS.md, 2026-07-11 ×3):** the design doc had marked Skele / Ratty /
Beetley "future customers" (LIVE since 2026-07-05 — so Pass A shipped SIX faucets, not four)
and imagined a second dragon (the game's one dragon IS the Inspector; both dragon materials
are his, drop design = §13.1, Pass B). Also entered: the unterminated-heredoc silent no-op and
the pull-that-printed-Updating-but-aborted. Docs corrected in the same commit.

**Open dials leaving this pass:** the drop-rate retune (§0 NEXT — Daniel's numbers pending);
§13.1 the Inspector's Scale/Seal design; §13.2 the basic-vs-trade tier line. THEN the fork:
Spider + Demon, or Market Pass B.

---

## 2026-07-11 — REFORM STEP 3 + THE RETUNE — Demmy, Leggsy, and the trend line (commits cf73385 / fb4ea4d / 6c8bc58)

**THE DROP-RATE RETUNE (cf73385, Daniel's browser feel → his "go" on the proposal):** the six
`materialEveryNServes` → slime 10 / bat 10 / rat 10 / skeleton 12 / beetle 12 / frog 15
(~2.5× rarer, ~1 material/min roster-wide early). DETERMINISM KEPT — rarity and randomness are
independent levers, and "gold always given" was already true (drops ride payment). §59 derives
N, so the suite held at 701 untouched.

**DEMMY (fb4ea4d — reform 3a, Daniel picked Option 1 + the name):** the APOLOGETIC MENACE.
combatMod **+2** — the roster's first winner, opening the log's victory-as-apology register
(all five tiers authored; his excellent/success lines are apologies, his failures are relief).
Top budget **[20,36]**; weapon lead beside Skele; **iron_sword ×3 signature = the market's
demand engine** (the organic answer to the thin sword margin the retune measured). Ember
faucet N 15. Art: footPad 10 MEASURED, content 81–84% → trio-class, NO scale.

**LEGGSY (6c8bc58 — reform 3b, Daniel picked Option 2; the name was Claude's call):** the
OVERSTOCKER. The **`bulkBuyer` quirk** shipped: ONE serve moves TWO units when the shelf holds
≥2 and the purse covers double — full per-unit payout including tip (the offline convention),
ledger counts both units, ONE visit/fight/report/rep (rep rewards service), and a
**skip-guard** speaks any breakpoint a two-unit sale jumps over (the multiplier math was
already total-derived and immune; the LINE was what needed guarding). Graceful degrades pinned
both ways: shelf-of-one sells one, purse-covering-one buys one, non-bulk rows never double.
First DEMAND-SIDE pressure on stock depth. Budget [14,28]; bandages ×3 / zip_tonic ×2
signatures (pairs of bandages IS the joke); silk faucet N 12. Art: footPad 12 MEASURED,
spriteScale 1.05 — was PROVISIONAL, **CONFIRMED by Daniel's browser QA same day** ("size is
right"); the registry comment still says PROVISIONAL and gets its one-word update on the next
pass that touches monsters.js.

**The suite's authoring standards earned their keep:** the 80-char log budget and the
no-second-person hygiene pin (2026-07-05 era) caught FIVE of Claude's first-draft lines across
the two passes — including "thank-you" tripping `\byou\b` through the hyphen. The @50 batch
pin enforced exactly-three gated lines per new monster. Suite arc: 701 → **720** (Demmy, §60)
→ **745** (Leggsy, §61); the exact-totals doctrine applied twice on the way (§59's and §60's
roster/faucet exacts softened to rules as each newer batch took the pins).

**The harness trend (every run 3× bit-identical):**

| pass | aware death | blind penalty | reading |
|---|---:|---:|---|
| Market Pass A (N 4–6) | 8:32 | +3:32 | the market's teeth, first bite |
| the retune (N 10–15) | 10:22 | +1:22 | scarcity slows sword uptime |
| + Demmy | 12:11 | +1:00 | dilution slows milestone compounding |
| + Leggsy | **11:20** | **+0:40** | bulk income pulls back ~50 min |

The reform holds the desire curve **~3h past the audit's 8:18 baseline** with expeditions
still unbuilt — and the narrowing penalty is the market saying it is SUPPLY-BOUND (trades
144–175/run, every traded sword sells). That data made the sequencing call in §0: expeditions
(the designed supply reopener) leapfrog Market Pass B.

**Workflow notes:** (a) Daniel is re-fixing existing character art incrementally — expect
ROGUE PNG diffs in `assets/sprites/` (bat_walk_happy already churned, 3467→3159 bytes); they
are his workflow, not errors — the suite's dimension pins are the guard, and flyers' bottom
padding (the bat's hover altitude) is his visual QA. (b) The standing pull-law caught an
UNPUSHED Leggsy commit before this handoff recorded false state — the tell, worth knowing:
`git log -1 --oneline` shows `(HEAD -> main)` alone when the remote is behind, and
`(HEAD -> main, origin/main)` once the push has landed.

**NEXT:** Expeditions MVP opens with its options round (§0 carries the agenda).

---

## 2026-07-11 — EXPEDITIONS MVP (reform step 4) — the supply valve, and the gap re-widened (commit c4905f9; flake fix 2179971)

**The build (11 files; Daniel's A/A/A options-round picks — Bestiary-card surface / flat
economics / dice-driven mishap):** `CONFIG.expedition` (fee 25 / durationSec 60 / haul 3 /
mishapChance 0.25 — one dial block); the persisted ONE-slot run (`state.expedition =
{ monsterId, dest, remaining }` — a reload resumes the clock; a corrupt/hand-edited run drops
WHOLE in the merge, fee gone, crash never; the clock clamps into the config band); the
`stats.expeditions` per-family ledger (family mastery's first hook — counting only, effects
are a later conversation); `canStartExpedition` / `startExpedition` / `resolveExpedition` +
the update() tick (whole-second edge marks uiDirty, so the countdown renders at 1Hz without a
60fps panel re-render); away time credited at boot (main.js, BEFORE the offline modal — the
return line lands under the away summary where it belongs; uncapped on purpose, a 60s run
never needs Bob's offline hours); the family pick IS the targeting (send slimes, get Cores);
destinations are the six doors' flavor names; a mishap is HALF ROUNDED UP, never zero, NEVER
death (split loops — the battle log's gag untouched). Surface: the Bestiary grid cards became
JOB CARDS (run count / live countdown / Send button with reason tooltips) — **temporary BY
INTENT** (Daniel: a pure-lore Bestiary is a wanted later surface; the console moves then).

**A stagger lesson mid-pass:** the return line vanished in the suite — probe-confirmed the
MILESTONE STAGGER was queueing it behind the departure line (one 0.1s test tick never drained
it). The fix was semantic, not test-side: expedition lines are EVENT ANNOUNCEMENTS, so they
ride tier `'market'` (the Inspector-grade-line precedent — instant, stagger-bypassing).

**Suite 768** (745 + §62's 23: gates, the one-slot law, both resolve paths on forced dice, cap
clamping on bursts, away-credit math, save round-trip + corruption guards) — certified 3×.
Also this era: the **frog spawn-rate flake** (commit 2179971) — a frozen `> 40/400` floor went
marginal at nine monsters (expected 50, a −1.5σ draw failed ~1 run in 15, and it had survived
each pass's certification runs by luck); the floor now DERIVES from the live spawnable count
at 4σ, 12× certified.

**ACCEPTANCE — both verdicts PASS, 3× bit-identical:** market-blind loses **3:43**;
expedition-blind (trades, never sends) loses **3:10** with sword sales 88 vs ~620 — the
pre-expedition +0:40 gap RE-WIDENED to hours, which is this system's entire job. **The honest
flip side, flagged at ship:** the full-aware bot's death returned to **8:18 — the audit
baseline** — because 60s/25g lets an optimal player run continuously (~50 runs/hour, 367–401
per playthrough). The DECISION layer is real (both blind bots lose hours); the PACING dial is
wide open. Levers when Daniel's feel asks: `durationSec` first (180s ≈ 20/hour), fee second —
and his own asks (fee up + fame-tier discounts) live in §0's parked list alongside WORKER
WAGES (the first perpetual-sink proposal) and the Job Board's future home.

**Rogue-art note (the standing workflow):** rat_idle + rat_walk_happy re-authored in this
commit (the walk 16k → 3.7k — a cleaner export). Dimension pins held; if Ratty's feet read
wrong in the next session, his registry footPad is one pngjs re-measure away.

**NEXT:** Market Pass B's options round — §0 carries the accumulated agenda (the tier line and
the Inspector's drops both want Daniel's §13 calls).

---

## 2026-07-12 — MARKET PASS B (reform step 2, out of order by design) + the UI-fix saga (one combined commit)

**Daniel's calls that shaped it:** the tier line moved from "the license rung" to **"base
objects and workman's goods GOLD; upgrades and premium no-base goods TRADE"** — ten items,
row-confirmed (iron_sword, greater_flask, knight_helm, quiver, zip_tonic, iron_buckler,
iron_gauntlet, silver_key, spiked_club, iron_shield; murk/bracer/pickaxe/map/salt stay gold
with their licenses). The Seal's destiny: **relic-restore material** (the eligibility law's
`!special` filter already reserves it — zero code needed for the reservation). His churn
observation ("trade a sword, someone buys it, you're out again") is a NAMED future pass
(fill-to-cap trading — design doc §13b). D6 surface: the Shop tab hosts the list NOW; the
clickable-board → Trade Market overlay is the designed follow-up; a true Market room parked.

**As built:** nine acquisition flips (count-guarded script); recipe gold DERIVES from
basePrice (CONFIG.trade goldMultMin/Max 1.2–3.5 — the margin dial); Inspector drops registry-
driven on the dragon row (material/gradeMaterial; `sealFullness` 0.9) with INSPECTOR_VOICE
lines, drops land inside the inspection block in serveCurrent; the board renders ICONIC
offer segments (`describeOfferSegments` + the `drawOfferRow` closure — icons 20px headline /
17px forecast, centered on the text line, chalk write-on preserved, missing-PNG "×n"
fallback) with the featured offer + "Tomorrow:" forecast row (`featuredOffer` /
`forecastDayKey`, deterministic both live and headless); the Shop tab's offer list is ICONIC
and CATEGORY-FILTERED (the shelf tabs govern it); material chips = count-only, all TEN
sourced materials, cap in the tooltip; `main.js` gained ten explicit material `loadSprite`
registrations (the canvas board's getSprite needs them — the pairing scan only sees
literals, which is WHY they were explicit, not a loop).

**The QA saga (the LESSONS 2026-07-12 entry, read it):** the category filter shipped broken
behind a CSS SPECIFICITY TIE (`.offer-row{display:flex}` appended late beats `.hidden` by
order — fixed with the scoped `.offer-row.hidden` override, the house pattern; §63(f)
text-pins it), a jsdom probe that certified the bug as working (it asserted the CLASS, not
the computed display), and Daniel's browser serving STALE CSS while running fresh JS (the
structural fix: both shells now load `style.css?v=6` — bump the version on CSS changes).

**Suite 768 → 804** (§63: tier exacts, derived gold bands, Inspector drop tests, forecast
determinism, segment guard, the cascade text-pin; the three license tests now DERIVE their
specimen — greater_flask joining the tier broke the Pass A swap; §0b pairing scan extended
with material iconIds as consumers). **Harness:** policy works ALL offers; **the metric
evolution** is §0's headline (rate advantage replaces death delay — the finite checklist is
no longer the game); aware 26:43 / +20% / +17%, 3× stable.

**Still owed, small:** Leggsy's spriteScale registry comment says PROVISIONAL — Daniel
confirmed 1.05 ("size is right"); the one-word update rides the next monsters.js touch.
Daniel's excerpt attachment (2026-07-12) arrived EMPTY — flagged; he may repaste.

**NEXT:** the three-item UI round (§0), then the relic rework's options round.

---

## 2026-07-12 — THE MARKET ARC (five passes + the price fix; suite 804 → 1551)

**The session's shape:** Daniel's queued UI round (§0) opened it, then his redirect — "explore
new ways of displaying the trade board" — grew it into the arc. Passes, in ship order, each
browser-confirmed:

**0. The price-color fix (commit 4b03436):** `.item-price` gold-on-tan → `#6b4a1e` (the
trade-hint's exact treatment); the mis-hit history ended by pinning the actual element at HEAD
first. First use of the CSS cache-bust ritual post-lesson (`?v=7`).

**1. THE TRADE MARKET OVERLAY (D6-B pulled forward — Daniel's Option 2; commit c0b788f, suite
856):** `src/ui/market.js` owns the surface — full-material-name offer rows (the readability fix
the 430px strip could not fit; `offerRowHtml` is PURE and suite-proven), the Special headline,
chips with caps, the forecast line; sim runs under it (the menu's idle-honest law). The canvas
gained its FIRST click handling: `boardHitRect()`/`pointOnBoard()` DERIVE from SPECIAL_BOARD
(a re-hang moves the target), client→stage coords divide out the scale transform via the
canvas's own rect. The strip slimmed to count + chips + Open Market. §64; the §63 license
specimen tests survived untouched.

**2. THE DAILY SPECIAL (Daniel's Option 3 — both cuts; in commit 87adc7b, suite 1496):** his
call and his reasoning: gold-only discounts decay because gold is the runaway currency. Dials
`CONFIG.trade.feature { goldMult: 0.6, matUnitsOff: 1 }`; applied ON the offer object in
offersForDay (one hash, one mark, ONE PRICE — board, overlay, executeTrade can never disagree);
origGold/origMaterials ride for the was/now strike-through; all-1s recipes get the gold cut
alone (the material cut is lumpy BY NATURE — the Market-Day escalation hook). §63(b) softened
per doctrine (band law reads pre-discount gold); §65 owns the exacts (40 sim-days). **The
acceptance metric moved here: aware +24%/+22% (from +20%/+17%), death 26:07 (from 26:43), 3×
bit-identical — the discount strengthened the market's pull, working as intended.**

**3. THE SALE SIGN (Daniel's Option 2; commit 87adc7b — COMBINED with pass 2, see the LESSONS
entry on the cancelled checkpoint; suite 1510):** Daniel's design key — "the Market Board is for
the player, not the lore." `boardLines(state)` derives "TODAY: <item> — <pct>% OFF" (pct from
the live goldMult — the sign undersells; the material cut makes the real deal deeper) +
"Tomorrow: <item>". Recipe overflow on the plank is now STRUCTURALLY impossible. Pure-JS pass.
`describeOfferSegments` kept alive with no live consumer — the ticker's likely renderer.
nameFont/quipFont have headroom for bigger lettering now (one-value tune, unexercised).

**4. THE LED TICKER (Daniel's Option 3 — REAL movement; commit 732b2c4, suite 1544):**
`yesterdayKey` (the forecast's mirror) + `tickerSegments` — one ▲/▼ per tier item from
today-vs-yesterday PRE-DISCOUNT gold (the special's cut is a sale, not a market move),
interleaved with day-seeded `TRADE_VOICE.ticker` quips ({mat} from eligibleMaterialIds — new
materials flow into the jokes). Full-bleed crawl at the overlay card's base; amber LED glow;
seamless −50% loop with the content doubled; rebuilt on DAY ROLLOVER ONLY (`tickerKey` — an
innerHTML reset restarts the CSS animation and uiDirty fires every serve);
prefers-reduced-motion shows it static. Motion-law note: constant motion is fine on a SUMMONED
surface. Riders in the same commit: the card trade-hint reworded + wired as a Market door; the
board hit rect drives a hover cursor. §67 includes the bible's ≤80-char law checked AT RENDER
against the longest registry name.

**5. GREG GOLD-ONLY (the Greg-chip fix — Option B shipped-and-retired, Option 2 final; suite
1551, uncommitted at handoff-writing, the checkpoint rides with this doc update):** Daniel's
screenshot: "Iron Buckler out — Restock ◆ 6" — a gold quote on material-made stock. The reform
had guarded every restock PATH (canRestock's acquisition check, so no economy leak — the click
was safely dead); the MESSAGE layer was the missed consumer. The first fix (trade-mode door)
nagged in play — trade outages are the STEADY STATE under single-unit trading — and was retired
same-day for the gold-only filter on BOTH sides (renderPanels' target pick + game.js's cycle
trigger, cross-referenced). `gregBubbleFor` is pure, returns null for trade targets; §68 pins
the exclusion. The full arc: LESSONS "steady-state messenger" entry.

**Workflow notes:** (a) the combined-commit slip and the half-run shell chain are LESSONS
entries (both 2026-07-12) — read them at the next harvest. (b) `TRADE_MARKET_DESIGN.md` §13b's
overlay entry marked SHIPPED this session (one-line edit riding this doc commit). (c) The
overlay's Trade buttons re-validate offer keys against the CURRENT day (executeTrade unchanged)
— a stale open overlay can never trade yesterday's rates; worth remembering when the churn pass
adds fill-to-cap.

**NEXT:** the relic rework's options round (§0 carries the agenda and the new parked items).

---

## 2026-07-12 — THE RELIC REWORK (reform step 5; suite 1551 → 1611; commit 51e2ec3)

**Daniel's design calls, in his words where it matters:** Option 2 of the round ("the gag IS
the effect"); scrap ×3 "at least" with gold and materials raised; **all four require the Seal**
("as we add more VIPs and Relics, it will change"); **"Relics should be end-game items that
will carry over in Prestige"** (the BINDING law, recorded in relics.js's header, §0, and here);
and the Seal cliff → slope ("players don't know when an inspector comes... may feel frustrated
in missing out since they can['t] monitor the game 24h").

**The locked table (relics.js — §69's exact pins):** Key ⚙60+◆5k + 6 Femur Charm + 6 Echo Fang;
Magnet ⚙90+◆10k + 8 Stolen Trinket + 5 Silk Bundle; Potion ⚙135+◆20k + 8 Slime Core +
6 Bogstone Bauble; Cloak ⚙180+◆40k + 8 Carapace Shard + 8 Infernal Ember — plus **1 Seal
each**. Cap law: every line ≤ the BASE cap (a cost can never require its own effect); §69 pins
it. Totals: 465 scrap / 75k gold / 55 units + 4 Seals.

**The effects (relicEffects() in game.js — guarded folds, future relics cost zero wiring):**
Key = mishapChanceMult 0.5 (the roll site); Magnet = combatBonus +1 (resolveCombat's new
guarded third param); Potion = yesterdayRates (currentTradeOffers swaps to yesterday's offer
where its GOLD is lower — yesterday's SPECIAL price included, that IS the gag; imported offers
drop the featured mark, carry rateDay:'yesterday' for the overlay's tag, keep yesterday's key
— the midnight guard holds); Cloak = capBonus +2 (materialCap). The Forge shows each
effectCard once displayed — the rule is visible where it was earned.

**The Seal slope:** sealChance = min(1, fullness / sealFullness) at the inspection —
0.9+ keeps the old guarantee EXACTLY, half-stocked ≈ 50%, empty earns nothing. §63's old cliff
tests survive at the slope's fixed points; §69 owns the middle with dice DERIVED from the live
inspectionGrade (the guessed-dice lesson).

**THE INSTRUMENT'S SESSION (read the two LESSONS entries):** the first sim run capped all five
seeds at 48h with exactly 4 wants left — **sim_economy's world had never spawned the dragon**,
so the Seal had no source (the missing-dragon lesson: when a pass changes what a resource
GATES, sweep the world-model consumers). Fixes, all in sim_economy.mjs: (1) a once-per-sim-day
inspection at Legendary+ through the REAL grade + slope on the seeded die; (2) **the reserve
rule** — the aware bot hoards found-relic material lines (the greedy drain was spending them
on trades forever); (3) expedition targeting includes found-relic restore deficits; (4)
CAP_SEC 48h → 168h (the arc is a ≥4-day project BY DESIGN). Verdicts then: **PASS +34% /
PASS +29%, 3× bit-identical; median death 96:00 (72–96h), quantized to inspection days.**

**The three findings** live in §0's NEXT block — the trade-vs-hoard sign flip (Daniel has NOT
ruled), the ~1M purse at death (worker wages promoted), and the inspection-day quantization
(more VIPs will smooth it, per Daniel's own note).

**NEXT:** Commissions (step 6) opens with its options round — §0 carries the full agenda and
the parked queue.

---

## 2026-07-12 — COMMISSIONS (step 6) + THE CHIP RETIREMENT + the session that died (a5e6836, 18be9de)

*This session's handoff update was never written — the session died mid-work (below). This
section reconstructs it from the committed code and the recovery brief; design rationale that
lived only in the dead transcript is gone, but every shipped fact here is read from HEAD.*

**1. COMMISSIONS (reform step 6 — Daniel's Option 2, THE NAMED CLIENT; a5e6836, suite 1652):**
a roster monster places an order for TRADE-TIER goods against a deadline counted in MARKET
DAYS — the same clock the rotating rates and forecast run on, so "hold stores? trade today?
wait for tomorrow's rate?" is ONE planning loop (design doc §8's whole point). The load-bearing
mechanics, all suite-pinned in **§70**:
  - **Determinism contract** (same standing as trademarket.js): `commissionForDay(dayKey,
    itemIds)` is a PURE seeded function — `mulberry32(hashDayKey('commission:'+dayKey))`, no
    Math.random — same day + same licenses = same order; a reload can never reroll the client.
    Eligibility law applied: game.js passes the LICENSED trade tier, so an order can never
    demand what the shop may not legally sell; null when nothing is eligible (early game stays
    commission-free by construction). Client from the live non-special roster (the Inspector
    inspects; he does not queue up orders).
  - **`dayIndexOf`** makes both key families comparable integers — calendar 'YYYY-MM-DD' via
    Date.UTC (DST can never make adjacent days differ by anything but 1) and the harness's
    'sim-day-N'; any other shape returns null and the deadline machinery IDLES rather than
    guesses.
  - **Terms derive LIVE at fulfillment** (`commissionTerms`): per-unit = basePrice ×
    itemGoldMult × globalGoldMult × `premiumMult 2.0` — the payout law holds, basePrice
    untouched; rep = flat `repPerUnit 3` per unit. A persisted order can never mint a stale or
    hand-edited price. Deliberately OUTSIDE the formula: Market-Day event mults and Bob's
    saleTip. The premium buys TENSION, not wealth (finding ii's ruling: worker wages, not
    commissions, are the planned perpetual drain).
  - **Zero-penalty lapse** — the comic beat IS the cost (COMMISSION_VOICE.lapsed, the client's
    exit line). Fulfillment deliberately does NOT touch stats.itemSales (loyalty ladders count
    COUNTER sales; a side-channel increment would advance breakpoints silently).
  - CONFIG.commission bands: count 2-4, deadline 2-3 market days, checkSec 5. Surface: the
    market overlay's "Special Order" card (`mkt-commission`; its Fulfill button shares
    .offer-trade, scoped by [data-item]); results.js gained the commission line pools;
    save.js persists the order (additive, SAVE_VERSION unchanged). sim_economy gained
    comm-aware/comm-blind policies.

**2. THE MARKET DAY HUD CHIP RETIREMENT (Daniel's call; 18be9de, suite 1656):** the chip and
its compact banner removed from initHud/renderHud (imports dropped, CSS removed); the EVENT
SYSTEM is untouched — the log line, Bob's bubble, and the away modal still name the day's
event. Rationale: board + forecast + ticker carry the market now; the chip predated all
three. **§71** pins the retirement. **F4 (demand surface) is the chip's designed successor** —
an ambient home for today's DEMAND rather than a corner banner.

**3. DECISIONS LOCKED MID-SESSION (approved by Daniel, binding; decision log =
FAME_ECONOMY_DESIGN.md §9):** Fame reform = **Option 3** (fame as generated level track +
prestige currency), split **F1a now / F1b with step 8**, offline fame haircut approved.
Commission **B1 = Option 1** (hard reserve + awareness bundle), queued behind the arc with
B2/B3 and the Greg-perk visibility gate (§0's parked item (g)).

**4. THE SESSION DEATH — infrastructure, NOT a game bug.** After building F1a (twice
suite-green at 1667/0, uncommitted), the session entered what looked like a terminal bug loop.
The postmortem, so it is never re-litigated: the post-F1a acceptance sim exceeds the
container's execution limits — foreground tool calls cap ~600s, background nohup does not
survive tool-call boundaries, and the reform's slower progression pushes exp-blind control
seeds to the 168h cap each (the pre-F1a 10-15min full sim was already a warning). A parallel
recovery attempt failed three ways at once (`cd X && nohup A & nohup B &` runs B from the
ORIGINAL cwd; the two that launched OOM-killed at ~1.5-2GB each on 4GB). The "loop" itself was
a **self-matching progress probe** — `pgrep -f sim_economy` caught the polling shell's own
command line, reporting a dead process as running for ~20+ minutes. RULED OUT in-session (do
not re-suspect): fameLevel's while loop (terminates; HUD-only, not in the sim path),
reputationTier (bounded), log growth (pushLog is capped). F1a itself died uncommitted and was
recovered from the delivery zip Daniel retrieved from the dead chat. **Five LESSONS.md entries
(2026-07-12, the probe/ceiling/cwd/OOM/deliver-first set) carry the encoded rules.**

**NEXT:** the F1a recovery (the section below), then the certification options round — §0
carries the full agenda.

---

## 2026-07-12 — F1a: FAME LEVELS (the recovery session; c10810b, suite 1667; HARNESS-CERTIFIED)

**The recovery:** the verified zip (six files: FAME_ECONOMY_DESIGN.md new + config.js,
reputation.js, offline.js, ui/hud.js, test_suite.mjs) applied over a clean `18be9de`; suite
**1667/0** — the fourth green run of the identical bytes (twice in the dead session, once in
Daniel's 2026-07-12 recovery check, once at application). Browser-confirmed by Daniel and
**committed BEFORE any certification attempt** — the deliberate inversion of the dead
session's core process error, which held a finished, twice-green pass hostage to a
certification that structurally could not run, and lost it when the session died.

**The design (`FAME_ECONOMY_DESIGN.md` is the arc's home; §4 is this pass's spec):** fame
becomes the game's LEVEL track; **lifetimeRep stays the currency, unchanged — no save
migration.** `levelThreshold(n) = round(25 × 1.6^(n−1))` lifetime fame to BE level n; infinite
headroom by construction; the two dials in CONFIG.reputation.levels ARE the curve. The seven
names survive as RUNGS anchored at levels — Neutral L0, Friendly L2, Trusted L6, Beloved L10,
Renowned L13, Legendary L17, Mythic L20 — and each rung's `min` DERIVES from the curve at load
(config.js's tail): **one source of truth.** Calibrated against the harness income fit
rep(t) ≈ 3000·t^1.2: Friendly ~first minute, Trusted ~10min, Beloved ~40min, Renowned ~2h,
Legendary ~9-10h, Mythic ~30h; ≈L23 at the old ladder's measured 643k/96h endpoint (the old
ladder topped out at 1:24:37 — 128× its cap by desire-death — which is what this fixes).

**The architecture (the load-bearing idea):** `reputationTier()` keeps its `{index, label,
min}` return shape, so EVERY gate consumer — licenses, the workers' deep-training band,
fame-scaled budgets, crates, fametrack, the sim — works untouched, index semantics 0-6
preserved. New helpers in reputation.js: `levelThreshold(n)`, `fameLevel(rep)`,
`nextLevelInfo(rep)`. HUD badge reads **"«Rung» · Lv N"**; the remainder line counts to the
next LEVEL, naming the rung when the next level is one. Offline: **`repFraction: 0.5`** in
CONFIG.offline, applied in offline.js — offline sales pay HALF fame ("word of mouth needs you
present"), gold untouched, Better Signage still applies (it rides the per-sale).

**The suite (§72 + the ladder conversion):** §72 pins the curve exactly — thresholds at named
levels, rung placement, the haircut dial, HUD wiring. ~195 pre-existing assertions carried
hand-typed OLD-ladder thresholds (the 1500-is-Legendary era); all converted to live-table
reads (`tiers[i].min`; offline expectations derived through repFraction) — the
derive-never-hand-type doctrine applied to the whole ladder. A top-level CONFIG import was
added to the suite (block-scoped section imports checked legal — no duplicate binding).

**HARNESS-CERTIFIED (same day, the follow-up session — Daniel picked Option 2 of the
certification round):** a `setsid`-DETACHED run polled by ARTIFACT — output size/mtime plus an
exit-code sentinel file, never a process substring — runs sequential per the OOM policy, and a
90-second toy writer-loop probe verified boundary survival BEFORE the real launch. The sim
gained ~13 lines of **stderr-only** wall-clock marks (`tmark` — per-runSim start/done with
wall seconds + sim end-hours) so stdout stays the certified byte-comparable artifact.
**Result: 3× bit-identical (sha256 f0a1fb3b…), all exits 0, ~4.5 min wall per full run —
14 runSims at 11–25s each.** The step-6 question CLOSED as ceiling, not pathology: comm-blind
seeds run 13–23s, indistinguishable from every other block; the dead session's runs froze at
9,597 bytes and this run passed that exact byte mid-flight — same deterministic stdout, the
runs simply died at the execution ceiling. Its "exp-blind seeds cap out" claim was also wrong:
only market-blind seed 2 touches 168h (right-censored; that PASS is conservative) — aware runs
top out at 121h, and no cap-hit warning fired. **Verdicts: market-blind PASS +48%, exp-blind
PASS +25%, comm-blind PASS +3.5%; median death 96:00 (spread 72–120h); median death fame
636k = LEVEL 22 by the live curve — the design's ≈L23 calibration held.** The four
certification findings live in §0's NEXT block. **F2 (demand honesty) is next.**

---

## 2026-07-13 — F2: DEMAND HONESTY (arc pass two; e71beef, suite 1678; certified twice — the round that failed and the round that shipped)

**The build (Daniel's Option 1 — item-stage supply bias, binary signals):** `supplyWantWeight`
(game.js, exported) — trade-tier items weigh by three live signals, zero new bookkeeping:
shelf stock > 0 → `stocked`; `stats.itemSales[id]` > 0 → `known`; else `unknown`. Gold-tier and
stateless picks stay ×1 (the bias never touches the gold economy or legacy math); every read
??-guarded. Wired as the item stage's THIRD factor beside itemBias and affordableWantBias.
Known accepted nuance: commissions skip itemSales by law, so a wholesale-only item reads
'unknown' once its shelf empties. **§73** pins the dial contract (exacts + the never-to-zero
law), the four levels against live-registry ids, a seeded REAL-spawn-path effect probe
(relations, never counts: starved 4/400 asks — the floor working; stocked 30/400), the wiring,
and **the ROSTER RULE as a suite-enforced contract: every trade-bearing category keeps a gold
sibling** — the options round's guard for the item-stage-only design; an all-trade category
must fail there and force the category-stage upgrade. A2's fixture now stocks the flask it
licenses (conditioning the supply contract out exactly as it conditions out budget). The sim
gained the acceptance metrics: `oosFrontSec` (front customer blocked on stock ≤ 0, integrated
at policy resolution) and end-state trade/all serve shares from the game's own ledger.

**The baseline revelation (scratch clone at HEAD + metrics-only sim):** pre-F2, the aware
bot's front customer sat blocked out-of-stock for **40–76 HOURS per run — a median 63% of the
run's lifetime.** The diagnosis's "invisible throughput tax," finally a number.

**Certification round one — the first cut (0.4/0.15) FAILED the standing law:** F2's own
acceptance was met (OOS share 63% → ~47%; serves +65%; purses doubled), but market-blind
flipped to **WEAK, aware −20%**: the blind bot never stocks trade → all its trade demand
floored → a pure, instantly-restockable gold queue at maximal throughput, while the aware shop
attracted full-weight asks onto maxStock-5 shelves and ate the sell-out blocking. **The deep
finding: the old +48% market edge was mostly the mispriced-scarcity TAX on non-participants —
remove the defect and trade margins alone don't carry the market.** The pass was HELD (zip
packaged as insurance, nothing committed) and the ruling went to Daniel as an options round:
(A) ship as-measured, F3 restores the law next; (B) soften the dials until both laws hold;
(C) pair with a re-scoped F3 in-session. **Daniel picked B.**

**Certification round two — candidate 0.7/0.4 PASSED everything first try (3× bit-identical):**
market-blind **+12%** (the honest margin, with a partial tax deliberately kept in the
non-participant's queue), exp-blind **+28%**, comm-blind **+6.0%** (STRONGER than pre-F2's
+3.5% — honesty concentrated counter sales on stocked shelves). F2's acceptance held at the
softer dials: OOS median 63% → ~51.5%, throughput +13%, trade serve share 14.6–15.0%.
Pacing finding: **the aware death spread collapsed to 72:00 flat across all five seeds**
(median down a full day); blind controls stretched to 144h/96h/cap-censored-168h — post-F2,
the market's biggest tooth is COMPLETION, not rate.

**Daniel's browser test surfaced the F2 × COMMISSIONS amplification:** he stocked 3 Silver
Keys for a 2× commission and watched Bob serve one to a counter customer — B1's exact gap
(no reservation exists at HEAD), now SHARPENED because stocking an order's item flips it to
full ×1 demand and actively attracts the counter traffic. **Queue order kept by Daniel's call
(F3 → F4 → B1), with B1's priority noted as raised.**

**The F3 re-scope (design doc §7 rewritten):** the old sketch's miss-penalty premise measured
DIAL-DEPENDENT — at 0.4/0.15 it would have inverted the gap outright. The same-day sizing run
(the OOS line added to the market acceptance block) settled the shipped-dial picture: misses
sit **blind ~58% vs aware ~51.5%** of run time — miss-costs are direction-safe but offer only
~6 points of differential. F3's round opens from that frame; §0's NEXT carries it.

**NEXT:** the F3 re-scope options round.

---

## 2026-07-13 — F3: SCARCITY TEETH (arc pass three; 7db7c21, suite 1693; the re-scoped Option 1)

**The round's frame (why the original sketch died):** the F2 sizing run put misses at blind
~58% vs aware ~51.5% of run time — miss-costs direction-safe at the shipped dials but only ~6
points of raw differential — and all economy laws already PASSED at +12%, so the round asked
what teeth the GAME still wanted: fiction-texture (fame-scaled leave penalty), throughput
(fame-scaled trade shelf depth — flagged: shelf caps feed inspection fullness, trace first),
or memory (missed-demand decay ledger, new state). **Daniel picked Option 1, the smallest.**

**The build:** `leavePenaltyOf(state)` (game.js, beside fameOf) = `leavePenalty` +
`leavePenaltyPerTier` × tier index — 1 at Neutral, 5 at Renowned, 7 at Mythic; both dials in
CONFIG.reputation, perTier 0 restores flat, ??-guarded. Charged ONCE per leaver so both log
branches (leave and theft) report the true delta (`repDelta: -pen`). The drain lands on
**spendable fame only** — the perk budget; the lifetime tier track NEVER falls (the dual-track
law, now suite-pinned through the REAL leave path: §74 spawns a customer, times it out inside
`update()`, and asserts the exact tier-scaled charge, the unmoved lifetime, and the honest log
line). Auto-wave and dismissal stay penalty-free by construction and by pin (they route
through dismissCurrent, repDelta 0 — service, not failure). **The auto-wave/dismissal
economics review, carried on the sequence line since the reform began, CLOSED with this pass.**

**Certification (3× bit-identical):** the fiction-first option carried real economic weight —
the goodwill drain compounds through PERK TIMING (the sim's bot buys the cheapest perk with
spendable rep; every blind bot leaks more goodwill than the full player, so its perks arrive
later and its economy runs colder). Every margin widened: market-blind **+21%** (from +12),
exp-blind **+36%** (from +28), comm-blind **+12.4%** (from +6.0 — spendable-rep scarcity makes
the commission's fame bonus bite). Median death 72:00 with the spread re-widened to 72–120h
(texture partly back after F2's flat collapse); death fame 662k = level 22, calibration
holding a third consecutive pass.

**Also queued from Daniel's browser session:** the results-box flooding item — parked (h).

**NEXT:** F4 (demand surface) opens with its options round — §0 carries the agenda.

---

## 2026-07-13 — F4: DEMAND SURFACE (arc pass FOUR, the last; 319083a, suite 1714; economy-neutral)

**The build (Daniel's Option 1 — the board's third chalk row):** the Market Day event had no
ambient surface after the HUD chip retired (the discovery gap — only the log line, Bob's
bubble, and the away modal named it). F4 closes it with the sale-sign DOCTRINE PAIR:
  - **The board advertises** — `boardEventLine(event)` (marketevents.js) composes a compact,
    board-voiced row: "HOT TODAY: Armor" (the shelf that pays; no number). Deterministic (the
    event is date-derived), folded into `boardLines`' `contentKey` so a new market day triggers
    the single chalk write-on across all three rows (TODAY offer / demand / Tomorrow forecast).
    scene.js re-spaced the board to four EVEN rows (header y13, then 33/55/77) — MEASURED
    against the 110px writable face (opaque y2..109) — and draws the demand row in a warm amber
    (`demandColor`) distinct from the gold offer and cream forecast.
  - **The overlay informs** — a "Today's Demand" row in the market overlay (market.js) carries
    the full fact via `marketBannerText`: "Porcupine Migration · Armor +50%". Derived from the
    SAME `eventIdForDay ∘ tradeDayKey` the board uses, so the two can never disagree; the mult
    resolves through the same registry-override ?? CONFIG default the payout uses. New CSS
    `.market-demand` / `.demand-badge`, styled as a sibling to the special/commission rows.

**§75** pins it: every event's board line board-short (≤32) and naming its shelf, NO digits on
the board (the doctrine split), empty-on-missing (defensive), the contentKey folds the event
id, determinism per day, the overlay echo names the event AND carries the number, and both
wiring pins (scene draws `L.demand`; the overlay renders the echo). §66's contentKey pin was
updated to the new three-part `offer|event|offer` format (derived from `eventIdForDay`, not
hand-typed). `index.html` untouched → the Kongregate mirror stayed valid (§50i green).

**Certification — the RIGHT kind for a presentation pass:** F4 introduces zero new economy
paths, so the 3× bit-identical doctrine doesn't apply. Instead, ONE sim run CONFIRMED the
economy was untouched: its stdout came back byte-identical to the F3 baseline (sha256
5656693522f37…). Proof it moved nothing it shouldn't — economy-neutral by measurement, not
assertion.

**THE FAME & DEMAND REFORM ARC IS COMPLETE (F1a→F4).** Final margins: market-blind +21%,
exp-blind +36%, comm-blind +12.4%; the market's honest rate edge is +12% with the rest carried
by scarcity teeth and completion pressure. The arc's home doc: FAME_ECONOMY_DESIGN.md.

---

## 2026-07-13 — TEXT PASS: board wording + worker hire-line personalities (635c574, suite 1716)

Two presentation fixes from Daniel's browser session, one commit, no economy paths touched:
  - **Board wording**: the demand row now reads "HOT TODAY: «shelf»" instead of "DEMAND:
    «shelf» tip today". Daniel's read: "tip" is the internal MECHANIC word (matching sales pay
    a payout bonus, never a price change) and read as broken English on the sign. One-line
    change in `boardEventLine`; §75's behavior pins (length/label/no-digits) held unchanged.
  - **The "Restocker" bug + hire-line voices**: unhired Doug's Workers card read "Restocks
    automatically" — panels.js's old unowned-branch role-ternary (`role === 'serve' ? ... :
    'Restocks automatically'`) never learned Doug's 'scavenge' role. Fixed data-first: each
    worker gains an authored IN-VOICE `pitch` field (workers.js), read by panels.js with a
    role-based fallback so a future pitch-less worker degrades gracefully. The three voices
    (COMEDY_BIBLE): **Bob** "Minds the counter so you don't have to. Impeccably." (warm
    concierge), **Greg** "Refills the shelves. Won't make eye contact. That's the deal."
    (blunt gargoyle, grumps at the job not the customer), **Doug** "Slips out the door for the
    good bits. \u201cDoug finds, yes.\u201d" (Gollum-adjacent, "good bits"). A suite regression
    pin (in the Doug section) now guarantees every worker has a pitch ≤80 chars and Doug's is
    never "restocker".

**NEXT:** Commission B1 (hard reserve) — the pickup; §0's NEXT block carries the spec. Doug
leveling (Option 1) is spec'd and queued behind it.

---

## 2026-07-14 — DOUG LEVELING + THE SIM INSTRUMENT REPAIR (b9ac048, 2784bec, 8fe8012; suite 1746 → 1797)

Three passes, three commits. The middle one matters most: **the sim that certifies this project's
economy was measuring wrong, and had been for the whole reform arc.**

**PASS 1 — DOUG LEVELING (b9ac048, suite 1746 → 1797).** Option 1 as spec'd; the §0 NEXT block
carries the shipped values and the bug it taught. Built clean, suite green at 1770 — and Daniel's
browser immediately found Doug popping: the renderer and the cameo gate each hardcoded
`baseInterval` while only the timer got the new dial. Fixed with `scavengeClock(state)` in the leaf
(`src/data/workers.js`), consumed by all three sites. §78 added (27 pins), incl. a SOURCE pin
because a headless suite can't draw Doug. **Negative control run:** re-inserting the hardcode drops
the suite to 1795/2, so §78 catches the real defect rather than merely agreeing with the fix.

**PASS 2 — THE INSTRUMENT (2784bec).** THE SESSION'S REAL FINDING. Doug's first cert came back
market-blind **+8% WEAK** against a recorded +15% baseline. The counterfactual (Doug's block
reverted) reproduced the recorded 15/26/10.8 exactly, so the delta was cleanly Doug's — but the
per-seed numbers inverted the headline:

| | old score | aware wins | spread |
|---|---|---|---|
| baseline (pre-Doug) | **+15% PASS** | 1/2 | **−5.2% … +14.9%** |
| Doug build | **+8% WEAK** | **2/2** | **+4.2% … +7.6%** |

The baseline's own control BEAT it on seed 1 and it still scored higher. Cause: each arm reduced to
`median(...)` over `SEEDS.slice(0, 3)`, and `(a.postRate ?? 0) / Math.max(1, b.postRate ?? 0) - 1`
coerced a null postRate (a run that never died) into a sentinel — so with n=3 and a sentinel always
sorting to one end, the median was the larger of the two real values. **Doug never earned that
WEAK.**

The repair (Daniel picked Option 2) applies the sim's OWN convention, already used by its death
block (`runs.filter((r) => r.deathT !== null)` — cap-hits excluded BEFORE the median): blind arms
widened to all 5 seeds; cap-hits COUNTED and reported categorically, never averaged; an `EVIDENCE:`
line prints median + spread + win count so a marginal verdict LOOKS marginal. Verdict rule
(Daniel's call): **any blind cap-hit is PASS-worthy** — a bot stranded forever by ignoring a system
is the maximum tax, not a missing datum.

**CERTIFIED 3× bit-identical** (`3fcb54d5…`, ×3, ~290s/run, 20 runs): market-blind **+26.5%**
(spread 13.3–32.6, wins 4/4), expedition-blind **+46.9%** (26.0–54.6, 4/4), commission-blind
**+22.3%** (6.3–25.9, 3/3). **These are NOT comparable to 15/26/10.8** — different instrument AND
different build (see below). The shape is what to trust: unanimous wins, every spread above zero.

**WHY THE BUILD CHANGED UNDER US (subtle, worth knowing):** `isDougOut` gates `logLine`'s candidate
pool, and `logLine` has an anti-repeat re-draw (`messages.js:43-45`) that fires CONDITIONALLY on
pool contents. So changing the cameo gate changes the number of `pick()` calls, which shifts the
seeded PRNG stream, which re-aligns every downstream random event. A cosmetic gate moved the whole
economy trajectory. **Any change touching a conditionally-drawn random path voids prior sim
numbers** even when it cannot possibly affect the economy on paper.

**PASS 3 — CAMEO DRIFT (8fe8012, comment-only).** Decided, not fixed — see §0. Recorded at the seam
so it can't be mistaken for a defect later.

**FINDINGS LEFT OPEN FOR DANIEL (neither touched, both real):**
  (i)  **The AWARE bot cap-hits in 1/5 seeds.** Seed 3 stranded at the 168h cap with 1 want left
       (Restore The Everything Cloak), having sold 878 swords vs ~1,200 in every other seed; its
       blind bot cap-hit too. May be an honest cold tail, may be the relic-find pity floor not
       doing what we think at the far end. The repaired instrument FLAGS it (`AWARE never finished
       in 1/5 (!)`); the old one would have buried it as a −100% sentinel. `exit 1` on a cap-hit is
       documented behaviour, not a crash.
  (ii) **Doug compresses content life.** Median desire-death 96h → 72h despite ADDING 10 wants,
       because faster scavenging pulls the long-pole relic restores (20k+135s, 40k+180s) forward.
       Mechanistically clear, never decided on.

**THE PATTERN ACROSS ALL THREE PASSES (the thing to carry forward):** this session retired TWO
comments that were true when written and were falsified by a new dial — scene.js's "scavenge has no
speed perks — this IS the clock" and isDougOut's "the ~12s gone window dwarfs that". Both had
reasoned correctly about the world as it stood. **A comment at a live seam is a CLAIM with an
expiry date, and adding a dial is what expires it.** The first cost a browser bug; the second was
caught only because the first taught us to look. When a pass introduces a dial, grep every comment
that reasons about the value that dial now moves.

**NEXT:** the HUD / Bestiary UI round — §0's NEXT block carries both passes with their real
anchors.

---

## 2026-07-15 — THE HUD / BESTIARY UI ROUND (6c0e74c, 5843f6e; suite 1797 → 1844)

Both passes UI-only, both browser-confirmed, both opened with an options round. **Everything below
was MEASURED in a real browser** (Playwright + Chromium, viewport pinned 1280×720 so `resize()`
computes scale 1 and every rect is stage-local) — this round exists because nothing headless can
measure CSS geometry, and two budgets had quietly gone false.

**PASS 1 — THE HUD BAND (`6c0e74c`).** The Scrap chip rendered under the Menu button. The handoff
guessed "fits at two chips, collides at three"; **that was wrong** — three chips at fresh numbers
clear by ~32px, and two chips never collide at any number. The trigger is row WIDTH, and two faults
compounded:
- **`.hud` and `#menu-btn` were BOTH anchored `right:16px`.** The band ran to the button's own right
  edge and the button (z6 over the HUD's z5) painted over whatever reached it. The 2026-07-10 budget
  reasoned carefully about the wall-shelf to its LEFT and the dock BELOW and never named its
  right-hand neighbour. Now `right:104px` = 16 margin + ~72 button + 16 breath → 780px usable.
- **F1a expired the budget's "~770px" two days after it was written.** Measured: pre-F1a ~757px (the
  budget was ACCURATE when authored), post-F1a ~969px — the badge gained "· Lv N", and `#hud-next`
  went from rendering `''` past the last rung to ALWAYS populated, because the level curve is
  infinite. **The expiring change was TEXT, not a dial** — which generalises the 2026-07-14 lesson.
- Also: the budget said "don't shrink" but the CSS never set `flex-shrink:0`, so flex squeezed the
  chips and wrapped their text (45→58px tall) rather than failing visibly. Now enforced.
- **The fix (Daniel's call, from his annotated screenshot): MOVE the next-level remainder to the Fame
  panel**, which already owned the next-RUNG one. New pure `fameStandingHtml(state)` export
  (`panels.js`, the `gregBubbleFor` precedent) renders both beats — and SKIPS the rung line when the
  next level IS that rung, because `nextLevelInfo` and `nextTierInfo` then return the same number for
  the same destination and it stutters. Three shapes, all suite-pinned.
- **Daniel's premise needed one correction:** he believed the line already lived in the Fame tab. It
  did not — the tab carried the RUNG line (`· 136893♛ to Mythic`), not the LEVEL line
  (`· 18047♛ to Lv 18`). Different number, different destination. So this was a real move, not a
  delete. **Artifact wins, including over the person who wrote the design.**
- **KNOWN LIMIT, accepted and documented in the budget comment.** Worst case vs the 780px band by
  face: Segoe UI ~687 (+93) · Noto ~718 (+62) · FreeSans ~737 (+43) · Liberation ~742 (+38) ·
  Poppins ~755 (+25) · **DejaVu Sans ~817 (−37 — the one face that does not fit)**. DejaVu resolves
  only when BOTH `'Segoe UI'` and `system-ui` miss (a minimal Linux profile); such a player at
  7-digit gold sees the Scrap value's tail clipped. **The parked compact-numbers item cuts ~75px and
  closes it** — it stays parked; it was not needed for any mainstream platform.

**PASS 2 — THE BESTIARY / EXPEDITION SPLIT (`5843f6e`).** Daniel's read was right and the artifact
agreed: one card was a loyalty ledger AND an expedition job card at once. Option 3 picked, built as
pass one of two.
- **Tab renamed `Bestiary` → `Mobs`** (id stays `bestiary` — internal), holding two sub-views:
  **Expeditions** (job cards: portrait, name, runs/away, `Send ◆25`) and **Field Guide** (the ledger:
  pips, `Served N · +X% rep`, `next 50`, `N% studied`, VIP Visitors).
- **VIPs moved to the Field Guide** — they were never jobs (no Send button, by the 2026-07-08
  decision), so when the surface split they went with the trophies. Both binding decisions intact.
- **The completion hint rides the Field Guide view**, not the panel title — the title must not
  advertise a ledger the current view isn't showing.
- **A 6th tab was the obvious shape and is FORBIDDEN** — see §0's correction. The split went vertical.
- **Two traps caught before delivery, both now pinned:** (a) `.beast-cards{display:flex}` is declared
  AFTER the bare `.hidden` utility, so it WINS the 0-1-0 tie — a `.hidden` toggle on a card container
  would have been a **silent no-op**. Live ammunition, not theory; scoped overrides added at birth.
  (b) the render loop's `querySelector` (singular) was correct only while each monster had ONE card;
  with two it binds to whichever is first in the DOM, and the Field Guide's cards would have stayed
  `???`/silhouetted forever — indistinguishable from correct on a fresh save. Now `querySelectorAll`,
  ids view-prefixed (`job-name-*` vs `beast-name-*`).

**SUITE 1797 → 1844.** §79 (HUD band, 25) + §80 (the split, 19) + §72(f) refined 1→4. **§72(f) is
the one to remember:** it pinned `hud.includes('nextLevelInfo')` and **stayed green straight through
the removal that invalidated it** — because the comment explaining the move contains the string. A
source pin must match a STRUCTURE (an import list, a call shape), never a bare symbol name; comments
are text too. Both sections negative-controlled: reverting the reservation → 1823/2, dropping
`flex-shrink:0` → 1824/1, breaking the no-stutter guard → 1824/1, adding a 6th tab → 1843/1,
a Send button on a guide card → 1843/1, reverting to `querySelector` → 1842/2, VIPs on the job grid
→ 1842/2. Every one restores to green.

**Also fixed:** §23's pin printed *"total scales with the roster (9 x 5 = 40)"* — the assertion was
right (`gridIds` = 8 non-special × 5 breakpoints), the message interpolated `MONSTER_IDS.length`. It
only surfaces on failure, where it would mislead. Now reads GRID roster.

**A measurement caveat that shaped the whole round.** `--font` is `'Segoe UI', system-ui,
-apple-system, sans-serif`. **Segoe UI is a Windows font and cannot be installed in the container**,
so every pixel measured here rendered in a fallback (DejaVu Sans — the widest face available, and
therefore a conservative bound). Daniel's annotated screenshot was the calibration artifact: its
un-wrapped badge sits at max-content width, giving **Segoe/DejaVu ≈ 0.778 on text**, validated to
**1.6%** by decomposition (fixed padding/borders/gaps do NOT scale with the face; only text does).
Without that calibration the first recommendation was over-built — it bundled compact numbers and a
padding trim that were necessary only in a font no Windows player has. **A rendered-geometry
measurement must name the face it was taken in.** Also: **the worst case of a composite string is not
at the maximum of any single input** — "Renowned · Lv 16 · 17293♛ to Legendary" is 44px wider than
the endgame "Mythic · Lv 23", because the longest rung NAME and the rung-naming remainder co-occur
mid-ladder. Sweep every rung from the live curve; never spot-check the extreme.

**+7 LESSONS** (2026-07-15): CSS budgets expire on TEXT changes and only a browser notices · a
source-text pin is satisfied by prose · a pixel measurement is only valid in its font · "nearly free"
was true about wiring and false about layout · splitting a card set breaks every singular DOM lookup ·
the `git status` READ scans for deletions and missed a stray added file · a 30-line commit body in a
repo whose every commit has none.

**NEXT:** the Mobs follow-up round — §0's NEXT block carries all three items with their real anchors.

---

## 2026-07-15 (evening) — THE MOBS FOLLOW-UP ROUND (401719c, 06108af, ecf1700; suite 1844 → 1879)

Three passes, three commits, all browser-confirmed. **Every measurement below was taken in a real
browser** (Chromium, viewport pinned 1280×720 so `resize()` computes scale 1) — the same instrument
the HUD/Bestiary round built, earning its keep twice more. The round's shape: Daniel queued three
items; two shipped, one (the tab name) is untouched, and a FOURTH pass fell out of his reading of
Claude's own screenshot.

**PASS 1 — THE RUNS CONTRAST (`401719c`).** Daniel: *"far too light and difficult to see."*
Measured `.beast-exp` at **1.28:1** against the card it sits on (AA needs 4.5; the sibling
`.beast-name` measures 10.19). Not "too light" — **invisible**.
- **The handoff's hypothesis was FALSIFIED, and that is the entry's point.** It guessed a muted
  tertiary tone that lost its context when the split decluttered the card. The artifact disagreed:
  at birth (`c4905f9`, Expeditions MVP) `.beast-exp` took `.mat-chip`'s `10px/#cfc3e0` and
  `.beast-send` took `.trade-btn`'s dark-purple treatment — **the Market strip's row transplanted
  whole onto a PARCHMENT card.** Those read correctly on the market's dark panel. The button carried
  its own background so it survived the move; the text inherited a dark-panel foreground onto tan and
  had been illegible since 2026-07-11. **The split didn't cause it — the split decluttered the card
  enough that Daniel finally SAW it.**
- **The fix is Daniel's own precedent.** `style.css:96` still carries his 2026-07-12 ruling on the
  identical defect: *"gold-deep was low-contrast (Daniel's QA; same treatment as .trade-hint)"*.
  `#6b4a1e` → **6.11:1**. Colour only; `font-weight:700` stays available as a second lever.
- **§81 pins the COMPUTED RATIO, never the hex** — a `#6b4a1e` pin would be satisfied by the comment
  above it (the §72(f) lesson from the morning, applied the same day). Negative-controlled three
  ways: the real defect → 1850/2 (contrast pin AND transplant pin); a plausible "muted" guess
  (`--meh`, 1.63:1, *not* a market colour) → 1851/1, proving it catches the CLASS, not the hex.

**PASS 2 — THE FIELD GUIDE TAGLINES (`06108af`, 2a of Daniel's Option 2 staged).**
- **Both halves of the item were verified against the live code before scoping**, and the registry
  check confirmed the handoff exactly (20 fields, all mechanical, no prose field; 233 lines; 26–29
  per grid monster, 12 for the Inspector; `crossedCount` + `MONSTER_BREAKPOINTS` present). **Four
  facts it did NOT carry, all of which moved the design:** 22 lines hold an `{item}` placeholder and
  cannot be shown raw; 48 are already `minServes`-gated on the very breakpoints the reveal wants; 8
  are golden @100; 6 are Greg-tagged.
- **`lore: { tagline }` on all nine rows**, each playing that mob's one documented comic lever, read
  guarded (`lore?.tagline ?? ''`), revealed on `discovered`. Each leans on the mob's own MECHANIC —
  Leggsy's `bulkBuyer` is literally two of everything, Ratty's `thief` flag is the thing he insists
  isn't happening, Demmy's `combatMod:+2` is the danger he apologises for. **The stat and the joke
  are the same fact said twice**; the bible's new section records that as the register.
- **It cost 0px.** Card height 100→100, content 870→871. The card's height is set by the 72px
  portrait and `.beast-info` had ~33px of unused headroom. The undiscovered control holds: `???`,
  empty tagline, **0px** — an empty line reserves no space and the punchline isn't spent early.
- **§82 derives everything from `MONSTER_IDS`** (no hand-typed "9" — §29's own day-old
  `ITEM_ORDER.length === 15` broke inside a day). Five negative controls, all firing. One of them is
  the point: **`.beast-lore` reaching for the market lavender fails §82** — §81's law asserted at
  birth rather than four days later.

**PASS 3 — THE OVERLAY STAND-DOWN (`ecf1700`) — DANIEL FOUND IT IN CLAUDE'S OWN SCREENSHOT.**
- The hire chip painted across an open Field Guide. Measured: the chip, **Greg's bubble and Bob's
  bubble** are all siblings of `#shop-ui` at **z5 vs its z4**, all sit **fully inside** the panel's
  box (640×500 @ 320,96), and each wins `elementFromPoint` at its own centre. The panel column is
  the diorama's centre — which is exactly where things worth pointing at live — so this was never a
  near-miss.
- **The chip was the only instance anyone could catch.** It exists only pre-Bob-hire; the two Daniel
  did NOT report fire forever (Greg's ~10s per ~45s, Bob's reminder every ~30s) over whatever panel
  is open. 2a is what made the collision reachable: it gave a fresh player a reason to open the Mobs
  tab before hiring Bob. **2a didn't break it; 2a made it visitable.**
- **THE COMMENT THAT CAUSED IT** (`.hire-goal-chip`): *"z5 keeps it above the panels (z4) and under
  the title overlay (z10), so it only shows in-shop."* Two claims fused into one number — staying
  under the title is a REQUIREMENT; being above the PANELS was a CONSEQUENCE of picking 5, written
  down as though it were the intent. The third comment this project has retired for that.
- **WHY NOT z-index — the fix that would have shipped a worse bug.** `#shop-ui` is `inset:0` and the
  file sets `pointer-events` **nowhere**, so `z5→z3` would have dropped the chip beneath a
  full-stage transparent hit target: visible, unclickable, and it routes the whole Bob
  pseudo-tutorial. Full containment also means "under the panel" and "hidden" render IDENTICALLY —
  all the risk, none of the difference. Fixed with the house attention doctrine instead (a signal
  stands down when the player is already looking — `setShopAttention`'s nav-pulse precedent).
- **Greg's bubble gates at `showing`, not at its toggle** — its quip branch force-REMOVES `.hidden`,
  so gating the toggle alone would have fixed two of three and looked done.
- **§83's ordering pin is the one this pass earned:** `activeTab` is `'shop'` at module load, so
  `isPanelOpen()` is TRUE until `initNav`'s boot `setTab(root, null)` collapses it. Render before
  init and the hire chip is hidden on a fresh save — the tutorial silently gone, nothing on screen
  to hint why. `main.js` runs initNav (284) before renderPanels (347); the pin keeps it that way.

**SUITE 1844 → 1879.** §81 (contrast, 8) + §82 (taglines, 13) + §83 (the overlay gate, 14). Thirteen
negative controls across the three, every one firing and restoring.

**THE INSTRUMENT NOTE FOR THE NEXT SESSION.** Playwright + Chromium are container-available
(`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, `npm install playwright@1.56.0 --no-save` — note a
later bare `npm install X --no-save` DROPS it; reinstall together). This is now the third round where
the browser measured what nothing headless could. **Font caveat stands and always will:** `--font`
is `'Segoe UI', system-ui, …` and Segoe UI cannot be installed in the container, so every geometry
measurement renders in DejaVu Sans — the widest fallback, therefore a conservative bound (Segoe/DejaVu
≈ 0.778 on text). Colour measurements are exact and carry no such caveat.

**+5 LESSONS** (2026-07-15 evening): a screenshot is a probe with a FRAME, and an ink-count certifies
presence, not composition · a context-dependent defect cannot be swept by source search · my own
probe's `.catch(() => {})` swallowed a wrong selector and re-measured the wrong view · a comment that
fuses a requirement with an accident · the obvious one-value fix whose cost lived in a different file.

**NEXT:** 2b — the Dossier. §0's NEXT block carries the full scope; every call is registered and the
content is measured, so it starts at the build.
