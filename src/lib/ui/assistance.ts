/**
 * How much the app walks the Storyteller through the game (Trevor, 2026-10-15: "users can
 * control the handholding in settings ... power storytellers don't want to be walked
 * through the night"). Each kind of help is its own switch; there are no presets (Trevor:
 * "only granular tools").
 */
export const ASSIST_KEYS = [
	'nightWalkthrough',
	'nightGuide',
	'nightAnswers',
	'infoSuggestions',
	'preDayReminders',
	'deathCause',
	'deathReminderAsk',
	'reviveReminderAsk',
	'deadReminderAsk',
	'demonVotedButton',
	'gameEndPrompts',
	'savantInfo',
	'dayAfterNight',
	'stackReminders',
	'scriptTitle',
	'roomCode',
	'explainTerms'
] as const;
export type AssistKey = (typeof ASSIST_KEYS)[number];
export type Assistance = Record<AssistKey, boolean>;

/** Switches listed under Storyteller settings; `explainTerms` has its own Rules terms section. */
export const STORYTELLER_HELP_KEYS = ASSIST_KEYS.filter((key) => key !== 'explainTerms');

export const ASSIST_LABELS: Record<AssistKey, { label: string; description: string }> = {
	nightWalkthrough: {
		label: 'Walk me through the night',
		description:
			'One character at a time with their Storyteller text. Off shows the whole night as a checklist.'
	},
	nightGuide: {
		label: 'Guide night steps',
		description:
			"Tap a step in the night order to fill it in: TPI's text, its reminders to place, and Show to player."
	},
	nightAnswers: {
		label: 'Work out night answers',
		description:
			'Town Crier, Flowergirl, Undertaker, Juggler and Oracle answers from the grimoire and day log.'
	},
	infoSuggestions: {
		label: 'Suggest information',
		description: 'Washerwoman, Librarian, Investigator and similar steps list true options first.'
	},
	preDayReminders: {
		label: 'Pre-day reminders',
		description: 'After the night, list what to watch for today, like an unused Slayer shot.'
	},
	deathCause: {
		label: 'Ask how players died',
		description: 'Offer a cause when you mark someone dead. You can always set it later.'
	},
	deathReminderAsk: {
		label: 'Ask to mark dead',
		description:
			'When a Dead or Died Today reminder goes on a living player, offer to mark them dead.'
	},
	reviveReminderAsk: {
		label: 'Ask to revive',
		description: 'When an Alive reminder goes on a dead player, offer to bring them back.'
	},
	deadReminderAsk: {
		label: "Ask before a dead character's reminder",
		description:
			'When a reminder goes on the board for a character whose player is dead, confirm it first.'
	},
	demonVotedButton: {
		label: 'Demon voted button',
		description:
			'While a Flowergirl is in play, a Demon voted button at the top of the day, for her night answer.'
	},
	savantInfo: {
		label: 'Suggest Savant information',
		description:
			"One true and one false statement for the Savant, worked out from the grimoire, in the Savant seat's ⋯ menu."
	},
	gameEndPrompts: {
		label: 'Game end prompts',
		description:
			'When a win condition is met, such as the Saint executed, list why and offer to end the game.'
	},
	dayAfterNight: {
		label: 'Open the day after End night',
		description: 'Open Day View'
	},
	stackReminders: {
		label: 'Stack duplicate reminders',
		description:
			'Show several copies of one reminder as a single token with a count. Off shows each copy.'
	},
	scriptTitle: {
		label: 'Script name on the board',
		description: "Show the script's name and author behind the grimoire circle."
	},
	roomCode: {
		label: 'Join code on the board',
		description: "Show the room's join code under the script's name. Tap it to open Share."
	},
	// Shown in Settings › Rules terms, not Storyteller settings: players use it too (Trevor).
	explainTerms: {
		label: 'Underline rules terms with glossary definitions',
		description:
			'A dotted underline on rules words such as poisoned, drunk or might, on every screen. Tap one for its wiki Glossary definition. Off shows plain text.'
	}
};

/**
 * New Storytellers get every kind of help; each switch turns one off. Stacking reminders is
 * a way of showing them, not help, so it starts off (Trevor, 2026-10-16).
 */
export const DEFAULT_ASSISTANCE: Assistance = Object.fromEntries(
	ASSIST_KEYS.map((key) => [key, key !== 'stackReminders'])
) as Assistance;

/** Saved switches, with any missing or invalid ones taking their default. */
export function parseAssistance(raw: unknown): Assistance {
	const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const out: Assistance = { ...DEFAULT_ASSISTANCE };
	for (const key of ASSIST_KEYS) if (typeof input[key] === 'boolean') out[key] = input[key];
	return out;
}
