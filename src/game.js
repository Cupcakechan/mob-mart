// game.js — core loop logic. Operates on the state object; no DOM/canvas here (so it's testable).
import { CONFIG } from './config.js';
import { PERKS, PERK_ORDER, perkLevel, perkCost, isPerkMaxed, sumPerkEffect } from './data/perks.js';
import { itemGoldMult, monsterRepMult, globalGoldMult, everythingTier,
  ITEM_BREAKPOINTS, MONSTER_BREAKPOINTS, EVERYTHING_TIERS, milestoneLine, licenseBubbleLine } from './data/milestones.js';
import { MONSTERS, MONSTER_IDS } from './data/monsters.js';
import { ITEMS, ITEM_ORDER } from './data/items.js';
import { UPGRADES, upgradeLevel, upgradeCost, isMaxed, sumEffect } from './data/upgrades.js';
import { WORKERS, WORKER_ORDER, isWorkerOwned, workerHireCost,
  workerLevel, workerLevelCost, isWorkerLevelMaxed, sumWorkerEffect,
  scavengeClock } from './data/workers.js';
import { randInt, pick, pickNot, weightedPick } from './utils.js';
import { WORKER_HIRE_LINES, DOUG_RETURN_LINES, RELIC_VOICE, TRADE_VOICE, INSPECTOR_VOICE,
  EXPEDITION_VOICE, EXPEDITION_DESTINATIONS, COMMISSION_VOICE } from './data/results.js';
import { MATERIALS } from './data/materials.js';   // Trade Market reform Pass A (leaf registry)
import { offersForDay, tradeDayKey, yesterdayKey, describeOffer, tradeItemIds } from './data/trademarket.js';   // (leaf, no cycle)
import { commissionForDay, dayIndexOf } from './data/commissions.js';   // reform step 6 (leaf, no cycle)
import { RELICS, RELIC_ORDER, RELIC_FIND, RELIC_AMBIENT_CHANCE } from './data/relics.js';
import { resolveCombat } from './combat.js';
import { reputationTier } from './reputation.js';
import { logLine } from './messages.js';
import { MONSTER_RESULTS } from './data/results.js';   // line-unlock: scan for minServes batches at crossings (leaf registry, no cycle)
import { MARKET_EVENTS, eventIdForDay, dayKeyOf, marketAnnounceLine, marketBubbleLine,
  crateLine } from './data/marketevents.js';   // Market Day (leaf registry, no cycle)
import { visitAnnounceLine, visitBubbleLine, visitGradeLine } from './data/visits.js';   // Special Visits (leaf, no cycle)

// --- Customer spawning -------------------------------------------------------

// Queue uniqueness (Option 2, Daniel 2026-07-05): "never two of him, never him in two places."
// A mob exiting the queue for ANY reason (served/left/dismissed — the auto-wave routes through
// dismiss) arms a short return cooldown, so a served Skele can't respawn while his celebrant is
// still marching to the door. TRANSIENT (never serialized): a reload just resets the world's
// comings and goings.
function armReturnCooldown(state, monsterId) {
  (state.mobCooldowns ??= {})[monsterId] = CONFIG.queue.returnCooldownSec ?? 18;
}

// COMMISSION HARD RESERVE (B1 — parked (g)②, Option 1 PICKED 2026-07-12, decision log
// FAME_ECONOMY_DESIGN.md §9). A pending order SETS ASIDE its `count` units of the ordered item
// from every COUNTER path — Bob won't hand them to a walk-in, the offline sim won't sell them, a
// thief can't pocket them; only fulfilling the order (canFulfillCommission consumes RAW stock) or
// its zero-penalty lapse releases them. DERIVED live from state.commission + shelf stock — nothing
// new persisted (the order is already saved; the same "derive, never store" convention the terms
// use). CONFIG.commission.hardReserve (?? true) is the kill switch: false makes reservedFor 0,
// reverting every sellable read below to raw stock (the F3 perTier-0 pattern).
export function reservedFor(state, itemId) {
  if (!(CONFIG.commission?.hardReserve ?? true)) return 0;
  const c = state?.commission;
  if (!c || c.itemId !== itemId) return 0;
  return Math.min(c.count, state.items?.[itemId]?.stock ?? 0);   // never reserve more than is on the shelf
}

// The single source of truth for "how many units may leave over the counter": total stock minus the
// reserve. The serve gate, the bulk-buyer check, offline, and leave-theft all read THIS, never raw
// stock — so a hard reserve is hard everywhere Bob (or a thief) could take a unit. F2 demand
// deliberately does NOT: coupling it (a fully-reserved shelf reads unstocked) was built and reverted
// after the acceptance sim — it concentrated walk-in demand onto the cheap shelves and cost
// throughput (market-blind advantage 21%->0%), while the dead-queue it was meant to prevent stayed
// ~0% either way. So demand reflects PHYSICAL stock; the reserve gates only who may BUY (decision
// log, FAME_ECONOMY_DESIGN.md §9). Raw stock also drives shelf-room (restock/trade caps),
// fulfillment, and the inspection grade (the reserved units sit on the shelf — the dragon grades
// what he sees).
export function sellableStock(state, itemId) {
  return Math.max(0, (state?.items?.[itemId]?.stock ?? 0) - reservedFor(state, itemId));
}

// DEMAND HONESTY (F2 Option 1, Daniel 2026-07-13): the item-stage SUPPLY weight. Trade-tier
// demand scales to what the shop can actually serve — three binary-signal levels read from
// LIVE state (current PHYSICAL shelf stock; lifetime counter sales), zero new bookkeeping. NOTE
// (B1): demand reads raw stock, NOT sellableStock — coupling it to the commission reserve was
// tested and reverted (see sellableStock above). Gold-tier
// items and stateless picks (older headless tests) stay x1: the bias must never touch the
// gold economy or shift legacy math. Every read is ?? -guarded — a missing dial or field
// degrades to x1 (bias off), never NaN. Known nuance, accepted at the options round:
// commission fulfillment deliberately skips stats.itemSales (the loyalty-ladder law), so an
// item only ever sold wholesale reads 'unknown' once its shelf empties — the street never saw
// it sell over the counter, which is honest.
export function supplyWantWeight(state, itemId) {
  if (!state || (ITEMS[itemId]?.acquisition ?? 'gold') !== 'trade') return 1;
  const dial = CONFIG.queue.supplyWantBias ?? {};
  if ((state.items[itemId]?.stock ?? 0) > 0) return dial.stocked ?? 1;   // B1: PHYSICAL stock (reserve is orthogonal to demand)
  if ((state.stats?.itemSales?.[itemId] ?? 0) > 0) return dial.known ?? 1;
  return dial.unknown ?? 1;
}

export function spawnCustomer(state, forcedId = null) {
  // Uniqueness filter: candidates are types NOT in line and NOT cooling down. An empty pool
  // (roster spread between the line and the door) returns null — the caller skips that spawn
  // beat and the director's timer simply runs again: an honest quiet moment, not a bug. Without
  // state (older tests), the full roster — the safe default, same pattern as the unlock filter.
  // SPECIAL rows (the Inspector) are invisible to the pool in BOTH branches — a VIP arrives only
  // via trySpawnVisit's forcedId, which bypasses the pick but keeps everything downstream
  // (budget, fame mult, wants, patience) on the one shared path.
  let monster;
  if (forcedId && MONSTERS[forcedId]) {
    monster = MONSTERS[forcedId];
  } else {
    const candidates = state
      ? MONSTER_IDS.filter((id) => !MONSTERS[id].special
          && !state.queue.some((c) => c.monsterId === id)
          && (state.mobCooldowns?.[id] ?? 0) <= 0)
      : MONSTER_IDS.filter((id) => !MONSTERS[id].special);
    if (candidates.length === 0) return null;
    monster = MONSTERS[pick(candidates)];
  }
  // Budget rolls FIRST (budget-aware wants, Option 2 — Daniel 2026-07-06): the want pick below is
  // biased by affordability, so it needs the FINAL purse — fame multiplier included. x1.15 at
  // Renowned, x1.30 at Legendary (CONFIG.fame dial): the customer-side answer to tier-2 prices.
  const [minB, maxB] = monster.budgetRange ?? [10, 20];
  const tierIdx = state ? reputationTier(fameOf(state)).index : 0;
  const budgetMult = 1 + (CONFIG.fame?.budgetPerTierAboveBeloved ?? 0) * Math.max(0, tierIdx - 3);
  const budget = Math.round(randInt(minB, maxB) * budgetMult);
  // Wants (A2, items-scaffold pass): CATEGORY affinity first, then an item WITHIN it. Two-stage on
  // purpose — a monster's personality share ("Froggo is half potions") holds no matter how big a
  // category grows; per-item share dilutes as the catalog does, which is how a real shop feels.
  // itemBias (?? 1) makes signature loves non-uniform within a category. The Pass-3 unlock filter
  // is unchanged: locked tier-2 items are invisible to customers; without state (older tests),
  // only license-free items count — the safe default.
  // BUDGET-AWARE (Option 2, soft bias — Daniel 2026-07-06): at the ITEM stage, affordable picks
  // weigh x affordableWantBias (4). SOFT on purpose — a hard filter would amputate the broke
  // state that Bob's auto-wave, brokeGrace, the "3 gold short" comedy register, and Ratty's
  // theft-prevention-via-wave all live on. Poor customers now MOSTLY want cheap things; the
  // occasional mismatch survives as texture, and the wave handles it — which is its job. The
  // bias is item-stage only: a category whose every item exceeds the purse still yields a
  // mismatch (rare by construction), same handling.
  const unlockedIds = ITEM_ORDER.filter((id) =>
    state ? isItemUnlocked(state, id) : !ITEMS[id]?.license);
  // MARKET DAY (retention pass, 2026-07-06): today's demand event biases the CATEGORY stage —
  // "everyone wants flasks today" — by weighing the event's category x CONFIG.market.wantBias.
  // SOFT like affordableWantBias below: personality still rules (a weapon-hating Slimey mostly
  // stays a weapon-hater), the day just leans the crowd. No event (or headless tests with no
  // marketEventId) -> x1 everywhere, i.e. exactly the old math.
  const eventCat = MARKET_EVENTS[state?.marketEventId]?.category ?? null;
  const catEntries = Object.entries(monster.categoryWeights ?? {})
    .map(([cat, weight]) => ({
      value: cat,
      weight: weight * (cat === eventCat ? (CONFIG.market?.wantBias ?? 1) : 1),
      ids: unlockedIds.filter((id) => ITEMS[id].category === cat),
    }))
    .filter((e) => e.ids.length > 0 && (e.weight ?? 0) > 0);
  let wantedItemId = null;
  if (catEntries.length > 0) {
    const cat = weightedPick(catEntries);
    const ids = catEntries.find((e) => e.value === cat)?.ids ?? [];
    wantedItemId = weightedPick(ids.map((id) => ({ value: id,
      weight: (monster.itemBias?.[id] ?? 1)
        * (ITEMS[id].basePrice <= budget ? (CONFIG.queue.affordableWantBias ?? 4) : 1)
        // DEMAND HONESTY (F2 Option 1): third item-stage factor — trade-tier picks weigh x the
        // shelf's truth (stocked/known/unknown). See supplyWantWeight above spawnCustomer.
        * supplyWantWeight(state, id) })));
  }
  // Fallback must be an ITEM id (guards a monster shipped with missing/empty categoryWeights). A
  // monster id here once made the customer want a nonexistent item -> a permanent 'no-item' front
  // blocker. ITEM_ORDER[0] is always license-free.
  wantedItemId = wantedItemId ?? ITEM_ORDER[0];
  return {
    monsterId: monster.id,
    wantedItemId,
    budget,                     // rolled above, BEFORE the want pick (budget-aware wants)
    patienceRemaining: CONFIG.queue.defaultPatienceSec
      + (monster.patienceBonus ?? 0)                           // the Steadfast quirk (Beetley +8)
      + (state ? sumPerkEffect(state, 'patience') : 0),        // Warm Welcome
    brokeWait: 0,               // seconds spent unaffordable at the front; drives the worker auto-wave
    frontWait: 0,               // seconds spent AT the front; gates the worker greet delay (feel fix)
    state: 'queued',
  };
}

