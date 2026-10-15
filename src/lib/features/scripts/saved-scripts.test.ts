import { describe, expect, it } from 'vitest';
import { loadScriptText, scriptToJson } from '#lib/core/data/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import {
	describeSource,
	migrateSavedScript,
	reloadSavedScript,
	SAVED_SCRIPT_VERSION,
	sameScript,
	type SavedScript
} from './saved-scripts.ts';

const data = committedGameData();

function record(overrides: Partial<SavedScript> = {}): SavedScript {
	return {
		schemaVersion: SAVED_SCRIPT_VERSION,
		scriptId: 'a',
		name: 'Test',
		json: ['chef', 'empath', 'poisoner', 'imp', 'saint'],
		source: { kind: 'paste' },
		addedAt: 1,
		lastUsedAt: 1,
		revision: 1,
		...overrides
	};
}

describe('saved scripts', () => {
	it('reads current records and leaves unreadable or newer ones alone', () => {
		expect(migrateSavedScript(record())).toEqual(record());
		expect(migrateSavedScript({ ...record(), schemaVersion: 2 })).toBeUndefined();
		expect(migrateSavedScript({ scriptId: 'x' })).toBeUndefined();
		expect(migrateSavedScript(null)).toBeUndefined();
	});

	it('matches the same script whatever its source', () => {
		expect(sameScript(record(), record({ scriptId: 'b', source: { kind: 'share' } }))).toBe(true);
		expect(sameScript(record(), record({ json: ['chef'] }))).toBe(false);
		expect(sameScript(record({ edition: 'tb' }), record({ edition: 'tb', json: [] }))).toBe(true);
		expect(sameScript(record({ edition: 'tb' }), record())).toBe(false);
	});

	it('reloads editions and custom scripts, homebrew included', () => {
		expect(reloadSavedScript(record({ edition: 'bmr' }), data)?.name).toBe('Bad Moon Rising');
		const text = JSON.stringify([
			{ id: '_meta', name: 'Brew' },
			'chef',
			{ id: 'stormwarden', name: 'Storm Warden', team: 'townsfolk', ability: 'Protect.' },
			'imp'
		]);
		const loaded = loadScriptText(text, data).script!;
		const again = reloadSavedScript(record({ json: scriptToJson(loaded) }), data);
		expect(again?.name).toBe('Brew');
		expect(again?.characters.map((c) => c.id)).toEqual(['chef', 'stormwarden', 'imp']);
		expect(again?.homebrew).toEqual(['stormwarden']);
	});

	it('describes where a script came from', () => {
		expect(describeSource({ kind: 'link', url: 'https://www.example.com/a.json' })).toBe(
			'example.com'
		);
		expect(describeSource({ kind: 'botcscripts', scriptId: 1, version: '1.2.0' })).toBe(
			'BotC Scripts 1.2.0'
		);
		expect(describeSource({ kind: 'file', fileName: 'my.json' })).toBe('my.json');
	});
});
