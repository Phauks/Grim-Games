import { readReminderTargets } from '../target-rules.ts';
import { objectPart } from './part.ts';

/** Where each of its reminder tokens may go, by label (`target-rules.ts`). */
export const reminderTargets = objectPart(
	'Where its reminders go',
	'Where each of its reminder tokens may go, by label.',
	readReminderTargets
);
