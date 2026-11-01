import type { ReminderLabel } from '../types.ts';
import { readToken } from '../reminder-fields.ts';
import { checkKeys, describe, isObject, readString } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * Each evil player learns who carries its `carrier` reminder: shown "This player is" with
 * that player's character, pointing at them; with no one marked, "These characters are not
 * in play" with the character named (the Storm Catcher's Stormcaught,
 * https://wiki.bloodontheclocktower.com/Storm_Catcher). `named`: the key of its prep value
 * (`setupPrep` note `value`) holding the character named, saved even when not in play.
 */
export const evilLearns = objectPart(
	'Evil learns',
	'Each evil player learns who carries its reminder.',
	(raw, path, issues, reminders): { carrier: ReminderLabel; named?: string } | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['carrier', 'named'], path, issues);
		if (raw.carrier === undefined) issues.add(`${path}.carrier`, 'missing');
		const carrier = readToken(raw, 'carrier', path, issues, reminders);
		const named = readString(raw, 'named', path, issues, false);
		return carrier ? { carrier, ...(named ? { named } : {}) } : undefined;
	}
);
