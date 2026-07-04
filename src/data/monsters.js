// monsters.js — customer (monster) registry. wantWeights bias which item each type asks for.
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
    wantWeights:[{value:'hp_flask',weight:3},{value:'club',weight:2},{value:'metal_helmet',weight:1},
      {value:'greater_flask',weight:2},{value:'iron_sword',weight:1}],  // tier-2: flask fan first
  },
  bat: {
    id:'bat', displayName:'Batty', spriteId:'bat', combatMod:-1, budgetRange:[12,22],
    flying: true,        // flyers keep the idle hover bob; bat.png's 15px bottom padding is the
                         // hover ALTITUDE (deliberate), so no footPad here — grounded mobs get both.
    anim: { frames: 4, fps: 6 },   // idle wing-flap: bat_idle.png, 4x128 -> 512x128 strip (optional
                                   // field — absent = static <id>.png, then the placeholder rect)
    wantWeights:[{value:'metal_helmet',weight:3},{value:'hp_flask',weight:2},{value:'club',weight:1},
      {value:'knight_helm',weight:2},{value:'greater_flask',weight:1}],  // tier-2: armor lover
  },
  skeleton: {
    id:'skeleton', displayName:'Skele', spriteId:'skeleton', combatMod:1, budgetRange:[12,24],
    spriteScale: 1.15,   // beanpole silhouette (47px wide) carries little mass — same bump as Slimey
    footPad: 12,         // MEASURED (2026-07-03): transparent rows below the feet in skeleton.png
    anim: { frames: 4, fps: 6 },   // idle rattle/sway: skeleton_idle.png, SHARED contract as above
    wantWeights:[{value:'club',weight:3},{value:'metal_helmet',weight:2},{value:'hp_flask',weight:1},
      {value:'iron_sword',weight:2},{value:'knight_helm',weight:1}],  // tier-2: biggest budget, biggest sword
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
    wantWeights:[{value:'greater_flask',weight:3},{value:'iron_sword',weight:2},
      {value:'hp_flask',weight:2},{value:'club',weight:1},{value:'knight_helm',weight:1}],
  },
};

export const MONSTER_IDS = ['slime', 'bat', 'skeleton', 'frog'];
