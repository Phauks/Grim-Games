import type { ReminderLabel } from '../types.ts';
import { ownReminder } from '../reminder-fields.ts';
import { describe, isObject } from '../validate.ts';
import { objectPart } from './part.ts';

/** When a reminder comes off by itself: at the next Dawn or the next Dusk. */
export const REMINDER_ENDS = ['dawn', 'dusk'] as const;
export type ReminderEnd = (typeof REMINDER_ENDS)[number];

/**
 * Its reminders whose effect lasts only until the next Dawn or Dusk, keyed by label (the Monk's
 * Safe lasts the night, https://wiki.bloodontheclocktower.com/Monk; the Poisoner's Poisoned
 * lasts until dusk the next day, https://wiki.bloodontheclocktower.com/Poisoner). The app takes
 * each off then (`rules/reminder-ends.ts`): a New day is Dawn, ticking Dusk is Dusk.
 */
export const reminderEnds = objectPart(
	'Reminders that come off',
	'Its reminders that come off by themselves at the next dawn or dusk.',
	(raw, path, issues, reminders): Readonly<Record<ReminderLabel, ReminderEnd>> | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		const out: Record<ReminderLabel, ReminderEnd> = {};
		for (const [label, end] of Object.entries(raw)) {
			if (!ownReminder(label, reminders)) {
				issues.add(`${path}.${label}`, 'not one of this character’s reminders');
				continue;
			}
			if (!(REMINDER_ENDS as readonly unknown[]).includes(end)) {
				issues.add(`${path}.${label}`, `unknown value ${JSON.stringify(end)}`);
				continue;
			}
			out[label] = end as ReminderEnd;
		}
		return Object.keys(out).length > 0 ? out : undefined;
	}
);
