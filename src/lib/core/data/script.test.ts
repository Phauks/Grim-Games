/**
 * Script loader fixtures: TPI's format (`script-schema.json`) plus the shapes that broke
 * Pocket Grimoire (03-issues-and-requests.md PG 190, PG 195, PG 127, PG 111, PG 153).
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import {
	editionScript,
	findEdition,
	loadScript,
	loadScriptText,
	type ScriptLoadResult
} from './script.ts';

const data = committedGameData();
const ids = (r: ScriptLoadResult) => r.script?.characters.map((c) => c.id);
const errors = (r: ScriptLoadResult) => r.problems.filter((p) => p.severity === 'error');
const warnings = (r: ScriptLoadResult) => r.problems.filter((p) => p.severity === 'warning');

const homebrew = {
	id: 'stormwarden',
	name: 'Storm Warden',
	team: 'townsfolk',
	ability: 'Each night, choose a player: they are safe from the Demon tonight.',
	otherNight: 40,
	otherNightReminder: 'The Storm Warden chooses a player.',
	reminders: ['Safe']
};

describe('official editions', () => {
	it('loads Trouble Brewing by id with its 22 characters', () => {
		const script = editionScript('tb', data)!;
		expect(script.name).toBe('Trouble Brewing');
		expect(script.characters).toHaveLength(22);
		expect(script.characters.map((c) => c.id)).toContain('imp');
		expect(script.characters.every((c) => c.type !== 'traveller')).toBe(true);
	});

	it('finds editions by name, forgiving case and "&"', () => {
		expect(findEdition('Bad Moon Rising')?.id).toBe('bmr');
		expect(findEdition('sects and violets')?.id).toBe('snv');
		expect(findEdition('Sects & Violets')?.id).toBe('snv');
		expect(findEdition('carousel')).toBeUndefined();
	});

	it('accepts an edition name as pasted text', () => {
		const result = loadScriptText('  snv \n', data);
		expect(result.ok).toBe(true);
		expect(result.script?.edition).toBe('snv');
		expect(result.script?.characters).toHaveLength(25);
	});
});

describe('TPI script shapes', () => {
	it('loads string ids, {id} objects, homebrew and _meta anywhere', () => {
		const result = loadScript(
			[
				'washerwoman',
				{ id: 'chef' },
				homebrew,
				{ id: '_meta', name: 'Stormy', author: 'T' },
				'imp'
			],
			data
		);
		expect(result.ok).toBe(true);
		expect(ids(result)).toEqual(['washerwoman', 'chef', 'stormwarden', 'imp']);
		expect(result.script?.name).toBe('Stormy');
		expect(result.script?.meta.author).toBe('T');
		expect(result.script?.homebrew).toEqual(['stormwarden']);
		expect(result.script?.characters[2]).toMatchObject({
			type: 'townsfolk',
			otherNight: 40,
			reminders: ['Safe']
		});
	});

	it('reads every _meta field', () => {
		const result = loadScript(
			[
				{
					id: '_meta',
					name: 'Full',
					author: 'A',
					logo: 'https://example.com/logo.png',
					background: 'https://example.com/bg.png',
					almanac: 'https://example.com/almanac',
					hideTitle: true,
					bootlegger: ['Rule one'],
					firstNight: ['dusk', 'minioninfo', 'demoninfo', 'poisoner', 'dawn'],
					otherNight: ['dusk', 'Poisoner', 'imp', 'dawn']
				},
				'poisoner',
				'imp'
			],
			data
		);
		expect(result.script?.meta).toEqual({
			name: 'Full',
			author: 'A',
			logo: 'https://example.com/logo.png',
			background: 'https://example.com/bg.png',
			almanac: 'https://example.com/almanac',
			hideTitle: true,
			bootlegger: ['Rule one'],
			firstNight: ['dusk', 'minioninfo', 'demoninfo', 'poisoner', 'dawn'],
			otherNight: ['dusk', 'poisoner', 'imp', 'dawn']
		});
	});

	it('treats night number 0 as not waking', () => {
		const result = loadScript([{ ...homebrew, firstNight: 0, otherNight: 0 }, 'imp'], data);
		expect(result.script?.characters[0].firstNight).toBeUndefined();
		expect(result.script?.characters[0].otherNight).toBeUndefined();
	});

	it('collects homebrew jinxes with normalised ids', () => {
		const result = loadScript(
			[
				{ ...homebrew, jinxes: [{ id: 'Fortune_Teller', reason: 'Odd.' }, { id: 'x' }] },
				'fortuneteller',
				'imp'
			],
			data
		);
		expect(result.script?.homebrewJinxes).toEqual([
			{ characters: ['stormwarden', 'fortuneteller'], reason: 'Odd.' }
		]);
		expect(warnings(result).map((w) => w.message)).toContain(
			'Ignored a jinx without both an id and a reason.'
		);
	});

	it('lets a full object with an official id replace the official character', () => {
		const result = loadScript([{ ...homebrew, id: 'monk', name: 'Monk (house)' }, 'imp'], data);
		expect(result.script?.characters[0].name).toBe('Monk (house)');
		expect(result.script?.homebrew).toEqual(['monk']);
		expect(result.problems.some((p) => p.message.includes('own version'))).toBe(true);
	});
});

describe('ids in the wild', () => {
	it('normalises underscores, spaces, capitals and apostrophes (PG 127)', () => {
		const result = loadScript(
			['fortune_teller', 'Scarlet Woman', "Lil' Monsta", 'DEVILS-ADVOCATE', 'imp'],
			data
		);
		expect(result.ok).toBe(true);
		expect(ids(result)).toEqual([
			'fortuneteller',
			'scarletwoman',
			'lilmonsta',
			'devilsadvocate',
			'imp'
		]);
		expect(result.script?.renamedIds).toMatchObject({ fortune_teller: 'fortuneteller' });
	});

	it('normalises underscores in homebrew ids too (PG 127)', () => {
		const result = loadScript([{ ...homebrew, id: 'storm_warden' }, 'imp'], data);
		expect(ids(result)).toEqual(['stormwarden', 'imp']);
		expect(result.script?.renamedIds).toEqual({ storm_warden: 'stormwarden' });
	});

	it('keeps umlauts and accents usable (PG 153)', () => {
		const result = loadScript(
			[{ ...homebrew, id: 'brückenwärter', name: 'Brückenwärter' }, 'imp'],
			data
		);
		expect(ids(result)).toEqual(['bruckenwarter', 'imp']);
		expect(result.script?.characters[0].name).toBe('Brückenwärter');
	});

	it('gives Cyrillic ids a usable id and keeps the name (PG 111)', () => {
		const result = loadScript(
			[
				{ ...homebrew, id: 'страж', name: 'Страж' },
				{ ...homebrew, id: 'ведьма', name: 'Ведьма' },
				'imp'
			],
			data
		);
		expect(result.ok).toBe(true);
		expect(ids(result)).toEqual(['homebrew1', 'homebrew2', 'imp']);
		expect(result.script?.characters[0].name).toBe('Страж');
		expect(warnings(result)[0].message).toContain('no Latin letters');
	});

	it('suggests the nearest id for a typo, and keeps the rest', () => {
		const result = loadScript(['fortunetellr', 'chef', 'imp'], data);
		expect(result.ok).toBe(false);
		expect(ids(result)).toEqual(['chef', 'imp']);
		expect(errors(result)[0]).toMatchObject({
			where: 'Entry 1 (fortunetellr)',
			message: expect.stringContaining('Did you mean Fortune Teller (fortuneteller)?')
		});
	});
});

describe('odd homebrew shapes (PG 190, PG 195)', () => {
	it('loads a homebrew-only script with no official characters loaded first (PG 195)', () => {
		const demon = {
			id: 'gloom',
			name: 'Gloom',
			team: 'demon',
			ability: 'Each night*, choose a player: they die.'
		};
		const result = loadScript([{ id: '_meta', name: 'Only homebrew' }, homebrew, demon], data);
		expect(result.ok).toBe(true);
		expect(ids(result)).toEqual(['stormwarden', 'gloom']);
		expect(result.problems.some((p) => p.message.includes('Bootlegger'))).toBe(true);
	});

	it('repairs team spellings, string numbers, string reminders and string booleans', () => {
		const result = loadScript(
			[
				{
					...homebrew,
					team: 'Townsfolks',
					firstNight: '12',
					reminders: 'Safe',
					setup: 'true',
					image: 'https://example.com/i.png'
				},
				{ id: 'wanderer', name: 'Wanderer', team: 'Traveler', ability: 'x' },
				'imp'
			],
			data
		);
		expect(result.ok).toBe(true);
		expect(result.script?.characters[0]).toMatchObject({
			type: 'townsfolk',
			firstNight: 12,
			reminders: ['Safe'],
			setup: true,
			image: 'https://example.com/i.png'
		});
		expect(result.script?.characters[1].type).toBe('traveller');
	});

	it('marks bracketed setup text as a setup character', () => {
		const result = loadScript(
			[{ ...homebrew, ability: 'You are odd. [+1 Outsider]' }, 'imp'],
			data
		);
		expect(result.script?.characters[0].setup).toBe(true);
	});

	it('drops unknown app features but keeps known ones', () => {
		const result = loadScript(
			[
				{
					...homebrew,
					special: [
						{ type: 'selection', name: 'bag-disabled' },
						{ type: 'selection', name: 'new-thing' },
						'oops'
					]
				},
				'imp'
			],
			data
		);
		expect(result.script?.characters[0].special).toEqual([
			{ type: 'selection', name: 'bag-disabled' }
		]);
		expect(warnings(result)[0].message).toContain('Ignored 2 app features');
	});

	it('loads a character with no ability or name, with warnings', () => {
		const result = loadScript([{ id: 'blank', team: 'outsider' }, 'imp'], data);
		expect(result.ok).toBe(true);
		expect(result.script?.characters[0]).toMatchObject({ id: 'blank', name: 'blank', ability: '' });
		expect(warnings(result)).toHaveLength(2);
	});

	it('skips a character with an unknown team and says why', () => {
		const result = loadScript([{ ...homebrew, team: 'villager' }, 'imp'], data);
		expect(ids(result)).toEqual(['imp']);
		expect(errors(result)[0].message).toContain('unknown character type “villager”');
	});

	it('skips nulls, numbers and nested arrays, keeping the rest', () => {
		const result = loadScript([null, 3, ['chef'], 'chef', 'imp'], data);
		expect(ids(result)).toEqual(['chef', 'imp']);
		expect(errors(result)).toHaveLength(3);
	});

	it('warns about duplicates and keeps the first', () => {
		const result = loadScript(['chef', 'Chef', 'imp'], data);
		expect(ids(result)).toEqual(['chef', 'imp']);
		expect(warnings(result)[0].message).toContain('already on the script');
	});

	it('warns when a script has no Demon', () => {
		const result = loadScript(['chef', 'empath'], data);
		expect(warnings(result).map((w) => w.message)).toContain('The script has no Demon.');
	});

	it('uses the first of two _meta entries', () => {
		const result = loadScript(
			[{ id: '_meta', name: 'A' }, { id: '_meta', name: 'B' }, 'imp'],
			data
		);
		expect(result.script?.name).toBe('A');
		expect(warnings(result)).toHaveLength(1);
	});

	it('drops custom night order entries that are not on the script', () => {
		const result = loadScript(
			[{ id: '_meta', name: 'N', firstNight: ['dusk', 'chef', 'snitch', 'dawn'] }, 'chef', 'imp'],
			data
		);
		expect(result.script?.meta.firstNight).toEqual(['dusk', 'chef', 'dawn']);
		expect(warnings(result)[0].message).toContain('snitch');
	});

	it('reads a script wrapped in an object', () => {
		const result = loadScript({ name: 'Wrapped', author: 'Z', characters: ['chef', 'imp'] }, data);
		expect(ids(result)).toEqual(['chef', 'imp']);
		expect(result.script?.name).toBe('Wrapped');
	});

	it('falls back to "Custom script" without a name', () => {
		expect(loadScript(['chef', 'imp'], data).script?.name).toBe('Custom script');
	});

	it('explains top-level shapes it cannot read', () => {
		expect(errors(loadScript({ id: '_meta', name: 'x' }, data))[0].message).toContain(
			'no characters'
		);
		expect(errors(loadScript({ a: 1 }, data))[0].message).toContain('single { } object');
		expect(errors(loadScript('chef', data))[0].message).toContain('string');
		expect(loadScript([], data).script).toBeUndefined();
	});
});

describe('pasted text', () => {
	it('strips a byte-order mark', () => {
		expect(loadScriptText(String.fromCharCode(0xfeff) + '["chef","imp"]', data).ok).toBe(true);
	});

	it('repairs curly quotes and trailing commas with warnings', () => {
		const result = loadScriptText('[“chef”, “imp”,]', data);
		expect(ids(result)).toEqual(['chef', 'imp']);
		expect(warnings(result)).toHaveLength(2);
	});

	it('reports where broken JSON breaks', () => {
		const result = loadScriptText('[\n  "chef",\n  "imp" "x"\n]', data);
		expect(result.ok).toBe(false);
		expect(errors(result)[0].message).toMatch(
			/not valid script JSON \(problem near line 3, column \d+\)/
		);
	});

	it('explains links and empty text', () => {
		expect(errors(loadScriptText('https://example.com/s.json', data))[0].message).toContain('link');
		expect(errors(loadScriptText('   ', data))[0].message).toContain('empty');
	});
});
