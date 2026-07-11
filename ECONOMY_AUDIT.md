# Mob Mart — THE ECONOMY AUDIT (2026-07-10)

*A measurement pass (§0 step 1). **No game numbers were changed.** Every figure below is measured
by `sim_economy.mjs` (repo root, committed — the reusable balance instrument) against the live
registries at HEAD. Reproduce with `node sim_economy.mjs` — output is bit-identical across runs
(seeded RNG), verified 3×. Tracked like the other docs, NOT shipped.*

**Policy record (Daniel's options-round picks, 2026-07-10):** player model = **greedy-cheapest**
(restock first, then buy the single cheapest affordable unbought want per currency; manual serves
only until Bob is hired, then hands-off), horizon = **event-driven** (run to the last want, +60-min
tail, 48h cap), report = **this document**. Baseline is **calendar-free** (Market Day + the
Inspector unarmed, the suite's headless convention) — their tips/crates would only *shorten* the
times below.

**Reading the numbers:** greedy-cheapest yields the *earliest-possible* fall time for every want
(the lower envelope). A human buys slower, so real wall-clock runs longer — but the **shape**
(what runs out, in what order, and what's left afterward) is policy-independent, and the shape is
the finding.

---

## 1. The sink stack (verified against live registries)

| Sink | Gold | Notes |
|---|---:|---|
| 15 licenses | 6,100 | last one (Knight Helm) at 1,200 |
| 3 hires | 1,850 | Bob 50 / Greg 600 / Doug 1,200 |
| 22 upgrade levels | 30,829 | four ladders, growth 2.1 |
| 20 training rungs | 189,704 | Bob + Greg, 2,000 × 1.15^L, deep band ×3 — **83% of the stack** |
| **The §0 starting fact** | **228,483** | reproduced exactly |
| 4 relic restores | +46,000 | plus **155 scrap** — the currencies' shared sink |
| **Grand gold sink** | **274,483** | |
| Perk ladder (rep-costed) | 3,512 rep | 10 levels across 5 perks |

**74 purchasable wants** in total (3 hires + 15 licenses + 22 upgrade levels + 20 training rungs +
10 perk levels + 4 restores).

---

## 2. Headline results (median of 5 seeds; spreads are min–max)

- **The desire curve dies at 8:18:03** of continuous idle play (spread 8:06:38–8:19:08). Purse at
  death: ~0 (the greedy buyer spends to the floor — every want was affordable the moment it fell).
- **Post-death accumulation: 884 gold/min = ~53k gold/hour** with nothing left to want. The
  observed 1.46M endgame purse (6.4× the sink stack) is **≈27.6 hours of post-death play** — the
  runaway is fully explained.
- **Lifetime rep at death: ~135k.** Mythic's threshold is 5,000 — the entire seven-tier fame
  ladder occupies the **first ~4%** of the rep a full run generates.
- **Scrap at death: ~1,860 banked vs 155 ever spent** (~12× oversupply). Scrap is a second
  runaway currency from roughly two hours after Doug's hire.

## 3. The measured timeline — when every want falls

Verbatim harness output (median of seeds 1–5; `f` = fame threshold, `r` = rep cost, `+Ns` = scrap):

```
   median       min       max  kind         cost  want
  0:00:46   0:00:22   0:01:20  fame          25f  Fame tier: Friendly
  0:01:45   0:01:18   0:02:23  hire           50  Hire Bob
  0:02:36   0:02:01   0:03:13  fame          75f  Fame tier: Trusted
  0:02:58   0:02:25   0:03:37  upgrade        60  Extra Shelf L1
  0:06:02   0:05:06   0:06:17  upgrade        80  Faster Counter L1
  0:07:36   0:06:42   0:07:43  upgrade       100  Better Signage L1
  0:08:01   0:07:19   0:08:31  fame         200f  Fame tier: Beloved
  0:08:06   0:07:23   0:08:44  perk         200r  Haggler's Charm L1 (rep)
  0:09:20   0:08:21   0:09:27  upgrade       126  Extra Shelf L2
  0:11:36   0:10:50   0:12:02  license       150  License: Leather Bracer
  0:13:44   0:13:21   0:14:27  license       150  License: Murk Tonic
  0:14:40   0:13:58   0:15:19  perk         250r  Swift Wings L1 (rep)
  0:15:52   0:15:09   0:16:20  fame         500f  Fame tier: Renowned
  0:15:55   0:15:29   0:16:25  license       150  License: Map
  0:18:16   0:17:35   0:18:36  license       150  License: Bag of Salt
  0:20:42   0:19:51   0:21:02  upgrade       168  Faster Counter L2
  0:21:09   0:20:22   0:21:38  perk         250r  Warm Welcome L1 (rep)
  0:22:31   0:21:42   0:22:48  license       200  License: Pickaxe
  0:24:41   0:23:59   0:24:54  license       200  License: Silver Key
  0:26:28   0:25:41   0:26:54  perk         300r  Velvet Rope L1 (rep)
  0:26:52   0:26:09   0:27:15  upgrade       210  Better Signage L2
  0:28:49   0:28:22   0:29:12  upgrade       250  Backroom Storage L1
  0:30:39   0:29:52   0:30:57  perk         320r  Haggler's Charm L2 (rep)
  0:31:08   0:30:30   0:31:18  upgrade       265  Extra Shelf L3
  0:32:52   0:32:05   0:33:06  fame        1.5kf  Fame tier: Legendary
  0:33:52   0:33:07   0:34:05  license       300  License: Quiver of Arrows
  0:35:44   0:34:57   0:36:00  perk         400r  Warm Welcome L2 (rep)
  0:36:27   0:35:42   0:36:44  license       300  License: Zip Tonic
  0:39:06   0:38:29   0:39:22  license       300  License: Iron Buckler
  0:40:48   0:40:00   0:41:05  perk         400r  Swift Wings L2 (rep)
  0:41:30   0:40:54   0:41:47  license       300  License: Spiked Club
  0:44:25   0:44:03   0:44:53  upgrade       353  Faster Counter L3
  0:45:46   0:44:55   0:46:00  perk         400r  Bulk Satchel L1 (rep)
  0:46:51   0:46:32   0:47:29  upgrade       441  Better Signage L3
  0:49:31   0:49:12   0:50:01  license       500  License: Iron Gauntlet
  0:49:48   0:49:06   0:50:07  perk         480r  Velvet Rope L2 (rep)
  0:52:47   0:52:22   0:53:11  upgrade       525  Backroom Storage L2
  0:53:45   0:53:02   0:54:03  perk         512r  Haggler's Charm L3 (rep)
  0:55:31   0:55:08   0:56:05  upgrade       556  Extra Shelf L4
  0:58:50   0:58:36   0:59:43  hire          600  Hire Greg
  1:01:40   1:01:33   1:02:34  license       600  License: Iron Shield
  1:05:12   1:04:23   1:05:20  fame          5kf  Fame tier: Mythic
  1:05:47   1:05:27   1:06:51  upgrade       741  Faster Counter L4
  1:08:59   1:08:34   1:10:15  license       800  License: Iron Sword
  1:12:38   1:12:02   1:13:52  license       800  License: Greater Flask
  1:16:45   1:16:14   1:17:58  upgrade       926  Better Signage L4
  1:20:54   1:20:32   1:22:20  upgrade      1.1k  Backroom Storage L3
  1:25:35   1:25:07   1:27:04  upgrade      1.2k  Extra Shelf L5
  1:30:18   1:30:09   1:32:10  hire         1.2k  Hire Doug
  1:33:21   1:30:59   1:35:50  find            -  Doug finds: The Skeleton Key
  1:34:47   1:33:29   1:36:51  license      1.2k  License: Knight Helm
  1:36:14   1:32:12   1:41:07  find            -  Doug finds: The Hero Magnet
  1:40:58   1:32:35   1:48:10  find            -  Doug finds: The Yesterday Potion
  1:41:08   1:38:21   1:43:13  upgrade      1.6k  Faster Counter L5
  1:42:58   1:35:23   1:53:54  find            -  Doug finds: The Everything Cloak
  1:47:18   1:43:20   1:48:33  upgrade      1.9k  Better Signage L5
  1:52:24   1:48:08   1:53:29  train          2k  Bob — Salesmanship L1
  1:56:56   1:52:37   1:57:59  train          2k  Greg — Deeper Backroom L1
  2:01:58   1:57:54   2:02:57  train        2.3k  Bob — Salesmanship L2
  2:06:53   2:02:46   2:07:42  train        2.3k  Greg — Deeper Backroom L2
  2:12:01   2:07:56   2:12:39  upgrade      2.5k  Extra Shelf L6
  2:17:38   2:13:53   2:18:21  train        2.6k  Bob — Salesmanship L3
  2:22:47   2:19:20   2:23:40  train        2.6k  Greg — Deeper Backroom L3
  2:28:36   2:25:08   2:29:44  relic      3k+20s  Restore The Skeleton Key
  2:34:34   2:31:04   2:35:49  train          3k  Bob — Salesmanship L4
  2:40:13   2:36:48   2:41:37  train          3k  Greg — Deeper Backroom L4
  2:46:27   2:43:17   2:48:15  train        3.5k  Bob — Salesmanship L5
  2:52:44   2:49:23   2:54:35  train        3.5k  Greg — Deeper Backroom L5
  2:59:53   2:56:08   3:02:03  upgrade      4.1k  Better Signage L6
  3:08:57   3:05:22   3:10:59  upgrade      5.1k  Extra Shelf L7
  3:19:33   3:15:53   3:22:00  relic      6k+30s  Restore The Hero Magnet
  3:34:53   3:30:47   3:36:20  upgrade      8.6k  Better Signage L7
  3:55:36   3:51:30   3:56:36  relic     12k+45s  Restore The Yesterday Potion
  4:16:13   4:12:15   4:17:47  train       12.1k  Bob — Salesmanship L6
  4:35:54   4:32:06   4:37:26  train       12.1k  Greg — Deeper Backroom L6
  4:58:29   4:54:31   4:59:56  train       13.9k  Bob — Salesmanship L7
  5:19:56   5:16:33   5:21:33  train       13.9k  Greg — Deeper Backroom L7
  5:43:53   5:41:18   5:45:57  train         16k  Bob — Salesmanship L8
  6:07:13   6:05:22   6:10:01  train         16k  Greg — Deeper Backroom L8
  6:34:25   6:28:00   6:36:28  train       18.4k  Bob — Salesmanship L9
  7:00:10   6:49:44   7:01:28  train       18.4k  Greg — Deeper Backroom L9
  7:26:09   7:14:03   7:27:10  train       21.1k  Bob — Salesmanship L10
  7:49:57   7:37:58   7:51:22  train       21.1k  Greg — Deeper Backroom L10
  8:18:03   8:06:38   8:19:08  relic     25k+60s  Restore The Everything Cloak
```

The story chart (seed 1) — wants remaining over the run:

```
       72 |#
          |##
          |###
          |#####
          |######
          |########
          |#########
       36 |#############
          |#################
          |######################
          |##########################
          |################################
          |##############################################
        5 |##################################################################
          +----------------------------------------------------------------------------------------------------
          0                                                                                            9:12:56
```

Savings velocity (net gold/min flowing toward wants, seed 1): 71 in the first half hour → ~340 by
2:00 → ~600 by 4:30 → ~880 by 8:00 — and still climbing *after* death (977 in the final window):
the milestone ladder (item breakpoints at 250/500/1000, ×1.25 "everything" tiers) keeps compounding
income even when nothing is left to buy.

---

## 4. Findings

**F1 — the diagnosis confirmed, and sharpened.** "Too finite" is measured: 8h18m to total
exhaustion, then 53k gold/hour forever. But the sharper fact is **variety dies long before
existence does**: every fame tier by **1:05**, every hire by **1:30**, every license by **1:35**
(Knight Helm — designed as "the top-shelf goal" — falls 95 minutes in), every perk by **0:54**,
every upgrade by **3:35**. From ~1:52 onward — **77% of the desire curve's lifetime** — the only
purchases are the two training ladders and three relic restores; from 3:55 onward it is *purely*
ten deep rungs and the final restore, ~4.4 hours of pressing two alternating buttons.

**F2 — the Mythic gate is inert.** Mythic (5,000 lifetime rep) was built as the deep-endgame gate
for training levels 6–10 — but it falls at **1:05**, forty-seven minutes *before* the first
training rung is even affordable (1:52). The deep band's tier gate never gates anything. Root
cause: rep/sale compounds hard (Better Signage ×4.5 + monster-milestone rep mults), so lifetime
rep at death is ~135k — the whole tier ladder sits in the first ~4% of a run's rep.

**F3 — the training metronome carries the whole mid-late game — by price, not design.** Rungs
6–10 (12.1k–21.1k against a 600–880/min purse velocity) actually pace *well* — one want every
20–25 minutes. The problem is not their cost; it's that they are the **only** content in that
band, and each rung's felt effect is small (+1 flat tip / +1 offline refill). Don't nerf the
prices to "fix" the endgame — the gap is variety, not cost.

**F4 — scrap is a second runaway.** Doug supplies ~5 scrap/min from hire; total lifetime demand is
155. At death every seed has banked ~1,860 (~12× oversupply); scrap is economically dead about two
hours after Doug is hired. The Special-of-the-Day repurpose is the natural home for a recurring
scrap sink.

**F5 — relic finds burst, restores pace.** In the median seed all four finds land within ~13
minutes of hiring Doug (per-seed spread: the last find lands 5–23 minutes after the hire). The
math agrees: 1/18 per 24s run truncated by the 25-run pity ≈ an expected find every ~5.5 minutes
(distribution probe-verified: mean gap 13.8 runs vs 13.7 theoretical) — so the "rare event"
intent plays as a post-hire burst. The *restores* then space themselves beautifully via gold
(2:29 / 3:20 / 3:56 / 8:18 — the Everything Cloak restore IS the death event in all five seeds).
If the find beats should feel like events, the lever is `chancePerRun`; if the restore pacing is
the point, it may be fine as-is — feel call.

**F6 — early game verified healthy.** The first hour is dense: a want falls every 2–3 minutes
across five different systems, matching the tuned-by-feel verdict. Nothing in the first ~90
minutes needs touching.

**F7 — income never stops growing.** Post-death velocity still climbs (884 → 977 gold/min) because
the invisible milestone ladder keeps crossing breakpoints. Any prestige math must assume the
income curve is open-ended while the sink list is static.

---

## 5. Tuning proposals (NOT applied — each is its own later pass, re-measured with the harness)

**P1 — size the locked sequence against the measured rates.** The repurpose + prestige need to
carry the game from roughly **hour 2** (where variety dies), not hour 8. For prestige
("Franchise"), the measured post-death rate (~53k/hour, still climbing) is the pricing anchor: a
first reset threshold in the **150k–400k gold-equivalent band** lands the first Franchise 3–8
hours in — inside the training band's lifetime, giving the metronome stretch a second axis.
Re-run the harness with the candidate numbers before locking any.

**P2 — re-seat the Mythic gate (one value).** `CONFIG.reputation.tiers[6].min` 5000 → somewhere in
the **25k–40k** band would land Mythic ~mid-run (against the measured ~135k lifetime at death),
making the deep-band gate real and giving the fame HUD a living long-term goal again. The harness
makes placing it a one-value iterate; note the fame-budget multiplier (+15%/tier above Beloved)
moves with it, so verify tier-2 affordability after.

**P3 — do not nerf deep-rung prices.** Their pacing is the healthiest stretch of the curve (F3).
If anything, the *shallow* band (rungs 1–5 at 2–3.5k against a 400–600/min purse: one every ~5
min) is where a felt-impact review belongs — but the honest fix for the metronome is P1's new
content, not price surgery.

**P4 — give scrap a recurring sink at the repurpose pass.** Sized against the measured **5
scrap/min** supply: e.g. relic buffs costing 10–30 scrap to activate/refresh makes scrap a
permanent economy instead of a 2-hour one. (Alternatively/additionally: future relic batches.)

**P5 — license ceiling for future gear batches.** The 800–1,200g "premium" rung lasts ~25 minutes.
When the parked gear-batch treadmill item comes up, a Mythic-gated license rung in the **5k–10k**
band extends the license curve into the training band's timeframe (and gives the re-seated Mythic
tier content on day one — the Warm Welcome precedent).

**P6 — relic find pacing (feel call, Daniel's).** If finds should be spaced events:
`RELIC_FIND.chancePerRun` 1/18 → ~1/45 puts expected finds ~18 minutes apart (pity unchanged as
the floor). If the gold-paced restores are the real beat, leave it.

---

## 6. Reproduction & stability record

`node sim_economy.mjs` from the repo root (Node only, no deps, no game files touched). Seeds 1–5,
dt 0.1s, greedy-cheapest policy, event-driven horizon (+60-min tail, 48h cap). Output verified
**bit-identical across 3 consecutive full runs** (the determinism IS the stability proof; the
statistical band is the 5-seed min–max spread, shown per row above). Suite re-certified at
**645 green** after the pass — zero game-file changes, per the audit law.
