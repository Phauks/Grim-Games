import { parseAvatarId, type AvatarId } from '#lib/core/avatars/index.ts';
import { parseFrameId, type FrameId } from '#lib/core/frames/index.ts';
import { SHEET_BACKGROUNDS, type SheetBackground } from '#lib/ui/themes/sheet-backgrounds.ts';
import {
	DEFAULT_REMINDER_LINES,
	parseReminderLines,
	type ReminderLines
} from '#lib/features/grimoire/reminder-lines.ts';

/**
 * Player view settings, kept in this browser only. Separate from the app's shared
 * preferences because only the player view reads them.
 */
const KEY = 'grim-games:player-settings:v1';

export interface PlayerSettings {
	/**
	 * The old "Hide note contents" switch, read only so notebooks saved before each note had
	 * its own switch keep their notes hidden (notebook v6). No longer shown in Settings.
	 */
	hideNoteContents: boolean;
	/** How our own printed sheet is laid out (Trevor, 2026-10-19: a print settings screen). */
	print: PrintSettings;
	/**
	 * The laurel round this player's seat token (L4, A1), picked in their Profile. Undefined
	 * is none: there is no board default (Trevor, 2026-10-27).
	 */
	frame?: FrameId;
	/**
	 * A line of the player's own about themselves (Trevor, 2026-10-28: "I don't really know how
	 * we're going to use it yet, but I wanted it there"). Kept and edited in the Profile only.
	 */
	flavour?: string;
	/**
	 * What this player puts on their seat token (plan R6), sent with their frame: always their
	 * initials (Trevor, 2026-10-25: "always on", no setting).
	 */
	avatar: AvatarId;
	/**
	 * Grim tab: the player's own guesses and seat notes are hidden, as a note's contents can
	 * be (Trevor, 2026-10-26: "Hide grim guesses, eyeball feature like we use in notes"), so a
	 * glance at the phone shows only what the whole town knows.
	 */
	hideGuesses: boolean;
	/**
	 * Grim tab: the town is drawn in the Storyteller's board's shape, with empty space at the
	 * edges, in place of filling this screen (Trevor, 2026-10-27). Seats keep the board's
	 * places round the ring either way.
	 */
	matchShape: boolean;
	/** The same on Public Town, where it is on unless switched off (Trevor, 2026-10-27). */
	townMatchShape: boolean;
	/**
	 * The script and night order sheets' background, wherever they show (Trevor, 2026-10-24:
	 * neutral colours in place of 2026-10-23's light switch, whose on reads as parchment).
	 */
	sheetBackground: SheetBackground;
	/**
	 * Grim tab: when the player's own reminders show their line back to their seat (Trevor,
	 * 2026-10-29), as the Storyteller's board does with its own choice.
	 */
	reminderLines: ReminderLines;
}

/** `auto` fits each side to one page, as before; the others fix that choice. */
export const PRINT_COLUMNS = ['auto', 'one', 'two'] as const;
export const PRINT_DENSITIES = ['auto', 'normal', 'compact', 'super'] as const;
/** Paper the sheet is laid out for; Letter first, as most of our players use it (Trevor, 2026-10-29). */
export const PAGE_SIZES = ['letter', 'a4'] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
/** Each paper's width and height in millimetres. */
export const PAPER_MM: Readonly<Record<PageSize, readonly [number, number]>> = {
	letter: [215.9, 279.4],
	a4: [210, 297]
};
export const MARGIN_UNITS = ['in', 'mm'] as const;
export type MarginUnit = (typeof MARGIN_UNITS)[number];
/** The widest margin, in millimetres: an inch. */
export const MAX_MARGIN_MM = 25.4;
/** Icon size on a printed side, as a multiple of the sheet's own (Trevor, 2026-10-29). */
export const PRINT_ICON_SCALE = { min: 0.6, max: 1.5, step: 0.05 } as const;

/** What one side of the printed sheet carries; the back alone can be left off. */
export interface PrintSide {
	jinxes: boolean;
	/** The script's Fabled and Loric. */
	ruleCharacters: boolean;
	/** The game mode and special rules, when printing from a game that has them. */
	rules: boolean;
	iconScale: number;
}

export interface PrintFront extends PrintSide {
	logo: boolean;
	/** The night order as icons down both sides. */
	nightStrips: boolean;
	columns: (typeof PRINT_COLUMNS)[number];
	density: (typeof PRINT_DENSITIES)[number];
}

export interface PrintBack extends PrintSide {
	enabled: boolean;
	/** Both nights' order with their text. */
	night: boolean;
	/** The player counts. */
	counts: boolean;
}

/**
 * Our printed sheet (Trevor, 2026-10-29: paper, margins and a Front and a Back section with a
 * switch per item, in place of bundles). How many to print is the printer dialog's choice.
 */
export interface PrintSettings {
	pageSize: PageSize;
	/** Each margin, in millimetres whichever unit shows it. */
	margin: number;
	marginUnit: MarginUnit;
	/** Saves ink: outlines in the team colours in place of filled bands and rings. */
	printerFriendly: boolean;
	/** The rules terms' dotted underlines, which mean "tap me" on screen and nothing on paper. */
	underlines: boolean;
	front: PrintFront;
	back: PrintBack;
}

