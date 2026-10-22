import { describe, expect, it } from 'vitest';
import { MAX_NAMES, parseBankCopies, rememberName, suggestNames } from './device-notes.ts';

describe('rememberName', () => {
	it('puts the newest name first without duplicates, ignoring case', () => {
		expect(rememberName(['Ana', 'Ben'], ' ben ')).toEqual(['ben', 'Ana']);
		expect(rememberName(['Ana'], '  ')).toEqual(['Ana']);
	});
	it(`keeps at most ${MAX_NAMES} names`, () => {
		const many = Array.from({ length: MAX_NAMES }, (_, i) => `P${i}`);
		expect(rememberName(many, 'New')).toHaveLength(MAX_NAMES);
	});
});

describe('suggestNames', () => {
	const past = ['Sam', 'Alex', 'Samira', 'Jess', 'Rosa'];
	it('suggests names starting with the text first, then containing it', () => {
		expect(suggestNames(past, 'sa', [])).toEqual(['Sam', 'Samira', 'Rosa']);
	});
	it('leaves out names already on another seat and the exact name typed', () => {
		expect(suggestNames(past, '', ['alex'])).toEqual(['Sam', 'Samira', 'Jess', 'Rosa']);
		expect(suggestNames(past, 'Sam', [])).toEqual(['Samira']);
	});
});

describe('parseBankCopies', () => {
	it('keeps whole counts above none, and ignores anything else', () => {
		expect([...parseBankCopies({ a: 2, b: 0, c: 1.5, d: '3', e: -1 })]).toEqual([['a', 2]]);
		expect(parseBankCopies(['a']).size).toBe(0);
		expect(parseBankCopies(null).size).toBe(0);
	});
});
