import { describe, expect, it } from 'vitest';
import {
	ACCOUNT_ID_WORDLIST,
	ACCOUNT_ID_WORDS,
	isLegacyAccountId,
	isWordAccountId,
	randomAccountId
} from './account-id.ts';

describe('account ids', () => {
	it('has 256 different plain words, so each random byte picks one evenly', () => {
		expect(ACCOUNT_ID_WORDLIST).toHaveLength(256);
		expect(new Set(ACCOUNT_ID_WORDLIST).size).toBe(256);
		for (const word of ACCOUNT_ID_WORDLIST) expect(word).toMatch(/^[a-z]{1,12}$/);
	});

	it('chains five words picked by random bytes', () => {
		const id = randomAccountId((array) => array.fill(0).map((_, i) => i * 50));
		expect(id.split('-')).toHaveLength(ACCOUNT_ID_WORDS);
		expect(id).toBe([0, 50, 100, 150, 200].map((i) => ACCOUNT_ID_WORDLIST[i]).join('-'));
		expect(isWordAccountId(id)).toBe(true);
		expect(isWordAccountId(randomAccountId())).toBe(true);
	});

	it('tells word ids from the older hex ids and from anything else', () => {
		expect(isWordAccountId('amber-lantern-quiet-harbor-fox')).toBe(true);
		expect(isWordAccountId('amber-lantern')).toBe(false);
		expect(isWordAccountId('Amber-lantern-quiet-harbor-fox')).toBe(false);
		expect(isLegacyAccountId('a'.repeat(64))).toBe(true);
		expect(isLegacyAccountId('amber-lantern-quiet-harbor-fox')).toBe(false);
	});
});
