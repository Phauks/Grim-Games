import { describe, expect, it } from 'vitest';
import {
	otherBuild,
	shellBuild,
	cachedOnUse,
	parseHashes,
	precached,
	RUNTIME_CACHE,
	staleCaches,
	unchanged
} from './cache-rules.ts';

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

	it('leaves sound recordings for the devices that play them', () => {
		expect(precached('/sounds/ambience/night-meadow.mp3')).toBe(false);
		expect(precached('/ocr/eng.traineddata.gz')).toBe(false);
	});

	it('leaves out the Cloudflare headers file, which is never served', () => {
		expect(precached('/_headers')).toBe(false);
	});
});

describe('cachedOnUse', () => {
	it('covers icons, sounds and build files, not APIs or pages', () => {
		expect(cachedOnUse('/data/icons/tb/imp_e.webp')).toBe(true);
		expect(cachedOnUse('/sounds/ambience/day-forest.mp3')).toBe(true);
		expect(cachedOnUse('/ocr/worker.min.js')).toBe(true);
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

describe('unchanged', () => {
	it('keeps any copy of a build file, since its name carries its content hash', () => {
		expect(unchanged('/_app/immutable/chunks/abc.js', {}, {})).toBe(true);
	});

	it('keeps other files only when both builds give the same hash', () => {
		expect(
			unchanged('/data/roles.json', { '/data/roles.json': 'a' }, { '/data/roles.json': 'a' })
		).toBe(true);
		expect(
			unchanged('/data/roles.json', { '/data/roles.json': 'b' }, { '/data/roles.json': 'a' })
		).toBe(false);
		expect(unchanged('/data/roles.json', { '/data/roles.json': 'a' }, {})).toBe(false);
		expect(unchanged('/', {}, {})).toBe(false);
	});
});

describe('parseHashes', () => {
	it('keeps only string hashes', () => {
		expect(parseHashes({ '/a.json': 'x1', '/b.json': 3 })).toEqual({ '/a.json': 'x1' });
		expect(parseHashes(null)).toEqual({});
	});
});

const BUILD = 'v0.1.0 · abc1234 · beta · beta · built 2026-11-16T22:00:00Z';

describe('shellBuild', () => {
	it('reads the build app.html stamps on the page, HTML entities and all', () => {
		expect(shellBuild(`<script src="/boot-failure.js" data-build="${BUILD}"></script>`)).toBe(
			BUILD
		);
		expect(shellBuild('<x data-build="a &amp; b &quot;c&quot;">')).toBe('a & b "c"');
		expect(shellBuild('<html></html>')).toBeUndefined();
	});
});

// Cloudflare takes seconds to bring a deploy everywhere, so an install can fetch the next
// deploy's files; they are not stored with this build.
describe('otherBuild', () => {
	const build = { version: BUILD, hashes: { '/data/a.json': '0123456789abcdef' } };

	it('names a page made by another build', () => {
		expect(otherBuild('/', { html: `<x data-build="${BUILD}">` }, build)).toBeUndefined();
		expect(otherBuild('/', { html: '<x data-build="v0.1.0 · def5678">' }, build)).toBe(
			'/: made by v0.1.0 · def5678'
		);
		expect(otherBuild('/', { html: '<html></html>' }, build)).toBeUndefined();
	});

	it('names a data file whose content is not the one this build published', () => {
		expect(otherBuild('/data/a.json', { hash: '0123456789abcdef' }, build)).toBeUndefined();
		expect(otherBuild('/data/a.json', { hash: 'ffffffffffffffff' }, build)).toBe(
			'/data/a.json: content of another build'
		);
		expect(otherBuild('/data/b.json', { hash: 'ffffffffffffffff' }, build)).toBeUndefined();
	});
});
