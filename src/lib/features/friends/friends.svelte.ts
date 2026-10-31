/**
 * The signed-in account's friends (plan F1), loaded from `worker/friends/routes.ts` when
 * someone signs in and whenever the Friends page opens. Signed out, there is nothing.
 */
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { AccountApiError, call } from '#lib/features/account/account-api.ts';
import { account } from '#lib/features/account/account.svelte.ts';
import {
	friendActionApi,
	FRIEND_INVITE_API,
	FRIEND_INVITE_DISMISS_API,
	FRIEND_PRESENCE_API,
	FRIEND_ROOM_API,
	FRIEND_RECENT_API,
	FRIEND_REQUESTS_API,
	FRIEND_SEAT_API,
	FRIEND_SETTINGS_API,
	FRIENDS_API,
	type FriendAction,
	type FriendsResponse,
	type FriendTarget,
	type InviteRequest,
	type InviteResponse,
	type RequestResponse,
	type SeatFriendResponse
} from './friends-protocol.ts';

let data = $state.raw<FriendsResponse | undefined>(undefined);
let error = $state('');
/** Bumped when the account changes, so an answer for the previous one is dropped. */
let generation = 0;

async function update(load: () => Promise<FriendsResponse>): Promise<void> {
	const started = generation;
	try {
		const next = await load();
		if (started !== generation) return;
		data = next;
		error = '';
	} catch (e) {
		if (started !== generation) return;
		error = e instanceof Error ? e.message : String(e);
		if (!(e instanceof AccountApiError)) reportError(e, { area: 'friends', notify: false });
		throw e;
	}
}

export const friends = {
	/** Undefined until loaded, and while signed out. */
	get data(): FriendsResponse | undefined {
		return data;
	},
	/** Why the last load or change failed; empty when it worked. */
	get error(): string {
		return error;
	},
	/** Requests and invites waiting for this account's answer (plan F1, F4). */
	get waiting(): number {
		return (data?.incoming.length ?? 0) + (data?.invites?.length ?? 0);
	},
	load(): Promise<void> {
		if (account.status !== 'signed-in') return Promise.resolve();
		return update(() => call<FriendsResponse>(FRIENDS_API)).catch(() => {});
	},
	/** Asks the account with this username; the answer says whether it worked. */
	async request(username: string): Promise<RequestResponse> {
		const answer = await call<RequestResponse>(FRIEND_REQUESTS_API, 'POST', { username });
		if (answer.ok) data = answer.friends;
		return answer;
	},
	/**
	 * The player in a live room's seat (plan F2), or someone on Recent players (F3): whether
	 * they can be added, or, with `send`, asks them. The Friends page reloads after a request
	 * goes out.
	 */
	async seat(request: FriendTarget & { send?: boolean }): Promise<SeatFriendResponse> {
		const api = 'recent' in request ? FRIEND_RECENT_API : FRIEND_SEAT_API;
		const answer = await call<SeatFriendResponse>(api, 'POST', request);
		if (request.send && !answer.refused) void friends.load();
		return answer;
	},
	act(action: FriendAction, id: string): Promise<void> {
		return update(() => call<FriendsResponse>(friendActionApi(action), 'POST', { id }));
	},
	/**
	 * Which friends are already in the room this account runs, or, with `id`, invites that
	 * friend to it (plan F4).
	 */
	invite(request: InviteRequest): Promise<InviteResponse> {
		return call<InviteResponse>(FRIEND_INVITE_API, 'POST', request);
	},
	/** Declines an invite; it goes from the list at once. */
	async dismissInvite(id: number): Promise<void> {
		await call(FRIEND_INVITE_DISMISS_API, 'POST', { id });
		if (data) data = { ...data, invites: data.invites?.filter((invite) => invite.id !== id) };
	},
	/** Shows friends this account's presence, or hides it (plan F5). */
	setShowPresence(show: boolean): Promise<void> {
		return update(() => call<FriendsResponse>(FRIEND_PRESENCE_API, 'PUT', { show }));
	},
	/**
	 * Whether friends may join the room this account runs without an invite (plan F5); with
	 * `open`, sets it.
	 */
	async friendRoom(code: string, open?: boolean): Promise<boolean> {
		const body = open === undefined ? { code } : { code, open };
		return (await call<{ open: boolean }>(FRIEND_ROOM_API, 'POST', body)).open;
	},
	setFindable(findable: boolean): Promise<void> {
		return update(() => call<FriendsResponse>(FRIEND_SETTINGS_API, 'PUT', { findable }));
	}
};

// Invites arrive when the app opens or comes back to the front (plan F4: no push yet).
if (typeof document !== 'undefined') {
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') void friends.load();
	});
}

account.onChange((user) => {
	generation++;
	data = undefined;
	error = '';
	if (user) void friends.load();
});
