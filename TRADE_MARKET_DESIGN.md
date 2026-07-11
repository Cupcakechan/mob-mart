# Mob Mart — THE TRADE MARKET (the retention reform spine)

*Design doc, locked at the DIRECTION level on 2026-07-11 (Daniel's trading model + the four
economy laws). **No numbers are decided here** — drop rates, caps, recipes, fees, durations, and
final item lists are each settled at their own pass's options round, with `sim_economy.mjs` as
the referee. Companion documents: `ECONOMY_AUDIT.md` (the measurements this reform answers) and
`RETENTION_RESEARCH.md` (the genre evidence base). Living doc, same rules as the handoff.*

---

## 1. Why — the diagnosis chain

1. **The audit measured the disease:** a greedy bot whose entire policy is "buy the cheapest
   affordable thing" plays Mob Mart OPTIMALLY. Every want falls by 8:18; variety is dead at
   ~1h50m; income then runs away (~53k gold/hour) with nothing left to want. The game presents
   a **price list, not decisions** (ECONOMY_AUDIT.md).
2. **The research named what's missing:** the genre's months-long retainers run on meaningful
   EXCLUSIVE decisions, NEW VERBS unfolding over time, rule-changing prestige, discoverable
   synergies, and allocation puzzles — ranked with evidence in RETENTION_RESEARCH.md. Content
   volume is not the gap; our 27 items / 15 licenses / 3 workers all resolve to one verb.
3. **Daniel found the root (2026-07-11): gold is a universal solvent.** Every faucet pours
   gold; every sink accepts gold; and stock is just gold in another shape because restocking is
   an instant, unlimited, fixed-rate conversion. When everything converts freely into
   everything, there are no exchange rates — and this genre's decisions live AT the exchange
   rates. Corollaries Daniel called out: commissions would be pointless while "always stocked
   with everything" is the default state, and crafting-from-gold just moves the disease.
4. **The fix is his trading model, not a crafting model:** monster-identity MATERIALS with
   independent faucets, and a DAILY-ROTATING trade market where high-tier stock is obtained by
   trading materials + gold at rates that change every day. No forge fiction needed — Bob is a
   mimic-MERCHANT; a dungeon economy prizing Infernal Embers is self-justifying. The daily
   rotation is the strongest anti-greedy-bot property on the table: static recipes get solved
   once; rotating rates make the optimal play re-derive itself every day.

## 2. The reform in one picture

```
FAUCETS                          MATERIALS                     SINKS
serve a slime ────────────▶ Condensed Slime Core ─┐
serve a bat ──────────────▶ Echo Fang            ─┤          THE TRADE MARKET (daily rates)
serve Skele ──────────────▶ Lucky Femur Charm    ─┤            materials + gold ⇒ trade-tier
serve Froggo ─────────────▶ Bogstone Bauble      ─┼─ capped ─▶   stock items
serve Ratty ──────────────▶ Stolen Trinket       ─┤  stores   RELIC RESTORES (hard)
serve Beetley ────────────▶ Polished Carapace    ─┤            scrap + gold + materials
serve a spider (upcoming) ▶ Silk Bundle          ─┤          COMMISSIONS (later)
serve a demon (upcoming) ─▶ Infernal Ember       ─┤            N trade-tier items by deadline
Inspector visits (VIP,   ─▶ Dragon Scale and/or  ─┤
 Pass B — see §3/§13)        Inspector's Seal     ┤
EXPEDITIONS (targeted, ───▶ (the door/party you  ─┤
 rate-limited bursts)         chose to send)      ┘

gold keeps its lane: basics restock, licenses, upgrades, training, expedition fees
scrap keeps its lane: relic-forge fuel (now alongside materials)
NO conversion between gold and materials, in either direction, ever.
```

## 3. Currencies & materials

