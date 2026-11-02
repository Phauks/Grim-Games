import { describe, expect, it } from 'vitest';
import type { Character, Jinx, NightSheet } from '../src/lib/core/data/types.ts';
import {
	checkCoverage,
	citesPage,
	countFails,
	countTodos,
	engineGaps,
	gapCounts,
	jinxTestFile,
	renderCharacterTest,
	renderGapList,
	renderJinxTest,
	wikiUrl,
	type CoverageInput
} from './lib/rules-tests.ts';

const character = (id: string, name: string, type: Character['type'] = 'townsfolk'): Character => ({
	id,
	name,
	type,
	edition: 'tb',
	ability: '',
	setup: false,
	reminders: [],
	remindersGlobal: [],
	special: []
});

const chef = character('chef', 'Chef');
const monsta = character('lilmonsta', "Lil' Monsta", 'demon');
const advocate = character('devilsadvocate', "Devil's Advocate", 'minion');
const jinx: Jinx = { characters: ['lilmonsta', 'devilsadvocate'], reason: 'A rule.' };
const nightSheet: NightSheet = {
	firstNight: ['dusk', 'chef', 'dawn'],
	otherNight: ['dusk', 'dawn']
};

/** A fully covered fixture, built with the scaffold's own templates. */
function covered(): CoverageInput {
	return {
		characters: [chef, monsta, advocate],
		jinxes: [jinx],
		abilityTests: new Map([
			['chef.test.ts', renderCharacterTest(chef, nightSheet, ['Two evil pairs', ''])],
			['lilmonsta.test.ts', renderCharacterTest(monsta, nightSheet)],
			['devilsadvocate.test.ts', renderCharacterTest(advocate, nightSheet, [])]
		]),
		jinxTests: new Map([['devilsadvocate__lilmonsta.test.ts', renderJinxTest(monsta, advocate)]])
	};
}

describe('wiki URLs', () => {
	it('use the character name with underscores, percent-encoding apostrophes', () => {
		expect(wikiUrl('Fang Gu')).toBe('https://wiki.bloodontheclocktower.com/Fang_Gu');
		expect(wikiUrl("Lil' Monsta")).toBe('https://wiki.bloodontheclocktower.com/Lil%27_Monsta');
		expect(wikiUrl('Al-Hadikhia')).toBe('https://wiki.bloodontheclocktower.com/Al-Hadikhia');
		expect(wikiUrl('Deus ex Fiasco')).toBe('https://wiki.bloodontheclocktower.com/Deus_ex_Fiasco');
		expect(wikiUrl('Sects & Violets')).toBe(
			'https://wiki.bloodontheclocktower.com/Sects_%26_Violets'
		);
	});

	it('accept a citation with a literal apostrophe too', () => {
		expect(citesPage("// https://wiki.bloodontheclocktower.com/Lil'_Monsta", "Lil' Monsta")).toBe(
			true
		);
		expect(citesPage('// https://wiki.bloodontheclocktower.com/Lil_Monsta', "Lil' Monsta")).toBe(
			false
		);
	});
});

describe('jinx test file names', () => {
	it('sort the two ids', () => {
		expect(jinxTestFile('lilmonsta', 'devilsadvocate')).toBe('devilsadvocate__lilmonsta.test.ts');
		expect(jinxTestFile('devilsadvocate', 'lilmonsta')).toBe('devilsadvocate__lilmonsta.test.ts');
	});
});

describe('countTodos', () => {
	it('counts it.todo, test.todo and describe.todo calls', () => {
		expect(
			countTodos("it.todo('a');\ntest.todo('b');\ndescribe.todo ('c');\nit('d', () => {});")
		).toBe(3);
	});
});

describe('countFails', () => {
	it('counts it.fails and test.fails calls', () => {
		expect(
			countFails("it.fails('a', () => {});\ntest.fails ('b', () => {});\nit('c', () => {});")
		).toBe(2);
	});
});

describe('engineGaps', () => {
	const source = [
		"it.fails('Example 1: a', () => {",
		'\t// Wiki: "quoted text"',
		'\t// Waits on the engine (M15k): the step has no wake',
		'\t// condition yet.',
		'\texpect(1).toBe(2);',
		'});',
		"it('Example 2: b', () => {",
		'\t// Waits on the engine (M9): not inside an it.fails, so ignored',
		'});',
		"it.fails('Example 3: c', () => {",
		"\tengineGap('M9', 'a vote tally');",
		'});',
		"it.fails('Example 4: d', () => {",
		'\t// Waits on the engine: no plan named.',
		'});'
	].join('\n');

	it('reads each it.fails with the plan ID and need from its note or engineGap call', () => {
		expect(engineGaps(source)).toEqual([
			{ title: 'Example 1: a', gap: 'M15k', needs: 'the step has no wake condition yet.' },
			{ title: 'Example 3: c', gap: 'M9', needs: 'a vote tally' },
			{ title: 'Example 4: d', gap: undefined, needs: 'no plan named.' }
		]);
	});

	it('counts and lists them by plan ID, untagged last', () => {
		expect(gapCounts([source])).toBe('M9 1, M15k 1, no plan ID yet 1');
		expect(renderGapList(new Map([['chef.test.ts', source]]))).toBe(
			[
				'## M9 (1)',
				'- chef: Example 3: c. a vote tally',
				'',
				'## M15k (1)',
				'- chef: Example 1: a. the step has no wake condition yet.',
				'',
				'## no plan ID yet (1)',
				'- chef: Example 4: d. no plan named.'
			].join('\n')
		);
	});
});

