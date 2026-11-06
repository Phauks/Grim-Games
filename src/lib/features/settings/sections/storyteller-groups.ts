import type { AssistKey } from '#lib/ui/assistance.ts';

/** Storyteller settings under plain headings (Trevor, 2026-10-17); Setup and the bag draw's own settings sit between Night and Day,
 * and the reminder switches have their own heading after Day (Trevor, 2026-11-06).
 * Setup reminders and setup and jinx warnings are always on (Trevor, 2026-10-20). */
export const STORYTELLER_GROUPS = {
	night: ['nightWalkthrough', 'nightAnswers', 'infoSuggestions', 'characterTokens'],
	day: [
		'dayAfterNight',
		'preDayReminders',
		'deathCause',
		'demonVotedButton',
		'savantInfo',
		'playerClaims',
		'trackNominations',
		'gameEndPrompts'
	],
	reminders: ['deathReminderAsk', 'reviveReminderAsk', 'deadReminderAsk', 'flowReminderAsk'],
	board: ['stackReminders']
} as const satisfies Record<string, readonly AssistKey[]>;
