// monsters.js — customer (monster) registry.
// WANTS (A2, items-scaffold pass 2026-07-04): each monster declares CATEGORY affinities
// (categoryWeights) plus optional per-item multipliers (itemBias, ?? 1). The picker in game.js
// rolls category first, then an item within it — so a personality share ('Froggo is half potions')
// holds no matter how large a category grows, and a NEW item is wanted the moment its registry row
// exists (true auto-flow; the old per-item wantWeights needed every monster touched per item).
// (Gobbo the goblin was redesigned into Froggo the grumpy FROG before implementation — Daniel,
// 2026-07-04; id + all PNG naming = `frog`. Rat remains an open call, handoff §13.)
// LORE (Field Guide, 2026-07-15 — Daniel's "short but funny descriptions + more revealed as
// players reach milestones"; Option 2 staged, pass 2a). `lore.tagline` is the ONE line a Field
// Guide card carries once the mob is discovered — the card ADVERTISES, and pass 2b's Dossier
// INFORMS (the sale-sign doctrine, applied to a second surface). COMEDY_BIBLE voice: each tagline
// plays that mob's one comic lever, ≤80 chars, no second person, punch word last — cover the name
// and it should still be obvious who it is. Optional by contract: every read site guards
// (`lore?.tagline ?? ''`), so a future mob without one degrades to no line, never a crash.
// Pass 2b adds `lore.beats` (the progressive reveal) beside it — additive, no consumer churn.
export const MONSTERS = {
  slime: {
    id:'slime', displayName:'Slimey', spriteId:'slime', combatMod:-2, budgetRange:[10,20],
    spriteScale: 1.15,   // squat silhouette reads small next to the chunky bat (measured: 72% frame height)
    footPad: 18,         // MEASURED (2026-07-03): transparent rows below the feet in slime.png —
                         // drawMob shifts the sprite down by this (scaled) so feet meet the shadow.
                         // Re-measure if the art is trimmed/re-authored; trimmed art -> set 0.
    anim: { frames: 4, fps: 6 },   // idle wobble: slime_idle.png on the SHARED contract (4x128 ->
                                   // 512x128 strip); strip absent -> static slime.png (graceful)
    categoryWeights: { consumable: 3, weapon: 2, armor: 1 },   // the flask fan, by category
    material: 'slime_core', materialEveryNServes: 10,   // drop law: servedNow % N === 0 (game.js)
    lore: {
      tagline: "Absorbs everything he touches. Retains nothing he learns.",
      notes: [
        { label: "DIET",
          text: "Slimey buys flasks and drinks them without opening them. Bob has explained the cap four times. Slimey listens carefully every time, nods, and swallows the next one whole." },
        { label: "COMBAT RECORD",
          text: "Slimey has lost more fights than the rest of the queue combined. He keeps no record of it, so by his own accounting he is undefeated. The heroes have stopped arguing. It was easier." },
        { label: "PROPERTY RECOVERED",
          text: "Bob once fished a sword, two coins and a door key out of Slimey. None were his. Slimey watched the whole procedure with polite interest, thanked Bob warmly, and swallowed the key again." },
        { label: "RETENTION",
          text: "Nothing Slimey learns survives the night. Bob tested it once — taught him a rule on a Tuesday, asked on Wednesday. Slimey had lost the rule, the Tuesday, and Bob. He was thrilled to meet him." },
      ],
    },
                         // — deterministic, plannable, throttled. All six Ns RETUNED ~2.5× on
                         // 2026-07-11 (Daniel: 4–6 felt like confetti; ~1 material/min roster-wide now)
  },
  bat: {
    id:'bat', displayName:'Batty', spriteId:'bat', combatMod:-1, budgetRange:[12,22],
    flying: true,        // flyers keep the idle hover bob; bat.png's 15px bottom padding is the
                         // hover ALTITUDE (deliberate), so no footPad here — grounded mobs get both.
    anim: { frames: 4, fps: 6 },   // idle wing-flap: bat_idle.png, 4x128 -> 512x128 strip (optional
                                   // field — absent = static <id>.png, then the placeholder rect)
    categoryWeights: { armor: 3, consumable: 2, weapon: 1 },   // the armor lover, by category
    material: 'echo_fang', materialEveryNServes: 10,
    lore: {
      tagline: "Ambushes from perfect silence. Ruins it immediately by screaming.",
      notes: [
        { label: "HABITAT",
          text: "Batty has ambushed the same corridor for six years. He has never once been in it when a hero came through. He calls the record spotless. Nobody has found a way to disagree." },
        { label: "KNOWN ASSOCIATES",
          text: "One pebble, acquired during a bad week. Batty will not say where from, only that it listens better than most. He introduces it to everyone he meets. Twice, if the first went badly." },
        { label: "EQUIPMENT",
          text: "Batty owns more armor than the rest of the queue combined and has never once been hit while wearing it. He credits the armor. Bob, who has watched him flee every single fight, says nothing." },
        { label: "ON RECORD",
          text: "Bob once suggested a different corridor. Batty took the suggestion home, considered it three days, and came back to say he'd rather not. Then he screamed. Then he apologised for the scream." },
      ],
    },
  },
  skeleton: {
    id:'skeleton', displayName:'Skele', spriteId:'skeleton', combatMod:1, budgetRange:[12,24],
    spriteScale: 1.15,   // beanpole silhouette (47px wide) carries little mass — same bump as Slimey
    footPad: 12,         // MEASURED (2026-07-03): transparent rows below the feet in skeleton.png
    anim: { frames: 4, fps: 6 },   // idle rattle/sway: skeleton_idle.png, SHARED contract as above
    categoryWeights: { weapon: 3, armor: 2, consumable: 1 },   // sword guy, by category
    material: 'femur_charm', materialEveryNServes: 12,
    lore: {
      tagline: "Death holds no fear for him. Stairs do.",
      notes: [
        { label: "CONDITION",
          text: "Skele died a long time ago and has made his peace with it. He has not made his peace with the shop’s back step, which he has fallen down eleven times. He counts. Death, he never counted." },
        { label: "PREFERRED STOCK",
          text: "Skele buys swords and only swords. He tests each by holding it at arm’s length, to see whether the arm agrees. Twice, the arm has left with the sword. Bob now keeps a box for the arm." },
        { label: "IDENTIFYING MARKS",
          text: "The left femur is not his. He picked it up after a bad landing and never mentioned the swap to anyone. The original turns up in the queue now and then, doing well for itself. They nod." },
        { label: "THE STAIRS",
          text: "Bob installed a handrail. Skele thanked him warmly, formally, in front of the whole queue — and has never touched it. He says it’s there for the others. There are no others. Nobody else falls." },
      ],
    },
  },
  frog: {
    id:'frog', displayName:'Froggo', spriteId:'frog', combatMod:0, budgetRange:[16,30],
    spriteScale: 1.1,    // content is 76% of frame (MEASURED) — 1.1 puts his visible body ~73px,
                         // matching Slimey's mass; at 1.0 the roster's big spender read smallest.
    footPad: 15,         // MEASURED (2026-07-04): transparent rows below the feet in frog.png
                         // (walk strip pads 13 — 2px variance, same negligible drift as Slimey's).
    // Pass 4b (Option 2 — "the tier-2 customer"): a grump with gold. Wants LEAD with licensed
    // items; pre-license the unlock filter (spawnCustomer) drops them and he buys base goods like
    // everyone else — the moment tier-2 is licensed, its shelf gains a dedicated regular. Budget
    // sits above the trio ([16,30] vs [10..24]) to actually afford those prices; economy note:
    // +~20% avg budget on 25% of spawns — one tuning look owed after feel.
    // Grounded (no `flying`). Art integrated 2026-07-04 (static + walk strip; frog_idle.png
    // still PENDING at origin — the anim fallback draws the static until it lands).
    anim: { frames: 4, fps: 6 },   // idle: frog_idle.png on the SHARED 4x128 -> 512x128 contract.
                                   // NOTE the walk strip stays `frog_walk_happy.png` by CONVENTION
                                   // but its authored content is a grumpy stomp — Froggo marching
                                   // to battle annoyed IS the joke; do not "fix" the mismatch.
    categoryWeights: { consumable: 3, weapon: 2, armor: 1 },
    material: 'bogstone_bauble', materialEveryNServes: 15,   // premium customer, stingier drop
    itemBias: { greater_flask: 3, iron_sword: 2 },   // the tier-2 customer: once licensed, his
    lore: {
      tagline: "Has never enjoyed a dungeon. Has never missed one either.",
      notes: [
        { label: "PURCHASING",
          text: "Froggo buys the Greater Flask every visit and has never once looked pleased about it. He asked Bob whether there was a better flask. There is not. He bought the Greater Flask again." },
        { label: "CORRESPONDENCE",
          text: "Froggo files a complaint after every outing. The dungeon has no complaints desk, no address, and no staff. Froggo knows this. He files them anyway, in triplicate, and keeps his copy." },
        { label: "RATINGS",
          text: "Every dungeon Froggo has visited holds a rating of one star. He has visited some of them four hundred times. When Bob asked why, Froggo said he was waiting to see if they improved." },
        { label: "ATTENDANCE",
          text: "Froggo has not missed a day in six years. Bob once asked, gently, whether he enjoyed any of it. Froggo considered the question seriously, said no, and asked what time they opened tomorrow." },
      ],
    },
                                                     // signature goods dominate WITHIN the category
                                                     // (pre-license the unlock filter hides them).
  },
  rat: {
    id:'rat', displayName:'Ratty', spriteId:'rat', combatMod:-1, budgetRange:[6,16],
    thief: true,         // Pass B (2026-07-05): a patience-timeout LEAVE pockets one unit of his
                         // wanted item (game.js leave branch reads this flag — registry-driven,
                         // so a future thieving mob joins the mechanic with one field).
        spriteScale: 1.1,    // content is 76% of frame (MEASURED 2026-07-05 via pngjs) — the exact
                               // Froggo ratio, so the exact Froggo calibration. PROVISIONAL: confirm
                         // his mass reads right beside Slimey in the queue.
      footPad: 15,         // MEASURED (2026-07-05): transparent rows below the feet in rat.png —
                         // coincidentally identical to Froggo's 15.
                         // funny. Art: rat.png LANDED 2026-07-05 (footPad + scale measured above); the idle and walk
    // strips are authored and incoming — registered in main.js already, they light up on drop.
    // The Rat Thief (roadmap item 6, Pass A — Daniel 2026-07-05). Comic lever: CHEERFUL
    // ACQUISITION (nothing is stolen; everything is "found"). The ANTI-Froggo economically:
    // a true scrounger's purse ([6,16] vs Froggo's [16,30]). The floor was pinned at 10 until
    // budget-aware wants shipped (Option 2 soft bias, 2026-07-06) — the want pick now weighs
    // affordable items x4, so a 6-gold Ratty mostly wants Tattered Shirts and Bandages instead
    // of stranding on a Club; the rare mismatch is the auto-wave's job (by design, it keeps the
    // broke-comedy register alive). Grounded (no `flying`). combatMod -1: scrappy, loses
    // funny. Art PENDING — placeholder-first: rat.png (static 128) + rat_idle.png (4x128 strip)
    // + rat_walk_happy.png, all registered in main.js (the wall_shelf lesson); footPad MEASURED
    // via pngjs when the PNG lands — absent until then, every read site guards ?? 0.
    // Pass B (queued, separate commit): the LEAVE-THEFT — he pockets one unit of his wanted item
    // on a patience timeout; dismissing him prevents it. Plus the away-modal "prevented
    // robberies" flavor line (Daniel's idea, same queue).
    anim: { frames: 4, fps: 6 },   // idle strip on the SHARED 4x128 -> 512x128 contract;
                                   // absent -> static -> placeholder, never a crash
    categoryWeights: { consumable: 2, weapon: 2, armor: 2 },   // omnivorous scrounger — anything
                                                               // unattended is interesting
    material: 'stolen_trinket', materialEveryNServes: 10,   // the scrounger sheds loot readily
    itemBias: { rusty_key: 3, tattered_shirt: 2 },   // signature loves: a THIEF craves the key,
    lore: {
      tagline: "Has never stolen anything. Has found a truly remarkable amount.",
      notes: [
        { label: "MEANS",
          text: "Ratty has the smallest purse in the queue and the fullest pockets in the dungeon. He is a coin short at the counter every visit, without fail, and pays the difference in apologies." },
        { label: "THE KEY",
          text: "Ratty buys the Rusty Key whenever it’s in stock and has never said what it opens. Bob asked once. Ratty said it was complicated, bought a second one, and changed the subject to weather." },
        { label: "INVENTORY",
          text: "Ratty’s collection includes four spoons, a doorknob, and a small painting of a hill. Every item was found. Ratty is very clear about this. He is clear about it before anyone asks." },
        { label: "THE INCIDENT",
          text: "Ratty ran out of patience once and left. So did a shield. He came back the next day to explain, at length and unprompted, that the two were unrelated. Bob had not asked. Bob never asks." },
      ],
    },
                                                     // and the cheapest shirt is peak scrounger
  },
  beetle: {
    id:'beetle', displayName:'Beetley', spriteId:'beetle', combatMod:1, budgetRange:[14,26],
    footPad: 9,          // MEASURED (2026-07-05, pngjs) from beetle.png: transparent rows below feet
                         // content is 85% of frame height — trio-class mass, so NO spriteScale
                         // (default 1.0; Froggo/Ratty needed 1.1 at 76%)
    // Beetley (roadmap 6.5 — Daniel swapped the planned Goblin for the beetle, 2026-07-05).
    // Comic lever: the OVERPREPARED TINY SOLDIER — treats shopping like requisitions, drills
    // formations of one, salutes decisions. Economic identity: the roster's ARMOR LEAD (a beetle
    // buying armor to wear over his shell IS the joke), mid purse between the trio and Froggo.
    // combatMod +1: trained — wins respectably, loses at attention.
    patienceBonus: 8,    // THE STEADFAST QUIRK (Option 2, Daniel 2026-07-05): +8s on the 24s
                         // default (~33% more) — the guard holds the line. Ratty punishes
                         // inattention; Beetley forgives it — the thief and the guard bracket
                         // the patience system from both ends. PROVISIONAL feel dial.
    anim: { frames: 4, fps: 6 },   // idle strip, shared 4x128 contract; strips authored, incoming
    categoryWeights: { armor: 4, weapon: 2, consumable: 1 },   // armor-first by a wide margin
    itemBias: { wooden_shield: 2, iron_buckler: 2 },           // signature loves: MORE shell
    material: 'carapace_shard', materialEveryNServes: 12,
    lore: {
      tagline: "Reports for duty daily. No one has ever assigned him any.",
      notes: [
        { label: "KIT",
          text: "Beetley arrives wearing a shell and buys armor to go over it. Standard issue, he explains, is never enough. Bob has spent two years failing to work out who issues Beetley his standards." },
        { label: "THE QUEUE",
          text: "Beetley waits longer than any mob in the shop, by a wide margin, and by choice. He calls it holding the line. The line is a queue. He is holding it for a shop that would have served him first." },
        { label: "PAPERWORK",
          text: "Beetley files a daily report. It goes to Beetley. It is reviewed by Beetley, who has twice sent it back with notes. Bob has offered to read one. Beetley said that would be irregular." },
        { label: "ORDERS",
          text: "No one has ever given Beetley an order. He reports at opening regardless, salutes the door, and takes up a post nobody assigned. Bob once said good morning. Beetley logged it as a directive." },
      ],
    },
  },

  demon: {
    id:'demon', displayName:'Demmy', spriteId:'demon', combatMod:2, budgetRange:[20,36],
    footPad: 10,         // MEASURED (2026-07-11, pngjs): uniform across static + idle; walk 10-11
                         // (±1, the Froggo-class variance — negligible). Content 81-84% of frame:
                         // trio-class mass, NO spriteScale (the Beetley precedent).
    // DEMMY (reform sequence step 3a — Daniel picked Option 1, 2026-07-11). Comic lever: the
    // APOLOGETIC MENACE — the roster's FIRST real threat (combatMod +2: he WINS fights, and is
    // terribly sorry about every one of them; his excellent/success tiers are the log's new
    // victory-as-apology register). Economic identity: the NEW TOP SPENDER ([20,36], above
    // Froggo's [16,30]) and the second weapon lead (Skele finally has an aisle colleague) —
    // and his iron_sword signature makes him THE MARKET'S DEMAND ENGINE: a premium buyer
    // chasing the trade-tier good is the organic answer to the thin sword margin the
    // 2026-07-11 retune measured. Pre-license the unlock filter hides the sword and he buys
    // base goods (the Froggo precedent). combatMod note: +2 shifts the outcome mix — one
    // tuning look owed after feel, same as every customer landing.
    anim: { frames: 4, fps: 6 },   // idle + walk strips IN (2026-07-11), shared 4x128 contract
    categoryWeights: { weapon: 3, consumable: 2, armor: 1 },   // sword-first; flasks for the nerves
    itemBias: { iron_sword: 3, greater_flask: 2 },   // signature loves: the TRADE item leads
    material: 'infernal_ember', materialEveryNServes: 15,   // premium-rare, the Froggo logic
    lore: {
      tagline: "The most dangerous mob in the queue. Terribly sorry about it.",
      notes: [
        { label: "THREAT ASSESSMENT",
          text: "Demmy is the only mob in the queue who reliably wins. He finds this awkward and has apologised for it to the queue, to Bob, and once, at some length, to a hero who was already leaving." },
        { label: "PURCHASING",
          text: "Demmy outspends the entire queue on swords and asks, every time, whether anyone else needed this one first. Nobody ever does. He buys it anyway, and tips Bob for the inconvenience." },
        { label: "CORRESPONDENCE",
          text: "Demmy writes to every hero he defeats. The letters are handwritten, sincere and specific about what went wrong. Four have written back. Two wanted a rematch. Two just wanted to keep writing." },
        { label: "DISPOSITION",
          text: "Bob once told Demmy he was allowed to enjoy winning. Demmy thanked him, thought about it for a week, and came back to say he had tried and it hadn’t taken. He apologised for wasting the advice." },
      ],
    },
  },

  spider: {
    id:'spider', displayName:'Leggsy', spriteId:'spider', combatMod:0, budgetRange:[14,28],
    bulkBuyer: true,     // THE OVERSTOCKER QUIRK (reform 3b, Daniel picked Option 2, 2026-07-11):
                         // one serve buys TWO units when the shelf holds >= 2 and the purse covers
                         // double — eight legs, eight of everything. The serve-path branch in
                         // game.js reads this flag (registry-driven, the thief precedent): a
                         // future bulk mob joins the mechanic with one field. First demand-side
                         // pressure on STOCK DEPTH — Extra Shelf, restock cadence, and the
                         // market's daily sword supply all matter more with her in the pool.
    spriteScale: 1.05,   // PROVISIONAL (2026-07-11): content 79-80% of frame (pngjs) sits between
                         // Froggo/Ratty's 76% (-> 1.1) and Beetley's 85% (-> 1.0); her leg span
                         // carries width the vertical scan can't see. Daniel's screenshot decides.
    footPad: 12,         // MEASURED (2026-07-11, pngjs): static + idle uniform 12; walk 12-14
                         // (±2 — the Froggo-class variance, negligible).
    // Comic lever: DESPERATELY EARNEST BULK SHOPPING — too many legs, too many needs, buys in
    // pairs and is thrilled about it. combatMod 0: tangles everyone in web, loses on points.
    // Economy note: double sales on 1/8 of spawns — one tuning look owed after feel (the
    // Froggo/Demmy precedent).
    anim: { frames: 4, fps: 6 },   // idle + walk strips IN (2026-07-11), shared 4x128 contract
    categoryWeights: { consumable: 3, armor: 2, weapon: 1 },   // leg maintenance first
    itemBias: { bandages: 3, zip_tonic: 2 },   // signature loves: bandages BY THE PAIR is the joke
    material: 'silk_bundle', materialEveryNServes: 12,
    lore: {
      tagline: "Buys two of everything. Eight legs, eight needs, one system.",
      notes: [
        { label: "THE SYSTEM",
          text: "Leggsy buys two of everything. Asked why, she said the system requires it. Asked what the system was, she said it required two of everything. Bob has not found the end of this thread." },
        { label: "BANDAGES",
          text: "Leggsy buys bandages in pairs and has never been visibly injured. She keeps them, she says, against the day. Bob asked which day. Leggsy said she’d know it when she saw it, and bought two more." },
        { label: "INVENTORY IMPACT",
          text: "A Leggsy visit takes twice the stock and leaves twice the coin. Bob has learned to hear her coming: the shelf goes quiet, the register does not. He has never asked her to buy less." },
        { label: "LEGS",
          text: "Leggsy has eight legs and buys for all of them equally, which is why nothing ever comes in ones. Bob pointed out that she only has one head. Leggsy said she was aware, and bought two hats." },
      ],
    },
  },

  dragon: {
    id: 'dragon', displayName: 'The Inspector', spriteId: 'dragon', combatMod: 1,
    budgetRange: [200, 400],   // the once-a-day whale: buys anything on the shelf, fame-scaled
    material: 'dragon_scale',          // VIP DROPS (Pass B, §13.1 as Daniel picked): the Scale
    gradeMaterial: 'inspectors_seal',  // rides EVERY visit; the SEAL only a TOP-GRADE inspection
                         // (CONFIG.visits.sealFullness). BOTH stay out of trade recipes forever —
                         // eligibleMaterialIds filters special rows — and out of the serve-drop
                         // law (its !special guard): the inspection block in game.js is their
                         // only faucet. The Seal is RESERVED for relic restores (Daniel,
                         // 2026-07-11); the Scale for future premium sinks.
    special: true,       // SPECIAL VISITS (Option 2, Daniel 2026-07-07): NEVER in the normal spawn
                         // pool, the bestiary grid, or breakpoint milestones — he arrives only via
                         // trySpawnVisit (once per calendar day at Legendary+). Consumers filter on
                         // this flag; a future VIP is one more row carrying it.
    pixelScale: 1,       // DRAW 1:1 (reauthor 2026-07-08). Authored at DISPLAY size (160px frame),
                         // drawn 160px on-screen -- no multiplier, no upscale (the sizing saga's rule:
                         // oversized characters author 1:1 like Greg, never routed through a scale).
                         // On-screen: 160 box, ~132 visible body -- level with Bob's ~125, ~1.4x a
                         // normal mob's ~90, under the 320 door. mobDrawnBox = frame x pixelScale, so
                         // this holds while the frame stays 160 (frameSize below; the suite reads the PNG).
    frameSize: 160,      // AUTHORED frame w/h (pngjs-measured). The suite asserts every pixelScale VIP's
                         // PNGs match this -- a re-export at another size fails the build instead of
                         // exploding at draw time (the saga's silent 512px dragon). New VIPs carry it.
    footPad: 14,         // MEASURED (pngjs): 13-15 consistent across all nine authored frames
    patienceBonus: 24,   // a VIP walkout is a feel-bad — double the base wait (Steadfast's big
                         // brother; Beetley holds the line, the Inspector owns the clipboard)
    // THE INSPECTOR — glasses + clipboard (Daniel's art, the design read straight off it). Comic
    // lever: OFFICIALDOM IN A MONSTER SHOP — he grades, he annotates, he tips by the numbers.
    // Economic identity: his tip is a REPORT CARD on the shelves (inspectionGrade, game.js) —
    // the restock loop itself is what gets celebrated.
    anim: { frames: 4, fps: 6 },
    categoryWeights: { weapon: 1, armor: 1, consumable: 1 },   // an inspector samples impartially
    lore: {
      tagline: "Grades the shop against criteria nobody has ever seen.",
      notes: [
        { label: "JURISDICTION",
          text: "The Inspector arrives at most once a day, unannounced, on business he has never described. Nobody has established what he inspects for, who reads the findings, or what happens if they are bad." },
        { label: "METHOD",
          text: "He pays for the shelf, not the goods. A full shelf pays well; a bare one pays anyway, less. He has never once looked at what he bought, and has never once bought nothing." },
        { label: "CONDUCT",
          text: "The Inspector waits twice as long as any mob, without complaint and without putting the clipboard down. The wait goes on the clipboard. So does the queue. So does Bob." },
        { label: "THE SEAL",
          text: "On an immaculate shelf, he awards a seal. On anything less he says nothing and writes something. Bob once asked what the criteria were. The Inspector noted the question on the clipboard." },
      ],
    },
  },
};

export const MONSTER_IDS = ['slime', 'bat', 'skeleton', 'frog', 'rat', 'beetle', 'demon', 'spider', 'dragon'];
