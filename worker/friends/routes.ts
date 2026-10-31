/**
 * `/api/friends/*` (plan F1): the signed-in account's friends, requests and blocks.
 *
 * Another account is reached only by its exact username, never listed or searched by part
 * of a name. After that, the app names it by its id, and every action checks the id is
 * already on this account's book, so an id alone can't be used to reach anyone.
 */
import {
	friendActionApi,
	FRIEND_REQUESTS_API,
	FRIEND_SETTINGS_API,
	FRIENDS_API,
	FRIEND_RECENT_API,
	FRIEND_SEAT_API,
	isFriendAction,
	type RecentPlayer,
	type SeatFriendResponse,
	type SeatFriendState,
	type FriendAccount,
	type FriendsResponse,
	type RequestResponse
} from '../../src/lib/features/friends/friends-protocol.ts';
import {
	normaliseUsername,
	usernameKey,
	type ApiError
} from '../../src/lib/features/account/account-protocol.ts';
import { getUser, readBody, sameOriginJson } from '../account/routes.ts';
import { nameStub, userStub, type AccountEnv } from '../account/objects.ts';
import { remote, type DataBinding } from '../shared-data.ts';
import { normaliseRoomCode } from '../../src/lib/core/sync/room-code.ts';
import type { Room } from '../room.ts';
import type { GamePlayer } from '../../src/lib/features/friends/friend-rules.ts';
import type { BookEntry, FriendBook, RecentEntry } from './book.ts';
import { friendInvites, handleInvites } from './invites.ts';
import { handleFriendScripts } from './scripts.ts';

export interface FriendsEnv extends AccountEnv {
	FRIEND_BOOKS: DurableObjectNamespace<FriendBook>;
	/** Requests by username per account, so usernames can't be tried one after another. */
	FRIEND_LOOKUPS?: RateLimit;
	DATA?: DataBinding;
	/** Live rooms, for adding a player from a game (plan F2). */
	ROOMS: DurableObjectNamespace<Room>;
}

/** What reaching friend books needs: not the rooms. */
type BookEnv = Pick<FriendsEnv, 'FRIEND_BOOKS' | 'DATA'>;

/** An account's friend book: the shared data Worker's when bound, else this Worker's own. */
export function friendBook(env: BookEnv, accountId: string): DurableObjectStub<FriendBook> {
	if (env.DATA) return remote(env.DATA, 'friends', accountId);
	return env.FRIEND_BOOKS.get(env.FRIEND_BOOKS.idFromName(accountId));
}

