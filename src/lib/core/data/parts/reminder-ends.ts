import { byToken, obj, oneOf, variants, type SpecValue } from '../field-spec.ts';
import { ALIGNMENTS } from '../types.ts';
import { specPart } from './part.ts';

/**
 * When a reminder comes off by itself: at the next Dawn, at the next Dusk, at the dusk after
 * the next Dawn (`dusk-after-dawn`: a token placed by day lasts all of the next day, and one
 * placed before the night's Dusk step is ticked still lasts until the next day's dusk), or when
 * a player of its character dies (`owner-dies`).
 */
export const REMINDER_ENDS = ['dawn', 'dusk', 'dusk-after-dawn', 'owner-dies'] as const;
export type ReminderEnd = (typeof REMINDER_ENDS)[number];

/**
 * A reminder that comes off once a player of this alignment is nominated (the Bishop's
 * Nominate Evil and Nominate Good, https://wiki.bloodontheclocktower.com/Bishop). While one is
 * still on, ending the day warns that nominations may not end yet.
 */
const ENDS_ON_NOMINATION = obj({ nominated: oneOf(ALIGNMENTS) });
export type EndsOnNomination = SpecValue<typeof ENDS_ON_NOMINATION>;

/** When one of its reminders comes off: at a time of day, or at a nomination. */
const END = variants(
	{ label: 'At a time', is: 'string', spec: oneOf(REMINDER_ENDS) },
	{ label: 'At a nomination', has: 'nominated', spec: ENDS_ON_NOMINATION }
);
export type ReminderEndRule = SpecValue<typeof END>;

/**
 * Its reminders whose effect lasts only until the next Dawn or Dusk, keyed by label (the Monk's
 * Safe lasts the night, https://wiki.bloodontheclocktower.com/Monk; the Poisoner's Poisoned
 * lasts until dusk the next day, https://wiki.bloodontheclocktower.com/Poisoner; the
 * Minstrel's Everyone Is Drunk until dusk tomorrow, https://wiki.bloodontheclocktower.com/Minstrel;
 * the Philosopher's Drunk until the Philosopher dies,
 * https://wiki.bloodontheclocktower.com/Philosopher), or until a player of an alignment is
 * nominated (`{ "nominated": "evil" }`). The app takes each off then
 * (`rules/reminders/reminder-ends.ts`): a New day is Dawn, ticking Dusk is Dusk.
 */
export const reminderEnds = specPart(
	'Reminders that come off',
	'Its reminders that come off by themselves at dawn, at dusk, at a nomination or when its player dies.',
	byToken(END),
	(value, path, issues) => {
		if (Object.keys(value).length > 0) return value;
		issues.add(path, 'expected at least one reminder');
		return undefined;
	}
);
