/**
 * The `tokenFlow` part of a character's rules block (Trevor, 2026-11-06: "placing has should
 * request taking mad off ... certain tokens follow a flow"): its own reminders in the order
 * one takes the place of the one before on the same player, as each wiki How to Run says. The
 * Pixie's Mad gives way to Has Ability, the Shabaloth's Dead to Alive, the Pukka's Poisoned to
 * Dead. Placing a later one on a player who has an earlier one asks to take the earlier one
 * off (`rules/token-flow.ts`); the Storyteller may keep both (the Pukka's How to Run keeps
 * Poisoned by Dead while a death ability resolves), so it never happens on its own.
 */
import type { ReminderLabel } from './types.ts';
import { ownReminder } from './reminder-fields.ts';
import { checkKeys, describe, isObject, readStringArray, type Issues } from './validate.ts';

export interface TokenFlow {
	tokens: readonly ReminderLabel[];
}

/** Reads a `tokenFlow` block: two or more of the character's own reminders, in order. */
export function readTokenFlow(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): TokenFlow | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['tokens'], path, issues);
	const tokens = readStringArray(raw, 'tokens', path, issues);
	if (!tokens || tokens.length < 2 || new Set(tokens).size !== tokens.length) {
		issues.add(`${path}.tokens`, 'expected two or more different reminders, in order');
		return undefined;
	}
	const foreign = tokens.filter((t) => !ownReminder(t, reminders));
	if (foreign.length) {
		issues.add(`${path}.tokens`, `not this character’s reminders: ${foreign.join(', ')}`);
		return undefined;
	}
	return { tokens: tokens as ReminderLabel[] };
}
