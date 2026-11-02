import type { ReminderLabel } from '../types.ts';
import { ownReminder } from '../reminder-fields.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readEnum,
	readNumber,
	readString
} from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * The player a day ability's use is about, asked when it is marked used: the player its
 * player `chosen` (the Slayer), the `nominator` who set it off (the Virgin), the `nominee`
 * of another player's nomination whose execution it decided (the Judge), the player its
 * player `nominated` (the Golem), the `guesser` who guessed them (the Damsel's Minion), the
 * player its player `guessed` (the Puzzlemaster), or an `ally`: a living player of its player's
 * alignment, whom the Storyteller picks (the Doomsayer).
 */
const DAY_USE_WHO = [
	'chosen',
	'nominator',
	'nominee',
	'nominated',
	'guesser',
	'guessed',
	'ally'
] as const;
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
 * A day ability's use (`dayUse`): who it was about (`who`); `kills` when that player dies
 * straight away if the ability works (the Slayer, Psychopath, Gangster, Gunslinger, Golem),
 * checked against the character's `deathCause`; `spentToken`, the reminder that marks it
 * used when that is not "No Ability" (the Golem's May Not Nominate); `answer`, what its player
 * learns about that player (`DAY_USE_ANSWERS`); `anyone`, for a character no player holds (a
 * Fabled): every living player may use it once per game (the Doomsayer); `minAlive`, only while
 * at least that many players live.
 */
export interface DayUse {
	who: DayUseWho;
	kills?: true;
	spentToken?: ReminderLabel;
	answer?: DayUseAnswer;
	anyone?: true;
	minAlive?: number;
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
		checkKeys(raw, ['who', 'kills', 'spentToken', 'answer', 'anyone', 'minAlive'], path, issues);
		const who = readEnum(raw, 'who', DAY_USE_WHO, path, issues, true);
		const kills = readBoolean(raw, 'kills', path, issues);
		if (kills === false) issues.add(`${path}.kills`, 'expected true');
		const token = readString(raw, 'spentToken', path, issues, false);
		const tokenOk = token === undefined || ownReminder(token, reminders);
		if (!tokenOk) issues.add(`${path}.spentToken`, 'not one of this character’s reminders');
		const answer = readEnum(raw, 'answer', DAY_USE_ANSWERS, path, issues, false);
		const anyone = readBoolean(raw, 'anyone', path, issues);
		if (anyone === false) issues.add(`${path}.anyone`, 'expected true');
		const minAlive = readNumber(raw, 'minAlive', path, issues);
		if (minAlive !== undefined && (!Number.isInteger(minAlive) || minAlive < 1))
			issues.add(`${path}.minAlive`, 'expected a whole number of at least 1');
		if (!who || !tokenOk) return undefined;
		return {
			who,
			...(kills ? { kills: true as const } : {}),
			...(token !== undefined ? { spentToken: token } : {}),
			...(answer ? { answer } : {}),
			...(anyone ? { anyone: true as const } : {}),
			...(minAlive !== undefined && Number.isInteger(minAlive) && minAlive >= 1 ? { minAlive } : {})
		};
	}
);
