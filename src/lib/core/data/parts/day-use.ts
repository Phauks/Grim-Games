import type { ReminderLabel } from '../types.ts';
import { ownReminder } from '../reminder-fields.ts';
import { checkKeys, describe, isObject, readBoolean, readEnum, readString } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * The player a day ability's use is about, asked when it is marked used: the player its
 * player `chosen` (the Slayer), the `nominator` who set it off (the Virgin), the `nominee`
 * of another player's nomination whose execution it decided (the Judge), the player its
 * player `nominated` (the Golem), the `guesser` who guessed them (the Damsel's Minion), or the
 * player its player `guessed` (the Puzzlemaster).
 */
const DAY_USE_WHO = ['chosen', 'nominator', 'nominee', 'nominated', 'guesser', 'guessed'] as const;
export type DayUseWho = (typeof DAY_USE_WHO)[number];

/**
 * What a day ability's player learns about the player it was used on:
 * - `demon-if-marked`: the Demon player when that player carries one of this character's
 *   impairing reminders (`impairs.tokens`), otherwise any player who isn't the Demon (the
 *   Puzzlemaster's guess, https://wiki.bloodontheclocktower.com/Puzzlemaster).
 */
const DAY_USE_ANSWERS = ['demon-if-marked'] as const;
export type DayUseAnswer = (typeof DAY_USE_ANSWERS)[number];

/**
 * A vote its player calls by day, recorded when its use is marked:
 * - `all-good-join`: every living good player must join, and when they do its player's team
 *   wins (the Cult Leader's cult vote, https://wiki.bloodontheclocktower.com/Cult_Leader,
 *   checked by the `cult-joined` game end).
 */
const DAY_USE_VOTES = ['all-good-join'] as const;
export type DayUseVote = (typeof DAY_USE_VOTES)[number];

/**
 * A day ability's use (`dayUse`): who it was about (`who`), or the vote it calls (`vote`,
 * `DAY_USE_VOTES`), one of the two; `kills` when that player dies
 * straight away if the ability works (the Slayer, Psychopath, Gangster, Gunslinger, Golem),
 * checked against the character's `deathCause`; `spentToken`, the reminder that marks it
 * used when that is not "No Ability" (the Golem's May Not Nominate); `answer`, what its player
 * learns about that player (`DAY_USE_ANSWERS`).
 */
export interface DayUse {
	who?: DayUseWho;
	vote?: DayUseVote;
	kills?: true;
	spentToken?: ReminderLabel;
	answer?: DayUseAnswer;
}

/** Who marking its day ability used asks for (Trevor, 2026-10-30). */
export const dayUse = objectPart(
	'Day ability use',
	'Who marking its day ability used asks for, and what follows.',
	(raw, path, issues, reminders): DayUse | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['who', 'vote', 'kills', 'spentToken', 'answer'], path, issues);
		const vote = readEnum(raw, 'vote', DAY_USE_VOTES, path, issues, false);
		const who = readEnum(raw, 'who', DAY_USE_WHO, path, issues, vote === undefined);
		if (who && vote) issues.add(path, 'expected who or vote, not both');
		const kills = readBoolean(raw, 'kills', path, issues);
		if (kills === false) issues.add(`${path}.kills`, 'expected true');
		const token = readString(raw, 'spentToken', path, issues, false);
		const tokenOk = token === undefined || ownReminder(token, reminders);
		if (!tokenOk) issues.add(`${path}.spentToken`, 'not one of this character’s reminders');
		const answer = readEnum(raw, 'answer', DAY_USE_ANSWERS, path, issues, false);
		if ((!who && !vote) || !tokenOk) return undefined;
		return {
			...(who ? { who } : {}),
			...(vote && !who ? { vote } : {}),
			...(kills ? { kills: true as const } : {}),
			...(token !== undefined ? { spentToken: token } : {}),
			...(answer ? { answer } : {})
		};
	}
);
