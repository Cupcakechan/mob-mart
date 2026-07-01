// combat.js — off-screen combat resolver. Pure: monster + item -> tier + rep delta + a funny line.
import { CONFIG } from './config.js';
import { randInt, pick } from './utils.js';
import { GENERIC_RESULTS, MONSTER_RESULTS } from './data/results.js';

export function scoreToTier(score) {
  const t = CONFIG.combat.thresholds;
  if (score >= t.excellent) return 'excellent';
  if (score >= t.success)   return 'success';
  if (score >= t.partial)   return 'partial';
  if (score >= t.failure)   return 'failure';
  return 'funnyFailure';
}

export function resolveCombat(monster, item) {
  const c = CONFIG.combat;
  const itemEffect = item?.combatEffect ?? 0;         // guard: missing field never NaNs the score
  const monsterMod = monster?.combatMod ?? 0;
  const score = itemEffect + monsterMod - c.encounterDifficulty + randInt(-c.rngSpread, c.rngSpread);
  const tier = scoreToTier(score);
  const repDelta = c.repByTier[tier] ?? 0;
  return { tier, repDelta, score, message: buildMessage(monster, item, tier) };
}

// Fallback chain: monster+tier flavor -> generic tier line -> last-ditch string. Never crashes.
function buildMessage(monster, item, tier) {
  const name = monster?.displayName ?? 'Someone';
  const itemName = item?.displayName ?? 'something';
  const perMonster = MONSTER_RESULTS[monster?.id]?.[tier];
  const pool = (perMonster && perMonster.length) ? perMonster
             : (GENERIC_RESULTS[tier] ?? ['{name} did a thing.']);
  return pick(pool).replace(/\{name\}/g, name).replace(/\{item\}/g, itemName);
}
