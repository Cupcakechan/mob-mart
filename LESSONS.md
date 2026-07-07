# LESSONS.md — error record (feeds the dev-method; harvest in a dev-method skill session)

## 2026-07-03 — wall_shelf prop hook shipped without its sprite registration
- What broke / what happened: Shelf decoration v2's optional `wall_shelf.png` never rendered —
  the PNG was correctly named and placed, but both planks kept drawing the code fallback.
- Root cause: `sprites.js` is a registry — `getSprite(id)` only serves ids previously registered
  via `loadSprite(id, url)` in `main.js`. The pass added the consumer (`getSprite('wall_shelf')`
  in scene.js) but not the registration line, and the delivery claimed "single file, scene.js
  only." Graceful fallback masked it perfectly: unregistered id → code plank, zero console noise.
- Verification gap it exposed: nothing ties each `getSprite` consumer id to a `loadSprite`
  registration. `node --check`, the module-import health section, and behavioral probes all pass —
  an unregistered id is a *legal* state (it's how optional art degrades), so only a pairing check
  can catch a *forgotten* registration.
- Plug shipped (fix + sweep + guard): fix = one `loadSprite('wall_shelf', …)` line in main.js
  (landing zone grep-verified, exactly one). Sweep = every literal `getSprite` id in scene.js
  checked against main.js registrations (all clean); dynamic-id sites audited (items, monsters,
  door variants, Bob strips — all resolve to registered ids; `slime_idle`/`skeleton_idle` are
  never requested because those mobs declare no `anim`). Guard = QUEUED into the housekeeping
  pass: when the suite is committed as `test_suite.mjs`, add an assertion that every literal
  `getSprite('…')` id in `src/render/scene.js` appears as a `loadSprite('…')` in `src/main.js`.
- Route: skill reference (html-game.md) candidate — "registry-consumer pairing: a pass that adds a
  sprite consumer must add/verify its registration; grep both sides before delivery." Guard itself
  is project-level (suite assertion) until harvested.

## 2026-07-04 — Fifth nav tab overlapped the customer panel (no bottom-bar budget existed)
- What broke: adding the Fame tab pushed the right-anchored nav's LEFT edge ~50px into the
  customer panel — the nav grows leftward, and the only guard was a stale "~537" comment.
- Root cause: the bottom bar's three fixed neighbors (customer panel, nav, log) had no recorded
  width budget; the 4-tab layout happened to fit with 13px of slack nobody had measured.
- Verification gap: layout budgets were documented per-airspace elsewhere (bubble ceiling, actor
  band) but not for the bottom bar; nothing headless can check CSS geometry.
- Plug: customer panel 500 -> 430 (post-bubble its info column only holds name + line count), and
  the BUDGET is now documented at both CSS sites: panel ends 454, 5-tab nav reaches ~470-480,
  **a 6th tab does NOT fit — redesign, don't shrink.**
- Route: project-level (CSS comments are the guard). Skill candidate: "every fixed-position bar
  gets a written width budget the day it ships."

## 2026-07-05 — "Batty drank the Rusty Key": a category tag is a contract with the WHOLE roster
- What broke: consumable-tagged drink lines fired with the Rusty Key — which is legitimately
  `category: 'consumable'` (single-use; the shelf has three buckets), so the tag system worked
  exactly as designed and still produced nonsense.
- Root cause: tag semantics narrower than the category roster. "Consumable" is not "drinkable";
  lines were authored against the potions in mind, not the full member list.
- Plug: liquid verbs reworded to swallow-verbs (absurd-good for keys AND flasks), plus suite
  section 42 pins the law mechanically (no drank/chugged/sipped in consumable-tagged texts) and
  the bible records it for future batches.
- Route: bible law (recorded) + suite guard (shipped). Skill candidate: "when authoring against a
  category, read the category's full roster first — including its weirdest member."

## 2026-07-05 — Non-integer pixel-art scaling almost shipped (Greg 112 -> 96)
- What broke (nearly): the Restocker placeholder pass set drawn height 96; Daniel's art arrived
  at native 112. A 0.857x downscale muddies every pixel of pixel art.
- Root cause: the drawn size was chosen before the art existed, from proportion feel ("smaller
  than Bob"), with no native-size rule in play.
- Plug: draw at native 112 (1:1); the rule is now in the RESTOCKER comment.
- Route: skill reference (html-game.md) candidate — "pixel art renders at native size or integer
  multiples only; pick placeholder sizes the art can hit."

## 2026-07-05 — Suite sections are isolated scopes; editing one without reading its imports
- What broke: three ReferenceErrors in a row while upgrading existing suite assertions for the
  milestone stagger (CONFIG twice, dismissCurrent once) — each edited section lacked the binding
  in ITS OWN import block.
- Root cause: the suite imports per-section (`await import` inside each block) by design; an edit
  that works in one section fails in another with identical-looking code.
- Plug: bindings added per-section; the rule is now: **when editing an existing suite section,
  read its import block first** — treat each section as its own module.
- Route: project convention (suite structure). Same family as "read the established call pattern
  before using a helper" (the mergeSave two-arg miss, same day).

## 2026-07-05 — `git add .` shipped an unnoticed file DELETION (COMEDY_BIBLE.md, 417 lines)
- What broke: the milestone-stagger commit deleted COMEDY_BIBLE.md alongside its three intended
  files — discovered only when the NEXT pass tried to edit the bible and got ENOENT at HEAD.
- Root cause: the file was already missing from the local working tree at commit time (local
  cause unknown — a move, an unzip mishap); `git add .` faithfully staged the deletion, and the
  checkpoint's `git status` output wasn't scanned for `deleted:` lines before committing.
- Recovery: `git checkout <last-good-sha> -- COMEDY_BIBLE.md` (recover-before-diagnose; content
  fully intact in history — this is why small commits matter).
- Plug / rule: **the `git status` step is a READ, not a ritual** — before any `git add .`, scan
  specifically for `deleted:` and unexpected paths; any unexpected deletion stops the checkpoint.
  Claude-side mirror: after `git pull`, verify the key docs (handoff, bible, LESSONS) still exist
  before editing "around" them.
- Route: universal method candidate (the git checkpoint section) — until harvested, this entry
  is the guard.

## 2026-07-05 — The 18s return cooldown starved the endgame stage (statistical section caught it)
- What broke: queue-uniqueness shipped with returnCooldownSec 18; the suite's statistical
  director test failed — at maxed Bob throughput the stage sat EMPTY 51% of frames.
- Root cause: steady-state cooling count = cooldown / serve interval. At ~2.5s maxed serves,
  18s -> ~7 mobs cooling against a 6-mob roster: the spawn pool was permanently near-empty. The
  fiction only needs the cooldown to outlast the ~4s celebrant march; 18 was 4x that for no gain.
- Plug: dial to 8 (~3 cooling at max speed, pool sustained, still 2x the march) and THE MATH NOW
  LIVES IN THE CONFIG COMMENT so the next tuner sees the ceiling before raising it.
- Route: project (the comment is the guard) + a general shape worth keeping: any per-entity
  cooldown that gates a shared spawn pool needs its steady-state count checked against the pool
  size at MAXIMUM throughput, not typical throughput. The statistical suite sections exist for
  exactly this class — they catch balance regressions that exact-math tests can't see.

## 2026-07-05 — A truncated registry read nearly shipped a mob who only wanted Clubs
- What broke (nearly): Ratty's first row omitted categoryWeights — my earlier read of Froggo's
  row used a grep window that cut off before those fields, so the template I copied was
  incomplete. Without the field, the want-picker's fallback makes EVERY want ITEM_ORDER[0].
- Root cause: templating a new registry entry from a PARTIAL read of the reference entry.
- Plug: caught before delivery (the strand-invariant failure prompted a full-row read); suite
  sections 45/47 now pin categoryWeights presence for every new mob.
- Route: instance of the standing artifact-wins rule with a sharper edge: when a new entry is
  templated from an existing one, read the reference entry TO ITS CLOSING BRACE — a grep window
  is not a read.

## 2026-07-05 — An untracked scratch file silently blocked git pull (stale-tree reads followed)
- What broke: a beetle.png copied into the clone as scratch blocked \`git pull\` ("untracked
  working tree files would be overwritten"); the pull ABORTED, the session's reads ran on a tree
  one commit behind, and only the stderr line revealed it.
- Root cause: leaving untracked working copies inside a tree that syncs against a remote Daniel
  pushes art into.
- Plug: scratch files live outside the clone; after every pull, verify the expected HEAD (the
  log line) — a pull that "ran" is not a pull that succeeded.
- Route: Claude-side workflow rule; pairs with the existing "git status is a READ" entry.
