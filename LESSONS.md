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

## 2026-07-06 — index.kongregate.html silently drifted several passes behind index.html [HARVESTED — 2026-07-10]
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

## 2026-07-08 — The VIP sizing saga: three deliveries and a burned re-export, all Claude's [HARVESTED — 2026-07-10]
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


## 2026-07-10 — A scripted DELETION ate the neighbor line (DOUG.height): NaN geometry is silently invisible [HARVESTED — 2026-07-10]
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

## 2026-07-10 — `node --check` passed a file whose ES-module parse failed (the doubled brace) [HARVESTED — 2026-07-11]
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

## 2026-07-11 — Registry facts written from memory in a DOC pass: three live customers marked "future", a second dragon invented [HARVESTED — 2026-07-11]
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

## 2026-07-11 — An unterminated inline heredoc made a whole edit script a silent no-op (returncode 0) [HARVESTED — 2026-07-11]
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

## 2026-07-11 — `git pull | tail -1` printed "Updating x..y" while the pull ABORTED; HEAD stayed a commit behind [HARVESTED — 2026-07-11]
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

## 2026-07-12 — The filter that "didn't work": a CSS specificity TIE, a probe that tested the mechanism instead of the effect, and stale CSS on top [HARVESTED — 2026-07-12]

**What happened:** Pass B's category filter (offer rows toggle `.hidden`) shipped visually broken
and survived THREE fix rounds. Cause one: `.offer-row { display:flex }` was appended at the END
of style.css — it TIES the global `.hidden { display:none }` (both 0-1-0 specificity), and a tie
resolves by ORDER, so the late `flex` beat `none` and "hidden" rows stayed visible. The codebase
already knew this trap — `.item-card.hidden`, `.restock-btn.hidden` are scoped overrides for
exactly this reason — the new rule just didn't follow the house pattern. Cause two, stacked on
top: Daniel's browser served a STALE style.css while running fresh JS modules (the dark-brown
hint showed gold; the count-only chips proved the JS was current), so even correct CSS fixes
looked dead on arrival, and Claude burned a round on a wrong "hard refresh" diagnosis.

**The probe that lied by omission:** a jsdom instrumentation run "proved the filter works" — but
it asserted `classList.contains('hidden')`, the MECHANISM, not the computed display, the EFFECT.
The class was always applied; the CSS resolution was the failure, and the probe never looked at
it. An instrumented test that stops one layer short of the user-visible effect can certify a bug
as working.

**The rules:** (1) any element with its own display rule that will ever receive `.hidden` gets a
scoped `.thing.hidden { display:none }` override AT BIRTH — suite §63(f) now text-pins the
offer-row one. (2) Probes assert the EFFECT the user sees (computed style, rendered geometry),
not the flag that should produce it. (3) Static assets that change during development carry a
cache-busting version (`style.css?v=N`, both shells, bumped on CSS change) — "did you hard
refresh" is not a deployment strategy. (4) When fixes half-apply (some visible, some not), the
FIRST hypothesis is layered staleness — enumerate which artifacts are provably current (the
chips proved the JS) before diagnosing the code.

Route: universal method candidate (probe-the-effect; scoped-override-at-birth; cache-bust static
assets; the half-applied-fix staleness heuristic).

## 2026-07-12 — The pending checkpoint a feedback pivot silently cancelled [HARVESTED — 2026-07-12]
- What happened: the daily-special pass was delivered and browser-confirmed, but Daniel's
  confirmation message pivoted straight into the next design round (the board rework), and the
  checkpoint was never sent. Both passes then rode ONE commit (87adc7b) whose message names only
  the sale sign — one-system-per-commit broken, and the special's completion is invisible in
  `git log`.
- Root cause: the checkpoint step was keyed on "Daniel confirms, then checkpoint" — a
  confirmation that ARRIVES WITH a new request reads as the next task and the ritual step gets
  skipped.
- Verification gap: none mechanical — the commit content was correct; the granularity and the
  message were the loss. Caught at the next session-sync (`git show --stat` on an
  unexpectedly-shaped log).
- Plug: a confirmation embedded in a pivot still closes the open pass — deliver the pending
  checkpoint BEFORE opening the new round's work, even inside the same reply.
- Route: GI candidate (the per-feature workflow's step 4).

## 2026-07-12 — A compound shell chain that half-ran: the bump landed, the regen didn't [HARVESTED — 2026-07-12]
- What happened: the CSS version bump, the mirror-regen script, and the verification were
  chained in one shell command; a syntax error in a LATER verification clause aborted the chain
  after the `sed` bump but before the regen — leaving the mirror stale at v=9 while index.html
  read v=10.
- Root cause: partial execution of a compound command; the failure surfaced as a shell parse
  error, not a regen error, so nothing said "mirror stale."
- Caught: the landing report — re-running the checks alone showed a 6-line mirror delta (5 is
  the law) and v=10 in only one shell. An instance of the existing edit-script law (silence
  where output was expected), with a refinement.
- Plug: the clean re-run, then delta + version verified in BOTH shells. Refinement to encode:
  run the EDIT and its VERIFICATION as separate commands — a verification clause must never be
  able to abort the edit it verifies.
- Route: skill reference (SKILL.md scripted-edits law — the separation refinement).

## 2026-07-12 — The messenger built on a steady state: Greg's trade-mode bubble, shipped and retired same-day [HARVESTED — 2026-07-12]
- What happened: the Greg-chip fix (a gold quote on material-made stock) was first built as a
  two-mode bubble — trade outages got a "Trade at the Market ▸" door. In play it nagged: Greg
  cycled through the tier's outages one after another, often pointing at trades the player
  couldn't afford. Retired same-session for the gold-only filter (both the render target pick
  and the game-side cycle trigger).
- Root cause: the bubble treats an outage as an EVENT, but under single-unit trading against
  5-stock shelves a trade-tier outage is the STEADY STATE (the churn finding, design doc §13b) —
  a message keyed on a permanent condition is a nag by construction, whatever it says.
- Verification gap: the suite proved the bubble's CONTENT, not its FREQUENCY — nothing measured
  the condition's duty cycle. Daniel's play session was the instrument.
- Plug: gold-only filter on both sides, §68 pins the exclusion. The rule to encode: before
  building a message/attention beat on a condition, check the condition's duty cycle at steady
  state — an always-true trigger disqualifies the surface, not just the wording.
- Route: GI candidate (design-side sibling of the attention/motion laws).

## 2026-07-12 — The instrument's missing dragon: a world-model consumer the rework exposed [HARVESTED — 2026-07-12]
- What happened: the relic rework Seal-gated all four restores; the first sim run capped EVERY
  seed at 48h with exactly 4 wants left. sim_economy's world had never spawned the dragon — the
  Seal had NO source in the instrument, so the new endgame was unmeasurable (the "-100%" verdict
  was an artifact of incomplete runs, not a regression).
- Root cause: the same class as the Greg-chip bug, one layer up — a reform changed what a
  currency GATES, and a consumer of the old world-model (here the instrument's world itself,
  there the message layer) was never re-audited. VIP visits were "flavor + a drop" when the sim
  was written; the rework made them load-bearing.
- Verification gap: nothing asks "does the instrument's world contain every faucet the wants
  now depend on?" The cap-hit report caught it loudly (the non-zero exit did its job).
