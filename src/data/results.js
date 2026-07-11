// results.js — battle/shop log line templates (the Mob Mart "comedy bible", shipped).
// {name} = the mob, {item} = what they bought (present for sale outcomes; absent for leave/dismiss).
// TEMPLATE SHAPE (item-aware pass, 2026-07-04): a template is a plain STRING (neutral — fires for
// every item) or { text, cats: ['weapon'|'armor'|'consumable'] } (fires only when the sold item's
// category matches; excluded entirely when no item is in play). TAGGING RULE: tag only when a line
// is NONSENSE outside its categories ('swung the {item}' with a potion); if a mismatch is
// absurd-in-a-good-way ('tried to eat the {item}'), leave it neutral — that absurdity is voice.
// LINE-UNLOCK LADDER (2026-07-04): templates may also carry minServes (?? 0) — the line only fires
// once that monster's lifetime serves reach it. Batches are authored AT the loyalty breakpoints
// (25/50/100/250/500) so the Bestiary pips double as new-material markers; golden: true renders
// the line GOLD in the log (the 100-serve payoff — one per monster, keep these the best in class).
// Voice: cozy, dry, a little pathetic — we laugh WITH the lovable losers, never at them. PG only.
// Genre-parody rule: tropes, never trademarks — dungeon-game furniture (natural 1s, side quests,
// loot, boss music) is fair game; named games, characters, or recognizable quotes are not.
// The message picker (messages.js) POOLS the generic lines with any per-monster lines for the tier,
// so each mob draws from both. New monsters without specific lines fall back to generic cleanly.