// --- Serving (always acts on the FRONT of the line, queue[0]) -----------------

export function serveBlockReason(state) {
  const c = state.queue[0];
  if (!c) return 'no-customer';
  if (state.serveCooldown > 0) return 'cooling-down';           // counter busy after the last sale
  const item = ITEMS[c.wantedItemId];
  if (!item) return 'no-item';
  if ((state.items[c.wantedItemId]?.stock ?? 0) <= 0) return 'out-of-stock';   // raw shelf empty (unchanged)
  if (sellableStock(state, c.wantedItemId) <= 0) return 'reserved';            // B1: stocked, but every unit
                                                                              //     is held for a Special Order
  if (c.budget < item.basePrice) return 'cant-afford';
  return null;
}

// Base serve cooldown shortened by Faster Counter. Asymptotic (divide by 1+speed) so it never
// hits zero no matter how many levels stack.
export function effectiveServeCooldown(state) {
  return CONFIG.serve.cooldownSec / (1 + sumEffect(state, 'serveSpeed'));
}

// Reputation gained per sale, boosted by Better Signage. Rounded so the HUD stays whole-number.
export function effectiveRepPerSale(state) {
  return Math.round(CONFIG.reputation.perSale * (1 + sumEffect(state, 'repMult')));
}

export function serveCurrent(state) {
  if (serveBlockReason(state) !== null) return false;
  const c = state.queue[0];
  const monster = MONSTERS[c.monsterId];
  const item = ITEMS[c.wantedItemId];
  // THE OVERSTOCKER (reform 3b): a bulkBuyer serve moves TWO units when the shelf holds two and
  // the purse covers double — one visit, one fight, one report, DOUBLE the sale. Checked against
  // basePrice like every affordability rule (payout mults never price anyone out), and against
  // LIVE stock so a shelf of one sells one (graceful degrade, never a block). Registry-driven:
  // the flag lives on the monster row; specials never carry it.
  const units = (monster.bulkBuyer === true
    && sellableStock(state, c.wantedItemId) >= 2                  // B1: bulk can't dip into the reserve
    && c.budget >= item.basePrice * 2) ? 2 : 1;

  // Milestone bonuses (Regulars' Loyalty) multiply the PAYOUT, never the price — affordability
  // above keeps checking basePrice, so loyalty growth can never lock customers out. This sale pays
  // with the multipliers earned BEFORE it; the ledger increments after, so a crossing kicks in from
  // the NEXT sale (and announces below).
  const repGain = Math.round(effectiveRepPerSale(state) * monsterRepMult(state, c.monsterId));
  // Market Day rides the same payout-side law: today's demand event multiplies matching-category
  // PAYOUTS (grateful mobs tip), never basePrice — serveBlockReason above kept checking the real
  // price, so a demand spike can never price a customer out. x1 when no event is active.
  // Bob's Salesmanship (Deep Sinks) is a FLAT tip added AFTER the rounded product — linear
  // production against exponential training costs, and payout-side like everything else here.
  let goldGain = (Math.round(item.basePrice * itemGoldMult(state, c.wantedItemId) * globalGoldMult(state)
    * marketPayoutMult(state, item.category)) + sumWorkerEffect(state, 'saleTip')) * units;
  // ^ bulk pays the FULL per-unit formula per unit, tip included — the same per-unit convention
  //   the offline sim uses; rep below stays PER VISIT (rep rewards service, not volume).
  let finalRepGain = repGain;
  // THE INSPECTION (Special Visits): the dragon grades the shelf AS HE SEES IT — computed before
  // his own unit leaves it (the decrement below), which is also the fiction: he inspected, THEN
  // bought. Tip and fame bonus are flat adds on the payout side; the grade line lands instantly
  // (market tier bypasses the milestone stagger), reporting the numbers that earned it.
  if (monster.special) {
    const g = inspectionGrade(state);
    goldGain += g.tip;
    finalRepGain += CONFIG.visits?.fameBonus ?? 0;
    pushLog(state, { text: visitGradeLine(Math.round(g.fullness * 100), g.tip),
      repDelta: 0, tier: 'market' });
    // VIP MATERIAL DROPS (Pass B, §13.1 as picked): the Scale rides EVERY visit; the SEAL only
    // a TOP-GRADE inspection (sealFullness) — the report card's stakes. Registry-driven off the
    // row's material/gradeMaterial fields; the eligibility law (!special) keeps both out of
    // trade recipes FOREVER — the Seal is reserved for relic restores (Daniel, 2026-07-11).
    if (monster.material && addMaterial(state, monster.material, 1) > 0) {
      pushLog(state, { text: pick(INSPECTOR_VOICE.scale), repDelta: 0, tier: 'market' });
    }
    // THE SEAL SLOPE (relic rework, Daniel 2026-07-12): the top-grade CLIFF punished players
    // who can't monitor 24/7 — the visit is unschedulable, so missing 0.9 fullness was a hard
    // zero with no decision behind it. Now a CHANCE scaling with fullness at visit time:
    // min(1, fullness / sealFullness) — 0.9+ keeps the old guarantee exactly, half-stocked
    // ≈ 50%, an empty shop still earns nothing. Math.random is the forced-dice seam (§69).
    const sealChance = Math.min(1, g.fullness / (CONFIG.visits?.sealFullness ?? 0.9));
    if (monster.gradeMaterial && Math.random() < sealChance
        && addMaterial(state, monster.gradeMaterial, 1) > 0) {
      pushLog(state, { text: pick(INSPECTOR_VOICE.seal), repDelta: 0, tier: 'market' });
    }
  }
  state.items[c.wantedItemId].stock -= units;                   // hand over the item(s) — bulk moves two
  state.gold += goldGain;                                       // take payment (base + loyalty on top)
  const prevTierIdx = reputationTier(fameOf(state)).index;      // tier BEFORE this sale's fame lands —
  // captured before EITHER rep write: fameOf falls back to state.reputation when lifetimeRep is
  // absent (a pre-Fame save's first serve), and that fallback must not already include this gain.
  state.reputation += finalRepGain;                             // spendable balance...
  state.lifetimeRep = fameOf(state) + finalRepGain;             // ...and the tier track (never falls)

  // License alerts (UX roadmap 3): a FAME TIER CROSSING that brings newly eligible licenses gets
  // the permanent milestone line here, plus queued speech for BOB'S bubble (transient, like
  // pendingReports — never serialized; a reload mid-announcement drops the bubble, never the log
  // line). Trigger is TIER ELIGIBILITY, never affordability. The range check (prev < req <= now)
  // keeps a multi-tier jump honest, and already-owned licenses never re-announce.
  const nowTierIdx = reputationTier(fameOf(state)).index;
  if (nowTierIdx > prevTierIdx) {
    const newly = ITEM_ORDER.filter((id) => {
      const req = ITEMS[id].license?.requiredTier;
      return req !== undefined && state.licenses?.[id] !== true
        && req > prevTierIdx && req <= nowTierIdx;
    });
    if (newly.length) {
      pushLog(state, { text: milestoneLine('fame',
        { items: newly.map((id) => ITEMS[id].displayName).join(', ') }),
        repDelta: 0, tier: 'milestone', monsterId: monster.id });
      const bs = (state.bobSpeech ??= { queue: [], current: null });
      // Each entry carries its license's itemId — the DOM bubble (panels.js) is CLICKABLE and
      // routes to exactly this license on the shelf.
      for (const id of newly) bs.queue.push({ text: licenseBubbleLine('announce', { item: ITEMS[id].displayName }), itemId: id });
    }
  }

  const { tier } = resolveCombat(monster, item, relicEffects(state).combatBonus);   // off-screen fight -> outcome
                                                               // tier; the Hero Magnet's +1 rides here
  // serves INCLUDES this one (the ledger increments below): the 25th serve draws from the 25-batch.
  const { text, golden } = logLine(monster.id, tier, { name: monster.displayName,
    item: item.displayName, itemId: c.wantedItemId,
    serves: (state.stats.monsterServes[c.monsterId] ?? 0) + 1,
    dougOut: isDougOut(state) });   // Doug's battle cameos exist only while he's out there (§14)
  // Battle-report timing (Daniel, 2026-07-04): the RESULT line lands when the celebrant ENTERS the
  // battle door — not at the counter. The fight is decided here (same math, same moment) but the
  // report is queued; delivery = the render's door-entry event (main.js wires it) OR the fallback
  // timer below in update(). Economy stays at serve on purpose: they PAY at the counter; only the
  // news travels slow. Milestone lines below stay INSTANT — they're shop-side voice ("Sale #N!"),
  // which happens at the sale. Net log order: milestone at serve, result ~2s later on top of it.
  (state.pendingReports ??= []).push({
    entry: { text, golden, repDelta: finalRepGain, tier, monsterId: monster.id },
    fallback: CONFIG.log?.reportFallbackSec ?? 3.0,
  });

  // Lifetime ledger + crossing announcements (gold lines in the log, above the battle line).
  const prevEvery = everythingTier(state);
  const soldNow = (state.stats.itemSales[c.wantedItemId] ?? 0) + units;
  const servedNow = (state.stats.monsterServes[c.monsterId] ?? 0) + 1;
  state.stats.itemSales[c.wantedItemId] = soldNow;
  state.stats.monsterServes[c.monsterId] = servedNow;
  // Bulk skip-guard: a two-unit sale can jump OVER a breakpoint (249 -> 251 skips 250). The
  // MULTIPLIER math is immune (crossedCount derives from the total), but the announce line
  // would vanish — so the skipped count speaks first, then the landing count as always.
  if (units === 2 && ITEM_BREAKPOINTS.includes(soldNow - 1)) {
    pushLog(state, { text: milestoneLine('item', { count: soldNow - 1, item: item.displayName }),
      repDelta: 0, tier: 'milestone', monsterId: monster.id });
  }
  // MONSTER MATERIALS (reform Pass A): the serve faucet. Deterministic drop law — every Nth
  // serve of a family sheds its identity material (servedNow % N === 0; N per family, registry-
  // driven) — plannable on purpose (the legibility law: "two more slimes until a Core").
  // SPECIAL rows (the Inspector) never drop here — VIP faucets are Pass B's. A capped store
  // LOSES the drop (addMaterial returns 0): the cap is the pressure, not a suggestion.
  if (!monster.special && monster.material) {
    const everyN = monster.materialEveryNServes ?? CONFIG.materials?.defaultEveryNServes ?? 5;
    if (everyN > 0 && servedNow % everyN === 0) {
      const landed = addMaterial(state, monster.material, 1);
      // First-ever landed drop = the discovery beat (once per material, ever — the lifetime
      // ledger is the latch, so no new save field and no repeat after a spend-to-zero).
      if (landed > 0 && (state.stats.materialEarned?.[monster.material] ?? 0) === 1) {
        const mat = MATERIALS[monster.material];
        pushLog(state, { text: pick(TRADE_VOICE.discovery)
            .replaceAll('{monster}', monster.displayName).replaceAll('{name}', mat.displayName),
          repDelta: 0, tier: 'milestone', monsterId: monster.id });
      }
    }
  }
  if (ITEM_BREAKPOINTS.includes(soldNow)) {
    pushLog(state, { text: milestoneLine('item', { count: soldNow, item: item.displayName }),
      repDelta: 0, tier: 'milestone', monsterId: monster.id });
  // The display earns its keep (§14 Pass B): while restored relics are up, served mobs
  // occasionally react to them — rare on purpose (the collection stays a garnish, not a spam).
  {
    const shown = RELIC_ORDER.filter((r) => state.relics?.[r] === 'restored'
      && (RELIC_VOICE.byRelic[r]?.ambient?.length ?? 0) > 0);
    if (shown.length && Math.random() < RELIC_AMBIENT_CHANCE) {
      pushLog(state, { text: pick(RELIC_VOICE.byRelic[pick(shown)].ambient), repDelta: 0 });
    }
  }
  }
  // SPECIAL monsters (the Inspector) skip breakpoint milestones — they're off the bestiary grid,
  // and a pip celebration for a hidden card would point at nothing. servedByMonster still counts.
  if (!monster.special && MONSTER_BREAKPOINTS.includes(servedNow)) {
    pushLog(state, { text: milestoneLine('monster', { count: servedNow, name: monster.displayName }),
      repDelta: 0, tier: 'milestone', monsterId: monster.id });
    // Line-unlock ladder: if this crossing unlocks authored material (any template tagged
    // minServes === servedNow), say so — discoverability for the comedy payoff, and the Bestiary
    // pip that just filled doubles as the marker. Registry-scanned, so future batches auto-announce.
    const unlocks = Object.values(MONSTER_RESULTS[monster.id] ?? {})
      .some((arr) => arr.some((t) => typeof t !== 'string' && t.minServes === servedNow));
    if (unlocks) {
      pushLog(state, { text: milestoneLine('lines', { name: monster.displayName }),
        repDelta: 0, tier: 'milestone', monsterId: monster.id });
    }
  }
  const nowEvery = everythingTier(state);
  if (nowEvery > prevEvery) {                                   // this sale's item was the laggard
    // B2 ratchet: persist the newly earned tier so future roster growth can never take it back.
    state.stats.everythingTierEarned = Math.max(state.stats.everythingTierEarned ?? 0, nowEvery);
    pushLog(state, { text: milestoneLine('everything', { tier: EVERYTHING_TIERS[nowEvery - 1] }),
      repDelta: 0, tier: 'milestone', monsterId: monster.id });
  }

  state.serveCooldown = effectiveServeCooldown(state);          // start the counter cooldown
  armReturnCooldown(state, c.monsterId);                        // he's in the dungeon for a beat
  state.queue.shift();                                          // front leaves; line shifts forward
  state.uiDirty = true;
  return true;
}

