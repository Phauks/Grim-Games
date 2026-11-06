import { describe, expect, it } from 'vitest';
import { splitSetupNote } from './setup-note.ts';

describe('splitSetupNote', () => {
	it('splits a trailing setup note off', () => {
		expect(splitSetupNote('There are extra Outsiders in play. [+2 Outsiders]')).toEqual({
			text: 'There are extra Outsiders in play.',
			setup: '+2 Outsiders'
		});
	});

	it('keeps an ability without a note whole', () => {
		const text = 'You start knowing that 1 of 2 players is a particular Townsfolk.';
		expect(splitSetupNote(text)).toEqual({ text });
	});

	it('keeps a note with sentences in it whole', () => {
		expect(
			splitSetupNote(
				'Each night*, choose a player: they die. [Evil characters are in a line. +1 Minion.]'
			).setup
		).toBe('Evil characters are in a line. +1 Minion.');
	});

	it('leaves brackets that are not at the end, or are the whole text', () => {
		expect(splitSetupNote('[A] then more')).toEqual({ text: '[A] then more' });
		expect(splitSetupNote('[No Demon]')).toEqual({ text: '[No Demon]' });
	});
});
