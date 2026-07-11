// sim_economy.mjs — THE ECONOMY AUDIT harness (§0 pass 1, 2026-07-10; Daniel picked B/B/B).
// COMMITTED deliverable (named OUTSIDE the test_*.mjs ignore pattern on purpose — it is a
// permanent balance instrument, not a scratch probe; it is NOT shipped — the ship folder is
// index.html + src/ + style.css + assets/ only). Reusable for every future balance question.
//
// Run: node sim_economy.mjs           (from the repo root; ~seconds; exit non-zero on cap-hit)
//
// WHAT IT MEASURES: a fresh save played headlessly through the REAL modules (the suite's own
// technique — update() driven with a fixed dt, zero game-file changes: the audit law) until the
// desire curve DIES — the moment the last want falls — plus a 60-min tail that measures the
// post-death accumulation rate (the number behind the observed 6.4x endgame purse).
//
// THE POLICY (Daniel's options-round picks, 2026-07-10 — recorded here per convention):
//   - Player model = GREEDY-CHEAPEST (Option B). Every sim-second: restock first (operating
//     cost, always profitable), then buy the single cheapest affordable unbought want per
//     currency — gold buys the cheapest of {hire / license / upgrade level / training rung /
//     relic restore (when scrap also covers)}; rep buys the cheapest perk. One authored
//     exception mirroring the tutorial: manual serves are allowed ONLY until Bob is hired
//     (40g start vs 50g hire needs them by design), then strictly hands-off.
//     The fall times this yields are the EARLIEST-POSSIBLE (the lower envelope) — the honest
//     measure of where the desire curve dies, with zero contestable priority authoring.
//   - Horizon = EVENT-DRIVEN (Option B): run to the last want, +TAIL_SEC, hard cap CAP_SEC.
//   - Report = the printed tables below feed ECONOMY_AUDIT.md (Option B).
//
// DETERMINISM: Math.random is swapped for a seeded PRNG per run (the suite's swap technique),
// so re-runs are bit-identical — the 3x-stability requirement is satisfied by determinism
// itself; the statistical band comes from the SEEDS list (median + min/max per want).
// The baseline is CALENDAR-FREE: marketDayKey is never set, so Market Day and the Inspector
// stay unarmed (their own headless convention) and Date.now never reaches the math.

import { CONFIG } from './src/config.js';
import { createInitialState } from './src/state.js';
import {
  update, serveCurrent, serveBlockReason,
  hireWorker, canHireWorker, buyLicense, canBuyLicense,
  buyUpgrade, canBuyUpgrade, buyPerk, canBuyPerk,
  buyWorkerLevel, canBuyWorkerLevel, restoreRelic, canRestoreRelic,
  restockAll, canRestockAll, fameOf,
} from './src/game.js';
import { ITEMS, ITEM_ORDER } from './src/data/items.js';
import { UPGRADES, UPGRADE_ORDER, upgradeCost, upgradeLevel } from './src/data/upgrades.js';
import { PERKS, PERK_ORDER, perkCost, perkLevel } from './src/data/perks.js';
import { WORKERS, WORKER_ORDER, workerLevelCost, workerLevel, isWorkerOwned } from './src/data/workers.js';
import { RELICS, RELIC_ORDER } from './src/data/relics.js';
import { reputationTier } from './src/reputation.js';

// --- Dials (named constants, the config convention) ---------------------------------------------
const SEEDS = [1, 2, 3, 4, 5]; // 5 seeds -> median + min/max per want; odd count keeps the median exact
const DT = 0.1;                // sim tick (s). Must stay <= the min serve cooldown (0.2s at max
                               // Faster Counter) or serves quantize slower than the live game.
const POLICY_SEC = 1.0;        // how often the simulated player acts (restock + buys) — ~a human click cadence
const SAMPLE_SEC = 60;         // curve sampling interval
const TAIL_SEC = 3600;         // post-death observation window (the accumulation-rate measurement)
const CAP_SEC = 48 * 3600;     // hard safety cap; a cap-hit is reported loudly and exits non-zero
const OBSERVED_ENDGAME_PURSE = 1462291; // the §0 starting fact: 6.4x the 228,483 sink stack