export function dismissCurrent(state) {
  const c = state.queue[0];
  if (!c) return false;
  const name = MONSTERS[c.monsterId]?.displayName ?? 'Someone';
  // Pass the wanted item too — two dismiss templates use {item} ("...off with no {item}..."), and
  // without it logLine's 'something' fallback produced "no something". wantedItemId is always a
  // valid item id (spawn guarantees it since the audit fix), so displayName always resolves.
  const item = ITEMS[c.wantedItemId]?.displayName;
  pushLog(state, { ...logLine(c.monsterId, 'dismiss', { name, item, itemId: c.wantedItemId,
    serves: state.stats.monsterServes[c.monsterId] ?? 0,
    gregHired: state.workers?.restocker?.owned === true }),   // Greg's shoo lines exist once he does
    repDelta: 0, tier: 'dismiss', monsterId: c.monsterId });
  armReturnCooldown(state, c.monsterId);              // walked off — gone for a beat (the worker
  state.queue.shift();                                // auto-wave routes through here too)
  state.uiDirty = true;
  return true;
}

// --- Monster materials + the Trade Market (reform Pass A — TRADE_MARKET_DESIGN.md) --------------
// Currencies stay in their lanes (the reform's law 1): NOTHING here converts gold to materials
// or back. Faucet = the serve drop in serveCurrent; sink = executeTrade below. Offer math is
// pure and lives in data/trademarket.js; this is the stateful half (the Market Day pattern).

// Per-material store cap: registry override, else the global dial. Future cap-raisers (Backroom
// Storage's second effect, relic buffs) sum in HERE when they land — one read site to grow.
export function materialCap(state, id) {
  return (MATERIALS[id]?.cap ?? CONFIG.materials?.baseCap ?? 10) + relicEffects(state).capBonus;   // the Everything Cloak holds +2 of everything
}

// Add up to n of a material, clamped to cap. Returns how many LANDED (0 on a full store — the
// caller treats a lost drop as exactly that; the cap must bite or hoarding dissolves decisions).
// The lifetime ledger counts landed units only, so discovery/mastery math never drifts from
// what the player actually holds the history of.
export function addMaterial(state, id, n = 1) {
  if (!MATERIALS[id] || n <= 0) return 0;
  state.materials ??= {};
  const cur = state.materials[id] ?? 0;
  const landed = Math.max(0, Math.min(n, materialCap(state, id) - cur));
  if (landed > 0) {
    state.materials[id] = cur + landed;
    state.stats.materialEarned ??= {};
    state.stats.materialEarned[id] = (state.stats.materialEarned[id] ?? 0) + landed;
    state.uiDirty = true;
  }
  return landed;
}

// Today's offers for THIS state (the override seam keeps headless runs calendar-free).
export function currentTradeOffers(state) {
  const today = offersForDay(tradeDayKey(state));
  if (!relicEffects(state).yesterdayRates) return today;
  // THE YESTERDAY POTION (relic rework): each item trades at whichever day's offer has the
  // LOWER GOLD — yesterday's special price included (that IS the gag: it tastes like last
  // Tuesday). An imported offer DROPS its featured mark and discount fields (today's special
  // keeps the only glow — §69 pins one-featured) and carries rateDay:'yesterday' for the
  // overlay's tag. Its key stays yesterday's: executeTrade validates against THIS list, so
  // the midnight guard holds unchanged (a two-day-old key matches nothing).
  const yest = offersForDay(yesterdayKey(state));
  return today.map((t) => {
    const y = yest.find((o) => o.itemId === t.itemId);
    if (!y || y.gold >= t.gold) return t;
    const { featured, origGold, origMaterials, ...rest } = y;
    return { ...rest, rateDay: 'yesterday' };
  });
}

export function canTrade(state, offer) {
  if (!offer || !ITEMS[offer.itemId]) return false;
  // License = the SELL gate (design §5): the board trades only goods the shop may legally sell.
  if (!isItemUnlocked(state, offer.itemId)) return false;
  if ((state.items[offer.itemId]?.stock ?? 0) >= effectiveMaxStock(state, offer.itemId)) return false;
  if (state.gold < offer.gold) return false;
  for (const [mid, n] of Object.entries(offer.materials)) {
    if ((state.materials?.[mid] ?? 0) < n) return false;
  }
  return true;
}

// Execute by KEY, validated against the CURRENT day's offers — a button held across midnight
// carries yesterday's key, finds no match, and refuses (uiDirty re-renders the fresh board);
// nothing is ever paid at a stale rate.
export function executeTrade(state, offerKey) {
  const offer = currentTradeOffers(state).find((o) => o.key === offerKey);
  if (!offer || !canTrade(state, offer)) { state.uiDirty = true; return false; }
  state.gold -= offer.gold;
  for (const [mid, n] of Object.entries(offer.materials)) state.materials[mid] -= n;
  state.items[offer.itemId].stock += 1;
  pushLog(state, { text: pick(TRADE_VOICE.trade)
      .replaceAll('{item}', ITEMS[offer.itemId].displayName),
    repDelta: 0, tier: 'milestone' });
  state.uiDirty = true;
  return true;
}

// --- Expeditions MVP (reform step 4 — one monster, one door, one slot) ---------------------------
// The targeted-supply loop: the player picks the FAMILY (that IS the targeting — send slimes,
// get Cores), pays a gold fee (a SERVICE price; the real constraint is the slot + the clock,
// law §4.1), and the run returns a material burst. A mishap is a pratfall with a lighter bag —
// half haul rounded up, never zero, NEVER death (the split-loops law: the battle log's
// dying-and-returning gag is a different fiction and stays untouched).

export function canStartExpedition(state, monsterId) {
  const m = MONSTERS[monsterId];
  if (!m || m.special || !m.material) return false;   // faucet families only; never the Inspector
  if (state.expedition) return false;                  // MVP: ONE slot, one run at a time
  return state.gold >= (CONFIG.expedition?.fee ?? 25);
}

export function startExpedition(state, monsterId) {
  if (!canStartExpedition(state, monsterId)) return false;
  state.gold -= CONFIG.expedition?.fee ?? 25;
  const dest = pick(EXPEDITION_DESTINATIONS);
  state.expedition = { monsterId, dest, remaining: CONFIG.expedition?.durationSec ?? 60 };
  pushLog(state, { text: pick(EXPEDITION_VOICE.depart)
      .replaceAll('{name}', MONSTERS[monsterId].displayName).replaceAll('{dest}', dest),
    repDelta: 0, tier: 'market', monsterId });   // 'market' = instant (the grade-line precedent:
                                                 // event announcements bypass the milestone stagger)
  state.stats.expeditions ??= {};   // pre-step-4 saves: the ledger seeds lazily
  state.uiDirty = true;
  return true;
}

