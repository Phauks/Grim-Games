/**
 * Groups (plan F6): start one with a name, join one with its code, and see the live games its
 * members' Storytellers show in it. Nothing is ever sent to members (Trevor, 2026-10-31: "not
 * everyone will go every time, so we can't be too spammy"); they see a game when they look.
 * Codes travel in request bodies only, never a URL (CLAUDE.md).
 */
import {
	GROUP_CODE_ALPHABET,
	GROUP_CODE_LENGTH,
	GROUP_CREATE_API,
	GROUP_JOIN_API,
	GROUP_LEAVE_API,
	GROUP_MEMBERS_API,
	GROUP_REMOVE_API,
	GROUP_ROOM_API,
	GROUPS_API,
	MAX_GROUPS,
	normaliseGroupCode,
	normaliseGroupName,
	type GroupChangeResponse,
	type GroupGame,
	type GroupMembersResponse,
	type GroupRoomResponse,
	type GroupSummary
} from '../../src/lib/features/friends/groups-protocol.ts';
import { MAX_INVITE_TITLE } from '../../src/lib/features/friends/friends-protocol.ts';
import { normaliseRoomCode } from '../../src/lib/core/sync/room-code.ts';
import { readBody } from '../account/routes.ts';
import { remote } from '../shared-data.ts';
import type { FriendGroup } from './group.ts';
import { describe, fail, friendBook, json, type FriendsEnv } from './routes.ts';

/** A group by its code: the shared data Worker's when bound, else this Worker's own. */
export function friendGroup(
	env: Pick<FriendsEnv, 'FRIEND_GROUPS' | 'DATA'>,
	code: string
): DurableObjectStub<FriendGroup> {
	if (env.DATA) return remote(env.DATA, 'groups', code);
	return env.FRIEND_GROUPS.get(env.FRIEND_GROUPS.idFromName(code));
}

function newCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(GROUP_CODE_LENGTH));
	return [...bytes].map((b) => GROUP_CODE_ALPHABET[b % GROUP_CODE_ALPHABET.length]).join('');
}

/** A group's live games: rooms still open that still show in it, their Storytellers named. */
async function groupGames(env: FriendsEnv, code: string, now: number): Promise<GroupGame[]> {
	const group = friendGroup(env, code);
	const rooms = await group.rooms(now);
	const live = (
		await Promise.all(
			rooms.map(async (entry) => {
				const view = await env.ROOMS.get(env.ROOMS.idFromName(entry.room)).friendsView();
				if (view?.groups.includes(code)) return entry;
				await group.showRoom(entry.storyteller, entry.room, false, '', now);
				return undefined;
			})
		)
	).filter((entry) => entry !== undefined);
	const storytellers = new Map(
		(
			await describe(
				env,
				live.map(({ storyteller, at }) => ({ id: storyteller, at }))
			)
		).map((account) => [account.id, account])
	);
	return live.flatMap(({ room, storyteller, title, at }) => {
		const account = storytellers.get(storyteller);
		return account ? [{ room, title, storyteller: account, at }] : [];
	});
}

/** The account's groups, oldest first; a group deleted, or that removed it, is forgotten. */
export async function accountGroups(env: FriendsEnv, accountId: string): Promise<GroupSummary[]> {
	const book = friendBook(env, accountId);
	const now = Date.now();
	const groups = await Promise.all(
		(await book.groups()).map(async (code): Promise<GroupSummary | undefined> => {
			const group = friendGroup(env, code);
			const info = await group.info();
			if (!info || !(await group.isMember(accountId))) {
				await book.dropGroup(code);
				return undefined;
			}
			return {
				code,
				name: info.name,
				owner: info.owner === accountId,
				members: info.members,
				games: await groupGames(env, code, now)
			};
		})
	);
	return groups.filter((group) => group !== undefined);
}

async function changed(env: FriendsEnv, accountId: string, code: string) {
	return { ok: true, code, groups: await accountGroups(env, accountId) } as const;
}

async function create(
	env: FriendsEnv,
	accountId: string,
	body: Record<string, unknown> | undefined
): Promise<GroupChangeResponse> {
	const name = normaliseGroupName(body?.name);
	if (!name) return { ok: false, reason: 'unavailable' };
	const book = friendBook(env, accountId);
	if ((await book.groups()).length >= MAX_GROUPS) return { ok: false, reason: 'limit' };
	if (!(await book.spendGroupStart(Date.now()))) return { ok: false, reason: 'limit' };
	for (let tries = 0; tries < 5; tries++) {
		const code = newCode();
		if (await friendGroup(env, code).create(accountId, name, Date.now())) {
			await book.addGroup(code, Date.now());
			return changed(env, accountId, code);
		}
	}
	return { ok: false, reason: 'unavailable' };
}

