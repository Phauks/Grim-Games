import type { AssistKey } from '#lib/ui/assistance.ts';

/** Storyteller settings under plain headings (Trevor, 2026-10-17); the bag draw adds two rows. */
export const STORYTELLER_GROUPS = {
	night: ['nightWalkthrough', 'nightGuide', 'nightAnswers', 'infoSuggestions'],
	setup: ['setupReminders', 'rulesWarnings'],
	day: [
		'dayAfterNight',
		'preDayReminders',
		'deathCause',
		'deathReminderAsk',
		'reviveReminderAsk',
		'deadReminderAsk',
		'demonVotedButton',
		'savantInfo',
		'gameEndPrompts'
	],
	board: ['stackReminders', 'scriptTitle']
} as const satisfies Record<string, readonly AssistKey[]>;
