import { boardLooks, DEFAULT_BOARD_LOOKS } from '#lib/features/grimoire/board-looks.svelte.ts';
import { DEFAULT_STEP_FOCUS, stepFocus } from '#lib/features/grimoire/step-focus.svelte.ts';
import { DEFAULT_ASSISTANCE, type AssistKey } from '#lib/ui/assistance.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { DEFAULT_PREFERENCES, type Preferences } from '#lib/ui/preferences.ts';
import type { FontRole } from '#lib/ui/fonts/catalogue.ts';
import { TEXT_FONT_ROLES, TOKEN_FONT_ROLES } from './font-roles.ts';
import { STORYTELLER_GROUPS } from './storyteller-groups.ts';

/** The given Storyteller switches back to their defaults, the others as they are. */
function assistanceWith(keys: readonly AssistKey[]): Preferences['assistance'] {
	const next = { ...preferences.current.assistance };
	for (const key of keys) next[key] = DEFAULT_ASSISTANCE[key];
	return next;
}

/** The chosen fonts without these roles' choices, so those follow the theme again. */
function fontsWithout(roles: readonly FontRole[]): Preferences['fonts'] {
	const next = { ...preferences.current.fonts };
	for (const role of roles) delete next[role];
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
			...pick('textScale', 'textAlign'),
			fonts: fontsWithout(TEXT_FONT_ROLES),
			assistance: assistanceWith(['explainTerms'])
		}),
	icons: () => preferences.update(pick('iconSet', 'iconOverrides', 'iconScale')),
	board: () => {
		preferences.update({
			assistance: assistanceWith(STORYTELLER_GROUPS.board),
			...pick('cornerLines', 'allowZoom')
		});
		// The player name badge is set in Tokens (Trevor, 2026-10-20), so it keeps its looks.
		const { nameSize, nameOffset } = boardLooks.current;
		boardLooks.update({ ...DEFAULT_BOARD_LOOKS, nameSize, nameOffset });
		stepFocus.update(DEFAULT_STEP_FOCUS);
	},
	tokens: () => {
		preferences.update({
			...pick('tokenAppearance', 'characterIconScale'),
			fonts: fontsWithout(TOKEN_FONT_ROLES)
		});
		boardLooks.update({
			nameSize: DEFAULT_BOARD_LOOKS.nameSize,
			nameOffset: DEFAULT_BOARD_LOOKS.nameOffset
		});
	},
	assistance: () =>
		preferences.update({
			...pick(
				'tileFace',
				'tileOrderRandom',
				'requireName',
				'holdToReveal',
				'slotMachine',
				'ownWording',
				'timerMode',
				'timerKeepAwake',
				'timerPerPlayer',
				'setupForPlayers',
				'coverPin',
				'qrCentre',
				'qrPictureWhole',
				'qrPictureZoom',
				'qrPictureCorners',
				'qrModules',
				'qrFinders'
			),
			assistance: assistanceWith([...STORYTELLER_GROUPS.night, ...STORYTELLER_GROUPS.day])
		})
} satisfies Record<string, () => void>;
