/**
 * The script this phone got from an offline code (Trevor, 2026-10-26), by its notebook key:
 * while that script is the one shown and the phone is in no room, /play says the game is
 * offline and only the script came across.
 */
import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';

const STORAGE_KEY = 'grim-games-offline-script';
/** The live room the offline code named, to join once the phone has internet (2026-10-27). */
const ROOM_KEY = 'grim-games-offline-room';

export const offlineScript = $state<{ key?: string; room?: string }>({
	key: readStoredText(STORAGE_KEY),
	room: readStoredText(ROOM_KEY)
});

/** Marks the script with this key as got offline, from `room` if named; undefined clears it. */
export function markOfflineScript(key: string | undefined, room?: string): void {
	offlineScript.key = key;
	offlineScript.room = key ? room : undefined;
	writeStoredText(STORAGE_KEY, key);
	writeStoredText(ROOM_KEY, offlineScript.room);
}
