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

## The three cast voices (each gets one comic lever)

- **Slimey** (dim, sweet slime) → **innocent literalism.** Simple words, literal misunderstandings,
  sunny obliviousness. Splits, jiggles, absorbs things by accident. Never sad about it.
- **Batty** (nervous, flighty bat) → **anxiety & flight.** Jittery, over-thinks, panics, flees,
  apologizes. Often defeats himself before the hero even shows up.
- **Skele** (brittle, rattly skeleton) → **deadpan + structural fragility.** Dry delivery; literally
  falls apart and reassembles. Bone puns kept light and rare.

Test: cover the name and you should still know who it is.

---

## Running gags to grow over time

Plant a few and escalate them across updates (the 3rd appearance gets the biggest laugh): a recurring
off-screen hero ("the kid with the sword"), Skele's missing left femur, Batty's emotional-support
pebble, Slimey trying to eat his own gear, a coupon nobody ever honors.

---

## The lines (shipped batch)

Outcome tiers: **excellent** (rare big win) · **success** (survived/ok) · **partial** (lost but a
silver lining) · **failure** (lost) · **funnyFailure** (absurd harmless flop) · **leave** (left the
line impatient) · **dismiss** (waved away, no sale). `{name}` = mob, `{item}` = what they bought.
The picker pools the generic lines with the matching character lines, so each mob draws from both.

### EXCELLENT — generic
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

**Slimey:** Slimey absorbed the hero's sword. And lunch. And confidence. · Slimey won by being too
squishy to lose. Science weeps. · The hero slipped on Slimey and just... gave up. Win! · Slimey
jiggled menacingly. It somehow worked.
**Batty:** Batty panicked so hard the hero panicked harder. Victory! · Batty flew in a circle. The
hero got dizzy and left. · Batty won and fainted from the stress of winning. · The hero blinked.
Batty was already champion, weeping.
**Skele:** Skele fell apart, reassembled wrong, and terrified the hero. · Skele rattled ominously
and, incredibly, that was enough. · The hero left. Skele takes the win, and his femur, home. · Skele
won. He'll be finding his ribs for a week.

### SUCCESS — generic
- {name} survived! The {item} has some new dents.
- {name} lost gracefully but walked home unbruised.
- {name} tapped out early and got orange slices. Worth it.
- The hero got bored. {name} counts that as living.
- {name} came back with the {item} and a great story.
- No wins, no wounds. {name} calls that a Tuesday.
- {name} negotiated a truce over snacks. Everyone's fine.
- {name} lived! The {item} did about half the work.

**Slimey:** Slimey bounced off the hero and rolled safely home. Nice. · Slimey survived, mistaken for
a decorative puddle. · The {item} slid right off Slimey. So did the hero.
**Batty:** Batty fled successfully, which for Batty is a triumph. · Batty survived by hiding in a
helmet. Not even his helmet. · Batty made it home! He will not be discussing it.
**Skele:** Skele took a hit, lost an arm, found a better arm. Even trade. · Skele survived; three
bones are now technically optional. · Skele walked it off. Rattled the whole way, but walked.

### PARTIAL — generic
- {name} lost the fight but won a coupon. Net positive?
- {name} fainted, but the {item} looked amazing doing it.
- Defeated, {name} made a lifelong friend: the hero's dog.
- {name} lost, but found a shiny rock. Priorities intact.
- {name} went down swinging the {item}. Mostly at air.
- The hero won but felt bad about it. Small win, {name}.
- {name} lost, yet learned the hero's name. Progress!
- {name} dropped the {item} but kept his dignity. Some of it.

**Slimey:** Slimey lost but absorbed a sandwich mid-fight. Tasty defeat. · Slimey split in two. Now
there are two losers! Aw. · Slimey lost, but the puddle he left was very pretty.
**Batty:** Batty lost, but flew home before dark. Silver lining! · Batty fainted, woke up, apologized
to a rock, went home. · Batty lost the {item} but kept his emotional support pebble.
**Skele:** Skele lost a fight and a kneecap, but gained a funny walk. · Skele scattered heroically.
Found most of himself later. · Skele lost, but his skull rolled somewhere with a nice view.

