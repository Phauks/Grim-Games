import { describe, expect, it } from 'vitest';
import { mentionCharacters, mentionSegments, type NamedCharacter } from './mentions.ts';

const characters: NamedCharacter[] = [
	{ id: 'witch', name: 'Witch' },
	{ id: 'drunk', name: 'Drunk' },
	{ id: 'scarletwoman', name: 'Scarlet Woman' },
	{ id: 'villageidiot', name: 'Village Idiot' },
	{ id: 'imp', name: 'Imp' },
	{ id: 'king', name: 'King' }
];

describe('mentionSegments', () => {
	it('marks character names and keeps the text between them', () => {
		expect(mentionSegments('The Witch chooses a player.', characters)).toEqual([
			{ kind: 'text', text: 'The ' },
			{ kind: 'character', characterId: 'witch', text: 'Witch' },
			{ kind: 'text', text: ' chooses a player.' }
		]);
	});

	it('leaves the lower-case state word alone but marks the Drunk', () => {
		const segments = mentionSegments('1 of the extras is drunk. The Drunk thinks', characters);
		expect(segments.filter((s) => s.kind === 'character')).toEqual([
			{ kind: 'character', characterId: 'drunk', text: 'Drunk' }
		]);
	});

	it('leaves a reminder token name alone', () => {
		expect(
			mentionSegments('a Poisoned or Drunk reminder is on them', characters).map((s) => s.kind)
		).toEqual(['text']);
	});

	it('prefers the longest name and counts plurals', () => {
		const segments = mentionSegments('Wake the Village Idiots. The Scarlet Woman', characters);
		expect(segments.filter((s) => s.kind === 'character').map((s) => s.text)).toEqual([
			'Village Idiots',
			'Scarlet Woman'
		]);
	});

	it('does not match a name inside another word', () => {
		expect(mentionSegments('Important impish Imps', characters).map((s) => s.kind)).toEqual([
			'text',
			'character'
		]);
	});

	it("marks a homebrew name holding official names as one character, the game's own", () => {
		const game = new Map([['witchking', { id: 'witchking', name: 'Witch-King' }]]);
		const segments = mentionSegments(
			'The Witch-King chooses a player.',
			mentionCharacters(characters, game)
		);
		expect(segments).toEqual([
			{ kind: 'text', text: 'The ' },
			{ kind: 'character', characterId: 'witchking', text: 'Witch-King' },
			{ kind: 'text', text: ' chooses a player.' }
		]);
	});

	it('lets a game character replace the official one with its id', () => {
		const game = new Map([['imp', { id: 'imp', name: 'Pit Imp' }]]);
		expect(mentionCharacters(characters, game).filter((c) => c.id === 'imp')).toEqual([
			{ id: 'imp', name: 'Pit Imp' }
		]);
		expect(mentionCharacters(characters, undefined)).toBe(characters);
		// The same list each time, so its name pattern is built once for the whole screen.
		expect(mentionCharacters(characters, game)).toBe(mentionCharacters(characters, game));
	});
});
