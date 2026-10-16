import { describe, expect, it } from 'vitest';
import { cachedOnUse, precached, RUNTIME_CACHE, staleCaches } from './cache-rules.ts';

describe('precached', () => {
	it('keeps what a game needs at install', () => {
		expect(precached('/_app/immutable/chunks/abc.js')).toBe(true);
		expect(precached('/_app/immutable/assets/0.css')).toBe(true);
		expect(precached('/data/roles.json')).toBe(true);
		expect(precached('/data/icons/generic/demon_e.webp')).toBe(true);
		expect(precached('/_app/immutable/assets/inter-latin-400-normal.x1.woff2')).toBe(true);
		expect(precached('/_app/immutable/assets/inter-latin-ext-400-normal.x1.woff2')).toBe(true);
	});

	it('leaves edition icons, .woff and other font subsets for first use', () => {
		expect(precached('/data/icons/tb/imp_e.webp')).toBe(false);
		expect(precached('/data/icons/fabled/doomsayer.webp')).toBe(false);
		expect(precached('/_app/immutable/assets/inter-latin-400-normal.x1.woff')).toBe(false);
		expect(precached('/_app/immutable/assets/inter-cyrillic-ext-400-normal.x1.woff2')).toBe(false);
		expect(precached('/_app/immutable/assets/inter-vietnamese-400-normal.x1.woff2')).toBe(false);
	});
});

describe('cachedOnUse', () => {
	it('covers icons and build files, not APIs or pages', () => {
		expect(cachedOnUse('/data/icons/tb/imp_e.webp')).toBe(true);
		expect(cachedOnUse('/_app/immutable/assets/inter-latin-400-normal.x1.woff')).toBe(true);
		expect(cachedOnUse('/api/health')).toBe(false);
		expect(cachedOnUse('/grimoire/abc')).toBe(false);
	});
});

describe('staleCaches', () => {
	const keys = ['grim-games-c', 'grim-games-b', 'grim-games-a', RUNTIME_CACHE, 'other-app'];

	it('keeps the new build, the one it replaces and the runtime cache', () => {
		expect(staleCaches(keys, 'grim-games-c', 'grim-games-b')).toEqual(['grim-games-a']);
	});

	it('deletes every older build when there is no record of the previous one', () => {
		expect(staleCaches(keys, 'grim-games-c', undefined)).toEqual(['grim-games-b', 'grim-games-a']);
	});

	it('leaves caches that are not ours', () => {
		expect(staleCaches(['other-app'], 'grim-games-c', undefined)).toEqual([]);
	});
});
