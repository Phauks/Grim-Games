import type { AssistKey } from '#lib/ui/assistance.ts';

/** Storyteller settings under plain headings (Trevor, 2026-10-17); the bag draw's own settings sit between Night and Day.
 * Setup reminders and setup and jinx warnings are always on (Trevor, 2026-10-20). */
export const STORYTELLER_GROUPS = {
	night: ['nightWalkthrough', 'nightGuide', 'nightAnswers', 'infoSuggestions'],
	day: [
		'dayAfterNight',
		'preDayReminders',
		'deathCause',
		'deathReminderAsk',
		'reviveReminderAsk',
		'deadReminderAsk',
		'demonVotedButton',
		'gameEndPrompts'
	],
	board: ['stackReminders', 'scriptTitle']
} as const satisfies Record<string, readonly AssistKey[]>;
