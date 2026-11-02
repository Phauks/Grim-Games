/**
 * What a friend request does, decided from what one account's `FriendBook` already holds
 * about the other (worker/friends/book.ts). Pure, so both sides' rules are tested here.
 */
import {
	MAX_FRIENDS,
	MAX_PENDING,
	REQUESTS_PER_DAY,
	type FriendsResponse,
	type RecentPlayer,
	type RequestRefusal
} from './friends-protocol.ts';

/** Games played together before someone on Recent players is suggested (plan F13). */
const SUGGEST_AFTER_GAMES = 2;

/**
 * Suggestions on Friends (plan F13): people on Recent players this account played at least
 * two games with, who can be found by username, and who are not yet a friend, asked either
 * way or blocked. Recent players already leaves out anyone who can't be found; its `state`
 * is `add` only for someone neither a friend nor asked, and a request from them waits in
 * `incoming`. Someone in `shown` (suggested earlier on this visit) stays once asked, showing
 * Requested, so their row doesn't leave under the finger.
 */
export function suggestedPlayers(
	data: Pick<FriendsResponse, 'incoming' | 'blocked' | 'recent'>,
	shown: (id: string) => boolean = () => false
): RecentPlayer[] {
	const taken = new Set([...data.incoming, ...data.blocked].map((other) => other.id));
	return (data.recent ?? []).filter((other) => {
		if (taken.has(other.id)) return false;
		if (other.state === 'requested') return shown(other.id);
		return other.state === 'add' && other.games >= SUGGEST_AFTER_GAMES;
	});
}

/** What one account holds about another. */
export interface Relation {
	friend: boolean;
	/** The other asked this account. */
	incoming: boolean;
	/** This account asked the other. */
	outgoing: boolean;
	/** This account blocked the other. */
	blocked: boolean;
}

/** How full one account's book is. */
export interface BookCounts {
	friends: number;
	/** Requests waiting, both ways. */
	pending: number;
	/** Requests sent in the last day. */
	sentToday: number;
}

export const NO_RELATION: Relation = {
	friend: false,
	incoming: false,
	outgoing: false,
	blocked: false
};

/**
 * The asker's side. `accept` when the other had already asked: asking back makes friends.
 * Asking again while a request waits is `send` without counting against the day's limit.
 */
export type SendPlan =
	| { kind: 'refuse'; reason: RequestRefusal }
	| { kind: 'accept' }
	| { kind: 'send'; counts: boolean };

export function planSend(relation: Relation, counts: BookCounts): SendPlan {
	if (relation.friend) return { kind: 'refuse', reason: 'already' };
	if (relation.blocked) return { kind: 'refuse', reason: 'blocked' };
	if (counts.friends >= MAX_FRIENDS) return { kind: 'refuse', reason: 'full' };
	if (relation.incoming) return { kind: 'accept' };
	if (relation.outgoing) return { kind: 'send', counts: false };
	if (counts.sentToday >= REQUESTS_PER_DAY) return { kind: 'refuse', reason: 'limit' };
	if (counts.pending >= MAX_PENDING) return { kind: 'refuse', reason: 'full' };
	return { kind: 'send', counts: true };
}

/**
 * The receiver's side of a request. `ignore` drops it without telling the asker, who still
 * sees it as sent: a block, or a full book, can't be found out by asking.
 * `friends` when both had asked each other.
 */
export type ReceivePlan = 'store' | 'friends' | 'ignore';

export function planReceive(relation: Relation, counts: BookCounts): ReceivePlan {
	if (relation.blocked || relation.friend) return 'ignore';
	if (counts.friends >= MAX_FRIENDS) return 'ignore';
	if (relation.outgoing) return 'friends';
	if (relation.incoming) return 'store';
	return counts.pending >= MAX_PENDING ? 'ignore' : 'store';
}

/** One signed-in person at a finished game, by account, with what they were called in it. */
export interface GamePlayer {
	id: string;
	name?: string;
}

/**
 * Who played a finished game (plan F3): the Storyteller and every seated player whose own
 * account was in the room, once per account. `accounts` is the room's own record, by `host`
 * or member id (worker/room-accounts.ts).
 */
export function gamePlayers(
	accounts: Readonly<Record<string, string>>,
	members: readonly { memberId: string; name?: string; seatId?: string }[],
	storytellerName?: string
): GamePlayer[] {
	const players = new Map<string, GamePlayer>();
	const add = (id: string | undefined, name: string | undefined) => {
		if (!id || players.has(id)) return;
		const trimmed = name?.trim();
		players.set(id, trimmed ? { id, name: trimmed } : { id });
	};
	add(accounts.host, storytellerName);
	for (const member of members) {
		if (member.seatId) add(accounts[member.memberId], member.name);
	}
	return [...players.values()];
}

/**
 * How long ago `then` was, in the largest whole unit, for "Last seen …" (plan F5): within
 * the hour reads as this hour, since last seen is only kept to the hour.
 */
export function sinceUnit(
	then: number,
	now: number
): { value: number; unit: 'hour' | 'day' | 'week' | 'month' } {
	const hours = Math.floor(Math.max(0, now - then) / (60 * 60 * 1000));
	if (hours < 24) return { value: 0 - hours, unit: 'hour' };
	const days = Math.floor(hours / 24);
	if (days < 7) return { value: -days, unit: 'day' };
	if (days < 30) return { value: -Math.floor(days / 7), unit: 'week' };
	return { value: -Math.floor(days / 30), unit: 'month' };
}
