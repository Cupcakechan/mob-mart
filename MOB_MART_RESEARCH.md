# Mob Mart: Extending the Idle Progression Loop — A Design Report

## TL;DR
- **The fix is not one big system but a *lattice* of small, bolt-on layers** that each reuse Mob Mart's existing hooks (reputation number, worker slots, item/monster registries, offline sim, battle log). The single highest-leverage additions are (1) **milestone "sales-count" bonuses** per item/monster (AdVenture Capitalist's core retention engine), (2) an **item-tier unlock cascade** that turns the shelf into an escalating series of wants, and (3) a **bestiary/collection layer** that converts the already-stubbed tab and comedic battle log into a completion goal.
- **Serve both player types by staggering "clocks."** Give the leave-it-open player fast active loops (milestone chases, live restock decisions) and the check-in-twice-a-day player slow-maturing payoffs (daily supplier delivery, offline reserve upgrades, a reputation-spend sink). Pecorella's Kongregate data shows idle retention is "off the charts" precisely because *the longer you're away, the bigger the reason to return* — but only if there's an uncapped-enough payoff waiting.
- **Keep prestige/rebirth as a *distant* capstone, not the near-term answer.** The dev's instinct is right: full resets are a big structural staple that would dominate the build. The near-term roadmap should be 6–8 shippable passes that each add a growth axis and always leave 2–3 visible wants on screen; a light prestige ("Franchise/Re-open") is worth scoping only after those layers exist.

## Key Findings

### The genre's retention toolkit (what actually keeps players growing)
Across the canonical incrementals and shop-sims surveyed, the mechanics that extend progression past the first upgrade wall fall into a small number of reusable patterns:

1. **Milestone / ownership bonuses ("every 25 of X").** AdVenture Capitalist's defining engine: per its wiki, "Time required to receive profits is halved at 25, 50, 100, 200, 300, and 400 units of each business type… It's further halved each time all buildings reach one of those milestones" (e.g., owning 25 of *every* building halves all timers again). Community consensus is that chasing these breakpoints — not raw cash — is the actual gameplay ("Chase milestones: aim for counts like 25/50/100 for big unlock bonuses"). Clicker Heroes uses the same idea: per its wiki, most heroes "get a 4× damage multiplier every 25 levels from level 200 upwards, and a 10× multiplier every 1000 levels." This is the cheapest, most genre-proven way to make a small catalog generate an endless goal ladder.

2. **Unlock cascades / tiered content.** Kittens Game, NGU Idle, and Antimatter Dimensions all sustain play by gating new *systems* behind progress — each new resource, building, or "dimension" unlocks the next. NGU explicitly structures itself as ~16 milestone unlocks ("Unlock Augments → Time Machine → Magic → first Titan unlocks the NGU tab…"), each a fresh wall. The key property: you always see the *next* locked thing.

3. **Multiple currencies / playstyle differentiation.** Beyond raw gold, second currencies create specialization. Kittens Game runs a bottleneck economy (catnip→wood→minerals→science→culture→faith) where progress is "identifying the bottleneck and building up that resource." Eric Guan's economy-design writeup notes multiple currencies also let *different reengagement frequencies* be optimized separately — a browser-tab player upgrades the short-clock resource, a twice-a-day player the long-clock one.

4. **Collection / completion systems (bestiaries).** A recurring, low-cost retention layer: Melvor Idle's Completion Log (every item found, every monster killed, mastery per action) is the entire endgame; Anti-Idle (a Kongregate native), Idle Slayer, and Milky Way Idle all have bestiaries that grant *permanent production bonuses per monster mastered* (Idle Slayer: +10% coins/souls at max mastery of an enemy; Milky Way: cumulative "bestiary points" with milestone rewards at thresholds). Per a Quantic Foundry/Nick Yee survey (July 6, 2016) of players of three idle clickers (AdVenture Capitalist, Clicker Heroes, Crusaders of the Lost Idols), "most [are] driven by Completion (collect stars, complete all missions) and Power (leveling up, getting powerful gear), and least driven by Excitement and Fantasy" — a bestiary serves both top motivators.

