import { describe, expect, it } from 'vitest';
import { digitCodeBits, formatDigitCode, makeDigitCode, normaliseDigitCode } from './digit-code.ts';

describe('digit codes', () => {
	it('keeps leading zeros, so every code has the full length', () => {
		expect(makeDigitCode(6, (v) => v.fill(42))).toBe('000042');
	});

	it('draws again rather than favour low codes', () => {
		// 2^32 is not a multiple of 10^6: values from 4,294,000,000 up would bias 0–967,295.
		const draws = [4_294_967_295, 123_456];
		expect(makeDigitCode(6, (v) => v.fill(draws.shift()!))).toBe('123456');
	});

	it('makes different codes with the real random source', () => {
		const codes = new Set(Array.from({ length: 50 }, () => makeDigitCode(6)));
		expect(codes.size).toBeGreaterThan(45);
		for (const code of codes) expect(code).toMatch(/^\d{6}$/);
	});

	it('has about 20 bits in six digits', () => {
		expect(digitCodeBits(6)).toBeCloseTo(19.93, 2);
	});

	it('accepts spaces, hyphens and dots, and nothing else', () => {
		expect(normaliseDigitCode(' 482 913 ', 6)).toBe('482913');
		expect(normaliseDigitCode('482-913', 6)).toBe('482913');
		expect(normaliseDigitCode('48291', 6)).toBeNull();
		expect(normaliseDigitCode('4829130', 6)).toBeNull();
		expect(normaliseDigitCode('48291a', 6)).toBeNull();
		expect(normaliseDigitCode('', 6)).toBeNull();
	});

	it('shows six digits as two groups of three', () => {
		expect(formatDigitCode('482913')).toBe('482 913');
	});
});
