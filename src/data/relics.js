// Relics — the collection meta (§14 Pass B, the Relic Forge, 2026-07-10; REWORKED 2026-07-12,
// reform step 5 — Daniel's Option 2: "the gag IS the effect"). ONE-OF-ONE objects: nobody buys
// them — that's what makes them special. Doug FINDS them broken on scavenge runs (curated order
// below), the Forge restores them (HARD restores since the rework: scrap + gold + MATERIALS +
// one Inspector's Seal EACH — the Seal's reserved destiny), and they go ON DISPLAY permanently.
//
// EFFECTS (the rework's circle-back — the slot was empty BY DESIGN awaiting the audit): each
// relic carries ONE effect that literalizes its card gag — a visible RULE change, never an
// invisible percent. Read through game.js's relicEffects() with guarded folds, so a future
// relic with no effect field costs zero wiring.
//
// PRESTIGE LAW (Daniel, 2026-07-12 — BINDING for step 8 / Franchise): relics are END-GAME
// items that CARRY OVER through prestige. The Franchise design must honor this; it is also why
// the restore costs are hard (a permanent cross-prestige asset should be expensive).
//
// SEAL NOTE: all four current relics cost 1 Seal (the dragon's top-grade drop — now a fullness-
// scaled CHANCE, see the slope in serveCurrent). As more VIPs and relics arrive, later batches
// may key on other VIP materials (Daniel, 2026-07-12).
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
    restoreCost: { scrap: 60, gold: 5000,
      materials: { femur_charm: 6, echo_fang: 6, inspectors_seal: 1 } },
    card: 'Opens anything, eventually.',        // the gag IS the relic: a hammer with keys on it
    effect: { mishapChanceMult: 0.5 },          // doors open for you: expedition mishaps halved
    effectCard: 'Expeditions stumble half as often.',
  },
  hero_magnet: {
    id: 'hero_magnet', displayName: 'The Hero Magnet', spriteId: 'relic_hero_magnet',
    spot: { kind: 'frame', x: 556, topY: 250 },   // frame 2 — find #2 (a framed magnet: museum-piece gag)
    restoreCost: { scrap: 90, gold: 10000,
      materials: { stolen_trinket: 8, silk_bundle: 5, inspectors_seal: 1 } },
    card: 'Points away from the door. Bob insists.',
    effect: { combatBonus: 1 },                 // heroes pulled elsewhere: every mob fights better
    effectCard: 'Every customer fights a little better.',
  },
  yesterday_potion: {
    id: 'yesterday_potion', displayName: 'The Yesterday Potion', spriteId: 'relic_yesterday_potion',
    spot: { kind: 'counter', x: 612 },   // the ONE desk slot (the Greg-Bob gap) — the potion IS shopware
    restoreCost: { scrap: 135, gold: 20000,
      materials: { slime_core: 8, bogstone_bauble: 6, inspectors_seal: 1 } },
    card: 'Tastes like last Tuesday.',
    effect: { yesterdayRates: true },           // the market honors yesterday's better prices
    effectCard: "The market honors yesterday's better prices.",
  },
  everything_cloak: {
    id: 'everything_cloak', displayName: 'The Everything Cloak', spriteId: 'relic_everything_cloak',
    spot: { kind: 'frame', x: 862, topY: 250 },   // frame 3 — over Doug's corner (find #4)
    restoreCost: { scrap: 180, gold: 40000,
      materials: { carapace_shard: 8, infernal_ember: 8, inspectors_seal: 1 } },
    card: 'Made of all the other cloaks.',
    effect: { capBonus: 2 },                    // it holds everything: +2 to every material cap
    effectCard: 'Every material store holds +2.',
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