// Resolve on the tick that hits zero (update below; main.js credits away time at boot). The
// LINE reports the haul; a capped store losing part of it is the cap law working silently.
export function resolveExpedition(state) {
  const run = state.expedition;
  if (!run) return false;
  state.expedition = null;
  const monster = MONSTERS[run.monsterId];
  if (!monster?.material) { state.uiDirty = true; return false; }   // corrupt-run guard: never crash
  const E = CONFIG.expedition ?? {};
  const full = E.haul ?? 3;
  const mishap = Math.random() < (E.mishapChance ?? 0.25) * relicEffects(state).mishapChanceMult;   // the Skeleton Key: doors open for you
  const haul = mishap ? Math.ceil(full / 2) : full;
  addMaterial(state, monster.material, haul);
  state.stats.expeditions ??= {};
  state.stats.expeditions[run.monsterId] = (state.stats.expeditions[run.monsterId] ?? 0) + 1;
  pushLog(state, { text: pick(mishap ? EXPEDITION_VOICE.mishap : EXPEDITION_VOICE.return)
      .replaceAll('{name}', monster.displayName)
      .replaceAll('{dest}', run.dest ?? 'the doors')
      .replaceAll('{n}', String(haul))
      .replaceAll('{mat}', MATERIALS[monster.material]?.displayName ?? ''),
    repDelta: 0, tier: 'market', monsterId: run.monsterId });   // instant, like the departure
  state.uiDirty = true;
  return true;
}

// --- Commissions (reform step 6 — design doc §8; Daniel's Option 2: the NAMED CLIENT) ------------
// A roster monster orders trade-tier goods against a MARKET-DAY deadline for a premium. One order
// slot (the expedition precedent); the order fulfills from SHELF STOCK — the same units the queue
// would buy, which is the exclusive decision (hold for the order, or sell to the line?). A missed
// deadline LAPSES with a comic line and ZERO penalty (player-forgiving law); the next order
// arrives on the next rollover. Generation is day-seeded + eligible (commissions.js).

// The eligibility list: LICENSED trade-tier items only — an order never demands what the shop may
// not legally sell (the eligibility law, commission edition). Licenses only ever grow, so a
// placed order can't retro-invalidate.
export function eligibleCommissionItemIds(state) {
  return tradeItemIds().filter((id) => isItemUnlocked(state, id));
}

// Terms DERIVE live, never persist: per-unit = the normal sale payout (basePrice × loyalty
// multipliers — the payout law: multipliers touch payout, never basePrice) × premiumMult, so the
// order stays a genuine premium over queue-selling the same units at every stage of the game.
// Deliberately OUTSIDE the formula: Market-Day event mults (a demand event is the queue's story)
// and Bob's saleTip (counter training pays at the counter). Rep is a flat per-unit bonus.
export function commissionTerms(state, c = state.commission) {
  if (!c || !ITEMS[c.itemId]) return null;
  const per = Math.round(ITEMS[c.itemId].basePrice * itemGoldMult(state, c.itemId)
    * globalGoldMult(state) * (CONFIG.commission?.premiumMult ?? 2));
  return { gold: per * c.count, rep: (CONFIG.commission?.repPerUnit ?? 3) * c.count };
}

// Whole days left before the lapse rollover: placed day D with `days` N is fulfillable on
// D..D+N-1 and lapses when the index reaches D+N. Odd/unparseable day keys (no day identity)
// report the full span rather than guessing.
export function commissionDaysLeft(state) {
  const c = state.commission;
  if (!c) return 0;
  const idx = dayIndexOf(tradeDayKey(state));
  return idx === null ? c.days : Math.max(0, (c.placedIndex ?? idx) + c.days - idx);
}

export function canFulfillCommission(state) {
  const c = state.commission;
  return !!c && !!ITEMS[c.itemId] && isItemUnlocked(state, c.itemId)
    && (state.items[c.itemId]?.stock ?? 0) >= c.count;
}

// One shared formatter for the three commission moments — worst-case renders are suite-pinned
// against the live registries (the ≤80 law checked AT RENDER, the ticker's precedent).
function commissionLine(pool, c) {
  return pick(pool)
    .replaceAll('{name}', MONSTERS[c.monsterId]?.displayName ?? 'Somebody')
    .replaceAll('{n}', String(c.count))
    .replaceAll('{item}', ITEMS[c.itemId]?.displayName ?? c.itemId)
    .replaceAll('{days}', String(c.days));
}

export function fulfillCommission(state) {
  if (!canFulfillCommission(state)) { state.uiDirty = true; return false; }
  const c = state.commission;
  const terms = commissionTerms(state, c);
  state.items[c.itemId].stock -= c.count;
  state.gold += terms.gold;
  state.reputation += terms.rep;                    // dual-track fame, the serve convention
  state.lifetimeRep = fameOf(state) + terms.rep;
  // Deliberately NOT stats.itemSales: the loyalty ladders count COUNTER sales (Leggsy's bulk
  // rides serveCurrent and its skip-guard); a side-channel increment here would advance
  // breakpoints silently, with no crossing announcement. Special orders are their own channel.
  // (A commission-driven tier crossing likewise skips serveCurrent's license-announce block —
  // the 30s license reminder covers discovery; the rep bonus is small beside tier thresholds.)
  pushLog(state, { text: commissionLine(COMMISSION_VOICE.fulfilled, c),
    repDelta: 0, tier: 'market', monsterId: c.monsterId });
  state.commission = null;
  // REPEAT (Option A): the slot no longer rests until rollover — the courier travels, then the
  // next client's order seats (refreshCommission, same day, salted seed). The cooldown is the
  // pacing AND the anti-refarm: it persists, so neither a reload nor a midnight flip shortcuts it.
  state.commissionCooldownSec = CONFIG.commission?.repeatCooldownSec ?? 7200;
  state.uiDirty = true;
  return true;
}

// The deadline machinery — LAPSE first, then PLACE, so a rollover that expires yesterday's order
// seats today's in the same breath. ARMED only when a day identity exists: a live boot ran
// refreshMarketDay (marketDayKey) or a harness set the override — headless tests that merely
// tick update() never see commissions (the visit machinery's own arming convention).
export function refreshCommission(state) {
  if (!state.tradeDayKeyOverride && !state.marketDayKey) return;
  const idx = dayIndexOf(tradeDayKey(state));
  if (idx === null) return;                         // no day identity — idle, never guess
  const c = state.commission;
  if (c && idx >= (c.placedIndex ?? idx) + (c.days ?? 0)) {
    pushLog(state, { text: commissionLine(COMMISSION_VOICE.lapsed, c),
      repDelta: 0, tier: 'market', monsterId: c.monsterId });   // zero penalty — the comic beat IS the cost
    state.commission = null;
    state.uiDirty = true;
  }
  // THE SEAT RULE (REPEAT, Option A): an empty slot seats whenever the courier is home
  // (cooldown 0) — a NEW day starts the sequence over at the legacy seed; the SAME day continues
  // it with a salted one. The cooldown gates BOTH branches on purpose (see config): fulfilling at
  // 23:59 does not conjure a courier at midnight. commissionSeq > 0 is required for the same-day
  // branch so a day whose FIRST order never seated (nothing eligible yet) cannot seat "seconds".
  if (!state.commission && (state.commissionCooldownSec ?? 0) <= 0) {
    const newDay = idx > (state.lastCommissionIndex ?? -1);
    if (newDay || (idx === state.lastCommissionIndex && (state.commissionSeq ?? 0) > 0)) {
      const seq = newDay ? 0 : state.commissionSeq;
      const next = commissionForDay(tradeDayKey(state), eligibleCommissionItemIds(state), seq);
      if (next) {                                   // latch advances ONLY on placement: buying the
        state.commission = { ...next, placedIndex: idx };   // first trade license seats an order the
        state.lastCommissionIndex = idx;                    // same day, not a dead day later
        state.commissionSeq = seq + 1;
        const pool = COMMISSION_VOICE.placed[next.monsterId] ?? COMMISSION_VOICE.placed.generic;
        pushLog(state, { text: commissionLine(pool, state.commission),
          repDelta: 0, tier: 'market', monsterId: next.monsterId });
        state.uiDirty = true;
      }
    }
  }
}

// --- Restocking (cap is base maxStock + summed maxStock upgrades) --------------

// Effective stock cap for an item = its base cap plus any maxStock upgrade effects.
export function effectiveMaxStock(state, itemId) {
  const base = ITEMS[itemId]?.maxStock ?? Infinity;
  return base + sumEffect(state, 'maxStock');
}

// --- Supplier licenses (Pass 3). A tier-2 item exists on the shelf but is INERT until its
// one-time gold license is bought: customers never want it, it can't be restocked, and the
// offline sim skips it. License-free items are always unlocked. -------------------------------
export function isItemUnlocked(state, itemId) {
  const item = ITEMS[itemId];
  if (!item) return false;
  if (!item.license) return true;                     // base items need no license
  return state?.licenses?.[itemId] === true;
}

export function canBuyLicense(state, itemId) {
  const lic = ITEMS[itemId]?.license;
  if (!lic || isItemUnlocked(state, itemId)) return false;
  if (reputationTier(fameOf(state)).index < (lic.requiredTier ?? 0)) return false;
  return state.gold >= lic.cost;
}

// License alerts (UX roadmap 3): every license the shop's FAME already qualifies for but hasn't
// bought. Deliberately ignores gold — the alert trigger is eligibility, never affordability
// (canBuyLicense above is the purchase gate; this is the nag gate). Registry-scanned, so new
// licensed rows join the reminder pool with zero wiring.
export function eligibleUnboughtLicenses(state) {
  const tierIdx = reputationTier(fameOf(state)).index;
  return ITEM_ORDER.filter((id) => {
    const req = ITEMS[id].license?.requiredTier;
    return req !== undefined && state.licenses?.[id] !== true && req <= tierIdx;
  });
}

export function buyLicense(state, itemId) {
  if (!canBuyLicense(state, itemId)) return false;
  state.licenses[itemId] = true;
  state.gold -= ITEMS[itemId].license.cost;           // one-time gold sink
  state.uiDirty = true;
  return true;
}

// Haggler's Charm perk: gold off every restock, floored at 1 so an item can never restock free
// (the offline reserve margin math and the "always profitable" invariant both rely on cost >= 1).
export function effectiveRestockCost(state, itemId) {
  const base = ITEMS[itemId]?.restockCost ?? 0;
  return Math.max(1, base - sumPerkEffect(state, 'restockDiscount'));
}

export function canRestock(state, itemId) {
  const item = ITEMS[itemId];
  const slot = state.items[itemId];
  if (!item || !slot) return false;
  if (!isItemUnlocked(state, itemId)) return false;   // licensed goods only (Pass 3)
  // Trade-tier stock NEVER gold-restocks (reform law 1) — the Market Board is its only inflow.
  // This one gate covers restockItem, restockAll, canRestockAll, and Greg's trickleTarget.
  if ((item.acquisition ?? 'gold') !== 'gold') return false;
  return slot.stock < effectiveMaxStock(state, itemId) && state.gold >= effectiveRestockCost(state, itemId);
}

export function restockItem(state, itemId) {
  if (!canRestock(state, itemId)) return false;
  state.gold -= effectiveRestockCost(state, itemId);
  state.items[itemId].stock += 1;
  state.uiDirty = true;
  return true;
}

