/**
 * How much the app walks the Storyteller through the game (Trevor, 2026-10-15: "users can
 * control the handholding in settings ... power storytellers don't want to be walked
 * through the night"). Each kind of help is its own switch; there are no presets (Trevor:
 * "only granular tools").
 */
export const ASSIST_KEYS = [
	'nightWalkthrough',
	'nightAnswers',
	'infoSuggestions',
	'setupReminders',
	'preDayReminders',
	'deathCause',
	'rulesWarnings',
	'explainTerms'
] as const;
export type AssistKey = (typeof ASSIST_KEYS)[number];
export type Assistance = Record<AssistKey, boolean>;

/** Switches listed under Storyteller help; `explainTerms` has its own Rules terms section. */
export const STORYTELLER_HELP_KEYS = ASSIST_KEYS.filter((key) => key !== 'explainTerms');

export const ASSIST_LABELS: Record<AssistKey, { label: string; description: string }> = {
	nightWalkthrough: {
		label: 'Walk me through the night',
		description:
			'One character at a time with their Storyteller text. Off shows the whole night as a checklist.'
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
	setupReminders: {
		label: 'Suggest setup reminders',
		description:
			'Once characters are in the grimoire, offer the reminders to place before the first night.'
	},
	preDayReminders: {
		label: 'Pre-day reminders',
		description: 'After the night, list what to watch for today, like an unused Slayer shot.'
	},
	deathCause: {
		label: 'Ask how players died',
		description: 'Offer a cause when you mark someone dead. You can always set it later.'
	},
	rulesWarnings: {
		label: 'Setup and jinx warnings',
		description: 'Point out a setup that breaks the rules or a jinx that applies.'
	},
	// Shown in Settings › Rules terms, not Storyteller help: players use it too (Trevor).
	explainTerms: {
		label: 'Underline rules terms with glossary definitions',
		description:
			'A dotted underline on rules words such as poisoned, drunk or might, on every screen. Tap one for its wiki Glossary definition. Off shows plain text.'
	}
};

/** New Storytellers get every kind of help; each switch turns one off. */
export const DEFAULT_ASSISTANCE: Assistance = Object.fromEntries(
	ASSIST_KEYS.map((key) => [key, true])
) as Assistance;

/** Saved switches, with any missing or invalid ones taking their default. */
export function parseAssistance(raw: unknown): Assistance {
	const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const out: Assistance = { ...DEFAULT_ASSISTANCE };
	for (const key of ASSIST_KEYS) if (typeof input[key] === 'boolean') out[key] = input[key];
	return out;
}
