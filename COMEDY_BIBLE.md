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

## Item-aware tags (2026-07-04)

A line template is a plain STRING (neutral — fires for every item) or, in results.js,
`{ text, cats: ['weapon'|'armor'|'consumable'] }` — it then fires only when the sold item's
category matches, and never when no item is in play. **The tagging rule: tag only when a line is
NONSENSE outside its categories** ('swung the {item}' filling with a potion). If the mismatch is
absurd-in-a-GOOD-way ('Slimey tried to eat the {item}', 'took the {item} to a sword fight'),
leave it neutral — that absurdity is the voice, don't scope it away. Tagged in the shipped batch:
swung-once, tripped-and-it-did-the-rest (weapon); new-dents (weapon+armor); went-down-swinging,
which-end-to-hold (weapon). New category registers opened: potion-chugging (consumable),
worn-backwards / held-up-great (armor) — grow these when writing for the item batches.

**Two hygiene laws (revision pass, 2026-07-05 — suite-pinned in section 42):** (1) A tagged
line must work for its category's WHOLE roster — the Rusty Key, Map, and Silver Key are all
consumables, so liquid-only
verbs (drank/chugged/sipped/gulped, plus pour/spill verbs) are banned in consumable lines; swallow-verbs are the register
(swallowing a key whole is the joke). (2) No second-person in pool lines: shop-side actors are
Bob (warm) or Greg (blunt, tagged) — the "you" era predates the hire arc. The one whitelisted
idiom is "how you'd think" (audience figure of speech, not an actor).

## The line-unlock ladder & golden lines (2026-07-04)

Loyalty pays out in comedy: a template may carry `minServes: N` — it only fires once that
monster's lifetime serves reach N. **Batches are authored AT the loyalty breakpoints**
(25/50/100/250/500) so the Bestiary pips double as new-material markers; a registry-scanned
announcement fires on any crossing that actually unlocks lines (no false hype on batchless
breakpoints). **Golden lines** (`golden: true`, rendered gold in the log): exactly ONE per
monster, gated at 100 serves — the memorable payoff. Rules: goldens are legend-status lines, the
best in that monster's class; they must read timeless (no counters — they keep firing after 100);
gag ESCALATIONS live naturally on this ladder (an escalation is just a minServes-tagged line —
Froggo's review gag runs one star -> two stars @25 -> the five-star golden @100). Shipped batch:
2-3 gated lines per monster @25 + one golden @100 each.

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

## The four cast voices (each gets one comic lever)

- **Slimey** (dim, sweet slime) → **innocent literalism.** Simple words, literal misunderstandings,
  sunny obliviousness. Splits, jiggles, absorbs things by accident. Never sad about it.
- **Batty** (nervous, flighty bat) → **anxiety & flight.** Jittery, over-thinks, panics, flees,
  apologizes. Often defeats himself before the hero even shows up.
- **Skele** (brittle, rattly skeleton) → **deadpan + structural fragility.** Dry delivery; literally
  falls apart and reassembles. Bone puns kept light and rare.
- **Froggo** (grumpy frog, Pass 4b — the tier-2 big spender) → **professional dissatisfaction.**
  Every event, win or lose, is a substandard service experience to be reviewed poorly: receipts
  checked, refunds demanded, one-star reviews filed. Grumbly, never mean — we laugh WITH the
  grump; he keeps coming back, and hates that he does. His walk strip is named `_walk_happy` by
  convention but authored as a grumpy stomp — the mismatch IS the joke.

- **Ratty** (scrappy rat thief, roadmap 6 — the low-tier scrounger) -> **cheerful acquisition.**
  Nothing is ever stolen: it is "found," "recovered," "liberated," a five-finger discount he
  would happily itemize. Sunny about it, never sneaky-sinister — the cozy law holds because his
  victims are off-screen and unbothered (spoons, buttons, a pen). Economic identity: the
  anti-Froggo (ceiling 16 vs 30) — he wants the cheap shelf. His mechanic (Pass B, queued):
  pocketing his wanted item on a patience-timeout leave — dismissing him prevents it.

- **Beetley** (beetle with a spear, roadmap 6.5 — the armor-lead mid-spender) -> **the
  overprepared tiny soldier.** Requisitions, formations of one, salutes for everything,
  unshakeable posture. His military-ness is entirely self-appointed and harmless — nobody
  suffers but his dignity, and even that survives (cozy law). Mechanically the anti-Ratty:
  patienceBonus +8s, the guard who holds the line while the thief punishes inattention.
  Armor is his joke (a shell buying MORE shell).

Test: cover the name and you should still know who it is.

**Bob (the shopkeeper) is a fourth voice, used ONLY in shop-side tiers (dismiss, later leave):**
a retired mimic doing customer service with unshakable professional warmth. His lever is **polite
finality** — the gentlest possible "no" delivered like a five-star concierge. Bob lines matter more
since the auto-wave (M4): Bob now dismisses broke customers himself, so "Bob waved…" lines make the
automation visible and charming. Battle tiers stay mob-POV; Bob never appears in the dungeon.

**Greg (the Restocker, hired staff — voice debut 2026-07-05) → zero customer service.** The
anti-Bob: blunt statements of fact with no padding, delivered like inventory reports. Where Bob
waves warmly, Greg points at the door. Calibration of his "mean" (Daniel's word): his grumpiness
targets the SITUATION and his own job satisfaction — **never the customer's worth** (the cozy law
holds; he's the shop's worst employee and we love him for it). Mechanics: his lines carry
`{ greg: true }` in results.js and only exist once he's hired; shop-side tiers only (dismiss,
leave, the hire moment); rationed to a lesser presence than Bob by design. The Bob/Greg CONTRAST
is the joke engine — a Greg line lands harder when a Bob line is nearby.

