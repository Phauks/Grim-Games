import type { ReminderLabel } from '../types.ts';
import { readToken } from '../reminder-fields.ts';
import { checkKeys, describe, isObject, readBoolean, type Issues } from '../validate.ts';
import { objectPart, type Reminders } from './part.ts';

export interface DemonAttack {
	/** The Demon may choose not to attack at night. */
	maySkip: true;
	/**
	 * The Demon must choose not to attack at least once per game: this reminder marks the Demon
	 * until it has, and while it is still on the Demon the Demon doesn't wake on a night its
	 * attack could end the game (the Toymaker's Final Night: No Attack,
	 * https://wiki.bloodontheclocktower.com/Toymaker).
	 */
	mustSkipOnce?: ReminderLabel;
}

function readDemonAttack(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: Reminders
): DemonAttack | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['maySkip', 'mustSkipOnce'], path, issues);
	const maySkip = readBoolean(raw, 'maySkip', path, issues);
	if (maySkip !== true) {
		issues.add(`${path}.maySkip`, 'expected true');
		return undefined;
	}
	const token = readToken(raw, 'mustSkipOnce', path, issues, reminders);
	return { maySkip, ...(token ? { mustSkipOnce: token } : {}) };
}

/**
 * While the character is in play, the Demon may choose not to attack at night, and with
 * `mustSkipOnce` must do so once per game (`rules/demon-attack.ts`; offered at the Demon's
 * step by `features/grimoire/NoAttackStep.svelte`).
 */
export const demonAttack = objectPart(
	'Demon attack',
	'While in play, the Demon may choose not to attack at night, and may have to once per game.',
	readDemonAttack
);
