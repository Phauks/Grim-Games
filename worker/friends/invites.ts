/**
 * Game invites (plan F4): the Storyteller of a live room invites friends to it, and each
 * invite waits on the friend's Friends page until they join, decline, or it expires. The
 * room code travels in request bodies only, never a URL (CLAUDE.md).
 */
import {
	FRIEND_INVITE_API,
	FRIEND_INVITE_DISMISS_API,
	MAX_INVITE_TITLE,
	type FriendInvite,
	type InviteResponse
} from '../../src/lib/features/friends/friends-protocol.ts';
import { normaliseRoomCode } from '../../src/lib/core/sync/room-code.ts';
import { readBody } from '../account/routes.ts';
import { describe, fail, friendBook, json, type FriendsEnv } from './routes.ts';

/** The account's open invites from current friends; empty while the data Worker is older. */
export async function friendInvites(env: FriendsEnv, accountId: string): Promise<FriendInvite[]> {
	let entries;
	try {
		entries = await friendBook(env, accountId).invites(Date.now());
	} catch {
		return [];
	}
	const book = friendBook(env, accountId);
	const senders = [...new Set(entries.map((entry) => entry.sender))];
	const friends = (
		await Promise.all(
			senders.map(async (id) => ((await book.relationTo(id)).friend ? id : undefined))
		)
	).filter((id) => id !== undefined);
	const described = await describe(
		env,
		friends.map((id) => ({ id, at: 0 }))
	);
	const byId = new Map(described.map((sender) => [sender.id, sender]));
	return entries.flatMap(({ id, sender, code, title, at }) => {
		const from = byId.get(sender);
		return from ? [{ id, from, code, title, at }] : [];
	});
}

/** Which friends are in the room, or invites one: only from the room's own Storyteller. */
async function invite(
	env: FriendsEnv,
	accountId: string,
	body: Record<string, unknown> | undefined
): Promise<InviteResponse> {
	const code = typeof body?.code === 'string' ? normaliseRoomCode(body.code) : undefined;
	if (!code) return { here: [], outcome: 'unavailable' };
	const inRoom = (await env.ROOMS.get(env.ROOMS.idFromName(code)).friendsRoom(accountId))?.accounts;
	if (!inRoom) return { here: [], outcome: 'unavailable' };
	const mine = friendBook(env, accountId);
	const { friends } = await mine.contents(Date.now());
	const friendIds = new Set(friends.map((friend) => friend.id));
	const here = inRoom.filter((id) => id !== accountId && friendIds.has(id));
	const other = body?.id;
	if (typeof other !== 'string') return { here };
	if (!friendIds.has(other)) return { here, outcome: 'unavailable' };
	if (here.includes(other)) return { here, outcome: 'here' };
	const title = typeof body?.title === 'string' ? body.title.trim().slice(0, MAX_INVITE_TITLE) : '';
	if (!(await mine.spendInvite(Date.now()))) return { here, outcome: 'limit' };
	const sent = await friendBook(env, other).receiveInvite(accountId, { code, title }, Date.now());
	return { here, outcome: sent ? 'sent' : 'unavailable' };
}

/** Handles the invite paths for `accountId`; undefined for any other path. */
export async function handleInvites(
	request: Request,
	env: FriendsEnv,
	path: string,
	accountId: string
): Promise<Response | undefined> {
	if (path !== FRIEND_INVITE_API && path !== FRIEND_INVITE_DISMISS_API) return undefined;
	if (request.method !== 'POST') return fail(404, 'Not found');
	const body = await readBody(request);
	if (path === FRIEND_INVITE_API) return json(await invite(env, accountId, body));
	const id = body?.id;
	if (typeof id !== 'number' || !Number.isInteger(id)) return fail(400, 'Bad invite.');
	await friendBook(env, accountId).dismissInvite(id);
	return json({ ok: true });
}