export function json(body: unknown, status = 200): Response {
	return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function fail(status: number, error: string): Response {
	return json({ error } satisfies ApiError, status);
}

/** Each entry with its account's username and icon; accounts deleted since are left out. */
export async function describe(env: FriendsEnv, entries: BookEntry[]): Promise<FriendAccount[]> {
	const found = await Promise.all(
		entries.map(async ({ id, at }) => {
			const user = await userStub(env, id).profile();
			return user ? { id, username: user.username, icon: user.icon, at } : undefined;
		})
	);
	return found.filter((account) => account !== undefined);
}

async function contents(env: FriendsEnv, accountId: string): Promise<FriendsResponse> {
	const book = await friendBook(env, accountId).contents(Date.now());
	const [friends, incoming, outgoing, blocked, recent, invites] = await Promise.all([
		describe(env, book.friends),
		describe(env, book.incoming),
		describe(env, book.outgoing),
		describe(env, book.blocked),
		recentPlayers(env, accountId, book),
		friendInvites(env, accountId)
	]);
	return { friends, incoming, outgoing, blocked, findable: book.findable, recent, invites };
}

/**
 * Recent players (plan F3), each with whether they can be added, as a seat answers. Someone
 * who turned off being found is left out, as a seat shows them unavailable. Empty while the
 * shared data Worker is older than this app.
 */
async function recentPlayers(
	env: FriendsEnv,
	accountId: string,
	book: { friends: BookEntry[]; outgoing: BookEntry[] }
): Promise<RecentPlayer[]> {
	let entries: RecentEntry[];
	try {
		entries = await friendBook(env, accountId).recent();
	} catch {
		return [];
	}
	const friends = new Set(book.friends.map((entry) => entry.id));
	const asked = new Set(book.outgoing.map((entry) => entry.id));
	const found = await Promise.all(
		entries.map(async ({ id, at, name, games }) => {
			const friend = friends.has(id);
			const [user, findable] = await Promise.all([
				userStub(env, id).profile(),
				friend ? true : friendBook(env, id).isFindable()
			]);
			if (!user || !findable) return undefined;
			const state: SeatFriendState = friend ? 'friends' : asked.has(id) ? 'requested' : 'add';
			const player: RecentPlayer = {
				id,
				username: user.username,
				icon: user.icon,
				at,
				games,
				state
			};
			return name ? { ...player, name } : player;
		})
	);
	return found.filter((player) => player !== undefined);
}

/** Asks the account holding `username`; refusals read the same whether or not it exists. */
async function sendRequest(
	env: FriendsEnv,
	accountId: string,
	hasUsername: boolean,
	username: string
): Promise<RequestResponse> {
	if (!hasUsername) return { ok: false, reason: 'no-username' };
	const other = await nameStub(env, usernameKey(username)).holder();
	if (other === accountId) return { ok: false, reason: 'self' };
	if (!other || !(await friendBook(env, other).isFindable())) {
		return { ok: false, reason: 'not-found' };
	}
	return requestAccount(env, accountId, other);
}

/** Asks `other`, already found and findable, on behalf of `accountId`. */
async function requestAccount(
	env: FriendsEnv,
	accountId: string,
	other: string
): Promise<RequestResponse> {
	const now = Date.now();
	const sent = await friendBook(env, accountId).send(other, now);
	if (!sent.ok) return sent;
	let friends = false;
	if (sent.next === 'befriend') {
		friends = await friendBook(env, other).befriend(accountId, now);
		if (!friends) await friendBook(env, accountId).unfriend(other);
	} else if (await friendBook(env, other).receive(accountId, now)) {
		// Both had asked: the asker's side becomes a friendship too.
		await friendBook(env, accountId).befriend(other, now);
		friends = true;
	}
	return {
		ok: true,
		outcome: friends ? 'friends' : 'sent',
		friends: await contents(env, accountId)
	};
}

/**
 * The player in a live room's seat, or its Storyteller (plan F2): only someone whose own account is in that room
 * may look or ask, and "Let people find me by username" covers games too (Trevor, 2026-10-29).
 */
async function seatFriend(
	env: FriendsEnv,
	accountId: string,
	hasUsername: boolean,
	body: Record<string, unknown> | undefined
): Promise<SeatFriendResponse> {
	const unavailable: SeatFriendResponse = { state: 'unavailable' };
	const code = typeof body?.code === 'string' ? normaliseRoomCode(body.code) : undefined;
	const seatId = body?.seatId;
	const target =
		body?.storyteller === true
			? ({ storyteller: true } as const)
			: typeof seatId === 'string'
				? { seatId }
				: undefined;
	if (!code || !target) return unavailable;
	const other = await env.ROOMS.get(env.ROOMS.idFromName(code)).friendSeat(accountId, target);
	if (!other) return unavailable;
	if (other === 'self') return { state: 'self' };
	return friendState(env, accountId, hasUsername, other, body?.send === true);
}

/** Someone on Recent players (plan F3), answered as a seat is: only those really there. */
async function recentFriend(
	env: FriendsEnv,
	accountId: string,
	hasUsername: boolean,
	body: Record<string, unknown> | undefined
): Promise<SeatFriendResponse> {
	const other = body?.recent;
	if (typeof other !== 'string' || !(await friendBook(env, accountId).playedWith(other))) {
		return { state: 'unavailable' };
	}
	return friendState(env, accountId, hasUsername, other, body?.send === true);
}

/** Whether `other`, met in a game, can be added; with `send`, asks them. */
async function friendState(
	env: FriendsEnv,
	accountId: string,
	hasUsername: boolean,
	other: string,
	send: boolean
): Promise<SeatFriendResponse> {
	const unavailable: SeatFriendResponse = { state: 'unavailable' };
	const relation = await friendBook(env, accountId).relationTo(other);
	if (relation.friend) return { state: 'friends' };
	if (relation.blocked || !(await friendBook(env, other).isFindable())) return unavailable;
	if (relation.outgoing) return { state: 'requested' };
	if (!send) return { state: 'add' };
	if (!hasUsername) return { state: 'add', refused: 'no-username' };
	const answer = await requestAccount(env, accountId, other);
	if (!answer.ok) return { state: 'add', refused: answer.reason };
	return { state: answer.outcome === 'friends' ? 'friends' : 'requested' };
}

/** Runs one action on another account already on this account's book. */
async function act(env: FriendsEnv, accountId: string, action: string, other: string) {
	const mine = friendBook(env, accountId);
	const theirs = () => friendBook(env, other);
	const now = Date.now();
	switch (action) {
		case 'accept':
			if ((await mine.accept(other, now)) && !(await theirs().befriend(accountId, now))) {
				await mine.unfriend(other);
			}
			return;
		case 'decline':
			return mine.decline(other);
		case 'cancel':
		case 'remove':
			await (action === 'cancel' ? mine.cancel(other) : mine.unfriend(other));
			return theirs().drop(accountId);
		case 'block':
			await mine.block(other, now);
			return theirs().drop(accountId);
		case 'unblock':
			return mine.unblock(other);
	}
}

/**
 * A game in a room ended (plan F3): each signed-in player there remembers the others. Each
 * book's write is safe to repeat, and one failing doesn't stop the rest.
 */
export async function recordGame(env: BookEnv, game: string, players: GamePlayer[]) {
	if (players.length < 2) return;
	const now = Date.now();
	await Promise.allSettled(
		players.map((player) =>
			friendBook(env, player.id).played(
				game,
				players.filter((other) => other.id !== player.id),
				now
			)
		)
	);
}

/** Called when an account is deleted: every account it was linked to forgets it. */
export async function forgetFriends(env: BookEnv, accountId: string): Promise<void> {
	const linked = await friendBook(env, accountId).erase();
	await Promise.all(linked.map((other) => friendBook(env, other).forget(accountId)));
}

/** Handles `/api/friends` and below. Undefined for any other path. */
export async function handleFriends(
	request: Request,
	env: FriendsEnv,
	url: URL
): Promise<Response | undefined> {
	const path = url.pathname;
	if (path !== FRIENDS_API && !path.startsWith(`${FRIENDS_API}/`)) return undefined;
	const method = request.method;
	if (method !== 'GET' && !sameOriginJson(request, url)) {
		return fail(403, 'This request must come from the app.');
	}
	const auth = await getUser(request, env);
	if (!auth) return fail(401, 'Sign in first.');
	const accountId = auth.userId;

	if (path === FRIENDS_API && method === 'GET') return json(await contents(env, accountId));

	if (path === FRIEND_REQUESTS_API && method === 'POST') {
		if (env.FRIEND_LOOKUPS && !(await env.FRIEND_LOOKUPS.limit({ key: accountId })).success) {
			return fail(429, 'Too many tries. Wait a minute and try again.');
		}
		const username = normaliseUsername((await readBody(request))?.username);
		if (!username) return json({ ok: false, reason: 'not-found' } satisfies RequestResponse);
		return json(await sendRequest(env, accountId, auth.user.username !== null, username));
	}

	if ((path === FRIEND_SEAT_API || path === FRIEND_RECENT_API) && method === 'POST') {
		const body = await readBody(request);
		if (
			body?.send === true &&
			env.FRIEND_LOOKUPS &&
			!(await env.FRIEND_LOOKUPS.limit({ key: accountId })).success
		) {
			return fail(429, 'Too many tries. Wait a minute and try again.');
		}
		const answer = path === FRIEND_SEAT_API ? seatFriend : recentFriend;
		return json(await answer(env, accountId, auth.user.username !== null, body));
	}

	if (path === FRIEND_SETTINGS_API && method === 'PUT') {
		const findable = (await readBody(request))?.findable;
		if (typeof findable !== 'boolean') return fail(400, 'Bad setting.');
		await friendBook(env, accountId).setFindable(findable);
		return json(await contents(env, accountId));
	}

	const scripts = await handleFriendScripts(request, env, path, accountId);
	if (scripts) return scripts;

	const invites = await handleInvites(request, env, path, accountId);
	if (invites) return invites;

	const action = path.slice(FRIENDS_API.length + 1);
	if (method === 'POST' && isFriendAction(action) && path === friendActionApi(action)) {
		const other = (await readBody(request))?.id;
		if (typeof other !== 'string' || !(await friendBook(env, accountId).knows(other))) {
			return fail(404, 'Not found');
		}
		await act(env, accountId, action, other);
		return json(await contents(env, accountId));
	}
	return fail(404, 'Not found');
}
