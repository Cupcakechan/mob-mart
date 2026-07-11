# Mob Mart: A Deep Design-Research Report on Long-Term Retention in Idle/Incremental Games

## TL;DR
- **Mob Mart's core problem is not content volume — it is that it presents a "price list, not decisions."** The genre's most-retentive games keep players for months by forcing *meaningful, exclusive choices*, layering *new verbs* (not just bigger numbers) at each prestige, and *unfolding* new mechanics through discovery. Mob Mart currently has none of these; the completed economy audit — showing a "buy-cheapest-affordable-thing" greedy bot plays optimally, variety dead at ~1h50m, income running away at ~53k gold/hour by 8h18m with nothing left to want — is the smoking gun.
- **The single highest-leverage fix is to turn the Battle Results log from a passive comedy feed into an outcome the player can influence** — i.e., a Clickpocalypse-II/Soda-Dungeon-style "sponsor-a-party" loop where the shopkeeper equips the very monsters/adventurers whose results already scroll by. This is the one addition that converts the existing gear catalog, customer AI, relics, and door-destinations from flavor into a decision-and-synergy engine, and it fits the premise perfectly (a supply shop should have stakes in how its customers fare).
- **Recommended retention spine, built one system per solo-dev pass, in order:** (1) **Relic loadout / "Special-of-the-Day" synergy** — make choices exclusive and combinatorial (the empty relic effect slot is the natural, cheapest vehicle); (2) **Expeditions / party dungeoning** — the sponsor loop that gives the battle log stakes; (3) **Shop expansion (new rooms)** as the pacing container, one room per pass; (4) **Commissions** for timed active pressure; (5) **Franchise prestige that changes rules, not just multipliers** (themed on the six doors, each a distinct playstyle). Avoid prestige-onto-an-unchanged-loop, gimmick mini-games that don't feed the economy, and number inflation without new verbs.

---

## Key Findings

1. **The genre's retention comes from meaningful decisions, not idle income.** Anthony Pecorella — Kongregate's director of virtual goods and lead producer for the mobile version of *AdVenture Capitalist* — wrote in his "The Math of Idle Games" series (Game Developer/Gamasutra) that because "the newest generator is nearly always dominant once it can be purchased," the result is that "older generators are largely irrelevant and removes any interesting decisions." Deep incrementals deliberately engineer *shifting priorities* so the player must keep re-evaluating. Mob Mart's audit shows the opposite extreme: a greedy "buy cheapest affordable thing" bot is optimal, meaning there are no interesting decisions at all.

2. **Beloved deep incrementals introduce NEW mechanics/verbs over time; shallow ones only inflate numbers.** Antimatter Dimensions retains players for hundreds of hours because, as players describe it, "every time you think you've hit a wall, it throws a curveball (Infinity, Eternity, Reality) that completely changes how you play." AdVenture Capitalist churns because, per critics, "the game never really introduces anything new for the player to do." One player review captures the churn mechanism precisely: forward progress "only meant that the number got bigger… at no point I got curious about what I could be unlocking next." This is the central axis Mob Mart must design along.

3. **Prestige must change the rules, not just multiply.** The failure mode is explicit in critic writing: games "that reset you to zero without giving you new tools feel hollow on the second run." Realm Grinder's factions, Kittens Game's dual prestige, and Antimatter's stacked layers each hand the player a *different game* on reset. Mob Mart's roadmapped "Franchise" prestige must do this or it will fail.

4. **The "sponsor a party" loop is a proven, premise-perfect fit.** Clickpocalypse II (which the developer flagged) and Soda Dungeon both build their entire retention on the player *outfitting autonomous fighters from a shop and watching results*. Mob Mart already HAS the shop, the gear, the monsters, and the battle-results log — it is missing only the causal link between what the player sells and what happens in the log.

