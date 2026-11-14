import { byToken, oneOf } from '../field-spec.ts';
import { specPart, partWords } from './part.ts';

/** The question placing a reminder asks: mark the living seat dead, or revive a dead one. */
const REMINDER_PROMPTS = ['markDead', 'revive'] as const;
export type ReminderPrompt = (typeof REMINDER_PROMPTS)[number];

/** Reminders whose placing is the moment to change the seat's state, by label. */
export const reminderPrompts = partWords(
	specPart(
		'tokens',
		'Reminder prompts',
		'Reminders whose placing asks to mark the seat dead or revive it.',
		byToken(oneOf(REMINDER_PROMPTS))
	),
	{
		'*': {
			names: {
				markDead: 'Mark dead',
				revive: 'Revive'
			}
		}
	}
);
