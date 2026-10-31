/**
 * A live room's friends settings, kept beside the room (worker/room.ts): who is in it for
 * Invite friends (plan F4) and whether friends may join without an invite (F5). Only the
 * room's own Storyteller reads or changes them; friends see only `RoomFriendsView`.
 */
import { hostedAccounts } from './room-accounts.ts';

/** One change from the Storyteller: friends joining on or off. */
export type RoomFriendsChange = { friendsJoin: boolean };

export interface RoomFriends {
	/** Every account in the room, the Storyteller's included. */
	accounts: string[];
	friendsJoin: boolean;
}

export interface RoomFriendsView {
	friendsJoin: boolean;
}

const FRIENDS_JOIN = 'friendsJoin';

export async function roomFriendsView(ctx: DurableObjectState): Promise<RoomFriendsView> {
	return {
		friendsJoin: (await ctx.storage.get<boolean>(FRIENDS_JOIN)) === true
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
	if (change) await ctx.storage.put(FRIENDS_JOIN, change.friendsJoin);
	return { accounts, ...(await roomFriendsView(ctx)) };
}
