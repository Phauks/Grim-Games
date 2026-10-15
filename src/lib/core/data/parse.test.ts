import { describe, expect, it } from 'vitest';
import { checkScriptSchema, loadGameData } from './game-data.ts';
import { parseJinxes, parseNightSheet, parseRoles, parseScript } from './parse.ts';
import { DataError } from './validate.ts';

const chef = {
	id: 'chef',
	name: 'Chef',
	edition: 'tb',
	team: 'townsfolk',
	firstNightReminder: 'Give a finger signal.',
	reminders: [],
	setup: false,
	ability: 'You start knowing how many pairs of evil players there are.',
	flavor: 'Flavour text.'
};
const imp = {
	id: 'imp',
	name: 'Imp',
	edition: 'tb',
	team: 'demon',
	otherNightReminder: 'The Imp chooses a player.',
	firstNightReminder: '',
	reminders: ['Dead'],
	setup: false,
	ability: 'Each night*, choose a player: they die.',
	flavor: 'Flavour text.',
	special: [{ type: 'ability', name: 'grimoire', time: 'night' }]
};

function issuesOf(fn: () => unknown): readonly string[] {
	try {
		fn();
	} catch (error) {
		if (error instanceof DataError) return error.issues;
		throw error;
	}
	throw new Error('expected a DataError');
}

describe('parseRoles', () => {
	it('maps team to type and drops empty night text', () => {
		const [parsedChef, parsedImp] = parseRoles([chef, imp]);
		expect(parsedChef).toMatchObject({ id: 'chef', type: 'townsfolk', remindersGlobal: [] });
		expect(parsedChef).not.toHaveProperty('team');
		expect(parsedImp.type).toBe('demon');
		expect(parsedImp.firstNightReminder).toBeUndefined();
		expect(parsedImp.special).toEqual([{ type: 'ability', name: 'grimoire', time: 'night' }]);
	});

	it('reports every problem, with paths', () => {
		const issues = issuesOf(() =>
			parseRoles([
				{ ...chef, team: 'villager' },
				{ ...imp, extra: 1, reminders: 'Dead' },
				{ ...chef, special: [{ type: 'selection', name: 'new-thing' }] },
				'oops'
			])
		);
		expect(issues).toEqual([
			'[0].team: unknown value "villager"',
			'[1].extra: unknown field',
			'[1].reminders: expected array, got string',
			'[2].special[0].name: unknown value "new-thing"',
			'[3]: expected object, got string'
		]);
	});

	it('rejects duplicate and malformed ids', () => {
		expect(issuesOf(() => parseRoles([chef, chef]))).toEqual(['[1].id: duplicate id chef']);
		expect(issuesOf(() => parseRoles([{ ...chef, id: 'Chef' }]))).toEqual([
			'[0].id: "Chef" is not lower-case letters and digits'
		]);
		expect(issuesOf(() => parseRoles({}))).toEqual(['(root): expected array, got object']);
	});
});

describe('parseJinxes', () => {
	it('flattens TPI entries into pairs', () => {
		expect(parseJinxes([{ id: 'chef', jinx: [{ id: 'imp', reason: 'Because.' }] }])).toEqual([
			{ characters: ['chef', 'imp'], reason: 'Because.' }
		]);
	});

	it('rejects the same pair listed twice, in either order', () => {
		const json = [
			{ id: 'chef', jinx: [{ id: 'imp', reason: 'A' }] },
			{ id: 'imp', jinx: [{ id: 'chef', reason: 'B' }] }
		];
		expect(issuesOf(() => parseJinxes(json))).toEqual(['[1].jinx[0]: duplicate jinx imp + chef']);
	});
});

describe('parseNightSheet', () => {
	it('rejects duplicates and unknown fields', () => {
		expect(
			issuesOf(() => parseNightSheet({ firstNight: ['dusk', 'dusk'], otherNight: [], x: [] }))
		).toEqual(['.x: unknown field', 'firstNight[1]: duplicate dusk']);
	});
});

describe('loadGameData', () => {
	const nightsheet = { firstNight: ['dusk', 'chef', 'dawn'], otherNight: ['dusk', 'imp', 'dawn'] };

	it('loads files that agree', () => {
		const data = loadGameData({ roles: [chef, imp], jinxes: [], nightsheet });
		expect(data.byId.get('imp')?.type).toBe('demon');
	});

	it('reports jinxes and night steps that name unknown characters', () => {
		const issues = issuesOf(() =>
			loadGameData({
				roles: [chef, imp],
				jinxes: [{ id: 'chef', jinx: [{ id: 'spy', reason: 'x' }] }],
				nightsheet: { ...nightsheet, firstNight: ['dusk', 'chef', 'poisoner', 'imp', 'dawn'] }
			})
		);
		expect(issues).toEqual([
			'jinxes.json: jinx chef + spy: unknown character spy',
			'nightsheet.json firstNight: unknown character poisoner',
			'nightsheet.json firstNight: imp is listed but has no firstNightReminder'
		]);
	});

	it('reports characters with night text that are missing from the night sheet', () => {
		const issues = issuesOf(() =>
			loadGameData({
				roles: [chef, imp],
				jinxes: [],
				nightsheet: { firstNight: [], otherNight: [] }
			})
		);
		expect(issues).toEqual([
			'roles.json chef: has firstNightReminder but is not in firstNight',
			'roles.json imp: has otherNightReminder but is not in otherNight'
		]);
	});
});

describe('checkScriptSchema', () => {
	it('fails when the schema adds a character type', () => {
		const schema = {
			items: {
				oneOf: [
					{ properties: { team: { enum: ['townsfolk', 'outsider', 'minion', 'demon', 'hero'] } } }
				]
			}
		};
		expect(() => checkScriptSchema(schema)).toThrow(/properties\.team\.enum/);
	});
});

describe('parseScript', () => {
	it('reads _meta, ids in every form, and homebrew characters', () => {
		const script = parseScript([
			{ id: '_meta', name: 'My Script', author: 'Trevor', firstNight: ['dusk', 'chef'] },
			'washerwoman',
			'Fortune_Teller',
			{ id: 'imp' },
			{ id: 'goblinking', name: 'Goblin King', team: 'demon', ability: 'Rule.', otherNight: 30 }
		]);
		expect(script.meta).toEqual({
			name: 'My Script',
			author: 'Trevor',
			firstNight: ['dusk', 'chef']
		});
		expect(script.entries).toEqual([
			{ kind: 'official', id: 'washerwoman' },
			{ kind: 'official', id: 'fortuneteller' },
			{ kind: 'official', id: 'imp' },
			{
				kind: 'custom',
				character: {
					id: 'goblinking',
					name: 'Goblin King',
					type: 'demon',
					ability: 'Rule.',
					setup: false,
					reminders: [],
					remindersGlobal: [],
					special: [],
					otherNight: 30
				}
			}
		]);
	});

	it('rejects repeated characters and a second _meta', () => {
		expect(
			issuesOf(() =>
				parseScript([{ id: '_meta', name: 'a' }, { id: '_meta', name: 'b' }, 'imp', 'imp'])
			)
		).toEqual(['[1]: more than one _meta entry', '[3]: imp is listed twice']);
	});
});
