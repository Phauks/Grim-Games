import { FONT_ROLES, isFontFor, type FontId, type FontRole } from '#lib/ui/fonts/catalogue.ts';
import {
	ICON_SETS,
	ICON_SLOTS,
	iconSlots,
	isIconChoice,
	isIconSetId,
	withWeight,
	type IconSetId,
	type IconSlot
} from '#lib/ui/icons/catalogue.ts';
import { DEFAULT_ASSISTANCE, parseAssistance, type Assistance } from '#lib/ui/assistance.ts';
import { DEFAULT_CORNER_LINES, parseCornerLines, type CornerLines } from '#lib/ui/corner-lines.ts';
import { DEFAULT_THEME_ID, isThemeId } from '#lib/ui/themes/registry.ts';
import {
	DEFAULT_TOKEN_APPEARANCE,
	parseTokenAppearance,
	type TokenAppearance
} from '#lib/ui/token/token-appearance.ts';
import type { Theme } from '#lib/ui/themes/types.ts';
import { parseColors, type CustomColors } from '#lib/ui/themes/colors.ts';
import {
	DAY_SECONDS_PER_ALIVE,
	DAY_SECONDS_PER_ALIVE_MAX,
	DAY_SECONDS_PER_ALIVE_MIN
} from '#lib/core/rules/day-timer.ts';
import { DEFAULT_AMBIENCE, parseAmbience } from '#lib/core/sound/ambience.ts';

/**
 * Per-device look-and-feel preferences (04-architecture.md §9). Separate from game state
 * and never synced to rooms. `null` means "use the theme's default".
 */
export interface Preferences {
	themeId: string;
	/** Theme colours the user changed one by one; the rest come from the theme. */
	colors: CustomColors;
	/** The user's font for each role; a missing role uses the theme's font. */
	fonts: Partial<Record<FontRole, FontId>>;
	textScale: TextScale;
	/** Multiplies the size of interface icons; independent of text size. */
	iconScale: IconScale;
	/** Multiplies the size of character art in badges and lists (Trevor, 2026-10-16), not tokens. */
	characterIconScale: IconScale;
	/** How paragraphs of body text line up: ragged right, or justified to both edges. */
	textAlign: TextAlign;
	/**
	 * Two fingers can zoom the page. Off by default (Trevor, 2026-10-19: two thumbs on the board
	 * zoomed the app by accident); Text size enlarges everything instead.
	 */
	allowZoom: boolean;
	iconSet: IconSetId | null;
	iconOverrides: Partial<Record<IconSlot, string>>;
	/** Character token and reminder token sizes, and any token colours the user changed. */
	tokenAppearance: TokenAppearance;
	/** How much the app walks the Storyteller through the game. */
	assistance: Assistance;
	/** Which of Game info's lines the board's corner shows (corner-lines.ts). */
	cornerLines: CornerLines;
	/** What face-down bag tiles show on the draw screen. */
	tileFace: TileFace;
	/**
	 * A player types their name before they can see the token they drew, in the
	 * pass-the-phone draw and when drawing on their own phone (Trevor, 2026-10-16).
	 */
	requireName: boolean;
	/** The drawn token shows only while it's held down (Trevor, 2026-10-20: a setting, off). */
	holdToReveal: boolean;
	/** Bag tile labels come in a random order (Trevor, 2026-10-20). */
	tileOrderRandom: boolean;
	/**
	 * The drawn token spins like a slot machine through the script's characters before it
	 * stops on the player's (Trevor, 2026-10-22: a Bag draw setting, off). Purely visual: the
	 * character was decided when the tile was drawn.
	 */
	slotMachine: boolean;
	/**
	 * Show text in our own wording that Trevor hasn't approved yet, such as the game modes'
	 * About descriptions; off by default, when only source text and links show (no authored
	 * content, Trevor 2026-10-15).
	 */
	ownWording: boolean;
	/**
	 * Share's view-only grimoire part hides its QR code and link, e.g. while streaming (Trevor,
	 * 2026-10-21); Copy and Share still work.
	 */
	hideWatchLink: boolean;
	/** How loud every app sound plays on this device, 0 (silent) to 1 (plan U1). */
	soundVolume: number;
	/** The sound when the day timer runs out (Trevor, 2026-10-17). */
	timerSound: TimerSound;
	/** The day timer counts down to 0:00 or up past its target (Trevor, 2026-10-17). */
	timerMode: TimerMode;
	/**
	 * The device vibrates with its alerts: the day timer running out (Trevor, 2026-10-18) and
	 * a Back to town call (plan U2).
	 */
	timerVibrate: boolean;
	/** The sound a player's phone makes when the Storyteller calls Back to town (plan U2). */
	callSound: TimerSound;
	/** Day and night sound plays on the board (plan U3). */
	ambienceOn: boolean;
	/** How loud day and night sound plays, under the device's volume (plan U3). */
	ambienceLevel: number;
	/** The recording that plays in the night, by id (plan U3). */
	nightAmbience: string;
	/** The recording that plays in the day, by id (plan U3). */
	dayAmbience: string;
	/** The screen stays on while the day timer runs (Trevor, 2026-10-19). */
	timerKeepAwake: boolean;
	/** The day timer's starting seconds per living player (Trevor, 2026-10-19). */
	timerPerPlayer: number;
	/**
	 * How players' phones show the day timer in a live room (Trevor, 2026-10-26: "sun or timer
	 * for players", the Storyteller decides).
	 */
	timerForPlayers: TimerForPlayers;
	/**
	 * What goes in the middle of a share QR code (Trevor, 2026-10-20, plan R1): the script's
	 * logo (or its name), the Storyteller's own picture, or nothing.
	 */
	qrCentre: QrCentre;
	/**
	 * How the Storyteller's picture sits in the QR's middle (Trevor, 2026-10-23: "allow some
	 * controls to help the user shape how they want their logo to appear"): the whole picture
	 * or filling the square, how far it is zoomed in, and its corners.
	 */
	qrPictureWhole: boolean;
	qrPictureZoom: number;
	qrPictureCorners: QrPictureCorners;
	/**
	 * The shape of the QR code's squares and of its three corner markers (Trevor, 2026-10-23:
	 * "options for circles or dots and the like"). Dark on light whatever the shape.
	 */
	qrModules: QrModules;
	qrFinders: QrFinders;
}

