import type { ReminderLabel } from '../types.ts';
import { ownReminder } from '../reminder-fields.ts';
import { checkKeys, describe, isObject, readBoolean, readNumber, readString } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * What one vote counts as, while the character's ability works: `weight` votes (negative
 * takes votes away) for the player carrying its `reminder`, or for its own player (`self`).
 * Two weights on one player multiply. The Thief's chosen player's vote counts negatively
 * (https://wiki.bloodontheclocktower.com/Thief), the Bureaucrat's counts as 3
 * (https://wiki.bloodontheclocktower.com/Bureaucrat), and the Ug hat's wearer votes twice
 * (https://wiki.bloodontheclocktower.com/God_of_Ug).
 */
export type VoteWeight =
	{ reminder: ReminderLabel; weight: number } | { self: true; weight: number };

export const voteWeight = objectPart(
	'Vote weight',
	'What a vote counts as for the player carrying its reminder, or for its own player.',
	(raw, path, issues, reminders): VoteWeight | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['reminder', 'self', 'weight'], path, issues);
		const weight = readNumber(raw, 'weight', path, issues);
		const reminder = readString(raw, 'reminder', path, issues, false);
		const self = readBoolean(raw, 'self', path, issues);
		let ok = true;
		if (weight === undefined || !Number.isInteger(weight) || weight === 1) {
			issues.add(`${path}.weight`, 'expected a whole number other than 1');
			ok = false;
		}
		if (self === false) {
			issues.add(`${path}.self`, 'expected true');
			ok = false;
		}
		if ((reminder === undefined) === (self === undefined)) {
			issues.add(path, 'expected one of reminder or self');
			ok = false;
		}
		if (reminder !== undefined && !ownReminder(reminder, reminders)) {
			issues.add(`${path}.reminder`, 'not one of this character’s reminders');
			ok = false;
		}
		if (!ok || weight === undefined) return undefined;
		return reminder !== undefined ? { reminder, weight } : { self: true, weight };
	}
);
