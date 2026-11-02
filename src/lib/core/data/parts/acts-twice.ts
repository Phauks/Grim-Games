import type { ReminderLabel } from '../types.ts';
import { readToken } from '../reminder-fields.ts';
import { checkKeys, describe, isObject } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * Its `token` on a player makes that player's ability work twice until dusk (M15c,
 * `rules/acts-twice.ts`): each of their night steps wakes them a second time, and a day ability
 * may be used once more, even a once-per-game one already spent
 * (https://wiki.bloodontheclocktower.com/Barista).
 */
export interface ActsTwice {
	token: ReminderLabel;
}

export const actsTwice = objectPart(
	'Acts twice',
	'Its token on a player makes their ability work twice until dusk.',
	(raw, path, issues, reminders): ActsTwice | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['token'], path, issues);
		if (raw.token === undefined) issues.add(`${path}.token`, 'missing');
		const token = readToken(raw, 'token', path, issues, reminders);
		return token === undefined ? undefined : { token };
	}
);
