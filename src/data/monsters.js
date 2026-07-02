// monsters.js — customer (monster) registry. wantWeights bias which item each type asks for.
// Goblin (Gobbo) and Rat join later as the first content additions.
export const MONSTERS = {
  slime: {
    id:'slime', displayName:'Slimey', spriteId:'slime', combatMod:-2, budgetRange:[10,20],
    spriteScale: 1.15,   // squat silhouette reads small next to the chunky bat (measured: 72% frame height)
    wantWeights:[{value:'hp_flask',weight:3},{value:'club',weight:2},{value:'metal_helmet',weight:1}],
  },
  bat: {
    id:'bat', displayName:'Batty', spriteId:'bat', combatMod:-1, budgetRange:[12,22],
    wantWeights:[{value:'metal_helmet',weight:3},{value:'hp_flask',weight:2},{value:'club',weight:1}],
  },
  skeleton: {
    id:'skeleton', displayName:'Skele', spriteId:'skeleton', combatMod:1, budgetRange:[12,24],
    spriteScale: 1.15,   // beanpole silhouette (47px wide) carries little mass — same bump as Slimey
    wantWeights:[{value:'club',weight:3},{value:'metal_helmet',weight:2},{value:'hp_flask',weight:1}],
  },
};

export const MONSTER_IDS = ['slime', 'bat', 'skeleton'];
