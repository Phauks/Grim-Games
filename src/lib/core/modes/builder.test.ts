import { describe, expect, it } from 'vitest';
import {
	buildParts,
	closestPath,
	jsonChunks,
	ownPartFields,
	PART_NOTES,
	setPartAt,
	emptyFile,
	fieldControl,
	issuesAt,
	knownType,
	modeFileKind,
	newPartValue,
	partFields,
	pathText,
	setAt,
	topFields
} from './builder.ts';
import { fileKind } from './file-kind.ts';
import { GUIDE_PARTS, GUIDE_TOP } from './mode-guide.ts';
import { FILE_GUIDE_PARTS } from './rule-guide.ts';
import { parseModeOrRule } from './validate.ts';
import { FILE_PARTS, WHOLE_GAME_PARTS } from './types.ts';

const allFields = () => [
	...GUIDE_TOP,
	...FILE_GUIDE_PARTS.flatMap((p) => [...p.fields, ...p.kinds.flatMap((k) => k.fields)])
];

describe('the Mode builder form, drawn from the format guide', () => {
	it('has a control for every type the guide uses, or edits it as JSON on purpose', () => {
		const unknown = [...new Set(allFields().map((f) => f.type))].filter((t) => !knownType(t));
		expect(unknown).toEqual([]);
	});

	it('offers every part of the format, those that make a game mode apart', () => {
		const { any, wholeGame } = buildParts();
		expect(wholeGame.map((p) => p.part)).toEqual([...WHOLE_GAME_PARTS]);
		expect([...any, ...wholeGame].map((p) => p.part).sort()).toEqual([...FILE_PARTS].sort());
	});

	it('leaves the kind, format, revision and parts to the builder', () => {
		const names = topFields().map((f) => f.name);
		expect(names).toContain('id');
		expect(names).not.toContain('format');
		expect(names).not.toContain('parts');
	});

	it('reads choices from the values the guide lists', () => {
		expect(
			fieldControl({ name: 'x', type: 'text', required: true, about: '', values: ['a'] })
		).toEqual({ kind: 'choice', values: ['a'] });
		expect(fieldControl({ name: 'x', type: 'something new', required: true, about: '' })).toEqual({
			kind: 'json'
		});
	});

	it('every part and kind, added empty, gives a file the checker reads', () => {
		// Each kind's own fields come with every part's cite and instructions.
		const assignment = GUIDE_PARTS.find((p) => p.part === 'assignment')!;
		expect(partFields(assignment, 'draft').map((f) => f.name)).toEqual([
			'offers',
			'recycleUnchosen',
			'oneTypePerOffer',
			'cite',
			'instructions'
		]);
		const file = { ...emptyFile(), id: 'mine', name: 'Mine' };
		expect(parseModeOrRule(file).ok).toBe(true);
		const { any, wholeGame } = buildParts();
		for (const part of [...any, ...wholeGame]) {
			const value = newPartValue(part);
			const withPart = setAt(file, ['parts', part.part], part.list ? [value] : value);
			// Problems may be listed (required fields), but always at the part.
			const parsed = parseModeOrRule(withPart);
			if (!parsed.ok)
				for (const issue of parsed.issues)
					expect(issue.startsWith(`parts.${part.part}`), issue).toBe(true);
		}
		// The empty file is a special rule; a whole-game part makes it a game mode.
		expect(fileKind(file)).toBe('special-rule');
		expect(fileKind(setAt(file, ['parts', 'counts'], { kind: 'standard' }))).toBe('game-mode');
	});
});

