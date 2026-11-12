import { COUNT, oneOf, optObj, T, TOKEN, type SpecValue } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * The player a day ability's use is about, asked when it is marked used: the player its
 * player `chosen` (the Slayer), the `nominator` who set it off (the Virgin), the `nominee`
 * of another player's nomination whose execution it decided (the Judge), the player its
 * player `nominated` (the Golem), the `guesser` who guessed them (the Damsel's Minion), the
 * player its player `guessed` (the Puzzlemaster), or an `ally`: a living player of its player's
 * alignment, whom the Storyteller picks (the Doomsayer).
 */
const DAY_USE_WHO = oneOf([
	'chosen',
	'nominator',
	'nominee',
	'nominated',
	'guesser',
	'guessed',
	'ally'
]);
export type DayUseWho = SpecValue<typeof DAY_USE_WHO>;

/**
 * What a day ability's player learns about the player it was used on:
 * - `demon-if-marked`: the Demon player when that player carries one of this character's
 *   impairing reminders (`impairs.tokens`), otherwise any player who isn't the Demon (the
 *   Puzzlemaster's guess, https://wiki.bloodontheclocktower.com/Puzzlemaster).
 */
const DAY_USE_ANSWERS = oneOf(['demon-if-marked']);
export type DayUseAnswer = SpecValue<typeof DAY_USE_ANSWERS>;

/**
 * A vote its player calls by day, recorded when its use is marked:
 * - `all-good-join`: every living good player must join, and when they do its player's team
 *   wins (the Cult Leader's cult vote, https://wiki.bloodontheclocktower.com/Cult_Leader,
 *   checked by the `cult-joined` game end).
 */
const DAY_USE_VOTES = oneOf(['all-good-join']);
export type DayUseVote = SpecValue<typeof DAY_USE_VOTES>;

/**
 * A day ability's use (`dayUse`): who it was about (`who`), or the vote it calls (`vote`,
 * `DAY_USE_VOTES`), one of the two; `kills` when that player dies
 * straight away if the ability works (the Slayer, Psychopath, Gangster, Gunslinger, Golem),
 * checked against the character's `deathCause`; `spentToken`, the reminder that marks it
 * used when that is not "No Ability" (the Golem's May Not Nominate); `answer`, what its player
 * learns about that player (`DAY_USE_ANSWERS`); `anyone`, for a character no player holds (a
 * Fabled): every living player may use it once per game (the Doomsayer); `minAlive`, only while
 * at least that many players live; `beforeNominations`, only before the day's first nomination
 * (the Psychopath, https://wiki.bloodontheclocktower.com/Psychopath). Who marking it used asks
 * for: Trevor, 2026-10-30.
 */
export const dayUse = specPart(
	'day',
	'Day ability use',
	'Who marking its day ability used asks for, and what follows.',
	optObj({
		who: DAY_USE_WHO,
		vote: DAY_USE_VOTES,
		kills: T,
		spentToken: TOKEN,
		answer: DAY_USE_ANSWERS,
		anyone: T,
		minAlive: COUNT,
		beforeNominations: T
	}),
	(value, path, issues) => {
		if ((value.who === undefined) !== (value.vote === undefined)) return value;
		issues.add(path, value.who ? 'expected who or vote, not both' : 'expected who or vote');
		return undefined;
	}
);

export type DayUse = PartValue<typeof dayUse>;
