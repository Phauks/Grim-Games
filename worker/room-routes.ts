/**
 * The live rooms' HTTP routes, split from room.ts: opening a room, its preview and socket, and
 * its pictures. The Room object itself is in room.ts.
 */
import { makeRoomCode, normaliseRoomCode } from '../src/lib/core/sync/room-code.ts';
import { parseRoomImagePath } from '../src/lib/core/sync/room-images.ts';
import type { AccountEnv } from './account/objects.ts';
import { withAccount } from './room-accounts.ts';
import type { RoomEnv } from './room.ts';

const clientAddress = (request: Request) => request.headers.get('CF-Connecting-IP') ?? 'local';

/**
 * `POST /api/rooms` opens a room (body: the host key's hash) and returns its code;
 * `GET /api/room/<code>` says whether it is open and what game it holds (`RoomPreview`), or
 * upgrades to the room's WebSocket; `/api/room/<code>/image/<hash>` uploads (PUT) or loads
 * (GET) one of its pictures.
 * Returns undefined for other paths.
 */
export async function handleRoom(
	request: Request,
	env: RoomEnv & AccountEnv,
	url: URL
): Promise<Response | undefined> {
	if (url.pathname === '/api/rooms') {
		if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
		const limit = await env.ROOM_CREATES.limit({ key: clientAddress(request) });
		if (!limit.success) return new Response('Too many rooms', { status: 429 });
		const body = (await request.json().catch(() => null)) as { hostKeyHash?: unknown } | null;
		const hash = body?.hostKeyHash;
		if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) {
			return new Response('Bad request', { status: 400 });
		}
		// 10^6 codes and rooms last a day, so a free one is found within a few tries.
		for (let attempt = 0; attempt < 8; attempt++) {
			const code = makeRoomCode(() => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);
			if (await env.ROOMS.get(env.ROOMS.idFromName(code)).open(hash, code)) {
				return Response.json({ code });
			}
		}
		return new Response('No free room code', { status: 503 });
	}
	const image = parseRoomImagePath(url.pathname);
	if (image) {
		const code = normaliseRoomCode(image.code);
		if (!code) return new Response('Invalid room code', { status: 400 });
		// Uploads count as opening rooms; loading needs the picture's hash, which can't be guessed.
		if (request.method === 'PUT') {
			const limit = await env.ROOM_CREATES.limit({ key: clientAddress(request) });
			if (!limit.success) return new Response('Too many pictures', { status: 429 });
		}
		return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
	}
	const match = url.pathname.match(/^\/api\/room\/([^/]+)$/);
	if (!match) return undefined;
	const code = normaliseRoomCode(match[1]);
	if (!code) return new Response('Invalid room code', { status: 400 });
	if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
	// Limits guessing codes: a room shows only names and seats, but strangers shouldn't browse.
	const limit = await env.ROOM_JOINS.limit({ key: clientAddress(request) });
	if (!limit.success) return new Response('Too many tries', { status: 429 });
	return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(await withAccount(request, env));
}
