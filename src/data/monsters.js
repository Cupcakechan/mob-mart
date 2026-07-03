// monsters.js — customer (monster) registry. wantWeights bias which item each type asks for.
// Goblin (Gobbo) and Rat join later as the first content additions.
export const MONSTERS = {
  slime: {
    id:'slime', displayName:'Slimey', spriteId:'slime', combatMod:-2, budgetRange:[10,20],
    spriteScale: 1.15,   // squat silhouette reads small next to the chunky bat (measured: 72% frame height)
    anim: { frames: 4, fps: 6 },   // idle wobble: slime_idle.png on the SHARED contract (4x128 ->
                                   // 512x128 strip); strip absent -> static slime.png (graceful)
    wantWeights:[{value:'hp_flask',weight:3},{value:'club',weight:2},{value:'metal_helmet',weight:1},
      {value:'greater_flask',weight:2},{value:'iron_sword',weight:1}],  // tier-2: flask fan first
  },
  bat: {
    id:'bat', displayName:'Batty', spriteId:'bat', combatMod:-1, budgetRange:[12,22],
    anim: { frames: 4, fps: 6 },   // idle wing-flap: bat_idle.png, 4x128 -> 512x128 strip (optional
                                   // field — absent = static <id>.png, then the placeholder rect)
    wantWeights:[{value:'metal_helmet',weight:3},{value:'hp_flask',weight:2},{value:'club',weight:1},
      {value:'knight_helm',weight:2},{value:'greater_flask',weight:1}],  // tier-2: armor lover
  },
  skeleton: {
    id:'skeleton', displayName:'Skele', spriteId:'skeleton', combatMod:1, budgetRange:[12,24],
    spriteScale: 1.15,   // beanpole silhouette (47px wide) carries little mass — same bump as Slimey
    anim: { frames: 4, fps: 6 },   // idle rattle/sway: skeleton_idle.png, SHARED contract as above
    wantWeights:[{value:'club',weight:3},{value:'metal_helmet',weight:2},{value:'hp_flask',weight:1},
      {value:'iron_sword',weight:2},{value:'knight_helm',weight:1}],  // tier-2: biggest budget, biggest sword
  },
};

export const MONSTER_IDS = ['slime', 'bat', 'skeleton'];
