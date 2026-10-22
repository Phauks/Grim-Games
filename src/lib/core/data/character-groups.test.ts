import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { charactersOfGroup, groupSourceOf } from './character-groups.ts';

const data = committedGameData();

describe('charactersOfGroup', () => {
	it("lists one source's characters of one type in Sort Order", () => {
		const demons = charactersOfGroup(data.characters, 'tb', 'demon');
		expect(demons.map((c) => c.id)).toEqual(['imp']);
		const minions = charactersOfGroup(data.characters, 'snv', 'minion');
		expect(minions).toHaveLength(4);
		expect(minions.every((c) => c.edition === 'snv' && c.type === 'minion')).toBe(true);
	});

	it('lists every source with "all", Fabled included', () => {
		const fabled = charactersOfGroup(data.characters, 'all', 'fabled');
		expect(fabled.map((c) => c.id)).toEqual(
			expect.arrayContaining(
				[...charactersOfGroup(data.characters, 'carousel', 'fabled')].map((c) => c.id)
			)
		);
		expect(fabled.length).toBeGreaterThan(
			charactersOfGroup(data.characters, 'carousel', 'fabled').length
		);
	});
});

describe('groupSourceOf', () => {
	it("is the character's own source, or every source for Fabled and Loric", () => {
		expect(groupSourceOf(data.byId.get('witch')!)).toBe('snv');
		expect(groupSourceOf(data.byId.get('doomsayer')!)).toBe('all');
		expect(groupSourceOf({ edition: undefined })).toBe('all');
	});
});