// --- Restock All (Pass 3.5). The quote is the FULL fill (every unlocked item to cap at effective
// cost); the action fills as much as gold allows, ROUND-ROBIN one unit per item per pass — the
// same fairness loop the offline sim uses — so a short purse spreads evenly across the shelf
// instead of topping up the first card and starving the last. ----------------------------------
// The Restocker's brain (mini round C1): pick ONE item to trickle a unit into. Priority: the front
// customer's wanted item if it's OUT (unblocks the actual queue), else the most-starved unlocked
// item (lowest stock-to-cap ratio; registry order breaks ties). Affordability is part of the pick —
// canRestock covers gold + cap — so a broke shop returns null and the worker idles, never overdrafts.
// Pure and exported: the suite pins the priority contract here, not in the tick loop.
export function trickleTarget(state) {
  const front = state.queue[0]?.wantedItemId;
  if (front && isItemUnlocked(state, front)
      && state.items[front].stock === 0 && canRestock(state, front)) return front;

  let best = null, bestRatio = 1;                    // ratio 1 = full; only below-cap items beat it
  for (const id of ITEM_ORDER) {
    if (!isItemUnlocked(state, id) || !canRestock(state, id)) continue;
    const ratio = state.items[id].stock / Math.max(1, effectiveMaxStock(state, id));
    if (ratio < bestRatio) { bestRatio = ratio; best = id; }
  }
  return best;
}

export function restockAllCost(state) {
  let total = 0;
  for (const id of ITEM_ORDER) {
    if (!isItemUnlocked(state, id)) continue;
    if ((ITEMS[id].acquisition ?? 'gold') !== 'gold') continue;   // trade tier: not gold-fillable (reform)
    const need = Math.max(0, effectiveMaxStock(state, id) - (state.items[id]?.stock ?? 0));
    total += need * effectiveRestockCost(state, id);
  }
  return total;
}

export function canRestockAll(state) {
  // True when at least ONE unit somewhere is both needed and affordable.
  return ITEM_ORDER.some((id) => canRestock(state, id));
}

export function restockAll(state) {
  let bought = 0, boughtThisPass = true;
  while (boughtThisPass) {
    boughtThisPass = false;
    for (const id of ITEM_ORDER) {
      if (canRestock(state, id)) {                 // license, cap, and per-unit gold all checked
        state.gold -= effectiveRestockCost(state, id);
        state.items[id].stock += 1;
        bought += 1;
        boughtThisPass = true;
      }
    }
  }
  if (bought > 0) state.uiDirty = true;
  return bought;
}

// --- Market Day (retention pass Option 2, Daniel 2026-07-06) -------------------
// One demand event per LOCAL calendar day (derived from the date — deterministic, reroll-proof)
// plus a once-a-day supplier crate. The registry + date math live in data/marketevents.js; this
// is the stateful half. Offline earnings are deliberately EVENT-FREE: the sim is a frozen,
// deterministic estimate of the absence, and the event is a come-play-today hook — applying it
// offline would pay yesterday's bonus for sleeping through it.

export function activeMarketEvent(state) {
  return MARKET_EVENTS[state?.marketEventId] ?? null;
}

// Payout multiplier for a category under today's event. x1 for non-matching categories, x1 when
// no event is derived (fresh headless states) — so every pre-market exact-math test still holds.
export function marketPayoutMult(state, category) {
  const ev = activeMarketEvent(state);
  if (!ev || ev.category !== category) return 1;
  return ev.payoutMult ?? CONFIG.market?.payoutMult ?? 1;
}

// Deal `units` FREE restock units round-robin, one per unlocked below-cap item per pass — the
// offline sim's fairness loop, so a small crate spreads across the shelf instead of topping the
// first card. Licensed-but-unbought items are invisible to it (isItemUnlocked), caps are hard.
// Returns how many units actually landed (a full shop absorbs zero).
export function dealCrateUnits(state, units) {
  let landed = 0, dealt = true;
  while (landed < units && dealt) {
    dealt = false;
    for (const id of ITEM_ORDER) {
      if (landed >= units) break;
      if (!isItemUnlocked(state, id)) continue;
      if ((ITEMS[id].acquisition ?? 'gold') !== 'gold') continue;   // a crate can't mint trade-tier stock (reform)
      if ((state.items[id]?.stock ?? 0) >= effectiveMaxStock(state, id)) continue;
      state.items[id].stock += 1;
      landed += 1;
      dealt = true;
    }
  }
  return landed;
}

// The one entry point, called at boot (main.js) and on calendar rollover (update() below).
// Derives today's event, and — once per calendar day, latched by the PERSISTED lastMarketDay —
// banks the supplier crate: fame-scaled free units (dealt above) + a gold sweetener; units that
// found no shelf room convert to gold, so the crate never arrives empty-handed. Announcements
// (two 'market' log lines + Bob's bubble) fire only on the new-day path — a same-day reload gets
// the HUD banner alone, not a re-run of the morning. Returns null when nothing changed, else
// { event, crate } (crate null on a same-day reload) — main.js saves immediately on a grant,
// the same no-double-collect rule as the offline bank.
export function refreshMarketDay(state, nowMs) {
  const key = dayKeyOf(nowMs);
  if (state.marketDayKey === key) return null;                 // same day, same session — no-op
  state.marketDayKey = key;                                    // transient (also arms the rollover check)
  state.marketEventId = eventIdForDay(key);                    // transient — the date IS the save
  const ev = MARKET_EVENTS[state.marketEventId] ?? null;

  let crate = null;
  if (state.lastMarketDay !== key) {                           // first open of this calendar day
    const tierIdx = reputationTier(fameOf(state)).index;       // fame-scaled: bigger shop, bigger crate
    const units = (CONFIG.market?.crateBaseUnits ?? 0) + tierIdx * (CONFIG.market?.crateUnitsPerTier ?? 0);
    const landed = dealCrateUnits(state, units);
    const gold = (CONFIG.market?.crateGoldBase ?? 0) + tierIdx * (CONFIG.market?.crateGoldPerTier ?? 0)
      + (units - landed) * (CONFIG.market?.crateUnitGoldFallback ?? 0);
    state.gold += gold;
    state.lastMarketDay = key;                                 // the persisted once-a-day latch
    crate = { units: landed, gold };
    // Board chalk handshake (life pass, 2026-07-07): a FRESH morning arms the write-on one-shot.
    // TRANSIENT, consumed by main.js only once the shop screen is visible — so a boot lands the
    // animation at Open Shop, not behind the title overlay. Same-day reloads never set this:
    // the sign was chalked this morning already.
    state.boardChalkPending = true;
    // Log order: pushed crate-first so the EVENT line sits on top of the newest-first feed —
    // the world's news above the shop's delivery.
    pushLog(state, { text: crateLine(landed, gold), repDelta: 0, tier: 'market' });
    if (ev) {
      pushLog(state, { text: marketAnnounceLine(ev), repDelta: 0, tier: 'market' });
      // Bob announces the day's market through his existing bubble queue. itemId routes the
      // bubble's click to the event category's shelf tab (any unlocked item of the category —
      // every category ships free items, but the ITEM_ORDER[0] guard keeps this crash-proof).
      // Pre-hire the bubble ticks unseen (same accepted trade as license announcements).
      const routeId = ITEM_ORDER.find((id) => isItemUnlocked(state, id)
        && ITEMS[id].category === ev.category) ?? ITEM_ORDER[0];
      const bs = (state.bobSpeech ??= { queue: [], current: null });
      bs.queue.push({ text: marketBubbleLine(ev), itemId: routeId });
    }
  }
  state.uiDirty = true;
  return { event: ev, crate };
}

// --- Special Visits (Option 2, "The Inspection" — Daniel 2026-07-07) -----------
// The dragon VIP: once per LOCAL calendar day at Legendary+, a spawn beat may be him. Eligibility
// is pure and testable; the RNG roll is passed IN (update() hands it Math.random()), so the suite
// pins both branches deterministically with no stubs. The latch persists (lastVisitDay) —
// reloading never re-rolls a day whose visit already landed.

export function visitEligible(state) {
  // marketDayKey doubles as the arming flag here exactly like the market rollover: only a boot
  // that ran refreshMarketDay has a day identity, so headless tests never see visits.
  return !!state.marketDayKey
    && state.lastVisitDay !== state.marketDayKey
    && reputationTier(fameOf(state)).index >= (CONFIG.visits?.requiredTier ?? Infinity);
}

export function trySpawnVisit(state, roll) {
  if (!visitEligible(state)) return null;
  if (roll >= (CONFIG.visits?.chancePerSpawn ?? 0)) return null;
  const c = spawnCustomer(state, 'dragon');
  if (!c) return null;
  state.lastVisitDay = state.marketDayKey;          // PERSISTED once-a-day latch (autosave carries
                                                    // it; a crash before save just re-offers)
  // The arrival is an EVENT: amber "world news" log line (the market tier's family, by design)
  // plus Bob's bubble, click-routed to whatever the Inspector actually wants today.
  pushLog(state, { text: visitAnnounceLine(), repDelta: 0, tier: 'market' });
  const bs = (state.bobSpeech ??= { queue: [], current: null });
  bs.queue.push({ text: visitBubbleLine(), itemId: c.wantedItemId });
  return c;
}

// The clipboard means something: his tip is a report card on the shelves at the moment of
// service. Two measured ingredients — FULLNESS (Σstock/Σcap over unlocked items) and VARIETY
// (categories with stock >= 1) — times the fame budget multiplier (a Mythic shop earns
// Mythic-grade tips). This is the pass's design thesis: the RESTOCK LOOP itself gets celebrated —
// Greg, the crate, and Restock All all feed this number. Payout-side by law; basePrice untouched.
export function inspectionGrade(state) {
  let stock = 0, cap = 0;
  const cats = new Set();
  for (const id of ITEM_ORDER) {
    if (!isItemUnlocked(state, id)) continue;
    const s = state.items[id]?.stock ?? 0;
    stock += s;
    cap += effectiveMaxStock(state, id);
    if (s > 0) cats.add(ITEMS[id].category);
  }
  const fullness = cap > 0 ? stock / cap : 0;
  const tierIdx = reputationTier(fameOf(state)).index;
  const fameMult = 1 + (CONFIG.fame?.budgetPerTierAboveBeloved ?? 0) * Math.max(0, tierIdx - 3);
  const tip = Math.round(((CONFIG.visits?.tipPerFullness ?? 0) * fullness
    + cats.size * (CONFIG.visits?.tipPerCategory ?? 0)) * fameMult);
  return { fullness, categories: cats.size, tip };
}

// --- Upgrades ----------------------------------------------------------------

// Fame (dual-track): tiers are driven by LIFETIME rep — the never-decreasing track — so spending
// the current balance on perks can never revoke a gate the player already earned.
export const fameOf = (state) => state.lifetimeRep ?? state.reputation;

