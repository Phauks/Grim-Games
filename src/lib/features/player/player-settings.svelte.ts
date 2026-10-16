/**
 * Player view settings, kept in this browser only. Separate from the app's shared
 * preferences because only the player view reads them.
 */
const KEY = 'grim-games:player-settings:v1';

export interface PlayerSettings {
	/**
	 * Notes on the Notes tab show neither title nor text until opened, so someone glancing at
	 * the phone can't read them (Trevor, 2026-10-16). Off by default.
	 */
	hideNoteContents: boolean;
}

const DEFAULTS: PlayerSettings = { hideNoteContents: false };

function read(): PlayerSettings {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
		return { hideNoteContents: raw.hideNoteContents === true };
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
