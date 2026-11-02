import type { ReminderLabel } from '../types.ts';
import { ownReminder } from '../reminder-fields.ts';
import { checkKeys, describe, isObject, readBoolean, readNumber, readString } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * How its own player votes, while the character's ability works:
 * - `onlyWith`: they may vote only when the player carrying this reminder votes too (the
 *   Butler's Master, https://wiki.bloodontheclocktower.com/Butler);
 * - `must`: they must vote on every nomination, while at least `minAlive` players live (the
 *   Zealot, https://wiki.bloodontheclocktower.com/Zealot);
 * - `needsToken`: they vote only by using a vote token, which dead players may give them
 *   (the Beggar, https://wiki.bloodontheclocktower.com/Beggar).
 */
export interface Voter {
	onlyWith?: ReminderLabel;
	must?: true;
	minAlive?: number;
	needsToken?: true;
}

export const voter = objectPart(
	'How its player votes',
	'Its player may vote only with another, must vote, or needs a vote token to vote.',
	(raw, path, issues, reminders): Voter | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['onlyWith', 'must', 'minAlive', 'needsToken'], path, issues);
		const out: Voter = {};
		let ok = true;
		const onlyWith = readString(raw, 'onlyWith', path, issues, false);
		if (onlyWith !== undefined) {
			if (ownReminder(onlyWith, reminders)) out.onlyWith = onlyWith;
			else {
				issues.add(`${path}.onlyWith`, 'not one of this character’s reminders');
				ok = false;
			}
		}
		for (const key of ['must', 'needsToken'] as const) {
			const value = readBoolean(raw, key, path, issues);
			if (value === true) out[key] = true;
			else if (value === false) {
				issues.add(`${path}.${key}`, 'expected true');
				ok = false;
			}
		}
		const minAlive = readNumber(raw, 'minAlive', path, issues);
		if (minAlive !== undefined) {
			if (!out.must) {
				issues.add(`${path}.minAlive`, 'only with must');
				ok = false;
			} else if (!Number.isInteger(minAlive) || minAlive < 1) {
				issues.add(`${path}.minAlive`, 'expected a whole number, 1 or more');
				ok = false;
			} else out.minAlive = minAlive;
		}
		if (!out.onlyWith && !out.must && !out.needsToken) {
			issues.add(path, 'expected onlyWith, must or needsToken');
			ok = false;
		}
		return ok ? out : undefined;
	}
);