---

## Running gags to grow over time

Plant a few and escalate them across updates (the 3rd appearance gets the biggest laugh). Status:

- **Batty's emotional-support pebble** — SEEDED ×3, ESCALATED @50 (excellent: the pebble gets the credit and "stays humble" — it is a character now). Next beat: the pebble gets its own tiny milestone, @250 batch or later.
- **Skele's missing left femur** — SEEDED ×3, ESCALATED @50 (success: it comes back "suspiciously polished" — where has it BEEN?). Next beat: the femur has clearly been living a better life.
- **The coupon nobody ever honors** — ×3 COMPLETE @50 (leave generic: "still folded, still hopeful"). Chain closed; retire from active escalation. May cameo, never escalate.
- **Slimey trying to eat his own gear** — SEEDED ×2 (funnyFailure ×2, "third time this week").
- **Froggo's scathing review** — SEEDED ×3 in his debut batch, ESCALATED @25 ("two stars. The
  staff celebrated."), PAID OFF golden @100 ("a five-star review. Nobody knows what happened in
  there."). The chain is complete; retire from active escalation.
- **Slimey's eat-gag** — escalated @25 ("It's tradition at this point.") on the unlock ladder.
- ~~Batty's emotional support pebble — escalation candidate for the next @50 batch.~~ DONE (see above).
- **The off-screen hero ("the kid with the sword")** — x3 (Batty leave; Ratty @50; Beetley @50
  guards his favorite shelf). The legend builds, the kid stays off-screen. GROWN in
  Ratty's debut (@50 success: "Good kid. Heavy pockets."). x2 — the legend builds, the kid
  stays off-screen. Next beat: a third mob's angle on him.
