// monsters.js — customer (monster) registry.
// WANTS (A2, items-scaffold pass 2026-07-04): each monster declares CATEGORY affinities
// (categoryWeights) plus optional per-item multipliers (itemBias, ?? 1). The picker in game.js
// rolls category first, then an item within it — so a personality share ('Froggo is half potions')
// holds no matter how large a category grows, and a NEW item is wanted the moment its registry row
// exists (true auto-flow; the old per-item wantWeights needed every monster touched per item).
// (Gobbo the goblin was redesigned into Froggo the grumpy FROG before implementation — Daniel,
// 2026-07-04; id + all PNG naming = `frog`. Rat remains an open call, handoff §13.)
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
  },
  bat: {
    id:'bat', displayName:'Batty', spriteId:'bat', combatMod:-1, budgetRange:[12,22],
    flying: true,        // flyers keep the idle hover bob; bat.png's 15px bottom padding is the
                         // hover ALTITUDE (deliberate), so no footPad here — grounded mobs get both.
    anim: { frames: 4, fps: 6 },   // idle wing-flap: bat_idle.png, 4x128 -> 512x128 strip (optional
                                   // field — absent = static <id>.png, then the placeholder rect)
    categoryWeights: { armor: 3, consumable: 2, weapon: 1 },   // the armor lover, by category
  },
  skeleton: {
    id:'skeleton', displayName:'Skele', spriteId:'skeleton', combatMod:1, budgetRange:[12,24],
    spriteScale: 1.15,   // beanpole silhouette (47px wide) carries little mass — same bump as Slimey
    footPad: 12,         // MEASURED (2026-07-03): transparent rows below the feet in skeleton.png
    anim: { frames: 4, fps: 6 },   // idle rattle/sway: skeleton_idle.png, SHARED contract as above
    categoryWeights: { weapon: 3, armor: 2, consumable: 1 },   // sword guy, by category
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
    itemBias: { greater_flask: 3, iron_sword: 2 },   // the tier-2 customer: once licensed, his
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
    itemBias: { rusty_key: 3, tattered_shirt: 2 },   // signature loves: a THIEF craves the key,
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
  },

  dragon: {
    id: 'dragon', displayName: 'The Inspector', spriteId: 'dragon', combatMod: 1,
    budgetRange: [200, 400],   // the once-a-day whale: buys anything on the shelf, fame-scaled
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
  },
};

export const MONSTER_IDS = ['slime', 'bat', 'skeleton', 'frog', 'rat', 'beetle', 'dragon'];
