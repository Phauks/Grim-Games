import { contrastRatio, resolveToken } from './contrast.ts';
import { TEXT_PAIRS, type SemanticToken, type Theme } from './types.ts';

/**
 * The theme colours a person can change one by one in Settings › Theme (Trevor, 2026-10-18).
 * Picking a theme fills every colour; a custom colour replaces just that one token, and the
 * component tokens built from it (sheets, cards, choices) follow. Tokens that aren't one solid
 * colour (the border's see-through line, the backdrop, the shadow) stay the theme's, and the
 * token and reminder faces and ink keep their own settings in Settings › Tokens.
 */
export const COLOR_GROUPS = {
	surfaces: ['--surface', '--surface-glow', '--surface-raised', '--surface-selected'],
	text: ['--on-surface', '--on-surface-muted', '--heading'],
	accents: ['--accent', '--on-accent', '--focus', '--button', '--on-button'],
	// No team colours: the good blue and evil red never change (team-colors.ts).
	types: ['--traveller', '--on-traveller', '--fabled', '--on-fabled', '--loric', '--on-loric'],
	// The token face, reminder face and their ink are in Settings › Tokens already.
	tokens: ['--token-rim', '--token-flower', '--token-flower-centre', '--leaf'],
	sheets: ['--sheet', '--on-sheet', '--on-sheet-muted']
} as const satisfies Record<string, readonly SemanticToken[]>;

export type ColorGroup = keyof typeof COLOR_GROUPS;
export type ColorToken = (typeof COLOR_GROUPS)[ColorGroup][number];
export type CustomColors = Partial<Record<ColorToken, string>>;

export const COLOR_TOKENS: readonly ColorToken[] = Object.values(COLOR_GROUPS).flat();

const HEX = /^#[0-9a-f]{6}$/i;

/** Keeps only known tokens with a six-digit hex colour, as the colour picker gives. */
export function parseColors(raw: unknown): CustomColors {
	const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const colors: CustomColors = {};
	for (const token of COLOR_TOKENS) {
		const value = input[token];
		if (typeof value === 'string' && HEX.test(value)) colors[token] = value.toLowerCase();
	}
	return colors;
}

/** The theme's own colour for a token as #rrggbb, following its palette references. */
export function themeColor(theme: Theme, token: ColorToken): string {
	const value = resolveToken(token, { ...theme.palette, ...theme.tokens });
	return expandHex(value) ?? '#000000';
}

function expandHex(value: string): string | undefined {
	const v = value.trim().toLowerCase();
	if (HEX.test(v)) return v;
	if (/^#[0-9a-f]{3}$/.test(v)) return `#${[...v.slice(1)].map((d) => d + d).join('')}`;
	return undefined;
}

/** The colour in use: the custom one, else the theme's. */
export function colorFor(theme: Theme, colors: CustomColors, token: ColorToken): string {
	return colors[token] ?? themeColor(theme, token);
}

export interface ContrastWarning {
	text: ColorToken;
	background: ColorToken;
	ratio: number;
}

/**
 * Text and background pairs under 4.5:1 that involve a custom colour, for a token. Warns,
 * never blocks: the person may want it (Storyteller overrides anything).
 */
export function contrastWarnings(
	theme: Theme,
	colors: CustomColors,
	token: ColorToken
): ContrastWarning[] {
	const isColor = (t: SemanticToken): t is ColorToken => (COLOR_TOKENS as string[]).includes(t);
	return TEXT_PAIRS.flatMap(([text, background]) => {
		if (!isColor(text) || !isColor(background)) return [];
		if (text !== token && background !== token) return [];
		if (!colors[text] && !colors[background]) return [];
		const ratio = contrastRatio(colorFor(theme, colors, text), colorFor(theme, colors, background));
		return ratio < 4.5 ? [{ text, background, ratio }] : [];
	});
}
