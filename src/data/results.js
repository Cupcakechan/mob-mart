// results.js — battle-log message templates. {name} = monster, {item} = item they bought.
// Fallback chain in combat.js: monster+tier flavor -> generic tier line -> last-ditch string.

// Generic lines per tier (one picked at random).
export const GENERIC_RESULTS = {
  excellent: [
    '{name} came back a legend. With a {item} and a story.',
    '{name} won so hard the Hero apologized.',
  ],
  success: [
    '{name} survived! Dealt 1 damage. So brave.',
    '{name} took the {item} and lived. Mostly.',
  ],
  partial: [
    '{name} lost, but made a friend.',
    '{name} got a participation trophy.',
  ],
  failure: [
    '{name} got smacked. Crit by the Hero. Ouch.',
    '{name} and the {item} were last seen fleeing.',
  ],
  funnyFailure: [
    '{name} faceplanted. Bonus: Embarrassment.',
    '{name} tripped before the fight even started.',
  ],
};

// Optional per-monster, per-tier flavor. Missing keys fall back to GENERIC_RESULTS above.
export const MONSTER_RESULTS = {
  skeleton: {
    failure: ['{name} got dismantled. Again.'],
    funnyFailure: ['{name} fell apart. Literally.', '{name} faceplanted. Bonus: Embarrassment.'],
  },
  slime: {
    success: ['{name} bounced off the Hero. Rude.', '{name} survived! Dealt 1 damage. So brave.'],
  },
  bat: {
    failure: ['{name} flew into the wall. Twice.'],
  },
};