async function join(
	env: FriendsEnv,
	accountId: string,
	body: Record<string, unknown> | undefined
): Promise<GroupChangeResponse> {
	const code = normaliseGroupCode(body?.code);
	if (!code) return { ok: false, reason: 'not-found' };
	const book = friendBook(env, accountId);
	const mine = await book.groups();
	if (!mine.includes(code) && mine.length >= MAX_GROUPS) return { ok: false, reason: 'limit' };
	const joined = await friendGroup(env, code).join(accountId, Date.now());
	if (joined === 'missing') return { ok: false, reason: 'not-found' };
	if (joined === 'full') return { ok: false, reason: 'full' };
	await book.addGroup(code, Date.now());
	return changed(env, accountId, code);
}

/** Leaving: the owner's leaving deletes the group, and every member forgets it. */
async function leave(env: FriendsEnv, accountId: string, code: string): Promise<void> {
	const group = friendGroup(env, code);
	const info = await group.info();
	if (info?.owner === accountId) {
		const members = await group.erase();
		await Promise.all(members.map((id) => friendBook(env, id).dropGroup(code)));
		return;
	}
	await group.leave(accountId);
	await friendBook(env, accountId).dropGroup(code);
}

/** Called when an account is deleted: it leaves every group, and its own groups go. */
export async function leaveGroups(env: FriendsEnv, accountId: string): Promise<void> {
	let codes: string[];
	try {
		codes = await friendBook(env, accountId).groups();
	} catch {
		return;
	}
	await Promise.all(codes.map((code) => leave(env, accountId, code).catch(() => {})));
}

/** Shows or hides the Storyteller's live room in one of their groups, or lists where it shows. */
async function room(
	env: FriendsEnv,
	accountId: string,
	body: Record<string, unknown> | undefined
): Promise<GroupRoomResponse | undefined> {
	const code = typeof body?.room === 'string' ? normaliseRoomCode(body.room) : undefined;
	if (!code) return undefined;
	const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
	const group = normaliseGroupCode(body?.group);
	const show = typeof body?.show === 'boolean' ? body.show : undefined;
	if (group && show !== undefined) {
		const title =
			typeof body?.title === 'string' ? body.title.trim().slice(0, MAX_INVITE_TITLE) : '';
		if (!(await stub.friendsRoom(accountId))) return undefined;
		if (!(await friendGroup(env, group).showRoom(accountId, code, show, title, Date.now()))) {
			return undefined;
		}
		await stub.friendsRoom(accountId, { group, show });
	}
	const settings = await stub.friendsRoom(accountId);
	if (!settings) return undefined;
	const mine = new Set(await friendBook(env, accountId).groups());
	return { shown: settings.groups.filter((shown) => mine.has(shown)) };
}

/** Handles the group paths for `accountId`; undefined for any other path. */
export async function handleGroups(
	request: Request,
	env: FriendsEnv,
	path: string,
	accountId: string
): Promise<Response | undefined> {
	if (path !== GROUPS_API && !path.startsWith(`${GROUPS_API}/`)) return undefined;
	if (path === GROUPS_API && request.method === 'GET') {
		return json({ groups: await accountGroups(env, accountId) });
	}
	if (request.method !== 'POST') return fail(404, 'Not found');
	const body = await readBody(request);
	switch (path) {
		case GROUP_CREATE_API:
			return json(await create(env, accountId, body));
		case GROUP_JOIN_API:
			// Codes can't be tried one after another.
			if (env.FRIEND_LOOKUPS && !(await env.FRIEND_LOOKUPS.limit({ key: accountId })).success) {
				return fail(429, 'Too many tries. Wait a minute and try again.');
			}
			return json(await join(env, accountId, body));
		case GROUP_LEAVE_API: {
			const code = normaliseGroupCode(body?.code);
			if (!code) return fail(404, 'Not found');
			await leave(env, accountId, code);
			return json({ groups: await accountGroups(env, accountId) });
		}
		case GROUP_MEMBERS_API:
		case GROUP_REMOVE_API: {
			const code = normaliseGroupCode(body?.code);
			const group = code && friendGroup(env, code);
			if (!code || !group || (await group.info())?.owner !== accountId) {
				return fail(404, 'Not found');
			}
			const other = body?.id;
			if (path === GROUP_REMOVE_API && typeof other === 'string' && other !== accountId) {
				await group.leave(other);
				await friendBook(env, other).dropGroup(code);
			}
			const ids = await group.members();
			const members = await describe(
				env,
				ids.map((id) => ({ id, at: 0 }))
			);
			return json({ members } satisfies GroupMembersResponse);
		}
		case GROUP_ROOM_API: {
			const answer = await room(env, accountId, body);
			return answer ? json(answer) : fail(404, 'Not found');
		}
	}
	return fail(404, 'Not found');
}
