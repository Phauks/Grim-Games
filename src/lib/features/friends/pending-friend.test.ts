import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearPendingFriend,
	keepPendingFriend,
	pendingFriend,
	PENDING_FRIEND_TTL_MS
} from './pending-friend.ts';

beforeEach(() => {
	const items = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, value: string) => void items.set(key, value),
		removeItem: (key: string) => void items.delete(key)
	});
});
afterEach(() => vi.unstubAllGlobals());

describe('a friend code opened while signed out (plan F12)', () => {
	it('keeps the username until it is cleared', () => {
		keepPendingFriend('Ann.B', 1000);
		expect(pendingFriend(2000)).toBe('Ann.B');
		clearPendingFriend();
		expect(pendingFriend(2000)).toBeUndefined();
	});

	it('drops a name kept for over a day, or from the future', () => {
		keepPendingFriend('ann', 1000);
		expect(pendingFriend(1000 + PENDING_FRIEND_TTL_MS)).toBe('ann');
		expect(pendingFriend(1001 + PENDING_FRIEND_TTL_MS)).toBeUndefined();
		expect(pendingFriend(999)).toBeUndefined();
	});

	it('ignores a damaged value', () => {
		localStorage.setItem('grim-games:pending-friend', '{"username":"no spaces","at":1}');
		expect(pendingFriend(2)).toBeUndefined();
		localStorage.setItem('grim-games:pending-friend', 'not json');
		expect(pendingFriend(2)).toBeUndefined();
	});
});
