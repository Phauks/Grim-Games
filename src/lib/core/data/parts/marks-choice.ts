import type { ReminderLabel } from '../types.ts';
import { readToken } from '../reminder-fields.ts';
import { readStringArray } from '../validate.ts';
import type { Part } from './part.ts';

/** Its reminders that mark whom it chose last night (the Monk's Safe, the Poisoner's Poisoned). */
export const marksChoice: Part<readonly ReminderLabel[]> = {
	label: 'Marks its choice',
	description: 'Its reminders that mark whom it chose last night.',
	read: (block, key, path, issues, reminders) => {
		const marks = readStringArray(block, key, path, issues);
		if (!marks) return undefined;
		const own = marks.filter(
			(label, i) =>
				readToken({ label }, 'label', `${path}.${key}[${i}]`, issues, reminders) !== undefined
		);
		return own.length === marks.length ? own : undefined;
	}
};
