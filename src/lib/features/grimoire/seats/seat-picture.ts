import { getContext, setContext } from 'svelte';
import type { SeatId } from '#lib/core/model/index.ts';
import { roomImagePath } from '#lib/core/sync/room-images.ts';
import { roomHost } from '#lib/features/room/host.svelte.ts';
import type { Grimoire } from '../grimoire.svelte.ts';

/** Where to load the picture of the player seated at a seat, if they have one. */
type PictureOf = (seatId: SeatId) => string | undefined;

const KEY = Symbol('seat-picture');

/**
 * Sets where a board's seats find their players' own pictures: this device's room for the
 * Storyteller's board, and the pictures that came with the grimoire for a board drawn
 * elsewhere (Grim view, the final grimoire; Trevor, 2026-11-15: avatars were missing there).
 */
export function provideSeatPictures(watched: () => Grimoire | undefined): void {
	setContext<PictureOf>(KEY, (seatId) => {
		const grimoire = watched();
		if (!grimoire) return roomHost().pictureOf(seatId);
		const hash = grimoire.pictures?.[seatId];
		return hash && grimoire.room ? roomImagePath(grimoire.room, hash) : undefined;
	});
}

/** The board's seat pictures; outside a board, this device's room. */
export function seatPictureOf(): PictureOf {
	return getContext<PictureOf | undefined>(KEY) ?? ((seatId) => roomHost().pictureOf(seatId));
}