5. **Active mini-loops layered on an idle base are what separate "check-in" games from "obsession" games.** Cookie Clicker's Golden Cookie combos, Idle Slayer's minigames and boss fights, and Realm Grinder's spell-clicking all give the engaged player something to *do* that meaningfully accelerates the idle base. Mob Mart has zero timed active moments.

6. **Collection/completion and humor are real retention multipliers but are support beams, not the spine.** Mob Mart's Bestiary, Relic Forge, and comedy engine are genuine strengths that top games (NGU's MacGuffins, Leaf Blower's pets, Cookie Clicker's absurdist tone) share — but every one of those games pairs collection with a decision/synergy core. Collection alone does not retain.

---

## Details

### Part 1 — The Reference Set: What Each Game Does, Why It Retains, What Mob Mart Can Steal

#### Clickpocalypse II (the developer's flagged candidate)
**What it is:** An "incremental game disguised as an idle RPG." The player assembles a party (fighter, priest, ranger, wizard, plus unlockable classes), who then *autonomously* explore dungeons, kill monsters, collect loot, level up, and stop by a shop to sell junk. The player never directly controls combat — they act as "coach/delegator." It has genuine 600–2,000-hour players.

**Why it retains:**
- **The player's job is a stream of allocation decisions on top of autonomy:** "It is up to the player to decide when and how to spend experience, upgrade an adventurer's equipment, and more" — plus which of four skill trees to advance per character, and which equipment to swap.
- **Achievements feed metaprogression retroactively.** "Achievements make these various actions give more AP, and they even apply retroactively!" AP buys permanent perks (HP/MP regen, offline progress, a 5th party slot), creating an "achievements → upgrades → more playthroughs → more achievements" flywheel one reviewer explicitly praised.
- **Active items create timed moments:** potions and instant-loot/crowd-control spells (Web, Sleep) that "never fail" and let the party retarget. Effects "are generally timed and have a cool down period to prevent spamming them."
- **Map-clearing as legible forward structure:** clear a castle's dungeons, raise enemy level, then attack the castle; the map visibly turns from snow-white to green. A prestige-like "continuation victory" restarts with new unlocked classes and "a stacking skill point and inventory size bonus for every victory."
- **Anti-frustration item design:** "junk items will never be equipped over better items," and item types were re-characterized "so that characters don't compete for items."

**What Mob Mart steals:** The entire "outfit autonomous fighters, watch them succeed/fail, spend the returns on the shop" loop — but *inverted*: in Mob Mart the fighters are the comically-doomed monster customers, and the joke is that Bob's gear is what determines whether Slimey survives floor 1. This directly gives the Battle Results log stakes.

#### Soda Dungeon / Soda Dungeon 2 (the commercial proof of the inverted model)
**What it is:** You own a tavern, hire soda-drinking adventurers, equip them, and send them into a dungeon; they auto-fight (optional manual turn-based), bring loot back, and you upgrade the tavern/armory to attract better heroes. Soda Dungeon sits at "Very Positive (3,852) – 93% of the 3,852 user reviews for this game are positive" on Steam; Soda Dungeon 2 is likewise "Very Positive (3,103) – 93%."

**Why it retains:**
- **"Experiment with Confidence — Mix and match classes, try out loads of gear, and send them off to fight."** Team composition + gear is the decision layer, and "everyone comes home safe with all your hard-earned loot," so experimentation is low-risk.
- **Home-base expansion as content pacing:** Soda Dungeon 2 explicitly adds "a blacksmith forge, a wizard's shop, an arena, and more to unlock your party's true potential." This is the direct precedent for Mob Mart's "expand the shop with new rooms/stations" idea.
- **Custom AI scripting ("Soda Script")** lets invested players automate party behavior — automation-as-reward.
- **Relics and dimensions** provide the prestige/collection layer.

**Critical caveat for Mob Mart:** Soda Dungeon is only *lightly* idle — it doesn't progress while closed (only "battle credits" bank offline). Mob Mart should keep its stronger offline model and graft Soda Dungeon's *decision layer*, not its session structure.

