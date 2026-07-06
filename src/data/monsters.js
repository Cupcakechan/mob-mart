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
    id:'rat', displayName:'Ratty', spriteId:'rat', combatMod:-1, budgetRange:[10,16],
        spriteScale: 1.1,    // content is 76% of frame (MEASURED 2026-07-05 via pngjs) — the exact
                               // Froggo ratio, so the exact Froggo calibration. PROVISIONAL: confirm
                         // his mass reads right beside Slimey in the queue.
      footPad: 15,         // MEASURED (2026-07-05): transparent rows below the feet in rat.png —
                         // coincidentally identical to Froggo's 15.
                         // funny. Art: rat.png LANDED 2026-07-05 (footPad + scale measured above); the idle and walk
    // strips are authored and incoming — registered in main.js already, they light up on drop.
    // The Rat Thief (roadmap item 6, Pass A — Daniel 2026-07-05). Comic lever: CHEERFUL
    // ACQUISITION (nothing is stolen; everything is "found"). The ANTI-Froggo economically:
    // his identity lives in the CEILING ([10,16] vs Froggo's [16,30]) — a scrounger hunting the
    // cheap end of the shelf. Floor is 10, NOT lower: the free-tier strand invariant (suite,
    // batch 1) requires every free item price <= the roster's minimum roll, because the
    // want-picker is NOT budget-aware — a lower floor strands him at cant-afford. (Budget-aware
    // wants would let the floor drop and make poor customers want cheap things — a natural
    // future pass, flagged 2026-07-05.) Grounded (no `flying`). combatMod -1: scrappy, loses
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
};

export const MONSTER_IDS = ['slime', 'bat', 'skeleton', 'frog', 'rat'];