export const QR_CENTRES = ['script', 'picture', 'none'] as const;
export type QrCentre = (typeof QR_CENTRES)[number];
export const QR_PICTURE_CORNERS = ['square', 'rounded', 'circle'] as const;
export type QrPictureCorners = (typeof QR_PICTURE_CORNERS)[number];
/** The picture's zoom, from the whole square to twice as close. */
export const QR_PICTURE_ZOOM: ScaleRange = { min: 1, max: 2, step: 0.05 };
export const QR_MODULES = ['square', 'rounded', 'dot'] as const;
export type QrModules = (typeof QR_MODULES)[number];
export const QR_FINDERS = ['square', 'rounded', 'circle'] as const;
export type QrFinders = (typeof QR_FINDERS)[number];

export const TIMER_MODES = ['down', 'up'] as const;
export type TimerMode = (typeof TIMER_MODES)[number];

/** How players' phones show the day timer: a sun, the clock, or not at all. */
export const TIMER_FOR_PLAYERS = ['sun', 'timer', 'off'] as const;
export type TimerForPlayers = (typeof TIMER_FOR_PLAYERS)[number];

/** The day timer's finishing sounds, made on the device (no audio files); or none. */
export const TIMER_SOUNDS = ['bell', 'chime', 'clocktower', 'buzzer', 'none'] as const;
export type TimerSound = (typeof TIMER_SOUNDS)[number];

/**
 * Numbers or letters (Trevor, 2026-10-16). The random symbols this replaced read back as
 * the default, numbers.
 */
export const TILE_FACES = [
	'numbers',
	'letters',
	'roman',
	'symbols',
	'colours',
	'emoji',
	'random',
	'none'
] as const;
export type TileFace = (typeof TILE_FACES)[number];

/** A size as a fraction of normal (1 = 100%), chosen on a slider (Trevor, 2026-10-16). */
export interface ScaleRange {
	min: number;
	max: number;
	step: number;
}

/** Text size: 75% to 150% in 5% steps; 150% is the largest the layouts are tested at. */
export const TEXT_SCALE: ScaleRange = { min: 0.75, max: 1.5, step: 0.05 };
/** Icon size, same range as text. */
export const ICON_SCALE: ScaleRange = { min: 0.75, max: 1.5, step: 0.05 };
/** Sound volume: silent to full in 5% steps (plan U1). */
export const SOUND_VOLUME: ScaleRange = { min: 0, max: 1, step: 0.05 };
/** Day and night sound's level, under the device's volume (plan U3). */
export const AMBIENCE_LEVEL: ScaleRange = { min: 0.05, max: 1, step: 0.05 };

export type TextScale = number;
export type IconScale = number;

/**
 * A stored size snapped to its slider: the nearest step, inside the range. Sizes saved by
 * older builds (0.875, 1.125 from the S/M/L choices) become the nearest 5%.
 */
export function parseScale(input: unknown, range: ScaleRange, fallback = 1): number {
	if (typeof input !== 'number' || !Number.isFinite(input)) return fallback;
	const clamped = Math.min(range.max, Math.max(range.min, input));
	const steps = Math.round((clamped - range.min) / range.step);
	return Math.round((range.min + steps * range.step) * 1000) / 1000;
}

export const TEXT_ALIGNS = ['left', 'justify'] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

