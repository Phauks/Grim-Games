/**
 * What a friend request does, decided from what one account's `FriendBook` already holds
 * about the other (worker/friends/book.ts). Pure, so both sides' rules are tested here.
 */
import {
	MAX_FRIENDS,
	MAX_PENDING,
	REQUESTS_PER_DAY,
	type RequestRefusal
} from './friends-protocol.ts';

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
