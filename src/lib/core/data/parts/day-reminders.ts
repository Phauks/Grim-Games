import { readDayReminders } from '../day-reminder-rules.ts';
import { objectPart } from './part.ts';

/** What to watch for during the day because of it (`rules/day-reminders.ts`). */
export const dayReminders = objectPart(
	'Day reminders',
	'What to watch for during the day because of it.',
	readDayReminders
);
