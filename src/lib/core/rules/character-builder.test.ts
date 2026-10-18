/**
 * Character builder output: TPI's script character object (script-schema.json in
 * ThePandemoniumInstitute/botc-release), read back by the same loader as any script.
 */
import { describe, expect, it } from 'vitest';
import { loadScript } from '#lib/core/data/script.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import {
	blocksSaving,
	characterEntry,
	characterIdFor,
	characterProblems,
	emptyCharacterFields,
	fieldsFromEntry,
	previewCharacter,
	type CharacterFields
} from './character-builder.ts';

const data = committedGameData();

function fields(over: Partial<CharacterFields> = {}): CharacterFields {
	return {
		...emptyCharacterFields(),
		name: 'Lamp Lighter',
		ability: 'Each night, learn 1.',
		...over
	};
}

describe('characterIdFor', () => {
	it('keeps lower-case letters and digits only', () => {
		expect(characterIdFor('Lamp Lighter')).toBe('lamplighter');
		expect(characterIdFor("Ojo's 2nd Café")).toBe('ojos2ndcafe');
	});
});

describe('characterEntry', () => {
	it('leaves empty fields out', () => {
		expect(characterEntry(fields())).toEqual({
			id: 'lamplighter',
			name: 'Lamp Lighter',
			team: 'townsfolk',
			ability: 'Each night, learn 1.'
		});
	});

	it('writes night text with its position, and drops blank reminders', () => {
		const entry = characterEntry(
			fields({
				reminders: ['Lit', ' ', 'Lit'],
				firstNightReminder: 'Show a finger.',
				firstNight: 40
			})
		);
		expect(entry).toMatchObject({
			reminders: ['Lit', 'Lit'],
			firstNight: 40,
			firstNightReminder: 'Show a finger.'
		});
		expect(entry).not.toHaveProperty('otherNight');
	});

	it('marks setup from [bracketed] text unless set by hand', () => {
		expect(characterEntry(fields({ ability: 'You know things. [+1 Outsider]' })).setup).toBe(true);
		expect(
			characterEntry(fields({ ability: 'You know things. [+1 Outsider]', setup: false }))
		).not.toHaveProperty('setup');
	});

	it('loads as a homebrew character on a script', () => {
		const entry = characterEntry(fields({ reminders: ['Lit'], otherNightReminder: 'Wake.' }));
		const { script, ok } = loadScript([{ id: '_meta', name: 'Test' }, entry, 'imp'], data);
		expect(ok).toBe(true);
		const character = script!.characters.find((c) => c.id === 'lamplighter');
		expect(character).toMatchObject({ name: 'Lamp Lighter', reminders: ['Lit'] });
		expect(script!.homebrew).toContain('lamplighter');
	});
});

describe('fieldsFromEntry', () => {
	it('round-trips', () => {
		const start = fields({
			team: 'minion',
			flavor: 'Hm.',
			image: 'https://example.com/a.png',
			remindersGlobal: ['Out'],
			otherNightReminder: 'Wake.',
			otherNight: 12,
			ability: 'Odd. [-1 Outsider]',
			setup: false
		});
		expect(characterEntry(fieldsFromEntry(characterEntry(start)))).toEqual(characterEntry(start));
	});
});

describe('characterProblems', () => {
	it('needs a name and an ability', () => {
		const problems = characterProblems(emptyCharacterFields(), data);
		expect(problems.map((p) => p.kind)).toEqual(['name-missing', 'ability-missing']);
		expect(blocksSaving(problems)).toBe(true);
	});

	it('warns, without blocking, when the id is an official character', () => {
		const problems = characterProblems(fields({ name: 'Chef' }), data);
		expect(problems).toEqual([{ kind: 'id-official', id: 'chef' }]);
		expect(blocksSaving(problems)).toBe(false);
	});

	it('rejects a name with no letters or digits for its id', () => {
		expect(characterProblems(fields({ name: '???' }), data)).toEqual([
			{ kind: 'id-invalid', id: '' }
		]);
	});
});

describe('previewCharacter', () => {
	it('shows night text and reminders as the app reads them', () => {
		const c = previewCharacter(fields({ reminders: ['Lit', ''], firstNightReminder: 'Wake.' }));
		expect(c).toMatchObject({ id: 'lamplighter', reminders: ['Lit'] });
		expect(c).not.toHaveProperty('firstNight');
		expect(c.firstNightReminder).toBe('Wake.');
	});
	it('has an id before it has a name', () => {
		expect(previewCharacter(emptyCharacterFields()).id).toBe('custom');
	});
});
