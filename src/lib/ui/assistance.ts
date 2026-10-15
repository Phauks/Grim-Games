/**
 * How much the app walks the Storyteller through the game (Trevor, 2026-10-15: "users can
 * control the handholding in settings ... power storytellers don't want to be walked
 * through the night"). Each kind of help is its own switch; the presets set them all.
 */
export const ASSIST_KEYS = [
	'nightWalkthrough',
	'nightAnswers',
	'infoSuggestions',
	'preDayReminders',
	'deathCause',
	'rulesWarnings'
] as const;
export type AssistKey = (typeof ASSIST_KEYS)[number];
export type Assistance = Record<AssistKey, boolean>;

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
	}
};

export const ASSIST_PRESETS = {
	guided: {
		nightWalkthrough: true,
		nightAnswers: true,
		infoSuggestions: true,
		preDayReminders: true,
		deathCause: true,
		rulesWarnings: true
	},
	standard: {
		nightWalkthrough: true,
		nightAnswers: true,
		infoSuggestions: false,
		preDayReminders: true,
		deathCause: false,
		rulesWarnings: true
	},
	expert: {
		nightWalkthrough: false,
		nightAnswers: false,
		infoSuggestions: false,
		preDayReminders: false,
		deathCause: false,
		rulesWarnings: true
	}
} as const satisfies Record<string, Assistance>;
export type AssistPreset = keyof typeof ASSIST_PRESETS;

export const ASSIST_PRESET_LABELS: Record<AssistPreset | 'custom', string> = {
	guided: 'Guided',
	standard: 'Standard',
	expert: 'Expert',
	custom: 'Custom'
};

export const DEFAULT_ASSISTANCE: Assistance = { ...ASSIST_PRESETS.guided };

/** The preset these settings match, or `custom`. */
export function assistPreset(assistance: Assistance): AssistPreset | 'custom' {
	for (const [id, preset] of Object.entries(ASSIST_PRESETS)) {
		if (ASSIST_KEYS.every((key) => preset[key] === assistance[key])) return id as AssistPreset;
	}
	return 'custom';
}

export function parseAssistance(raw: unknown): Assistance {
	const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const out = { ...DEFAULT_ASSISTANCE };
	for (const key of ASSIST_KEYS) if (typeof input[key] === 'boolean') out[key] = input[key];
	return out;
}
