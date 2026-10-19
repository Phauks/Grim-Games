import { describe, expect, it } from 'vitest';
import {
	normaliseSearch,
	EMPTY_QUERY,
	filterCount,
	normaliseQuery,
	parseSearchUrl,
	readEntries,
	readProxiedSearchPage,
	readSearchPage,
	searchPath,
	upstreamSearchPath,
	parseBotcScriptsRef,
	parseProxyPath,
	pickVersionId,
	proxyPath,
	readProxiedVersion,
	readVersion,
	scriptPageUrl,
	scriptPdfUrl,
	pageHasPdf,
	editionFilter,
	readCharacterEditions,
	type BotcEditionGroup,
	compareVersions,
	parseVersionsPath,
	readProxiedVersionList,
	readVersionList,
	versionsPath
} from './botcscripts-api.ts';

/** A small stand-in for the site's `/api/characters`: two base, two Kickstarter, one Carousel. */
const EDITIONS = new Map([
	['chef', 0],
	['imp', 0],
	['ks1', 1],
	['ks2', 1],
	['car1', 2]
]);

describe('parseBotcScriptsRef', () => {
	it.each([
		['123', { kind: 'script', scriptId: 123 }],
		['https://botcscripts.com/script/123', { kind: 'script', scriptId: 123 }],
		['botcscripts.com/script/123/', { kind: 'script', scriptId: 123 }],
		[
			'https://www.botcscripts.com/script/123/1.0.2',
			{ kind: 'script', scriptId: 123, version: '1.0.2' }
		],
		[
			'https://botcscripts.com/script/123/2.0.0/download',
			{ kind: 'script', scriptId: 123, version: '2.0.0' }
		],
		// The site's "JSON" button (AdmiralGT/botc-scripts issue 420).
		['http://botcscripts.com/api/scripts/6669/json/', { kind: 'version', versionId: 6669 }],
		['https://botcscripts.com/api/scripts/6669/', { kind: 'version', versionId: 6669 }]
	])('%s', (input, expected) => {
		expect(parseBotcScriptsRef(input)).toEqual(expected);
	});

	it.each(['', 'abc', 'https://example.com/script/123', 'https://botcscripts.com/', '1234567890'])(
		'rejects %j',
		(input) => {
			expect(parseBotcScriptsRef(input)).toBeUndefined();
		}
	);
});

describe('proxy paths', () => {
	it.each([
		{ kind: 'script', scriptId: 5 } as const,
		{ kind: 'script', scriptId: 5, version: '1.0.0' } as const,
		{ kind: 'version', versionId: 77 } as const
	])('round-trips %j through the path only', (ref) => {
		const path = proxyPath(ref);
		expect(path).not.toContain('?');
		expect(parseProxyPath(path)).toEqual(ref);
	});

	it.each([
		'/api/botcscripts/',
		'/api/botcscripts/script/abc',
		'/api/botcscripts/version/1/2',
		'/api/botcscripts/script/1/..%2F..%2Fadmin',
		'/api/botcscripts/other/1'
	])('refuses %s', (path) => {
		expect(parseProxyPath(path)).toBeUndefined();
	});
});

