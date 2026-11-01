/**
 * The signed-in account's groups (plan F6), loaded from `worker/friends/groups.ts` with the
 * Friends page and the room's Share, and again when the app comes back to the front, so a
 * group's new game shows without anything being sent (Trevor, 2026-10-31: not spammy).
 */
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { AccountApiError, call } from '#lib/features/account/account-api.ts';
import { account } from '#lib/features/account/account.svelte.ts';
import {
	GROUP_CREATE_API,
	GROUP_JOIN_API,
	GROUP_LEAVE_API,
	GROUP_MEMBERS_API,
	GROUP_REMOVE_API,
	GROUP_ROOM_API,
	GROUPS_API,
	type GroupChangeResponse,
	type GroupMembersResponse,
	type GroupRoomRequest,
	type GroupRoomResponse,
	type GroupsResponse,
	type GroupSummary
} from './groups-protocol.ts';
import type { FriendAccount } from './friends-protocol.ts';

let data = $state.raw<GroupSummary[] | undefined>(undefined);
/** Bumped when the account changes, so an answer for the previous one is dropped. */
let generation = 0;
/** A screen asked for them: loaded again once the account is known or changes. */
let wanted = false;

async function update<T extends GroupsResponse | GroupChangeResponse>(
	load: () => Promise<T>
): Promise<T> {
	const started = generation;
	try {
		const next = await load();
		if (started === generation && 'groups' in next) data = next.groups;
		return next;
	} catch (e) {
		if (!(e instanceof AccountApiError)) reportError(e, { area: 'friends', notify: false });
		throw e;
	}
}

export const groups = {
	/** Undefined until loaded, and while signed out. */
	get data(): GroupSummary[] | undefined {
		return data;
	},
	load(): Promise<void> {
		wanted = true;
		if (account.status !== 'signed-in') return Promise.resolve();
		return update(() => call<GroupsResponse>(GROUPS_API)).then(
			() => {},
			() => {}
		);
	},
	create(name: string): Promise<GroupChangeResponse> {
		return update(() => call<GroupChangeResponse>(GROUP_CREATE_API, 'POST', { name }));
	},
	join(code: string): Promise<GroupChangeResponse> {
		return update(() => call<GroupChangeResponse>(GROUP_JOIN_API, 'POST', { code }));
	},
	/** Leaves the group; its owner's leaving deletes it. */
	async leave(code: string): Promise<void> {
		await update(() => call<GroupsResponse>(GROUP_LEAVE_API, 'POST', { code }));
	},
	/** The group's members, for its owner. */
	async members(code: string): Promise<FriendAccount[]> {
		return (await call<GroupMembersResponse>(GROUP_MEMBERS_API, 'POST', { code })).members;
	},
	async remove(code: string, id: string): Promise<FriendAccount[]> {
		return (await call<GroupMembersResponse>(GROUP_REMOVE_API, 'POST', { code, id })).members;
	},
	/** Which of the Storyteller's groups show their room, after an optional change. */
	async room(request: GroupRoomRequest): Promise<string[]> {
		return (await call<GroupRoomResponse>(GROUP_ROOM_API, 'POST', request)).shown;
	}
};

if (typeof document !== 'undefined') {
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible' && wanted) void groups.load();
	});
}

account.onChange((user) => {
	generation++;
	data = undefined;
	if (user && wanted) void groups.load();
});
