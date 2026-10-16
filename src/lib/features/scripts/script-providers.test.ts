import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { SAVED_SCRIPT_VERSION, type SavedScript } from './saved-scripts.ts';
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
