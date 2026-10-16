import { describe, expect, it } from 'vitest';
import { isAppKey, isWikiKey, removeKeys } from './device-data.ts';

class MemoryStorage {
	#items = new Map<string, string>();
	get length() {
		return this.#items.size;
	}
	key(i: number) {
		return [...this.#items.keys()][i] ?? null;
	}
	getItem(key: string) {
		return this.#items.get(key) ?? null;
	}
	setItem(key: string, value: string) {
		this.#items.set(key, value);
	}
	removeItem(key: string) {
		this.#items.delete(key);
	}
}

describe('device data keys', () => {
	it("recognises every naming style the app's stores use, and nothing else", () => {
		expect(isAppKey('grim-games:preferences:v1')).toBe(true);
		expect(isAppKey('grim-games.share-codes')).toBe(true);
		expect(isAppKey('grim-games-room-host')).toBe(true);
		expect(isAppKey('grim-gamesx')).toBe(false);
		expect(isAppKey('other-app:key')).toBe(false);
	});

	it('finds wiki copies of every version', () => {
		expect(isWikiKey('grim-games:wiki-glossary:v2')).toBe(true);
		expect(isWikiKey('grim-games:wiki-pages')).toBe(true);
		expect(isWikiKey('grim-games:preferences:v1')).toBe(false);
	});

	it('removes only the matching keys', () => {
		const storage = new MemoryStorage();
		storage.setItem('grim-games:a', '1');
		storage.setItem('other', '2');
		storage.setItem('grim-games-b', '3');
		removeKeys(storage as unknown as Storage, isAppKey);
		expect(storage.getItem('other')).toBe('2');
		expect(storage.length).toBe(1);
	});
});
