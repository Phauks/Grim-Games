import { describe, expect, it } from 'vitest';
import {
	buildParts,
	emptyFile,
	fieldControl,
	issuesAt,
	knownType,
	newPartValue,
	partFields,
	pathText,
	setAt,
	topFields,
	type BuildKind
} from './builder.ts';
import { GUIDE_PARTS, GUIDE_TOP } from './mode-guide.ts';
import { RULE_GUIDE_PARTS, RULE_GUIDE_TOP } from './rule-guide.ts';
import { parseGameMode, parseSpecialRule } from './validate.ts';
import { STACKING_PARTS } from './types.ts';

const allFields = () => [
	...GUIDE_TOP,
	...RULE_GUIDE_TOP,
	...[...GUIDE_PARTS, ...RULE_GUIDE_PARTS].flatMap((p) => [
		...p.fields,
		...p.kinds.flatMap((k) => k.fields)
	])
];

describe('the Mode builder form, drawn from the format guide', () => {
	it('has a control for every type the guide uses, or edits it as JSON on purpose', () => {
		const unknown = [...new Set(allFields().map((f) => f.type))].filter((t) => !knownType(t));
		expect(unknown).toEqual([]);
	});

	it('offers every part of the guide: a mode all of them, a rule its own and the stacking ones', () => {
		expect(buildParts('game-mode').map((p) => p.part)).toEqual(GUIDE_PARTS.map((p) => p.part));
		const rule = buildParts('special-rule').map((p) => p.part);
		for (const p of RULE_GUIDE_PARTS) expect(rule).toContain(p.part);
		for (const p of STACKING_PARTS) expect(rule).toContain(p);
	});

	it('leaves the kind, format, revision and parts to the builder', () => {
		const names = topFields('special-rule').map((f) => f.name);
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
		for (const kind of ['game-mode', 'special-rule'] as BuildKind[]) {
			const file = { ...emptyFile(kind), id: 'mine', name: 'Mine' };
			const parse = kind === 'game-mode' ? parseGameMode : parseSpecialRule;
			expect(parse(file).ok, kind).toBe(true);
			for (const part of buildParts(kind)) {
				const value = newPartValue(part);
				const withPart = setAt(file, ['parts', part.part], part.list ? [value] : value);
				// Problems may be listed (required fields), but always at the part.
				const parsed = parse(withPart);
				if (!parsed.ok)
					for (const issue of parsed.issues)
						expect(issue.startsWith(`parts.${part.part}`), `${kind} ${issue}`).toBe(true);
			}
		}
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
