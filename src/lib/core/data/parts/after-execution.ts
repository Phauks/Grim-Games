import { CHARACTER_TYPES, type CharacterType, type ReminderLabel } from '../types.ts';
import { readToken } from '../reminder-fields.ts';
import { checkKeys, describe, isObject, readEnum } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * When a player whose character type is `of` dies by execution, the ability's `token` goes
 * on its own player, while that player is alive and the ability works (the Minstrel's
 * Everyone Is Drunk after a Minion's execution, https://wiki.bloodontheclocktower.com/Minstrel).
 * A Traveller's exile is not an execution, so it never sets it off.
 */
export interface AfterExecution {
	of: CharacterType;
	token: ReminderLabel;
}

/** Its token goes on its player when a player of a character type dies by execution. */
export const afterExecution = objectPart(
	'After an execution',
	'Its token goes on its player when a player of a character type dies by execution.',
	(raw, path, issues, reminders): AfterExecution | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['of', 'token'], path, issues);
		const of = readEnum(raw, 'of', CHARACTER_TYPES, path, issues, true);
		const token = readToken(raw, 'token', path, issues, reminders);
		if (raw.token === undefined) issues.add(`${path}.token`, 'missing');
		if (!of || token === undefined) return undefined;
		return { of, token };
	}
);