describe('editing the file', () => {
	it('sets and removes values without touching the rest', () => {
		const file = { name: 'A', parts: { forced: { inPlay: ['imp'] } } };
		const next = setAt(file, ['parts', 'forced', 'onScript'], ['chef']);
		expect(next).toEqual({ name: 'A', parts: { forced: { inPlay: ['imp'], onScript: ['chef'] } } });
		expect(file.parts.forced).toEqual({ inPlay: ['imp'] });
		expect(setAt(next, ['parts', 'forced', 'inPlay'], undefined)).toEqual({
			name: 'A',
			parts: { forced: { onScript: ['chef'] } }
		});
		expect(setAt({ l: ['a', 'b'] }, ['l', 0], undefined)).toEqual({ l: ['b'] });
	});

	it('finds the problems at a field, as the checker writes their paths', () => {
		expect(pathText(['parts', 'nightSteps', 0, 'when'])).toBe('parts.nightSteps[0].when');
		const issues = [
			'parts.nightSteps[0].when: must be one of x',
			'sources[1].url: must be an https link',
			'id: bad'
		];
		expect(issuesAt(issues, ['parts', 'nightSteps', 0, 'when'])).toEqual(['must be one of x']);
		expect(issuesAt(issues, ['sources'])).toEqual(['[1].url: must be an https link']);
		expect(issuesAt(issues, ['name'])).toEqual([]);
	});
});

describe('telling a mode file from a script', () => {
	it('reads a mode file, labelled by its parts, and not a script or a character', () => {
		// Labelled by its parts: one that sets the whole game is a game mode.
		const counts = { kind: 'standard' };
		expect(modeFileKind({ ...emptyFile(), parts: { counts } })).toBe('game-mode');
		expect(modeFileKind(emptyFile())).toBe('special-rule');
		expect(modeFileKind([{ id: '_meta', name: 'S' }, 'washerwoman'])).toBeUndefined();
		expect(modeFileKind({ id: 'x', name: 'X', ability: 'Each night...' })).toBeUndefined();
		expect(modeFileKind({ format: 1, parts: [] })).toBeUndefined();
		expect(modeFileKind(null)).toBeUndefined();
	});
});

describe('the redesigned builder (Trevor, 2026-11-01)', () => {
	const pool = GUIDE_PARTS.find((p) => p.part === 'pool')!;

	it('adds Source and Storyteller instructions per part, not as a row on every part', () => {
		const own = ownPartFields(pool, pool.kinds[0].kind).map((f) => f.name);
		expect(own).not.toContain('cite');
		expect(own).not.toContain('instructions');
		expect(PART_NOTES.map((f) => f.name)).toEqual(['cite', 'instructions']);
	});

	it('turns a part on when one of its settings is changed while it is off', () => {
		expect(setPartAt(pool, undefined, ['count'], 2)).toEqual({
			kind: pool.kinds[0].kind,
			count: 2
		});
		expect(setPartAt(pool, { kind: 'script' }, ['count'], 2)).toEqual({ kind: 'script', count: 2 });
	});

	it('jumps from a problem to the nearest setting that holds it', () => {
		const paths = ['id', 'parts.pool', 'parts.pool.count', 'parts.nightSteps[0]'];
		expect(closestPath('parts.pool.count', paths)).toBe('parts.pool.count');
		expect(closestPath('parts.pool.kind', paths)).toBe('parts.pool');
		expect(closestPath('parts.nightSteps[0].when', paths)).toBe('parts.nightSteps[0]');
		expect(closestPath('parts.poolish', paths)).toBeUndefined();
	});

	it('splits the JSON by part, joining back to the file exactly, in any key order', () => {
		const file = {
			id: 'x',
			parts: { pool: { kind: 'script', note: '"parts": {' }, deaths: { kind: 'none' } },
			name: 'After parts'
		};
		const chunks = jsonChunks(file);
		expect(chunks.map((c) => c.text).join('')).toBe(JSON.stringify(file, null, 2));
		expect(chunks.filter((c) => c.part).map((c) => c.part)).toEqual(['pool', 'deaths']);
		expect(chunks.find((c) => c.part === 'pool')?.text).toContain('"kind": "script"');
		const empty = { id: 'y', parts: {} };
		expect(
			jsonChunks(empty)
				.map((c) => c.text)
				.join('')
		).toBe(JSON.stringify(empty, null, 2));
	});
});
