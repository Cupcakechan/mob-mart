// Relics — the collection meta (§14 Pass B, the Relic Forge, 2026-07-10). ONE-OF-ONE objects:
// nobody buys them — that's what makes them special. Doug FINDS them broken on scavenge runs
// (curated order below), the Forge restores them (scrap + gold — both currencies' first shared
// sink), and they go ON DISPLAY in the shop permanently: two counter spots + two wall frames
// (Daniel's showcase, 2026-07-10). NO ECONOMIC EFFECTS in this pass — deliberately: the economy
// audit needs a clean baseline, and the Special-of-the-Day repurpose (the circle-back step) will
// make relics the buff carriers. The effect slot is EMPTY BY DESIGN, not forgotten.
//
// Display geometry (RE-STAGED 2026-07-10 after the first hang — the original plan ignored two
// occupants): the desk gap between GREG's hover box (434-546 + sway, y330-442 — documented in
// RESTOCKER) and Bob (content from 676) is 125px usable — room for exactly ONE 64px object.
// So: ONE desk spot (the Hero Magnet, x612 — 29px from Greg's sway edge, 32px from Bob) and
// THREE wall frames in the band between the board's bottom (246) and the counter top (~353):
// two left of Bob (clear of the shelf, ends 372), one RIGHT of Bob above Doug's corner — his
// head grazes its bottom when home (drawn in front: spatially correct; he's out ~70% of the
// cycle — Doug idles under his own trophy). spot.x is the CENTER. ASSIGNMENT LAW (2026-07-10,
// Daniel's catch): frames fill LEFT-TO-RIGHT in FIND ORDER, and the desk slot goes to the one
// object that naturally lives on a desk (the potion — it is literally shopware). Mid-progression
// must never show an empty frame BETWEEN filled ones — it reads as 'the object fell out'.
// NATURAL size (scene.js) so the frame re-author (window >= 64 needed; the v1 border box was
// itself 64x64) drops in with zero code changes.

export const RELICS = {
  skeleton_key: {
    id: 'skeleton_key', displayName: 'The Skeleton Key', spriteId: 'relic_skeleton_key',
    spot: { kind: 'frame', x: 436, topY: 250 },
    restoreCost: { scrap: 20, gold: 3000 },
    card: 'Opens anything, eventually.',        // the gag IS the relic: a hammer with keys on it
  },
  hero_magnet: {
    id: 'hero_magnet', displayName: 'The Hero Magnet', spriteId: 'relic_hero_magnet',
    spot: { kind: 'frame', x: 556, topY: 250 },   // frame 2 — find #2 (a framed magnet: museum-piece gag)
    restoreCost: { scrap: 30, gold: 6000 },
    card: 'Points away from the door. Bob insists.',
  },
  yesterday_potion: {
    id: 'yesterday_potion', displayName: 'The Yesterday Potion', spriteId: 'relic_yesterday_potion',
    spot: { kind: 'counter', x: 612 },   // the ONE desk slot (the Greg-Bob gap) — the potion IS shopware
    restoreCost: { scrap: 45, gold: 12000 },
    card: 'Tastes like last Tuesday.',
  },
  everything_cloak: {
    id: 'everything_cloak', displayName: 'The Everything Cloak', spriteId: 'relic_everything_cloak',
    spot: { kind: 'frame', x: 862, topY: 250 },   // frame 3 — over Doug's corner (find #4)
    restoreCost: { scrap: 60, gold: 25000 },
    card: 'Made of all the other cloaks.',
  },
};

// CURATED find order — each find is a designed beat, not a loot roll: the flagship gag first,
// escalating restore costs after. (The FIND is random-when; the WHAT is authored.)
export const RELIC_ORDER = ['skeleton_key', 'hero_magnet', 'yesterday_potion', 'everything_cloak'];

export const RELIC_FIND = {
  chancePerRun: 1 / 18,   // <-- TUNABLE: a find every ~7-10 min of active endgame play — rare
                          //     enough to be an EVENT, not a schedule
  pityRuns: 25,           // <-- TUNABLE: guaranteed within this many runs since the last find —
                          //     the thrill of chance with a floor under it
};

export const RELIC_AMBIENT_CHANCE = 0.05;  // per SERVE, when any restored relic is on display —
                                           // mobs occasionally react to the collection (results.js)