// How often Doug speaks, in SECONDS between lines. This is the number the old `Math.random() < 0.25`
// gate actually encoded — it was tuned against his 24s base interval, and 24 / 0.25 = one line about
// every 96s. Naming it makes the RATE the decision, instead of a side effect of however fast Doug
// happens to run this save.
const DOUG_LINE_EVERY_S = 96;

// The chance a given scavenge return also prints a Doug line. DERIVED FROM THE LIVE INTERVAL, not a
// constant, and that is the whole fix: `0.25` was correct at a 24s cadence, then Doug's scavengeSpeed
// ladder (2026-07-14) took the interval to ~6.9s at level 10 WITHOUT retuning the gate — 3.5x the
// intended line rate, which is what Daniel reported as "he repeats his lines very often". Dividing
// the live interval by the target cadence holds the LINE rate steady at every level, and reproduces
// the old 0.25 exactly at level 0 (24/96) — the original tuning is preserved, not overridden.
//
// Clamped to 1: if a future worker's baseInterval ever exceeds the target cadence the gate would
// otherwise exceed certainty, which is meaningless rather than merely wrong. §85 pins that the clamp
// never engages on the live ladder — if it ever does, the cadence is no longer being held and that
// should be a failing test, not a silent shrug.
export function dougLineChance(state, id = 'scavenger') {
  return Math.min(1, effectiveWorkerInterval(state, id) / DOUG_LINE_EVERY_S);
}

// SCARCITY TEETH (F3 Option 1, Daniel 2026-07-13): the leave penalty scales with the shop's
// RUNG — a Renowned shop disappoints louder. The drain lands on SPENDABLE fame only (the perk
// budget); the lifetime track never falls, so a bad afternoon costs goodwill, never levels.
// Auto-wave and dismissal stay penalty-free by construction (they route through dismiss,
// repDelta 0): Bob managing the line is service, not failure. ??-guarded so a save/config
// without the dial degrades to the flat penalty, never NaN.
export function leavePenaltyOf(state) {
  return (CONFIG.reputation.leavePenalty ?? 1)
    + (CONFIG.reputation.leavePenaltyPerTier ?? 0) * reputationTier(fameOf(state)).index;
}

export function isUpgradeUnlocked(state, id) {
  const u = UPGRADES[id];
  if (!u) return false;
  return reputationTier(fameOf(state)).index >= (u.requiredTier ?? 0);
}

export function canBuyUpgrade(state, id) {
  if (!UPGRADES[id] || isMaxed(state, id)) return false;
  if (!isUpgradeUnlocked(state, id)) return false;             // gated behind a reputation tier
  return state.gold >= upgradeCost(id, upgradeLevel(state, id));
}

// --- Fame perks (rep-costed; see perks.js). Spending draws down state.reputation ONLY — the
// lifetime track is untouched, so tiers survive any spending spree. -----------------------------
export function isPerkUnlocked(state, id) {
  const p = PERKS[id];
  if (!p) return false;
  return reputationTier(fameOf(state)).index >= (p.requiredTier ?? 0);
}

export function canBuyPerk(state, id) {
  if (!PERKS[id] || isPerkMaxed(state, id)) return false;
  if (!isPerkUnlocked(state, id)) return false;
  return state.reputation >= perkCost(id, perkLevel(state, id));
}

export function buyPerk(state, id) {
  if (!canBuyPerk(state, id)) return false;
  state.reputation -= perkCost(id, perkLevel(state, id));   // spend the balance; lifetime unmoved
  state.perks[id] = perkLevel(state, id) + 1;
  state.uiDirty = true;
  return true;
}

export function buyUpgrade(state, id) {
  if (!canBuyUpgrade(state, id)) return false;
  state.gold -= upgradeCost(id, upgradeLevel(state, id));       // pay the current-level cost
  state.upgrades[id] = upgradeLevel(state, id) + 1;
  state.uiDirty = true;
  return true;
}

// --- Workers (auto-serve) ----------------------------------------------------

// Bob's auto-serve interval, shortened by Faster Counter via the SAME serveSpeed effect that shortens
// the counter cooldown — so counter upgrades speed automation too. Asymptotic; never reaches zero.
export function effectiveWorkerInterval(state, id) {
  const base = WORKERS[id]?.baseInterval ?? Infinity;
  // serveSpeed upgrades (Faster Counter) speed the COUNTER — they apply to the serve role only.
  // Without this scope, buying counter upgrades would silently speed the restock trickle too.
  // The restock role has its own dial: Swift Wings' trickleSpeed, same divisor form as serveSpeed
  // (0.25/level -> interval x0.8/x0.667 — the honest player-facing number is -20%/-33%).
  // Swift Wings' trickleSpeed is the RESTOCK dial only — without this scope it would silently
  // speed Doug's scavenge runs too (the exact leak the serve-scope note above warns about).
  if (WORKERS[id]?.role === 'restock') return base / (1 + sumPerkEffect(state, 'trickleSpeed'));
  // Doug's scavengeSpeed (his training ladder, 2026-07-14) is the SCAVENGE dial — same divisor
  // form as trickleSpeed/serveSpeed, but summed via sumWorkerEffect (a worker LEVEL effect, not a
  // perk, matching saleTip/offlineReserve). A distinct branch so future non-serve roles without a
  // scavengeSpeed effect stay on the plain dial. Faster runs => more scrap + relic-find rolls
  // (accepted, Daniel's call; the pity floor bounds relics — see workers.js).
  if (WORKERS[id]?.role === 'scavenge') return scavengeClock(state, id);
  if (WORKERS[id]?.role !== 'serve') return base;             // other future roles: the plain dial
  return base / (1 + sumEffect(state, 'serveSpeed'));
}

export function canHireWorker(state, id) {
  if (!WORKERS[id]) return false;
  if (isWorkerOwned(state, id)) return false;                  // already hired — no repeat purchase
  // Fame gate (Greg, 2026-07-04): same shape as licenses — LIFETIME tier, never the wallet.
  // ?? 0 keeps ungated workers (Bob) hireable from day one.
  if (reputationTier(fameOf(state)).index < (WORKERS[id].requiredTier ?? 0)) return false;
  return state.gold >= workerHireCost(id);
}

// --- Worker training (Deep Sinks, Option 2 — Daniel 2026-07-07). Levels below deepFrom open at
// hire; the DEEP band additionally needs the Mythic tier — the rung's content. Fail-closed like
// canBuyUpgrade: unknown worker, unhired, maxed, tier-short, or broke all return false.
export function canBuyWorkerLevel(state, id) {
  const L = WORKERS[id]?.levels;
  if (!L || !isWorkerOwned(state, id)) return false;
  const lvl = workerLevel(state, id);
  if (lvl >= L.maxLevel) return false;
  if ((lvl + 1) >= (L.deepFrom ?? Infinity)
      && reputationTier(fameOf(state)).index < (L.deepTier ?? 0)) return false;
  return state.gold >= workerLevelCost(id, lvl);
}

export function buyWorkerLevel(state, id) {
  if (!canBuyWorkerLevel(state, id)) return false;
  state.gold -= workerLevelCost(id, workerLevel(state, id));   // pay the current rung's price
  state.workers[id].level = workerLevel(state, id) + 1;
  state.uiDirty = true;
  return true;
}

// The Forge (§14 Pass B): restoring a FOUND relic consumes scrap + gold and puts it ON DISPLAY
// permanently (state 'restored' — the draw + ambient lines key off it). No effects in this
// pass: the effect slot stays empty for the Special-of-the-Day repurpose (post-audit).
// The active relic effects, folded (the rework, 2026-07-12 — Daniel's "the gag IS the effect").
// Guarded reads: a relic with no effect field folds to the identity, so future batches cost
// zero wiring here. Cheap enough to call at every hook site (four rows).
export function relicEffects(state) {
  const out = { mishapChanceMult: 1, combatBonus: 0, capBonus: 0, yesterdayRates: false };
  for (const id of RELIC_ORDER) {
    if (state.relics?.[id] !== 'restored') continue;
    const e = RELICS[id].effect ?? {};
    out.mishapChanceMult *= e.mishapChanceMult ?? 1;
    out.combatBonus += e.combatBonus ?? 0;
    out.capBonus += e.capBonus ?? 0;
    out.yesterdayRates ||= e.yesterdayRates === true;
  }
  return out;
}

export function canRestoreRelic(state, id) {
  const r = RELICS[id];
  if (!r || state.relics?.[id] !== 'found') return false;
  if ((state.scrap ?? 0) < r.restoreCost.scrap || state.gold < r.restoreCost.gold) return false;
  // HARD restores (the rework): materials incl. the Inspector's Seal — every line guarded.
  for (const [mid, n] of Object.entries(r.restoreCost.materials ?? {})) {
    if ((state.materials?.[mid] ?? 0) < n) return false;
  }
  return true;
}
export function restoreRelic(state, id) {
  if (!canRestoreRelic(state, id)) return false;
  const r = RELICS[id];
  state.scrap -= r.restoreCost.scrap;
  state.gold -= r.restoreCost.gold;
  for (const [mid, n] of Object.entries(r.restoreCost.materials ?? {})) {
    state.materials[mid] -= n;                 // canRestoreRelic proved every line covered
  }
  state.relics = { ...state.relics, [id]: 'restored' };
  const line = RELIC_VOICE.byRelic[id]?.restored;
  if (line) pushLog(state, { text: line, repDelta: 0, tier: 'milestone' });
  state.uiDirty = true;
  return true;
}

// TRUE while Doug is beyond the door — the GONE window of his run: past the idle beat and the
// walk-out, before the walk-back (same registry dials scene.js stages the trip with). Gates his
// battle-cameo lines: he and the mob are out there for legible reasons.
//
// THE GONE WINDOW SCALES WITH TRAINING. Doug's walk legs are near-fixed (walkSec 2.6, shrinking
// only once interval/4 bites), so a shorter cycle spends proportionally more of itself in
// transit and the gone window closes FASTER than the cycle does. MEASURED, 2026-07-14:
//     level   cycle    gone    out%
//       0     24.00s  11.60s   48%
//       5     10.67s   2.27s   21%
//      10      6.86s   1.37s   20%
// Two consequences follow. Daniel accepted BOTH as authored behaviour (2026-07-14) — they are
// decisions on the record, not defects, so don't "fix" either without asking him first:
//   (1) FREQUENCY — a trained Doug cameos less than half as often as an untrained one. Accepted:
//       a maxed Doug is a blur who barely stops moving, and glimpsing him less IS the joke.
//       Nearly all of the fall lands in the first five levels (21% -> 20% across L5..L10).
//   (2) TIMING — reports deliver ~1-2s after the serve decides them (the celebrant's door-entry
//       event, or CONFIG.log.reportFallbackSec = 3.0s). At L0 the 11.6s window dwarfs that
//       (~87% still out at display); at L10 the 1.37s window is SHORTER than the delay, so a
//       cameo never displays while he is visibly absent. Accepted: the battle log is
//       RETROSPECTIVE — it reports a fight that already resolved, and Doug genuinely WAS beyond
//       the door at that moment. The line never claims he is out NOW.
//
// This comment used to assert a flat "~12s gone window, so a boundary straddle is rare and
// harmless". That was true only at level 0. Doug's training ladder falsified it exactly as it
// falsified scene.js's "scavenge has no speed perks — this IS the clock": a comment at a live
// seam is a CLAIM, and a new dial can retire it silently. If you add a dial here, re-measure
// the table above rather than trusting this text.
export function isDougOut(state) {
  const d = WORKERS.scavenger;
  const w = state.workers?.scavenger;
  if (!d || w?.owned !== true) return false;
  const interval = scavengeClock(state), walk = Math.min(d.walkSec ?? 0, interval / 4);
  const elapsed = interval - Math.max(0, Math.min(w.timer ?? interval, interval));
  return elapsed >= interval * (d.idleFrac ?? 0) + walk && elapsed < interval - walk;
}

