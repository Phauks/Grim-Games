import { beforeEach, describe, expect, it } from 'vitest';
import { readParsed, readStored, readStoredText, writeStored, writeStoredText } from './stored.ts';

const store = new Map<string, string>();
beforeEach(() => {
	store.clear();
	globalThis.localStorage = {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, v),
		removeItem: (k: string) => void store.delete(k)
	} as Storage;
});

describe('stored', () => {
	it('round-trips JSON and removes on undefined', () => {
		expect(writeStored('a', { n: 1 })).toBe(true);
		expect(readStored('a')).toEqual({ n: 1 });
		writeStored('a', undefined);
		expect(readStored('a')).toBeUndefined();
	});

	it('reads damaged JSON as missing, through the parser', () => {
		store.set('a', '{nope');
		expect(readStored('a')).toBeUndefined();
		expect(readParsed('a', (raw) => raw ?? 'default')).toBe('default');
	});

	it('keeps plain text as it is', () => {
		writeStoredText('t', '1');
		expect(store.get('t')).toBe('1');
		expect(readStoredText('t')).toBe('1');
	});

	it('never throws when storage is blocked', () => {
		globalThis.localStorage = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			},
			removeItem: () => {
				throw new Error('blocked');
			}
		} as unknown as Storage;
		expect(readStored('a')).toBeUndefined();
		expect(writeStored('a', 1)).toBe(false);
		expect(readStoredText('a')).toBeUndefined();
	});
});
