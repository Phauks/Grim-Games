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
/** Invites one account may send in a day (the plan's limit, approved 2026-10-29). */
export const INVITES_PER_DAY = 50;
/** An invite is gone after this long; a room that closed sooner just can't be joined. */
export const INVITE_TTL_MS = 12 * 60 * 60 * 1000;
/** Invites kept waiting per account, newest first. */
export const MAX_INVITES = 50;
/** The longest game title an invite carries. */
export const MAX_INVITE_TITLE = 100;

/** Recent players kept per account, newest game first (plan F3). */
export const MAX_RECENT = 50;

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
	/** Signed-in people this account played a game with (plan F3); missing from older Workers. */
	recent?: RecentPlayer[];
	/** Friends' invites to their live games (plan F4), newest first; missing from older Workers. */
	invites?: FriendInvite[];
}

/** A friend's invite to the live room they run (plan F4). */
export interface FriendInvite {
	id: number;
	from: FriendAccount;
	/** The room's six-digit code, which Join opens. */
	code: string;
	/** The game's script name, as the Storyteller's Share showed it. */
	title: string;
	at: number;
}

/**
 * Someone this account played a finished game with (plan F3): both were signed in, in that
 * room. `at` is when their last game together ended; `name` is what they were called in it.
 */
export interface RecentPlayer extends FriendAccount {
	name?: string;
	games: number;
	/** Whether they can be added now: as a seat's Add friend answers. */
	state: SeatFriendState;
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
 * Inviting friends to the room this account runs (plan F4): `POST` with `InviteRequest`.
 * The room code goes in the body, never the URL.
 */
export const FRIEND_INVITE_API = `${FRIENDS_API}/invite`;
/** Declines an invite: `POST {id}`. */
export const FRIEND_INVITE_DISMISS_API = `${FRIENDS_API}/invites/dismiss`;

/** Without `id`, asks which friends are already in the room; with it, invites that friend. */
export interface InviteRequest {
	code: string;
	title: string;
	id?: string;
}

/**
 * The answer: `here` lists friends already in the room; `outcome` says what became of one
 * invite. `unavailable` covers a room this account doesn't run and someone no longer a friend.
 */
export interface InviteResponse {
	here: string[];
	outcome?: 'sent' | 'here' | 'unavailable' | 'limit';
}

/** Someone from Recent players, by id (plan F3): `POST` with `RecentFriendRequest`. */
export const FRIEND_RECENT_API = `${FRIENDS_API}/recent`;

/**
 * `POST /api/friends/seat`: a player by the seat they sit in, or the room's Storyteller
 * (Trevor, 2026-10-30, from Game info); `send` asks them, else only looks.
 */
export type SeatFriendTarget = ({ seatId: string } | { storyteller: true }) & { code: string };
export type SeatFriendRequest = SeatFriendTarget & { send?: boolean };
/** `POST /api/friends/recent`: someone on Recent players, answered as a seat is. */
export type RecentFriendTarget = { recent: string };
export type RecentFriendRequest = RecentFriendTarget & { send?: boolean };
/** Whoever an Add friend button asks: a seat, the Storyteller, or a recent player. */
export type FriendTarget = SeatFriendTarget | RecentFriendTarget;

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
