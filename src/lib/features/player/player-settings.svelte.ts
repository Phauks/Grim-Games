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
	/**
	 * How tightly the Script sheet is laid out, on screen and when printed (Trevor approved,
	 * 2026-10-16): long scripts fit a phone or one page.
	 */
	density: SheetDensity;
	/** How our own printed sheet is laid out (Trevor, 2026-10-19: a print settings screen). */
	print: PrintSettings;
}

/** `auto` fits each side to one page, as before; the others fix that choice. */
export const PRINT_COLUMNS = ['auto', 'one', 'two'] as const;
export const PRINT_DENSITIES = ['auto', 'normal', 'compact', 'super'] as const;
export const MAX_PRINT_COPIES = 20;

export interface PrintSettings {
	columns: (typeof PRINT_COLUMNS)[number];
	density: (typeof PRINT_DENSITIES)[number];
	/** The night order as icons down both sides of the front. */
	nightStrips: boolean;
	jinxes: boolean;
	/** The back: both nights with their text, and the player counts. */
	back: boolean;
	/** Character sheets (fronts) printed, one per player; the back once. */
	copies: number;
}

export const PRINT_DEFAULTS: PrintSettings = {
	columns: 'auto',
	density: 'auto',
	nightStrips: true,
	jinxes: true,
	back: true,
	copies: 1
};

function readPrint(raw: unknown): PrintSettings {
	const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const flag = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
	const copies = typeof r.copies === 'number' ? Math.round(r.copies) : PRINT_DEFAULTS.copies;
	return {
		columns: PRINT_COLUMNS.find((c) => c === r.columns) ?? PRINT_DEFAULTS.columns,
		density: PRINT_DENSITIES.find((d) => d === r.density) ?? PRINT_DEFAULTS.density,
		nightStrips: flag(r.nightStrips, PRINT_DEFAULTS.nightStrips),
		jinxes: flag(r.jinxes, PRINT_DEFAULTS.jinxes),
		back: flag(r.back, PRINT_DEFAULTS.back),
		copies: Math.min(MAX_PRINT_COPIES, Math.max(1, copies))
	};
}

export const SHEET_DENSITIES = ['normal', 'compact', 'super'] as const;
export type SheetDensity = (typeof SHEET_DENSITIES)[number];

const DEFAULTS: PlayerSettings = {
	hideNoteContents: false,
	density: 'normal',
	print: PRINT_DEFAULTS
};

function read(): PlayerSettings {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
		return {
			hideNoteContents: raw.hideNoteContents === true,
			density: SHEET_DENSITIES.find((d) => d === raw.density) ?? DEFAULTS.density,
			print: readPrint(raw.print)
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
