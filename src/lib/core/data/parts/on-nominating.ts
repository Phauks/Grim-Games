import type { ReminderLabel } from '../types.ts';
import { readToken } from '../reminder-fields.ts';
import { checkKeys, describe, isObject, readEnum } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * What nominating sets off:
 * - `kills-nominator`: the nominator dies straight away, and the nomination still stands (the
 *   Witch's Cursed, https://wiki.bloodontheclocktower.com/Witch).
 */
const NOMINATING_EFFECTS = ['kills-nominator'] as const;
export type NominatingEffect = (typeof NOMINATING_EFFECTS)[number];

/**
 * A nomination by its own player, or with `carrier`, by the player carrying that reminder of
 * the character (the Witch's Cursed), that sets off `effect`.
 */
export interface OnNominating {
	carrier?: ReminderLabel;
	effect: NominatingEffect;
}

/** When its player (or the `carrier`) nominates, `effect` happens (the Witch). */
export const onNominating = objectPart(
	'On nominating',
	'When its player, or the player with one of its reminders, nominates, something happens.',
	(raw, path, issues, reminders): OnNominating | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['carrier', 'effect'], path, issues);
		const carrier = readToken(raw, 'carrier', path, issues, reminders);
		const effect = readEnum(raw, 'effect', NOMINATING_EFFECTS, path, issues, true);
		if (!effect || (raw.carrier !== undefined && !carrier)) return undefined;
		return { ...(carrier ? { carrier } : {}), effect };
	}
);