export function hireWorker(state, id) {
  if (!canHireWorker(state, id)) return false;
  state.gold -= workerHireCost(id);                            // pay the one-time hire cost
  state.workers[id].owned = true;
  state.workers[id].timer = effectiveWorkerInterval(state, id); // wait one interval before the first serve
  // Hire flavor (Greg's voice pass, 2026-07-05): a worker with authored WORKER_HIRE_LINES gets a
  // GOLD log line (tier 'milestone' — a 600-gold beat deserves the treatment), and Greg's intro
  // quip rides his own bubble for one normal showFor window (panels.js shows quip over report).
  // Registry-driven: a future worker with an entry here gets the same beat with zero new wiring.
  const flavor = WORKER_HIRE_LINES[id];
  if (flavor?.log?.length) pushLog(state, { text: pick(flavor.log), repDelta: 0, tier: 'milestone' });
  if (id === 'restocker' && flavor?.bubble?.length) {
    state.gregBubble = { cycleIn: CONFIG.gregBubble?.cycleSec ?? 45,
                         showFor: CONFIG.gregBubble?.showSec ?? 10,
                         quip: pick(flavor.bubble) };
  }
  state.uiDirty = true;
  return true;
}

// Tick every owned serve-worker. On timer expiry, attempt ONE sale through the exact manual path
// (serveCurrent) so payout/rep/log/cooldown all match. A success waits a full interval before the
// next; a blocked attempt (no customer / cooling down / out of stock / can't afford) leaves the timer
// ready so the worker fires as soon as conditions allow — without ever re-running the sale itself.
// EXPORTED as a test seam (2026-07-15), the spawnCustomer/dismissCurrent precedent. Purely
// additive — the only caller is update() below. §85 drives this directly to assert that Doug never
// says the same line twice in a row, which is the EFFECT Daniel reported; a source pin proving the
// call site merely MENTIONS pickNot would be the flag, not the result.
export function updateWorkers(state, dt) {
  for (const id of WORKER_ORDER) {
    const w = state.workers[id];
    if (!w.owned) continue;
    const role = WORKERS[id].role;

    if (role === 'serve') {
      w.timer -= dt;
      if (w.timer > 0) continue;
      // Greet gate (feel fix): the front customer must have been VISIBLE at the counter for greetSec
      // before a worker may serve them — at max Faster Counter, serves had become invisible teleports
      // straight to the battle log. Worker stays ready and fires the moment the greet elapses.
      // Manual serving is deliberately NOT gated (clicking = looking; active play stays faster).
      if ((state.queue[0]?.frontWait ?? 0) < (CONFIG.workers?.greetSec ?? 0)) { w.timer = 0; continue; }
      if (serveCurrent(state)) {                                 // sold one -> pace the next by the interval
        w.timer = effectiveWorkerInterval(state, id);
        state.workerServed = true;                               // signal main.js to play Bob's serve anim
      } else {
        w.timer = 0;                                             // blocked -> stay ready, retry next frame
      }
      continue;
    }

    if (role === 'restock') {
      w.timer -= dt;
      if (w.timer > 0) continue;
      // The trickle: units per run = 1 + Bulk Satchel (trickleUnits). Each unit RE-TARGETS and
      // pays through restockItem individually — so the second unit follows the priority rules
      // afresh (it may top a different item), respects caps, and a purse that covers one unit
      // buys exactly one (no free stock, no overdraft — the economy invariants hold per unit).
      const units = 1 + sumPerkEffect(state, 'trickleUnits');
      let landed = 0;
      for (let u = 0; u < units; u++) {
        const target = trickleTarget(state);
        if (!target || !restockItem(state, target)) break;
        landed++;
      }
      if (landed > 0) {
        w.timer = effectiveWorkerInterval(state, id);            // Swift Wings shortens this dial
        state.gregRestocked = true;                              // render signal, consumed by main.js
                                                                 // -> ONE errand per run, however
                                                                 // many units the satchel carried
      } else {
        w.timer = 1;                                             // blocked (all full / broke) -> 1s recheck
      }
    }

    if (role === 'scavenge') {
      w.timer -= dt;
      if (w.timer > 0) continue;
      // The haul lands exactly as Doug's walk-back ends — drawScavenger choreographs the round trip
      // as a PURE FUNCTION of this timer (scene.js), so fiction and economy share one clock and
      // nothing can desync. A run is never blocked: the beyond always has junk.
      state.scrap = (state.scrap ?? 0) + (WORKERS[id].scrapPerRun ?? 0);
      // THE FIND (§14 Pass B): rarely, a run turns up a broken RELIC instead of just scrap —
      // chance-per-run with a pity floor, and the WHAT is curated (RELIC_ORDER), so each find
      // is a designed beat. Pity only ticks while something is left to find.
      {
        const unfound = RELIC_ORDER.filter((r) => !state.relics?.[r]);
        if (unfound.length) {
          state.relicPity = (state.relicPity ?? 0) + 1;
          if (Math.random() < RELIC_FIND.chancePerRun || state.relicPity >= RELIC_FIND.pityRuns) {
            const rid = unfound[0];
            state.relics = { ...(state.relics ?? {}), [rid]: 'found' };
            state.relicPity = 0;
            pushLog(state, { text: pick(RELIC_VOICE.found).replace('{relic}', RELICS[rid].displayName),
              repDelta: 0, tier: 'milestone' });   // gold line — a find IS an event
          }
        }
      }
      w.timer = effectiveWorkerInterval(state, id);
      // His register, now and then. The gate is DERIVED (see dougLineChance): the old literal 0.25
      // was tuned against a 24s cadence and silently became 3.5x that rate once Doug could level.
      if (Math.random() < dougLineChance(state, id) && DOUG_RETURN_LINES.length) {
        // pickNot, not pick: a memoryless draw from six lines repeats back-to-back 1-in-6, and at
        // the post-leveling rate that landed roughly every 3 minutes. The memory rides the RUNTIME
        // worker object — `serializeSave` writes only { owned, level }, so lastLine is transient by
        // construction: no save-schema change, and (deliberately) no module-level container, which
        // is the cross-run mutable state the sim's divergence hunt already suspects. Resetting on
        // reload costs at most one repeat across a session boundary, which is the right price.
        const line = pickNot(DOUG_RETURN_LINES, w.lastLine ?? null);
        w.lastLine = line;
        pushLog(state, { text: line, repDelta: 0 });
      }
      state.uiDirty = true;                                    // the HUD scrap chip re-renders
    }
  }
}

// True if any hired worker can serve (currently just Bob). Gates the broke auto-wave below, so it only
// runs once the shop is automated — manual play still manages unaffordable customers by hand.
function anyServeWorkerOwned(state) {
  for (const id of WORKER_ORDER) {
    if (WORKERS[id].role === 'serve' && isWorkerOwned(state, id)) return true;
  }
  return false;
}

// With a serve-worker on staff, auto-wave a front customer who can't afford their item — the one
// blocker the player can't clear by restocking. Reuses the rep-neutral dismiss (+ its "shooed" log
// line) after CONFIG.queue.brokeGraceSec, so the line keeps flowing and affordable customers behind
// them don't time out (−rep). Keys off the SAME reason the Serve button shows, so it fires on exactly
// the "Can't afford it" state — never on out-of-stock (restock fixes that) or during a cooldown.
function autoWaveBroke(state, dt) {
  const c = state.queue[0];
  if (!c) return;
  if (serveBlockReason(state) !== 'cant-afford') return;
  c.brokeWait = (c.brokeWait ?? 0) + dt;
  if (c.brokeWait >= CONFIG.queue.brokeGraceSec) dismissCurrent(state);
}

// --- Per-frame update --------------------------------------------------------

