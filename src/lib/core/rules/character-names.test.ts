import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { characterNames, NO_CHARACTER_NAMES, type NamePiece } from './character-names.ts';

const names = characterNames(committedGameData().characters);
const show = (pieces: NamePiece[]) =>
	pieces.map((p) => (p.kind === 'text' ? p.text : `{${p.id}}`)).join('');

describe('characterNames', () => {
	it('matches a two-word name as one character', () => {
		expect(show(names.split('Nod if the Fortune Teller chose the Demon.'))).toBe(
			'Nod if the {fortuneteller} chose the Demon.'
		);
	});

	it('matches whole words only, with their own capitals', () => {
		expect(show(names.split('Wake the King.'))).toBe('Wake the {king}.');
		expect(show(names.split('Two Kings, seeking a king.'))).toBe('Two Kings, seeking a king.');
		expect(show(names.split('Seeking'))).toBe('Seeking');
	});

	it('matches a possessive but not a longer word', () => {
		expect(show(names.split('Show the Spy’s grimoire. Spy\'s turn. Spyglass.'))).toBe(
			'Show the {spy}’s grimoire. {spy}\'s turn. Spyglass.'
		);
	});

	it('prefers the longest name and handles apostrophes and hyphens', () => {
		expect(show(names.split('The Devil’s Advocate and the Pit-Hag wake; Lil\' Monsta too.'))).toBe(
			'The {devilsadvocate} and the {pithag} wake; {lilmonsta} too.'
		);
		expect(show(names.split('Hell’s Librarian, not the Librarian.'))).toBe(
			'{hellslibrarian}, not the {librarian}.'
		);
	});

	it('finds a character by its name in any case', () => {
		expect(names.byName('KING')).toBe('king');
		expect(names.byName('fortune teller')).toBe('fortuneteller');
		expect(names.byName('Lil’ Monsta')).toBe('lilmonsta');
		expect(names.byName('Kings')).toBeUndefined();
	});

	it('leaves text alone without character data', () => {
		expect(NO_CHARACTER_NAMES.split('The King wakes.')).toEqual([
			{ kind: 'text', text: 'The King wakes.' }
		]);
	});
});
