import { readParsed, writeStored } from '#lib/ui/stored.ts';
import { getTheme } from '#lib/ui/themes/registry.ts';
import { DEFAULT_PREFERENCES, parsePreferences, type Preferences } from '#lib/ui/preferences.ts';

const STORAGE_KEY = 'grim-games:preferences:v1';

function read(): Preferences {
	// Private mode, blocked storage or corrupt JSON read as nothing: the defaults.
	return readParsed(STORAGE_KEY, parsePreferences);
}

function write(prefs: Preferences): void {
	// Storage full or blocked: the choice still applies for this visit.
	writeStored(STORAGE_KEY, prefs);
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
