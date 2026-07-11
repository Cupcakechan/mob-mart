# LESSONS.md — error record (feeds the dev-method; harvest in a dev-method skill session)

## 2026-07-03 — wall_shelf prop hook shipped without its sprite registration [HARVESTED — 2026-07-03]
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
  **SHIPPED (verified 2026-07-07, housekeeping pass): suite section 0b** — broader than queued:
  it scans ALL of `src/` for literal `getSprite('…')` PLUS config-carried `propId:`/`spriteId:`
  ids (the shape this very bug wore) against main.js registrations, with a guard-the-guard
  assertion so a rotted regex can't pass vacuously.
- Route: skill reference (html-game.md) candidate — "registry-consumer pairing: a pass that adds a
  sprite consumer must add/verify its registration; grep both sides before delivery." Guard itself
  is project-level (suite assertion) until harvested.

## 2026-07-04 — Fifth nav tab overlapped the customer panel (no bottom-bar budget existed) [HARVESTED — 2026-07-07]
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

## 2026-07-05 — "Batty drank the Rusty Key": a category tag is a contract with the WHOLE roster [HARVESTED — 2026-07-07]
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

## 2026-07-05 — Non-integer pixel-art scaling almost shipped (Greg 112 -> 96) [HARVESTED — 2026-07-07]
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

## 2026-07-05 — `git add .` shipped an unnoticed file DELETION (COMEDY_BIBLE.md, 417 lines) [HARVESTED — 2026-07-07]
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

## 2026-07-05 — The 18s return cooldown starved the endgame stage (statistical section caught it) [HARVESTED — 2026-07-07]
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

## 2026-07-05 — A truncated registry read nearly shipped a mob who only wanted Clubs [HARVESTED — 2026-07-07]
- What broke (nearly): Ratty's first row omitted categoryWeights — my earlier read of Froggo's
  row used a grep window that cut off before those fields, so the template I copied was
  incomplete. Without the field, the want-picker's fallback makes EVERY want ITEM_ORDER[0].
- Root cause: templating a new registry entry from a PARTIAL read of the reference entry.
- Plug: caught before delivery (the strand-invariant failure prompted a full-row read); suite
  sections 45/47 now pin categoryWeights presence for every new mob.
- Route: instance of the standing artifact-wins rule with a sharper edge: when a new entry is
  templated from an existing one, read the reference entry TO ITS CLOSING BRACE — a grep window
  is not a read.