5. **Milestone/achievement bonuses that also buff play.** Realm Grinder's trophies and Melvor's 73-tier achievements grant permanent multipliers, turning "achievements" from vanity into a progression axis. Realm Grinder's Demons literally scale income off *number of trophies unlocked*.

6. **Automation tiers.** Every deep idle game sells automation as a progression reward, not a one-time toggle: Antimatter Dimensions gates autobuyers behind challenges then lets you *upgrade their speed*; Realm Grinder unlocks auto-casting after 60,000 lifetime mana; AdVenture Capitalist's managers are the first thing you buy. Automation is itself content.

7. **Synergy systems.** Realm Grinder's factions and Mercenary "hire an upgrade from every faction" builds, plus AdVenture Capitalist's Newspapers (which multiply *other* businesses), show how making one upgrade buff another creates combinatorial depth from few parts.

8. **Periodic/daily events & soft caps.** Kongregate's own live-ops lead ran a GDC talk on limited-time event design for its idle games; GameAnalytics and others note daily/weekly reward rhythms and "sneak peeks at yet-to-be-unlocked content" as core retention. Soft caps (Cookie Clicker's mastery "checkpoints," diminishing returns) pace the curve without hard walls.

### Shop-sim–specific progression patterns
- **Customer variety with distinct budgets/wants.** Recettear's customers have hidden reputation scores and specific tastes (the assassin likes a dark shop, the wizard wants books displayed, expensive window items draw the wealthy); Moonlighter unlocks "Special Customers" like the Rich Customer who prefers overpriced goods. Idle shop/tycoon games lean on **VIP customers** — rare high-value visitors gated behind reputation/achievements (Idle Shopping Mall's VIPs "only appear when your center achieves certain achievements").
- **Item-tier unlocks & shop expansion.** Shop Titans/Shop Heroes gate higher-tier blueprints behind crafting "Mastery milestones" ("crafting a few Training Bows unlocks the T2 Elmwood Bow"), and a bigger shop attracts higher-level customers who buy higher-tier goods. Moonlighter's town investment unlocks new shop upgrades, customer types, and crafting.
- **Supply/demand pricing & haggling.** Moonlighter/Recettear price items dynamically ("keep selling the same item and you flood the market, lowering value"); Potionomics makes daily events shift base prices and turns selling into a deck-building haggle. These add active decisions to each sale.
- **Relationships/regulars & crafting chains.** Potionomics' friend system teaches new haggle cards; Shop Heroes' hero affection and questing feed the crafting loop. Regulars/relationships are a slow-burn retention layer.

### Pacing & number-curve guidance (from Kongregate's Anthony Pecorella)
- **Cost grows exponentially, production grows linearly** — "a seesaw between production rates and costs." Per "The Math of Idle Games, Part I," "With AdVenture Capitalist Lemonade Stands, the rate_growth = 1.07, cost_base = 4, and production_base = 1.67/sec"; Derivative Clicker uses **1.1**. The commonly cited community band is 1.07–1.15. Mob Mart's move from 1.8x→2.1x is *far* steeper — appropriate for a game with very few upgrade levels (it forces the buyout to feel earned across a handful of purchases), but it means each new level must deliver a noticeably large payoff, and it caps total content fast. New *repeatable* sinks should use gentle multipliers (~1.1–1.15) so they last.
- **Purchase-multiplier "bumps."** Per Pecorella (Math of Idle Games, Part I), "You can see the expected spikes in purchases right around 25 and 50 multipliers kicking in, since those are temporarily overvalued." His advice: **"Make it bumpy" — smooth curves are boring; punctuate with milestone bumps and prestige jumps.**
- **Keep all generators relevant.** Use "aggressive multipliers to force relevance" and ownership-based cross-buffs (AdVenture Capitalist Newspapers buff other investments) so early items/monsters never become dead weight.
- **Prestige timing rule of thumb: reset when you'd gain +50%–200% prestige currency.** For a square-root-of-earnings formula, you must earn ~4x as much to double prestige currency (3x–4x for lifetime-earnings formulas). Egg Inc.'s **2-hour offline cap** he calls, verbatim, "a mistake, I churned out myself largely because of this." **This is a direct warning for Mob Mart, which currently uses the same 2h cap.**
- **Stagger layers across time horizons: Daily → Week → Month → Year.** Progression layers should resolve across escalating buckets as game speed slows. Pecorella gives **no** prescriptive number for "how many goals on screen" or "how long a layer should last" — those are framework, not figures. The widely used practical target (from idle-design writeups generally, not Pecorella specifically) is to always keep **2–3 affordable-soon wants visible.**
- **Idle retention is self-reinforcing:** "Progress without interaction creates a celebratory moment every time you return… the longer you don't play, the bigger the reason to return." He notes strong idle games often don't even need daily-login rewards — the returning stockpile *is* the reward.