export const GENERIC_RESULTS = {
  excellent: [
    // Doug battle cameos ({ dougOut: true } — fire only while he's beyond the door): the battle
    // is the epic frame, Doug is the mundane undercut. He is never the subject (bible: the cameo
    // grammar); the fight is not his business — the hinges are.
    { text: `{name} won! Doug looked up from a promising dumpster. Nodded. Resumed.`, dougOut: true },
    { text: `The hero fled past Doug. Doug checked their footprints for loose change.`, dougOut: true },
    `{name} won. Nobody is more surprised than {name}.`,
    `The hero fled. {name} is as confused as everyone else.`,
    { text: `{name} swung the {item} once. Once was enough.`, cats: ['weapon'] },
    `Victory! {name} has requested a moment to lie down.`,
    `{name} defeated a hero and immediately apologized.`,
    `Against all odds, math, and physics: {name} wins.`,
    { text: `{name} tripped, and the {item} did the rest. Legend.`, cats: ['weapon'] },
    `The hero rage-quit. {name} is the dungeon's problem now.`,
    `{name} won and is already telling everyone. Everyone.`,
    `{name} returns victorious, slightly crunchy, mostly fine.`,
    `{name} rolled a natural twenty at exactly the right time.`,
    { text: `{name} swallowed the {item} whole mid-fight. Technically legal.`, cats: ['consumable'] },
    { text: `The hero's sword bounced off the {item}. {name} is still processing.`, cats: ['armor'] },
    `The hero heard boss music and left. {name} takes the win.`,
  ],
  success: [
    { text: `{name} won as Doug wandered by, dragging a door hinge. Both nodded.`, dougOut: true },
    { text: `{name} survived! The {item} has some new dents.`, cats: ['weapon', 'armor'] },
    `{name} lost gracefully but walked home unbruised.`,
    `{name} tapped out early and got orange slices. Worth it.`,
    `The hero got bored. {name} counts that as living.`,
    `{name} came back with the {item} and a great story.`,
    `No wins, no wounds. {name} calls that a Tuesday.`,
    `{name} negotiated a truce over snacks. Everyone's fine.`,
    `{name} lived! The {item} did about half the work.`,
    `{name} respawned at the entrance and called it a win.`,
    { text: `{name} saved the {item} for later and ran. Strategy!`, cats: ['consumable'] },
    `The hero marked {name} "optional" and moved on. Phew.`,
  ],
  partial: [
    { text: `Both sides paused to watch Doug haul off half a ladder. Then resumed.`, dougOut: true },
    { text: `{name} tripped over Doug's salvage pile. Doug apologized to the pile.`, dougOut: true },
    `{name} lost the fight but won a coupon. Net positive?`,
    `{name} fainted, but the {item} looked amazing doing it.`,
    `Defeated, {name} made a lifelong friend: the hero's dog.`,
    `{name} lost, but found a shiny rock. Priorities intact.`,
    { text: `{name} went down swinging the {item}. Mostly at air.`, cats: ['weapon'] },
    `The hero won but felt bad about it. Small win, {name}.`,
    `{name} lost, yet learned the hero's name. Progress!`,
    `{name} dropped the {item} but kept his dignity. Some of it.`,
    `The hero looted {name} for 3 copper and an apology note.`,
    `{name} lost, but leveled up in something. Probably patience.`,
    { text: `{name} used the {item} at the worst possible moment. Almost artistic.`, cats: ['consumable'] },
  ],
  failure: [
    { text: `{name} fainted near Doug. Doug stood guard. Mostly over his good bits.`, dougOut: true },
    { text: `The hero celebrated. Behind them, Doug quietly salvaged a horseshoe.`, dougOut: true },
    `{name} charged bravely. The hero yawned. Over fast.`,
    `{name} met a hero. The hero was better at this. Much better.`,
    `The {item} did not save {name}. It rarely does.`,
    { text: `The {item} held up great. {name}, less so.`, cats: ['armor'] },
    `{name} was defeated in record time. A new record, sadly.`,
    `{name} lost. The hero didn't even set down the sandwich.`,
    `{name} gave it everything. Everything was not enough.`,
    `{name} fought valiantly for almost four whole seconds.`,
    `The hero won. {name} is home, wrapped in a blanket.`,
    `{name} failed the saving throw. And the throw. And the saving.`,
    `{name} was, it turns out, not proficient with the {item}.`,
    `The hero's {item} was better. Same {item}. Just better.`,
  ],
  funnyFailure: [
    `{name} lost a staring contest with a very still statue.`,
    `{name} was defeated by a door marked PULL. It said PUSH.`,
    `{name} tripped on the {item} before finding the hero.`,
    `{name} got lost, fought a broom for an hour, and lost.`,
    `The hero was on lunch. {name} lost to the lunch.`,
    `{name} used the {item} upside down. Bravely. Incorrectly.`,
    `{name} challenged a scarecrow. The scarecrow won on vibes.`,
    `{name} rolled a natural one at existing today.`,
    `{name} was defeated by gravity. Just regular gravity.`,
    { text: `{name} forgot which end of the {item} to hold. Fatal.`, cats: ['weapon'] },
    { text: `{name} swallowed the {item} too early and burped away the ambush.`, cats: ['consumable'] },
    { text: `{name} wore the {item} backwards and fought accordingly.`, cats: ['armor'] },
    `{name} is still in the tutorial area. Emotionally.`,
    `{name} accepted a side quest mid-fight. Fatal curiosity.`,
    `{name}'s inventory was full. Of regret, mostly.`,
  ],
  leave: [
    `{name} waited, sighed a tiny sigh, and wandered off.`,
    `{name} had somewhere to be. Probably. {name} left.`,
    `Line too long. {name} took his coins elsewhere.`,
    `{name} left. Something about "other dungeons." Rude.`,
    `{name} checked a tiny watch he doesn't own, and left.`,
    `{name} got bored and floated out the door. Bye, {name}.`,
    `{name} left to "check on something." The something: leaving.`,
    `{name} muttered about respawn timers and shuffled out.`,
    `{name} left a one-star review in his heart, then the shop.`,
    `{name} gave up his spot in line. His greatest sacrifice yet.`,
    `{name} left, still holding the coupon. Still folded. Still hopeful.`,
    // Duplicate lampshade (Option 3 canon, Daniel 2026-07-05): mascot logic — Slimey is Slimey
    // even when there are two of him, and the shop has noticed.
    `Another {name} came in right after. Or the same one. Nobody checks.`,
    { text: `{name} left. Greg waved. Technically it was a shrug.`, greg: true },
    { text: `Greg watched {name} go. "Saves me a restock." Employee of the month.`, greg: true },
  ],
  dismiss: [
    `Bob waved {name} along. {name} took it surprisingly well.`,
    `Not today, {name}. {name} shuffles out, undefeated.`,
    `Bob gently shooed {name} out. {name} waved a tiny wave.`,
    `{name} was politely declined and somehow said thanks.`,
    `"Come back later," said Bob. {name} definitely will.`,
    `Bob sent {name} off with no {item} and a kind word.`,
    `Bob smiled {name} toward the door. Professionally.`,
    `Bob offered {name} a coupon instead. Nobody honors it.`,
    `{name} was 3 gold short and 100% understanding about it.`,
    `Bob rang the little bell. {name} knew what it meant. Bye.`,
    `Shooed out, {name} promised to "save up." Bless him.`,
    `{name} got a firm, friendly no and a free peppermint.`,
    `Bob pointed at the door with genuine warmth. {name} obliged.`,
    `Bob cited store policy: no coin, no {item}. {name} nodded sagely.`,
    `{name} swears the other {name} is the impostor. Both are {name}.`,
    // Greg-voiced shoos (voice pass, 2026-07-05): { greg: true } lines fire only once Greg is
    // hired — the anti-Bob register: blunt, zero padding, never about the customer's worth.
    { text: `Greg pointed at the door. {name} respected the efficiency.`, greg: true },
    { text: `"No gold, no goods." Greg's whole speech. {name} left moved.`, greg: true },
    { text: `Greg shooed {name} with the clipboard. He owns no clipboard.`, greg: true },
  ],
};

