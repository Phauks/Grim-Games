import { describe, expect, it } from 'vitest';
import { pushTargets, setPushAddress } from './room-push.ts';
import type { PushAddress } from './web-push.ts';

const address = (n: number): PushAddress => ({
	endpoint: `https://fcm.googleapis.com/fcm/send/${n}`,
	keys: { p256dh: `key${n}`, auth: `auth${n}` }
});

describe('Back to town pushes', () => {
	it('keeps one address per phone, and forgets it when the phone turns alerts off', () => {
		const one = setPushAddress({}, 'a', address(1));
		expect(one).toEqual({ a: address(1) });
		expect(setPushAddress(one, 'a', address(1))).toBe(one);
		expect(setPushAddress(one, 'a', address(2))).toEqual({ a: address(2) });
		expect(setPushAddress(one, 'b', address(2))).toEqual({ a: address(1), b: address(2) });
		expect(setPushAddress(one, 'a', undefined)).toEqual({});
		expect(setPushAddress(one, 'b', undefined)).toBe(one);
	});

	it('pushes to phones not showing the app', () => {
		const all = { a: address(1), b: address(2), c: address(3) };
		expect(pushTargets(all, new Set(['b']))).toEqual([
			['a', address(1)],
			['c', address(3)]
		]);
		expect(pushTargets(all, new Set(['a', 'b', 'c']))).toEqual([]);
	});
});
