/**
 * The signed-in account's friends (plan F1), loaded from `worker/friends/routes.ts` when
 * someone signs in and whenever the Friends page opens. Signed out, there is nothing.
 */
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { AccountApiError, call } from '#lib/features/account/account-api.ts';
import { account } from '#lib/features/account/account.svelte.ts';
import {
	friendActionApi,
	FRIEND_REQUESTS_API,
	FRIEND_SETTINGS_API,
	FRIENDS_API,
	type FriendAction,
	type FriendsResponse,
	type RequestResponse
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
	/** Requests waiting for this account's answer. */
	get waiting(): number {
		return data?.incoming.length ?? 0;
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
	act(action: FriendAction, id: string): Promise<void> {
		return update(() => call<FriendsResponse>(friendActionApi(action), 'POST', { id }));
	},
	setFindable(findable: boolean): Promise<void> {
		return update(() => call<FriendsResponse>(FRIEND_SETTINGS_API, 'PUT', { findable }));
	}
};

account.onChange((user) => {
	generation++;
	data = undefined;
	error = '';
	if (user) void friends.load();
});
