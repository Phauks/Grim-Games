import { ALIGNMENTS, type Alignment, type ReminderLabel } from '../types.ts';
import { ownReminder } from '../reminder-fields.ts';
import { checkKeys, describe, isObject, readEnum } from '../validate.ts';
import { objectPart } from './part.ts';

/** When a reminder comes off by itself: at the next Dawn or the next Dusk. */
export const REMINDER_ENDS = ['dawn', 'dusk'] as const;
export type ReminderEnd = (typeof REMINDER_ENDS)[number];

/**
 * A reminder that comes off once a player of this alignment is nominated (the Bishop's
 * Nominate Evil and Nominate Good, https://wiki.bloodontheclocktower.com/Bishop). While one is
 * still on, ending the day warns that nominations may not end yet.
 */
export interface EndsOnNomination {
	nominated: Alignment;
}

/** When one of its reminders comes off: at a time of day, or at a nomination. */
export type ReminderEndRule = ReminderEnd | EndsOnNomination;

/**
 * Its reminders whose effect lasts only until the next Dawn or Dusk, keyed by label (the Monk's
 * Safe lasts the night, https://wiki.bloodontheclocktower.com/Monk; the Poisoner's Poisoned
 * lasts until dusk the next day, https://wiki.bloodontheclocktower.com/Poisoner), or until a
 * player of an alignment is nominated (`{ "nominated": "evil" }`). The app takes each off then
 * (`rules/reminder-ends.ts`): a New day is Dawn, ticking Dusk is Dusk.
 */
export const reminderEnds = objectPart(
	'Reminders that come off',
	'Its reminders that come off by themselves at the next dawn or dusk, or at a nomination.',
	(raw, path, issues, reminders): Readonly<Record<ReminderLabel, ReminderEndRule>> | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		const out: Record<ReminderLabel, ReminderEndRule> = {};
		for (const [label, end] of Object.entries(raw)) {
			const at = `${path}.${label}`;
			if (!ownReminder(label, reminders)) {
				issues.add(at, 'not one of this character’s reminders');
				continue;
			}
			if (isObject(end)) {
				checkKeys(end, ['nominated'], at, issues);
				const nominated = readEnum(end, 'nominated', ALIGNMENTS, at, issues, true);
				if (nominated) out[label] = { nominated };
				continue;
			}
			if (!(REMINDER_ENDS as readonly unknown[]).includes(end)) {
				issues.add(at, `unknown value ${JSON.stringify(end)}`);
				continue;
			}
			out[label] = end as ReminderEnd;
		}
		return Object.keys(out).length > 0 ? out : undefined;
	}
);