- Plug: the sim now models the daily inspection through the REAL inspectionGrade + slope on the
  seeded die, plus the reserve rule and restore-aware expedition targeting (a goal-visible
  player hoards); horizon 48h→168h to contain the designed 4-day arc. Rule to encode: when a
  pass changes what a resource GATES, sweep every world-model and message-layer consumer of
  that resource — the code guards were all correct both times; the MODELS lagged.
- Route: GI candidate (sibling of the steady-state-messenger entry; possibly one merged rule).

## 2026-07-12 — The fixture that guessed at fullness instead of deriving it [HARVESTED — 2026-07-12]
- What happened: §69's mid-slope Seal test hand-picked dice (0.45/0.99) against an ASSUMED
  half-stock fullness; the real inspectionGrade math over the fixture landed below the guessed
  chance and the test failed green code. Same session, second instance: a renderForge
  str_replace anchor included an invented else-branch line and missed.
- Root cause: expectations authored from a mental model of the computation instead of from the
  computation. The suite's own doctrine (rule tests derive from live registries) already covers
  registry DATA; this extends it to derived MATH.
- Plug: the test now computes fullness via the exported inspectionGrade on its own fixture and
  forces dice at chance ±0.01 — the expectation derives from the same function the game runs,
  plus a guard-the-guard that the fixture actually sits mid-slope. Rule to encode: a forced-dice
  test derives its threshold from the live formula over its own fixture, never from arithmetic
  done in the author's head.
- Route: skill reference (test-doctrine section — "derive from live registries" extended to
  derived math).

## 2026-07-12 — The progress probe that matched itself: pgrep -f found the poller [HARVESTED — 2026-07-12]
- What happened: while waiting on the post-F1a acceptance sim, progress polling used
  `pgrep -f sim_economy` — which matched the polling shell's OWN command line. "Still running"
  was self-detection; ~20+ minutes were spent polling a process that was already dead, and the
  session read the silence as a game-side hang (the "terminal bug loop" that killed it).
- Root cause: a substring process probe carries its own search term. The probe asserted the
  MECHANISM ("a process matching this name exists") instead of the EFFECT (the sim's output
  file growing).
- Verification gap: nothing distinguished "sim alive" from "poller alive." The false positive
  was structural — the probe could not fail while the poller ran.
- Plug: poll the ARTIFACT — output-file growth/mtime — or use exact-match (`pgrep -x`); never a
  substring the poller itself carries. Same family as the false-green behavioral-probe law:
  a probe that can pass without the observed effect certifies nothing.
- Route: dev-method (probe-the-effect corollary; false-green family).

## 2026-07-12 — Know the execution ceiling BEFORE launching a long job [HARVESTED — 2026-07-12]
- What happened: the post-F1a acceptance sim was launched inside ordinary tool calls. It
  structurally could not finish there: foreground calls cap ~600s, background nohup processes
  do not survive tool-call boundaries, and F1a's intended slower progression pushes exp-blind
  control seeds to the 168h cap each. Two chained/solo attempts died silently at step 6
  (~9.6KB of an expected ~20KB output); the session burned itself against a ceiling it never
  measured.
- Root cause: no runtime-vs-ceiling budget existed at launch. The pre-F1a full sim's 10-15min
  was already over the foreground ceiling — a warning that was never read as one.
- Verification gap: a long-running certification had no launch precondition ("fits inside one
  execution window, or has a decided splitting/detachment strategy").
- Plug: before launching any long job, state the budget — measured (or estimated) runtime vs.
  the known ceiling — and if it doesn't fit, decide the strategy FIRST (options round if
  non-obvious). A certification that cannot finish inside one tool call is an infrastructure
  design problem, not a thing to retry.
- Route: dev-method.

## 2026-07-12 — `cd X && nohup A & nohup B &` runs B from the ORIGINAL directory [HARVESTED — 2026-07-12]
- What happened: the parallel recovery attempt launched two sims with
  `cd X && nohup A & nohup B &`. Operator precedence parses this as `(cd X && nohup A) &` then
  `nohup B &` — B launched from the original cwd (`/`) and died at launch with module-not-found.
- Root cause: `&&` binds tighter than `&`; the `cd` scopes only the first chain. A process
  launch is an edit with a landing zone, and its landing zone is its cwd.
- Verification gap: the launch reported nothing; death was discovered late, tangled with the
  OOM kills of the runs that DID start.
- Plug: every background launch states its own cwd (absolute paths, or a `cd` inside each
  subshell: `(cd X && nohup A &)`) and verifies its process/artifact exists immediately after
  launch — the landing-zone law applied to process launches.
- Route: dev-method (landing-zone family, process launches).

## 2026-07-12 — Parallel heavy Node sims OOM the 4GB container
- What happened: the two parallel sim runs that did launch were OOM-killed at ~1.5-2GB each on
  the 4GB container — a third simultaneous failure mode in the same recovery attempt.
- Root cause: sim_economy's per-run footprint × parallelism exceeds container memory. The
  parallel "speedup" was never viable here.
- Verification gap: none new — the ceiling lesson above covers the missing budget; this pins
  the measured number.
- Plug: sequential sim runs are POLICY for this project's harness; treat ~2GB as one run's
  working footprint when sizing anything.
- Route: project-only (harness policy).

## 2026-07-12 — Deliver-before-certify: an uncommitted green pass is one dead session from gone [HARVESTED — 2026-07-12]
- What happened: F1a was finished and twice suite-green (1667/0) in the container, but was held
  uncommitted pending the acceptance sim — a certification that structurally could not run (the
  ceiling entry above). The session died mid-poll and the pass died with the container; it
  survived ONLY because the delivery zip had been packaged mid-poll and Daniel retrieved it
  from the dead chat.
- Root cause: certification was treated as a gate on DELIVERY, when it was only ever a gate on
  the acceptance VERDICT. The two have different failure costs: a deferred verdict costs
  nothing; an undelivered pass costs the pass.
- Verification gap: none mechanical — a process-ordering error. The recovery session inverted
  it deliberately: commit suite-green first ("harness cert pending" in the message), certify as
  its own follow-up.
- Plug: when certification is long-running and the session is deep, commit/deliver the
  suite-green pass FIRST, recording the pending certification in the commit message and
  handoff. Same shape as "versioned deliverables get a committed home."
