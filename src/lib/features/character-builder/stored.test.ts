import { describe, expect, it } from 'vitest';
import { emptyCharacterDraft, parseCharacterDraft } from './draft.ts';
import { parseSavedCharacters } from './saved-characters.ts';

describe('parseCharacterDraft', () => {
	it('starts empty when missing, damaged or from a newer build', () => {
		expect(parseCharacterDraft(null)).toEqual(emptyCharacterDraft());
		expect(parseCharacterDraft({ version: 99, fields: {} })).toEqual(emptyCharacterDraft());
	});

	it('keeps what it can read and drops the rest', () => {
		const draft = parseCharacterDraft({
			version: 1,
			editing: 'a',
			fields: { name: 'Lamp', team: 'nobody', reminders: ['Lit', 3], firstNight: -1, setup: true }
		});
		expect(draft.editing).toBe('a');
		expect(draft.fields).toMatchObject({ name: 'Lamp', team: 'townsfolk', reminders: ['Lit'] });
		expect(draft.fields).not.toHaveProperty('firstNight');
		expect(draft.fields.setup).toBe(true);
	});
});

describe('parseSavedCharacters', () => {
	it('drops damaged entries and repeats', () => {
		const entry = { id: 'lamp', name: 'Lamp', team: 'minion', ability: 'Glow.' };
		const parsed = parseSavedCharacters({
			version: 1,
			characters: [
				{ savedId: 'a', entry, updatedAt: 5 },
				{ savedId: 'a', entry, updatedAt: 6 },
				{ savedId: 'b' },
				'junk'
			]
		});
		expect(parsed.characters).toEqual([{ savedId: 'a', entry, updatedAt: 5 }]);
	});
});
