import {
	B,
	byToken,
	COUNT,
	NUM,
	obj,
	oneOf,
	opt,
	optObj,
	STR,
	STRS,
	anyOf,
	type SpecValue
} from '../field-spec.ts';
import { ALIGNMENTS, CHARACTER_TYPES } from '../types.ts';
import { specPart, type PartValue } from './part.ts';

const TYPES = anyOf(CHARACTER_TYPES);

/**
 * `of`: `self`, or a label of this character's tokens whose seat is the centre; `ofType`:
 * centre on seats whose true character has, or may register as, this type instead. `type`,
 * `alignment`: only seats of this type or alignment count as neighbours, others are skipped;
 * `alive`: skip dead players; `both`: fits only while both neighbours fit the rule's other
 * conditions.
 */
const NEIGHBOUR = obj({
	of: STR,
	ofType: opt(oneOf(CHARACTER_TYPES)),
	type: opt(oneOf(CHARACTER_TYPES)),
	alignment: opt(oneOf(ALIGNMENTS)),
	alive: opt(B),
	both: opt(B)
});
export type NeighbourRule = SpecValue<typeof NEIGHBOUR>;

const TARGET = optObj({
	seat: oneOf(['self', 'other', 'any']),
	types: TYPES,
	shown: TYPES,
	characters: STRS,
	alignment: oneOf([...ALIGNMENTS, 'same', 'opposite']),
	sameAlignmentAs: STR,
	alignmentCounts: optObj({ good: NUM, evil: NUM }),
	maxPlaced: COUNT,
	life: oneOf(['alive', 'dead']),
	neighbour: NEIGHBOUR,
	withLabel: STR,
	notWithLabel: STR,
	global: B,
	minOwners: NUM,
	differsFromLastNight: oneOf(['player', 'type']),
	info: B,
	note: STR,
	ambiguous: STR
});
export type TargetRule = SpecValue<typeof TARGET>;

/**
 * Where each reminder token may go (Trevor, 2026-10-16: show valid targets for every token,
 * e.g. the Vigormortis's "Has Ability" only on a Minion it killed): one rule per
 * reminder label. Official characters' rules
 * were read from each character's wiki page (its How to Run section and ability) and
 * paraphrased: `note` is our own summary, never wiki prose. `ambiguous` records what the wiki
 * leaves open, for Trevor to decide.
 *
 * A rule constrains the seat the token goes on, at the moment it is placed:
 * - `seat`: `self` only the character's own seat, `other` never it, `any` either. A token
 *   with nowhere else to go sits on its own character (Trevor, 2026-10-23: "all tokens go on
 *   character, if you cant figure, just say self");
 * - `types` / `characters`: the target's true character type, or true character;
 * - `shown`: the type of the character token the target was dealt, which may not be their
 *   true character (the Drunk is dealt a Townsfolk);
 * - `alignment`: `good`/`evil`, or `same`/`opposite` to the character's player;
 * - `sameAlignmentAs`: shares an alignment with a seat already carrying another copy of the
 *   character's token with this label (the Revolutionary's second Aligned goes on a player of
 *   the first one's alignment);
 * - `alignmentCounts`: at most this many copies of the token on players of each alignment
 *   (the Noble's three: two good, one evil);
 * - `maxPlaced`: at most this many copies of the token on players at once (the Goon's Drunk,
 *   which goes on a chooser only while nobody carries it);
 * - `life`: whether the target is alive or dead when the token goes down;
 * - `neighbour`: the nearest seat each way from the character's own seat (`of: 'self'`)
 *   or from the seat carrying another of its tokens (`of: <label>`), or from a seat whose
 *   true character type is, or may register as, `ofType` (the Marionette sits next to the
 *   Demon, or a Recluse registering as it). `type` and `alignment` skip seats of other types
 *   or alignments (the No Dashii's nearest Townsfolk; the Marionette's nearest good player);
 *   `alive` skips the dead; `both` fits only while both neighbours fit the rule (the Tea
 *   Lady's);
 * - `withLabel` / `notWithLabel`: must share, or must not share, a seat with another of
 *   the character's tokens (the Washerwoman's Wrong is never on her Townsfolk);
 * - `global`: the token marks the game, never a player (a Fabled's or Loric's own tokens);
 * - `differsFromLastNight`: the ability says "different to last night": `player`, never the
 *   player who carried the token at the latest dawn (the Devil's Advocate, Exorcist);
 *   `type`, never a player of that player's character type (the Balloonist);
 * - `minOwners`: the token exists only while this many seats hold the character (the
 *   Village Idiot's Drunk, with 2 or more Village Idiots);
 * - `info`: the token marks what the character's information showed. While the character
 *   is drunk or poisoned (or is really the Drunk, Lunatic or Marionette) that information
 *   can be false, so any seat fits (Trevor, 2026-10-18: a drunk Librarian can see anyone).
 *
 * Every rule's `types` and `good`/`evil` `alignment` also accept what a player may register
 * as (the Recluse as an evil Minion or Demon, the Spy as a good Townsfolk or Outsider): the
 * Preacher may choose a Recluse (Trevor, 2026-10-27).
 *
 * The checks only suggest and warn (`rules/reminder-targets.ts`); the Storyteller can put
 * any token anywhere.
 */
export const reminderTargets = specPart(
	'Where its reminders go',
	'Where each of its reminder tokens may go, by label.',
	byToken(TARGET)
);

export type ReminderTargets = PartValue<typeof reminderTargets>;
