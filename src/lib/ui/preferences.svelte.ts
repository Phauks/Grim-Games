import { getTheme } from '#lib/ui/themes/registry.ts';
import { DEFAULT_PREFERENCES, parsePreferences, type Preferences } from '#lib/ui/preferences.ts';

const STORAGE_KEY = 'grim-games:preferences:v1';

function read(): Preferences {
	try {
		const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
		return parsePreferences(raw ? JSON.parse(raw) : null);
	} catch {
		// Private mode, blocked storage or corrupt JSON: fall back to the defaults.
		return { ...DEFAULT_PREFERENCES };
	}
}

function write(prefs: Preferences): void {
	try {
		globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(prefs));
	} catch {
		// Storage full or blocked: the choice still applies for this visit.
	}
}

/** The device's preferences, persisted in localStorage on every change. */
class PreferencesStore {
	current = $state<Preferences>(read());
	theme = $derived(getTheme(this.current.themeId));

	update(change: Partial<Preferences>): void {
		this.current = parsePreferences({ ...this.current, ...change });
		write(this.current);
	}

	reset(): void {
		this.current = { ...DEFAULT_PREFERENCES };
		write(this.current);
	}
}

export const preferences = new PreferencesStore();
