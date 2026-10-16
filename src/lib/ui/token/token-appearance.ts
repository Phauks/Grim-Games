import type { PlainMessageKey } from '#lib/i18n/catalog.ts';
import { contrastRatio, resolveToken } from '#lib/ui/themes/contrast.ts';
import type { CssVariable, Theme } from '#lib/ui/themes/types.ts';

/**
 * The user's own token colours and sizes (Trevor, 2026-10-16: "Allow customizing color of
 * tokens" and "Allow setting token and reminder token sizing"). Stored with the device's
 * preferences; applied as CSS variables that the token, reminder and board components read.
 */
export const TOKEN_COLOURS = [
	{
		key: 'face',
		label: 'characters.colour.face',
		description: 'characters.colour.faceHelp',
		variables: ['--token-face']
	},
	{
		key: 'reminder',
		label: 'characters.colour.reminder',
		description: 'characters.colour.reminderHelp',
		variables: ['--reminder-face']
	},
	{
		key: 'ink',
		label: 'characters.colour.ink',
		description: 'characters.colour.inkHelp',
		variables: ['--on-token', '--on-reminder']
	}
] as const satisfies readonly {
	key: string;
	/** Catalog keys for the setting's label and description. */
	label: PlainMessageKey;
	description: PlainMessageKey;
	variables: readonly CssVariable[];
}[];

export type TokenColour = (typeof TOKEN_COLOURS)[number]['key'];

/**
 * Character token and reminder sizes, as multiples of the size each screen draws them at:
 * 50% to 200% in 5% steps (Trevor, 2026-10-16: "granular slider of percentage"). The old
 * S/M/L/XL choices (0.75, 1, 1.25, 1.5) are steps on this range, so saved sizes keep.
 */
export const TOKEN_SCALE = { min: 0.5, max: 2, step: 0.05 } as const;

/** A saved size, kept on the range and on a step; anything else is 100%. */
export function parseScale(raw: unknown): number {
	if (typeof raw !== 'number' || !Number.isFinite(raw)) return 1;
	const clamped = Math.min(TOKEN_SCALE.max, Math.max(TOKEN_SCALE.min, raw));
	return (Math.round(clamped / TOKEN_SCALE.step) * 5) / 100;
}

export interface TokenAppearance {
	/** Only the colours the user changed; the rest follow the theme. */
	colours: Partial<Record<TokenColour, string>>;
	tokenScale: number;
	reminderScale: number;
	/** The character's name curved along the bottom of grimoire tokens (Trevor, 2026-10-16). */
	boardNames: boolean;
	/** Where that name sits; the icon stays in the middle either way (Trevor, 2026-10-16). */
	namePosition: NamePosition;
}

export type NamePosition = 'top' | 'bottom';

export const DEFAULT_TOKEN_APPEARANCE: TokenAppearance = {
	colours: {},
	tokenScale: 1,
	reminderScale: 1,
	boardNames: false,
	namePosition: 'bottom'
};

const HEX = /^#[0-9a-f]{6}$/i;

/** Valid settings from anything saved (older builds, hand edits). */
export function parseTokenAppearance(raw: unknown): TokenAppearance {
	const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const saved = (input.colours && typeof input.colours === 'object' ? input.colours : {}) as Record<
		string,
		unknown
	>;
	const colours: TokenAppearance['colours'] = {};
	for (const { key } of TOKEN_COLOURS) {
		const value = saved[key];
		if (typeof value === 'string' && HEX.test(value)) colours[key] = value.toLowerCase();
	}
	return {
		colours,
		tokenScale: parseScale(input.tokenScale),
		reminderScale: parseScale(input.reminderScale),
		boardNames: input.boardNames === true,
		namePosition: input.namePosition === 'top' ? 'top' : 'bottom'
	};
}

/**
 * The CSS variables to write after the theme's: `--token-scale` and `--reminder-scale`
 * always, and each changed colour.
 */
export function tokenVariables(appearance: TokenAppearance): Record<CssVariable, string> {
	const variables: Record<CssVariable, string> = {
		'--token-scale': String(appearance.tokenScale),
		'--reminder-scale': String(appearance.reminderScale)
	};
	for (const { key, variables: names } of TOKEN_COLOURS) {
		const value = appearance.colours[key];
		if (value) for (const name of names) variables[name] = value;
	}
	return variables;
}

/** A colour as it shows now: the user's choice, else the theme's (as #rrggbb). */
export function tokenColour(key: TokenColour, appearance: TokenAppearance, theme: Theme): string {
	const chosen = appearance.colours[key];
	if (chosen) return chosen;
	const variable = TOKEN_COLOURS.find((c) => c.key === key)!.variables[0];
	return resolveToken(variable, { ...theme.palette, ...theme.tokens });
}

/** WCAG AA for normal text. */
export const MIN_CONTRAST = 4.5;

/** How well the token text reads on each face (contrast ratio, 1 to 21). */
export function tokenContrast(
	appearance: TokenAppearance,
	theme: Theme
): { face: number; reminder: number } {
	const ink = tokenColour('ink', appearance, theme);
	return {
		face: contrastRatio(ink, tokenColour('face', appearance, theme)),
		reminder: contrastRatio(ink, tokenColour('reminder', appearance, theme))
	};
}