// --- Seeded PRNG (mulberry32) — swapped into Math.random per run --------------------------------
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- The want inventory (derived LIVE from the registries — never hand-typed) -------------------
const TOTAL_WANTS = WORKER_ORDER.length
  + ITEM_ORDER.filter((id) => ITEMS[id].license).length
  + UPGRADE_ORDER.reduce((s, id) => s + (UPGRADES[id].maxLevel ?? 0), 0)
  + WORKER_ORDER.reduce((s, id) => s + (WORKERS[id].levels?.maxLevel ?? 0), 0)
  + PERK_ORDER.reduce((s, id) => s + (PERKS[id].maxLevel ?? 0), 0)
  + RELIC_ORDER.length; // restores; FINDS are RNG prerequisites, tracked as events, not wants

// The full sink stack, recomputed live for the report header (the 228,483 fingerprint check).
function sinkTotals() {
  let lic = 0, hire = 0, up = 0, train = 0, relicGold = 0, relicScrap = 0, perkRep = 0;
  for (const id of ITEM_ORDER) if (ITEMS[id].license) lic += ITEMS[id].license.cost;
  for (const id of WORKER_ORDER) {
    hire += WORKERS[id].hireCost ?? 0;
    const L = WORKERS[id].levels;
    if (L) for (let l = 0; l < L.maxLevel; l++) train += workerLevelCost(id, l);
  }
  for (const id of UPGRADE_ORDER) for (let l = 0; l < UPGRADES[id].maxLevel; l++) up += upgradeCost(id, l);
  for (const r of RELIC_ORDER) { relicGold += RELICS[r].restoreCost.gold; relicScrap += RELICS[r].restoreCost.scrap; }
  for (const id of PERK_ORDER) for (let l = 0; l < PERKS[id].maxLevel; l++) perkRep += perkCost(id, l);
  return { lic, hire, up, train, base: lic + hire + up + train, relicGold, relicScrap, perkRep };
}

// --- The greedy scans: cheapest affordable unbought want, per currency --------------------------
function cheapestGoldWant(state) {
  let best = null;
  const consider = (cost, buy, key, label, scrap = 0) => {
    if (cost < (best?.cost ?? Infinity)) best = { cost, buy, key, label, scrap };
  };
  for (const id of WORKER_ORDER) {
    if (canHireWorker(state, id)) {
      consider(WORKERS[id].hireCost, () => hireWorker(state, id),
        `hire:${id}`, `Hire ${WORKERS[id].displayName}`);
    }
    if (canBuyWorkerLevel(state, id)) {
      const lvl = workerLevel(state, id);
      consider(workerLevelCost(id, lvl), () => buyWorkerLevel(state, id),
        `train:${id}:L${lvl + 1}`, `${WORKERS[id].displayName} — ${WORKERS[id].levels.name} L${lvl + 1}`);
    }
  }
  for (const id of ITEM_ORDER) {
    if (canBuyLicense(state, id)) {
      consider(ITEMS[id].license.cost, () => buyLicense(state, id),
        `license:${id}`, `License: ${ITEMS[id].displayName}`);
    }
  }
  for (const id of UPGRADE_ORDER) {
    if (canBuyUpgrade(state, id)) {
      const lvl = upgradeLevel(state, id);
      consider(upgradeCost(id, lvl), () => buyUpgrade(state, id),
        `upgrade:${id}:L${lvl + 1}`, `${UPGRADES[id].displayName} L${lvl + 1}`);
    }
  }
  for (const id of RELIC_ORDER) {
    if (canRestoreRelic(state, id)) {
      consider(RELICS[id].restoreCost.gold, () => restoreRelic(state, id),
        `relic:${id}`, `Restore ${RELICS[id].displayName}`, RELICS[id].restoreCost.scrap);
    }
  }
  return best;
}

function cheapestPerkWant(state) {
  let best = null;
  for (const id of PERK_ORDER) {
    if (!canBuyPerk(state, id)) continue;
    const lvl = perkLevel(state, id);
    const cost = perkCost(id, lvl);
    if (cost < (best?.cost ?? Infinity)) {
      best = { cost, buy: () => buyPerk(state, id),
        key: `perk:${id}:L${lvl + 1}`, label: `${PERKS[id].displayName} L${lvl + 1} (rep)` };
    }
  }
  return best;
}