- Route: GI candidate.
## 2026-07-13 — A passing acceptance metric can be passing for the WRONG reason (the F2 dial inversion) [HARVESTED — 2026-07-13]
- What happened: pre-F2, the market-blind control PASSED at +48% — a healthy-looking margin
  that certified the trade market as valuable. F2 (demand honesty) shipped its first-cut dials
  (0.4/0.15), and the SAME control flipped to −20% (the blind bot now ran hotter). The +48% had
  never been trade-margin value; it was mostly the mispriced-scarcity TAX falling on
  non-participants (the blind bot's impossible trade asks were dead weight in ITS queue). F2
  removed the defect and revealed the market's honest margin was only +12%.
- Root cause: the acceptance metric (aware-vs-blind rate advantage) measured a DIFFERENCE, and
  a difference can be inflated by a penalty on the control just as easily as by value in the
  treatment. Nothing distinguished "the market is worth +48%" from "ignoring the market is
  taxed −36% by an unrelated defect."
- Why it mattered: had F2 shipped as-measured (its own acceptance was met), main would have
  held an economy where ignoring the market WON, silently, because the number that used to
  justify the market was measuring the defect F2 was removing.
- Plug/principle: when softening or fixing a system moves a DIFFERENTIAL acceptance metric,
  suspect the old value was partly the defect the fix removes — check the ABSOLUTE behavior of
  both arms (here: the blind bot's post-death rate rose), not just the gap. A margin that only
  exists because the control is penalized is not the treatment's value. Corollary to the
  probe-the-effect family: measure what each arm actually does, not only how far apart they are.
- Route: dev-method (acceptance-metric design; probe-the-effect family).

## 2026-07-13 — The crux check came after the recommendation: "are you sure?" must be self-administered [HARVESTED — 2026-07-15]
- What happened: the B1 acceptance analysis recommended A (decouple F2) with the margin
  recovery as primary evidence. That evidence had one load-bearing assumption — that the
  coupled↔decoupled margin gap reflected real customer behavior, not a sim-bot artifact. If
  the bot's restocking had been F2-demand-driven, the whole signal would have been the bot
  chasing its own tail, and A would have been "flip a delegated design decision to fix a
  number that doesn't map to real play." The check was two file reads of the bot's stocking
  logic, available the entire time. It ran only after Daniel asked "are you sure?" — the
  recommendation's own words concede it: "I was leaning on the margin recovery without
  having checked what produces it." (The check came back favorable — bot stocks
  demand-blind — but that's luck relative to process.)
- Root cause: evidence-gathering was ordered by narrative momentum, not by "what single
  fact, if wrong, invalidates this recommendation?" Hours of sim spend ran freely while the
  cheap decisive read sat unread. Confidence was expressed before it was earned, then
  repaired under challenge.
- Why it mattered: a "go" on the unchecked recommendation would have spent the one-line
  change + suite + 3× determinism cert on an unverified assumption — and if the check had
  failed, a delegated decision would have been flipped on a bot artifact. Only Daniel's
  manual challenge inserted the verification step the process should own.
- Plug/principle: before any ship-gating recommendation, NAME the crux assumption it rests
  on; if that assumption is cheaply checkable (a file read, a grep, a one-liner), check it
  BEFORE recommending, not after a challenge. The mechanical tell: if "are you sure?" would
  send you to read code you haven't read yet, that read belongs before the recommendation.
  Distinct from verify-don't-assume (facts about current state) and from the differential-
  metric rule (interpreting a number): this governs the ORDERING of verification relative
  to expressed confidence.
- Route: general instructions candidate (sibling of verify-don't-assume). One occurrence —
  starts here per the promotion bar.

## 2026-07-14 — Documented "setsid survives the tool-call boundary" was false here; the working detach is subshell-wrapped [HARVESTED — 2026-07-15]
- What happened: the B1 3× sim certification needed long-running (~6 min/run) detached processes
  that outlive a single tool call. The recorded pattern — plain `setsid … &` — did NOT survive:
  the backgrounded job either never launched (setsid misbehaves when the caller is already a
  process-group leader under dash's `&`) or was reaped when the tool call returned. `nohup … &`
  launched but died at the boundary too (SIGTERM to the process group, not just SIGHUP). Several
  tool calls were spent rediscovering this before a heartbeat probe pinned down what persists.
- Root cause: the container's default shell is `/bin/sh` (dash — no `disown`), and the tool tears
  down the invocation's process group/session on return. Only a process reparented to init in a
  NEW session survives, and getting there under dash needs the fork forced.
- What actually works (verified by a cross-boundary heartbeat): `( setsid bash script.sh & )` —
  the subshell exits immediately, orphaning the setsid child to init in its own session; the loop
  body lives in a SCRIPT FILE (create → run → poll a sentinel file), never inline (multi-line
  inline bodies also failed to launch). Poll an artifact (output-file mtime / a `*_done.txt`
  sentinel + per-run sha), never a process name. `/usr/bin/time` is absent (127) — time with epoch
  deltas. Sequential runs only (parallel node OOMs the 4GB box). A single full sim run also exceeds
  the tool-call ceiling (~290s), so detachment is mandatory, not optional.
- Why it mattered: without the working pattern there is no way to run the 3× bit-identical
  certification the economy doctrine requires — the whole ship gate depends on it.
- Plug/principle: detach with `( setsid bash <scriptfile> & )` and artifact-poll a sentinel; treat
  "a backgrounded job survives the boundary" as something to PROVE with a heartbeat in the current
  container, not assume from a prior session's note.
- Route: dev-method skill (the sim-run / long-job section) — supersedes the "setsid detached
  survives" note carried in the handoff.

## 2026-07-14 — The acceptance sim measures a feature's COST but is blind to a "prevent-a-bad-outcome" BENEFIT [HARVESTED — 2026-07-15]
- What happened: B1 (hard reserve) exists to stop walk-ins draining a pending order's units before
  it's fulfilled. Every sim number for B1 measured only its cost (sellable capacity removed): fills
  were 5-vs-5 with and without the reserve, and turning the reserve on could only ever LOWER the
  aware-vs-blind margins. The greedy bot fulfills an order the instant it can, so it never
  experiences the drain B1 prevents — the benefit is structurally invisible to the harness.
- Root cause: the acceptance instrument measures CHANNEL value (does using trade / expeditions /
  commissions beat ignoring them?) via post-exhaustion rate advantage. A feature whose worth is
  "prevents a bad outcome the optimal greedy bot never triggers" has no channel to show up in — the
  metric and the feature's purpose are orthogonal.
- Why it mattered: read naively, the sim said B1 was a pure margin loss and nearly argued against a
  fix for a real, player-visible bug. The correct reading was "the harness can't see the benefit,"
  which reframes the decision as a judgment call plus a cost-minimization (couple vs decouple), not
  a pass/fail.
- Plug/principle: before treating a sim margin move as a verdict, ask whether the harness can even
  MEASURE the feature's purpose. For "prevents X" features the greedy bot may never trigger X, so a
  margin dip is cost-only, not net harm — accept it on judgment, or build a sim mode that actually
  induces X (here: bot stocks toward an order, walk-ins eat it before the deadline, measure
  fulfillment success with/without the reserve). Sibling of the idle-honest / instrument-scope
  awareness, applied to the acceptance metric.
- Route: dev-method (acceptance-metric design — what the instrument can and cannot measure).

## 2026-07-14 — A comment at a live seam is a CLAIM with an expiry date; adding a dial is what expires it [HARVESTED — 2026-07-15]
- What happened: Doug's training ladder gave the scavenge role its first speed dial. Two comments
  that were TRUE when written became false the instant it landed. (1) `scene.js`: "scavenge has no
  speed perks (scoped in game.js) — this IS the clock", sitting above
  `const interval = WORKERS.scavenger?.baseInterval ?? 24`. (2) `game.js` `isDougOut`: "the ~12s
  gone window dwarfs that, so a boundary straddle is rare and harmless." I rewired
  `effectiveWorkerInterval` and missed both. The renderer kept dividing a 24s clock while the timer
  ran on 10.67s, so `elapsed = 24 - timer` could never fall below 13.33 — stranding the idle and
  out-leg phases at EVERY timer value. Doug walked home from the portal, popped, and re-emerged
  from the door with no idle beat. Daniel's browser found it in minutes.
- Root cause: `baseInterval` was hardcoded as "Doug's clock" in three places. That was CORRECT
  under the old world and the comments documented WHY it was correct — which made them read as
  reassurance rather than as a dependency on an assumption I was in the act of breaking. A comment
  explaining why something is safe is a load-bearing claim about the world; a new dial silently
  retires it and nothing fails.
- Why it mattered: the suite passed **24/24** through all of it. §77 asserted the interval MATH
  (L0 24s → L10 6.86s, leak guards, cost ladder) and never asked whether Doug is ever visibly
  standing still. A green suite certified a visibly broken feature. The SECOND falsified comment
  was found only because the first taught me to go looking — otherwise it would have shipped too.
- Plug/principle: **when a pass introduces a dial, grep every comment that reasons about the value
  that dial now moves** — the comments that assert safety are exactly the ones that just became
  false. Fix shipped: `scavengeClock(state)` in the LEAF (`src/data/workers.js`, so the renderer
  reads it without importing game.js) is the single source of truth for all three consumers.
  Guard shipped: suite §78, including a SOURCE pin (§0b precedent) — pins (a)-(f) prove the helper
  is correct, only (g) proves the renderer actually CALLS it. Negative control verified: restoring
  the hardcode drops the suite to 1795/2.
- Route: dev-method (introducing a dial = a comment-sweep obligation at every site that reads the
  old value).

## 2026-07-14 — "Test the effect, not the mechanism" was already my standing rule and still didn't fire, because the effect wasn't headlessly testable [HARVESTED — 2026-07-15]
- What happened: the rule ("a behavioral probe asserts the EFFECT the user sees — never the
  internal mechanism that should produce it") is already harvested into the general instructions,
  and I broke it anyway on the Doug pass. §77's 24 pins all asserted mechanism.
- Root cause: the rule's worked examples are DOM-shaped (computed `display` vs
  `classList.contains('hidden')`), where the effect IS reachable from the test. Doug's effect is
  "a human sees him stand still" — the suite is headless and CANNOT draw him. Facing an untestable
  effect, I silently fell back to testing the mechanism and read the green as coverage. The gap
  never announced itself: no failing pin, no missing assertion, just 24 green ones aimed one layer
  too low.
- Why it mattered: this is the failure the rule exists to prevent, and having the rule was not
  enough. The rule assumed the effect is always reachable; when it isn't, the fallback is invisible
  and feels like compliance.
- Plug/principle: **when the effect genuinely cannot be asserted in the test runtime, that absence
  is itself a finding — say so out loud and pin the next-best contract, don't quietly test the
  mechanism and call it covered.** For a cross-file contract a headless suite can't execute, the
  next-best pin is a SOURCE scan (does the consumer actually call the shared helper?) plus an
  explicit "not verified: browser/rendered behaviour" line in the delivery. Both shipped here.
- Route: general instructions (refines the existing effect-vs-mechanism rule with the
  effect-unreachable case).

## 2026-07-14 — A reduction that coerces "no measurement" into a number turns a verdict into a coin flip [HARVESTED — 2026-07-15]
- What happened: every acceptance arm in `sim_economy.mjs` reduced to
  `median(blind.map((b) => (a.postRate ?? 0) / Math.max(1, b.postRate ?? 0) - 1))` over
  `SEEDS.slice(0, 3)`. A run that never dies has NO postRate (null by design). `?? 0` and
  `Math.max(1, …)` silently converted that ABSENCE into a value: a blind cap-hit became ≈ +47800%,
  an aware cap-hit −100%. With n=3 and a sentinel always sorting to one end, the "median" was
  simply THE LARGER OF THE TWO REAL VALUES.
- Root cause: null-safety idioms (`?? 0`, `Math.max(1, x)`) applied to a divisor whose null means
  "this run has no measurement", not "this run measured zero". They exist to prevent a crash and
  did so — by fabricating data.
- Why it mattered: it ranked a build that beat its control **2-of-2** BELOW one that beat it
  **1-of-2**, handing the Doug pass a WEAK it hadn't earned and nearly buying a needless retune of
  a correct feature. It had been the arc's decision-maker for every economy pass, so every recorded
  margin (15/26/10.8 and all their predecessors) is VOID as a comparison. Worse, the instrument
  reported a bare median with no spread and no win count, so a coin flip and a solid result printed
  identically — there was no surface on which to notice.
- Plug/principle: **a reduction over possibly-absent measurements must COUNT the absences, never
  coerce them** — an absent outcome is a different KIND of result and belongs in its own
  categorical line. And **a verdict must report its own power** (n, spread, wins), or a marginal
  number reads as authority. Fix shipped (2784bec): `acceptanceStats` filters to comparable pairs
  using the sim's OWN existing convention (its death block already did
  `runs.filter((r) => r.deathT !== null)` before medianing — the acceptance blocks simply never
  adopted it), blind arms widened to all 5 seeds, and an `EVIDENCE:` line prints median + spread +
  wins + cap-hit counts. Verified by replaying both historical datasets through the repaired
  reduction before trusting it.
- Route: dev-method (acceptance-metric design — absent outcomes are categorical, and a verdict
  reports its power).

## 2026-07-14 — A cosmetic change shifted the seeded PRNG stream and voided every sim number [HARVESTED — 2026-07-15]
- What happened: the `scavengeClock` fix changed `isDougOut`'s truth pattern (out 48% → 21% of a
  cycle). `isDougOut` only gates which battle-cameo LINES are eligible — pure flavour text, zero
  economy. But `logLine` has an anti-repeat re-draw (`messages.js:43-45`) that fires CONDITIONALLY
  on pool contents: `if (pool.length > 1 && choice.text === lastPicked.get(key)) choice = pick(…)`.
  So changing the pool changes whether a SECOND `pick()` happens, which changes the number of RNG
  draws, which re-aligns the entire seeded stream downstream.
- Root cause: determinism depends on the DRAW COUNT, not on whether the drawn value matters. Any
  branch that conditionally consumes randomness makes every seemingly-inert change upstream of it
  a potential trajectory change.
- Why it mattered: caught before it misled anyone, but only just — the pre-fix Doug margins
  (+8%/+29%/+3.1%) were already quoted to Daniel and were rendered meaningless by a comment-and-
  clock fix that cannot affect the economy on paper. Post-fix the same build measured
  +26.5%/+46.9%/+22.3%.
- Plug/principle: **any change touching a conditionally-drawn random path voids prior sim numbers**,
  even when it provably cannot affect the economy. Before quoting a margin as a comparison, ask
  whether anything since has moved the draw count. Retro-fitting: conditional re-draws are a
  determinism hazard worth knowing about wherever seeded reproducibility is the certification
  mechanism.
- Route: dev-method (seeded-sim determinism — draw count, not draw value, is the invariant).

## 2026-07-14 — `git fetch` without a merge left local HEAD stale, and `git status` then reported committed work as uncommitted [HARVESTED — 2026-07-15]
- What happened: mid-session I fetched to inspect Daniel's pushed tip (`git log origin/HEAD`) and
  confirmed my working tree matched it (`git diff origin/HEAD --stat` → empty). But I never
  fast-forwarded, so my local branch pointer stayed one commit behind. Two passes later
  `git status` showed `M sim_economy.mjs` — work that was already pushed. Had I run a checkpoint on
  that reading, it would have re-committed an already-committed file.
- Root cause: `git status` compares the working tree to LOCAL HEAD, while `git diff origin/HEAD`
  compares it to the REMOTE. Both were accurate; they answer different questions. A fetch updates
  the remote-tracking ref only — it moves nothing local, so the "I'm synced" feeling from reading
  `git log origin/HEAD` is about the remote, not about me.
- Why it mattered: caught by the standing rule that `git status` is a READ, not a ritual — the
  unexpected file was the tell. The existing instruction ("after any pull, `git log -1` must show
  the expected remote tip") covers pull; the trap here is fetch-WITHOUT-pull, which feels like
  syncing and isn't.
- Plug/principle: **after inspecting a remote with fetch, either fast-forward or state explicitly
  that local HEAD is behind** — and treat any `git status` disagreement with a known-pushed commit
  as a stale-pointer hypothesis FIRST, before concluding work is uncommitted. Recovery used here:
  back up the working files, `git reset --hard origin/HEAD`, verify by diff that nothing was lost,
  restore the in-progress file.
- Route: general instructions (git workflow — fetch is not sync).


## 2026-07-15 — A CSS layout budget is a claim with an expiry date, and nothing headless can measure the thing it claims [HARVESTED — 2026-07-15]
- What happened: Daniel's Scrap chip sat under the Menu button. `style.css` carried a careful,
  explicitly re-measured LAYOUT BUDGET above `.hud` (dated 2026-07-10) reasoning about the
  wall-shelf on the left and about vertical separation from the market chip. It was ACCURATE when
  written — I re-measured its claim and got ~757px against its stated "~770px at endgame". F1a
  landed **two days later** and widened the Rep chip by ~213px: the badge gained "· Lv N", and
  `#hud-next` went from rendering `''` past the last rung (`nextTierInfo` returned null) to being
  ALWAYS populated, because the level curve is infinite. Nothing failed. The budget kept sitting
  there reading like a guarantee for three days while the row it described no longer existed.
- Root cause / the generalisation: the 2026-07-14 lesson said "adding a DIAL is what expires it."
  Too narrow. F1a added no dial — it changed **text**, and text has width. The rule is: a comment
  that reasons about a VALUE is expired by any change to that value, whatever shape the change
  wears. The same comment carried two more dead claims nobody noticed: "the market chip docks at
  top:68" (that chip was retired at 18be9de — the only surviving mention of `top:68` in the whole
  codebase was the comment itself) and "chips own y16..62" (they wrapped to y16..74 whenever the
  row overflowed). A second `.hud` comment claimed "two chips ... centered"; both halves had been
  false since 2026-07-10.
- The CSS-specific twist — why this class is worse than the Doug one: **nothing headless measures
  geometry.** `node --check` parses, the module import binds, the suite reads source text — none of
  them can tell you a flex row is 1013px wide in an 796px band. The Doug bug at least had a
  testable helper underneath. A CSS budget's only true verifier is a browser, so a stale one can
  outlive every gate the project owns indefinitely. It did.
- Second fault, independent and older: `.hud` and `#menu-btn` were BOTH anchored `right:16px`. The
  band ran to the button's own right edge; the button (z6 over the HUD's z5) simply painted over
  whatever reached it. The budget reasoned carefully about the shelf to its left and the dock below
  and never mentioned its immediate right-hand NEIGHBOUR. Latent and harmless while the row was
  short — the 2026-07-10 pass added the Scrap chip and moved the row within ~40px of it.
- Third fault: the budget said "redesign, don't shrink" but the CSS never set `flex-shrink:0`, so
  flex shrank anyway — chips squeezed and their text wrapped (45px → 58px tall) instead of failing
  visibly. A law asserted in prose and unimplemented in code is not a law.
- Plug shipped: measured the real thing in a real browser (Playwright + Chromium, viewport pinned
  to 1280×720 so `resize()` computes scale 1 and every rect is stage-local). Band reserved
  (`right:104px` = 16 margin + ~72 button + 16 breath), `flex-shrink:0` added, budget re-authored
  with MEASURED per-face numbers and its dead clauses retired. Guard = suite §79: the reservation
  is pinned as an ORDERING law (`.hud` right > `.menu-btn` right by ≥ the button's width) — the
  only part of a layout expressible headlessly. Negative control verified: reverting the
  reservation drops the suite to 1823/2, removing `flex-shrink:0` to 1824/1.
- Route: dev-method (generalise the expiry rule from "a dial" to "any change to a reasoned-about
  value") + skill reference (html-game.md): a fixed-position bar's budget must name every NEIGHBOUR
  in its band, not just its own extents, and must be re-measured in a browser whenever any string
  it contains changes.

## 2026-07-15 — A source-text pin is satisfied by a COMMENT, so it sailed green through the change that invalidated it [HARVESTED — 2026-07-15]
- What happened: §72(f) pinned `hud.includes('fameLevel') && hud.includes('nextLevelInfo')` with
  the message "the HUD badge + remainder ride the level track". I removed the `nextLevelInfo`
  import from `hud.js` and moved the remainder to `panels.js`. **The suite stayed 1797/0.** The pin
  passed because the comment I wrote explaining the move contains the string `nextLevelInfo`. Had I
  written that comment slightly differently it would have failed — the pin's verdict depended on my
  prose, not on the code.
- It happened twice in one pass. My own new §79 pin `!/the market chip docks at top:68/` failed
  immediately — because the re-authored budget comment QUOTED the dead claim while retiring it. The
  pin was right; the file was right; the collision was between a text matcher and documentation
  that legitimately mentions what it documents.
- Root cause: `includes('symbol')` asserts "this string appears somewhere in this file", but it was
  written to mean "this module USES this symbol." Those diverge the moment anyone writes prose. The
  §0b and §78 source pins work because they match STRUCTURE (`getSprite('…')` call shape,
  `scavengeClock(state)` call shape); a bare symbol name matches everything, including the note
  explaining why the symbol is gone.
- Why it mattered: this is the false-green shape the project already knows in a new costume — a
  probe that cannot fail certifies nothing. Worse than the Doug case, because it doesn't merely
  fail to notice a regression: it actively vouches for the opposite of the truth, and the more
  carefully you document a removal the more firmly the pin insists it didn't happen.
- Plug shipped: §72(f) refined (not softened) to what it always MEANT — the level track reaches the
  player, badge in the HUD and remainder in the Fame panel — and re-expressed against the parsed
  IMPORT LIST rather than raw file text, with a guard-the-guard assertion that the scanner found
  both import lists at all. Comment reworded so it describes the retired claim without restating
  it verbatim.
- Route: dev-method (a source pin must match a STRUCTURE — an import list, a call shape — never a
  bare symbol name, because comments are text too; and when a pass makes a source pin's subject
  vanish, check that the pin actually FAILS before believing the green).

## 2026-07-15 — A pixel measurement is only valid in the font it was taken in; I nearly shipped a fix sized for the wrong face [HARVESTED — 2026-07-15]
- What happened: I measured the HUD in the container's browser and built a whole analysis on it —
  worst-case row 1013.73px, "no single cut is sufficient", a recommendation bundling compact
  numbers AND a padding trim AND the remainder's removal. All of it was measured in **DejaVu Sans**.
  The shipped stack is `'Segoe UI', system-ui, -apple-system, sans-serif`; Segoe UI is a *Windows*
  font and cannot be installed here, so every number came from the fallback. Daniel's screenshot
  calibrated it: Segoe UI is ~22% narrower on text. His cut ALONE clears the worst case by ~93px.
  My "necessary" extra surgery was necessary only in a font no player of his has.
- What saved it: the screenshot was the artifact. Its un-wrapped badge sat at max-content width
  (shrink-free), giving a clean ratio — Segoe 128.0px vs DejaVu 164.53px. Projecting by
  DECOMPOSITION (fixed padding/borders/gaps don't scale with the face; only text does) and
  validating against the one chip fully visible in his shot came out 1.6% off. Reproducing his
  exact state also confirmed a dual-track inference: his `lifetimeRep` is 55740 against a spendable
  52002, which is why my first control "failed" — I'd guessed his cropped-out gold chip.
- Second trap in the same pass: **the worst case of a composite string is not at the maximum of any
  single input.** I assumed endgame (7-digit gold, Mythic) was widest. It isn't — "Renowned · Lv 16
  · 17293♛ to Legendary" is 44px wider than "Mythic · Lv 23", because the longest RUNG NAME and the
  rung-naming remainder co-occur mid-ladder. A fix verified only at endgame ships and still
  collides. Sweep every rung from the live curve; never spot-check the extreme.
- Root cause: "the artifact wins" is a rule about FILES, and I applied it to files. It's really a
  rule about the ENVIRONMENT: a measurement inherits every assumption of the machine that took it,
  and a container is not a player's browser. Font is the sharpest case because CSS names fonts it
  cannot guarantee.
- Plug shipped: measured the fixed build across every installed face and recorded the table in the
  budget comment. Result: Segoe ~687 (+93), Noto ~718 (+62), FreeSans ~737 (+43), Liberation ~742
  (+38), Poppins ~755 (+25) — and DejaVu ~817 (−37), the one face that does NOT fit. Accepted as a
  documented KNOWN LIMIT: DejaVu only resolves when both 'Segoe UI' and system-ui miss, and the
  parked compact-numbers follow-up (~75px) closes it.
- Route: dev-method (a rendered-geometry measurement must name the face it was taken in; where the
  real font can't be installed, calibrate off a user artifact and project by decomposition, then
  measure across every available face and report the SPREAD rather than a single number) + skill
  reference (html-game.md): a CSS font stack naming a platform font means the layout has as many
  worst cases as it has target platforms.

## 2026-07-15 — "A new tab is nearly free" was true about the WIRING and false about the LAYOUT, and I nearly built on it [HARVESTED — 2026-07-15]
- What happened: the handoff's NEXT block framed the Bestiary/Expedition split's open question as
  "does the lore Bestiary become a sixth nav tab (`nav.js` TABS + `PANEL_FOR` are a two-line
  registry — **a new tab is nearly free**) or a sub-view". That parenthetical is accurate: adding a
  tab IS two lines. I presented an options round on top of it and Daniel picked the option that
  needs the tab. Only when I went to build did I check the bottom bar — where `style.css` and
  LESSONS 2026-07-04 both carry a binding law: **"panel ends 454, 5-tab nav reaches ~470-480, a 6th
  tab does NOT fit — redesign, don't shrink."** Measured it again: 5 tabs leave 17.2px of slack in
  the widest face, and a 6th overlaps the customer panel at every label I tried; even in Segoe UI
  only a ≤4-character label fits. The option I recommended was unbuildable as specified.
- Root cause: the claim was TRUE in the dimension it was written about (registry wiring) and FALSE
  in the dimension I was about to use it in (layout). That's a distinct failure from a stale
  comment — nothing expired, nothing was wrong. A cost estimate silently carries the axis it was
  measured on, and "free" always means "free in some currency". Two lines of JS; ~90px of bar.
- Why it mattered: it survived a whole options round. I wrote the options, recommended one, and
  Daniel picked — all downstream of a cost claim I never priced on the axis that governs. The
  saving grace was accidental: this same session had just spent itself on a top-bar overlap, so
  "fixed-position bar" was primed. Without that I'd have added the tab and Daniel's browser would
  have caught it — the nav sitting on the Serve button.
- Plug/principle: **when a handoff or design doc calls something cheap, ask "cheap in what?" and
  price it on every axis the change actually touches** — wiring, layout, save shape, suite. For UI
  specifically, any change that adds or renames a thing in a fixed-position bar is a LAYOUT change
  first and a registry change second. Shipped: the split went vertical (sub-views inside the Mobs
  tab) instead of horizontal; the 6th-tab law is now encoded in suite §80 as a tab COUNT pin, so it
  fails in CI instead of in a browser; and `nav.js` says out loud that labels are load-bearing.
  Negative control: adding a 6th tab drops the suite to 1843/1.
- Route: dev-method (a cost claim inherits the axis it was measured on; re-price it on the axis
  your change touches — and a claim in a handoff is a claim, subject to the same artifact-wins rule
  as a comment).

## 2026-07-15 — Splitting one card set into two turned every singular DOM lookup into a coin flip [HARVESTED — 2026-07-15]
- What happened: the split gives each monster a card in BOTH sub-views (a job card and a field-guide
  card). The existing render loop opened with
  `const card = document.querySelector('.beast-card[data-beast="${id}"]')` — singular. It had been
  correct for as long as there was exactly one card per monster. The instant there were two, it
  silently bound to whichever came first in the DOM and the Field Guide's cards would have kept
  their `undiscovered` silhouette forever, `???` and blacked-out, no matter how many you served.
- Why it would have shipped: nothing errors. `querySelector` returns a real element; the class
  toggles; the suite is headless and cannot draw a panel. The bug is invisible until you serve a
  monster, switch to the Field Guide, and notice the portrait is still a black cutout — which on a
  fresh save is indistinguishable from correct behaviour, because nothing IS discovered yet.
- Root cause: duplicating a DOM element set silently invalidates every `getElementById` /
  `querySelector` written against it. `getElementById` is worse than `querySelector` here: two
  cards wanting `beast-name-slime` is invalid HTML that no tool complains about, and the second one
  just never updates. The signature is a lookup whose CORRECTNESS depended on a uniqueness
  assumption that the pass itself is in the act of removing — the same shape as the Doug clock
  (a hardcode that was correct until the pass added a dial).
- Plug shipped: the loop walks `querySelectorAll` and toggles every card; ids are view-prefixed
  (`job-name-*` vs `beast-name-*`) so uniqueness is restored rather than papered over; the name
  write walks both ids explicitly. Guard: §80(e) pins the plural form AND pins that the singular
  lookup is gone — the second half matters, because the plural form can be added while a stray
  singular survives elsewhere. Negative control: reverting to `querySelector` drops the suite to
  1842/2.
- Route: dev-method (when a pass makes a DOM element set non-unique, grep every lookup against that
  set BEFORE writing the new markup — `getElementById` on a duplicated id fails silently and is
  invisible to every headless gate).

## 2026-07-15 — The `git status` READ scans for deletions; a stray 0-byte file walked straight past it [HARVESTED — 2026-07-15]
- What happened: the HUD-band checkpoint went out, Daniel ran it, and the remote came back with TWO
  commits: the real pass (8 files, correct) and a second one adding a **0-byte file literally named
  `1825`** at the repo root — the suite's pass count, almost certainly a stray `> 1825` redirect
  while checking the total. `git add .` staged it faithfully. It pushed.
- Root cause: the doctrine's `git status` READ exists because `git add .` will happily stage a
  **deletion** that's already in the working tree — a 417-line doc vanished that way once, and the
  rule has been "scan for `deleted:` lines" ever since. That's one half of the surface. The mirror
  case is an unexpected **addition**, and the READ as practiced doesn't look for it: nothing about a
  new file at the root reads as alarming in a status list you're scanning for the word "deleted".
  Harmless here (empty, unreferenced), but the same blind spot passes a stray key file, a scratch
  dump, or a `.env`.
- What actually caught it: not the READ — the checkpoint block's expected-files comment. The block
  said "8 files, 0 deletions"; the remote had 9. The comment exists because a file that was never
  touched doesn't appear in `git status` at all, so the READ needs an expectation to diff against.
  It turned out to catch the opposite failure too: an expectation is symmetric, and a scan is not.
- Plug/principle: **the `git status` READ is a two-sided diff against the expected file list, not a
  keyword hunt for `deleted:`.** Unexpected ADDED paths stop the checkpoint exactly as unexpected
  deletions do. The expected-files comment is what makes both visible; it stays mandatory, and it
  should be read as a set, not a count.
- Route: dev-method (extend the git-status READ rule: scan for unexpected additions as well as
  deletions; the expected-files comment is the diff target for both directions).

## 2026-07-15 — I wrote a 30-line commit body into a repo whose every commit has a zero-line body [HARVESTED — 2026-07-15]
- What happened: Daniel: "that git commit is way too long — why did you make it that long?" He'd
  already shortened it himself. I'd handed him a multi-paragraph body: the diagnosis, the
  measurements, the negative controls, the known limit.
- Root cause, two layers. (1) I wrote the commit as a record of the INVESTIGATION rather than of the
  CHANGE — and the investigation had been long, so the message was long. (2) Worse, it was
  REDUNDANT: every fact in it was already written in three artifacts I had just delivered — the
  re-authored budget comment (the measurements), LESSONS.md (the lessons), §79's header (the
  diagnosis). The commit was a fourth copy. Length was the symptom; duplication was the fault.
- The part that stings: `git log` is an ARTIFACT, and the norm was one command away. Twelve of
  twelve prior commits have a zero-line body — single-line subjects, every one. I spent this whole
  session refusing to read a value from memory when a file could tell me, re-measuring a CSS budget
  rather than trusting its comment, and re-reading every landing zone before editing it. Then I
  wrote to the commit log without once looking at the commit log.
- Plug/principle: **"the artifact wins" covers CONVENTIONS, not just contents.** Before writing into
  any shared surface — commits, PR text, changelogs, docs — read what's already there and match its
  shape. And a commit message records the CHANGE; if the reasoning is worth more than a line, it
  belongs in a comment at the seam or in LESSONS, where it will actually be found. If it's already
  in both, the commit needs a subject and nothing else.
- Route: dev-method (commit messages match the repo's observed norm — check `git log` before
  writing one; the body is for what isn't already recorded at the seam, which is usually nothing).

## 2026-07-15 — A screenshot is a probe with a FRAME, and I twice let one certify what it couldn't see [HARVESTED — 2026-07-15]
- What happened, twice in one session. **First:** I shipped a before/after crop of the `.beast-exp`
  contrast fix and wrote "the fix is visually confirmed." The clip rect framed the door portal; the
  cards were sliced off at the edge and the "7 runs" text was **outside the frame entirely**. Daniel:
  *"the screenshot you sent only showed the door portal."* **Second:** having learned that, I added a
  check — count pixels matching the lore ink before claiming the crop shows anything. It reported
  "269 lore-ink pixels in frame → the taglines ARE in this crop", and I called that verification.
  Daniel looked at the same image and found a pop-up bleeding through the open panel — a real bug,
  which became its own pass (§83).
- Root cause: the image viewer returned blank for me all session, so I never actually SAW either
  shot. Rather than say so, I substituted a proxy and let it stand in for looking. The proxy was
  sound for what it asserted — **ink of colour X exists within rect Y** — and that is simply not the
  claim "this image looks right". Composition, occlusion, and layering are invisible to a histogram.
- The shape it wore: not a false green. Both checks were TRUE. The defect was the inference — a
  narrow true claim carried a wide conclusion, and the wideness lived in my prose, not in the probe.
  The first incident I could have caught by reading my own clip rect; the second I could not have
  caught by any amount of care about the probe, because the probe was answering a different question.
- Why it matters beyond screenshots: this is the project's own standing law arriving from an angle it
  hadn't come from before. "Ask what a green check actually CERTIFIES" has always been about probes
  that pass while the code is broken. This one is about a probe that passes, is correct, and gets
  quoted for a claim it never made. **The verification gap isn't in the assertion — it's in the
  sentence you write after it.**
- Plug/principle: when the artifact is VISUAL and I cannot see it, say so plainly and hand the
  judgment to the person who can — do not narrate a pixel check as if it were an eye. If a screenshot
  is shipped as evidence, state the claim it supports ("these three boxes measured inside the panel")
  and no more. And a clip rect is a landing zone: verify what's in frame BEFORE the frame is the
  evidence.
- Route: dev-method (a screenshot/render probe certifies only the property it measured — presence,
  a colour, a rect — never "it looks right"; when the artifact is visual and Claude cannot see it,
  name that limit rather than proxy around it).

## 2026-07-15 — A defect that depends on CONTEXT cannot be swept by source search, so a correct fix left five instances alive for four days [HARVESTED — 2026-07-15]
- What happened: the `.beast-exp` contrast bug (1.28:1, illegible since 2026-07-11) turned out to
  belong to a class — **a colour authored for the DARK panel palette, reused for text on a PARCHMENT
  card**. A real-browser sweep of all 388 text elements across six views found FIVE more live
  instances: `.beast-next.vip` at **1.01:1** (worse than the reported bug), `.item-sold b` at 1.12,
  `.perk-cost` at 1.50, `.upg-cost` at 1.97, `.item-sold` at 2.62.
- The part that stings: **this class was already found once and fixed once.** On 2026-07-12 Daniel
  QA'd "gold-deep on tan" and `.item-price` moved to `#6b4a1e` — the comment recording his ruling is
  still in `style.css:96`. The fix was correct. The sweep never ran. `.upg-cost` has carried the
  *exact same hex* on the *exact same background* ever since.
- Root cause — and it is the interesting bit: **the defect is not a value, it is a value in a
  context.** `#c99a2e` is correct on the dark panel and fatal on the tan card; grepping the hex finds
  every instance and tells you nothing about which ones are broken. There is no source search that
  can sweep this class, because the fault isn't in the text being searched — it's in the relationship
  between two rules that never appear on the same line. The 2026-07-12 sweep didn't fail; it was
  never possible with the instrument available, and nobody noticed the instrument was wrong for the
  job because the fix worked.
- Verification gap: the standing law ("ship the fix, the sweep, AND the guard") assumes the sweep is
  a matter of diligence. When the class is contextual, the sweep is a matter of INSTRUMENT — here, a
  browser walking every element, resolving the background it actually renders on, and computing the
  ratio. That instrument existed since 2026-07-15 morning and simply wasn't pointed at this.
- Plug shipped: `.beast-exp` fixed; §81 pins the COMPUTED RATIO (never the hex — a hex pin is
  satisfied by the comment above it) and the transplant rule (the card may not borrow a colour that a
  dark-panel rule declares); §82 asserts the same law at BIRTH for the line the very next pass added.
  The five survivors are measured and parked with their ratios in the handoff's NEXT block —
  deliberately NOT swept-and-replaced, because the golds and purples carry MEANING (gold = money,
  purple = rep) and a straight recolour flattens a legible system.
- Route: dev-method (when a defect's fault is a value's RELATIONSHIP to its context — colour on a
  background, size against a container, timing against a rate — a grep cannot sweep the class; name
  the instrument that can, and run it as part of the fix or the class survives the report).

## 2026-07-15 — My own probe's `.catch(() => {})` swallowed a wrong selector and re-measured the wrong view under the right label [HARVESTED — 2026-07-15]
- What happened: the contrast sweep clicked `[data-mobview="guide"]` to open the Field Guide, then
  audited and labelled the results `Mobs/Field Guide`. The real selector is `.mob-view-btn[data-view]`.
  The click was wrapped in `.catch(() => {})`, so the miss was silent: the sub-view never changed and
  the probe measured the Expeditions view a second time, filed under the Guide's name. Caught only
  because I went to read the toggle's source for an unrelated reason and the attribute didn't match.
- What it cost: the first sweep reported "no `.beast-next` problem" — because `.beast-next` only
  exists in the view it never opened. `.beast-next.vip` (1.01:1, the worst instance in the codebase)
  was invisible to it for a second reason too: `'VIP'` renders only once the Inspector is discovered,
  and my seeded save had no dragon serves. **Two independent blind spots, one of them self-inflicted,
  both producing a confident empty result.**
- Root cause: `.catch(() => {})` is a silent-no-op generator. The project already knows this shape —
  a scripted edit whose anchor doesn't match "succeeds" with exit 0 — and the standing rule is that
  anchors THROW on 0 or 2+ matches. I apply that rule religiously to edit scripts and had never
  thought of a Playwright selector as an anchor. It is exactly one.
- The deeper miss: probe scaffolding is code that can be wrong in ways that mimic real findings. A
  sweep that returns "nothing here" is indistinguishable from a sweep that never arrived. The fix in
  the moment was one character of intent — delete the `.catch` — plus seeding the state each surface
  actually needs to render.
- Plug/principle: **a probe's navigation steps are landing zones and must fail loudly.** No
  `.catch(() => {})` on a step whose success is a precondition of the measurement. And a probe that
  reports absence must state what it would have needed in order to see presence — an empty result
  from an unopened view is not evidence of anything.
- Route: dev-method (the landing-zone law covers PROBE scaffolding, not just edit scripts: a selector
  is an anchor, and a swallowed navigation failure produces a confident measurement of the wrong
  thing under the right label).

## 2026-07-15 — A comment fused a REQUIREMENT with an ACCIDENT, and the accident became law [HARVESTED — 2026-07-15]
- What happened: `.hire-goal-chip` carries *"z5 keeps it above the panels (z4) and under the title
  overlay (z10), so it only shows in-shop."* The chip, Greg's bubble and Bob's bubble (all z5, all
  siblings of `#shop-ui` at z4) painted straight through any open center panel — measured fully
  inside the panel's box, each winning `elementFromPoint` at its own centre.
- Root cause: the comment states two things as if both were intended. *Under the title overlay* is a
  real requirement — the chip must not paint over the title screen. *Above the panels* is not a
  requirement at all; it's what picking 5 happens to do, observed and written down in the same breath
  as the goal. A later reader (me, twice) reads a justified number.
- Why it survived: the chip only exists pre-Bob-hire, panels boot COLLAPSED, and until the Field
  Guide taglines shipped there was nothing worth opening in a fresh player's first two minutes. The
  collision was always there and was never reachable. **The tagline pass didn't break it; it made it
  visitable** — and Daniel found it in a screenshot I'd sent for another purpose.
- The pattern, now three deep: this project has retired scene.js's *"scavenge has no speed perks —
  this IS the clock"*, isDougOut's *"the ~12s gone window dwarfs that"*, and now this. The first two
  were true-when-written and falsified by a new dial. **This one was never fully true** — half of it
  was a consequence wearing an intent's clothes. That is the worse variant, because no later change
  falsifies it; it reads as reasoned from the day it was written.
- Plug shipped: `nav.js` exports `isPanelOpen()`; all three overlays stand down while a panel is open
  (the attention doctrine — a signal stands down when the player is already looking), §83 pins all
  three plus the ordering the fix made load-bearing.
- Route: dev-method (extends the comment-expiry rule: when a comment gives a REASON for a value,
  check that every clause is a constraint and not an observation — "X keeps it above A and below B"
  usually means one of those was the goal and the other was the side effect, and the side effect will
  be defended as a requirement by whoever reads it next).

## 2026-07-15 — The obvious one-value fix would have shipped a worse bug, and its cost lived in a file the fix never touched [HARVESTED — 2026-07-15]
- What happened: three DOM overlays at z5 painted over panels at z4. The fix writes itself — lower
  the z. I nearly proposed `z-index: 5 → 3` as a clean one-value change and went to check the
  neighbourhood first. `.shop-ui` is `position:absolute; inset:0` — it covers the entire 1280×720
  stage — and the file sets `pointer-events` **nowhere**. Dropping the chip below it would have left
  a full-stage transparent hit target on top of a `<button>` that routes the whole Bob
  pseudo-tutorial: **visible, unclickable, and it would have looked correct in every screenshot.**
- Second finding from the same check: all three overlays sit FULLY inside the panel's box, so "under
  the panel" and "hidden" render identically. The z-index fix would have bought a pointer-events
  refactor across a full-stage container — where one missed interactive descendant goes silently dead
  — in exchange for **no visible difference at all**.
- Root cause of the near-miss: the fix's blast radius was in a different concern than the fix. The
  edit is one number in one rule; the consequence is hit-testing, which is invisible from that rule
  and from the element being fixed. "One focused fix" says nothing about how far to look BEFORE
  choosing it, and a one-value change feels like it can't be a big decision.
- Plug/principle: **the size of an edit is not the size of its blast radius.** Before a one-value fix
  to a layout/stacking/geometry property, read what the value RELATES to (what's above, below,
  overlapping, hit-testing) — the neighbours are never in the rule you're editing. The measurement
  that decided it (containment + `elementFromPoint`) took one probe and eliminated two options.
- Route: project-only for the specifics (the #shop-ui pointer-events trap is pinned in §83 and named
  in the handoff), but the general half is a dev-method candidate: a stacking/geometry change is a
  RELATIONSHIP change, so cheapness of edit is no evidence of smallness of decision.