import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { CAROUSEL_COLLECTION, collectionHeadingUrl, driveViewUrl } from './collection-api.ts';
import { CURATED_PAGE } from './curated-api.ts';
import { WORLD_CUPS } from './world-cup.ts';
import {
	isSpecificPage,
	SAVED_SCRIPT_VERSION,
	sourcePage,
	type SavedScript
} from './saved-scripts.ts';
import {
	findSaved,
	localListings,
	matchesSaved,
	SCRIPTS_PAGE_PROVIDERS,
	type LocalContext,
	type ScriptListing
} from './script-providers.ts';

const data = committedGameData();

function record(overrides: Partial<SavedScript> = {}): SavedScript {
	return {
		schemaVersion: SAVED_SCRIPT_VERSION,
		scriptId: 'a',
		name: 'Test',
		json: [{ id: '_meta', name: 'Test' }, 'chef', 'empath', 'poisoner', 'imp', 'saint'],
		source: { kind: 'paste' },
		addedAt: 1,
		lastUsedAt: 1,
		revision: 1,
		...overrides
	};
}

function context(recent: SavedScript[]): LocalContext {
	return {
		data,
		curated: [],
		recent,
		profile: [],
		curatedLabel: (section) => section,
		describe: (source) => source.kind
	};
}

describe('script providers', () => {
	it('leaves the base three off the Scripts page', () => {
		const tb = record({ scriptId: 'tb', edition: 'tb', json: ['tb'], source: { kind: 'edition' } });
		const listed = localListings(context([tb, record()]), SCRIPTS_PAGE_PROVIDERS);
		expect(listed.map((l) => l.row.name)).toEqual(['Test']);
	});

	it('finds the saved record for a row from any source', () => {
		const saved = record();
		const curated: ScriptListing = {
			...localListings(context([saved]), SCRIPTS_PAGE_PROVIDERS)[0],
			saved: undefined
		};
		expect(findSaved([saved], curated)).toBe(saved);
		expect(findSaved([record({ json: ['chef'] })], curated)).toBeUndefined();
	});

	it('matches a BotC Scripts row by script number and version', () => {
		const saved = record({ source: { kind: 'botcscripts', scriptId: 42, version: '1.2.0' } });
		const row = (version: string): ScriptListing => ({
			row: {
				key: 'botc:1',
				source: 'botc',
				name: 'Storm Front',
				author: '',
				kind: 'Full',
				characters: 0,
				note: '',
				entries: [],
				haystack: '',
				number: 42,
				version
			},
			target: { kind: 'botcscripts', ref: { kind: 'version', versionId: 1 } }
		});
		expect(matchesSaved(saved, row('1.2.0'))).toBe(true);
		expect(matchesSaved(saved, row('1.3.0'))).toBe(false);
	});
});

describe('source pages (Trevor, 2026-10-16: every script links to its own source page)', () => {
	const json = [{ id: '_meta', name: 'Listed' }, 'chef', 'empath', 'poisoner', 'imp', 'saint'];
	const doc = collectionHeadingUrl(CAROUSEL_COLLECTION, 'h.abc');

	it('gives every listed script from a site a page of its own, never just the site', () => {
		const listed = localListings(
			{
				...context([
					record({ scriptId: 'link', source: { kind: 'link', url: 'https://example.com/s.json' } }),
					record({
						scriptId: 'botc',
						json: [...json, 'saint'],
						source: { kind: 'botcscripts', scriptId: 42, version: '1.2.0' }
					})
				]),
				curated: [
					{ section: 'recommended', link: 'https://script.bloodontheclocktower.com/?x', json }
				],
				collection: [
					{
						link: driveViewUrl('1AVrIxWsrBMlATsoU-2M5X03jGeBaJYJb'),
						page: doc,
						json: [...json, 'monk']
					}
				],
				worldCups: {
					'2025': [
						{ entry: WORLD_CUPS['2025'].entries[0], version: '1.0.1', json: [...json, 'mayor'] }
					]
				},
				worldCupLabel: (year, stage) => `World Cup ${year} · ${stage}`
			},
			SCRIPTS_PAGE_PROVIDERS
		);
		const pages = Object.fromEntries(
			listed.map((l) => [l.row.key.split(':')[0] + ':' + l.row.source, l.row.page])
		);
		expect(pages).toEqual({
			'curated:curated': CURATED_PAGE,
			'collection:collection': doc,
			'worldcup2025:worldcup2025': 'https://botcscripts.com/script/6687/1.0.1',
			'recent:recent': expect.any(String)
		});
		const worldCup = listed.find((l) => l.row.source === 'worldcup2025');
		expect(worldCup?.row).toMatchObject({ note: 'World Cup 2025 · winner', number: 6687 });
		// Loaded from our stored copy, remembered as that BotC Scripts version.
		expect(worldCup?.target).toEqual({
			kind: 'json',
			json: [...json, 'mayor'],
			source: { kind: 'botcscripts', scriptId: 6687, version: '1.0.1' }
		});
		for (const l of listed) {
			expect(l.row.page, l.row.key).toBeDefined();
			expect(isSpecificPage(l.row.page ?? ''), l.row.page).toBe(true);
		}
		expect(listed.map((l) => l.row.page)).toContain('https://botcscripts.com/script/42/1.2.0');
	});

	it('saves the page with the source, so a saved script keeps linking there', () => {
		const [collection] = localListings(
			{
				...context([]),
				collection: [{ link: driveViewUrl('1AVrIxWsrBMlATsoU-2M5X03jGeBaJYJb'), page: doc, json }]
			},
			SCRIPTS_PAGE_PROVIDERS
		);
		expect(collection.target).toMatchObject({ kind: 'json', source: { kind: 'link', page: doc } });
		if (collection.target.kind !== 'json') throw new Error('json target');
		expect(sourcePage(collection.target.source)).toBe(doc);
	});

	it('has no page for pasted, file and shared scripts, and rejects bare sites', () => {
		expect(sourcePage({ kind: 'paste' })).toBeUndefined();
		expect(sourcePage({ kind: 'file', fileName: 'x.json' })).toBeUndefined();
		expect(sourcePage({ kind: 'share' })).toBeUndefined();
		expect(sourcePage({ kind: 'link', url: 'https://drive.google.com/' })).toBeUndefined();
		expect(isSpecificPage('https://drive.google.com')).toBe(false);
		expect(isSpecificPage('https://docs.google.com/document/d/x/edit')).toBe(true);
	});
});

describe('World Cups (Trevor, 2026-10-17)', () => {
	it('lists each year in its own order, with BotC Scripts numbers and no repeats', () => {
		for (const cup of Object.values(WORLD_CUPS)) {
			const ids = cup.entries.map((e) => e.scriptId);
			expect(new Set(ids).size, cup.year).toBe(ids.length);
			expect(cup.entries[0].stage, cup.year).toBe('winner');
			expect(isSpecificPage(cup.page), cup.page).toBe(true);
		}
		expect(WORLD_CUPS['2025'].entries).toHaveLength(16);
	});
});
