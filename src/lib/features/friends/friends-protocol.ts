/**
 * Friends (plan F1): what the app and the Worker (`worker/friends/`) send each other.
 *
 * A friendship is mutual: one account asks by the other's exact username, and the other
 * accepts. Each account's own `FriendBook` object keeps its side of every link, so nothing
 * about an account is listed anywhere it can be browsed. Design:
 * https://claude.ai/artifact/8ahBpAozQZ3UUpxVQ5QVoT (Trevor approved it 2026-10-29).
 */

/** At most this many friends per account. */
export const MAX_FRIENDS = 200;
/** Requests waiting for an answer, either way. Older ones are dropped. */
export const MAX_PENDING = 100;
/** Requests one account may send in a day (Trevor approved the plan's limit, 2026-10-29). */
export const REQUESTS_PER_DAY = 20;
/** A request nobody answered is gone after this long. */
export const REQUEST_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Another account as the app shows it: never its email. */
export interface FriendAccount {
	id: string;
	/** Null when the account has no username. */
	username: string | null;
	/** Its profile icon (an official character's id), or null for the default. */
	icon: string | null;
	/** When the friendship, request or block began. */
	at: number;
}

/** `GET /api/friends`: everything on the signed-in account's Friends page. */
export interface FriendsResponse {
	friends: FriendAccount[];
	/** Requests to this account, newest first. */
	incoming: FriendAccount[];
	/** Requests from this account, newest first. */
	outgoing: FriendAccount[];
	blocked: FriendAccount[];
	/** Whether others can find this account by its username. */
	findable: boolean;
}

/**
 * What became of a request sent by username. `sent` also covers someone who blocked the
 * sender, so a block can't be found out by asking.
 */
export type RequestOutcome = 'sent' | 'friends';

/** Why a request by username was refused. */
export type RequestRefusal =
	'not-found' | 'self' | 'already' | 'blocked' | 'no-username' | 'limit' | 'full';

/** `POST /api/friends/requests` answer. */
export type RequestResponse =
	| { ok: true; outcome: RequestOutcome; friends: FriendsResponse }
	| { ok: false; reason: RequestRefusal };

/** The actions on another account already on the Friends page (by its id). */
export const FRIEND_ACTIONS = [
	'accept',
	'decline',
	'cancel',
	'remove',
	'block',
	'unblock'
] as const;
export type FriendAction = (typeof FRIEND_ACTIONS)[number];

export function isFriendAction(value: string): value is FriendAction {
	return (FRIEND_ACTIONS as readonly string[]).includes(value);
}

/** The API's paths. */
export const FRIENDS_API = '/api/friends';
export const FRIEND_REQUESTS_API = `${FRIENDS_API}/requests`;
export const FRIEND_SETTINGS_API = `${FRIENDS_API}/settings`;
export const friendActionApi = (action: FriendAction) => `${FRIENDS_API}/${action}`;
/** A player in a live room, by seat (plan F2): `POST` with `SeatFriendRequest`. */
export const FRIEND_SEAT_API = `${FRIENDS_API}/seat`;

/**
 * `POST /api/friends/seat`: a player by the seat they sit in, or the room's Storyteller
 * (Trevor, 2026-10-30, from Game info); `send` asks them, else only looks.
 */
export type SeatFriendTarget = ({ seatId: string } | { storyteller: true }) & { code: string };
export type SeatFriendRequest = SeatFriendTarget & { send?: boolean };

/**
 * Whether the player in a seat can be added: `unavailable` when they aren't signed in, can't
 * be found, or anything else stops it (never which); `self` for the asker's own seat.
 */
export type SeatFriendState = 'unavailable' | 'self' | 'add' | 'requested' | 'friends';

export interface SeatFriendResponse {
	state: SeatFriendState;
	/** Why a `send` was refused. */
	refused?: RequestRefusal;
}

/**
 * A link that opens Add friend with this username filled in, for a friend QR code (Trevor,
 * 2026-10-29). The name is in the hash, which never reaches the server's logs.
 */
export function friendLink(origin: string, username: string): string {
	return `${origin}/friends#friend=${encodeURIComponent(username)}`;
}

/** The username in a friend link or its hash (`#friend=…`), as typed; undefined for anything else. */
export function readFriendLink(text: string): string | undefined {
	let hash: string;
	try {
		const url = new URL(text.trim());
		if (url.pathname !== '/friends') return undefined;
		hash = url.hash;
	} catch {
		hash = text.trim();
	}
	const match = /^#friend=([^&]+)$/.exec(hash);
	if (!match) return undefined;
	try {
		return decodeURIComponent(match[1]);
	} catch {
		return undefined;
	}
}
