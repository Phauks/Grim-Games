/**
 * Shared by `scaffold-rules-tests.ts` and `check-rules-coverage.ts`: where the rules tests
 * for each character and jinx live, the wiki URLs they cite, what a generated test file
 * looks like, and the coverage check itself (04-architecture.md §10).
 *
 * Everything here is pure (no file system), so the checker can be unit-tested on fixtures.
 */
import { pairKey } from '../../src/lib/core/data/parse.ts';
import { defaultAlignment } from '../../src/lib/core/data/character-type.ts';
import type { Character, CharacterId, Jinx, NightSheet } from '../../src/lib/core/data/types.ts';

export const WIKI_BASE = 'https://wiki.bloodontheclocktower.com/';
export const ABILITIES_DIR = 'src/lib/core/abilities';
export const JINXES_DIR = 'src/lib/core/jinxes';

/**
 * The wiki page title for a character is its name with spaces as underscores; the wiki has a
 * page for every official character under exactly that name (checked against the wiki's
 * `allpages` list, 2026-10-15). Apostrophes are percent-encoded as MediaWiki does in its own
 * links (`Lil%27_Monsta`), hyphens stay (`Al-Hadikhia`, `Pit-Hag`).
 */
export function wikiUrl(pageName: string): string {
	const title = pageName.replace(/ /g, '_');
	return WIKI_BASE + encodeURIComponent(title).replace(/'/g, '%27');
}

/** Spellings of a page's URL that a test file may use to cite it (encoded or not). */
export function wikiUrlVariants(pageName: string): string[] {
	const encoded = wikiUrl(pageName);
	const literal = WIKI_BASE + pageName.replace(/ /g, '_');
	return encoded === literal ? [encoded] : [encoded, literal];
}

export function citesPage(source: string, pageName: string): boolean {
	return wikiUrlVariants(pageName).some((url) => source.includes(url));
}

export const characterTestFile = (id: CharacterId): string => `${id}.test.ts`;

/** `<a>__<b>.test.ts` with the two ids sorted, so each pair has exactly one file name. */
export function jinxTestFile(a: CharacterId, b: CharacterId): string {
	const [first, second] = pairKey(a, b).split('+');
	return `${first}__${second}.test.ts`;
}

/** Counts `it.todo(` / `test.todo(` / `describe.todo(` calls: scenarios still to write. */
export function countTodos(source: string): number {
	return source.match(/\b(?:it|test|describe)\.todo\s*\(/g)?.length ?? 0;
}

// ---------------------------------------------------------------------------------------
// Generated files
// ---------------------------------------------------------------------------------------

const TYPE_LABELS: Record<Character['type'], string> = {
	townsfolk: 'a Townsfolk',
	outsider: 'an Outsider',
	minion: 'a Minion',
	demon: 'a Demon',
	traveller: 'a Traveller',
	fabled: 'a Fabled',
	loric: 'a Loric'
};

const str = (value: unknown): string => JSON.stringify(value);

function nightTitle(firstNight: boolean, otherNight: boolean): string {
	if (firstNight && otherNight) return 'is on the night sheet for the first night and other nights';
	if (firstNight) return 'is on the night sheet for the first night only';
	if (otherNight) return 'is on the night sheet for other nights only';
	return 'is not on the night sheet';
}

/**
 * A new character test file: data checks that pin TPI's current data for the character, and
 * one `it.todo` per example on its wiki page (or a single generic one when the examples are
 * not known). `examples` are short paraphrased titles, never wiki text; an empty string gives
 * a bare "Example N".
 */
export function renderCharacterTest(
	character: Character,
	nightSheet: NightSheet,
	examples?: readonly string[]
): string {
	const { id, name, type } = character;
	const url = wikiUrl(name);
	const alignment = defaultAlignment(type);
	const firstNight = nightSheet.firstNight.includes(id);
	const otherNight = nightSheet.otherNight.includes(id);
	const todos = examples?.length
		? examples.map((gist, i) => `it.todo(${str(`Example ${i + 1}${gist ? `: ${gist}` : ''}`)});`)
		: [`it.todo('wiki examples');`];

	return `/**
 * ${name}: rules tests.
 *
 * Wiki: ${url}
 *
 * Data checks: generated from static/data/roles.json by \`npm run scaffold:rules-tests\`. They
 * pin TPI's current data, so review and update them when a data sync changes ${name}.
 *
 * Wiki examples: each \`it.todo\` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe(${str(name)}, () => {
	const character = committedCharacter(${str(id)});

	describe('data (roles.json)', () => {
		it(${str(`is ${TYPE_LABELS[type]} from edition ${character.edition ?? 'none'}`)}, () => {
			expect(character.name).toBe(${str(name)});
			expect(character.type).toBe(${str(type)});
			expect(character.edition).toBe(${str(character.edition)});
			expect(defaultAlignment(character.type)).${alignment ? `toBe(${str(alignment)})` : 'toBeUndefined()'};
		});

		it(${str(character.setup ? 'changes setup' : 'does not change setup')}, () => {
			expect(character.setup).toBe(${character.setup});
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(${str(character.reminders)});
			expect(character.remindersGlobal).toEqual(${str(character.remindersGlobal)});
		});

		it(${str(nightTitle(firstNight, otherNight))}, () => {
			expect(nightSheetPresence(${str(id)})).toEqual({ firstNight: ${firstNight}, otherNight: ${otherNight} });
		});

		it(${str(character.special.length ? 'has its special app hooks' : 'has no special app hooks')}, () => {
			expect(character.special).toEqual(${str(character.special)});
		});
	});

	describe(${str(`wiki examples (${url}#Examples)`)}, () => {
		${todos.join('\n\t\t')}
	});
});
`;
}

/** A new jinx test file: the jinx is in the data, applies only with both characters, and a todo for its rule. */
export function renderJinxTest(a: Character, b: Character): string {
	const [first, second] = a.id < b.id ? [a, b] : [b, a];
	const title = `${first.name} + ${second.name}`;
	return `/**
 * Jinx ${title}: rules tests.
 *
 * Wiki: ${wikiUrl(first.name)}
 * Wiki: ${wikiUrl(second.name)}
 * (the wiki has no jinx page; each character's page lists the jinx under "Related Jinxes")
 *
 * Generated by \`npm run scaffold:rules-tests\`. Replace the \`it.todo\` with tests of the rule
 * the jinx imposes, where the engine can check it (for example a setup warning when only one
 * of the two may be in play). Paraphrase, never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { findJinx, jinxesAmong } from '#lib/core/data/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';

describe(${str(`${title} jinx`)}, () => {
	const data = committedGameData();
	const jinx = findJinx(data.jinxes, ${str(first.id)}, ${str(second.id)});

	it('is in jinxes.json between two official characters', () => {
		expect(data.byId.get(${str(first.id)})?.name).toBe(${str(first.name)});
		expect(data.byId.get(${str(second.id)})?.name).toBe(${str(second.name)});
		expect(jinx).toBeDefined();
		expect(jinx?.reason).not.toBe('');
	});

	it('applies only when both characters are on the script', () => {
		expect(jinxesAmong(data.jinxes, [${str(first.id)}, ${str(second.id)}])).toContain(jinx);
		expect(jinxesAmong(data.jinxes, [${str(first.id)}])).not.toContain(jinx);
		expect(jinxesAmong(data.jinxes, [${str(second.id)}])).not.toContain(jinx);
	});

	it.todo('enforces the rule the jinx imposes');
});
`;
}

// ---------------------------------------------------------------------------------------
// Coverage check
// ---------------------------------------------------------------------------------------

export interface CoverageInput {
	characters: readonly Character[];
	jinxes: readonly Jinx[];
	/** Test files in ABILITIES_DIR, by file name. */
	abilityTests: ReadonlyMap<string, string>;
	/** Test files in JINXES_DIR, by file name. */
	jinxTests: ReadonlyMap<string, string>;
}

