import { describe, expect, it } from 'vitest';
import {
	MAX_FRIENDS,
	MAX_PENDING,
	REQUESTS_PER_DAY,
	type FriendAccount,
	type RecentPlayer,
	type SeatFriendState
} from './friends-protocol.ts';
import {
	gamePlayers,
	sinceUnit,
	suggestedPlayers,
	NO_RELATION,
	planReceive,
	planSend,
	type BookCounts
} from './friend-rules.ts';

const empty: BookCounts = { friends: 0, pending: 0, sentToday: 0 };

describe('sending a friend request', () => {
	it('sends a new request, counted against the day', () => {
		expect(planSend(NO_RELATION, empty)).toEqual({ kind: 'send', counts: true });
	});

	it('refuses a friend, and someone this account blocked', () => {
		expect(planSend({ ...NO_RELATION, friend: true }, empty)).toEqual({
			kind: 'refuse',
			reason: 'already'
		});
		expect(planSend({ ...NO_RELATION, blocked: true }, empty)).toEqual({
			kind: 'refuse',
			reason: 'blocked'
		});
	});

	it('makes friends when the other had already asked', () => {
		expect(planSend({ ...NO_RELATION, incoming: true }, empty)).toEqual({ kind: 'accept' });
	});

	it('asks again without counting it', () => {
		const counts = { ...empty, sentToday: REQUESTS_PER_DAY };
		expect(planSend({ ...NO_RELATION, outgoing: true }, counts)).toEqual({
			kind: 'send',
			counts: false
		});
	});

	it('stops at the day limit and a full book', () => {
		expect(planSend(NO_RELATION, { ...empty, sentToday: REQUESTS_PER_DAY })).toEqual({
			kind: 'refuse',
			reason: 'limit'
		});
		expect(planSend(NO_RELATION, { ...empty, pending: MAX_PENDING })).toEqual({
			kind: 'refuse',
			reason: 'full'
		});
		expect(
			planSend({ ...NO_RELATION, incoming: true }, { ...empty, friends: MAX_FRIENDS })
		).toEqual({ kind: 'refuse', reason: 'full' });
	});
});

describe('receiving a friend request', () => {
	it('keeps a new request', () => {
		expect(planReceive(NO_RELATION, empty)).toBe('store');
	});

	it('silently drops a request from someone blocked, or a friend', () => {
		expect(planReceive({ ...NO_RELATION, blocked: true }, empty)).toBe('ignore');
		expect(planReceive({ ...NO_RELATION, friend: true }, empty)).toBe('ignore');
	});

	it('makes friends when both asked', () => {
		expect(planReceive({ ...NO_RELATION, outgoing: true }, empty)).toBe('friends');
	});

	it('drops new requests once full, but keeps one already waiting', () => {
		const full = { ...empty, pending: MAX_PENDING };
		expect(planReceive(NO_RELATION, full)).toBe('ignore');
		expect(planReceive({ ...NO_RELATION, incoming: true }, full)).toBe('store');
		expect(planReceive(NO_RELATION, { ...empty, friends: MAX_FRIENDS })).toBe('ignore');
	});
});

describe('who played a finished game', () => {
	const accounts = { host: 'st', m1: 'ann', m2: 'bob', m3: 'cat' };

	it('takes the Storyteller and seated players with an account, with their names', () => {
		const members = [
			{ memberId: 'm1', name: 'Ann', seatId: 's1' },
			{ memberId: 'm2', name: ' Bob ', seatId: 's2' },
			{ memberId: 'm4', name: 'Dee', seatId: 's3' }
		];
		expect(gamePlayers(accounts, members, 'Sam')).toEqual([
			{ id: 'st', name: 'Sam' },
			{ id: 'ann', name: 'Ann' },
			{ id: 'bob', name: 'Bob' }
		]);
	});

	it('leaves out people in the room without a seat', () => {
		expect(gamePlayers(accounts, [{ memberId: 'm3', name: 'Cat' }])).toEqual([{ id: 'st' }]);
	});

	it('counts an account once, even on two phones', () => {
		const members = [
			{ memberId: 'm1', name: 'Ann', seatId: 's1' },
			{ memberId: 'm5', name: 'Ann again', seatId: 's2' }
		];
		expect(gamePlayers({ m1: 'ann', m5: 'ann' }, members)).toEqual([{ id: 'ann', name: 'Ann' }]);
	});
});

describe('how long ago a friend was last seen', () => {
	const hour = 60 * 60 * 1000;
	const now = 1_000 * 24 * hour;

	it('counts hours within a day, this hour at first', () => {
		expect(sinceUnit(now - 10 * 60 * 1000, now)).toEqual({ value: 0, unit: 'hour' });
		expect(sinceUnit(now - 5 * hour, now)).toEqual({ value: -5, unit: 'hour' });
	});

	it('then days, weeks and months', () => {
		expect(sinceUnit(now - 2 * 24 * hour, now)).toEqual({ value: -2, unit: 'day' });
		expect(sinceUnit(now - 15 * 24 * hour, now)).toEqual({ value: -2, unit: 'week' });
		expect(sinceUnit(now - 65 * 24 * hour, now)).toEqual({ value: -2, unit: 'month' });
	});

	it('reads a time from a fast clock as now', () => {
		expect(sinceUnit(now + hour, now)).toEqual({ value: 0, unit: 'hour' });
	});
});

describe('suggestions from recent players', () => {
	const account = (id: string): FriendAccount => ({ id, username: id, icon: null, at: 1 });
	const recent = (id: string, games: number, state: SeatFriendState = 'add'): RecentPlayer => ({
		...account(id),
		games,
		state
	});
	const none = { incoming: [], blocked: [] };

	it('suggests someone after two games together, not one', () => {
		const data = { ...none, recent: [recent('ann', 2), recent('bob', 1), recent('cat', 5)] };
		expect(suggestedPlayers(data).map((other) => other.id)).toEqual(['ann', 'cat']);
	});

	it('leaves out friends and people already asked', () => {
		const data = { ...none, recent: [recent('ann', 3, 'friends'), recent('bob', 3, 'requested')] };
		expect(suggestedPlayers(data)).toEqual([]);
	});

	it('leaves out someone whose request is waiting, and someone blocked', () => {
		const data = {
			incoming: [account('ann')],
			blocked: [account('bob')],
			recent: [recent('ann', 2), recent('bob', 2), recent('cat', 2)]
		};
		expect(suggestedPlayers(data).map((other) => other.id)).toEqual(['cat']);
	});

	it('keeps someone asked from the suggestions on this visit, not on the next', () => {
		const data = { ...none, recent: [recent('ann', 2, 'requested')] };
		expect(suggestedPlayers(data, (id) => id === 'ann').map((other) => other.id)).toEqual(['ann']);
		expect(suggestedPlayers(data)).toEqual([]);
	});

	it('leaves out anyone who cannot be added, such as a hidden account', () => {
		expect(suggestedPlayers({ ...none, recent: [recent('ann', 4, 'unavailable')] })).toEqual([]);
	});

	it('suggests nobody from a Worker with no Recent players', () => {
		expect(suggestedPlayers(none)).toEqual([]);
	});
});