describe('API responses', () => {
	const script = {
		pk: 12,
		name: 'Catfishing',
		versions: {
			'1.0.0': 'http://botcscripts.com/api/scripts/100/',
			'1.1.0': 'https://botcscripts.com/api/scripts/101/'
		},
		latest_version: 'https://botcscripts.com/api/scripts/101/'
	};

	it('picks the latest version, or the one asked for', () => {
		expect(pickVersionId(script)).toBe(101);
		expect(pickVersionId(script, '1.0.0')).toBe(100);
		expect(pickVersionId(script, '9.9.9')).toBeUndefined();
		expect(pickVersionId({ latest_version: null })).toBeUndefined();
	});

	it('reads a version', () => {
		const content = [{ id: '_meta', name: 'Catfishing' }, 'chef'];
		expect(
			readVersion({
				pk: 101,
				script_id: 12,
				name: 'Catfishing',
				version: '1.1.0',
				script_type: 'Full',
				author: 'Someone',
				content,
				score: 3
			})
		).toEqual({
			scriptId: 12,
			versionId: 101,
			name: 'Catfishing',
			version: '1.1.0',
			author: 'Someone',
			content
		});
		expect(readVersion({ pk: 1, script_id: 2, content: 'nope' })).toBeUndefined();
		expect(readVersion([])).toBeUndefined();
	});

	it('reads what our Worker returns', () => {
		const version = {
			scriptId: 12,
			versionId: 101,
			name: 'Catfishing',
			version: '1.1.0',
			author: '',
			content: ['chef']
		};
		expect(readProxiedVersion(version)).toEqual(version);
		expect(readProxiedVersion({ ...version, content: 'chef' })).toBeUndefined();
		expect(readProxiedVersion({ error: 'nope' })).toBeUndefined();
		// An uploaded PDF, and only a plain yes counts.
		expect(readProxiedVersion({ ...version, pdf: true })).toEqual({ ...version, pdf: true });
		expect(readProxiedVersion({ ...version, pdf: 'yes' })).toEqual(version);
	});

	it("finds a version's uploaded PDF from the link on its page", () => {
		expect(scriptPdfUrl(12, '1.1.0')).toBe('https://botcscripts.com/script/12/1.1.0/download_pdf');
		const page = '<a class="btn btn-primary" href="/script/12/1.1.0/download_pdf">Download PDF</a>';
		expect(pageHasPdf(page, 12, '1.1.0')).toBe(true);
		expect(pageHasPdf(page, 12, '1.0.0')).toBe(false);
		expect(pageHasPdf('<a href="/script/12/1.1.0/download_json">JSON</a>', 12, '1.1.0')).toBe(
			false
		);
	});

	it('links to the script page', () => {
		expect(scriptPageUrl(12, '1.1.0')).toBe('https://botcscripts.com/script/12/1.1.0');
	});
});

