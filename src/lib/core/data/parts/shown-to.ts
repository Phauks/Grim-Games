import type { ReminderLabel } from '../types.ts';
import { readToken } from '../reminder-fields.ts';
import { checkKeys, describe, isObject, readBoolean } from '../validate.ts';
import { objectPart } from './part.ts';

export interface ShownTo {
	minions?: true;
	carrier?: ReminderLabel;
}

/**
 * Who is woken and shown this character's token, in its own night step: every Minion (the
 * Damsel, also at Minion info, https://wiki.bloodontheclocktower.com/Damsel), or the player
 * carrying its `carrier` reminder (the Widow's Know,
 * https://wiki.bloodontheclocktower.com/Widow).
 */
export const shownTo = objectPart(
	'Shown to',
	'Who is woken and shown this character’s token.',
	(raw, path, issues, reminders): ShownTo | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['minions', 'carrier'], path, issues);
		const minions = readBoolean(raw, 'minions', path, issues);
		const carrier = readToken(raw, 'carrier', path, issues, reminders);
		if (!minions && !carrier) {
			issues.add(path, 'expected minions or carrier');
			return undefined;
		}
		return { ...(minions ? { minions: true as const } : {}), ...(carrier ? { carrier } : {}) };
	}
);