// --- One seeded run ------------------------------------------------------------------------------
function runSim(seed) {
  const realRandom = Math.random;
  Math.random = mulberry32(seed);
  try {
    const s = createInitialState();
    s.screen = 'shop';                       // update() gates on the shop screen
    const events = [];                       // { t, kind, key, label, cost, scrap, currency }
    const samples = [];                      // { t, gold, scrap, rep, lifetime, remaining }
    let purchased = 0, deathT = null, goldAtDeath = 0, scrapAtDeath = 0;
    let tierSeen = reputationTier(fameOf(s)).index;
    const foundSeen = new Set();
    let policyIn = 0, sampleIn = 0, t = 0;

    while (t < CAP_SEC && (deathT === null || t < deathT + TAIL_SEC)) {
      update(s, DT);
      t += DT;
      policyIn -= DT; sampleIn -= DT;

      if (policyIn <= 0) {
        policyIn = POLICY_SEC;
        // 1. The tutorial exception: manual serves only until Bob is hired.
        if (!isWorkerOwned(s, 'mimic_merchant') && serveBlockReason(s) === null) serveCurrent(s);
        // 2. Restock first — operating cost before wants (the locked policy).
        if (canRestockAll(s)) restockAll(s);
        // 3. Gold wants: buy the cheapest, re-scan, repeat while affordable (bounded for safety).
        for (let i = 0; i < 50; i++) {
          const w = cheapestGoldWant(s);
          if (!w) break;
          w.buy();
          purchased++;
          events.push({ t, kind: w.key.split(':')[0], key: w.key, label: w.label,
            cost: w.cost, scrap: w.scrap, currency: 'gold' });
        }
        // 4. Rep wants (perks) — independent currency, same greed.
        for (let i = 0; i < 20; i++) {
          const p = cheapestPerkWant(s);
          if (!p) break;
          p.buy();
          purchased++;
          events.push({ t, kind: 'perk', key: p.key, label: p.label, cost: p.cost, scrap: 0, currency: 'rep' });
        }
        // 5. Fame-tier crossings (events, not purchases — §0 asks for their wall-clock moments too).
        const idx = reputationTier(fameOf(s)).index;
        while (tierSeen < idx) {
          tierSeen++;
          const tier = CONFIG.reputation.tiers[tierSeen];
          events.push({ t, kind: 'fame', key: `fame:${tierSeen}`,
            label: `Fame tier: ${tier.label}`, cost: tier.min, scrap: 0, currency: 'fame' });
        }
        // 6. Relic finds (RNG + pity events; restores above are the purchases).
        for (const r of RELIC_ORDER) {
          if (s.relics?.[r] && !foundSeen.has(r)) {
            foundSeen.add(r);
            events.push({ t, kind: 'find', key: `find:${r}`,
              label: `Doug finds: ${RELICS[r].displayName}`, cost: 0, scrap: 0, currency: '-' });
          }
        }
        if (deathT === null && purchased >= TOTAL_WANTS) { deathT = t; goldAtDeath = s.gold; scrapAtDeath = s.scrap ?? 0; }
      }

      if (sampleIn <= 0) {
        sampleIn = SAMPLE_SEC;
        samples.push({ t, gold: s.gold, scrap: s.scrap ?? 0,
          rep: s.reputation, lifetime: s.lifetimeRep, remaining: TOTAL_WANTS - purchased });
      }
    }
    samples.push({ t, gold: s.gold, scrap: s.scrap ?? 0,
      rep: s.reputation, lifetime: s.lifetimeRep, remaining: TOTAL_WANTS - purchased });

    const postRate = (deathT !== null && t > deathT)
      ? (s.gold - goldAtDeath) / ((t - deathT) / 60) : null;   // net gold/min with nothing to want
    return { seed, events, samples, deathT, endT: t, goldAtDeath, scrapAtDeath,
      goldEnd: s.gold, scrapEnd: s.scrap ?? 0, postRate, purchased };
  } finally {
    Math.random = realRandom;
  }
}