export function update(state, dt) {
  if (state.screen !== 'shop') return;

  // Battle-report fallback: deliver any pending report whose celebrant never fired the door-entry
  // event (dropped by the celebrant cap, tab hidden, art edge case). HEAD-ONLY delivery keeps the
  // log FIFO — reports share one duration, so the head is always the most overdue.
  if (state.pendingReports?.length) {
    for (const r of state.pendingReports) r.fallback -= dt;
    while (state.pendingReports.length && state.pendingReports[0].fallback <= 0) {
      deliverBattleReport(state);
    }
  }

  if (state.serveCooldown > 0) {                    // count down the post-sale counter cooldown
    state.serveCooldown = Math.max(0, state.serveCooldown - dt);
    if (state.serveCooldown === 0) state.uiDirty = true;  // re-enable the Serve button
  }

  // EXPEDITIONS (reform step 4): the ONE slot's clock. Live ticking only — main.js credits away
  // time at boot, and this tick resolves whatever hit zero. The whole-second edge marks uiDirty
  // so the Bestiary countdown updates at 1Hz without a 60fps panel re-render.
  if (state.expedition) {
    const before = Math.ceil(state.expedition.remaining);
    state.expedition.remaining -= dt;
    if (Math.ceil(state.expedition.remaining) !== before) state.uiDirty = true;
    if (state.expedition.remaining <= 0) resolveExpedition(state);
  }

  // Market Day rollover (leave-it-open players): once the LOCAL calendar flips, re-derive the
  // event and grant the new day's crate mid-session. GATED on marketDayKey — only a boot that
  // explicitly ran refreshMarketDay (main.js) arms this, so headless tests that tick update()
  // never trigger crates or events by accident. Throttled: one string compare per checkSec.
  if (state.marketDayKey) {
    state.marketCheckIn = (state.marketCheckIn ?? 0) - dt;
    if (state.marketCheckIn <= 0) {
      state.marketCheckIn = CONFIG.market?.rolloverCheckSec ?? 5;
      refreshMarketDay(state, Date.now());
    }
  }

  // COMMISSIONS (reform step 6): the deadline machinery rides the TRADE day (tradeDayKey — the
  // override seam works headlessly, unlike the calendar-armed block above). refreshCommission
  // carries its own arming gate, so this throttle can tick unarmed harmlessly; a lapse discovered
  // at boot fires here on the first check, under the away summary where it belongs.
  // REPEAT: the courier's clock runs every tick (not inside the 5s throttle — a throttled
  // decrement would lose up to checkSec per expiry against the UI's countdown).
  if ((state.commissionCooldownSec ?? 0) > 0) {
    state.commissionCooldownSec = Math.max(0, state.commissionCooldownSec - dt);
    if (state.commissionCooldownSec === 0) state.uiDirty = true;   // the countdown row flips to an order
  }
  state.commissionCheckIn = (state.commissionCheckIn ?? 0) - dt;
  if (state.commissionCheckIn <= 0) {
    state.commissionCheckIn = CONFIG.commission?.checkSec ?? 5;
    refreshCommission(state);
  }

  // Bob's bubble (license alerts): tick the current line, promote the next from the queue. All
  // transient (never serialized) — the milestone log line is the permanent record, so a reload
  // mid-announcement loses only the bubble. Ticks even while Bob is unhired (the bubble simply
  // doesn't SHOW without its anchor — panels.js gates on ownership); the reminder below re-raises
  // anything that expired unseen, so nothing is lost, and in practice licenses start at Trusted,
  // long after the 50-gold hire. Every transition marks uiDirty: the bubble is a DOM element
  // rendered by renderPanels (Daniel's clickable pick, 2026-07-04), so show/hide/text changes
  // ride the dirty-render path.
  const bs = state.bobSpeech;
  if (bs) {
    if (bs.current && (bs.current.remaining -= dt) <= 0) { bs.current = null; state.uiDirty = true; }
    if (!bs.current && bs.queue.length) {
      const next = bs.queue.shift();
      bs.current = { text: next.text, itemId: next.itemId,
                     remaining: CONFIG.licenseAlerts?.announceSec ?? 6 };
      state.uiDirty = true;
    }
  }
  // The gentle recurring reminder: a free-running countdown (transient — boot restarts it, which
  // is also how a tier crossed OFFLINE gets announced ~30s into the next session). On expiry, if
  // any eligible license sits unbought AND the bubble is idle (never talk over the crossing
  // announcements), nudge about the first one. Trigger is eligibility, never gold.
  state.licenseReminderIn = (state.licenseReminderIn ?? CONFIG.licenseAlerts?.reminderSec ?? 30) - dt;
  if (state.licenseReminderIn <= 0) {
    state.licenseReminderIn = CONFIG.licenseAlerts?.reminderSec ?? 30;
    const unbought = eligibleUnboughtLicenses(state);
    if (unbought.length && !(state.bobSpeech?.current) && !(state.bobSpeech?.queue?.length)) {
      const bs2 = (state.bobSpeech ??= { queue: [], current: null });
      bs2.current = { text: licenseBubbleLine('reminder', { item: ITEMS[unbought[0]].displayName }),
                      itemId: unbought[0],
                      remaining: CONFIG.licenseAlerts?.announceSec ?? 6 };
      state.uiDirty = true;
    }
  }

  // Milestone stagger drain: tick the cooldown; on expiry, release the OLDEST queued gold line
  // and rearm — beats stay milestoneSpacingSec apart in game time, FIFO, however many stacked.
  if ((state.milestoneCooldown ?? 0) > 0) {
    state.milestoneCooldown -= dt;
    if (state.milestoneCooldown <= 0) {
      state.milestoneCooldown = 0;
      const next = state.milestoneQueue?.shift();
      if (next) {
        pushLogNow(state, next);
        state.milestoneCooldown = CONFIG.log.milestoneSpacingSec ?? 2.5;
        state.uiDirty = true;
      }
    }
  }

  // Greg's restock report (Option 1 duty cycle, Daniel 2026-07-05): "a way to restock, not the
  // main way" — while Greg is hired and something unlocked sits OUT, the bubble pops for showSec
  // once per cycleSec instead of standing permanently. Transient like the license reminder (boot
  // restarts the cycle). renderPanels shows it only while showFor > 0 and re-derives the TARGET
  // per render — a mid-show restock retargets to the next out item or hides it early.
  const gb = (state.gregBubble ??= { cycleIn: CONFIG.gregBubble?.cycleSec ?? 45, showFor: 0 });
  if (gb.showFor > 0 && (gb.showFor -= dt) <= 0) {
    gb.showFor = 0; gb.quip = null;                 // the hire quip is a one-window beat
    state.uiDirty = true;
  }
  gb.cycleIn -= dt;
  if (gb.cycleIn <= 0) {
    gb.cycleIn = CONFIG.gregBubble?.cycleSec ?? 45;
    // GOLD-ONLY (the Option-2 retirement, Daniel 2026-07-12 — mirrored in renderPanels' isOut):
    // trade-tier outages are the steady state under single-unit trading, so counting them here
    // made the cycle fire forever. Greg reports only what a gold click can fix.
    const anyOut = state.workers?.restocker?.owned === true
      && ITEM_ORDER.some((id) => (ITEMS[id].acquisition ?? 'gold') === 'gold'
        && isItemUnlocked(state, id) && state.items[id].stock === 0);
    if (anyOut && gb.showFor <= 0) {
      gb.showFor = CONFIG.gregBubble?.showSec ?? 10;
      state.uiDirty = true;
    }
  }

  state.spawnTimer -= dt;
  // Return cooldowns tick here, deleted at expiry (the spawn filter stays a cheap lookup and the
  // transient object never accumulates stale keys).
  if (state.mobCooldowns) {
    for (const id of Object.keys(state.mobCooldowns)) {
      if ((state.mobCooldowns[id] -= dt) <= 0) delete state.mobCooldowns[id];
    }
  }
  if (state.spawnTimer <= 0) {
    if (state.queue.length < CONFIG.queue.maxLength + sumPerkEffect(state, 'queueLength')) {  // Velvet Rope
      // THE INSPECTION (Special Visits): the beat may be the dragon instead — pure trigger,
      // roll passed in (suite-testable), persisted latch, armed like the market rollover.
      const c = trySpawnVisit(state, Math.random()) ?? spawnCustomer(state);
      if (c) { state.queue.push(c); state.uiDirty = true; }
    }
    // Spawn director: the NEXT interval depends on how the line looks now (post-spawn length),
    // clamped to the table's last entry. Empty -> hurry, deep -> relax; see CONFIG.queue.
    const table = CONFIG.queue.spawnIntervalByQueue ?? [2.6];
    state.spawnTimer = table[Math.min(state.queue.length, table.length - 1)];
  }

  if (state.queue.length) {
    for (const c of state.queue) c.patienceRemaining -= dt;
    const stillWaiting = [];
    for (const c of state.queue) {
      if (c.patienceRemaining > 0) { stillWaiting.push(c); continue; }
      armReturnCooldown(state, c.monsterId);          // timed out and wandered off — gone for a beat
      const name = MONSTERS[c.monsterId]?.displayName ?? 'Someone';
      // SCARCITY TEETH (F3): tier-scaled penalty, derived once per leaver so the log line
      // reports exactly what was charged. See leavePenaltyOf beside fameOf.
      const pen = leavePenaltyOf(state);
      state.reputation = Math.max(0, state.reputation - pen);
      // The leave-theft (roadmap 6 Pass B, Daniel 2026-07-05): a THIEF-flagged mob who times out
      // pockets ONE unit of his wanted item — in-stock only, no payment, the leave rep penalty
      // still applies on top. Bounded on purpose: leave-only, one unit, wanted-item-only. The
      // prevention is DISMISSAL — Send Away and Bob's auto-wave are the anti-theft plays, which
      // turns an existing pure-loss event into a watch-his-patience decision. The theft-tier
      // line REPLACES the generic leave line (one event, one line, both facts).
      const steals = MONSTERS[c.monsterId]?.thief === true
        && sellableStock(state, c.wantedItemId) > 0;             // B1: a thief can't pocket a RESERVED unit
      if (steals) {
        state.items[c.wantedItemId].stock -= 1;
        pushLog(state, { ...logLine(c.monsterId, 'theft', { name,
          item: ITEMS[c.wantedItemId]?.displayName, itemId: c.wantedItemId,
          serves: state.stats.monsterServes[c.monsterId] ?? 0 }),
          repDelta: -pen, tier: 'leave', monsterId: c.monsterId });
      } else {
        pushLog(state, { ...logLine(c.monsterId, 'leave', { name,
          serves: state.stats.monsterServes[c.monsterId] ?? 0,
          gregHired: state.workers?.restocker?.owned === true }),  // Greg's leave remarks, hire-gated
          repDelta: -pen, tier: 'leave', monsterId: c.monsterId });
      }
    }
    if (stillWaiting.length !== state.queue.length) {
      state.queue = stillWaiting;
      state.uiDirty = true;
    }
  }

  // The settled front customer accrues counter time (drives the worker greet gate). Accrued AFTER
  // spawns/leavers so a mob promoted to the front this tick starts its greet from ~0.
  if (state.queue[0]) state.queue[0].frontWait = (state.queue[0].frontWait ?? 0) + dt;

  if (anyServeWorkerOwned(state)) autoWaveBroke(state, dt);  // clear broke blockers so the line keeps flowing
  updateWorkers(state, dt);   // auto-serve runs last, on the settled queue (spawns in, leavers out)
}

// Raw log insert — no spacing logic. Internal: the drain below and non-milestone lines use this.
function pushLogNow(state, entry) {
  state.log.unshift(entry);
  if (state.log.length > CONFIG.log.maxEntries) state.log.length = CONFIG.log.maxEntries;
}

// The single log chokepoint. MILESTONE-tier entries are STAGGERED (Daniel, 2026-07-05): one serve
// can legitimately earn several gold lines (breakpoint + new-stories + a fame crossing), and
// simultaneous gold reads as one blob — so the first delivers instantly and the rest queue,
// released by update() every milestoneSpacingSec. Battle/dismiss/leave lines bypass entirely
// (only gold-vs-gold spacing matters; a battle line landing between beats is natural feed
// behavior). Both spacing fields are TRANSIENT — a reload mid-gap drops queued LINES only (the
// milestones' effects are already applied), the same accepted trade as pendingReports.
function pushLog(state, entry) {
  if (entry.tier === 'milestone' && (state.milestoneCooldown ?? 0) > 0) {
    (state.milestoneQueue ??= []).push(entry);
    return;
  }
  if (entry.tier === 'milestone') state.milestoneCooldown = CONFIG.log.milestoneSpacingSec ?? 2.5;
  pushLogNow(state, entry);
}

// Deliver the OLDEST pending battle report to the log. Called from two places: main.js's
// door-entry callback (the celebrant just walked through — the normal path) and the fallback tick
// in update(). FIFO by design and ID-LESS on purpose: celebrants and reports are both
// serve-ordered, so "oldest report on each entry event" stays correct even when the celebrant cap
// drops a ghost — the NEXT entry event delivers the dropped one's report, one slot late and
// visually indistinguishable. Returns true if a report was delivered (main.js doesn't need it —
// uiDirty is set here — but the suite asserts on it).
export function deliverBattleReport(state) {
  const r = state.pendingReports?.shift();
  if (!r) return false;
  pushLog(state, r.entry);
  state.uiDirty = true;
  return true;
}