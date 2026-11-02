import { readReminderMovement } from '../reminder-movement-rules.ts';
import { objectPart } from './part.ts';

/** Which of its reminder tokens stay where they were placed (`rules/reminder-movement.ts`). */
export const reminderMovement = objectPart(
	'Reminders that stay',
	'Which of its reminder tokens stay where they were placed.',
	readReminderMovement
);
