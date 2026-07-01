// combat.js — off-screen combat resolver. Pure: monster + item -> a result tier.
// The tier drives which funny line the log picks (see messages.js); it has no effect on rep/gold.
import { CONFIG } from './config.js';
import { randInt } from './utils.js';

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
  return { tier: scoreToTier(score), score };
}
