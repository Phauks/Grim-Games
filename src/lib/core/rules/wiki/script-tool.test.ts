/**
 * Rules suite for https://wiki.bloodontheclocktower.com/Script_Tool
 *
 * The wiki page only links to the Script Tool and does not describe its JSON, so script
 * loading is tested against TPI's own `script-schema.json` (botc-release), validated here
 * with a small JSON Schema checker (`json-schema.ts`).
 */
import { describe, expect, it } from 'vitest';
import { committedGameData, readDataFile } from '#lib/core/testing/committed-data.ts';
import {
	editionScript,
	loadScript,
	OFFICIAL_EDITIONS,
	scriptToJson
} from '#lib/core/data/script.ts';
import { validateJsonSchema } from '#lib/core/testing/json-schema.ts';

const data = committedGameData();
const schema = readDataFile('script-schema.json') as Record<string, unknown>;
const validate = (json: unknown) => validateJsonSchema(schema, json);

const homebrew = {
	id: 'stormwarden',
	name: 'Storm Warden',
	team: 'townsfolk',
	ability: 'Each night, choose a player: they are safe from the Demon tonight.',
	otherNight: 40,
	otherNightReminder: 'The Storm Warden chooses a player.',
	reminders: ['Safe'],
	setup: false,
	jinxes: [{ id: 'imp', reason: 'A house rule.' }],
	special: [{ type: 'ability', name: 'pointing', time: 'night' }]
};

/** Scripts that follow the schema exactly. */
const valid: Record<string, unknown[]> = {
	'string ids': ['washerwoman', 'librarian', 'investigator', 'chef', 'imp'],
	'meta with every field': [
		{
			id: '_meta',
			name: 'Every Field',
			author: 'Trevor',
			logo: 'https://example.com/logo.png',
			hideTitle: false,
			background: 'https://example.com/bg.jpg',
			almanac: 'https://example.com/almanac',
			bootlegger: ['Homebrew rule.'],
			firstNight: ['dusk', 'minioninfo', 'demoninfo', 'poisoner', 'chef', 'dawn'],
			otherNight: ['dusk', 'poisoner', 'imp', 'dawn']
		},
		'chef',
		'empath',
		'poisoner',
		'imp',
		'saint'
	],
	'deprecated {id} objects': [
		{ id: 'chef' },
		{ id: 'empath' },
		{ id: 'monk' },
		{ id: 'baron' },
		{ id: 'imp' }
	],
	'homebrew character': ['chef', 'empath', 'monk', homebrew, 'imp'],
	'Fabled, Loric and Travellers': ['chef', 'empath', 'imp', 'djinn', 'bootlegger', 'thief']
};

describe('scripts that follow script-schema.json', () => {
	it.each(Object.entries(valid))('%s: valid, and loads without problems', (_, json) => {
		expect(validate(json)).toEqual([]);
		const result = loadScript(json, data);
		expect(result.problems.filter((p) => p.severity !== 'info')).toEqual([]);
		expect(result.ok).toBe(true);
	});

	it('reads _meta and keeps the custom night orders', () => {
		const result = loadScript(valid['meta with every field'], data);
		expect(result.script?.name).toBe('Every Field');
		expect(result.script?.meta.firstNight).toEqual([
			'dusk',
			'minioninfo',
			'demoninfo',
			'poisoner',
			'chef',
			'dawn'
		]);
		expect(result.script?.meta.bootlegger).toEqual(['Homebrew rule.']);
	});
});

describe('scripts the schema rejects but the loader repairs', () => {
	// The schema only limits string ids to 20 characters, so "fortune_teller" passes it;
	// the loader still has to map it to TPI's id.
	it('normalises string ids the schema lets through', () => {
		const json = ['fortune_teller', 'Scarlet Woman', 'chef', 'empath', 'imp'];
		expect(validate(json)).toEqual([]);
		expect(loadScript(json, data).script?.characters.map((c) => c.id)).toEqual([
			'fortuneteller',
			'scarletwoman',
			'chef',
			'empath',
			'imp'
		]);
	});

	const repairable: Record<string, unknown[]> = {
		'underscored homebrew id': [
			'chef',
			'empath',
			'monk',
			'imp',
			{ ...homebrew, id: 'storm_warden' }
		],
		'capitalised team': ['chef', 'empath', 'monk', 'imp', { ...homebrew, team: 'Townsfolk' }],
		'number as text': ['chef', 'empath', 'monk', 'imp', { ...homebrew, otherNight: '40' }],
		'unknown homebrew field': ['chef', 'empath', 'monk', 'imp', { ...homebrew, colour: 'red' }],
		'too few entries': ['chef', 'imp']
	};
	it.each(Object.entries(repairable))('%s', (_, json) => {
		expect(validate(json).length).toBeGreaterThan(0);
		const result = loadScript(json, data);
		expect(result.ok).toBe(true);
		expect(result.script?.characters.length).toBe(json.length);
	});
});

describe('scripts the schema rejects and the loader partly refuses', () => {
	it('loads what it can and lists the rest', () => {
		const json = [
			'chef',
			42,
			{ id: 'x', name: 'X', team: 'villager', ability: '' },
			'notacharacter',
			'imp'
		];
		expect(validate(json).length).toBeGreaterThan(0);
		const result = loadScript(json, data);
		expect(result.ok).toBe(false);
		expect(result.script?.characters.map((c) => c.id)).toEqual(['chef', 'imp']);
		expect(result.problems.filter((p) => p.severity === 'error')).toHaveLength(3);
	});
});

describe('scripts the app writes', () => {
	it.each(OFFICIAL_EDITIONS.map((e) => e.id))('edition %s exports as a valid script', (id) => {
		expect(validate(scriptToJson(editionScript(id, data)!))).toEqual([]);
	});

	it('round-trips homebrew, meta and jinxes through a valid script', () => {
		const loaded = loadScript(valid['meta with every field'].concat([homebrew]), data).script!;
		const json = scriptToJson(loaded);
		expect(validate(json)).toEqual([]);
		const again = loadScript(json, data).script!;
		expect(again.characters).toEqual(loaded.characters);
		expect(again.meta).toEqual(loaded.meta);
		expect(again.homebrewJinxes).toEqual([
			{ characters: ['stormwarden', 'imp'], reason: 'A house rule.' }
		]);
	});
});

describe('the schema checker itself', () => {
	it('rejects what the schema forbids', () => {
		expect(validate('chef')).toEqual(['$: expected array, got string']);
		expect(validate(['a', 'b', 'c', 'd'])[0]).toContain('fewer than 5');
		expect(validate(['a', 'b', 'c', 'd', { ...homebrew, id: 'Bad_Id' }]).join()).toContain('oneOf');
		expect(validate(['a', 'b', 'c', 'd', { id: '_meta', name: 5 }]).join()).toContain('oneOf');
		expect(validate(['a', 'b', 'c', 'd', 'a-string-id-longer-than-twenty']).join()).toContain(
			'oneOf'
		);
	});
});