**What Mob Mart steals:** The tavern→dungeon→loot→upgrade→better-recruits loop maps almost 1:1 onto shop→expedition→returns→upgrade→better-customers. "Build a blacksmith forge, a wizard's shop, an arena" is the blueprint for shop expansion.

#### Melvor Idle
**What it is:** A RuneScape-inspired idle game, 20+ interlocking skills. It holds "Very Positive (8,514) – 92% of the 8,514 user reviews for this game are positive" on Steam; players routinely log hundreds of hours (one review cites a friend with 480 hours and another player with 2,000+).
**Why it retains:** **Skill interdependency.** "Every skill in this game serves a purpose, interacting with the others in interesting ways. This means all the hard work you put into one skill will in turn benefit others." Combat uses Melee/Ranged/Magic with gear/ammo/rune economies feeding each other, plus 100+ monsters, dungeons, and mastery grinds. The retention engine is a *web of systems that feed each other*, not a single number.
**What Mob Mart steals:** The principle that Mob Mart's separate systems (gear, workers, relics, fame, doors) should *feed each other* rather than sit in parallel silos. Right now they're siloed.

#### Cookie Clicker
**Why it retains:** Two things beyond idle income. (1) **Golden Cookie combos** — an active, skill/timing minigame where stacking buffs (Frenzy for 7× CpS, Dragonflight at ×1,111 clicking / ×1,223 with Dragon's Fang, Dragon Harvest at ×15 CpS, plus selling buildings for the Godzamok click buff) can, per the Cookie Clicker Wiki, "easily grant several days worth of CpS in a few seconds" — the wiki's Frenzied Cookie Chain example cites bonuses "anywhere between 10800 and 75600 times the CpS." (2) **Synergies and ascension/heavenly upgrades** that reward system mastery. The lesson: a layer of *active, discoverable, multiplicative* play sits on top of the idle base for those who want it.
**What Mob Mart steals:** The "Special-of-the-Day"/relic-buff idea is Mob Mart's natural Golden-Cookie analog — a timed, stackable, active-decision buff window layered over passive serving.

#### Realm Grinder
**Why it retains:** **Exclusive factions that change your playstyle.** You align with Good (active/spell-clicking), Evil (idle/production), or Neutral factions, each with distinct upgrade trees; later you craft cross-faction "mercenary" builds. Reviewers: it's "way less linear than some other clicker games… you can eventually craft your own builds by combining various upgrades from different factions." Multiple reset layers (Abdication, Reincarnation, Ascension) each re-contextualize the game.
**What Mob Mart steals:** The **exclusive-choice** template for Franchise prestige — each of the six door destinations becomes a "faction" that grants a genuinely different playstyle (combat-focused vs. economy-focused), not just a +X% multiplier.

#### Antimatter Dimensions
**Why it retains:** **Stacked prestige layers that each unlock a new game.** Infinity → Eternity → Reality, plus Dimension Boosts, Galaxies, and Dimensional Sacrifice — "3 deep prestige layers, 100+ achievements, and months of content." Each layer introduces *new mechanics and currencies*, and it has anti-frustration "Content Summary" hints for returning players ("try to increase your Infinity Points").
**What Mob Mart steals:** The gold standard for "prestige changes the rules." Also the *legibility* lesson: even the deepest games tell returning players what to do next.

#### Kittens Game
**Why it retains:** **Interlocking resource interdependencies and unfolding discovery.** The peer-reviewed Carnegie Mellon / ETC Press study *"The Pleasure of Playing Less: A Study of Incremental Games Through the Lens of Kittens"* (Alharthi, Toups Dugas, Alsaedi, Tanenbaum & Hammer, 2017) found that games with "a narrow vocabulary of core interactions – primarily clicking and waiting… capture players' attention across months or even years of play (and idle) time," and that "each phase and metaphase represents a change in available game mechanics, with a concomitant change in planning activity." Kittens specifically beats number-inflation "through a clever series of upgrade interdependencies." It has two prestige systems (Paragon/Karma), 50+ resources, seasons that change production rates, and constant new-mechanic reveals.
**What Mob Mart steals:** Discovery structure — reveal systems progressively so the player is always learning a new verb, and make resources feed each other so scrap/gold/fame aren't independent.

#### Universal Paperclips
**Why it retains:** **Three completely distinct gameplay phases** (manufacturing → power/drone management → space exploration) — "What starts as a business simulator becomes something else entirely." Frank Lantz's design proves that *changing the verbs* mid-game, not adding zeros, creates a memorable arc. Even the prestige (Universe Next Door) offers a themed restart.
**What Mob Mart steals:** The ambition to have Mob Mart *become something else* as it progresses — the shop should evolve from "serve customers" to "outfit expeditions" to "run a franchise empire."

#### AdVenture Capitalist (the cautionary contrast)
**Why it fails long-term:** It is the archetype of the shallow idle. Critics: "extremely shallow… you're always making the same accomplishments over different lengths… there's no other hook"; "Individual purchases are basically meaningless. Only major upgrades and producer breakpoints really make a measurable difference"; "The game never really introduces anything new for the player to do." Its own producer's math writing diagnoses the disease: the newest generator dominating "removes any interesting decisions." **Mob Mart's audit places it squarely in AdVenture Capitalist territory today** — a greedy bot is optimal, variety dies at ~1h50m, income runs away with nothing to want by 8h18m.

#### NGU Idle
**Why it retains:** **Deep resource allocation** (Energy and Magic split across Basic Training, Augmentations, NGU skills), a giant interconnected "spider diagram of different numbers and systems," a MacGuffin collection meta, challenges (No Equipment, 24-hour) that force strategy rethinks, and beloved absurdist humor. A reviewer credits it with "delivering exciting new content at a reasonable pace." (One dissenting community view calls it shallow beneath the surface, but the consensus is strongly positive.)
**What Mob Mart steals:** Resource-allocation-as-core (splitting a scarce resource across competing uses) and challenges as replay content. Mob Mart's humor is already an NGU-style asset.

#### Leaf Blower Revolution
**Why it retains:** **Prestige-within-prestige** (Prestige → Big Leaf Crunch → Mega Leaf Crunch → Ultra Leaf Crunch), each unlocking new leaf types/areas/shops and new mechanics (combos, converters, crafting, pets). Praised as a gold-standard fair F2P. Each new currency tier "opens up new game mechanics, such as automatic leaf blowers… combos… and portals."
**What Mob Mart steals:** Layered prestige where each layer unlocks *mechanics*, and generous non-predatory monetization/QoL as a trust-builder.

#### Idle Slayer
**Why it retains:** A **side-scrolling active runner fused with idle**, deep skill tree (hundreds of nodes), 650+ achievements, multiple minigames (Bonus Stage, Chest Hunt, Grapple Run, boss fights), a Village with quests/story, minions, and layered prestige (Ascension → Ultra Ascension). Its own wiki frames the pacing target: "Early Game can last about a month, Mid Game… 1–3 months, and Late Game takes roughly 2–6 months." Active play is rewarded but not mandatory, and its minigames drop crafting materials/currency, not just points.
**What Mob Mart steals:** The active/idle balance model, minigames-that-feed-the-economy, and the multi-month content pacing target.

#### The current Steam audience (Idle Gamers curator + top-rated lists)
The developer's linked "Idle Gamers" curator recommends **Wizard And Minion Idle, Idling to Rule the Gods, Clicker Heroes, and Idle Wizard**, and flags **Idle Champions of the Forgotten Realms as "HIGHLY P2W"** and **Mr. Mine negatively because "when you close it you don't make any progress"** — confirming this audience values *fair monetization* and *real offline progress*. Current top-rated Steam idle/incremental games (Melvor, Kittens, NGU, Antimatter, Leaf Blower, CIFI, Unnamed Space Idle, DodecaDragons, Soda Dungeon) cluster around the same traits: **deep interlocking systems, layered prestige that adds mechanics, generous offline, and no paywalls.**

### Part 2 — The Distilled Framework: Core Retention Drivers, Ranked by Evidence

Ranked by weight of evidence for *long-term* (months) retention impact:

1. **Meaningful, exclusive decisions (highest impact).** The player must repeatedly face choices where picking A means *not* getting B, and where the right answer shifts over time. Evidence: Pecorella's "removes any interesting decisions" diagnosis; Realm Grinder factions; the fact that Mob Mart's audit shows a greedy bot is optimal is proof this is the #1 missing pillar.
2. **New verbs / unfolding mechanics over time (near-tied #1).** Retention lives in *becoming a different game*. Evidence: Universal Paperclips' three phases; Antimatter's "completely changes how you play"; the CMU Kittens study's "change in available game mechanics" per phase; the direct churn quote about "the number got bigger… at no point I got curious about what I could be unlocking next."
3. **Prestige layers that change rules, not just multiply.** Evidence: "reset you to zero without giving you new tools feel hollow"; Realm Grinder, Antimatter, Leaf Blower all reset *into new systems*.
4. **Multiplicative synergies discoverable through math.** Combos and build-crafting where order and combination matter. Evidence: Cookie Clicker combos, Realm Grinder cross-faction builds, Melvor skill interdependency.
5. **Resource-allocation puzzles.** A scarce resource split across competing uses. Evidence: NGU's Energy/Magic; Clickpocalypse XP/skill-point allocation.
6. **Active mini-loops layered on the idle base.** Optional timed engagement that accelerates progress. Evidence: Golden Cookies, Idle Slayer minigames/bosses.
7. **Collection/completion.** Support beam. Evidence: NGU MacGuffins, Bestiary-style tracking, Leaf Blower pets — always paired with a decision core.
8. **Legibility.** Systems must be understandable and signpost the next goal (Antimatter's Content Summary; the CMU study's finding that each phase is planned around). Complexity without legibility churns players.
9. **Humor/theme & fair monetization.** Trust and charm that make the above worth engaging with. Evidence: NGU, Cookie Clicker, Leaf Blower; the curator's P2W flagging.

### Part 3 — Mob Mart Gap Analysis (framework mapped onto existing systems)

| Driver | Mob Mart today | Reformable via |
|---|---|---|
| Meaningful exclusive decisions | **Absent** (price list; greedy bot optimal) | Scarce relic effect slots; loadouts; exclusive shop specializations |
| New verbs over time | **Absent** (new monsters/VIPs = quips only) | Expeditions, commissions, franchise mode |
| Rule-changing prestige | Roadmapped but undesigned (Franchise) | Six-door "factions" each a distinct playstyle |
| Synergies/combos | **Absent** | Gear set bonuses; relic buff stacking; Special-of-the-Day |
| Resource allocation | Weak (scrap/gold independent, no tension) | Split a scarce resource (expedition slots, staff time) |
| Active mini-loops | **Absent** | Special-of-the-Day timed window; commission rush; minigames |
| Collection | **Strong** (Bestiary, Relic Forge) | Keep; wire into buffs |
| Legibility | OK (clean systems) but no goal signposting | Add "what to want next" prompts |
| Humor/theme/fair-F2P | **Strong** (battle log, mimic Bob) | Keep as the wrapper for stakes |

**Diagnosis:** Mob Mart has built an impressive *quantity* of systems (27 gear items, 15 licenses, 22 upgrade levels, 3 workers, relics, fame, doors, bestiary), but they are **parallel silos that all resolve to the same verb — "serve a customer for gold"** — and that verb has no decision in it. The economy audit is definitive proof. New monsters and VIPs add flavor, not mechanics. This is the exact profile of a shallow idle that reviews well for days and is abandoned in weeks.

### Part 4 — Concrete Evaluated Proposals

#### Proposal A — "Sponsor an Expedition" / Party Dungeoning (THE SPINE)
**The premise inversion:** Bob doesn't just sell gear to doomed monsters — he can *sponsor* a squad (of monster-customers and/or adventurers), outfit them from shop stock, and send them through one of the six doors on an expedition. The Battle Results log stops being a passive joke feed and becomes *the readout of the player's equipment decisions*. The comedy engine survives intact (they still often lose, hilariously — but now you chose their loadout, so a loss is a lesson and a win is a payoff).

**What it adds in decision/allocation/synergy terms:**
- **Exclusive loadout choices:** finite gear slots per expedition member; you can't equip everything.
- **Synergy:** gear categories that combo (torch + oil = fire synergy; armor + shield = tank role) — Melvor/Clickpocalypse precedent.
- **Resource allocation:** limited expedition slots and/or staff time to run them.
- **Destination targeting:** each of the six doors is a different dungeon with different hazards, demanding different loadouts (crowd-targeting via the six destinations — already roadmapped).

**How it composes with the battle-log comedy engine:** The log becomes the expedition play-by-play — every quip is now contextual to a choice the player made. Doug (scavenger) can be reframed as the expedition guide; relics found become expedition rewards.

**Scope/rework cost (solo vanilla JS):** Medium-high. Reuses the gear catalog, monster roster, door destinations, battle-log renderer, and scrap/relic reward plumbing. New: a party/loadout data model, a resolution simulator (**can reuse the headless economy-sim tech from the audit as the combat resolver**), and an expedition UI. This is the biggest single build but the highest leverage.

**Precedent:** Clickpocalypse II, Soda Dungeon (near-exact model), Idle Slayer bosses.

#### Proposal B — Relic Loadout / "Special-of-the-Day" (THE FIRST PASS — highest-leverage *starter*)
The relic effect slot is *deliberately empty awaiting this pass*, making it the lowest-friction place to introduce the genre's #1 missing pillar: **exclusive, synergistic, timed decisions.**

**Design sketch:** The desk slot + 3 wall frames become **scarce buff-carrier slots.** Each restored relic grants a distinct effect ("+40% dragon spending," "scrap drops doubled," "fame ×2 for frog-type customers"). Because slots are scarce and effects are exclusive, the player must *choose a build for today* — and a rotating "Special-of-the-Day" (a daily target like "serve 20 bats" or "sell 5 weapons") rewards matching your relic loadout to the day's special. This is Mob Mart's Golden-Cookie/active layer.

**What it adds:** Exclusive choice (scarce slots), synergy (relic + special-of-day + customer affinity), a daily active decision, and a reason for the collection meta to matter mechanically.
**Scope:** **Low-to-medium** — the frames/slots/forge UI exist; you're adding an effect layer and a daily-objective system. **This is the recommended first build.**
**Precedent:** Cookie Clicker garden/combos, Realm Grinder artifacts, Leaf Blower gem upgrades.

#### Proposal C — "Mob for Hire" (interpretation matters)
- **(c1) Mobs as expedition fighters** — this collapses into Proposal A (best). Recommended.
- **(c2) Mobs as hireable shop staff** — served monsters can be recruited to work stations (a slime that restocks, a bat that scouts commissions). Adds a light allocation layer and rewards the Bestiary. Good *secondary* feature, low-medium scope, composes with shop expansion.
- **(c3) Mercenary parties for rent** — players rent out equipped mobs to other in-game factions for income. More complex, weaker thematic payoff; **defer.**
**Verdict:** Fold "mob for hire" into Expeditions (c1) as the headline, with staff-recruitment (c2) as a later shop-expansion perk.

#### Proposal D — Shop Expansion (new rooms/floors/stations)
**Design sketch:** Rooms unlock progressively and each **introduces a new verb**, using expansion as the *pacing container*: **Forge** (craft/upgrade gear → feeds Expeditions), **Alchemy Lab** (consumables/potions → timed active items, Clickpocalypse precedent), **Enchanting** (gear synergy modifiers), **Arena Viewing Room** (watch/bet on expedition outcomes → active mini-loop + comedy stage), **Staff Quarters** (recruit served mobs, Proposal c2).
**What it adds:** The Soda-Dungeon-2 / Universal-Paperclips lesson — the game *becomes something else* as rooms open. Each room is a discrete, shippable solo-dev pass.
**Scope:** Modular by design — build one room per pass. Medium each.
**Precedent:** Soda Dungeon 2 ("a blacksmith forge, a wizard's shop, an arena"), Kittens building unfolds.

#### Proposal E — Commissions (parked → revive as timed active layer)
**Design sketch:** A mob places a gear order with a **deadline** and a bonus payout ("Froggo needs a fire-kit before the swamp raid in 10 min"). Introduces *timed pressure*, resource prioritization (fill the commission vs. serve the queue), and a natural tie-in to Expeditions (commissioned gear performs in the log).
**What it adds:** The genre's missing "timed active moments"; light decision tension.
**Scope:** Low-medium; reuses gear catalog and customer roster.
**Precedent:** Idle Slayer daily quests, Soda Dungeon side-quests.

#### Proposal F — Franchise Prestige (roadmapped — design it as rule-changing)
**Design sketch:** Prestige resets the shop but you "franchise" through one of the six door destinations, each granting a **distinct, exclusive playstyle modifier** (Realm-Grinder-faction model): e.g., the *Cavern* franchise doubles scrap/relic economy but halves fame gain (idle/collection build); the *Colosseum* franchise supercharges Expeditions but slows passive serving (active build); the *Market District* franchise boosts customer budgets and commissions (economy build). Each unlocks unique upgrades and possibly a unique room.
**Critical:** Do NOT ship prestige as a flat ×N multiplier onto the current loop — that is the explicit hollow-second-run failure mode. Prestige must open a *new* build.
**Scope:** Medium; depends on Expeditions and Rooms existing first so there's a loop worth changing.
**Precedent:** Realm Grinder factions, Antimatter layers, Leaf Blower crunches.

#### Proposal G — Mini-games (only if they feed the economy)
**Rule:** Any minigame must output currency/materials/buffs into the core loop, never be a standalone score gimmick. Idle Slayer's minigames drop crafting materials; that's the bar. Good candidates: the **Arena Viewing Room** (bet gold on expedition rounds), a **haggling minigame** for VIP visits (the Inspector becomes a timed negotiation for a fame bonus), a **relic-restoration** timing minigame. **Reject** anything decorative.

### Part 5 — Common Failure Modes to Avoid
- **Prestige onto an unchanged loop.** Resetting "without giving you new tools feel[s] hollow on the second run." Franchise must change the rules.
- **Mini-game gimmicks that don't feed the economy.** If a minigame's reward isn't spent in the core loop, cut it.
- **Complexity without legibility.** Mob Mart already risks silo-sprawl; every new system must signpost "what to want next" (Antimatter's Content Summary model). Don't add a 10th parallel system — *connect* the existing ones.
- **Number inflation without new verbs.** The churn quote — progress meaning only "the number got bigger" — is exactly Mob Mart's audit result. Every pass should add a decision or a verb, not just a multiplier.
- **Keeping the greedy-bot-optimal economy.** Until buying decisions have exclusivity/opportunity cost, no amount of content fixes retention.

---

## Recommendations

**The retention spine (5 systems), in solo-dev build order:**

**Pass 1 — Relic "Special-of-the-Day" Loadout (START HERE).** Highest leverage-to-scope ratio. The effect slot is already empty and waiting; the forge/frames UI exists. This introduces the genre's #1 missing pillar — *exclusive, synergistic, timed decisions* — for the least code. **Success benchmark:** re-run the headless audit; if the greedy "buy-cheapest" bot is **no longer optimal** (a loadout-aware strategy beats it), you've fixed the core disease. If not, the effects aren't exclusive/impactful enough — increase opportunity cost.

**Pass 2 — Expeditions / Party Dungeoning (THE SPINE).** Build the sponsor-a-party loop that gives the Battle Results log stakes. Reuse the audit's simulation code as the combat resolver. This is the single system that converts gear, monsters, relics, and doors from silos into a decision-and-synergy engine, and it's the premise-perfect inversion. **Benchmark:** median session length and D7/D30 return rate should climb; players should be re-outfitting between runs (Clickpocalypse's "open it just to update equipment" loop).

**Pass 3 — Shop Expansion, one room per pass, starting with the Forge.** Use rooms as the pacing container. The Forge feeds Expeditions (craft/upgrade gear); the Arena Room adds the active betting mini-loop; Alchemy adds timed consumables. Each room = one shippable pass that adds a *new verb*. **Benchmark:** each room should introduce a decision that didn't exist before, verified by the audit bot needing a new strategy.

**Pass 4 — Commissions.** Layer in timed active pressure once Expeditions give commissioned gear somewhere to matter.

**Pass 5 — Franchise Prestige as rule-changer.** Only after there's a rich loop to reset. Each of the six doors = a distinct exclusive build (Realm Grinder model). **Benchmark:** a franchise run should feel like a *different game*, not a faster one.

**Sequencing logic:** Fix the decision core cheaply first (Pass 1), then build the spine that everything hangs on (Pass 2), then pace content through expansion (Pass 3+), and only prestige a loop that's already deep (Pass 5). This respects "one system per pass, solo" and front-loads the highest-leverage, lowest-scope fix.

**Thresholds that would change this plan:**
- If Pass 1's audit re-run shows the greedy bot *still* optimal → the problem is deeper in the buy economy; add gear exclusivity/tech-tree gating before building Expeditions.
- If playtesters find Expeditions fun but the shop-serving loop now feels like pointless busywork → make serving *feed* expeditions (customers pay in expedition supplies), fully merging the two loops.
- If scope on Expeditions proves too large for one pass → ship a "single champion" MVP (sponsor one monster, not a party) first, then expand to parties.

---

## Caveats
- **Source quality:** The strongest design-principle citations (Pecorella's Game Developer "Math of Idle Games" series; the peer-reviewed CMU/ETC Press Kittens study) are authoritative; several supporting quotes come from critic/community blogs and store reviews, which are illustrative rather than definitive. Pecorella's provenance as AdVenture Capitalist's producer is flagged specifically because it strengthens his diagnosis of the shallow-idle disease.
- **The Cookie Clicker combo figure** ("10,800–75,600× CpS") is drawn from the Cookie Clicker Wiki's Frenzied Cookie Chain example; the underlying per-buff multipliers (Frenzy 7×, Dragonflight ×1,111–1,223, Dragon Harvest ×15) are separately documented and are the more robust citation.
- **NGU Idle depth is contested:** one community voice calls it shallow beneath the humor; the consensus is strongly positive, but treat "NGU = deep" as majority, not unanimous, opinion.
- **Soda Dungeon is only lightly idle** (no true offline progression) — steal its decision layer, not its session model; Mob Mart's offline earnings are a genuine advantage to preserve.
- **Retention numbers are directional.** No public hard D30 dataset exists for these specific indie titles; "months of retention" claims rest on playtime reports, review counts (Melvor 8,514 reviews / 92%; Soda Dungeon 3,852 / 93%), Idle Slayer's own multi-month pacing statement, and the CMU study's qualitative findings — not controlled analytics.
- **Mob Mart's audit is the most reliable single datapoint** in this report — it is a direct measurement of the game, and every recommendation is anchored to changing its result (greedy bot no longer optimal).
- **Scope realism:** All estimates assume a solo vanilla-JS dev with no build tooling; Expeditions in particular may need to be staged into an MVP. The plan deliberately orders passes so the cheapest high-impact fix ships first.