### Kongregate-specific context
- **Badges are a first-class retention feature.** Kongregate curates badges with developers, tuned to be "achievable — even when they're labeled impossible," balancing time/skill/fun so they never feel "too grindy." Idle games are explicitly badgeable, and there's a dedicated idle badges category plus "Badge of the Day." Designing Mob Mart's milestone/achievement layer with clean, integer stat hooks (total sales, monsters served, reputation tier reached) makes it trivial to expose Kongregate badges later.
- **Kongregate benchmarks "hard retention"** (players returning *every* day through Day N) — its blog states this "gives the truest picture of how many people are sticking around," rewarding genuine daily-rhythm hooks over vanity numbers.
- The platform's idle audience is steeped in Realm Grinder, Anti-Idle, NGU Idle, Idle Dice, etc. — players who expect **stat tracking, secret/named achievements, collection tabs, and multi-layered unlocks**, and who tolerate deep systems introduced gradually.

## Details: Prioritized shortlist of mechanics for Mob Mart
Each is scoped as an individual shippable pass, ordered so every pass leaves 2–3 visible wants. "Build cost" is relative to Mob Mart's existing data-driven architecture.

### 1. Milestone sales bonuses ("Regulars' Loyalty") — **LOW cost — serves BOTH**
**What:** Every item and every monster tracks a lifetime count. At breakpoints (10/25/50/100/250… sales of an item; 25/50/100… of a monster served), grant a small permanent bonus — e.g., +% margin on that item, faster serve for that monster, or a global "+1% gold per Xth total sale." Add an "Everything" tier (e.g., 50 sales of *every* item) that grants a global multiplier, AdVenture Capitalist–style.
**Bolts onto:** the data-driven item/monster registries (add a `salesCount` field + a milestone table) and the existing gold/margin math.
**Why:** This is the single most genre-proven engine for turning a *tiny* catalog into an endless goal ladder — AdVenture Capitalist runs its entire retention on it (timers halving at 25/50/100/200/300/400 owned), and it directly answers "gold accumulates with nothing to want." Serves leave-open players (watch the next breakpoint tick up) and check-in players (return to find several breakpoints crossed). Exposes clean integers for Kongregate badges.

### 2. Item-tier unlock cascade ("Better Stock") — **LOW–MEDIUM — serves BOTH**
**What:** Add higher tiers of goods that unlock as reputation/sales grow — e.g., Club → Iron Sword → Enchanted Blade; Metal Helmet → Plate Helm; HP Flask → Mega Potion. Each tier has higher basePrice/restockCost and margin, and may require a reputation tier or a milestone to unlock. Optionally each monster "prefers" certain tiers (a skeleton wants armor, a slime wants potions), reusing the registry.
**Bolts onto:** the item registry (just more rows) and reputation tiers (as gates). The "prefers" logic reuses the monster registry.
**Why:** Tiered content is how Shop Titans/Shop Heroes, NGU, and Kittens sustain play — "you always see the next locked thing." Converts the flat shelf into an escalating want-list and gives the currently-useless reputation number a *reason to climb*. Low risk because it's data, not new systems.

