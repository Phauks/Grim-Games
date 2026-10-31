/**
 * What a room shows before anyone is let in: the preview a phone sees for a typed code, and the
 * count of wrong Grim view keys that slows down guessing a password. Split from `room.ts`.
 */
import type { Script } from '#lib/core/data/index.ts';
import type { RoomState } from './room.ts';

/**
 * Wrong view-only keys a room takes in `VIEWER_FAIL_WINDOW_MS` before it refuses viewers for
 * the rest of that time: a password can be short, so guessing one must be slow.
 */
export const MAX_VIEWER_FAILS = 10;
export const VIEWER_FAIL_WINDOW_MS = 10 * 60 * 1000;

/** Wrong keys since `since` (milliseconds since the epoch). */
export interface ViewerFails {
	count: number;
	since: number;
}

/** True while too many wrong keys have come in this window. */
export function viewersLocked(fails: ViewerFails | undefined, now: number): boolean {
	return !!fails && now - fails.since < VIEWER_FAIL_WINDOW_MS && fails.count >= MAX_VIEWER_FAILS;
}

/** Counts one more wrong key, starting a new window once the last has passed. */
export function viewerFailed(fails: ViewerFails | undefined, now: number): ViewerFails {
	if (!fails || now - fails.since >= VIEWER_FAIL_WINDOW_MS) return { count: 1, since: now };
	return { count: fails.count + 1, since: fails.since };
}

/**
 * What a phone sees of a room before it joins, from `GET /api/room/<code>` (Trevor,
 * 2026-10-19: type the code "and then it shows you what game you will be joining"). Only
 * what joining would show anyway: the script's name, author and logo, and the table's size.
 */
export interface RoomPreview {
	open: boolean;
	/** Once the Storyteller's device has sent the script. */
	script?: {
		name: string;
		author?: string;
		/** The author's `_meta.logo`, as given; the phone checks it before showing it. */
		logo?: string;
		/** No characters of its own, so an edition's name means that edition (and its logo). */
		official: boolean;
	};
	/** The Storyteller's name, once published, when the game has one. */
	storyteller?: string;
	/** Seats at the table, once the Storyteller's device has published it. */
	seats?: number;
	/** Seats someone in the room sits in. */
	seated?: number;
	/** The Storyteller set a Grim view password: the code and it open the grimoire. */
	grimView?: true;
	/** The phone that asked was removed from this room for the game (plan J37). */
	removed?: true;
}

export function roomPreview(
	room: RoomState | undefined,
	script?: Script,
	removed = false
): RoomPreview {
	if (!room) return { open: false };
	const preview: RoomPreview = { open: true };
	if (removed) preview.removed = true;
	if (script) {
		const { name = '', author, logo } = script.meta ?? {};
		preview.script = {
			name,
			...(author ? { author } : {}),
			...(typeof logo === 'string' && logo ? { logo } : {}),
			official: script.entries.every((e) => e.kind === 'official')
		};
	}
	if (room.viewerKeyHash && room.viewerPassword) preview.grimView = true;
	if (room.public) {
		if (room.public.storytellerName) preview.storyteller = room.public.storytellerName;
		preview.seats = room.public.seats.length;
		preview.seated = room.members.filter((m) => m.seatId).length;
	}
	return preview;
}
