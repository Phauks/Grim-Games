import { describe, expect, it } from 'vitest';
import { MAX_FRIENDS, MAX_PENDING, REQUESTS_PER_DAY } from './friends-protocol.ts';
import { NO_RELATION, planReceive, planSend, type BookCounts } from './friend-rules.ts';

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
