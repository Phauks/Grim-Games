/** Reminder label fields in a character's rules block, which must be its own reminders. */
import type { ReminderLabel } from './types.ts';
import { readString, type Issues } from './validate.ts';

/** Whether `token` is one of the character's reminders; true when they are not given. */
export function ownReminder(
	token: string,
	reminders: readonly ReminderLabel[] | undefined
): boolean {
	return !reminders || reminders.some((r) => r.toLowerCase() === token.toLowerCase());
}

/** An optional reminder label field, which must be one of the character's reminders. */
export function readToken(
	raw: Record<string, unknown>,
	key: string,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): ReminderLabel | undefined {
	const token = readString(raw, key, path, issues, false);
	if (token === undefined) return undefined;
	if (!ownReminder(token, reminders)) {
		issues.add(`${path}.${key}`, 'not one of this character’s reminders');
		return undefined;
	}
	return token;
}