export interface CoverageReport {
	problems: string[];
	characterFiles: number;
	jinxFiles: number;
	/** Scenario `todo`s in character test files. */
	characterTodos: number;
	/** Rule `todo`s in jinx test files. */
	jinxTodos: number;
	/** Characters / jinxes whose test file has no `todo` left. */
	charactersDone: number;
	jinxesDone: number;
}

export function checkCoverage(input: CoverageInput): CoverageReport {
	const problems: string[] = [];
	const byId = new Map(input.characters.map((c) => [c.id, c]));
	const report: CoverageReport = {
		problems,
		characterFiles: 0,
		jinxFiles: 0,
		characterTodos: 0,
		jinxTodos: 0,
		charactersDone: 0,
		jinxesDone: 0
	};

	const expectedAbilities = new Set<string>();
	for (const character of input.characters) {
		const file = characterTestFile(character.id);
		expectedAbilities.add(file);
		const source = input.abilityTests.get(file);
		if (source === undefined) {
			problems.push(`${ABILITIES_DIR}/${file}: missing (character ${character.id})`);
			continue;
		}
		report.characterFiles++;
		if (!citesPage(source, character.name)) {
			problems.push(`${ABILITIES_DIR}/${file}: does not cite ${wikiUrl(character.name)}`);
		}
		const todos = countTodos(source);
		report.characterTodos += todos;
		if (todos === 0) report.charactersDone++;
	}
	for (const file of input.abilityTests.keys()) {
		if (!expectedAbilities.has(file)) {
			problems.push(`${ABILITIES_DIR}/${file}: no character with this id in roles.json`);
		}
	}

	const expectedJinxes = new Set<string>();
	for (const { characters } of input.jinxes) {
		const file = jinxTestFile(...characters);
		expectedJinxes.add(file);
		const source = input.jinxTests.get(file);
		if (source === undefined) {
			problems.push(`${JINXES_DIR}/${file}: missing (jinx ${characters.join(' + ')})`);
			continue;
		}
		report.jinxFiles++;
		for (const id of characters) {
			const character = byId.get(id);
			if (character && !citesPage(source, character.name)) {
				problems.push(`${JINXES_DIR}/${file}: does not cite ${wikiUrl(character.name)}`);
			}
		}
		const todos = countTodos(source);
		report.jinxTodos += todos;
		if (todos === 0) report.jinxesDone++;
	}
	for (const file of input.jinxTests.keys()) {
		if (!expectedJinxes.has(file)) {
			problems.push(
				`${JINXES_DIR}/${file}: no jinx for this pair in jinxes.json (file names are <a>__<b>.test.ts, ids sorted)`
			);
		}
	}

	return report;
}
