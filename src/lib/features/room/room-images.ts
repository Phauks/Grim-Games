import { sha256Hex } from '#lib/core/codes/hash.ts';
import {
	isRoomImageType,
	MAX_ROOM_IMAGE_BYTES,
	roomImagePath
} from '#lib/core/sync/room-images.ts';
import { shrinkImage } from '#lib/features/grimoire/backgrounds.ts';

/**
 * Uploads a picture to the open room for the whole table (core/sync/room-images.ts), from the
 * Storyteller's device, and says its name there: the hash of its bytes. Each picture goes up
 * once per room; one too large for the room is shrunk further first.
 */
const uploads = new WeakMap<Blob, Map<string, Promise<string>>>();

export function uploadRoomImage(code: string, key: string, image: Blob): Promise<string> {
	const byRoom = uploads.get(image) ?? new Map<string, Promise<string>>();
	uploads.set(image, byRoom);
	let upload = byRoom.get(code);
	if (!upload) {
		upload = send(code, key, image);
		// A failed upload is tried again the next time the look is shared.
		upload.catch(() => byRoom.delete(code));
		byRoom.set(code, upload);
	}
	return upload;
}

async function send(code: string, key: string, original: Blob): Promise<string> {
	let image = original;
	if (image.size > MAX_ROOM_IMAGE_BYTES || !isRoomImageType(image.type))
		image = await shrinkImage(image, 1280, 0.75);
	if (image.size > MAX_ROOM_IMAGE_BYTES) throw new Error('Picture too large for the room');
	return putRoomImage(code, key, image);
}

/**
 * Puts one picture in the room as it is, with the Storyteller's room key or a player's own
 * phone key (a player's avatar picture, core/sync/room-pictures.ts), and says its name there.
 */
export async function putRoomImage(code: string, key: string, image: Blob): Promise<string> {
	const bytes = new Uint8Array(await image.arrayBuffer());
	const hash = await sha256Hex(bytes);
	// The key goes ahead of the picture in the body, never in the address or a header.
	const response = await fetch(roomImagePath(code, hash), {
		method: 'PUT',
		headers: { 'Content-Type': image.type },
		body: new Blob([`${key}\n`, bytes])
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return hash;
}
