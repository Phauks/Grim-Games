import { describe, expect, it } from 'vitest';
import { fnv1a, textHash } from './hash.ts';

describe('fnv1a', () => {
	it('matches the published FNV-1a 32-bit values', () => {
		const bytes = (s: string) => [...s].map((c) => c.charCodeAt(0));
		const of = (s: string) => {
			const b = bytes(s);
			return fnv1a(b.length, (i) => b[i]);
		};
		expect(of('')).toBe(0x811c9dc5);
		expect(of('a')).toBe(0xe40c292c);
		expect(of('foobar')).toBe(0xbf9cf968);
	});
});

describe('textHash', () => {
	it('is eight hex digits that tell different texts apart', () => {
		expect(textHash('Lamplighter')).toMatch(/^[0-9a-f]{8}$/);
		expect(textHash('Lamplighter')).toBe(textHash('Lamplighter'));
		expect(textHash('Lamplighter')).not.toBe(textHash('Lamplighter.'));
	});
});
