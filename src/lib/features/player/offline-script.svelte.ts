/**
 * The script this phone got from an offline code (Trevor, 2026-10-26), by its notebook key:
 * while that script is the one shown and the phone is in no room, /play says the game is
 * offline and only the script came across.
 */
import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';

const STORAGE_KEY = 'grim-games-offline-script';

export const offlineScript = $state<{ key?: string }>({ key: readStoredText(STORAGE_KEY) });

/** Marks the script with this key as got offline; undefined clears the mark. */
export function markOfflineScript(key: string | undefined): void {
	offlineScript.key = key;
	writeStoredText(STORAGE_KEY, key);
}
