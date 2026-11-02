import type { ReminderLabel } from '../types.ts';
import { ownReminder } from '../reminder-fields.ts';
import { describe, isObject } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * When a reminder comes off by itself: at the next Dawn, at the next Dusk, at the dusk after
 * the next Dawn (`dusk-after-dawn`: a token placed by day lasts all of the next day, and one
 * placed before the night's Dusk step is ticked still lasts until the next day's dusk), or when
 * a player of its character dies (`owner-dies`).
 */
export const REMINDER_ENDS = ['dawn', 'dusk', 'dusk-after-dawn', 'owner-dies'] as const;
export type ReminderEnd = (typeof REMINDER_ENDS)[number];

/**
 * Its reminders whose effect lasts only until the next Dawn or Dusk, keyed by label (the Monk's
 * Safe lasts the night, https://wiki.bloodontheclocktower.com/Monk; the Poisoner's Poisoned
 * lasts until dusk the next day, https://wiki.bloodontheclocktower.com/Poisoner; the
 * Minstrel's Everyone Is Drunk until dusk tomorrow, https://wiki.bloodontheclocktower.com/Minstrel;
 * the Philosopher's Drunk until the Philosopher dies,
 * https://wiki.bloodontheclocktower.com/Philosopher). The app takes each off then
 * (`rules/reminder-ends.ts`): a New day is Dawn, ticking Dusk is Dusk.
 */
export const reminderEnds = objectPart(
	'Reminders that come off',
	'Its reminders that come off by themselves at dawn, at dusk, or when its player dies.',
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
