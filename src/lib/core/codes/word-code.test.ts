import { describe, expect, it } from 'vitest';
import {
	CODE_WORDS,
	isCodeWord,
	makeWordCode,
	normaliseWordCode,
	splitWords,
	wordCodeBits
} from './word-code.ts';

/** True when `a` and `b` differ by one added, removed or changed letter. */
function oneApart(a: string, b: string): boolean {
	if (Math.abs(a.length - b.length) > 1) return false;
	if (a.length === b.length) return [...a].filter((c, i) => c !== b[i]).length <= 1;
	const [short, long] = a.length < b.length ? [a, b] : [b, a];
	return [...long].some((_, i) => long.slice(0, i) + long.slice(i + 1) === short);
}

describe('code word list', () => {
	it('has 256 distinct lower-case words, so each word is one byte', () => {
		expect(CODE_WORDS).toHaveLength(256);
		expect(new Set(CODE_WORDS).size).toBe(256);
		for (const word of CODE_WORDS) expect(word).toMatch(/^[a-z]{3,10}$/);
	});

	it('never has two words with the same first four letters (typing four picks one)', () => {
		const prefixes = CODE_WORDS.map((w) => w.slice(0, 4));
		expect(new Set(prefixes).size).toBe(CODE_WORDS.length);
	});

	it('never has two words one letter apart, so a slip or mishearing is caught', () => {
		const close = CODE_WORDS.flatMap((a, i) =>
			CODE_WORDS.slice(i + 1)
				.filter((b) => oneApart(a, b))
				.map((b) => `${a}/${b}`)
		);
		expect(close).toEqual([]);
	});

	it('keeps the words that codes already handed out use (frozen list)', () => {
		expect(Object.isFrozen(CODE_WORDS)).toBe(true);
		for (const word of ['poisoned', 'drunk', 'imp', 'bell', 'night', 'grimoire']) {
			expect(isCodeWord(word)).toBe(true);
		}
		expect(isCodeWord('knight')).toBe(false);
	});
});

describe('word codes', () => {
	it('turns each random byte into one word', () => {
		const code = makeWordCode(4, (bytes) => bytes.fill(0).map((_, i) => i * 85));
		expect(code).toBe([CODE_WORDS[0], CODE_WORDS[85], CODE_WORDS[170], CODE_WORDS[255]].join('-'));
	});

	it('makes different codes with the real random source', () => {
		const codes = new Set(Array.from({ length: 50 }, () => makeWordCode(4)));
		expect(codes.size).toBe(50);
		for (const code of codes) expect(normaliseWordCode(code, 4)).toBe(code);
	});

	it('has 8 bits per word', () => {
		expect(wordCodeBits(4)).toBe(32);
	});

	it('accepts any case and separator, and gives the hyphenated form', () => {
		expect(normaliseWordCode(' Poisoned drunk,IMP / bell ', 4)).toBe('poisoned-drunk-imp-bell');
		expect(splitWords('poisoned-drunk')).toEqual(['poisoned', 'drunk']);
	});

	it('rejects the wrong number of words and words not on the list', () => {
		expect(normaliseWordCode('poisoned-drunk-imp', 4)).toBeNull();
		expect(normaliseWordCode('poisoned-drunk-imp-bell-dead', 4)).toBeNull();
		expect(normaliseWordCode('poisoned-drunk-imp-knight', 4)).toBeNull();
		expect(normaliseWordCode('', 4)).toBeNull();
	});
});