// Per-monster flavor, pooled with the generic lines above for extra character.
export const MONSTER_RESULTS = {
  slime: {
    excellent: [
      `Slimey absorbed the hero's sword. And lunch. And confidence.`,
      `Slimey won by being too squishy to lose. Science weeps.`,
      `The hero slipped on Slimey and just... gave up. Win!`,
      `Slimey jiggled menacingly. It somehow worked.`,
      { text: `Slimey won! He's been practicing. Nobody knows on what.`, minServes: 25 },
      { text: `The heroes have a name for Slimey now. He thinks it's a compliment. It is.`,
        minServes: 100, golden: true },
      { text: `Slimey was told to give it his all. He gave it. It's in a jar.`, minServes: 50 },
    ],
    success: [
      `Slimey bounced off the hero and rolled safely home. Nice.`,
      `Slimey survived, mistaken for a decorative puddle.`,
      `The {item} slid right off Slimey. So did the hero.`,
      { text: `Slimey won and celebrated by eating the {item}. Full circle.`, minServes: 50 },
    ],
    partial: [
      `Slimey lost but absorbed a sandwich mid-fight. Tasty defeat.`,
      `Slimey split in two. Now there are two losers! Aw.`,
      `Slimey lost, but the puddle he left was very pretty.`,
      { text: `Slimey came home half his usual size. He kept the good half.`, minServes: 50 },
    ],
    failure: [
      `Slimey was defeated. He's still smiling. Doesn't know yet.`,
      `The hero stepped over Slimey. That was the whole battle.`,
      `Slimey took the {item} to a sword fight. It went how you'd think.`,
    ],
    funnyFailure: [
      `Slimey tried to eat the {item} and lost to indigestion.`,
      `Slimey got stuck to the floor and called it a nap.`,
      `Slimey fought his own reflection. A draw, then a loss.`,
      `Slimey tried to eat the {item} again. Third time this week.`,
      { text: `Slimey tried to eat the {item} again. It's tradition at this point.`, minServes: 25 },
    ],
    leave: [
      `Slimey forgot why he came in and slowly oozed away.`,
      `Slimey got distracted by a shiny floor tile and left.`,
    ],
    dismiss: [
      { text: `Greg jerked a thumb at the door. Slimey oozed off, cheerful as ever.`, greg: true },
      `Bob waved Slimey off. He left a happy little trail. Aw.`,
      `Bob waved Slimey off. Slimey waved back for a full minute.`,
    ],
  },
  bat: {
    excellent: [
      `Batty panicked so hard the hero panicked harder. Victory!`,
      `Batty flew in a circle. The hero got dizzy and left.`,
      `Batty won and fainted from the stress of winning.`,
      `The hero blinked. Batty was already champion, weeping.`,
      { text: `Batty won! He gave all the credit to his pebble. The pebble stayed humble.`, minServes: 50 },
    ],
    success: [
      `Batty fled successfully, which for Batty is a triumph.`,
      `Batty survived by hiding in a helmet. Not even his helmet.`,
      `Batty made it home! He will not be discussing it.`,
      { text: `Batty's nerves are improving. He only apologized twice today.`, minServes: 25 },
      { text: `Batty screamed the entire time. Technically, it worked.`, minServes: 50 },
    ],
    partial: [
      `Batty lost, but flew home before dark. Silver lining!`,
      `Batty fainted, woke up, apologized to a rock, went home.`,
      `Batty lost the {item} but kept his emotional support pebble.`,
      `Batty lost, but his emotional support pebble never left him.`,
    ],
    failure: [
      `Batty saw the hero, screamed, and lost on principle.`,
      `Batty was defeated by the doorway before the hero arrived.`,
      `Batty fainted at "En garde." The hero felt a little bad.`,
    ],
    funnyFailure: [
      `Batty flew into the same window six times. The window won.`,
      `Batty got startled by his own echo and surrendered to it.`,
      `Batty hid in a chest and fought it from the inside.`,
      `Batty dropped his emotional support pebble. Fight over.`,
      { text: `Batty brought a backup plan. The backup plan also panicked.`, minServes: 25 },
      { text: `Batty, veteran of a hundred panics, fled with unmistakable style. A legend.`,
        minServes: 100, golden: true },
    ],
    leave: [
      `Batty got nervous about the wait and fluttered off.`,
      `Batty left after imagining nine ways this could go wrong.`,
      { text: `Batty heard the kid with the sword was inside. Batty, promptly, was not.`, minServes: 50 },
    ],
    dismiss: [
      `Bob shooed Batty out before the panic set in. He's grateful.`,
      `One head-shake and Batty apologizes for existing, then leaves.`,
      `Bob waved him off gently. Batty thanked him eleven times.`,
    ],
  },
  skeleton: {
    excellent: [
      `Skele fell apart, reassembled wrong, and terrified the hero.`,
      `Skele rattled ominously and, incredibly, that was enough.`,
      `The hero left. Skele takes the win, and his femur, home.`,
      `Skele won. He'll be finding his ribs for a week.`,
      { text: `Skele won without losing a single bone. Career first.`, minServes: 25 },
    ],
    success: [
      `Skele took a hit, lost an arm, found a better arm. Even trade.`,
      `Skele survived; three bones are now technically optional.`,
      `Skele walked it off. Rattled the whole way, but walked.`,
      { text: `Skele left an arm behind as a warning. He has spares now.`, minServes: 25 },
      { text: `Skele reassembled before he even hit the floor. The hero applauded. A legend.`,
        minServes: 100, golden: true },
      { text: `Skele won, and someone returned his left femur. Suspiciously polished.`, minServes: 50 },
    ],
    partial: [
      `Skele lost a fight and a kneecap, but gained a funny walk.`,
      `Skele scattered heroically. Found most of himself later.`,
      `Skele lost, but his skull rolled somewhere with a nice view.`,
      `Skele lost, and so did his left femur. Again. Somewhere.`,
    ],
    failure: [
      `Skele got tapped once and became a tidy little pile.`,
      `Skele's {item} outlasted Skele by a comfortable margin.`,
      `One poke and Skele was a jigsaw puzzle. Again.`,
    ],
    funnyFailure: [
      `Skele sneezed and spent the whole fight finding his arm.`,
      `Skele's knees popped. He got distracted. He lost. Classic.`,
      `Skele tried to high-five the hero. Lost the hand and the fight.`,
      `Skele paused to look for his left femur. The hero waited. Then won.`,
      { text: `Skele held a heroic pose. The pose held longer than Skele.`, minServes: 50 },
    ],
    leave: [
      `Skele tapped his foot till it fell off, then rattled away.`,
      `Skele left. The waiting was murder on his joints.`,
    ],
    dismiss: [
      `Bob waved Skele off. He rattled a goodbye. A rib fell.`,
      `"Not now, Skele." He salutes, drops an arm, heads out.`,
      `Bob waved. Skele saluted with the wrong arm. His, though.`,
      { text: `Skele took the news with grace. His jaw did not.`, minServes: 50 },
    ],
  },
  // Froggo (grumpy frog, Pass 4b). Comic lever: PROFESSIONAL DISSATISFACTION — every event, win
  // or lose, is a substandard service experience to be reviewed poorly. Grumbly, never mean;
  // we laugh WITH the grump. Running gag seeded: the scathing review / one-star rating.
  frog: {
    excellent: [
      `Froggo won, checked his receipt, and grumbled home. Champion.`,
      `The hero apologized for wasting Froggo's time. Wise. Victory!`,
      `Froggo croaked once. The hero surrendered on instinct.`,
      `Froggo won and rated the whole experience "fine, I suppose."`,
      { text: `Froggo upgraded his review to two stars. The staff celebrated.`, minServes: 25 },
      { text: `Froggo left a five-star review. Nobody knows what happened in there. A legend.`,
        minServes: 100, golden: true },
      { text: `Froggo won. He looked around for a suggestion box anyway.`, minServes: 50 },
    ],
    success: [
      `Froggo survived and complained the dungeon wasn't damp enough.`,
      `Froggo tapped out early. He had a lily pad to get back to.`,
      `The hero got tired of the glaring. Froggo calls it a draw.`,
    ],
    partial: [
      `Froggo lost, but his scowl never wavered. Consistency.`,
      `Froggo lost and demanded a refund from the hero. Almost got one.`,
      `Defeated, Froggo left a scathing review of the entire dungeon.`,
      { text: `Froggo survived, and wants to speak to whoever manages dungeons.`, minServes: 50 },
    ],
    failure: [
      `Froggo lost fast. His mood, already at the bottom, held steady.`,
      `The hero won. Froggo blamed the {item}, the floor, and Tuesdays.`,
      `Froggo was defeated mid-grumble. He finished the grumble anyway.`,
    ],
    funnyFailure: [
      `Froggo's tongue stuck to the {item}. The hero waited politely, then won.`,
      `Froggo paused to complain about the arena's acoustics. Fatal.`,
      `Froggo glared at the hero so long he forgot to fight. Classic.`,
      `Froggo hopped into battle, hated the landing, left. Technically a loss.`,
      { text: `Froggo lost, then filed a complaint about the floor. In triplicate.`, minServes: 50 },
    ],
    leave: [
      `Froggo checked the wait time, croaked "no," and hopped off.`,
      `Froggo left a one-star review of the queue and hopped away.`,
    ],
    dismiss: [
      { text: `Greg nodded Froggo out. He was leaving anyway, he insists.`, greg: true },
      `"Next!" Froggo grumbles off, already drafting the complaint.`,
      { text: `Froggo grumbles off, loyal despite his own reviews. He'll deny it.`, minServes: 25 },
      `Bob waved him off warmly. Froggo hated that. He'll be back.`,
    ],
  },
  // Ratty (roadmap 6, Pass A — Daniel 2026-07-05). Comic lever: CHEERFUL ACQUISITION — nothing
  // is ever stolen, it's "found," "recovered," "liberated"; he'd happily explain the five-finger
  // discount. Cozy law holds: we laugh WITH the scrounger, no victims on screen. Ladder per the
  // suite contracts (sections 31/40): 2 @25 + exactly 3 @50 + one golden @100.
  rat: {
    excellent: [
      `Ratty won and checked the hero's pockets. Professional habit.`,
      `Ratty won! The victory is his. So is the hero's lunch.`,
      `The hero blinked. Ratty was behind him. The fight was a formality.`,
      { text: `Ratty's a regular now. The register gets locked anyway. He approves.`, minServes: 25 },
      { text: `Ratty won and gave the hero's wallet back. Growth? No — it was empty.`, minServes: 50 },
      { text: `Ratty paid full price, tipped, and stole nothing. Bob framed the receipt.`,
        minServes: 100, golden: true },
    ],
    success: [
      `Ratty survived and left with more than he arrived with. Unrelated.`,
      `Ratty slipped away mid-fight. The hero is still counting his arrows.`,
      `Ratty called it a draw. The hero's coin purse abstained.`,
      { text: `Ratty apologized for last week's spoons. He replaced them. Different spoons.`, minServes: 25 },
      { text: `Ratty knows the kid with the sword. "Good kid. Heavy pockets."`, minServes: 50 },
    ],
    partial: [
      `Ratty lost the fight but found a shiny button. Net profit.`,
      `Ratty lost, politely returned the hero's watch, and fled.`,
      `Defeated, Ratty bowed out with dignity. And two spoons.`,
    ],
    failure: [
      `Ratty got caught mid-pickpocket. The fight ended shortly after.`,
      `The hero won and counted his fingers afterward. All ten. Lucky.`,
      `Ratty lost. The {item} was recovered from three hiding spots.`,
    ],
    funnyFailure: [
      `Ratty tried to steal the hero's shadow. There were complications.`,
      `Ratty pocketed his own {item} for safekeeping, then forgot where.`,
      `Ratty winked at the hero. The hero did not wink back. Fatal.`,
      { text: `Ratty tried to lift Batty's pebble. The whole shop gasped. He put it back.`, minServes: 50 },
    ],
    leave: [
      `Ratty left. Count the spoons.`,
      `Ratty left to case— to VISIT another shop. Visit.`,
    ],
    // The theft tier (Pass B): fires INSTEAD of a leave line when a patience timeout actually
    // pockets a unit (in stock, thief flag). The line must carry both facts — he left AND the
    // shelf is lighter — in the cheerful-acquisition register. No generic pool exists for this
    // tier on purpose: theft is a character mechanic, not shop weather.
    theft: [
      `Ratty got tired of waiting and the {item} left with him. Coincidence.`,
      `Ratty left. So did one {item}. The two facts are unrelated, he insists.`,
      `Ratty waited, gave up, and comped himself one {item}. For the trouble.`,
    ],
    dismiss: [
      `Bob waved Ratty off and courteously patted him down. Twice.`,
      `Ratty was declined and took it well. Took a pen, too.`,
      { text: `Greg watched Ratty leave with both eyes. Both.`, greg: true },
    ],
  },
  // Beetley (roadmap 6.5 — Daniel 2026-07-05). Comic lever: the OVERPREPARED TINY SOLDIER —
  // requisitions, formations of one, salutes for everything, unshakeable posture. Cozy law:
  // his military-ness is entirely self-appointed and harmless; nobody suffers but his dignity,
  // and even that survives. Ladder per the suite contracts: 2 @25 + exactly 3 @50 + one golden.
  beetle: {
    excellent: [
      `Beetley won in formation. The formation was one beetle. It held.`,
      `Beetley won and saluted the fallen hero. Protocol is protocol.`,
      `The hero met a wall of one shield. The wall filed a victory report.`,
      { text: `Beetley's a regular now. He inspects the queue on arrival. It passes.`, minServes: 25 },
      { text: `Beetley won and pinned a medal on himself. He brought spares. For morale.`, minServes: 50 },
      { text: `Beetley was promoted to General of the Queue. By Beetley. Bob signed it.`,
        minServes: 100, golden: true },
    ],
    success: [
      `Beetley completed the mission. Nobody assigned a mission. He assigned it.`,
      `Beetley won on points. He requested the points in writing.`,
      `Beetley held the line. The line was grateful.`,
      { text: `Beetley calls the shop "the outpost" now. Bob has stopped correcting him.`, minServes: 25 },
      { text: `Beetley guards the kid with the sword's favorite shelf. Unpaid. Devoted.`, minServes: 50 },
    ],
    partial: [
      `Beetley retreated in perfect order. Backwards, saluting.`,
      `Beetley survived and logged the incident. Form 7, dented pride.`,
      { text: `Beetley's {item} held up great. The beetle under it, less so.`, cats: ['armor'] },
    ],
    failure: [
      `Beetley lost, but his posture never did.`,
      `The hero won. Beetley requested a rematch through official channels.`,
      `Beetley was defeated and took full responsibility. Loudly. At attention.`,
    ],
    funnyFailure: [
      `Beetley polished his spear so long the battle ended without him.`,
      `Beetley challenged the hero to single combat. The hero brought friends.`,
      `Beetley tripped during the war cry. The war cry was excellent though.`,
      { text: `Beetley stood guard over Ratty. Ratty stole nothing. Beetley knew. Ratty knew.`, minServes: 50 },
    ],
    leave: [
      `Beetley's shift ended. He relieved himself of duty. Salute included.`,
      `Beetley marched off. Somewhere, a queue lost its best soldier.`,
    ],
    dismiss: [
      `Bob declined him gently. Beetley saluted the decision itself.`,
      `Beetley took the no like a soldier. He'll be back at 0600.`,
      { text: `Greg pointed at the door. Beetley executed a flawless about-face.`, greg: true },
    ],
  },

  dragon: {
    // THE INSPECTOR (Special Visits, 2026-07-07). One flat batch on purpose: he visits once a
    // day, so minServes ladders would never unlock — every line is available from serve one.
    // Voice: officialdom meets a sword. He loses like everyone; the paperwork survives.
    excellent: [
      `The Inspector won and filed the hero under 'obstacles, minor'.`,
      `The Inspector passed the hero's audit. The hero failed the Inspector's.`,
      `Clipboard 1, hero 0. The margins were annotated in red.`,
    ],
    success: [
      `The Inspector won on procedure. The hero objected. Overruled.`,
      `The {item} performed to spec. The Inspector noted it approvingly.`,
      `The Inspector defeated the hero and left constructive feedback.`,
    ],
    partial: [
      `The Inspector called it a draw pending review. The review is him.`,
      `Both parties retreated. The Inspector's notes survived intact.`,
      `The {item} underperformed. A strongly worded memo is coming.`,
    ],
    failure: [
      `The Inspector lost, but the paperwork was flawless.`,
      `The hero won and was immediately cited for improper form.`,
      `The Inspector was defeated. The clipboard was not. It remembers.`,
    ],
  },
};

