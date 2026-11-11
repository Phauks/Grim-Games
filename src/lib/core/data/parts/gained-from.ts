import { anyOf, obj, opt, T, TOKEN } from '../field-spec.ts';
import { SEATED_TYPES } from '../types.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * The `gainedFrom` part of a character's rules block: the ability it has is another
 * player's, found on the grimoire (`rules/gained-abilities.ts`).
 * - `token`: its reminder on a player; it has that player's (true) character's ability (the
 *   Cannibal's Lunch, https://wiki.bloodontheclocktower.com/Cannibal; the Pixie's Has Ability,
 *   https://wiki.bloodontheclocktower.com/Pixie; the Philosopher's Drunk,
 *   https://wiki.bloodontheclocktower.com/Philosopher).
 * - `pending`: until `token` is placed, a dead player carrying this reminder gives the ability
 *   if the Storyteller judges it gained (the Pixie's Mad: "if you were mad about being that
 *   character").
 * - `swapped`: a player whose token was swapped for the character they chose has that
 *   character's ability (the Philosopher's Is The Philosopher).
 * - `wakes`: the player then wakes when the gained character would, with its night text
 *   (the Pixie's How to Run).
 * - `ifEvil`: their own reminder, placed on themselves when the player carrying `token` is evil:
 *   they are impaired by it, and their step only reminds the Storyteller of that (the
 *   Cannibal's Poisoned, https://wiki.bloodontheclocktower.com/Cannibal#How_to_Run).
 * - `choose`: the player chooses a character of these types whose ability they gain (the
 *   Philosopher's good character). Its night step offers the pick: a character in play puts
 *   `token` on its player; any other is held by the player (`Seat.abilities`, via this
 *   character), whose token stays as it is (Trevor, 2026-11-03).
 */
export const gainedFrom = specPart(
	'Ability gained from',
	'The ability it has is another player’s, found by its token.',
	obj({
		token: TOKEN,
		pending: opt(TOKEN),
		swapped: opt(T),
		wakes: opt(T),
		ifEvil: opt(TOKEN),
		choose: opt(anyOf(SEATED_TYPES))
	})
);

export type GainedFrom = PartValue<typeof gainedFrom>;
