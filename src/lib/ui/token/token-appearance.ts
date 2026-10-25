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
		// The line round the face, separate from its fill (Trevor, 2026-10-18).
		key: 'rim',
		label: 'characters.colour.rim',
		description: 'characters.colour.rimHelp',
		variables: ['--token-face-shade']
	},
	{
		key: 'reminder',
		label: 'characters.colour.reminder',
		description: 'characters.colour.reminderHelp',
		variables: ['--reminder-face']
	},
	{
		// The band behind a reminder's words, separate from its face (Trevor, 2026-10-18).
		// Unset, it follows the face.
		key: 'reminderLabel',
		label: 'characters.colour.reminderLabel',
		description: 'characters.colour.reminderLabelHelp',
		variables: ['--reminder-label-face'],
		follows: 'reminder'
	},
	{
		key: 'ink',
		label: 'characters.colour.ink',
		description: 'characters.colour.inkHelp',
		variables: ['--on-token']
	},
	{
		// Its own text colour (Trevor, 2026-10-18: "should be different from character token
		// text color"). Saved settings from before take the character token's.
		key: 'reminderInk',
		label: 'characters.colour.reminderInk',
		description: 'characters.colour.reminderInkHelp',
		variables: ['--on-reminder']
	}
] as const satisfies readonly {
	key: string;
	/** Catalog keys for the setting's label and description. */
	label: PlainMessageKey;
	description: PlainMessageKey;
	variables: readonly CssVariable[];
	/** Not a theme colour: unset, it shows as this colour does. */
	follows?: string;
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

/**
 * The character's icon inside a character token or reminder token, as a multiple of its
 * usual share of the face (Trevor, 2026-10-23): 50% to 125% in 5% steps, so it stays
 * inside the token.
 */
export const ICON_SCALE = { min: 0.5, max: 1.25, step: 0.05 } as const;

function parseIconScale(raw: unknown): number {
	if (typeof raw !== 'number' || !Number.isFinite(raw)) return 1;
	const clamped = Math.min(ICON_SCALE.max, Math.max(ICON_SCALE.min, raw));
	return (Math.round(clamped / ICON_SCALE.step) * 5) / 100;
}

/**
 * How wide a reminder's words may run, as a multiple of the reminder's width (Trevor,
 * 2026-10-17: "red he..."): 100% to 300% in 25% steps.
 */
export const REMINDER_LABEL_WIDTH = { min: 1, max: 3, step: 0.25 } as const;

function parseLabelWidth(raw: unknown): number {
	if (typeof raw !== 'number' || !Number.isFinite(raw)) return 1.5;
	const { min, max, step } = REMINDER_LABEL_WIDTH;
	return Math.round(Math.min(max, Math.max(min, raw)) / step) * step;
}

export interface TokenAppearance {
	/** Only the colours the user changed; the rest follow the theme. */
	colours: Partial<Record<TokenColour, string>>;
	tokenScale: number;
	reminderScale: number;
	/** The character's icon on character tokens and on reminder tokens, on ICON_SCALE. */
	tokenIconScale: number;
	reminderIconScale: number;
	/** The character's name curved along the bottom of grimoire tokens (Trevor, 2026-10-16). */
	boardNames: boolean;
	/**
	 * The side leaves that mark a character who acts on the first night (left) and other
	 * nights (right), and whether night order numbers sit on them in badges (Trevor,
	 * 2026-10-17; 2026-10-22: one setting with the leaves).
	 */
	nightLeaves: NightLeaves;
	/** Size of those badges, on the same 50% to 200% range. */
	nightBadgeScale: number;
	/** The widest a reminder's words run, on REMINDER_LABEL_WIDTH. */
	reminderLabelWidth: number;
	/** Words too long for that width go onto more lines instead of ending in "…". */
	reminderLabelWrap: boolean;
	/**
	 * Size of reminder chips inside lines of text, on the same range (Trevor, 2026-10-18:
	 * "add the settings for in-line reminder tokens"). Earlier they followed reminderScale.
	 */
	inlineReminderScale: number;
	/** The owner's icon on those chips. */
	inlineReminderIconScale: number;
	/** The chip itself round its words and icon. */
	inlineReminderBadgeScale: number;
	/**
	 * Character names inside lines of text: the name's text, its icon and the badge round
	 * them, each on its own (Trevor, 2026-10-18: "they are all different to me").
	 */
	inlineNameTextScale: number;
	inlineNameIconScale: number;
	inlineNameBadgeScale: number;
	/** The top leaves that count a character's reminder tokens (Trevor, 2026-10-18). */
	reminderLeaves: boolean;
	/** The setup flower at the bottom right of a character that changes setup; off by default. */
	setupFlower: boolean;
	/** Whether the setup flower shortens the name on the token to stay clear of it (off, Trevor 2026-10-19). */
	setupMovesName: boolean;
	/**
	 * The highlight on reminders that belong to a held seat or the night's step (Trevor,
	 * 2026-10-20: "reminder glow effects, on/off and how they look").
	 */
	reminderHighlight: boolean;
	reminderHighlightLook: ReminderHighlightLook;
}

/** A ring round the reminder, a glow, or both, as a picked seat (SeatToken). */
/** Off, the leaves alone, or the leaves with night order numbers on them. */
export const NIGHT_LEAVES = ['off', 'leaves', 'numbers'] as const;
export type NightLeaves = (typeof NIGHT_LEAVES)[number];
export const REMINDER_HIGHLIGHT_LOOKS = ['ring', 'glow', 'both'] as const;
export type ReminderHighlightLook = (typeof REMINDER_HIGHLIGHT_LOOKS)[number];
/**
 * The icon in the alignment of the player who put the token down (red for a turned-evil good
 * player, Trevor 2026-10-16), in the character's usual alignment, or plain (unaligned).
 */

const oneOf = <T extends string>(choices: readonly T[], raw: unknown, fallback: T): T =>
	choices.includes(raw as T) ? (raw as T) : fallback;

export const DEFAULT_TOKEN_APPEARANCE: TokenAppearance = {
	colours: {},
	tokenScale: 1,
	reminderScale: 1,
	tokenIconScale: 1,
	reminderIconScale: 1,
	boardNames: false,
	nightLeaves: 'leaves',
	nightBadgeScale: 1,
	reminderLabelWidth: 1.5,
	reminderLabelWrap: false,
	inlineReminderScale: 1,
	inlineReminderIconScale: 1,
	inlineReminderBadgeScale: 1,
	inlineNameTextScale: 1,
	inlineNameIconScale: 1,
	inlineNameBadgeScale: 1,
	reminderLeaves: true,
	setupFlower: false,
	setupMovesName: false,
	reminderHighlight: true,
	reminderHighlightLook: 'ring'
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
	// One text colour covered both kinds of token before 2026-10-18. Settings saved since then
	// always carry reminderLeaves, which came in the same change.
	if (colours.ink && !colours.reminderInk && input.reminderLeaves === undefined)
		colours.reminderInk = colours.ink;
	return {
		colours,
		tokenScale: parseScale(input.tokenScale),
		reminderScale: parseScale(input.reminderScale),
		tokenIconScale: parseIconScale(input.tokenIconScale),
		reminderIconScale: parseIconScale(input.reminderIconScale),
		// Earlier builds' `namePlacement` and `playerNamePlacement` are dropped: the character
		// name always curves along the edge and the player name is always a badge.
		boardNames: input.boardNames === true,
		// Earlier builds' `nightNumbers` switch: on became Leaves and numbers.
		nightLeaves: oneOf(
			NIGHT_LEAVES,
			input.nightLeaves,
			input.nightNumbers === true ? 'numbers' : 'leaves'
		),
		nightBadgeScale: parseScale(input.nightBadgeScale),
		reminderLabelWidth: parseLabelWidth(input.reminderLabelWidth),
		reminderLabelWrap: input.reminderLabelWrap === true,
		inlineReminderScale: parseScale(input.inlineReminderScale),
		inlineReminderIconScale: parseScale(input.inlineReminderIconScale),
		inlineReminderBadgeScale: parseScale(input.inlineReminderBadgeScale),
		inlineNameTextScale: parseScale(input.inlineNameTextScale),
		inlineNameIconScale: parseScale(input.inlineNameIconScale),
		inlineNameBadgeScale: parseScale(input.inlineNameBadgeScale),
		// Earlier builds' `inlineReminderIcons` is dropped: chips in text always show the
		// owner's icon (Trevor, 2026-10-18).
		reminderLeaves: input.reminderLeaves !== false,
		setupFlower: input.setupFlower === true,
		setupMovesName: input.setupMovesName === true,
		reminderHighlight: input.reminderHighlight !== false,
		reminderHighlightLook: oneOf(REMINDER_HIGHLIGHT_LOOKS, input.reminderHighlightLook, 'ring')
		// Earlier builds' `reminderIcon` switch is dropped: the owner's icon always shows, and
		// their `reminderIconColour` too: it is always the owner's alignment (Trevor, 2026-10-23).
		// Earlier builds' `genericIconFill` switch is dropped: each ∞ token has its own
		// (Trevor, 2026-10-23).
	};
}

/**
 * The CSS variables to write after the theme's: the sizes (`--token-scale`,
 * `--reminder-scale`, `--night-badge-scale`) and reminder words (`--reminder-label-width`,
 * `--reminder-label-wrap`, a white-space value, and `--reminder-label-min`, so wrapped
 * words never get cut), names and reminders in text (`--inline-reminder-scale`, the words, `--inline-reminder-icon`,
 * `--inline-reminder-badge`, `--inline-name-text`, `--inline-name-icon`, `--inline-name-badge`),
 * the lit reminders' highlight (`--reminder-lit-ring`, `--reminder-lit-glow`) always, and each
 * changed colour.
 */
export function tokenVariables(appearance: TokenAppearance): Record<CssVariable, string> {
	const look = appearance.reminderHighlight ? appearance.reminderHighlightLook : undefined;
	const ring = look === 'ring' || look === 'both';
	const glow = look === 'glow' || look === 'both';
	const variables: Record<CssVariable, string> = {
		'--token-scale': String(appearance.tokenScale),
		'--reminder-scale': String(appearance.reminderScale),
		'--token-icon': String(appearance.tokenIconScale),
		'--reminder-icon': String(appearance.reminderIconScale),
		'--night-badge-scale': String(appearance.nightBadgeScale),
		'--reminder-label-width': String(appearance.reminderLabelWidth),
		'--reminder-label-wrap': appearance.reminderLabelWrap ? 'normal' : 'nowrap',
		'--reminder-label-min': appearance.reminderLabelWrap ? 'min-content' : '0',
		'--inline-reminder-scale': String(appearance.inlineReminderScale),
		'--inline-reminder-icon': String(appearance.inlineReminderIconScale),
		'--inline-reminder-badge': String(appearance.inlineReminderBadgeScale),
		'--inline-name-text': String(appearance.inlineNameTextScale),
		'--inline-name-icon': String(appearance.inlineNameIconScale),
		'--inline-name-badge': String(appearance.inlineNameBadgeScale),
		// The highlight on lit reminders: a ring (outline) and a glow (drop-shadow), each or none.
		'--reminder-lit-ring': ring ? '0.2rem solid var(--accent)' : 'none',
		'--reminder-lit-glow': glow ? 'drop-shadow(0 0 0.35rem var(--accent))' : 'none'
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
	const colour: (typeof TOKEN_COLOURS)[number] = TOKEN_COLOURS.find((c) => c.key === key)!;
	if ('follows' in colour) return tokenColour(colour.follows, appearance, theme);
	const variable = colour.variables[0];
	return resolveToken(variable, { ...theme.palette, ...theme.tokens });
}

/** WCAG AA for normal text. */
export const MIN_CONTRAST = 4.5;

/** How well the token text reads on each face (contrast ratio, 1 to 21). */
export function tokenContrast(
	appearance: TokenAppearance,
	theme: Theme
): { face: number; reminder: number } {
	return {
		face: contrastRatio(
			tokenColour('ink', appearance, theme),
			tokenColour('face', appearance, theme)
		),
		// The words sit on the band on the board and on the face in text: the worse of the two.
		reminder: Math.min(
			...(['reminderLabel', 'reminder'] as const).map((key) =>
				contrastRatio(
					tokenColour('reminderInk', appearance, theme),
					tokenColour(key, appearance, theme)
				)
			)
		)
	};
}
