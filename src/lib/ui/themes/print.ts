/**
 * Colours for files the app saves to read or print outside it (a game recap): dark ink on
 * white paper, whatever theme the app is in.
 */
export const PRINT_PALETTE = {
	ink: '#1b1b1b',
	muted: '#666666',
	rule: '#cccccc',
	faint: '#eeeeee',
	good: '#1f5fa8',
	evil: '#a8231f',
	paper: '#ffffff'
} as const;

/**
 * A script sheet's Light background (Trevor, 2026-10-23: the preview is hard to read on the
 * dark theme): dark ink on light paper whatever the theme, the team colours darkened to stay
 * readable on it. Set as custom properties on the sheet, so everything inside follows.
 */
export const LIGHT_SHEET: Readonly<Record<`--${string}`, string>> = {
	'--surface': '#fbf8f1',
	'--surface-raised': '#efe9dc',
	'--surface-selected': '#e2d9c6',
	'--on-surface': PRINT_PALETTE.ink,
	'--on-surface-muted': '#555555',
	'--heading': PRINT_PALETTE.ink,
	'--border': '#0000002e',
	'--button-edge': '#76674b',
	'--good': PRINT_PALETTE.good,
	'--evil': PRINT_PALETTE.evil,
	'--good-text': PRINT_PALETTE.good,
	'--evil-text': PRINT_PALETTE.evil,
	'--traveller-text': '#5c2f6e',
	'--loric-text': '#2e6b34'
};
