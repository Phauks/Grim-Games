import type { ReminderLabel } from '../types.ts';
import { describe, isObject } from '../validate.ts';
import { objectPart } from './part.ts';

/** The question placing a reminder asks: mark the living seat dead, or revive a dead one. */
const REMINDER_PROMPTS = ['markDead', 'revive'] as const;
export type ReminderPrompt = (typeof REMINDER_PROMPTS)[number];

/** Reminders whose placing is the moment to change the seat's state, by label. */
export const reminderPrompts = objectPart(
	'Reminder prompts',
	'Reminders whose placing asks to mark the seat dead or revive it.',
	(raw, path, issues, reminders): Readonly<Record<ReminderLabel, ReminderPrompt>> | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		const own = reminders && new Set(reminders.map((r) => r.toLowerCase()));
		const out: Record<ReminderLabel, ReminderPrompt> = {};
		for (const [label, prompt] of Object.entries(raw)) {
			if (own && !own.has(label.toLowerCase())) {
				issues.add(`${path}.${label}`, 'not one of this character’s reminders');
			} else if (!(REMINDER_PROMPTS as readonly unknown[]).includes(prompt)) {
				issues.add(`${path}.${label}`, `unknown prompt ${JSON.stringify(prompt)}`);
			} else out[label] = prompt as ReminderPrompt;
		}
		return out;
	}
);
