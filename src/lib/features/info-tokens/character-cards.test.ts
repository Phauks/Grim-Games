import { describe, expect, it } from 'vitest';
import type { Character } from '#lib/core/data/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { cardsOfCharacter, characterCardsFor } from './character-cards.ts';

const data = committedGameData();

describe('character cards', () => {
	it('load only for characters on the script, in script order', () => {
		const ids = ['yaggababble', 'chef', 'mezepheles'];
		expect(characterCardsFor(ids).map((c) => c.characterId)).toEqual(['yaggababble', 'mezepheles']);
		expect(characterCardsFor(['chef'])).toEqual([]);
	});

	it('have ids that cannot clash with standard or custom ones', () => {
		expect(characterCardsFor(['mezepheles', 'yaggababble']).map((c) => c.id)).toEqual([
			'character:mezepheles:secret-word',
			'character:yaggababble:secret-phrase'
		]);
	});

	it("are only the secret word, phrase and goal, in Trevor's wording, until he approves more", () => {
		const all = characterCardsFor([...data.byId.keys()]);
		expect(all.map((c) => [c.characterId, c.source]).sort()).toEqual([
			['mezepheles', 'own'],
			['yaggababble', 'own'],
			['zenomancer', 'own']
		]);
	});

	// The Mezepheles's rules block, given to a custom character.
	it('come from a custom character’s own infoCard rule', () => {
		const custom: Character = {
			...data.byId.get('mezepheles')!,
			id: 'whisperer',
			name: 'Whisperer',
			edition: undefined,
			rules: { infoCard: 'secret-phrase' }
		};
		expect(cardsOfCharacter(custom)).toMatchObject([
			{ id: 'character:whisperer:secret-phrase', fillKey: 'info-tokens.fill.phrase' }
		]);
		expect(characterCardsFor(['whisperer'])).toEqual([]);
	});
});
