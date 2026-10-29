import { describe, expect, it } from 'vitest';
import { friendLink, readFriendLink } from './friends-protocol.ts';

describe('friend links', () => {
	it('carries the username in the hash, and reads it back', () => {
		const link = friendLink('https://grimbinder.com', 'Ann.B');
		expect(link).toBe('https://grimbinder.com/friends#friend=Ann.B');
		expect(readFriendLink(link)).toBe('Ann.B');
		expect(readFriendLink('#friend=bob')).toBe('bob');
	});

	it('reads a link from any of the app’s addresses', () => {
		expect(readFriendLink('https://beta.example.workers.dev/friends#friend=cat')).toBe('cat');
	});

	it('ignores anything else', () => {
		expect(readFriendLink('https://grimbinder.com/join/123456')).toBeUndefined();
		expect(readFriendLink('https://grimbinder.com/friends')).toBeUndefined();
		expect(readFriendLink('hello')).toBeUndefined();
		expect(readFriendLink('#friend=%E0%A4%A')).toBeUndefined();
	});
});
