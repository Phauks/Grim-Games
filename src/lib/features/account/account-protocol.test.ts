import { describe, expect, it } from 'vitest';
import {
	describeDevice,
	readPlace,
	checkPassword,
	cleanEmail,
	normaliseCode,
	normaliseEmail,
	normaliseIcon,
	normaliseUsername,
	readSignInHash,
	signInHash,
	usernameKey
} from './account-protocol.ts';

describe('account protocol', () => {
	it('compares email addresses trimmed and lower-cased', () => {
		expect(normaliseEmail('  Trevor@Example.COM ')).toBe('trevor@example.com');
		expect(normaliseEmail('not an email')).toBeUndefined();
		expect(normaliseEmail('a@b')).toBeUndefined();
		expect(normaliseEmail(`${'a'.repeat(250)}@b.co`)).toBeUndefined();
		expect(normaliseEmail(42)).toBeUndefined();
	});

	it('keeps an address as typed for showing, and compares it lower-cased', () => {
		expect(cleanEmail('  Trevor@Example.COM ')).toBe('Trevor@Example.COM');
		expect(normaliseEmail(cleanEmail('Trevor@Example.COM'))).toBe('trevor@example.com');
		expect(cleanEmail('not an email')).toBeUndefined();
	});

	it('takes passwords of 10 to 200 characters exactly as typed', () => {
		expect(checkPassword(' correct horse ')).toBe(' correct horse ');
		expect(checkPassword('short')).toBeUndefined();
		expect(checkPassword('x'.repeat(201))).toBeUndefined();
		expect(checkPassword(12345678901)).toBeUndefined();
	});

	it('reads typed codes, ignoring spaces and dashes', () => {
		expect(normaliseCode('123 456')).toBe('123456');
		expect(normaliseCode('123-456')).toBe('123456');
		expect(normaliseCode('12345')).toBeUndefined();
		expect(normaliseCode('abcdef')).toBeUndefined();
	});

	it('accepts usernames of plain letters, digits, dot, dash and underscore', () => {
		expect(normaliseUsername('  Trevor_G ')).toBe('Trevor_G');
		expect(normaliseUsername('a.b-c')).toBe('a.b-c');
		expect(normaliseUsername('ab')).toBeUndefined();
		expect(normaliseUsername('x'.repeat(25))).toBeUndefined();
		expect(normaliseUsername('two words')).toBeUndefined();
		// Look-alike letters from other alphabets (Cyrillic а) can't impersonate a name.
		expect(normaliseUsername('trаvor')).toBeUndefined();
		expect(normaliseUsername(7)).toBeUndefined();
		expect(usernameKey('Trevor_G')).toBe(usernameKey('trevor_g'));
	});

	it('accepts a character id or null as the profile icon, nothing else', () => {
		expect(normaliseIcon('fortune_teller')).toBe('fortune_teller');
		expect(normaliseIcon(null)).toBeNull();
		for (const bad of ['', 'Imp', 'https://example.com/a.png', 'a'.repeat(41), 7, undefined]) {
			expect(normaliseIcon(bad)).toBeUndefined();
		}
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

describe('readPlace', () => {
	it("keeps only the city and country from Cloudflare's request data", () => {
		expect(
			readPlace({ city: ' Austin ', country: 'US', region: 'Texas', latitude: '30.2' })
		).toEqual({ city: 'Austin', country: 'US' });
		expect(readPlace({ country: 'GB' })).toEqual({ country: 'GB' });
	});
	it('is undefined without a place, as in local development', () => {
		expect(readPlace(undefined)).toBeUndefined();
		expect(readPlace({})).toBeUndefined();
		expect(readPlace({ city: '', country: 'not a code' })).toBeUndefined();
	});
});
