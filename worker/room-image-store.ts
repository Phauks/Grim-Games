/** The room's pictures: backgrounds from the Storyteller's device and players' own avatars. */
import { sha256Hex as sha256 } from '../src/lib/core/codes/hash.ts';
import type { RoomState } from '../src/lib/core/sync/room.ts';
import {
	addRoomImage,
	isRoomImageType,
	MAX_ROOM_IMAGE_BYTES,
	splitUpload,
	type StoredImage
} from '../src/lib/core/sync/room-images.ts';
import { MAX_AVATAR_PICTURE_BYTES } from '../src/lib/core/sync/room-pictures.ts';

interface ImageView {
	type: string;
	bytes: ArrayBuffer;
}

/**
 * A picture for the table: the Storyteller's device uploads it (PUT, its room key ahead of
 * the bytes) and every device loads it (GET). Its name is the hash of its bytes, so a
 * stored picture never changes and can be cached for as long as the room lasts.
 */
export async function roomImage(
	storage: DurableObjectStorage,
	request: Request,
	room: RoomState | undefined,
	hash: string,
	touch: () => Promise<void>
): Promise<Response> {
	if (!room) return new Response('No such room', { status: 404 });
	const key = `image:${hash}`;
	if (request.method === 'GET') {
		const view = await storage.get<ImageView>(key);
		if (!view) return new Response('No such picture', { status: 404 });
		return new Response(view.bytes, {
			headers: {
				'Content-Type': view.type,
				'Cache-Control': 'private, max-age=86400, immutable',
				'X-Content-Type-Options': 'nosniff'
			}
		});
	}
	if (request.method !== 'PUT') return new Response('Method not allowed', { status: 405 });
	const type = request.headers.get('Content-Type');
	if (!isRoomImageType(type)) return new Response('Not a picture', { status: 415 });
	const body = new Uint8Array(await request.arrayBuffer());
	if (body.length > MAX_ROOM_IMAGE_BYTES + 130) return new Response('Too large', { status: 413 });
	const upload = splitUpload(body);
	if (!upload) return new Response('Bad request', { status: 400 });
	const keyHash = await sha256(upload.key);
	// The Storyteller's device, or a phone in the room with its own avatar picture.
	const memberId = keyHash === room.hostKeyHash ? undefined : keyHash.slice(0, 24);
	if (memberId && !room.members.some((m) => m.memberId === memberId))
		return new Response('Not the Storyteller', { status: 403 });
	if ((await sha256(upload.image)) !== hash) return new Response('Wrong hash', { status: 400 });
	if (memberId) {
		// A player's own avatar picture (room-pictures.ts): one per phone in the room.
		if (upload.image.length > MAX_AVATAR_PICTURE_BYTES)
			return new Response('Too large', { status: 413 });
		const avatars = (await storage.get<Record<string, string>>('avatars')) ?? {};
		const old = avatars[memberId];
		const bytes = upload.image.slice().buffer;
		await storage.put({
			[key]: { type, bytes } satisfies ImageView,
			avatars: { ...avatars, [memberId]: hash }
		});
		if (old && old !== hash) await dropAvatarPicture(storage, old, memberId);
		await touch();
		return new Response(null, { status: 204 });
	}
	const stored = (await storage.get<StoredImage[]>('images')) ?? [];
	const { kept, dropped } = addRoomImage(stored, hash, Date.now());
	const bytes = upload.image.slice().buffer;
	await storage.put({ [key]: { type, bytes } satisfies ImageView, images: kept });
	if (dropped.length) await storage.delete(dropped.map((h) => `image:${h}`));
	await touch();
	return new Response(null, { status: 204 });
}

/** Deletes an avatar picture no other phone or background uses (one replaced or taken away). */
export async function dropAvatarPicture(
	storage: DurableObjectStorage,
	hash: string,
	memberId: string
): Promise<void> {
	const avatars = (await storage.get<Record<string, string>>('avatars')) ?? {};
	const backgrounds = (await storage.get<StoredImage[]>('images')) ?? [];
	const { [memberId]: mine, ...others } = avatars;
	const kept = mine === hash ? others : avatars;
	if (mine === hash) await storage.put('avatars', kept);
	const used =
		Object.values(kept).includes(hash) || backgrounds.some((image) => image.hash === hash);
	if (!used) await storage.delete(`image:${hash}`);
}