// Hire flavor (Greg's voice pass, 2026-07-05): what a worker "says" the moment they're hired —
// log lines land GOLD (tier 'milestone': a 600-gold beat deserves the treatment) and bubble quips
// ride the worker's own speech bubble for one showFor window. Keyed by worker id so a future hire
// with an entry here gets the same beat with zero game.js wiring. Voice: see the bible's cast
// section — Greg is the anti-Bob (blunt, zero padding, never cruel).
export const WORKER_HIRE_LINES = {
  restocker: {
    log: [
      `Greg is hired! He counted the shelves, sighed, and got to work.`,
      `Greg joined the crew. His interview was one long shrug. Hired anyway.`,
    ],
    bubble: [
      `New guy. Don't touch the shelves.`,
      `I count. You sell. We're fine.`,
      `The shelves are MY problem now.`,
    ],
  },
  scavenger: {
    log: [
      `Doug is hired! He sniffed the counter, approved of nothing, and asked which door has the good bits.`,
      `Doug joined the crew. The interview was mostly hissing. References: "the dark". Hired.`,
    ],
    // no bubble entry: Doug's voice rides his RETURN lines below (Greg's bubble is Greg's beat)
  },
};

// Doug's homecoming quips (§14 Pass A) — fired by the scavenge tick on ~1 in 4 returns. His
// register (COMEDY_BIBLE): Gollum-ADJACENT but his own — third-person self-talk, sibilant,
// covetous of the haul; his pet words are "good bits"/"shinies" (never that OTHER word). Pool
// lines: no second-person (bible hygiene law #2).
export const DOUG_RETURN_LINES = [
  `Doug came back with good bits. "Doug finds, yes. Doug always finds."`,
  `Doug emptied his pack. Mostly scrap. One confused snail. He kept the snail.`,
  `"Shiny bitses for the pile," Doug whispered. Nobody asked. He told the pile.`,
  `Doug returned humming. The pack clanked. "Good bits, good bits, all for usss."`,
  `Doug slid back through the door sideways. "The beyond has SO much junk," he said, delighted.`,
  `Doug counted his haul twice. Once out loud, once to the haul.`,
];

