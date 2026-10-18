import { boardLooks, DEFAULT_BOARD_LOOKS } from '#lib/features/grimoire/board-looks.svelte.ts';
import { DEFAULT_STEP_FOCUS, stepFocus } from '#lib/features/grimoire/step-focus.svelte.ts';
import { DEFAULT_ASSISTANCE, type AssistKey } from '#lib/ui/assistance.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { DEFAULT_PREFERENCES, type Preferences } from '#lib/ui/preferences.ts';
import { STORYTELLER_GROUPS } from './storyteller-groups.ts';

/** The given Storyteller switches back to their defaults, the others as they are. */
function assistanceWith(keys: readonly AssistKey[]): Preferences['assistance'] {
	const next = { ...preferences.current.assistance };
	for (const key of keys) next[key] = DEFAULT_ASSISTANCE[key];
	return next;
}

const pick = <K extends keyof Preferences>(...keys: K[]): Pick<Preferences, K> =>
	Object.fromEntries(keys.map((key) => [key, DEFAULT_PREFERENCES[key]])) as Pick<Preferences, K>;

/**
 * Each Settings section's reset (Trevor, 2026-10-18): only that section's own settings go
 * back to their defaults. Saved games, scripts, notes and backgrounds you added stay.
 */
export const resets = {
	theme: () => preferences.update(pick('themeId', 'colors')),
	text: () =>
		preferences.update({
			...pick('fonts', 'textScale', 'textAlign'),
			assistance: assistanceWith(['explainTerms'])
		}),
	icons: () => preferences.update(pick('iconSet', 'iconOverrides', 'iconScale')),
	board: () => {
		preferences.update({ assistance: assistanceWith(STORYTELLER_GROUPS.board) });
		boardLooks.update(DEFAULT_BOARD_LOOKS);
		stepFocus.update(DEFAULT_STEP_FOCUS);
	},
	tokens: () => preferences.update(pick('tokenAppearance', 'characterIconScale')),
	assistance: () =>
		preferences.update({
			...pick('tileFace', 'requireName', 'ownWording', 'timerSound', 'timerMode', 'timerVibrate'),
			assistance: assistanceWith([
				...STORYTELLER_GROUPS.night,
				...STORYTELLER_GROUPS.setup,
				...STORYTELLER_GROUPS.day
			])
		})
} satisfies Record<string, () => void>;
