# Mob Mart — Comedy Bible (voice kit + battle-log lines)

*Reference/source for the funny lines. The **live, shipped** copy of the lines is
`src/data/results.js` — edit both together, or treat this as the design source and regenerate
`results.js` from it. Tone target: cozy, dry, a little pathetic — we laugh WITH the lovable losers,
never at them. Strictly PG.*

---

## The one lever to remember

All four reference shows (Adventure Time, Regular Show, The Amazing World of Gumball, Gravity Falls)
run on the same engine: **play an absurd event with a straight, sincere face, then land the laugh on
an unexpectedly small, specific, mundane detail at the very end of the line.** That grand-to-trivial
drop (bathos / anticlimax) is the core lever for a battle log. Build an epic frame ("charged the
hero, sword raised") and undercut it with something tiny and concrete ("…tripped on a pebble"). The
undercut goes at the END.

---

## Voice spec — do's and don'ts

**DO**
- Be sincere about absurd things (earnest-absurd, à la Adventure Time).
- End on the concrete **punch word** — the last word is the punchline.
- Keep to **one turn** per line (one setup, one pivot). One joke.
- Use **deadpan reportage** — a neutral "reporter" voice makes brevity read as wit.
- Make failures **cozy** — mobs "faint," "retreat," "go home for a nap." Nobody dies.
- Let mobs keep a **shred of dignity** (made a friend, kept the receipt, found a nice view).
- Use **specificity**: concrete nouns and oddly specific numbers ("four whole seconds") beat vague
  ones. Hard-consonant "funny words" (k/g/b/d) land harder.
- **Vary the joke shape**: bathos, non-sequitur, literalism, understatement, escalation, misdirection.

**DON'T**
- Be mean or mock the mob's worth — comedy comes from absurd juxtaposition and earnest trying.
- Use profanity, innuendo, gore, or real death.
- Explain the joke *after* the punch word.
- Repeat the same joke shape back-to-back.
- Overload invented slang, or break the cozy tone with cynicism/nihilism.
- Exceed ~80 characters (aim ~50–70). The log is a small scrolling widget.

---

## Genre parody — tropes, never trademarks

The mobs live inside a dungeon-fantasy game, so the **shared furniture of the genre** is a second
comedy vein: the wink for players who know RPGs. The rule that keeps it safe and evergreen:

- **YES — unowned tropes:** natural 1s and 20s, failed saving throws, "not proficient with", XP,
  respawning, side quests, tutorial areas, fetch quests, escort missions, inventory full, vendor
  trash, loot drops, 3 copper, boss music, potion cooldowns, the tavern, the chosen one, prophecy,
  patch notes, one-star reviews, respawn timers. The trope itself is the reference — no name needed.
- **NO — trademarks or recognizable material:** never name a real game, studio, or character
  (no "Baldur's Gate"), and never use a quotable famous line (no "arrow to the knee"). Same
  copyright discipline as the show rule below, plus: named references date the game, and a
  name-drop laugh is borrowed recognition rather than a joke the line earns itself.
- **Keep the engine:** a trope line still obeys the voice spec — earnest frame, punch word at the
  end, one turn. "{name} rolled a natural one at existing today" is the model: the trope IS the
  bathos.
- **Ration it:** trope lines are seasoning (a couple per tier), not the base. The character voices
  and bathos carry the log; the genre winks are a bonus layer.

---

## The three cast voices (each gets one comic lever)

- **Slimey** (dim, sweet slime) → **innocent literalism.** Simple words, literal misunderstandings,
  sunny obliviousness. Splits, jiggles, absorbs things by accident. Never sad about it.
- **Batty** (nervous, flighty bat) → **anxiety & flight.** Jittery, over-thinks, panics, flees,
  apologizes. Often defeats himself before the hero even shows up.
- **Skele** (brittle, rattly skeleton) → **deadpan + structural fragility.** Dry delivery; literally
  falls apart and reassembles. Bone puns kept light and rare.

Test: cover the name and you should still know who it is.

**Bob (the shopkeeper) is a fourth voice, used ONLY in shop-side tiers (dismiss, later leave):**
a retired mimic doing customer service with unshakable professional warmth. His lever is **polite
finality** — the gentlest possible "no" delivered like a five-star concierge. Bob lines matter more
since the auto-wave (M4): Bob now dismisses broke customers himself, so "Bob waved…" lines make the
automation visible and charming. Battle tiers stay mob-POV; Bob never appears in the dungeon.

---

## Running gags to grow over time

Plant a few and escalate them across updates (the 3rd appearance gets the biggest laugh). Status:

- **Batty's emotional-support pebble** — SEEDED ×3 (partial ×2, funnyFailure ×1). Growing nicely.
- **Skele's missing left femur** — SEEDED ×3 (excellent, partial, funnyFailure).
- **The coupon nobody ever honors** — SEEDED ×2 (partial generic, dismiss generic/Bob).
- **Slimey trying to eat his own gear** — SEEDED ×2 (funnyFailure ×2, "third time this week").
- **The off-screen hero ("the kid with the sword")** — NOT yet seeded by that phrase; the anonymous
  "the hero" carries it for now. Introduce the phrase when a batch needs a fresh angle.

Rule of thumb: a gag earns its next appearance one batch later, slightly escalated, in a
*different* tier than last time.

---

## The lines (shipped batch — v2, post-M4 expansion)

Outcome tiers: **excellent** (rare big win) · **success** (survived/ok) · **partial** (lost but a
silver lining) · **failure** (lost) · **funnyFailure** (absurd harmless flop) · **leave** (left the
line impatient) · **dismiss** (waved away, no sale — manual Send Away OR Bob's M4 auto-wave of a
customer who can't afford their item). `{name}` = mob, `{item}` = what they bought. The picker pools
the generic lines with the matching character lines, so each mob draws from both.

### EXCELLENT — generic (12)
- {name} won. Nobody is more surprised than {name}.
- The hero fled. {name} is as confused as you are.
- {name} swung the {item} once. Once was enough.
- Victory! {name} has requested a moment to lie down.
- {name} defeated a hero and immediately apologized.
- Against all odds, math, and physics: {name} wins.
- {name} tripped, and the {item} did the rest. Legend.
- The hero rage-quit. {name} is the dungeon's problem now.
- {name} won and is already telling everyone. Everyone.
- {name} returns victorious, slightly crunchy, mostly fine.
- {name} rolled a natural twenty at exactly the right time. *(new — trope)*
- The hero heard boss music and left. {name} takes the win. *(new — trope)*

**Slimey:** Slimey absorbed the hero's sword. And lunch. And confidence. · Slimey won by being too
squishy to lose. Science weeps. · The hero slipped on Slimey and just... gave up. Win! · Slimey
jiggled menacingly. It somehow worked.
**Batty:** Batty panicked so hard the hero panicked harder. Victory! · Batty flew in a circle. The
hero got dizzy and left. · Batty won and fainted from the stress of winning. · The hero blinked.
Batty was already champion, weeping.
**Skele:** Skele fell apart, reassembled wrong, and terrified the hero. · Skele rattled ominously
and, incredibly, that was enough. · The hero left. Skele takes the win, and his femur, home. · Skele
won. He'll be finding his ribs for a week.

### SUCCESS — generic (10)
- {name} survived! The {item} has some new dents.
- {name} lost gracefully but walked home unbruised.
- {name} tapped out early and got orange slices. Worth it.
- The hero got bored. {name} counts that as living.
- {name} came back with the {item} and a great story.
- No wins, no wounds. {name} calls that a Tuesday.
- {name} negotiated a truce over snacks. Everyone's fine.
- {name} lived! The {item} did about half the work.
- {name} respawned at the entrance and called it a win. *(new — trope)*
- The hero marked {name} "optional" and moved on. Phew. *(new — trope)*

**Slimey:** Slimey bounced off the hero and rolled safely home. Nice. · Slimey survived, mistaken for
a decorative puddle. · The {item} slid right off Slimey. So did the hero.
**Batty:** Batty fled successfully, which for Batty is a triumph. · Batty survived by hiding in a
helmet. Not even his helmet. · Batty made it home! He will not be discussing it.
**Skele:** Skele took a hit, lost an arm, found a better arm. Even trade. · Skele survived; three
bones are now technically optional. · Skele walked it off. Rattled the whole way, but walked.

### PARTIAL — generic (10)
- {name} lost the fight but won a coupon. Net positive?
- {name} fainted, but the {item} looked amazing doing it.
- Defeated, {name} made a lifelong friend: the hero's dog.
- {name} lost, but found a shiny rock. Priorities intact.
- {name} went down swinging the {item}. Mostly at air.
- The hero won but felt bad about it. Small win, {name}.
- {name} lost, yet learned the hero's name. Progress!
- {name} dropped the {item} but kept his dignity. Some of it.
- The hero looted {name} for 3 copper and an apology note. *(new — trope)*
- {name} lost, but leveled up in something. Probably patience. *(new — trope)*

**Slimey:** Slimey lost but absorbed a sandwich mid-fight. Tasty defeat. · Slimey split in two. Now
there are two losers! Aw. · Slimey lost, but the puddle he left was very pretty.
**Batty:** Batty lost, but flew home before dark. Silver lining! · Batty fainted, woke up, apologized
to a rock, went home. · Batty lost the {item} but kept his emotional support pebble. · Batty lost,
but his emotional support pebble never left him. *(new — gag ×2)*
**Skele:** Skele lost a fight and a kneecap, but gained a funny walk. · Skele scattered heroically.
Found most of himself later. · Skele lost, but his skull rolled somewhere with a nice view. · Skele
lost, and so did his left femur. Again. Somewhere. *(new — gag ×2)*

### FAILURE — generic (11)
- {name} charged bravely. The hero yawned. Over fast.
- {name} met a hero. The hero was better at this. Much better.
- The {item} did not save {name}. It rarely does.
- {name} was defeated in record time. A new record, sadly.
- {name} lost. The hero didn't even set down the sandwich.
- {name} gave it everything. Everything was not enough.
- {name} fought valiantly for almost four whole seconds.
- The hero won. {name} is home, wrapped in a blanket.
- {name} failed the saving throw. And the throw. And the saving. *(new — trope)*
- {name} was, it turns out, not proficient with the {item}. *(new — trope)*
- The hero's {item} was better. Same {item}. Just better. *(new)*

**Slimey:** Slimey was defeated. He's still smiling. Doesn't know yet. · The hero stepped over Slimey.
That was the whole battle. · Slimey took the {item} to a sword fight. It went how you'd think.
**Batty:** Batty saw the hero, screamed, and lost on principle. · Batty was defeated by the doorway
before the hero arrived. · Batty fainted at "En garde." The hero felt a little bad.
**Skele:** Skele got tapped once and became a tidy little pile. · Skele's {item} outlasted Skele by a
comfortable margin. · One poke and Skele was a jigsaw puzzle. Again.

### FUNNYFAILURE — generic (13)
- {name} lost a staring contest with a very still statue.
- {name} was defeated by a door marked PULL. It said PUSH.
- {name} tripped on the {item} before finding the hero.
- {name} got lost, fought a broom for an hour, and lost.
- The hero was on lunch. {name} lost to the lunch.
- {name} used the {item} upside down. Bravely. Incorrectly.
- {name} challenged a scarecrow. The scarecrow won on vibes.
- {name} rolled a natural one at existing today.
- {name} was defeated by gravity. Just regular gravity.
- {name} forgot which end of the {item} to hold. Fatal.
- {name} is still in the tutorial area. Emotionally. *(new — trope)*
- {name} accepted a side quest mid-fight. Fatal curiosity. *(new — trope)*
- {name}'s inventory was full. Of regret, mostly. *(new — trope)*

**Slimey:** Slimey tried to eat the {item} and lost to indigestion. · Slimey got stuck to the floor
and called it a nap. · Slimey fought his own reflection. A draw, then a loss. · Slimey tried to eat
the {item} again. Third time this week. *(new — gag ×2)*
**Batty:** Batty flew into the same window six times. The window won. · Batty got startled by his own
echo and surrendered to it. · Batty hid in a chest and fought it from the inside. · Batty dropped his
emotional support pebble. Fight over. *(new — gag ×3)*
**Skele:** Skele sneezed and spent the whole fight finding his arm. · Skele's knees popped. He got
distracted. He lost. Classic. · Skele tried to high-five the hero. Lost the hand and the fight. ·
Skele paused to look for his left femur. The hero waited. Then won. *(new — gag ×3)*

### LEAVE — generic (10)
- {name} waited, sighed a tiny sigh, and wandered off.
- {name} had somewhere to be. Probably. {name} left.
- Line too long. {name} took his coins elsewhere.
- {name} left. Something about "other dungeons." Rude.
- {name} checked a tiny watch he doesn't own, and left.
- {name} got bored and floated out the door. Bye, {name}.
- {name} left to "check on something." The something: leaving. *(new)*
- {name} muttered about respawn timers and shuffled out. *(new — trope)*
- {name} left a one-star review in his heart, then the shop. *(new — trope)*
- {name} gave up his spot in line. His greatest sacrifice yet. *(new)*

**Slimey:** Slimey forgot why he came in and slowly oozed away. · Slimey got distracted by a shiny
floor tile and left.
**Batty:** Batty got nervous about the wait and fluttered off. · Batty left after imagining nine ways
this could go wrong.
**Skele:** Skele tapped his foot till it fell off, then rattled away. · Skele left. The waiting was
murder on his joints.

### DISMISS — generic (14) — hot tier since M4: Bob's auto-wave fires these often
- You waved {name} along. {name} took it surprisingly well.
- Not today, {name}. {name} shuffles out, undefeated.
- You gently shooed {name} out. {name} waves a tiny wave.
- {name} was politely declined and somehow thanked you.
- "Come back later," you said. {name} definitely will.
- You sent {name} off with no {item} and a kind word.
- Bob smiled {name} toward the door. Professionally. *(new — Bob voice)*
- Bob offered {name} a coupon instead. Nobody honors it. *(new — Bob + gag ×2)*
- {name} was 3 gold short and 100% understanding about it. *(new — fits the auto-wave case)*
- Bob rang the little bell. {name} knew what it meant. Bye. *(new — Bob; the bell is on the counter)*
- Shooed out, {name} promised to "save up." Bless him. *(new — fits the auto-wave case)*
- {name} got a firm, friendly no and a free peppermint. *(new)*
- Bob pointed at the door with genuine warmth. {name} obliged. *(new — Bob voice)*
- Bob cited store policy: no coin, no {item}. {name} nodded sagely. *(new — fits the auto-wave case)*

**Slimey:** You point at the door. Slimey oozes off, cheerful as ever. · You wave Slimey off. He
leaves a happy little trail. Aw. · Bob waved Slimey off. Slimey waved back for a full minute. *(new)*
**Batty:** You shoo Batty out before the panic sets in. He's grateful. · One head-shake and Batty
apologizes for existing, then leaves. · Bob waved him off gently. Batty thanked him eleven times. *(new)*
**Skele:** You wave Skele off. He rattles a goodbye. A rib falls. · "Not now, Skele." He salutes,
drops an arm, heads out. · Bob waved. Skele saluted with the wrong arm. His, though. *(new)*

---

## Growing the batch later

- Add fresh **original** lines only — do NOT quote real show dialogue, catchphrases, or character
  names (copyright). Same rule for games: **tropes, never trademarks** (see the Genre parody
  section). Invent in the spirit of the technique.
- Keep the ~50–70 char discipline; if a line runs long, cut the setup, never the punch word.
- New monsters (Goblin, Rat) can ship with generic lines first, then earn character lines once their
  comic lever is defined (e.g. Goblin = cocky over-promoter; Rat = scrappy opportunist).
- If it ever "feels mean," add more PARTIAL "small dignity" lines and soften FAILURE lines.
- If it "feels repetitive," expand each tier toward 30+ lines and add a second lever per mob.
  **Also queued (code, not lines):** a tiny no-repeat guard in `messages.js` so the picker never
  deals the same line twice in a row — worth doing now that auto-serve raises line volume.
- **Dismiss stays the hot tier** while the auto-wave is the main dismiss source — check it first
  when expanding.

## Milestone announcements (system voice — lives in `src/data/milestones.js`, not results.js)

Gold-accented lines the Battle Results log shows when a Regulars' Loyalty breakpoint is crossed.
Same voice rules as everything else (Bob's shop-side voice, PG, fits the log width) plus one
mechanic-critical rule: **never imply a price increase** — milestone bonuses are paid ON TOP of
sales (tips, loyalty, bestseller tags), because prices rising would break customer affordability.
Article rule applies: "the {item}" / "{item}s", never "a {item}".

**Item breakpoints ({count}, {item}):**
- Sale #{count} of the {item}! Regulars now tip extra for it.
- Bob framed receipt #{count}. The {item} now earns a loyalty bonus.
- {count} {item}s sold. Bob knows the pitch by heart — it pays better now.
- The {item} hit {count} sales. Bob added a 'bestseller' tag. It works.

**Monster breakpoints ({count}, {name}):**
- {name} milestone: {count} served! Their kind trusts Bob — extra rep per visit.
- Bob memorized the usual order. {count} served like {name} — rep flows faster.
- {count} sales to {name} and friends. Word spreads in the dungeon: more rep.
- Regulars' wall updated: {name} x{count}. Their visits impress the whole cave.

**Everything tiers ({tier}):**
- Every item past {tier} sales! Bob rang the big bell. Everything pays more now.
- Full-shelf milestone: {tier}+ of each. Mob Mart is officially an institution.