export const PRINT_DEFAULTS: PrintSettings = {
	pageSize: 'letter',
	margin: MAX_MARGIN_MM / 2,
	marginUnit: 'in',
	printerFriendly: false,
	underlines: false,
	front: {
		logo: true,
		nightStrips: true,
		jinxes: true,
		ruleCharacters: true,
		rules: false,
		columns: 'auto',
		density: 'auto',
		iconScale: 1
	},
	back: {
		enabled: true,
		night: true,
		counts: true,
		jinxes: false,
		ruleCharacters: false,
		rules: true,
		iconScale: 1
	}
};

const record = (raw: unknown) =>
	(raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
const flag = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const iconScale = (v: unknown) =>
	typeof v === 'number' && Number.isFinite(v)
		? Math.min(PRINT_ICON_SCALE.max, Math.max(PRINT_ICON_SCALE.min, v))
		: 1;

/**
 * Saved print settings, including a build before 2026-10-29's, which had flat front choices
 * and one Back drop-down (and before that a Back switch) and a number of copies, now dropped.
 */
export function readPrint(raw: unknown): PrintSettings {
	const r = record(raw);
	const f = record(r.front);
	const b = record(r.back);
	const d = PRINT_DEFAULTS;
	// The old Back: on was the night order; 'info' moved jinxes, Fabled and Loric there.
	const oldBack =
		typeof r.back === 'boolean'
			? r.back
				? 'night'
				: 'none'
			: typeof r.back === 'string'
				? r.back
				: undefined;
	const info = oldBack === 'info';
	const margin = typeof r.margin === 'number' && Number.isFinite(r.margin) ? r.margin : d.margin;
	return {
		pageSize: PAGE_SIZES.find((s) => s === r.pageSize) ?? d.pageSize,
		margin: Math.min(MAX_MARGIN_MM, Math.max(0, margin)),
		marginUnit: MARGIN_UNITS.find((u) => u === r.marginUnit) ?? d.marginUnit,
		printerFriendly: flag(r.printerFriendly, d.printerFriendly),
		underlines: flag(r.underlines, d.underlines),
		front: {
			logo: flag(f.logo, d.front.logo),
			nightStrips: flag(f.nightStrips, flag(r.nightStrips, d.front.nightStrips)),
			jinxes: flag(f.jinxes, flag(r.jinxes, d.front.jinxes)),
			ruleCharacters: flag(f.ruleCharacters, info ? false : d.front.ruleCharacters),
			rules: flag(f.rules, d.front.rules),
			columns: PRINT_COLUMNS.find((c) => c === (f.columns ?? r.columns)) ?? d.front.columns,
			density: PRINT_DENSITIES.find((x) => x === (f.density ?? r.density)) ?? d.front.density,
			iconScale: iconScale(f.iconScale)
		},
		back: {
			enabled: flag(b.enabled, oldBack ? oldBack !== 'none' : d.back.enabled),
			night: flag(b.night, info ? false : d.back.night),
			counts: flag(b.counts, info ? false : d.back.counts),
			jinxes: flag(b.jinxes, info ? true : d.back.jinxes),
			ruleCharacters: flag(b.ruleCharacters, info ? true : d.back.ruleCharacters),
			rules: flag(b.rules, d.back.rules),
			iconScale: iconScale(b.iconScale)
		}
	};
}

/**
 * How tightly a printed sheet is laid out, so a long script fits one page. On screen the
 * sheet is always Normal: Compact and Super-compact left the screen (Trevor, 2026-10-27:
 * "Compact and super compact modes suck. Remove for now").
 */
export const SHEET_DENSITIES = ['normal', 'compact', 'super'] as const;
export type SheetDensity = (typeof SHEET_DENSITIES)[number];

const DEFAULTS: PlayerSettings = {
	hideNoteContents: false,
	print: PRINT_DEFAULTS,
	avatar: 'initials',
	hideGuesses: false,
	matchShape: false,
	townMatchShape: true,
	sheetBackground: 'theme',
	reminderLines: DEFAULT_REMINDER_LINES
};

/** The longest flavour text kept. */
export const MAX_FLAVOUR = 200;

function parseFlavour(raw: unknown): string | undefined {
	const text = typeof raw === 'string' ? raw.trim().slice(0, MAX_FLAVOUR) : '';
	return text || undefined;
}

function read(): PlayerSettings {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
		return {
			hideNoteContents: raw.hideNoteContents === true,
			print: readPrint(raw.print),
			frame: parseFrameId(raw.frame),
			flavour: parseFlavour(raw.flavour),
			// Initials are always on (Trevor, 2026-10-25): an older build's "none" reads as them.
			avatar: parseAvatarId(raw.avatar) ?? DEFAULTS.avatar,
			hideGuesses: raw.hideGuesses === true,
			matchShape: raw.matchShape === true,
			townMatchShape: raw.townMatchShape !== false,
			sheetBackground:
				SHEET_BACKGROUNDS.find((b) => b === raw.sheetBackground) ??
				(raw.lightSheet === true ? 'parchment' : DEFAULTS.sheetBackground),
			reminderLines: parseReminderLines(raw.reminderLines)
		};
	} catch {
		return DEFAULTS;
	}
}

class PlayerSettingsState {
	// Read once when the module loads in the browser (never while rendering).
	#current = $state<PlayerSettings>(typeof localStorage === 'undefined' ? DEFAULTS : read());

	get current(): PlayerSettings {
		return this.#current;
	}

	update(patch: Partial<PlayerSettings>) {
		this.#current = { ...this.current, ...patch };
		try {
			localStorage.setItem(KEY, JSON.stringify(this.#current));
		} catch {
			// Private browsing or full storage: the setting lasts until the page closes.
		}
	}
}

export const playerSettings = new PlayerSettingsState();