### 3. Reputation spend sink & higher tiers ("Fame") — **LOW — serves check-in + both**
**What:** Stop reputation inflating uselessly past 200. Either (a) add tiers above Beloved (Renowned/Legendary at 500/1500…) that gate tier-2 items, VIP customers, and the second worker; and/or (b) make reputation a *spendable* currency for perks (permanent restock discount, +queue length, cosmetic shop signage that buffs rep-gain).
**Bolts onto:** the existing 4-tier reputation system (extend the tier table; add a spend action).
**Why:** The dev flagged reputation as "inflating infinitely with no use" — this is the fastest way to give an existing number meaning. Higher tiers create long-horizon check-in goals; a spend sink gives active players moment-to-moment choices. Mirrors how idle shop/tycoon games use a reputation currency to gate VIPs and premium upgrades.

### 4. Bestiary / battle-log collection ("Field Guide") — **MEDIUM — serves BOTH**
**What:** Fill the stubbed "SOON" bestiary tab. Each monster type served accrues entries; at kill/served thresholds unlock (a) new comedic battle-log lines for that monster (reusing the 148-line system), (b) a permanent per-monster bonus (Idle Slayer–style +% gold from that monster), and (c) "lore"/joke flavor. A completion % drives milestone rewards.
**Bolts onto:** the stubbed bestiary UI, the monster registry, and the per-monster battle-log line system — all of which already exist.
**Why:** Completion + Power are the top idle motivators (Quantic Foundry). This is the most *Mob Mart–native* idea: it monetizes the game's comedic voice as a reward. Melvor's Completion Log and Anti-Idle's bestiary prove collection is a sticky, badge-friendly endgame. Medium cost only because of UI/content authoring.

### 5. Second worker role + automation tiers ("The Back Room") — **MEDIUM — serves check-in**
**What:** Build the reserved **restock worker** so shelves auto-refill, then add *tiers* to both workers (serve speed / restock speed / carrying capacity) bought with gold and gated by reputation. A capstone: a worker that auto-collects offline reserves.
**Bolts onto:** the existing worker system (one worker + reserved restock role) and the upgrade cost curve.
**Why:** Automation-as-progression is universal in the genre (AdVenture Capitalist managers, AD autobuyer upgrades, Realm Grinder auto-cast). Completing the restock loop removes the last piece of mandatory babysitting for check-in players, while the *tiers* give a fresh gold sink. Uses the reserved role the dev already planned.

