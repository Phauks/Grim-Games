/**
 * Which of a character's reminder tokens should stay on the seat they were first placed on
 * (Trevor, 2026-10-16: "token integrity"): the `reminderMovement` part of its rules block,
 * read here and used by `rules/reminder-movement.ts`.
 *
 * A token is FIXED when it records something decided once: setup or first-night information
 * ("start knowing"), a once-per-game effect, or the character's own spent ability. Moving a
 * fixed token to another player rewrites what happened, so the app asks first. A token is
 * MOVING when the ability places it again on a new choice (each night, each day, a counter,
 * a death marker for tonight), so moving it is routine. The Storyteller can still move any
 * token: a fixed token's move is a warning, never a refusal.
 *
 * - `fixed`: the labels that stay put; the character's other labels move;
 * - `why`: why the fixed labels stay put, or with no `fixed`, why all its tokens move;
 * - `relocates`: what this ability does that can legitimately carry a fixed token to another
 *   player, by changing or swapping who holds a character (a swapped Evil Twin takes "Twin"
 *   along). While it is in play, the warning names it.
 *
 * `why` and `relocates` are our own summaries, never wiki prose.
 */
import type { ReminderLabel } from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readString,
	readStringArray,
	type Issues
} from './validate.ts';

export interface ReminderMovementRules {
	fixed?: readonly ReminderLabel[];
	why?: string;
	relocates?: string;
}

/** Reads a `reminderMovement` block; `reminders` are the character's own labels, when given. */
export function readReminderMovement(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): ReminderMovementRules | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['fixed', 'why', 'relocates'], path, issues);
	const fixed = readStringArray(raw, 'fixed', path, issues);
	fixed?.forEach((label, i) => {
		if (reminders && !reminders.includes(label)) {
			issues.add(`${path}.fixed[${i}]`, 'not one of this character’s reminders');
		}
	});
	const why = readString(raw, 'why', path, issues, fixed !== undefined);
	const relocates = readString(raw, 'relocates', path, issues, false);
	return {
		...(fixed ? { fixed } : {}),
		...(why !== undefined ? { why } : {}),
		...(relocates !== undefined ? { relocates } : {})
	};
}
