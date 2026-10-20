import { describe, expect, it } from 'vitest';
import { castGame, newGame, testCharacters } from '#lib/core/model/fixtures.test-support.ts';
import { playersLine, ruleCharactersLine } from './players-line.ts';

describe('Game info’s Players row', () => {
	it('gives the standard split for the table before characters are assigned', () => {
		const { session } = newGame(8);
		expect(playersLine(session.game, testCharacters)).toBe(
			'8 (5 Townsfolk, 1 Outsider, 1 Minion, 1 Demon)'
		);
	});

	it('counts the characters in play once assigned, so setup changes show', () => {
		// The Baron adds two Outsiders (https://wiki.bloodontheclocktower.com/Baron).
		const { session } = castGame([
			'washerwoman',
			'chef',
			'empath',
			'butler',
			'drunk',
			'saint',
			'baron',
			'imp'
		]);
		expect(playersLine(session.game, testCharacters)).toBe(
			'8 (3 Townsfolk, 3 Outsiders, 1 Minion, 1 Demon)'
		);
	});

	it('adds Travellers only when there are any; Fabled get a line of their own', () => {
		const { session } = castGame(
			['washerwoman', 'chef', 'empath', 'monk', 'poisoner', 'imp', 'gunslinger'],
			{ type: 'AddRuleCharacter', characterId: 'djinn' }
		);
		expect(playersLine(session.game, testCharacters)).toBe(
			'7 (4 Townsfolk, 0 Outsiders, 1 Minion, 1 Demon, 1 Traveller)'
		);
		// No player is a Fabled (Trevor, 2026-10-20).
		expect(ruleCharactersLine(session.game, testCharacters)).toBe('1 Fabled');
		expect(ruleCharactersLine(newGame(8).session.game, testCharacters)).toBe('');
	});
});
