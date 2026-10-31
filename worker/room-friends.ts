/**
 * A live room's friends settings, kept beside the room (worker/room.ts): who is in it for
 * Invite friends (plan F4), whether friends may join without an invite (F5) and the groups
 * it shows in (F6). Only the room's own Storyteller reads or changes them; friends and
 * groups see only `RoomFriendsView`.
 */
import { hostedAccounts } from './room-accounts.ts';

/** One change from the Storyteller: friends joining on or off, or one group shown or not. */
export type RoomFriendsChange = { friendsJoin: boolean } | { group: string; show: boolean };

export interface RoomFriends {
	/** Every account in the room, the Storyteller's included. */
	accounts: string[];
	friendsJoin: boolean;
	groups: string[];
}

export interface RoomFriendsView {
	friendsJoin: boolean;
	groups: string[];
}

const FRIENDS_JOIN = 'friendsJoin';
const GROUPS = 'groups';

export async function roomFriendsView(ctx: DurableObjectState): Promise<RoomFriendsView> {
	return {
		friendsJoin: (await ctx.storage.get<boolean>(FRIENDS_JOIN)) === true,
		groups: (await ctx.storage.get<string[]>(GROUPS)) ?? []
	};
}

/** The settings, after `change`; undefined unless `requester` is the room's Storyteller. */
export async function roomFriends(
	ctx: DurableObjectState,
	requester: string,
	change?: RoomFriendsChange
): Promise<RoomFriends | undefined> {
	const accounts = await hostedAccounts(ctx, requester);
	if (!accounts) return undefined;
	if (change && 'friendsJoin' in change) await ctx.storage.put(FRIENDS_JOIN, change.friendsJoin);
	if (change && 'group' in change) {
		const shown = new Set((await ctx.storage.get<string[]>(GROUPS)) ?? []);
		if (change.show) shown.add(change.group);
		else shown.delete(change.group);
		await ctx.storage.put(GROUPS, [...shown]);
	}
	return { accounts, ...(await roomFriendsView(ctx)) };
}