describe('checkCoverage', () => {
	it('passes a fully covered fixture and counts its todos', () => {
		const report = checkCoverage(covered());
		expect(report.problems).toEqual([]);
		expect(report).toMatchObject({
			characterFiles: 3,
			jinxFiles: 1,
			// Chef: two examples; Lil' Monsta and Devil's Advocate: one generic todo each.
			characterTodos: 4,
			jinxTodos: 1,
			charactersDone: 0,
			jinxesDone: 0
		});
	});

	it('counts a file with no todos left as done', () => {
		const input = covered();
		const abilityTests = new Map(input.abilityTests);
		abilityTests.set(
			'chef.test.ts',
			`// ${wikiUrl('Chef')}\nit('learns 1 for one evil pair', () => {});`
		);
		const report = checkCoverage({ ...input, abilityTests });
		expect(report.charactersDone).toBe(1);
		expect(report.characterTodos).toBe(2);
	});

	// Trevor (2026-11-01): examples the engine can't pass yet are written as it.fails.
	it('counts examples waiting on the engine, and a file with any is not done', () => {
		const input = covered();
		const abilityTests = new Map(input.abilityTests);
		abilityTests.set(
			'chef.test.ts',
			`// ${wikiUrl('Chef')}\nimport { scenario } from '#lib/core/testing/scenario.ts';\n` +
				`it('Example 1: two evil pairs', () => {});\nit.fails('Example 2: a Recluse pair', () => {});`
		);
		const report = checkCoverage({ ...input, abilityTests });
		expect(report.problems).toEqual([]);
		expect(report.characterFails).toBe(1);
		expect(report.charactersDone).toBe(0);
	});

	it('requires scenario for an example written as it.fails', () => {
		const input = covered();
		const abilityTests = new Map(input.abilityTests);
		abilityTests.set('chef.test.ts', `// ${wikiUrl('Chef')}\nit.fails('Example 1: a', () => {});`);
		expect(checkCoverage({ ...input, abilityTests }).problems).toHaveLength(1);
	});

	// Trevor (2026-10-31): one way to write the wiki examples (M13a).
	it('fails when a written wiki example does not use scenario', () => {
		const input = covered();
		const abilityTests = new Map(input.abilityTests);
		const cite = `// ${wikiUrl('Chef')}\n`;
		abilityTests.set('chef.test.ts', `${cite}it('Example 1: two evil pairs', () => {});`);
		expect(checkCoverage({ ...input, abilityTests }).problems).toEqual([
			'src/lib/core/abilities/chef.test.ts: writes wiki examples without `scenario` (src/lib/core/testing/scenario.ts)'
		]);
		abilityTests.set(
			'chef.test.ts',
			`${cite}import { scenario } from '#lib/core/testing/scenario.ts';\nit('Example 1: two evil pairs', () => {});`
		);
		expect(checkCoverage({ ...input, abilityTests }).problems).toEqual([]);
	});

	it('fails when a character or jinx has no test file', () => {
		const input = covered();
		const abilityTests = new Map(input.abilityTests);
		abilityTests.delete('chef.test.ts');
		const report = checkCoverage({ ...input, abilityTests, jinxTests: new Map() });
		expect(report.problems).toEqual([
			'src/lib/core/abilities/chef.test.ts: missing (character chef)',
			'src/lib/core/jinxes/devilsadvocate__lilmonsta.test.ts: missing (jinx lilmonsta + devilsadvocate)'
		]);
	});

	it('fails when a test file does not cite its wiki page', () => {
		const input = covered();
		const abilityTests = new Map(input.abilityTests);
		abilityTests.set('chef.test.ts', "it.todo('wiki examples');");
		const jinxTests = new Map([
			['devilsadvocate__lilmonsta.test.ts', `// ${wikiUrl("Lil' Monsta")}\nit.todo('rule');`]
		]);
		expect(checkCoverage({ ...input, abilityTests, jinxTests }).problems).toEqual([
			'src/lib/core/abilities/chef.test.ts: does not cite https://wiki.bloodontheclocktower.com/Chef',
			'src/lib/core/jinxes/devilsadvocate__lilmonsta.test.ts: does not cite https://wiki.bloodontheclocktower.com/Devil%27s_Advocate'
		]);
	});

	it('fails on test files for characters or jinxes that no longer exist', () => {
		const input = covered();
		const report = checkCoverage({
			...input,
			characters: [chef, monsta],
			jinxes: [],
			abilityTests: new Map(input.abilityTests)
		});
		expect(report.problems).toEqual([
			'src/lib/core/abilities/devilsadvocate.test.ts: no character with this id in roles.json',
			'src/lib/core/jinxes/devilsadvocate__lilmonsta.test.ts: no jinx for this pair in jinxes.json (file names are <a>__<b>.test.ts, ids sorted)'
		]);
	});

	it('fails on a jinx test file whose ids are not sorted', () => {
		const input = covered();
		const jinxTests = new Map([
			['lilmonsta__devilsadvocate.test.ts', renderJinxTest(monsta, advocate)]
		]);
		expect(checkCoverage({ ...input, jinxTests }).problems).toEqual([
			'src/lib/core/jinxes/devilsadvocate__lilmonsta.test.ts: missing (jinx lilmonsta + devilsadvocate)',
			'src/lib/core/jinxes/lilmonsta__devilsadvocate.test.ts: no jinx for this pair in jinxes.json (file names are <a>__<b>.test.ts, ids sorted)'
		]);
	});
});