// Relic voice (§14 Pass B). found: generic, {relic} template — fires as a MILESTONE-tier log
// line the moment Doug hauls one in. byRelic: a restored announcement + ambient reactions
// (mobs noticing the display; fired on a small per-serve chance while restored). Same laws as
// every pool: PG, punch at the end, no second-person, log width.
export const RELIC_VOICE = {
  found: [
    `Doug burst in dragging something big. "Found the {relic}!" He will not say where.`,
    `Doug returned walking sideways with pride. The {relic}. Broken. But his.`,
    `Doug slammed the {relic} on the counter. "For the SHOP," he hissed, protectively.`,
  ],
  byRelic: {
    skeleton_key: {
      restored: `The Skeleton Key hangs by the counter now. It opens anything, eventually.`,
      ambient: [
        `Skele stared at the Skeleton Key for a long time. "Grandpa?"`,
        `A customer tried the Skeleton Key on the till. Bob laughed. Nervously.`,
      ],
    },
    hero_magnet: {
      restored: `The Hero Magnet hangs framed on the wall. It points at the door. The frame helps nobody.`,
      ambient: [
        `The Hero Magnet twitched. The whole queue took one step back.`,
        `Batty asked if the Hero Magnet works. Bob said "only on heroes." Long silence.`,
      ],
    },
    yesterday_potion: {
      restored: `The Yesterday Potion stands on the counter. Always about to spill. It never does.`,
      ambient: [
        `Froggo sniffed the Yesterday Potion and got homesick for last week.`,
        `The Yesterday Potion glowed briefly. Tuesday, probably.`,
      ],
    },
    everything_cloak: {
      restored: `The Everything Cloak is framed on the wall. It is made of all the other cloaks.`,
      ambient: [
        `Ratty priced the Everything Cloak from across the room. Bob moved it up a nail.`,
        `The Everything Cloak flapped once. There is no wind in here.`,
      ],
    },
  },
};
