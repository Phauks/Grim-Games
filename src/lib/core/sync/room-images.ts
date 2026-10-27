/**
 * Pictures a live room holds for the table (Trevor, 2026-10-26: "Images should be uploaded and
 * shared for background", and later others, such as a player's own avatar picture). The
 * Storyteller's device uploads each one to the open room, named by the SHA-256 of its bytes, and
 * every device in the room loads it from there. The room keeps a few and deletes them with it.
 */

/** Largest picture a room takes: a background shrunk to 1920 px as a JPEG fits well under it. */
export const MAX_ROOM_IMAGE_BYTES = 1536 * 1024;
/** At most this many pictures per room; adding one more drops the oldest. */
export const MAX_ROOM_IMAGES = 8;
export const ROOM_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type RoomImageType = (typeof ROOM_IMAGE_TYPES)[number];

export const isRoomImageType = (value: unknown): value is RoomImageType =>
	ROOM_IMAGE_TYPES.includes(value as RoomImageType);

/** A picture's name: the SHA-256 of its bytes, in hex. */
export const isImageHash = (value: unknown): value is string =>
	typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

/** Where a room's picture is uploaded and loaded: in the path, never a query string. */
export function roomImagePath(code: string, hash: string): string {
	return `/api/room/${code}/image/${hash}`;
}

/** The room code and picture a path names, or undefined for any other path. */
export function parseRoomImagePath(pathname: string): { code: string; hash: string } | undefined {
	const match = pathname.match(/^\/api\/room\/([^/]+)\/image\/([0-9a-f]{64})$/);
	return match ? { code: match[1], hash: match[2] } : undefined;
}

export interface StoredImage {
	hash: string;
	/** When it was last uploaded, to drop the oldest first. */
	at: number;
}

/** The room's pictures after adding (or uploading again) `hash`, and the ones to delete. */
export function addRoomImage(
	stored: readonly StoredImage[],
	hash: string,
	at: number,
	max = MAX_ROOM_IMAGES
): { kept: StoredImage[]; dropped: string[] } {
	const others = stored.filter((image) => image.hash !== hash).sort((a, b) => a.at - b.at);
	const over = Math.max(0, others.length + 1 - max);
	return {
		kept: [...others.slice(over), { hash, at }],
		dropped: others.slice(0, over).map((image) => image.hash)
	};
}

/**
 * An upload's body: the Storyteller's room key, a newline, then the picture, so the key is in
 * no address or header our logs might keep. Undefined when the body isn't shaped so.
 */
export function splitUpload(body: Uint8Array): { key: string; image: Uint8Array } | undefined {
	const newline = body.subarray(0, 130).indexOf(10);
	if (newline < 32) return undefined;
	const key = new TextDecoder().decode(body.subarray(0, newline));
	if (!/^[0-9a-f]{32,128}$/.test(key)) return undefined;
	return { key, image: body.subarray(newline + 1) };
}