### 6. Daily supplier delivery & shop events ("Market Day") — **LOW–MEDIUM — serves check-in**
**What:** A once-per-day "supplier caravan" that gives a free restock crate / bonus gold / a limited special item when the player checks in (streak-based, non-consecutive-friendly like Idle Heroes' login). Layer in rotating "market events" that shift demand: "Dragon scare — everyone wants HP Flasks today (+50% flask margin)," reusing item data.
**Bolts onto:** the offline/timestamp system (already tracks away-time) and the item registry (event modifiers).
**Why:** Gives the twice-a-day player a concrete daily reason to open the tab, matching Kongregate's "hard retention" (daily-return) benchmark. Events add supply/demand variety à la Moonlighter/Potionomics without a pricing UI. Keep it monetization-free: rewards are gameplay resources, never premium currency, and never punish missed days (no decay — Pecorella: backward progress is a churn point).

### 7. New monsters as an unlock axis ("New Regulars") — **LOW — serves BOTH**
**What:** Ship the designed-but-unbuilt Gobbo (goblin) and rat, and frame *future monsters* as reputation/bestiary unlocks, each with distinct budgets/preferred items (a goblin haggles for cheap gear; a rat buys in bulk). New monster = new bestiary entries + new battle-log jokes + new milestone ladder.
**Bolts onto:** the monster registry, bestiary (#4), and milestones (#1).
**Why:** Recettear/Moonlighter customer variety is a proven shop-sim depth lever, and it multiplies the value of systems 1 and 4 at near-zero marginal cost since the registry is data-driven.

### 8. (Context only) Light prestige — "Re-open / Franchise" — **MEDIUM–HIGH — defer**
**What:** Once the above exist and a player has bought everything, offer a voluntary reset: close the shop, keep a permanent "Franchise" multiplier (based on lifetime gold, scaled by a square root so resets stay meaningful), restart cheap upgrades.
**Why deferred:** The dev explicitly wants to avoid letting full resets dominate, and Pecorella's math (reset when you'd gain +50–200% currency; need ~4x earnings to double a sqrt-based currency) shows prestige only *works* once there's enough runway to re-traverse. Build it last, if at all — it's the capstone that makes systems 1–7 replayable, not a substitute for them.

## Recommendations (staged build order)
Build one system per pass; each pass should ship only when it leaves **2–3 affordable-soon wants** on screen.

- **Pass 1 — Milestone sales bonuses (#1).** Highest leverage, lowest cost, immediately converts idle gold into goals. Benchmark to advance: playtest shows players chasing specific breakpoints rather than quitting at buyout.
- **Pass 2 — Reputation tiers + spend sink (#3).** Fixes the dead reputation number and creates the gates the next passes need.
- **Pass 3 — Item-tier cascade (#2).** Now that reputation gates exist, add tiered goods as the primary long-horizon want ladder. Fix the offline cap here too: **raise the 2h cap** (Pecorella's explicit anti-churn lesson) — e.g., 8–12h, or scale it with a Backroom Storage tier.
- **Pass 4 — Bestiary/collection (#4)** + ship **new monsters (#7)** alongside. This is the Mob Mart–signature layer; do it once you have milestone plumbing to hang bonuses on.
- **Pass 5 — Restock worker + automation tiers (#5).** Removes babysitting and adds a gold sink for the now-larger economy.
- **Pass 6 — Daily delivery & market events (#6).** Adds the explicit daily rhythm for check-in players once there's enough content to make returning worthwhile.
- **Pass 7 (optional, later) — Light prestige (#8).** Only after 1–6; scope with a square-root multiplier and a reset-when-+50–200% guideline.

**Number-curve guidance for every pass:** use gentle exponential multipliers (~1.1–1.15) for *repeatable* costs so a layer lasts many purchases; reserve the steep 2.1x only for the small fixed set of core upgrades. Add purchase "bumps" (a x2 at the 25th/50th of something) to create satisfying spikes. Never introduce backward progress or decay.

**Metrics/thresholds that would change the plan:**
- If Kongregate hard-retention (daily return) is the priority, pull **Pass 6 (daily delivery)** earlier.
- If playtesters exhaust content fast, the gentle-multiplier repeatable sinks (milestones, item tiers) are working as intended — add more registry rows before adding new systems.
- If players ignore the bestiary, it's likely a Power-not-Completion audience; lean harder on milestone/automation multipliers instead.
- Only build prestige (#8) once a measurable share of players reach full buyout and *keep playing* — otherwise it's premature.

## Caveats
- **Some cited comparators are monetization-driven; patterns were adapted, not copied.** Idle Supermarket Tycoon's VIP cars, Shop Heroes' gem economy, and Idle Heroes' login calendars are built around ads/IAP. I've translated their *structural* ideas (VIPs, daily deliveries, streaks) into pure free-progression form — rewards are always gameplay resources, never premium currency, and daily systems never punish missed days.
- **Pecorella gives frameworks, not all the numbers people attribute to him.** He explicitly does *not* prescribe "N goals on screen" or "each layer lasts X hours." The "2–3 visible wants" target and the 1.07–1.15 multiplier *band* are community conventions; his hard cited figures are 1.07 (AdCap Lemonade Stands), 1.1 (Derivative Clicker), the +50–200% prestige-reset rule, and the Egg Inc. 2-hour-cap-as-mistake opinion.
- **The steep 2.1x curve is a double-edged sword.** It makes Mob Mart's few core upgrades feel earned but guarantees a short content life; the recommendations deliberately add *gentle-curve, repeatable* sinks rather than more steep one-shot upgrades.
- **Build-cost estimates are relative** to Mob Mart's described data-driven, localStorage, no-server architecture and assume the registries and offline sim work as described. Content authoring (new joke lines, new item/monster data) is the main hidden cost in the "MEDIUM" items.
- **Source quality:** Wiki/fan sources corroborate game mechanics well but occasionally lag patches; the Pecorella GDC talks, the Math of Idle Games blog series, and Kongregate's own blog posts are the most authoritative design sources and were prioritized for pacing/curve claims.