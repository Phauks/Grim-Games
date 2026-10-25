import { LIGHT_SHEET } from './print.ts';

/**
 * The script and night order sheets' background (Trevor, 2026-10-24: "a color selector with
 * several color options like grey, tan, and other neutral colors", in place of light and
 * dark). `theme` is the app's own surface; each other is a set of custom properties set on
 * the sheet, so its text, rules and team colours stay readable on it.
 */
export const SHEET_BACKGROUNDS = [
	'theme',
	'white',
	'parchment',
	'tan',
	'grey',
	'slate',
	'charcoal'
] as const;
export type SheetBackground = (typeof SHEET_BACKGROUNDS)[number];

type Tokens = Readonly<Record<`--${string}`, string>>;

/** A light paper: LIGHT_SHEET's dark ink, on this surface. */
function paper(surface: string, raised: string, selected: string, edge: string): Tokens {
	return {
		...LIGHT_SHEET,
		'--surface': surface,
		'--surface-raised': raised,
		'--surface-selected': selected,
		'--button-edge': edge
	};
}

/** A mid-tone paper (tan, grey): the ink and team colours deepened to keep their contrast. */
function midPaper(surface: string, raised: string, selected: string, edge: string): Tokens {
	return {
		...paper(surface, raised, selected, edge),
		'--on-surface-muted': '#3f3f3f',
		'--good': '#174a85',
		'--evil': '#8a1b18',
		'--traveller-text': '#4a2459',
		'--loric-text': '#21522a'
	};
}

/** A dark paper: light ink, the team colours lightened to stay readable on it. */
function dark(surface: string, raised: string, selected: string): Tokens {
	return {
		'--surface': surface,
		'--surface-raised': raised,
		'--surface-selected': selected,
		'--on-surface': '#f2efe8',
		'--on-surface-muted': '#bdbab3',
		'--heading': '#f2efe8',
		'--border': '#ffffff33',
		'--button-edge': '#9a968e',
		'--good': '#86b8f0',
		'--evil': '#f29a94',
		'--traveller-text': '#d2aee3',
		'--loric-text': '#97d39e'
	};
}

export const SHEET_TOKENS: Readonly<Record<SheetBackground, Tokens | undefined>> = {
	theme: undefined,
	white: paper('#ffffff', '#f1f1f1', '#e2e2e2', '#8c8c8c'),
	parchment: LIGHT_SHEET,
	tan: midPaper('#e9dcc2', '#ddcfb1', '#d0c09d', '#7d6b4b'),
	grey: midPaper('#dadada', '#cdcdcd', '#bfbfbf', '#707070'),
	slate: dark('#2c333b', '#38404a', '#46505c'),
	charcoal: dark('#1f1f1f', '#2b2b2b', '#383838')
};

/** The background as an inline `style` value; undefined keeps the app's own colours. */
export function sheetStyle(background: SheetBackground): string | undefined {
	const tokens = SHEET_TOKENS[background];
	return tokens
		? Object.entries(tokens)
				.map(([name, value]) => `${name}: ${value}`)
				.join('; ')
		: undefined;
}

/** The colour a choice shows in its swatch. */
export function sheetSwatch(background: SheetBackground): string {
	return SHEET_TOKENS[background]?.['--surface'] ?? 'var(--surface)';
}