**Gold** — unchanged role: basic-tier restock (instant, as today — protects the idle base and
the comedy of weak monsters buying garbage), licenses, upgrades, training, and expedition fees.
**Scrap** — unchanged role: relic-forge fuel; Doug's yield untouched. (The audit's 12×
oversupply is answered by relic restores getting genuinely hard — §7 — not by a new scrap lane.)
**Materials** — the new axis. One identity material per monster FAMILY, dropped on serve
(deterministic shape — exact rate is a Market-pass dial), plus targeted expedition bursts, plus
a small random chance on Doug's scavenges, plus VIP visits for the Seal. Data-driven: a
`MATERIALS` registry + a `material` field on the monster registry, so **every future customer is
born a faucet** with zero extra wiring — which is what makes spider and demon (art ready) real
additions instead of quip carriers.

**The roster (Daniel's PixelLab icons — ten — mapping locked 2026-07-11; statuses CORRECTED at
the Pass A recon):**

| Material | Source | Status |
|---|---|---|
| Condensed Slime Core | Slimey (serve drop) | **LIVE** (Pass A) |
| Echo Fang | Batty | **LIVE** (Pass A) |
| Lucky Femur Charm | Skele — live customer since launch roster | **LIVE** (Pass A) |
| Bogstone Bauble | Froggo | **LIVE** (Pass A) |
| Stolen Trinket | Ratty — live customer (the thief, 2026-07-05) | **LIVE** (Pass A) |
| Polished Carapace Shard | Beetley — live customer (2026-07-05) | **LIVE** (Pass A) |
| Silk Bundle | Spider — upcoming customer | lands with the customer |
| Infernal Ember | Demmy the demon — live customer (reform step 3a, 2026-07-11) | **LIVE** |
| Dragon Scale | the Inspector — VIP drop | Pass B; drop design **OPEN** (§13) |
| Inspector's Seal | the Inspector — VIP drop | Pass B; drop design **OPEN** (§13) |

**Correction (2026-07-11, the Pass A recon — recorded per the artifact-wins law):** the earlier
version of this table marked Skele/Ratty/Beetley "future customers" — they have been LIVE since
the 2026-07-05 passes, so **Pass A shipped SIX serve faucets, not four**. And Mob Mart has
exactly ONE dragon: the Inspector himself (`id: 'dragon', special: true`) — this doc's earlier
"the customer dragon sheds scales, the dragon bureaucrat stamps seals" described two characters
where the game has one. **Both dragon materials are HIS.**