### FAILURE — generic
- {name} charged bravely. The hero yawned. Over fast.
- {name} met a hero. The hero was better at this. Much better.
- The {item} did not save {name}. It rarely does.
- {name} was defeated in record time. A new record, sadly.
- {name} lost. The hero didn't even set down the sandwich.
- {name} gave it everything. Everything was not enough.
- {name} fought valiantly for almost four whole seconds.
- The hero won. {name} is home, wrapped in a blanket.

**Slimey:** Slimey was defeated. He's still smiling. Doesn't know yet. · The hero stepped over Slimey.
That was the whole battle. · Slimey took a {item} to a sword fight. It went how you'd think.
**Batty:** Batty saw the hero, screamed, and lost on principle. · Batty was defeated by the doorway
before the hero arrived. · Batty fainted at "En garde." The hero felt a little bad.
**Skele:** Skele got tapped once and became a tidy little pile. · Skele's {item} outlasted Skele by a
comfortable margin. · One poke and Skele was a jigsaw puzzle. Again.

### FUNNYFAILURE — generic
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

**Slimey:** Slimey tried to eat the {item} and lost to indigestion. · Slimey got stuck to the floor
and called it a nap. · Slimey fought his own reflection. A draw, then a loss.
**Batty:** Batty flew into the same window six times. The window won. · Batty got startled by his own
echo and surrendered to it. · Batty hid in a chest and fought it from the inside.
**Skele:** Skele sneezed and spent the whole fight finding his arm. · Skele's knees popped. He got
distracted. He lost. Classic. · Skele tried to high-five the hero. Lost the hand and the fight.

### LEAVE — generic
- {name} waited, sighed a tiny sigh, and wandered off.
- {name} had somewhere to be. Probably. {name} left.
- Line too long. {name} took his coins elsewhere.
- {name} left. Something about "other dungeons." Rude.
- {name} checked a tiny watch he doesn't own, and left.
- {name} got bored and floated out the door. Bye, {name}.

**Slimey:** Slimey forgot why he came in and slowly oozed away. · Slimey got distracted by a shiny
floor tile and left.
**Batty:** Batty got nervous about the wait and fluttered off. · Batty left after imagining nine ways
this could go wrong.
**Skele:** Skele tapped his foot till it fell off, then rattled away. · Skele left. The waiting was
murder on his joints.

### DISMISS — generic
- You waved {name} along. {name} took it surprisingly well.
- Not today, {name}. {name} shuffles out, undefeated.
- You gently shooed {name} out. {name} waves a tiny wave.
- {name} was politely declined and somehow thanked you.
- "Come back later," you said. {name} definitely will.
- You sent {name} off with no {item} and a kind word.

**Slimey:** You point at the door. Slimey oozes off, cheerful as ever. · You wave Slimey off. He
leaves a happy little trail. Aw.
**Batty:** You shoo Batty out before the panic sets in. He's grateful. · One head-shake and Batty
apologizes for existing, then leaves.
**Skele:** You wave Skele off. He rattles a goodbye. A rib falls. · "Not now, Skele." He salutes,
drops an arm, heads out.

---

## Growing the batch later

- Add fresh **original** lines only — do NOT quote real show dialogue, catchphrases, or character
  names (copyright). Invent in the spirit of the technique.
- Keep the ~50–70 char discipline; if a line runs long, cut the setup, never the punch word.
- New monsters (Goblin, Rat) can ship with generic lines first, then earn character lines once their
  comic lever is defined (e.g. Goblin = cocky over-promoter; Rat = scrappy opportunist).
- If it ever "feels mean," add more PARTIAL "small dignity" lines and soften FAILURE lines.
- If it "feels repetitive," expand each tier toward 30+ lines and add a second lever per mob.