describe('search', () => {
	const q = (patch: Partial<typeof EMPTY_QUERY>) => ({ ...EMPTY_QUERY, ...patch });

	it('tidies and caps the term', () => {
		expect(normaliseSearch('  Storm   front ')).toBe('Storm front');
		expect(normaliseSearch('x'.repeat(150))).toHaveLength(100);
	});

	it('sends only what is set to our Worker, so equal searches share a cache entry', () => {
		expect(searchPath(EMPTY_QUERY)).toBe('/api/botcscripts/search?page=1');
		expect(searchPath(q({ term: ' storm  front ' }), 2)).toBe(
			'/api/botcscripts/search?page=2&q=storm+front'
		);
		// Same characters in another order or case: same URL.
		expect(searchPath(q({ include: ['Imp', 'chef', 'imp'] }))).toBe(
			searchPath(q({ include: ['chef', 'imp'] }))
		);
	});

	it('round-trips every filter through the Worker URL', () => {
		const query = q({
			term: 'storm',
			sort: 'newest',
			type: 'Teensyville',
			include: ['chef', 'imp'],
			exclude: ['drunk'],
			editions: ['base', 'carousel'],
			author: 'Trevor',
			oneDemon: true,
			officialOnly: true
		});
		const url = new URL(searchPath(query, 3), 'https://grim.example');
		expect(parseSearchUrl(url)).toEqual({ page: 3, query });
		expect(filterCount(query)).toBe(8);
	});

	it('drops values the site would not understand', () => {
		expect(
			normaliseQuery(
				q({
					sort: 'name' as never,
					type: 'Huge' as never,
					include: ['<script>', 'ok'],
					editions: ['huge' as never]
				})
			)
		).toEqual(q({ include: ['ok'] }));
		// All three groups is no filter at all.
		expect(
			normaliseQuery(q({ editions: ['carousel', 'base', 'kickstarter'] })).editions
		).toBeUndefined();
		// Best match needs a term to match.
		expect(normaliseQuery(q({ sort: 'match' })).sort).toBe('votes');
		expect(normaliseQuery(q({ sort: 'match', term: 'x' })).sort).toBe('match');
		expect(
			normaliseQuery(q({ include: Array.from({ length: 20 }, (_, i) => `c${i}`) })).include
		).toHaveLength(10);
	});

	it.each([
		'https://g.example/api/botcscripts/search?page=0',
		'https://g.example/api/botcscripts/search?page=101',
		'https://g.example/api/botcscripts/search?page=x',
		'https://g.example/api/botcscripts/searching?page=1'
	])('refuses %s', (url) => {
		expect(parseSearchUrl(new URL(url))).toBeUndefined();
	});

	it('maps sorts and filters onto the site’s own parameters', () => {
		const params = (query: Partial<typeof EMPTY_QUERY>) =>
			Object.fromEntries(
				new URL(upstreamSearchPath(q(query), 2, EDITIONS), 'https://botcscripts.com').searchParams
			);
		expect(params({ term: 'storm' })).toEqual({
			latest: 'true',
			ordering: '-score',
			page: '2',
			search: 'storm'
		});
		expect(params({ sort: 'newest' }).ordering).toBe('-pk');
		expect(params({ sort: 'oldest' }).ordering).toBe('pk');
		expect(params({ sort: 'match', term: 'storm' }).ordering).toBeUndefined();
		expect(
			params({
				type: 'Teensyville',
				include: ['imp', 'chef'],
				exclude: ['drunk'],
				editions: ['base'],
				author: 'Trevor',
				oneDemon: true,
				officialOnly: true
			})
		).toEqual({
			latest: 'true',
			ordering: '-score',
			page: '2',
			script_type: 'Teensyville',
			include: 'chef,imp',
			exclude: 'drunk',
			edition: '0',
			author: 'Trevor',
			mono_demon: 'true',
			include_homebrew: 'false',
			include_hybrid: 'false'
		});
	});

	it('leaves a group out by excluding its characters, as the site filters only "up to"', () => {
		const exclude = (editions: BotcEditionGroup[]) =>
			new URL(
				upstreamSearchPath(q({ editions, exclude: ['drunk'] }), 1, EDITIONS),
				'https://botcscripts.com'
			).searchParams;
		// Base and Carousel without Kickstarter: up to Carousel, minus the Kickstarter ones.
		expect(exclude(['base', 'carousel']).get('edition')).toBe('2');
		expect(exclude(['base', 'carousel']).get('exclude')).toBe('drunk,ks1,ks2');
		// Kickstarter alone: up to Kickstarter, minus the base three.
		expect(exclude(['kickstarter']).get('exclude')).toBe('drunk,chef,imp');
		expect(exclude(['base', 'kickstarter']).get('exclude')).toBe('drunk');
	});

	it('reads the site’s character groups and skips anything else', () => {
		expect(
			readCharacterEditions([
				{ id: 'chef', name: 'Chef', edition: 0, character_type: 'Townsfolk' },
				{ id: 'odd', edition: 3 },
				{ id: 5, edition: 1 },
				'imp'
			])
		).toEqual(new Map([['chef', 0]]));
		expect(readCharacterEditions({})).toBeUndefined();
		expect(editionFilter(undefined, EDITIONS)).toBeUndefined();
	});

	it('keeps each character’s id, and a homebrew one’s name and team, but no ability', () => {
		expect(
			readEntries([
				{ id: '_meta', name: 'Storm Front' },
				'chef',
				{ id: 'imp' },
				{ id: 'stormwarden', name: 'Storm Warden', team: 'townsfolk', ability: 'Each night…' },
				42
			])
		).toEqual([
			{ id: 'chef' },
			{ id: 'imp' },
			{ id: 'stormwarden', name: 'Storm Warden', team: 'townsfolk' }
		]);
		expect(readEntries({ not: 'a list' })).toEqual([]);
	});

	it('slims a page of results to cards, without the script JSON', () => {
		const page = readSearchPage(
			{
				count: 51,
				next: 'https://botcscripts.com/api/scripts/?page=2',
				previous: null,
				results: [
					{
						pk: 9,
						script_id: 3,
						name: 'Storm Front',
						version: '1.0.0',
						script_type: 'Full',
						author: 'Trevor',
						content: [{ id: '_meta', name: 'Storm Front' }, 'chef'],
						score: 12
					},
					{ broken: true }
				]
			},
			1
		);
		expect(page).toEqual({
			page: 1,
			count: 51,
			hasMore: true,
			results: [
				{
					scriptId: 3,
					versionId: 9,
					name: 'Storm Front',
					version: '1.0.0',
					author: 'Trevor',
					type: 'Full',
					score: 12,
					characters: [{ id: 'chef' }]
				}
			]
		});
		expect(readProxiedSearchPage(page)).toEqual(page);
		expect(readSearchPage({ results: [], next: null }, 4)?.hasMore).toBe(false);
		expect(readSearchPage({ detail: 'Invalid page.' }, 9)).toBeUndefined();
	});

	it("keeps the author's https logo from each result's _meta", () => {
		const row = (pk: number, logo: unknown) => ({
			pk,
			script_id: pk,
			name: 'Storm Front',
			version: '1.0.0',
			author: 'Trevor',
			content: [{ id: '_meta', name: 'Storm Front', logo }, 'chef']
		});
		const page = readSearchPage(
			{ results: [row(1, 'https://example.com/logo.png'), row(2, 'http://example.com/x.png')] },
			1
		);
		expect(page?.results.map((r) => r.logo)).toEqual(['https://example.com/logo.png', undefined]);
		expect(readProxiedSearchPage(page)).toEqual(page);
		expect(
			readProxiedSearchPage({ ...page, results: [{ ...page?.results[0], logo: 'javascript:x' }] })
				?.results[0].logo
		).toBeUndefined();
	});
});

