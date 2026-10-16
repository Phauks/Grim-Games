/**
 * Asks the service worker to store files a game will need offline before they are shown,
 * such as every icon on the current script (see `cache-rules.ts`).
 */
import { characterIcons, ICONS_PATH, type Character } from '#lib/core/data/index.ts';
import type { KeepOfflineMessage } from './cache-rules.ts';

/** Icon URLs of these characters, good and evil alike. */
export function iconUrls(characters: readonly Character[]): string[] {
	const urls = new Set<string>();
	for (const character of characters) {
		const icons = characterIcons(character);
		for (const file of Object.values(icons ?? {})) urls.add(`${ICONS_PATH}/${file}`);
	}
	return [...urls];
}

/** Stores these characters' icons for offline use. Does nothing without a service worker. */
export function keepIconsOffline(characters: readonly Character[]): void {
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
	const urls = iconUrls(characters);
	if (urls.length === 0) return;
	const message: KeepOfflineMessage = { type: 'KEEP_OFFLINE', urls };
	navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage(message)).catch(() => {});
}
