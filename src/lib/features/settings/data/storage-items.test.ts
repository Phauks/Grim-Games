import { describe, expect, it } from 'vitest';
import { keyBytes, totalBytes, valueBytes } from './storage-items.ts';

class MemoryStorage implements Storage {
	private map = new Map<string, string>();
	get length() {
		return this.map.size;
	}
	clear() {
		this.map.clear();
	}
	getItem(key: string) {
		return this.map.get(key) ?? null;
	}
	key(index: number) {
		return [...this.map.keys()][index] ?? null;
	}
	removeItem(key: string) {
		this.map.delete(key);
	}
	setItem(key: string, value: string) {
		this.map.set(key, value);
	}
}

describe('storage sizes', () => {
	it('counts text as two bytes a character and files at their size', () => {
		expect(valueBytes('abc')).toBe(6);
		expect(valueBytes(new Uint8Array(10))).toBe(10);
		expect(valueBytes(new Blob(['12345']))).toBe(5);
		expect(valueBytes({ ab: 'c' })).toBe(4 + 2);
		expect(valueBytes([1, true, null])).toBe(16);
	});

	it('counts only the matching keys, name and value', () => {
		const storage = new MemoryStorage();
		storage.setItem('grim-games:a', 'xy');
		storage.setItem('other', 'zzzz');
		expect(keyBytes(storage, (key) => key.startsWith('grim-games'))).toBe((12 + 2) * 2);
	});

	it('totals what could be measured', () => {
		const item = { clearable: true, userData: false } as const;
		expect(
			totalBytes([
				{ ...item, id: 'games', bytes: 100 },
				{ ...item, id: 'icons', bytes: null },
				{ ...item, id: 'wiki', bytes: 20 }
			])
		).toBe(120);
	});
});