- **Batty's pebble x Ratty crossover** — Ratty's @50 funnyFailure ("tried to lift the pebble,
  the whole shop gasped, he put it back"). Cross-character gags are a NEW register opened by a
  five-mob roster; use sparingly, they hit harder than solo gags.

- **The duplicate lampshade (Option 3 canon, 2026-07-05)** — mascot logic is CANON: Slimey is
  Slimey even when two are in line. SEEDED x2 (leave: "Or the same one. Nobody checks.";
  dismiss: the triple-name impostor bit). Grow slowly — the wink works because it is rare.

Rule of thumb: a gag earns its next appearance one batch later, slightly escalated, in a
*different* tier than last time.

---

## The lines (shipped batch — v2, post-M4 expansion)

Outcome tiers: **excellent** (rare big win) · **success** (survived/ok) · **partial** (lost but a
silver lining) · **failure** (lost) · **funnyFailure** (absurd harmless flop) · **leave** (left the
line impatient) · **dismiss** (waved away, no sale — manual Send Away OR Bob's M4 auto-wave of a
customer who can't afford their item). `{name}` = mob, `{item}` = what they bought. The picker pools
the generic lines with the matching character lines, so each mob draws from both.

### EXCELLENT — generic (14 — incl. 1 consumable-tagged, 1 armor-tagged)
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

### SUCCESS — generic (11 — incl. 1 consumable-tagged)
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

### PARTIAL — generic (11 — incl. 1 consumable-tagged)
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

### FAILURE — generic (12 — incl. 1 armor-tagged)
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

### FUNNYFAILURE — generic (15 — incl. 1 consumable-tagged, 1 armor-tagged)
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

### The @50 batch (2026-07-05) — 12 gated lines + the coupon closer

Second rung of the unlock ladder: **3 lines per monster at `minServes: 50`**, escalations placed in
DIFFERENT tiers than their seeds per the gag rules. Plus one ungated generic (the coupon's rule-of-
three closer). Exact totals are pinned in suite section 40 (the newest batch owns them).

**Slimey (@50):**
- Slimey was told to give it his all. He gave it. It's in a jar. *(excellent — literalism)*
- Slimey won and celebrated by eating the {item}. Full circle. *(success — eat-gag, 3rd escalation, new tier)*
- Slimey came home half his usual size. He kept the good half. *(partial — sunny dignity)*

**Batty (@50):**
- Batty won! He gave all the credit to his pebble. The pebble stayed humble. *(excellent — PEBBLE escalation, new tier: the pebble is a character now)*
- Batty screamed the entire time. Technically, it worked. *(success)*
- Batty heard the kid with the sword was inside. Batty, promptly, was not. *(leave — INTRODUCES "the kid with the sword")*

**Skele (@50):**
- Skele won, and someone returned his left femur. Suspiciously polished. *(success — FEMUR escalation, new tier: it comes back... changed)*
- Skele held a heroic pose. The pose held longer than Skele. *(funnyFailure)*
- Skele took the news with grace. His jaw did not. *(dismiss)*

**Froggo (@50)** — review chain stays retired; fresh professional-dissatisfaction angles:
- Froggo won. He looked around for a suggestion box anyway. *(excellent)*
- Froggo survived, and wants to speak to whoever manages dungeons. *(partial)*
- Froggo lost, then filed a complaint about the floor. In triplicate. *(funnyFailure)*

**Generic leave (ungated):**
- {name} left, still holding the coupon. Still folded. Still hopeful. *(the coupon's third appearance — chain complete)*

### Greg's voice debut (2026-07-05) — hire-gated staff lines

All `{ greg: true }` (generic pools, fire only once he's hired) except the hire flavor, which
lives in `WORKER_HIRE_LINES` (results.js). BUBBLE-WIDTH RULE for quips: ~40 chars max, one line.

**Dismiss (shoos):**
- Greg pointed at the door. {name} respected the efficiency.
- "No gold, no goods." Greg's whole speech. {name} left moved.
- Greg shooed {name} with the clipboard. He owns no clipboard.

**Leave (remarks):**
- {name} left. Greg waved. Technically it was a shrug.
- Greg watched {name} go. "Saves me a restock." Employee of the month.

**Hire moment — log (gold, one fires):**
- Greg is hired! He counted the shelves, sighed, and got to work.
- Greg joined the crew. His interview was one long shrug. Hired anyway.

**Hire moment — bubble quip (one fires, one window):**
- New guy. Don't touch the shelves.
- I count. You sell. We're fine.
- The shelves are MY problem now.

### Ratty's debut batch (2026-07-05) — the fifth voice

Full roster-member kit per the suite contracts: ~17 base lines across the tiers plus the ladder
(2 @25, exactly 3 @50, one golden @100). Highlights: the golden is the INVERSION payoff ("paid
full price, tipped, and stole nothing. Bob framed the receipt."); the kid-with-the-sword grows
(@50); the pebble crossover (@50, he puts it back); one Greg-tagged dismiss ("Greg watched
Ratty leave with both eyes. Both." — blunt x scrounger is a strong pairing). Full texts live in
results.js under rat: {} — this section records placement, not a second copy (the batch is big;
the registry is the source of truth).

### Beetley's debut batch (2026-07-05) — the sixth voice

Full roster kit: ~16 base lines + the ladder (2 @25, exactly 3 @50, one golden @100).
Highlights: the golden self-promotion ("promoted to General of the Queue. By Beetley. Bob
signed it."); the kid-with-the-sword grows AGAIN (@50: he guards the kid's favorite shelf —
x3, the legend builds); the Ratty standoff crossover (@50 funnyFailure: "Ratty stole nothing.
Beetley knew. Ratty knew." — the guard fiction the mechanic pass deliberately did NOT build,
living as comedy instead); one armor-tagged line ("the beetle under it, less so"); one
Greg-tagged dismiss (the flawless about-face). Texts live in results.js under beetle: {} —
this section records placement, not a second copy.

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

**Fame crossings with new licenses ({items} = joined display names; fires ONLY when a crossing
brings newly eligible licenses — the no-false-hype rule):**
- Word reached the suppliers: new licenses on offer — {items}!
- Fame pays off. The supplier catalog just grew: {items}.

**Bob's bubble — license alerts ({item}; lives in `milestones.js` as `LICENSE_BUBBLE_LINES`).
CANVAS-WIDTH RULE: one line, short — the bubble renders a single measured line over Bob's head,
so keep templates under ~40 chars plus the {item}. Trigger is tier eligibility, never gold.**

*Announce (per newly eligible license, on the crossing):*
- New supplier license: {item}!
- The {item} license just opened up!

*Reminder (~30s dial while any eligible license sits unbought — gentle, never desperate):*
- That {item} license won't buy itself...
- Still no {item} license? Bob keeps hinting.

## Market Day announcements (system voice — lives in `src/data/marketevents.js`)

One demand event per calendar day ("everyone wants flasks today") plus the morning supplier
crate. Same system-voice rules as the milestone lines (shop-side, PG, fits the log width, no
second person) plus the two Market-Day-specific laws:

1. **The fiction is DUNGEON-SIDE.** The world outside shifts — a scare, a season, a parade —
   and the shop reacts. Mob Mart never manufactures the demand; it profits from it politely.
2. **Never imply a price increase** (the milestone law, inherited verbatim): event bonuses ride
   the PAYOUT as tips and gratitude. Prices never move, so customers can never be priced out.

**The six events (two per shelf category — a new event is one registry row):**

*Dragon Scare (consumables):*
- A dragon was spotted two valleys over. Tonics and snacks pay extra today.
- Dragon scare in the hills — mobs tip extra for anything swallowable today.
- (bubble) Dragon scare! Consumables are hot today.
- (bubble) Nothing calms nerves like a swallowable.
- (bubble) Big lizard rumors. Tonics moving fast.

*Dungeon Sniffles (consumables):*
- The dungeon sniffles are going around. Remedies of every kind pay a bonus.
- Sniffles season below. Anything swallowable sells at a happy premium today.
- (bubble) Sniffles season — tonics tip well today.
- (bubble) Every cough buys a remedy. Good day.
- (bubble) Get well soon, dungeon. Buy something.

*Hero Parade (weapons):*
- A hero parade passes the dungeon today. Mobs tip extra to look armed.
- Heroes parading nearby — nothing sells like a weapon held bravely. Tips up.
- (bubble) Hero parade! Weapons tip extra today.
- (bubble) Look armed, feel brave. Weapons move.
- (bubble) Parade day. Every mob wants a prop sword.

*Dueling Season (weapons):*
- Dueling season opens. Every polite challenge needs a weapon — they pay extra.
- It's dueling season below. Weapons leave the shelf with a bonus attached.
- (bubble) Dueling season — weapons pay a bonus.
- (bubble) Polite duels, impolite demand. Weapons up.
- (bubble) Duels at dawn. Weapons selling by dusk.

*Porcupine Migration (armor):*
- The porcupines are migrating. Suddenly everyone appreciates armor — tips up.
- Porcupine migration week: padding is priceless, and armor pays a bonus.
- (bubble) Porcupines migrating! Armor pays extra.
- (bubble) Quill season. Padding is beyond price.
- (bubble) Hug a porcupine once. Then buy armor.

*Falling Rock Season (armor):*
- Falling-rock season in the caves. Helmets and shields earn a grateful bonus.
- Rocks are falling on schedule again. Armor sells with extra thanks today.
- (bubble) Falling rocks! Armor tips well today.
- (bubble) The ceiling is generous. Helmets are wise.
- (bubble) Rocks fall, everyone shops. Armor up.

**Crate lines ({units} free restock units + {gold} sweetener; the 'full' variant covers a
topped-up shop — undealt units convert to gold, so the crate never arrives empty-handed):**
- The morning supplier crate: {units} items shelved, plus {gold} gold in the straw.
- Supplier crate came early: {units} items stocked, {gold} gold under the lid.
- (full) Shelves already full — the supplier left {gold} gold and a compliment.

The bubble pool now doubles as the BOARD pool (life pass, 2026-07-07): boardQuipFor picks
deterministically per (day, event), so growing a pool reshuffles that event's calendar of quips.

Consumable-verb note: both consumable events say "swallowable" on purpose — the hygiene law's
register (the Rusty Key is a consumable; liquid-only verbs stay banned).


---

## Doug’s register (§14 Pass A, 2026-07-10)

The third staff voice, beside Bob (warm) and Greg (blunt): **Gollum-ADJACENT but his own** —
third-person self-talk (“Doug finds, yes. Doug always finds.”), sibilant and covetous of the
haul, half a conversation always running with himself or the pile. His pet words are **“good
bits” / “shinies”** — never that OTHER word (the line between homage and impression). Beats:
the HIRE lines ride `WORKER_HIRE_LINES.scavenger`; the RETURN quips (`DOUG_RETURN_LINES`,
results.js) fire on ~1 in 4 homecomings so the 24s cadence never spams the log. Pool-line
hygiene applies (no second-person; suite-checked in section 57).

**Battle cameos (`{ dougOut: true }`, 2026-07-10):** while Doug is beyond the door, battle-result
lines may glimpse him — he and the mob are out there for legible reasons. Touchstones from the
four reference shows: **Old Man McGucket** (Gravity Falls — the junk-fixated scavenger wandering
through the plot’s explosions; the fight is not his business, the hinges are), **BMO** (Adventure
Time — earnest self-talk, objects as peers), **Tree Trunks** (serene obliviousness amid danger),
with Regular Show/Gumball’s background-gag grammar. The rules: Doug is NEVER the subject — the
battle is the epic frame and Doug is the mundane undercut (he IS the bathos, placed at the END
per the one lever); gated on `isDougOut` (game.js) so a cameo can never fire while he is visibly
standing at home — the gate and the draw share one registry clock (workers.js dials).

---

## The Relic Display (§14 Pass B, 2026-07-10)

Relics are ONE-OF-ONES — nobody buys them; that is the whole joke of owning them. Voice lives
in `RELIC_VOICE` (results.js): **found** lines (Doug’s beat — his register, milestone-gold in
the log), one **restored** announcement each (system voice, deadpan), and **ambient** reactions
(mobs noticing the display on a small per-serve chance — a garnish, never spam). Each relic’s
CARD is its gag compressed to one line (the registry `card` field): the Skeleton Key “opens
anything, eventually” — the object IS the punchline, the card just says it out loud. Rules as
everywhere: PG, punch at the end, no second-person, log width; the mob keeps its dignity —
reactions are curious/covetous/confused, never mocked.
---

## The Field Guide taglines (2026-07-15, pass 2a — `MONSTERS[id].lore.tagline`)

The Field Guide card's ONE line per mob. A different job from the battle log: the log is the mob's
POV in a moment, the tagline is **the guide's POV on the mob forever** — a naturalist's note,
present tense, deadpan, describing a permanent truth rather than an event. It never narrates a
fight and never ages: a line that only lands at 25 serves is a battle line, not a tagline.

Rules as everywhere — ≤80 chars, no second person, PG, punch word LAST — plus the guide's own:
**one lever, one line.** The tagline IS that mob's comic lever compressed to a sentence, so the
bible's standing test bites hardest here: *cover the name and it should still be obvious who it
is.* The shape that keeps working is the section's oldest lever — build a straight-faced frame,
then drop it (bathos): a real fact about the monster, then the fact that undoes it.

Gated on DISCOVERED (first serve / first visit), for the same reason the name is: an unmet mob is
a silhouette, and handing over the punchline before he has ever walked in spends the joke early.

| Mob | Lever | Tagline |
|---|---|---|
| **Slimey** | innocent literalism | Absorbs everything he touches. Retains nothing he learns. |
| **Batty** | anxiety & flight | Ambushes from perfect silence. Ruins it immediately by screaming. |
| **Skele** | deadpan + fragility | Death holds no fear for him. Stairs do. |
| **Froggo** | professional dissatisfaction | Has never enjoyed a dungeon. Has never missed one either. |
| **Ratty** | cheerful acquisition | Has never stolen anything. Has found a truly remarkable amount. |
| **Beetley** | the overprepared tiny soldier | Reports for duty daily. No one has ever assigned him any. |
| **Demmy** | the apologetic menace | The most dangerous mob in the queue. Terribly sorry about it. |
| **Leggsy** | earnest bulk shopping | Buys two of everything. Eight legs, eight needs, one system. |
| **The Inspector** | officialdom in a monster shop | Grades the shop against criteria nobody has ever seen. |

Note how each tagline leans on the mob's own MECHANIC where one exists — Leggsy's `bulkBuyer` is
literally "two of everything", Ratty's `thief` flag is the thing he insists isn't happening,
Demmy's combatMod +2 is the danger he apologises for. The mechanic and the joke are the same fact
said twice; that is why the roster reads as characters rather than stat blocks.

**Pass 2b adds `lore.beats`** — the progressive reveal on the serve pips, in the Dossier. Those
are the paragraphs; this is the caption. Do not grow the tagline into the beats' job.
