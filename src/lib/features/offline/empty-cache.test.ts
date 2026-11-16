import { describe, expect, it } from 'vitest';
import { emptyCache } from './empty-cache.ts';

/** A Cache Storage with one cache, recording what was deleted. */
function fakeStorage(entries: string[]) {
	const log: string[] = [];
	const names = new Set(['grim-games-runtime-v1']);
	const cache = {
		keys: async () => entries.map((url) => ({ url }) as Request),
		delete: async (request: Request) => {
			log.push(`entry ${request.url}`);
			return true;
		}
	} as unknown as Cache;
	const store = {
		has: async (name: string) => names.has(name),
		open: async (name: string) => {
			log.push(`open ${name}`);
			return cache;
		},
		delete: async (name: string) => {
			log.push(`cache ${name}`);
			return names.delete(name);
		}
	} as unknown as CacheStorage;
	return { store, log };
}

describe('emptyCache', () => {
	it('deletes every entry and keeps the cache, so a copy the worker holds stays the same one', async () => {
		const { store, log } = fakeStorage(['/a.webp', '/b.webp']);
		await emptyCache(store, 'grim-games-runtime-v1');
		expect(log).toEqual(['open grim-games-runtime-v1', 'entry /a.webp', 'entry /b.webp']);
	});

	it('does not create a cache that is not there', async () => {
		const { store, log } = fakeStorage([]);
		await emptyCache(store, 'grim-games-other');
		expect(log).toEqual([]);
	});
});
