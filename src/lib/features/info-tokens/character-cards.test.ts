import { describe, expect, it } from 'vitest';
import { CHARACTER_CARDS, characterCardsFor } from './character-cards.ts';

describe('character cards', () => {
	it('load only for characters on the script, in script order', () => {
		const ids = ['yaggababble', 'chef', 'mezepheles'];
		expect(characterCardsFor(ids).map((c) => c.characterId)).toEqual(['yaggababble', 'mezepheles']);
		expect(characterCardsFor(['chef'])).toEqual([]);
	});

	it('have unique ids that cannot clash with standard or custom ones', () => {
		const ids = CHARACTER_CARDS.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) expect(id.startsWith('character:')).toBe(true);
	});

	it('use TPI wording only until Trevor approves our own', () => {
		expect(CHARACTER_CARDS.every((c) => c.source === 'tpi')).toBe(true);
	});
});
