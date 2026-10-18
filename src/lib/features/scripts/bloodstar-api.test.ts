import { describe, expect, it } from 'vitest';
import {
	bloodstarName,
	bloodstarPage,
	bloodstarScriptPath,
	bloodstarScriptUrl,
	isBloodstarFolder,
	parseBloodstarLink,
	readAllPublished,
	readBloodstarList
} from './bloodstar-api.ts';
import { bloodstarRow, filterRows } from './picker-rows.ts';
import { resolveLink } from './script-links.ts';

// The shape bloodstar.clocktica.com/api/allpublished.php returned on 2026-10-17 (made-up
// folders): `[scriptPath, almanacPath]` per published script.
const published = [
	['/p/05-whale/homebrew/script.json', '/p/05-whale/homebrew/almanac.html'],
	['/p/AlexS/Fall_of_Rome/script.json', '/p/AlexS/Fall_of_Rome/almanac.html'],
	['https://bloodstar.clocktica.com/p/Someone/Stone%20and%20Salt/script.json'],
	['/p/OnlyAlmanac/Thing/almanac.html'],
	['/p/../etc/script.json'],
	'junk'
];

describe('readAllPublished', () => {
	it('keeps every folder with a script, relative or with the address in front', () => {
		expect(readAllPublished(published)).toEqual([
			{ user: '05-whale', edition: 'homebrew' },
			{ user: 'AlexS', edition: 'Fall_of_Rome' },
			{ user: 'Someone', edition: 'Stone and Salt' }
		]);
	});

	it('reads anything else as no scripts', () => {
		expect(readAllPublished({ error: 'could not scan directory' })).toEqual([]);
	});
});

describe('readBloodstarList', () => {
	it('reads our answer back and drops bad folders', () => {
		expect(
			readBloodstarList({
				scripts: [{ user: 'AlexS', edition: 'Fall_of_Rome' }, { user: 'x', edition: '..' }, 3],
				fetchedAt: '2026-10-18T00:00:00Z'
			})
		).toEqual([{ user: 'AlexS', edition: 'Fall_of_Rome' }]);
		expect(readBloodstarList([])).toBeUndefined();
	});
});

describe('folders and addresses', () => {
	it('allows the folder names the site allows', () => {
		expect(isBloodstarFolder('Fall_of_Rome')).toBe(true);
		expect(isBloodstarFolder('Gals Night!')).toBe(true);
		for (const bad of ['', '.', '..', 'a/b', 'a:b', 'a?b', 'x'.repeat(121)]) {
			expect(isBloodstarFolder(bad)).toBe(false);
		}
	});

	it('names a script after its folder, with spaces for underscores', () => {
		expect(bloodstarName('Fall_of_Rome')).toBe('Fall of Rome');
	});

	it('links to the almanac page and fetches through our Worker', () => {
		const script = { user: 'Someone', edition: 'Stone and Salt' };
		expect(bloodstarPage(script)).toBe(
			'https://bloodstar.clocktica.com/p/Someone/Stone%20and%20Salt/almanac.html'
		);
		expect(bloodstarScriptPath(script)).toBe('/api/bloodstar/Someone/Stone%20and%20Salt');
		expect(bloodstarScriptUrl(script)).toBe(
			'https://bloodstar.clocktica.com/p/Someone/Stone%20and%20Salt/script.json'
		);
	});
});

describe('Bloodstar links', () => {
	it('reads the old and new addresses, and the folder, script or almanac', () => {
		const fallOfRome = { user: 'AlexS', edition: 'Fall_of_Rome' };
		for (const link of [
			'https://www.bloodstar.xyz/p/AlexS/Fall_of_Rome/script.json?2715117b',
			'https://bloodstar.xyz/p/AlexS/Fall_of_Rome/',
			'https://bloodstar.clocktica.com/p/AlexS/Fall_of_Rome/almanac.html'
		]) {
			expect(parseBloodstarLink(new URL(link))).toEqual(fallOfRome);
			expect(resolveLink(link)).toEqual({ kind: 'bloodstar', script: fallOfRome });
		}
	});

	it('leaves other pages and other sites alone', () => {
		expect(parseBloodstarLink(new URL('https://bloodstar.clocktica.com/'))).toBeUndefined();
		expect(parseBloodstarLink(new URL('https://example.com/p/a/b/script.json'))).toBeUndefined();
	});
});

describe('bloodstarRow', () => {
	const row = bloodstarRow({ user: 'AlexS', edition: 'Fall_of_Rome' });

	it('is found by its name and its user, and links to its almanac', () => {
		expect(row).toMatchObject({ name: 'Fall of Rome', author: 'AlexS', unsized: true });
		const filter = { sources: ['bloodstar' as const], kind: '' as const };
		expect(filterRows([row], { ...filter, term: 'rome' })).toHaveLength(1);
		expect(filterRows([row], { ...filter, term: 'alexs' })).toHaveLength(1);
		expect(filterRows([row], { ...filter, term: 'spartacus' })).toHaveLength(0);
	});

	it('is left out by a Type filter, since its size is unknown', () => {
		expect(filterRows([row], { term: '', sources: ['bloodstar'], kind: 'Full' })).toHaveLength(0);
	});
});