**The VIP pattern (this answers "what do VIPs even add"):** every VIP carries RARE material
drops — the Inspector is the first, with a two-tier working proposal (Daniel's call, §13):
**Dragon Scale drops per visit** (the common VIP material — a dragon sheds), **the Seal drops
only on a top-grade inspection** (`inspectionGrade` already grades the shelves — the rare
late-recipe chase, and it finally gives his report card stakes). Rare by supply either way: VIP
cadence is once a day. Future VIPs each arrive with their own rare material.

## 4. The laws (these bite — same standing as the handoff's laws)

1. **No gold↔material conversion, ever, in either direction.** The moment gold buys materials
   (or materials sell for gold), gold is the solvent again and the reform is dead. Expedition
   fees are paid IN gold but return materials only through rate-limited, time-costed runs —
   the slot count and duration are the real constraint; the fee is flavor.
2. **Materials are capped per type** (the Kittens lesson): hoarding must not dissolve future
   decisions. Backroom Storage is the natural cap-raiser (a guarded second effect on the
   existing upgrade — `?? fallback` at every read site, per the hand-authored-data law).
3. **The market is seeded, eligible, and forecast.** Daily offers derive from a deterministic
   date-seed (the Special-of-the-Day board's own tech), draw ONLY from the player's unlocked
   monster pool (nothing unfulfillable, ever), and tomorrow's offers are visible today — the
   forecast is what turns "should I stock Silk Bundles?" from a slot machine into a plan.
4. **Materials do not live in the HUD.** The HUD row is at its measured limit (the shipped
   4th-chip lesson: redesign, don't shrink). The inventory surface is the Market Board panel.
5. **Split loops; nobody dies.** The Battle Results log is sacred and untouched: customers buy
   gear, lose to heroes, come back tomorrow. Expeditions are a DIFFERENT loop — supply runs
   through the six doors where failure is a comic mishap and a partial haul, never a lost unit
   (the Soda Dungeon rule; it's what makes investing in a party feel good). Individual monster
   leveling is REJECTED for exactly the death-gag reason; competence hangs on the FAMILY (§6).
6. **Save schema stays additive** (`SAVE_VERSION` unchanged; new fields guarded), and every
   new system arrives registry-driven so content auto-flows.

## 5. THE TRADE MARKET (the core system — build first)

**The board.** The Special-of-the-Day board is REWORKED into the Market Board (Daniel's call).
Each day it presents a small set of trade offers at that day's rates — e.g. today
`1 Iron Buckler ⇐ 2 Lucky Femur Charms + 1 Silk Bundle + 100g`, tomorrow
`1 Iron Buckler ⇐ 1 Polished Carapace Shard + 2 Bogstone Baubles + 50g` — plus tomorrow's
forecast. The chalk write-on animation survives. **The voice/daily-special row was CUT in Pass A
browser QA (Daniel, 2026-07-11)** — one ellipsized footer read as clutter; the board is CURRENT
TRADES ONLY for now, and the daily-special presence (the Market-Day event's board home included)
is a Pass B design question, not a squeezed row.

**Tiering.** Early game unchanged: basic stock is pure-gold and instant. A defined top tier
becomes TRADE-ONLY — **Pass A shipped Iron Sword as the proof**; Greater Flask and Knight Helm
convert at Pass B (final list Daniel's, §13). Mid-tier stays gold with trade-tier gradually taking over
as the catalog grows. Licenses still gate what a shop may SELL; the market governs how
trade-tier stock is ACQUIRED.

**Mechanics at direction level** (all counts/limits are pass dials): N offers per day; optional
per-offer daily stock ("3 available today") as a scarcity dial; recipes cost 1–3 material types
+ gold; materials-only and material→material swap offers are a parked later variant. Offers
never require a material whose monster the player hasn't unlocked (law 3).

**Why this defeats the greedy bot:** the bot's one-liner ("cheapest affordable") has no answer
to rates that rotate, stores that cap, and a forecast worth planning against. The optimal
policy becomes *read today's board, check tomorrow's, decide what to serve, send, and hold* —
a real decision loop, re-derived daily.

## 6. EXPEDITIONS (the targeted-supply loop)

Sponsor monsters THROUGH the six doors to fetch their materials: normal customers trickle in
randomly, but an expedition is you CHOOSING who goes because you need their ingredient today
(Daniel's framing). Rate-limited by expedition SLOTS (start at 1) and run DURATION; the gold
fee prices it as a service, not a converter (law 1). Returns are a material burst sized to the
run; failure is a comic mishap with a partial haul — never death (law 5) — and every departure/
return is battle-log/board comedy material (the Doug-cameo grammar extends naturally).

**MVP first:** a single sponsored monster ("a supply run"), one door, one slot. Parties, multi-
slot, and door-specific hazards come later. **Family mastery** is the competence axis: the
Bestiary's existing serve counts (plus a new expedition count) make the FAMILY better at runs —
"slimes have completed 40 expeditions" — wiring our biggest pure-collection silo directly into
progression without touching the everyone-dies gag. **Doug** gains one line: a small chance his
scavenge returns a random material. **Parked depth dial:** provisioning runs with shelf stock
(equipping the party from inventory) — re-links shelves to expeditions later; not v1.

## 7. RELIC REWORK (downstream of both systems above)

Relics become the reform's long-game. **Restores get HARD** (Daniel's call): scrap + gold +
material recipes — the Seal and the rarer materials are natural late ingredients. **Effects
target the new economy** in the scarce carrier slots we built for exactly this (3 wall frames +
1 desk): material drop rate, market rate discounts, expedition speed/haul, an extra daily
offer, cap raises. Scarce slots + exclusive effects = the loadout decision from the research,
now with an economy for it to act on. The old find-pacing question (audit P6) is superseded:
finds can stay burst-y because restores now gate for real.

## 8. COMMISSIONS (the deadline layer)

A customer places an order for trade-tier goods against a deadline — "3 Iron Bucklers, 2 days"
(Daniel's example) — for a premium. Only meaningful ON TOP of the market: fulfilling one costs
materials you must plan for (hold stores? target an expedition? pray at tomorrow's rates?).
This is the timed active pressure the genre demands, and it composes with everything above.

## 9. OFFLINE PARTY MANAGEMENT (automation-as-reward)

A late Bob (or dedicated) upgrade: queue expedition orders that run while away, bounded exactly
like Doug's offline runs are today. Ships only after expeditions are proven fun manually.

## 10. FRANCHISE (prestige — unchanged direction from the research)

Rule-changing, never a flat multiplier onto the same loop: each of the six doors is a franchise
"faction" granting a genuinely different playstyle (economy/expedition/collection builds).
Designed LAST, against whatever the harness then measures — the reform gives it a loop worth
resetting. Details at its own options round.

## 11. Build order & acceptance

One system per pass, §14's A/B precedent where a pass is large:

1. **Market Pass A** — MATERIALS substrate: registry + monster `material` field, serve faucets,
   caps, save fields, board rework to Market Board with ONE trade-tier item as the living proof
   (the scrap-shipped-with-Doug pattern), suite coverage.
2. **Market Pass B** — the full first trade tier, forecast, per-offer limits, and the board's
   SECOND ROW design (the daily-special / Market-Day-event presence — cut from Pass A as
   clutter; design it properly here or retire it).
3. **Spider + Demon** — 3a **Demmy DONE (2026-07-11)**: the Apologetic Menace (combatMod +2,
   the victory-as-apology register, top budget [20,36], iron_sword signature — the market's
   demand engine; ember faucet N 15). 3b **Leggsy the spider NEXT**: the Overstocker —
   `bulkBuyer` quirk (one serve buys TWO units when stock and budget allow), budget [14,28],
   bandages + zip_tonic signatures, silk faucet N 12; art fully in (footPad 12,
   spriteScale 1.05 PROVISIONAL).
4. **Expeditions MVP** — one monster, one door, one slot.
5. **Relic rework** — hard restores + economy effects in the carrier slots.
6. **Commissions.**
7. **Expedition depth** (parties, multi-slot, offline management).
8. **Franchise.**

**Acceptance, every pass:** the harness grows a policy that plays the new system, and the
system-BLIND bot must measurably lose to the system-aware one — the first time in this
project's life that ignoring a mechanic costs the optimal player something. Reform-level
success metric: the variety-death moment (baseline 1h50m) moves substantially later, and no
single policy is optimal across days.

## 12. Disposition of prior proposals

- Audit **P1** (size against measured rates) — absorbed: it now sizes the market/expedition
  numbers. **P2** (Mythic → 40k) — PARKED, still a valid one-value pass anytime; the sweep
  (handoff, 2026-07-11 section) showed it's a horizon fix, orthogonal to this reform.
  **P3** (don't nerf deep rungs) — stands. **P4** (scrap sink) — superseded: relic restores
  harden instead. **P5** (new license rung) — superseded by the trade tier. **P6** (find
  pacing) — superseded by hard restores.
- Research pass order (relics first) — INVERTED: relics are downstream of materials now.
- Research "crowd targeting via doors for SERVES" — parked; expedition targeting supersedes it
  in v1. "Shop expansion rooms" — parked as the pacing container for post-reform content;
  no forge room needed (trading replaced crafting). "Mini-games" — the standing rule survives:
  only if the output feeds this economy.

## 13. Open questions (Daniel)

1. **RESOLVED, then CORRECTED (2026-07-11):** the ten-icon mapping is locked (§3). The Pass A
   recon corrected two recorded facts: Skele/Ratty/Beetley are LIVE customers (so Pass A
   shipped SIX serve faucets), and the game's one dragon IS the Inspector — both dragon
   materials are his VIP drops. **The one remaining call:** the Inspector's drop design for
   Pass B — working proposal: Dragon Scale per visit, Inspector's Seal only on a top-grade
   inspection. Yours to confirm or reshape when Pass B opens.
2. The first trade tier: **Pass A shipped Iron Sword as the proof** (as recommended);
   Greater Flask + Knight Helm convert at Pass B unless you name a different set.

## 14. Not decided here

Every number (drop shape and rates, caps, offer counts, per-offer limits, recipes, fees, run
durations, mastery curves, restore recipes); the exact suite sections; UI layouts beyond "the
board panel is the surface." Each pass opens with its own options round, per the method.
