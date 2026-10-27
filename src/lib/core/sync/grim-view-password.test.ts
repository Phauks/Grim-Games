import { describe, expect, it } from 'vitest';
import { CODE_WORDS, type RandomBytes } from '#lib/core/codes/word-code.ts';
import {
	GRIM_VIEW_PASSWORD_BITS,
	newGrimViewPassword,
	normaliseGrimViewPassword
} from './grim-view-password.ts';

/** Hands out `values` in order, one byte at a time. */
function bytes(...values: number[]): RandomBytes {
	return (out) => {
		for (let i = 0; i < out.length; i++) out[i] = values.shift() ?? 0;
		return out;
	};
}

describe("Grim view's password", () => {
	it('is two code words and a number from 10 to 99', () => {
		const password = newGrimViewPassword();
		expect(password).toMatch(/^[a-z]+-[a-z]+-[1-9][0-9]$/);
		const [first, second] = password.split('-');
		expect(CODE_WORDS).toContain(first);
		expect(CODE_WORDS).toContain(second);
	});

	it('is made from the random bytes it is given', () => {
		expect(newGrimViewPassword(bytes(0, 255, 0))).toBe(`${CODE_WORDS[0]}-${CODE_WORDS[255]}-10`);
		expect(newGrimViewPassword(bytes(1, 2, 179))).toBe(`${CODE_WORDS[1]}-${CODE_WORDS[2]}-99`);
	});

	it('draws the number again rather than favour low numbers', () => {
		// 180 to 255 would make 10 to 85 more likely than 86 to 99.
		expect(newGrimViewPassword(bytes(0, 0, 180, 255, 5))).toBe(
			`${CODE_WORDS[0]}-${CODE_WORDS[0]}-15`
		);
	});

	it('has more randomness than six random digits', () => {
		expect(GRIM_VIEW_PASSWORD_BITS).toBeGreaterThan(6 * Math.log2(10));
	});

	it('is a different one each time', () => {
		const made = new Set(Array.from({ length: 20 }, () => newGrimViewPassword()));
		expect(made.size).toBeGreaterThan(15);
	});

	it('matches a made password however it was typed', () => {
		const made = newGrimViewPassword(bytes(10, 20, 30));
		const [a, b, n] = made.split('-');
		expect(normaliseGrimViewPassword(` ${a.toUpperCase()} ${b}  ${n} `)).toBe(made);
		expect(normaliseGrimViewPassword(`${a}.${b}/${n}`)).toBe(made);
		expect(normaliseGrimViewPassword(made)).toBe(made);
	});

	it("keeps the Storyteller's own password as typed", () => {
		expect(normaliseGrimViewPassword('  Hunter2 ')).toBe('Hunter2');
		expect(normaliseGrimViewPassword('Not A Code 42')).toBe('Not A Code 42');
		expect(normaliseGrimViewPassword('k3bx9q')).toBe('k3bx9q');
		// Made passwords never start the number with 0, so this is the Storyteller's own.
		expect(normaliseGrimViewPassword(`${CODE_WORDS[0]} ${CODE_WORDS[1]} 07`)).toBe(
			`${CODE_WORDS[0]} ${CODE_WORDS[1]} 07`
		);
	});
});