// --- Formatting helpers ---------------------------------------------------------------------------
const hms = (sec) => {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};
const kfmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '')}k` : String(Math.round(n)));
const pad = (v, w) => String(v).padStart(w);
const median = (arr) => [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)];

// A compact fixed-width column chart (linear scale, carry-forward buckets) — the report's curves.
function renderChart(title, samples, getV, unit, cols = 100, rows = 14) {
  const tMax = samples[samples.length - 1].t || 1;
  const col = new Array(cols).fill(0);
  for (const s of samples) {
    const c = Math.min(cols - 1, Math.floor((s.t / tMax) * cols));
    col[c] = getV(s);
  }
  for (let c = 1; c < cols; c++) if (col[c] === 0 && getV(samples[0]) !== 0) { /* keep true zeros */ }
  let vMax = Math.max(...col, 1);
  const lines = [`  ${title}  (y max ${kfmt(vMax)} ${unit})`];
  for (let r = rows; r >= 1; r--) {
    const threshold = (vMax * r) / rows;
    const label = (r === rows || r === Math.ceil(rows / 2) || r === 1) ? kfmt(threshold).padStart(7) : ' '.repeat(7);
    lines.push(`  ${label} |${col.map((v) => (v >= threshold ? '#' : ' ')).join('')}`);
  }
  lines.push(`  ${' '.repeat(7)} +${'-'.repeat(cols)}`);
  lines.push(`  ${' '.repeat(8)}0${' '.repeat(cols - String(hms(tMax)).length - 1)}${hms(tMax)}`);
  return lines.join('\n');
}

// Net want-savings velocity for one run: (gold delta + gold spent on wants) per minute, windowed.
// This is the affordability-relevant rate — how fast the purse climbs TOWARD the next want.
function savingsVelocity(run, windowSec = 1800) {
  const out = [];
  const end = run.endT;
  for (let w0 = 0; w0 < end; w0 += windowSec) {
    const w1 = Math.min(w0 + windowSec, end);
    const s0 = run.samples.filter((s) => s.t <= w0).pop() ?? run.samples[0];
    const s1 = run.samples.filter((s) => s.t <= w1).pop();
    const spent = run.events
      .filter((e) => e.currency === 'gold' && e.t > w0 && e.t <= w1)
      .reduce((sum, e) => sum + e.cost, 0);
    out.push({ w0, w1, rate: (s1.gold - s0.gold + spent) / ((w1 - w0) / 60) });
  }
  return out;
}

// --- Run everything --------------------------------------------------------------------------------
const T = sinkTotals();
console.log('MOB MART — ECONOMY AUDIT  (sim_economy.mjs — greedy-cheapest / event-driven horizon)');
console.log('====================================================================================');
console.log(`config fingerprint (live registries): licenses ${T.lic} + hires ${T.hire} + upgrades ${T.up}`
  + ` + training ${T.train} = ${T.base} gold (the §0 starting fact)`);
console.log(`  + relic restores ${T.relicGold} gold & ${T.relicScrap} scrap  |  perks ${T.perkRep} rep`
  + `  |  grand gold sink ${T.base + T.relicGold}`);
console.log(`wants inventory: ${TOTAL_WANTS} purchases  |  seeds ${SEEDS.join(',')}  |  dt ${DT}s`
  + `  |  policy every ${POLICY_SEC}s  |  tail ${TAIL_SEC / 60}min  |  cap ${CAP_SEC / 3600}h`);
console.log('');

const runs = SEEDS.map((seed) => runSim(seed));

let capHit = false;
console.log('== PER-SEED SUMMARY ==');
for (const r of runs) {
  if (r.deathT === null) {
    capHit = true;
    console.log(`  seed ${r.seed}: CAP HIT at ${hms(r.endT)} with ${TOTAL_WANTS - r.purchased} wants left — RESULTS INCOMPLETE`);
  } else {
    console.log(`  seed ${r.seed}: desire curve dies at ${hms(r.deathT)}  |  purse at death ${kfmt(r.goldAtDeath)}`
      + `  |  post-death rate ${r.postRate.toFixed(0)} gold/min  |  purse +60min ${kfmt(r.goldEnd)}`
      + `  |  scrap at death ${r.scrapAtDeath} (155 spent)`);
  }
}
console.log('');

// Aggregate the timeline across seeds.
const byKey = new Map();
for (const r of runs) {
  for (const e of r.events) {
    if (!byKey.has(e.key)) byKey.set(e.key, { ...e, times: [] });
    byKey.get(e.key).times.push(e.t);
  }
}
const rows = [...byKey.values()]
  .map((e) => ({ ...e, med: median(e.times), min: Math.min(...e.times), max: Math.max(...e.times), n: e.times.length }))
  .sort((a, b) => a.med - b.med || a.key.localeCompare(b.key));

console.log('== TIMELINE — the wall-clock moment every want falls (median of 5 seeds; min–max spread) ==');
console.log(`  ${'median'.padStart(8)}  ${'min'.padStart(8)}  ${'max'.padStart(8)}  ${'kind'.padEnd(8)}  ${'cost'.padStart(7)}  want`);
for (const e of rows) {
  const cost = e.currency === 'gold' ? kfmt(e.cost) + (e.scrap ? `+${e.scrap}s` : '')
    : e.currency === 'rep' ? `${kfmt(e.cost)}r`
    : e.currency === 'fame' ? `${kfmt(e.cost)}f` : '-';
  const partial = e.n < SEEDS.length ? `  [${e.n}/${SEEDS.length} seeds]` : '';
  console.log(`  ${pad(hms(e.med), 8)}  ${pad(hms(e.min), 8)}  ${pad(hms(e.max), 8)}  ${e.kind.padEnd(8)}  ${pad(cost, 7)}  ${e.label}${partial}`);
}
console.log('');

// Death analysis.
const deaths = runs.filter((r) => r.deathT !== null);
if (deaths.length) {
  const dMed = median(deaths.map((r) => r.deathT));
  const rateMed = median(deaths.map((r) => r.postRate));
  // Lifetime rep at the death moment (nearest sample at/before it) — where tier thresholds
  // actually sit against a full run; the dial data for any future tier-min retune.
  const fameMed = median(deaths.map((r) => (r.samples.filter((s) => s.t <= r.deathT).pop() ?? r.samples[0]).lifetime));
  console.log('== DESIRE-CURVE DEATH ==');
  console.log(`  median lifetime rep at death: ${kfmt(fameMed)}  (Mythic's threshold is ${CONFIG.reputation.tiers[6].min})`);
  console.log(`  median death: ${hms(dMed)} of continuous idle play  (spread ${hms(Math.min(...deaths.map((r) => r.deathT)))}–${hms(Math.max(...deaths.map((r) => r.deathT)))})`);
  console.log(`  median post-death accumulation: ${rateMed.toFixed(0)} gold/min  =  ${kfmt(rateMed * 60)} gold/hour with NOTHING left to want`);
  console.log(`  the observed endgame purse (${kfmt(OBSERVED_ENDGAME_PURSE)} = 6.4x the sink stack) ≈ `
    + `${(OBSERVED_ENDGAME_PURSE / (rateMed * 60)).toFixed(1)} hours of post-death play at that rate`);
  console.log('');
}

// Seed-1 detail: savings velocity by phase + the two curves.
const r1 = runs[0];
console.log(`== SAVINGS VELOCITY (seed ${r1.seed}) — net gold/min flowing toward wants, per 30-min window ==`);
for (const w of savingsVelocity(r1)) {
  console.log(`  ${pad(hms(w.w0), 8)} – ${pad(hms(w.w1), 8)}   ${pad(w.rate.toFixed(0), 6)} gold/min`);
}
console.log('');
console.log(renderChart(`GOLD BALANCE over time (seed ${r1.seed})`, r1.samples, (s) => s.gold, 'gold'));
console.log('');
console.log(renderChart(`WANTS REMAINING over time (seed ${r1.seed}) — of ${TOTAL_WANTS}`, r1.samples, (s) => s.remaining, 'wants'));
console.log('');
console.log(capHit
  ? 'RESULT: CAP HIT — at least one seed never exhausted its wants inside the horizon. See summary above.'
  : 'RESULT: all seeds exhausted every want. The timeline above is the desire curve; the death block is the finding.');
process.exit(capHit ? 1 : 0);
