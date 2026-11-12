import { NUM, obj, oneOf, opt, T, TOKEN, type SpecValue } from '../field-spec.ts';
import { CHARACTER_TYPES } from '../types.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * What being nominated sets off:
 * - `execute-nominator`: the nominator is executed straight away (the Virgin);
 * - `may-kill-nominator`: its player may kill the nominator, an optional kill the Storyteller
 *   confirms once they say so (the Gnome, https://wiki.bloodontheclocktower.com/Gnome);
 * - `evil-swap`: an evil nominator and a living evil nominee, neither a Traveller, swap
 *   characters (The Warrens, https://beardytas.com/garden-of-djinn/the-warrens/);
 * - `nominator-may-die`: the nominator may choose to die, and the nominee's ability then works
 *   twice until the next dusk (The Djinn's Bargain,
 *   https://beardytas.com/garden-of-djinn/the-djinns-bargain/).
 */
const NOMINATED_EFFECT = oneOf([
	'execute-nominator',
	'may-kill-nominator',
	'evil-swap',
	'nominator-may-die'
]);
export type NominatedEffect = SpecValue<typeof NOMINATED_EFFECT>;

/**
 * A nomination that sets off `effect`: of its own player, or with `carrier`, of the player
 * carrying that reminder of the character (the Gnome's Amigo); by a `by` character, or by
 * anyone when left out. With `first`, only the first nomination of that player ever logged
 * sets it off (the Virgin, https://wiki.bloodontheclocktower.com/Virgin). With `minAlive`, only
 * while at least that many players are alive. On a rule source with no player of its own (a
 * Fabled, a Loric, a game mode or a special rule), every nomination sets it off. A character
 * with a "No Ability" reminder is spent once that marks it.
 */
export const onNominated = specPart(
	'day',
	'On nomination',
	'When its player, or the player with one of its reminders, is nominated, something happens; on a Fabled, Loric or rule, any nomination.',
	obj({
		by: opt(oneOf(CHARACTER_TYPES)),
		carrier: opt(TOKEN),
		effect: NOMINATED_EFFECT,
		first: opt(T),
		minAlive: opt(NUM)
	})
);

export type OnNominated = PartValue<typeof onNominated>;