describe('BotC Scripts versions', () => {
	it('orders version labels by number, newest first', () => {
		expect(['1.9.2', '1.10.0', '1.2', '2.0.0'].sort((a, b) => compareVersions(b, a))).toEqual([
			'2.0.0',
			'1.10.0',
			'1.9.2',
			'1.2'
		]);
		expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
	});

	it('reads every version the site lists, and which is latest', () => {
		const json = {
			pk: 42,
			versions: {
				'1.0.0': 'http://botcscripts.com/api/scripts/100/',
				'1.10.0': 'http://botcscripts.com/api/scripts/300/',
				'1.2.0': 'http://botcscripts.com/api/scripts/200/',
				'bad/one': 'http://botcscripts.com/api/scripts/400/'
			},
			latest_version: 'http://botcscripts.com/api/scripts/300/'
		};
		expect(readVersionList(42, json)).toEqual({
			scriptId: 42,
			latest: '1.10.0',
			versions: ['1.10.0', '1.2.0', '1.0.0']
		});
		expect(readVersionList(42, { pk: 42 })).toBeUndefined();
		expect(
			readProxiedVersionList({ scriptId: 42, latest: '1.10.0', versions: ['1.10.0', 3] })
		).toEqual({
			scriptId: 42,
			latest: '1.10.0',
			versions: ['1.10.0']
		});
	});

	it('routes a version list by path only', () => {
		expect(versionsPath(42)).toBe('/api/botcscripts/versions/42');
		expect(parseVersionsPath('/api/botcscripts/versions/42')).toBe(42);
		expect(parseVersionsPath('/api/botcscripts/versions/x')).toBeUndefined();
	});
});
