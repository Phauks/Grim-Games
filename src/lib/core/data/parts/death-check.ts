import type { ReminderLabel } from '../types.ts';
import { readToken } from '../reminder-fields.ts';
import { checkKeys, describe, isObject, readEnum } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * Night deaths the ability itself decides (`rules/night-deaths.ts`):
 * - `wrong-guess`: the player guesses a player's character and dies if wrong (the Gambler);
 * - `chose-impaired`: the player dies if their pick is drunk or poisoned (the Acrobat);
 * - `chosen-good-dies`: a chosen good player dies and the Demon does not kill (the Lycanthrope);
 * - `marked-killed-by-demon`: the player dies when the Demon kills whoever carries `token`
 *   (the Grandmother's Grandchild).
 */
const DEATH_CHECK_KINDS = [
	'wrong-guess',
	'chose-impaired',
	'chosen-good-dies',
	'marked-killed-by-demon'
] as const;
export type DeathCheckKind = (typeof DEATH_CHECK_KINDS)[number];
export interface DeathCheckRule {
	kind: DeathCheckKind;
	token?: ReminderLabel;
}

/** A night death its own ability decides (`rules/night-deaths.ts`). */
export const deathCheck = objectPart(
	'Death check',
	'A night death its own ability decides.',
	(raw, path, issues, reminders): DeathCheckRule | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['kind', 'token'], path, issues);
		const kind = readEnum(raw, 'kind', DEATH_CHECK_KINDS, path, issues, true);
		const token = readToken(raw, 'token', path, issues, reminders);
		if (kind === 'marked-killed-by-demon' && raw.token === undefined) {
			issues.add(`${path}.token`, 'missing');
			return undefined;
		}
		return kind ? { kind, ...(token ? { token } : {}) } : undefined;
	}
);
