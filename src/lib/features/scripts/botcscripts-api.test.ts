import { describe, expect, it } from 'vitest';
import {
	normaliseSearch,
	parseSearchPath,
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
	scriptPageUrl
} from './botcscripts-api.ts';

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
	});

	it('links to the script page', () => {
		expect(scriptPageUrl(12, '1.1.0')).toBe('https://botcscripts.com/script/12/1.1.0');
	});
});

describe('search', () => {
	it('keeps the term in the path, tidied and capped', () => {
		expect(normaliseSearch('  Storm   front ')).toBe('Storm front');
		expect(normaliseSearch('x'.repeat(150))).toHaveLength(100);
		expect(searchPath('storm front', 2)).toBe('/api/botcscripts/search/2/storm%20front');
		expect(searchPath('  ')).toBe('/api/botcscripts/search/1');
	});

	it.each([
		['/api/botcscripts/search/1', { term: '', page: 1 }],
		['/api/botcscripts/search/3/storm%20front', { term: 'storm front', page: 3 }],
		['/api/botcscripts/search/1/%E2%80%9Cquoted%E2%80%9D', { term: '“quoted”', page: 1 }]
	])('reads %s', (path, expected) => {
		expect(parseSearchPath(path)).toEqual(expected);
		expect(parseSearchPath(searchPath(expected.term, expected.page))).toEqual(expected);
	});

	it.each([
		'/api/botcscripts/search/0',
		'/api/botcscripts/search/101',
		'/api/botcscripts/search/x',
		'/api/botcscripts/search/1/%E0%A4%A'
	])('refuses %s', (path) => {
		expect(parseSearchPath(path)).toBeUndefined();
	});

	it('asks the site for latest versions, most votes first', () => {
		const url = new URL(upstreamSearchPath('storm', 2), 'https://botcscripts.com');
		expect(url.pathname).toBe('/api/scripts/');
		expect(Object.fromEntries(url.searchParams)).toEqual({
			latest: 'true',
			ordering: '-score',
			page: '2',
			search: 'storm'
		});
		expect(new URL(upstreamSearchPath('', 1), 'https://x.example').searchParams.has('search')).toBe(
			false
		);
	});

	it('slims a page of results to rows, without the script JSON', () => {
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
						content: ['chef'],
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
					score: 12
				}
			]
		});
		expect(readProxiedSearchPage(page)).toEqual(page);
		expect(readSearchPage({ results: [], next: null }, 4)?.hasMore).toBe(false);
		expect(readSearchPage({ detail: 'Invalid page.' }, 9)).toBeUndefined();
	});
});
