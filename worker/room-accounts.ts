/**
 * Which signed-in account is on each phone in a room (plan F2, Trevor 2026-10-29: always on,
 * no switch), so a player can be added as a friend from the game.
 *
 * The app Worker reads the session cookie when a socket opens and hands the account to the
 * room as a socket tag. The room keeps it in its own storage only: no message carries it, so
 * other phones never learn it, and older apps see no change.
 */
import type { RoomState } from '../src/lib/core/sync/room.ts';
import { gamePlayers, type GamePlayer } from '../src/lib/features/friends/friend-rules.ts';
import type { AccountEnv } from './account/objects.ts';
import { getUser } from './account/routes.ts';
import { friendBook, type FriendsEnv } from './friends/routes.ts';

const TAG_PREFIX = 'account:';
/** Where a room keeps its accounts: the Storyteller's under `host`, players' by member id. */
const STORAGE_KEY = 'accounts';
const HOST = 'host';

type Accounts = Record<string, string>;

/** The socket's tags for its account, if the person opening it is signed in. */
export function accountTags(accountId: string | undefined): string[] {
	return accountId ? [`${TAG_PREFIX}${accountId}`] : [];
}

/** The account on a socket, if its person was signed in when it opened. */
function socketAccount(ctx: DurableObjectState, ws: WebSocket): string | undefined {
	const tag = ctx.getTags(ws).find((t) => t.startsWith(TAG_PREFIX));
	return tag?.slice(TAG_PREFIX.length);
}

/**
 * Friends see this account in a game (plan F5): the room's code goes in its friend book when
 * a socket joins as Storyteller or player, and leaves when its last such socket closes.
 */
export async function notePresence(
	ctx: DurableObjectState,
	env: Pick<FriendsEnv, 'FRIEND_BOOKS' | 'DATA'>,
	ws: WebSocket,
	joined: boolean
): Promise<void> {
	const accountId = socketAccount(ctx, ws);
	const code = accountId && (await ctx.storage.get<string>('code'));
	if (!accountId || !code) return;
	const book = friendBook(env, accountId);
	if (joined) return book.joinedRoom(code, Date.now());
	const still = ctx.getWebSockets(`${TAG_PREFIX}${accountId}`).some((socket) => {
		const role = (socket.deserializeAttachment() as { role?: string } | null)?.role;
		return (
			socket !== ws &&
			socket.readyState === WebSocket.OPEN &&
			(role === 'host' || role === 'player')
		);
	});
	if (!still) await book.leftRoom(code);
}

/** Remembers the socket's account (if any) for the Storyteller, or a player by member id. */
export async function linkAccount(
	ctx: DurableObjectState,
	ws: WebSocket,
	who: { host: true } | { memberId: string }
): Promise<void> {
	const tag = ctx.getTags(ws).find((t) => t.startsWith(TAG_PREFIX));
	if (!tag) return;
	const key = 'host' in who ? HOST : who.memberId;
	const accounts = (await ctx.storage.get<Accounts>(STORAGE_KEY)) ?? {};
	const accountId = tag.slice(TAG_PREFIX.length);
	if (accounts[key] === accountId) return;
	await ctx.storage.put(STORAGE_KEY, { ...accounts, [key]: accountId });
}

/** The signed-in Storyteller and seated players of the room's game, for Recent players (plan F3). */
export async function roomPlayers(ctx: DurableObjectState, room: RoomState): Promise<GamePlayer[]> {
	const accounts = (await ctx.storage.get<Accounts>(STORAGE_KEY)) ?? {};
	return gamePlayers(accounts, room.members, room.public?.storytellerName);
}

/**
 * The accounts in a room, for inviting friends to it (plan F4): only for its Storyteller's
 * own account, so no one else can learn who is there.
 */
export async function hostedAccounts(
	ctx: DurableObjectState,
	requester: string
): Promise<string[] | undefined> {
	const accounts = (await ctx.storage.get<Accounts>(STORAGE_KEY)) ?? {};
	if (accounts[HOST] !== requester) return undefined;
	return [...new Set(Object.values(accounts))];
}

/** Who in a room is asked: the player in a seat, or the Storyteller. */
export type SeatTarget = { seatId: string } | { storyteller: true };

/**
 * The account of the player in a seat, or of the Storyteller, for `requester` to ask as a
 * friend: only someone whose own account is in this room (the Storyteller or a player) may
 * ask. `self` when it is the requester's own.
 */
export async function seatAccount(
	ctx: DurableObjectState,
	room: RoomState | undefined,
	requester: string,
	target: SeatTarget
): Promise<string | 'self' | undefined> {
	if (!room) return undefined;
	const accounts = (await ctx.storage.get<Accounts>(STORAGE_KEY)) ?? {};
	if (!Object.values(accounts).includes(requester)) return undefined;
	const member =
		'seatId' in target ? room.members.find((m) => m.seatId === target.seatId) : undefined;
	const accountId = 'storyteller' in target ? accounts[HOST] : member && accounts[member.memberId];
	if (!accountId) return undefined;
	return accountId === requester ? 'self' : accountId;
}

/** Carries the account from the app Worker to the room; never trusted from the browser. */
const ACCOUNT_HEADER = 'X-Grim-Account';

/** The socket request as the room gets it: with the signed-in account, if any. */
export async function withAccount(request: Request, env: AccountEnv): Promise<Request> {
	const headers = new Headers(request.headers);
	headers.delete(ACCOUNT_HEADER);
	// Only sockets need it: a room's preview (a plain GET) doesn't look anyone up.
	const socket = headers.get('Upgrade')?.toLowerCase() === 'websocket';
	const auth = socket && headers.has('Cookie') ? await getUser(request, env) : undefined;
	if (auth) headers.set(ACCOUNT_HEADER, auth.userId);
	return new Request(request, { headers });
}

/** The account `withAccount` put on the request. */
export const requestAccount = (request: Request) =>
	request.headers.get(ACCOUNT_HEADER) ?? undefined;
