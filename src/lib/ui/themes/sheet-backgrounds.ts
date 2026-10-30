import { LIGHT_SHEET } from './print.ts';
import { parseHex, relativeLuminance } from './contrast.ts';
import { TEAM_TEXT } from './team-colors.ts';
import type { Theme } from './types.ts';

/**
 * The script and night order sheets' background (Trevor, 2026-10-24: "a color selector with
 * several color options like grey, tan, and other neutral colors", in place of light and
 * dark). `theme` is the app's own surface; each other is a set of custom properties set on
 * the sheet, so its text and rules stay readable on it. The team colours never change
 * (team-colors.ts): only their text picks the light or dark surface version.
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

/** A mid-tone paper (tan, grey): the ink deepened to keep its contrast. */
function midPaper(surface: string, raised: string, selected: string, edge: string): Tokens {
	return {
		...paper(surface, raised, selected, edge),
		'--on-surface-muted': '#3f3f3f',
		'--traveller-text': '#4a2459'
	};
}

/** A dark paper: light ink, and the team colours' text for a dark surface. */
function dark(surface: string, raised: string, selected: string): Tokens {
	return {
		'--surface': surface,
		'--surface-raised': raised,
		'--surface-selected': selected,
		'--on-surface': '#f2efe8',
		'--on-surface-muted': '#bdbab3',
		'--heading': '#f2efe8',
		'--border': '#ffffff33',
		'--button-edge': '#a8a49c',
		...TEAM_TEXT.dark,
		'--traveller-text': '#d2aee3'
	};
}

export const SHEET_TOKENS: Readonly<Record<SheetBackground, Tokens | undefined>> = {
	theme: undefined,
	white: paper('#ffffff', '#f1f1f1', '#e2e2e2', '#767676'),
	parchment: LIGHT_SHEET,
	tan: midPaper('#e9dcc2', '#ddcfb1', '#d0c09d', '#6b5a3c'),
	grey: midPaper('#dadada', '#cdcdcd', '#bfbfbf', '#5f5f5f'),
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

/**
 * Everything else a light paper changes when it colours the whole player screen (Trevor,
 * 2026-10-25: "Player screen, sheets follow"): dark headings, focus ring and coloured JSON,
 * and edges that still show against the paper. Buttons keep the theme's dark fill.
 */
const LIGHT_SCREEN: Tokens = {
	'--focus': '#7a1d12',
	'--accent-edge': '#7a1d12',
	'--danger-edge': '#7a1d12',
	'--code-key': '#5a3d0a',
	'--code-string': '#1f5226',
	'--code-number': '#4a2459',
	'--code-literal': '#7a3a08',
	'--code-punctuation': '#3f3f3f'
};

/**
 * The same for a dark paper. Toasts take the paper's raised colour, as a parchment toast
 * would need edges no dark paper's buttons can share.
 */
function darkScreen(tokens: Tokens): Tokens {
	return {
		'--accent-edge': '#e8907e',
		'--danger-edge': '#e8907e',
		'--sheet': tokens['--surface-raised']!,
		'--on-sheet': tokens['--on-surface']!,
		'--on-sheet-muted': tokens['--on-surface-muted']!,
		'--code-key': '#e7c873',
		'--code-string': '#97d39e',
		'--code-number': '#d2aee3',
		'--code-literal': '#f0b070',
		'--code-punctuation': '#c8c5be'
	};
}

/**
 * The whole player screen in this background (Trevor, 2026-10-25): the app theme with the
 * sheet's colours on top, written on the page so dialogs, sheets and toasts follow too.
 * Undefined for `theme`, which keeps the app's own colours.
 */
export function sheetTheme(background: SheetBackground, base: Theme): Theme | undefined {
	const tokens = SHEET_TOKENS[background];
	if (!tokens) return undefined;
	const light = isLight(tokens['--surface']!);
	const surface = tokens['--surface']!;
	return {
		...base,
		id: `${base.id}-${background}`,
		colorScheme: light ? 'light' : 'dark',
		tokens: {
			...base.tokens,
			...(light ? LIGHT_SCREEN : darkScreen(tokens)),
			...tokens,
			// One flat colour: the theme's glow and texture are for its own surface.
			'--surface-glow': surface,
			'--surface-texture': surface
		},
		// The scratch pad's parchment paper stays parchment, whatever the toasts become.
		components: {
			...base.components,
			'--scratch-parchment-paper': base.tokens['--sheet'],
			'--scratch-parchment-ink': base.tokens['--on-sheet']
		}
	};
}

/** Lighter than mid-grey: takes the light paper's ink and edges. */
function isLight(hex: string): boolean {
	return relativeLuminance(parseHex(hex)) > 0.18;
}
