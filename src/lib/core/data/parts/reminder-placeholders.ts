import { readReminderPlaceholders } from '../reminder-placeholder-rules.ts';
import { objectPart } from './part.ts';

/** What each `:reminder:` in its night text means (`rules/night-text.ts`). */
export const reminderPlaceholders = objectPart(
	'Night text reminders',
	'What each reminder named in its night text means.',
	readReminderPlaceholders
);
