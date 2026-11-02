import type { ReminderLabel } from '../types.ts';
import { readToken } from '../reminder-fields.ts';
import { checkKeys, describe, isObject, readStringArray } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * What a reminder whose effect the Storyteller picks can do, each one the rules know (the Angel's
 * Something Bad, https://wiki.bloodontheclocktower.com/Angel: its How to Run and Examples list
 * these punishments):
 * - `no-kill`: its player kills no one on one night (no attack the next night);
 * - `poisoned`: its player is poisoned while it is marked;
 * - `mad`: its player is mad while it is marked (a day reminder line);
 * - `no-vote-today`: its player may not vote for a day (a day reminder line);
 * - `no-ability-today`: its player has no ability for a day;
 * - `dies`: its player dies (the Storyteller marks them dead).
 * Anything else is the Storyteller's own words on the token.
 */
export const REMINDER_EFFECTS = [
	'no-kill',
	'poisoned',
	'mad',
	'no-vote-today',
	'no-ability-today',
	'dies'
] as const;
export type ReminderEffectKind = (typeof REMINDER_EFFECTS)[number];

/** Its reminder `token`, whose effect the Storyteller picks from `effects` or writes. */
export interface PickedEffect {
	token: ReminderLabel;
	effects: readonly ReminderEffectKind[];
}

/** A reminder that carries an effect the Storyteller picks (Trevor, 2026-11-02: M17f). */
export const pickedEffect = objectPart(
	'Picked effect',
	'Its reminder carries an effect the Storyteller picks, or their own words.',
	(raw, path, issues, reminders): PickedEffect | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['token', 'effects'], path, issues);
		if (raw.token === undefined) issues.add(`${path}.token`, 'missing');
		const token = readToken(raw, 'token', path, issues, reminders);
		const listed = readStringArray(raw, 'effects', path, issues) ?? [];
		const effects = listed.filter((e): e is ReminderEffectKind =>
			(REMINDER_EFFECTS as readonly string[]).includes(e)
		);
		if (effects.length !== listed.length)
			issues.add(`${path}.effects`, `expected some of ${REMINDER_EFFECTS.join(', ')}`);
		if (token === undefined) return undefined;
		return { token, effects };
	}
);
