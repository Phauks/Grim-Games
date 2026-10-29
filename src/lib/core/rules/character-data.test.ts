/**
 * The Data view gathers each character's pieces from every file that holds one. Rules cited:
 * - https://wiki.bloodontheclocktower.com/Washerwoman (first night only, two reminders)
 * - https://wiki.bloodontheclocktower.com/Spy (has jinxes)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { characterData, characterDataFile, CHARACTER_DATA_PARTS } from './character-data.ts';

const data = committedGameData();
const piece = (id: string, part: string) =>
	characterData(data, id)!.sources.find((s) => s.part === part)!;

describe('characterData', () => {
	it('has every piece for every official character, each naming its file', () => {
		for (const character of data.characters) {
			const found = characterData(data, character.id)!;
			expect(found.sources.map((s) => s.part)).toEqual([...CHARACTER_DATA_PARTS]);
			expect(found.sources.every((s) => s.file.length > 0)).toBe(true);
		}
	});

	it('has nothing for a character that is not official', () => {
		expect(characterData(data, 'not-a-character')).toBeUndefined();
	});

	it('shows the rules file exactly as written in the repository', () => {
		const rules = piece('washerwoman', 'rules');
		expect(rules.file).toBe('src/lib/core/data/rules/washerwoman.json');
		expect(rules.data).toEqual(JSON.parse(readFileSync(rules.file, 'utf8')));
	});

	it('gives the character as roles.json describes it', () => {
		const character = piece('washerwoman', 'character');
		expect(character.file).toBe('static/data/roles.json');
		expect(character.data).toBe(data.byId.get('washerwoman'));
	});

	it('places the character on each night, or null on a night it does not wake', () => {
		const sheet = piece('washerwoman', 'nightSheet').data as Record<string, number | null>;
		expect(sheet.firstNight).toBe(data.nightSheet.firstNight.indexOf('washerwoman') + 1);
		expect(sheet.otherNight).toBeNull();
	});

	it('lists the jinxes that name the character', () => {
		const jinxes = piece('spy', 'jinxes').data as { characters: string[] }[];
		expect(jinxes.length).toBeGreaterThan(0);
		expect(jinxes.every((j) => j.characters.includes('spy'))).toBe(true);
		expect(piece('washerwoman', 'jinxes').data).toEqual([]);
	});

	it('names the icon files', () => {
		expect(piece('washerwoman', 'icons').data).toEqual({
			good: 'tb/washerwoman_g.webp',
			evil: 'tb/washerwoman_e.webp'
		});
	});
});

describe('characterDataFile', () => {
	it('is one JSON object with each piece under its name and file', () => {
		const file = characterDataFile(characterData(data, 'washerwoman')!);
		expect(Object.keys(file)).toEqual(['id', ...CHARACTER_DATA_PARTS]);
		expect(file.rules).toMatchObject({ file: 'src/lib/core/data/rules/washerwoman.json' });
		expect(JSON.parse(JSON.stringify(file))).toEqual(file);
	});
});
