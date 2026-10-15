/**
 * How much the app walks the Storyteller through the game (Trevor, 2026-10-15: "users can
 * control the handholding in settings ... power storytellers don't want to be walked
 * through the night"). Each kind of help is its own switch; the presets set them all.
 */
export const ASSIST_KEYS = [
	'nightWalkthrough',
	'nightAnswers',
	'infoSuggestions',
	'setupReminders',
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
	}
};

export const ASSIST_PRESETS = {
	guided: {
		nightWalkthrough: true,
		nightAnswers: true,
		infoSuggestions: true,
		setupReminders: true,
		preDayReminders: true,
		deathCause: true,
		rulesWarnings: true
	},
	standard: {
		nightWalkthrough: true,
		nightAnswers: true,
		infoSuggestions: false,
		setupReminders: true,
		preDayReminders: true,
		deathCause: false,
		rulesWarnings: true
	},
	expert: {
		nightWalkthrough: false,
		nightAnswers: false,
		infoSuggestions: false,
		setupReminders: false,
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

/** Switches added after the first release of these settings. */
const ADDED_LATER: readonly AssistKey[] = ['setupReminders'];

/**
 * Saved switches, with any missing ones filled in. When only switches added later are
 * missing, they take their value from the preset the saved ones match (so Expert stays
 * Expert); otherwise from the default.
 */
export function parseAssistance(raw: unknown): Assistance {
	const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const saved = ASSIST_KEYS.filter((key) => typeof input[key] === 'boolean');
	const onlyNewMissing = ASSIST_KEYS.every(
		(key) => saved.includes(key) || ADDED_LATER.includes(key)
	);
	const preset = onlyNewMissing
		? Object.values(ASSIST_PRESETS).find((p) => saved.every((key) => p[key] === input[key]))
		: undefined;
	const out: Assistance = { ...(preset ?? DEFAULT_ASSISTANCE) };
	for (const key of saved) out[key] = input[key] as boolean;
	return out;
}
