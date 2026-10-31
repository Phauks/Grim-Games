/**
 * Friends' presence (plan F5): when each friend was last on, whether they're in a live game,
 * and a way in when their room's Storyteller lets friends join without an invite. A friend
 * who turned presence off shows nothing.
 */
import {
	FRIEND_ROOM_API,
	type FriendPresence
} from '../../src/lib/features/friends/friends-protocol.ts';
import { normaliseRoomCode } from '../../src/lib/core/sync/room-code.ts';
import { readBody } from '../account/routes.ts';
import { userStub } from '../account/objects.ts';
import type { BookEntry } from './book.ts';
import { fail, friendBook, json, type FriendsEnv } from './routes.ts';

async function presenceOf(env: FriendsEnv, id: string, now: number): Promise<FriendPresence> {
	const book = friendBook(env, id);
	if (!(await book.showsPresence())) return {};
	const [lastSeen, rooms] = await Promise.all([userStub(env, id).lastSeen(), book.rooms(now)]);
	const presence: FriendPresence = lastSeen ? { lastSeen } : {};
	if (!rooms.length) return presence;
	for (const code of rooms) {
		if (await env.ROOMS.get(env.ROOMS.idFromName(code)).friendsMayJoin()) {
			return { ...presence, inGame: true, join: code };
		}
	}
	return { ...presence, inGame: true };
}

/** Each friend's presence, by id; empty while the shared data Worker is older than this app. */
export async function friendsPresence(
	env: FriendsEnv,
	friends: BookEntry[]
): Promise<Record<string, FriendPresence>> {
	const now = Date.now();
	try {
		const entries = await Promise.all(
			friends.map(async ({ id }) => [id, await presenceOf(env, id, now)] as const)
		);
		return Object.fromEntries(entries);
	} catch {
		return {};
	}
}

/** Whether this account shows friends its presence; on while the data Worker is older. */
export async function showsPresence(env: FriendsEnv, accountId: string): Promise<boolean> {
	try {
		return await friendBook(env, accountId).showsPresence();
	} catch {
		return true;
	}
}

/** Handles a room's "friends can join" for `accountId`, its Storyteller. */
export async function handleFriendRoom(
	request: Request,
	env: FriendsEnv,
	path: string,
	accountId: string
): Promise<Response | undefined> {
	if (path === FRIEND_ROOM_API && request.method === 'POST') {
		const body = await readBody(request);
		const code = typeof body?.code === 'string' ? normaliseRoomCode(body.code) : undefined;
		const open = typeof body?.open === 'boolean' ? body.open : undefined;
		if (!code) return fail(404, 'Not found');
		const answer = await env.ROOMS.get(env.ROOMS.idFromName(code)).friendsJoin(accountId, open);
		if (answer === undefined) return fail(404, 'Not found');
		return json({ open: answer });
	}
	return undefined;
}