export const DEFAULT_PREFERENCES: Preferences = {
	themeId: DEFAULT_THEME_ID,
	colors: {},
	fonts: {},
	textScale: 1,
	iconScale: 1,
	characterIconScale: 1,
	textAlign: 'left',
	allowZoom: false,
	iconSet: null,
	iconOverrides: {},
	tokenAppearance: DEFAULT_TOKEN_APPEARANCE,
	assistance: DEFAULT_ASSISTANCE,
	cornerLines: DEFAULT_CORNER_LINES,
	tileFace: 'numbers',
	requireName: false,
	holdToReveal: false,
	slotMachine: false,
	tileOrderRandom: false,
	ownWording: false,
	hideWatchLink: false,
	soundVolume: 1,
	timerSound: 'bell',
	timerMode: 'down',
	timerVibrate: true,
	callSound: 'clocktower',
	ambienceOn: false,
	ambienceLevel: 0.6,
	nightAmbience: DEFAULT_AMBIENCE.night,
	dayAmbience: DEFAULT_AMBIENCE.day,
	timerKeepAwake: true,
	timerPerPlayer: DAY_SECONDS_PER_ALIVE,
	timerForPlayers: 'sun',
	qrCentre: 'script',
	qrPictureWhole: false,
	qrPictureZoom: 1,
	qrPictureCorners: 'rounded',
	qrModules: 'square',
	qrFinders: 'square'
};

function oneOf<T extends string>(values: readonly T[], input: unknown, fallback: T): T {
	return (values as readonly unknown[]).includes(input) ? (input as T) : fallback;
}

/** Icon slots saved under an older name: new name -> old name. */
const RENAMED_SLOTS: Partial<Record<IconSlot, string>> = { edit: 'rename' };

/** Builds valid preferences from anything (old versions, hand edits, garbage). */
export function parsePreferences(raw: unknown): Preferences {
	const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const overrides = (
		input.iconOverrides && typeof input.iconOverrides === 'object' ? input.iconOverrides : {}
	) as Record<string, unknown>;
	const iconOverrides: Preferences['iconOverrides'] = {};
	for (const slot of iconSlots) {
		const id = overrides[slot] ?? overrides[RENAMED_SLOTS[slot] ?? ''];
		if (isIconChoice(slot, id)) iconOverrides[slot] = id;
	}
	const iconScale = parseScale(input.iconScale, ICON_SCALE, DEFAULT_PREFERENCES.iconScale);
	return {
		themeId: isThemeId(input.themeId) ? input.themeId : DEFAULT_PREFERENCES.themeId,
		colors: parseColors(input.colors),
		fonts: parseFonts(input),
		textScale: parseScale(input.textScale, TEXT_SCALE, DEFAULT_PREFERENCES.textScale),
		iconScale,
		// Saved before the split, the one icon size applied to both.
		characterIconScale: parseScale(input.characterIconScale, ICON_SCALE, iconScale),
		textAlign: (TEXT_ALIGNS as readonly unknown[]).includes(input.textAlign)
			? (input.textAlign as TextAlign)
			: DEFAULT_PREFERENCES.textAlign,
		allowZoom:
			typeof input.allowZoom === 'boolean' ? input.allowZoom : DEFAULT_PREFERENCES.allowZoom,
		iconSet: isIconSetId(input.iconSet) ? input.iconSet : null,
		iconOverrides,
		tokenAppearance: parseTokenAppearance(input.tokenAppearance),
		assistance: parseAssistance(input.assistance),
		cornerLines: parseCornerLines(input.cornerLines, input.assistance),
		tileFace: (TILE_FACES as readonly unknown[]).includes(input.tileFace)
			? (input.tileFace as TileFace)
			: DEFAULT_PREFERENCES.tileFace,
		requireName:
			typeof input.requireName === 'boolean' ? input.requireName : DEFAULT_PREFERENCES.requireName,
		holdToReveal:
			typeof input.holdToReveal === 'boolean'
				? input.holdToReveal
				: DEFAULT_PREFERENCES.holdToReveal,
		slotMachine:
			typeof input.slotMachine === 'boolean' ? input.slotMachine : DEFAULT_PREFERENCES.slotMachine,
		tileOrderRandom:
			typeof input.tileOrderRandom === 'boolean'
				? input.tileOrderRandom
				: DEFAULT_PREFERENCES.tileOrderRandom,
		ownWording:
			typeof input.ownWording === 'boolean' ? input.ownWording : DEFAULT_PREFERENCES.ownWording,
		hideWatchLink:
			typeof input.hideWatchLink === 'boolean'
				? input.hideWatchLink
				: DEFAULT_PREFERENCES.hideWatchLink,
		qrCentre: (QR_CENTRES as readonly unknown[]).includes(input.qrCentre)
			? (input.qrCentre as QrCentre)
			: DEFAULT_PREFERENCES.qrCentre,
		qrPictureWhole:
			typeof input.qrPictureWhole === 'boolean'
				? input.qrPictureWhole
				: DEFAULT_PREFERENCES.qrPictureWhole,
		qrPictureZoom: parseScale(input.qrPictureZoom, QR_PICTURE_ZOOM),
		qrPictureCorners: oneOf(QR_PICTURE_CORNERS, input.qrPictureCorners, 'rounded'),
		qrModules: oneOf(QR_MODULES, input.qrModules, 'square'),
		qrFinders: oneOf(QR_FINDERS, input.qrFinders, 'square'),
		soundVolume: parseScale(input.soundVolume, SOUND_VOLUME, DEFAULT_PREFERENCES.soundVolume),
		timerSound: (TIMER_SOUNDS as readonly unknown[]).includes(input.timerSound)
			? (input.timerSound as TimerSound)
			: DEFAULT_PREFERENCES.timerSound,
		callSound: oneOf(TIMER_SOUNDS, input.callSound, DEFAULT_PREFERENCES.callSound),
		ambienceOn: input.ambienceOn === true,
		ambienceLevel: parseScale(
			input.ambienceLevel,
			AMBIENCE_LEVEL,
			DEFAULT_PREFERENCES.ambienceLevel
		),
		nightAmbience: parseAmbience('night', input.nightAmbience),
		dayAmbience: parseAmbience('day', input.dayAmbience),
		timerMode: (TIMER_MODES as readonly unknown[]).includes(input.timerMode)
			? (input.timerMode as TimerMode)
			: DEFAULT_PREFERENCES.timerMode,
		timerVibrate:
			typeof input.timerVibrate === 'boolean'
				? input.timerVibrate
				: DEFAULT_PREFERENCES.timerVibrate,
		timerKeepAwake:
			typeof input.timerKeepAwake === 'boolean'
				? input.timerKeepAwake
				: DEFAULT_PREFERENCES.timerKeepAwake,
		timerForPlayers: oneOf(TIMER_FOR_PLAYERS, input.timerForPlayers, 'sun'),
		timerPerPlayer:
			Number.isInteger(input.timerPerPlayer) &&
			(input.timerPerPlayer as number) >= DAY_SECONDS_PER_ALIVE_MIN &&
			(input.timerPerPlayer as number) <= DAY_SECONDS_PER_ALIVE_MAX
				? (input.timerPerPlayer as number)
				: DEFAULT_PREFERENCES.timerPerPlayer
	};
}

