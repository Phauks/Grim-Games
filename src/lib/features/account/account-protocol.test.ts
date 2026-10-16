import { describe, expect, it } from 'vitest';
import {
	describeDevice,
	normaliseCode,
	normaliseEmail,
	readSignInHash,
	signInHash
} from './account-protocol.ts';

describe('account protocol', () => {
	it('compares email addresses trimmed and lower-cased', () => {
		expect(normaliseEmail('  Trevor@Example.COM ')).toBe('trevor@example.com');
		expect(normaliseEmail('not an email')).toBeUndefined();
		expect(normaliseEmail('a@b')).toBeUndefined();
		expect(normaliseEmail(`${'a'.repeat(250)}@b.co`)).toBeUndefined();
		expect(normaliseEmail(42)).toBeUndefined();
	});

	it('reads typed codes, ignoring spaces and dashes', () => {
		expect(normaliseCode('123 456')).toBe('123456');
		expect(normaliseCode('123-456')).toBe('123456');
		expect(normaliseCode('12345')).toBeUndefined();
		expect(normaliseCode('abcdef')).toBeUndefined();
	});

	it('puts the sign-in token in the URL hash and reads it back', () => {
		const token = 'z7B0l-oBlpGgXv5UOzGj5ze8wofahdnfCWTxq9QnnpI';
		const hash = signInHash('a+b@example.com', token);
		expect(hash.startsWith('#')).toBe(true);
		expect(readSignInHash(hash)).toEqual({ email: 'a+b@example.com', token });
		expect(readSignInHash('#s=abc')).toBeUndefined();
		expect(readSignInHash('#signin=short&email=a%40b.co')).toBeUndefined();
	});

	it('names devices from the User-Agent', () => {
		expect(
			describeDevice(
				'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
			)
		).toBe('Safari on iPhone');
		expect(describeDevice(null)).toBe('Unknown device');
	});
});
