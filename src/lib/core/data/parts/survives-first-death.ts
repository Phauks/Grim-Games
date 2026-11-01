import type { ReminderLabel } from '../types.ts';
import { ownReminder } from '../reminder-fields.ts';
import { checkKeys, describe, isObject, readString } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * Its player's first death does not happen; placing `spentToken`, one of its reminders,
 * marks the ability used (the Fool's "No Ability").
 */
export const survivesFirstDeath = objectPart(
	'Survives the first death',
	'Its player’s first death does not happen.',
	(raw, path, issues, reminders): { spentToken: ReminderLabel } | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['spentToken'], path, issues);
		const token = readString(raw, 'spentToken', path, issues, true);
		if (token === undefined) return undefined;
		if (!ownReminder(token, reminders)) {
			issues.add(`${path}.spentToken`, 'not one of this character’s reminders');
			return undefined;
		}
		return { spentToken: token };
	}
);
