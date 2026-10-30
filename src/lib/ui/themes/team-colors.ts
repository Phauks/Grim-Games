/**
 * The good team's blue and the evil team's red (Trevor, 2026-10-28: "the colors associated
 * with teams, the blue and red, should never change, regardless of the theme"). Every theme,
 * sheet background and printed file uses these fills; none sets its own, and they aren't
 * among the custom colours in Settings › Theme.
 */
export const TEAM_COLORS = {
	'--good': '#1f4a7a',
	'--on-good': '#f4e9cf',
	'--evil': '#8c2a1c',
	'--on-evil': '#f4e9cf'
} as const;

/**
 * The Fabled gold and Loric green, fixed the same way: their headings and labels match their
 * tokens in every theme (Trevor, 2026-10-29), so no theme or custom colour sets them either.
 */
export const RULE_COLORS = {
	'--fabled': '#6b4a10',
	'--on-fabled': '#f4e9cf',
	'--loric': '#2e6b34',
	'--on-loric': '#f4e9cf'
} as const;

/** Every colour no theme, sheet background, print or custom colour may change. */
export const FIXED_COLORS = { ...TEAM_COLORS, ...RULE_COLORS } as const;

/**
 * The same blue and red as text on the page. On a light surface the fills read as they are;
 * on a dark one they are too dark to read (about 2:1), so text takes one fixed light tint of
 * each, light enough for every dark surface the app has.
 */
export const TEAM_TEXT = {
	light: { '--good-text': TEAM_COLORS['--good'], '--evil-text': TEAM_COLORS['--evil'] },
	dark: { '--good-text': '#a6cbf5', '--evil-text': '#f6b5b0' }
} as const;