## 2026-07-05 — An untracked scratch file silently blocked git pull (stale-tree reads followed) [HARVESTED — 2026-07-07]
- What broke: a beetle.png copied into the clone as scratch blocked \`git pull\` ("untracked
  working tree files would be overwritten"); the pull ABORTED, the session's reads ran on a tree
  one commit behind, and only the stderr line revealed it.
- Root cause: leaving untracked working copies inside a tree that syncs against a remote Daniel
  pushes art into.
- Plug: scratch files live outside the clone; after every pull, verify the expected HEAD (the
  log line) — a pull that "ran" is not a pull that succeeded.
- Route: Claude-side workflow rule; pairs with the existing "git status is a READ" entry.

## 2026-07-06 — index.kongregate.html silently drifted several passes behind index.html
- What broke / what happened: the Kongregate shell (defined as "index.html + one script tag,
  otherwise identical") was missing the hire-goal chip, Bob's bubble markup, the menu overlay,
  and the away-modal additions from the last three passes — it still carried the retired
  floating Reset button. Found while applying the Market Day modal edit under the sync rule.
- Root cause: the sync rule ("any edit to index.html must be mirrored") lives only in comments
  and the handoff; every recent index.html-touching pass edited one file and nothing checked the
  other. A no-build project has no bundler to notice two entry pages diverging.
- Verification gap it exposed: nothing machine-checks the mirror. The module-health suite never
  parses HTML, and the shell only misbehaves ON Kongregate — locally it's never loaded.
- Plug shipped (fix + sweep + guard): fix = regenerated index.kongregate.html mechanically from
  today's index.html + the two Kong-only insertions, diff-verified to be exactly those five
  lines. Sweep = full diff (no other drift classes found). Guard = suite section 50 asserts
  every line of index.html appears IN ORDER in index.kongregate.html (subsequence check — Kong
  extras allowed anywhere, missing/stale content fails).
- Route: skill reference (html-game.md) candidate — "a mirrored entry page is a build artifact
  without a build step; regenerate it mechanically and suite-pin the mirror, never hand-sync."

## 2026-07-08 — The VIP sizing saga: three deliveries and a burned re-export, all Claude's
- What broke / what happened: the dragon VIP shipped at +15% over queue-mates and read
  "massively smaller than everyone" (Daniel, correctly); two sizing iterations later
  (spriteScale 1.25 -> 1.4 -> pixelScale 2), Claude instructed a 200% re-export with the words
  "no code changes needed" while the registry still said pixelScale: 2 — Daniel followed the
  instruction exactly and the game rendered a 512px dragon with per-file proportion mismatches.
  Daniel is reauthoring the character from scratch. Three deliveries, an artist's export pass,
  and trust were spent on what should have been one sizing decision.
- Root causes (three, all Claude-side):
  1. The size spec was computed against the wrong reference set. "+33% over the CAST" ignored
     Greg (native 112px, ~93px visible, standing elevated) and Bob (240px) sharing the same
     shot. A "special" read is relative to EVERYTHING on screen, never to the entity's category.
  2. The §9 art contract (permanent 128 frame + a multiplier) capped the achievable size inside
     the integer-scaling law, then spent the artist's time discovering that ceiling one bump at
     a time instead of computing the ceiling FIRST and admitting the frame was wrong.
  3. An instruction that breaks the game when followed exactly is a Claude defect, not a user
     error. "No code changes needed" was false the moment it was typed — the dial change was a
     precondition, and the message buried it as a later menu.
- Verification gap it exposed: nothing machine-checks that authored asset DIMENSIONS match the
  registry's drawing assumptions — 0b pairs sprite IDS, not sizes, so a frame-size change lands
  silently as a scale explosion at draw time.
- Plug (QUEUED into the reauthor integration, next session): a registry frame-size expectation
  for pixel-scaled sprites + a suite assertion that reads each such PNG and pins its frame
  dimensions; plus the standing rule change — oversized/VIP characters are AUTHORED AT DISPLAY
  SIZE and drawn 1:1 (the Greg precedent), never routed through multipliers again.
- Route: dev-method skill candidate (art-integration reference): "size specs enumerate every
  on-screen reference; oversized characters author at 1:1; asset dimensions are a suite-pinned
  contract, not a comment."


## 2026-07-10 — A scripted DELETION ate the neighbor line (DOUG.height): NaN geometry is silently invisible
- What broke: after the celebrant-floor-grammar fix, Doug stopped rendering entirely — idle
  included. No error anywhere.
- Root cause: the edit script spliced TWO lines to retire the one-line `doorFeetY` field; the
  second removed line was its neighbor `height: 160`. `DOUG.height` → undefined → box NaN →
  every draw coordinate NaN — and canvas SILENTLY draws nothing (no throw, no console noise).
- Verification gap it exposed: three guards all passed — `node --check` (the file stayed valid
  syntax), the suite (headless; cannot exercise canvas draws), and the landing-zone check
  (which verified only the INSERTED block). A scripted deletion has a landing zone too: the
  SURVIVORS. Nothing audited what remained around the removal.
- Plug: fix = restore `height: 160` (the line now carries a warning comment). Guard = the
  SURVIVOR AUDIT — every `DOUG.*` reference in scene.js checked field-by-field against the
  config block (all defined). Rule: after any scripted splice/deletion, read the BLOCK THAT
  REMAINS and verify each field its consumers reference still exists — splice counts are
  off-by-one magnets; prefer single-line anchored removals over counted multi-line splices.
- Route: universal method candidate (the scripted-edits section — "deletions have landing
  zones too; audit the survivors"). Pairs with 2026-07-05 "landing-zone checks, not exit codes".

## 2026-07-10 — `node --check` passed a file whose ES-module parse failed (the doubled brace)
- What broke: a display-fix splice left a doubled `}` in drawRelicWall. `node --check` PASSED;
  the suite’s module-import health section failed with "Unexpected token ’}’" — the game would
  not have booted.
- Root cause: two layers. (1) The splice re-added a close brace its survivors already provided
  (the survivor-audit lesson’s sibling — the audit printed the block’s HEAD, not its closes).
  (2) `node --check` parses in SCRIPT mode; the file’s real parse gate is the ES-MODULE parse,
  and the two grammars disagree on some errors — a green --check is NOT proof the module loads.
- Plug: delivery verification now runs the ESM import itself (`node --input-type=module -e
  "await import(file)"`) alongside --check — the suite’s module-health section remains the
  backstop and is what caught this. Survivor audits must print a spliced block through its
  CLOSING braces, not just its opening lines.
- Route: universal method candidate (the check-before-delivering section — "the fast check’s
  limits" now include parse-mode divergence). Pairs with the 2026-07-10 survivor-audit entry.

## 2026-07-11 — Registry facts written from memory in a DOC pass: three live customers marked "future", a second dragon invented
- What broke: TRADE_MARKET_DESIGN.md §3 (and the handoff lines quoting it) shipped two false
  registry facts — Skele/Ratty/Beetley labeled "future customers" (all three LIVE since the
  2026-07-05 passes) and a "customer dragon sheds scales / dragon bureaucrat stamps seals"
  fiction describing TWO characters where monsters.js has ONE (`id:'dragon'` IS the Inspector,
  `special:true`). Committed and pushed before the error surfaced.
- Root cause: the doc pass ran on conversational memory + shorthand instead of a registry read —
  "artifact wins over memory" was applied to code passes but not to the DOC that describes the
  code. Worse, the contradiction was already in hand: the same session cited the handoff's "rat
  open call — closed, the rat is in" while typing "Rat — future customer" two lines later. Two
  contradictory beliefs, unreconciled, is a STOP signal that wasn't treated as one.
- Caught: the Market Pass A code recon (the mandatory monsters.js read) — before any code built
  on the wrong roster. Upside of the miss: Pass A shipped SIX live faucets, not four.
- Plug: doc passes get the same recon as code passes — any registry-derived claim (rosters,
  fields, counts, statuses) is READ from the registry at writing time, never recalled; and a
  detected self-contradiction halts the paragraph until resolved.
- Route: universal method candidate (verify-don't-assume — add "applies to documents about the
  code, not just the code").

## 2026-07-11 — An unterminated inline heredoc made a whole edit script a silent no-op (returncode 0)
- What broke: a chained shell command opening a heredoc that was never terminated — the shell
  swallowed the entire monsters.js edit script as heredoc body, executed nothing, and returned
  0 with NO output. The file was untouched; nothing failed loudly.
- Root cause: multi-line edit logic inlined into a chained bash command; heredoc terminators
  across `&&`/`||` chains are a parsing minefield, and "exit 0" is meaningless when the payload
  never ran.
- Caught: empty stdout from a command that should have printed its landing report — treated as
  a failure signal in itself; a `git diff --stat` read confirmed zero changes before retrying.
- Plug: multi-line scripted edits go through a SCRIPT FILE (create → run → delete), never an
  inline chained heredoc; every edit script must PRINT its landing report, and silence where
  output was expected is a red flag regardless of exit code. Pairs with 2026-07-05
  "landing-zone checks, not exit codes".
- Route: universal method candidate (scripted-edits section — "no inline heredocs; scripts are
  files; silence is failure").

## 2026-07-11 — `git pull | tail -1` printed "Updating x..y" while the pull ABORTED; HEAD stayed a commit behind
- What broke: with a dirty working tree, `git pull 2>&1 | tail -1` showed the optimistic
  "Updating 791ce2e..ed8f243" line — the abort message ("Please move or remove them…") was cut
  off by the tail — and work continued at the OLD head for several turns, including a tuning
  sweep.
- Root cause: piping a pull through `tail -1` selects whichever line comes last, not the
  verdict; and the very next command's `git log -1` output CONTRADICTED the pull line and was
  read past.
- Caught: the same contradiction, on the second look. Benign only by luck — `git show --stat`
  proved the missed commit was doc-only, so the sweep's data stood.
- Plug: after EVERY pull, `git log -1` must equal the expected remote tip before any work; never
  truncate a pull's output; a contradiction between two adjacent command outputs is a stop
  signal, not noise.
- Route: universal method candidate (git section, the mirror-side of "git status is a READ").
