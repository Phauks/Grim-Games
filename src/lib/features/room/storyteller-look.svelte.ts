/**
 * The Storyteller's own look in the room (Trevor, 2026-10-30: "should send avatar and laurels
 * as well. we should have parity or use same feature when sharing storyteller and player
 * information"): the Profile's avatar, laurel, picture, tag-line and details, as a player's phone sends its own
 * (player.svelte.ts `sendLook`), so phones open the Storyteller's profile as they open a
 * player's. The picture goes up as one of the room's pictures, once per room.
 */
import type { PublicStoryteller } from '#lib/core/sync/public-projection.ts';
import { avatarPicture } from '#lib/features/player/avatar-picture.svelte.ts';
import { playerSettings } from '#lib/features/player/player-settings.svelte.ts';
import { readStored } from '#lib/ui/stored.ts';
import { STORAGE_KEY, type StoredRoom } from './host-storage.ts';
import { uploadRoomImage } from './room-images.ts';

/** The picture's name in the room it went up to, for the picture it was. */
let uploaded = $state.raw<{ url: string; code: string; hash: string }>();

function upload(url: string, code: string): void {
	const stored = readStored<StoredRoom>(STORAGE_KEY);
	const blob = avatarPicture.blob();
	if (!blob || stored?.code !== code) return;
	blob
		.then((image) => uploadRoomImage(code, stored.key, image))
		.then((hash) => {
			if (avatarPicture.url === url) uploaded = { url, code, hash };
		})
		// Not shared until the next publish tries again: the initials stand in.
		.catch(() => undefined);
}

/** The Storyteller's look for the room `code`, starting the picture's upload if it isn't up. */
export function storytellerLook(code: string | undefined): PublicStoryteller | undefined {
	const { avatar, frame, flavour: tagline, details } = playerSettings.current;
	const url = avatarPicture.url;
	let picture: string | undefined;
	if (url && code) {
		if (uploaded?.url === url && uploaded.code === code) picture = uploaded.hash;
		else upload(url, code);
	}
	const look: PublicStoryteller = {
		...(avatar ? { avatar } : {}),
		...(frame ? { frame } : {}),
		...(picture ? { picture } : {}),
		...(tagline ? { tagline } : {}),
		...(details?.length ? { details } : {})
	};
	return Object.keys(look).length ? look : undefined;
}
