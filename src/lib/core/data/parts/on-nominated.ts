import { CHARACTER_TYPES, type CharacterType, type ReminderLabel } from '../types.ts';
import { readToken } from '../reminder-fields.ts';
import { checkKeys, describe, isObject, readEnum } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * What being nominated sets off:
 * - `execute-nominator`: the nominator is executed straight away (the Virgin);
 * - `may-kill-nominator`: its player may kill the nominator, an optional kill the Storyteller
 *   confirms once they say so (the Gnome, https://wiki.bloodontheclocktower.com/Gnome).
 */
const NOMINATED_EFFECTS = ['execute-nominator', 'may-kill-nominator'] as const;
export type NominatedEffect = (typeof NOMINATED_EFFECTS)[number];

/**
 * A nomination that sets off `effect`: of its own player, or with `carrier`, of the player
 * carrying that reminder of the character (the Gnome's Amigo); by a `by` character, or by
 * anyone when left out.
 */
export interface OnNominated {
	by?: CharacterType;
	carrier?: ReminderLabel;
	effect: NominatedEffect;
}

/**
 * When its player (or the `carrier`) is nominated by a `by` character, `effect` happens (the
 * Virgin, the Gnome). A character with a "No Ability" reminder is spent once that marks it.
 */
export const onNominated = objectPart(
	'On nomination',
	'When its player, or the player with one of its reminders, is nominated, something happens.',
	(raw, path, issues, reminders): OnNominated | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['by', 'carrier', 'effect'], path, issues);
		const by = readEnum(raw, 'by', CHARACTER_TYPES, path, issues, false);
		const carrier = readToken(raw, 'carrier', path, issues, reminders);
		const effect = readEnum(raw, 'effect', NOMINATED_EFFECTS, path, issues, true);
		const ok = (raw.by === undefined || by) && (raw.carrier === undefined || carrier);
		if (!effect || !ok) return undefined;
		return { ...(by ? { by } : {}), ...(carrier ? { carrier } : {}), effect };
	}
);