/** Roles the two fonts of older builds (`displayFont`, `textFont`) covered. */
const LEGACY_DISPLAY_ROLES: readonly FontRole[] = ['heading', 'character'];

/**
 * Per-role fonts. Older builds saved one `displayFont` (titles and character names) and one
 * `textFont` (everything else); those carry over to the matching roles when `fonts` is absent.
 */
function parseFonts(input: Record<string, unknown>): Preferences['fonts'] {
	const fonts: Preferences['fonts'] = {};
	if (input.fonts && typeof input.fonts === 'object') {
		const saved = input.fonts as Record<string, unknown>;
		for (const role of FONT_ROLES) {
			const font = saved[role];
			if (isFontFor(role, font)) fonts[role] = font;
		}
		return fonts;
	}
	for (const role of FONT_ROLES) {
		// The account role came later and stays plain unless picked for itself.
		if (role === 'account') continue;
		const legacy = LEGACY_DISPLAY_ROLES.includes(role) ? input.displayFont : input.textFont;
		if (isFontFor(role, legacy)) fonts[role] = legacy;
	}
	return fonts;
}

/** The font for every role: the user's choice, else the theme's. */
export function resolveFonts(prefs: Preferences, theme: Theme): Record<FontRole, FontId> {
	return Object.fromEntries(
		FONT_ROLES.map((role) => [role, prefs.fonts[role] ?? theme.fonts[role]])
	) as Record<FontRole, FontId>;
}

export function resolveIconSet(prefs: Preferences, theme: Theme): IconSetId {
	return prefs.iconSet ?? theme.iconSet;
}

/** The base id for a slot before a weight is applied: override -> theme -> catalogue. */
export function resolveIconBase(slot: IconSlot, prefs: Preferences, theme: Theme): string {
	return prefs.iconOverrides[slot] ?? theme.icons[slot] ?? ICON_SLOTS[slot].choices[0];
}

/** The full Iconify id to draw for a slot, e.g. `dead` -> `ph:skull-fill`. */
export function resolveIcon(slot: IconSlot, prefs: Preferences, theme: Theme): string {
	const set = ICON_SETS.find((s) => s.id === resolveIconSet(prefs, theme)) ?? ICON_SETS[0];
	return withWeight(resolveIconBase(slot, prefs, theme), set.weight);
}
