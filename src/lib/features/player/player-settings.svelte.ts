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
}

export const SHEET_DENSITIES = ['normal', 'compact', 'super'] as const;
export type SheetDensity = (typeof SHEET_DENSITIES)[number];

const DEFAULTS: PlayerSettings = { hideNoteContents: false, density: 'normal' };

function read(): PlayerSettings {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
		return {
			hideNoteContents: raw.hideNoteContents === true,
			density: SHEET_DENSITIES.find((d) => d === raw.density) ?? DEFAULTS.density
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
