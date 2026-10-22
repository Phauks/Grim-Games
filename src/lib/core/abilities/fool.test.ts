/**
 * Fool: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Fool
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Fool.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a scenario test (seats, characters and reminders, then the action, then the expected state)
 * that paraphrases the example. Never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { foolSurvives } from '#lib/core/rules/fool.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

const CAST = ['fool', 'chef', 'poisoner', 'assassin', 'imp'];
const spent = (s: string[]): Command => ({
	type: 'AddReminder',
	seatId: s[0],
	reminder: { characterId: 'fool', label: 'No Ability' }
});

describe('Fool', () => {
	const character = committedCharacter('fool');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition bmr', () => {
			expect(character.name).toBe('Fool');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('fool')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Fool#Examples)', () => {
		it('Example 1: survives the first execution, then dies to the second', () => {
			const { session, seats } = castGame(CAST);
			expect(foolSurvives(session.game, seats[0], 'execution', characters)).toBe(true);
			const after = castGame(CAST, spent);
			expect(foolSurvives(after.session.game, after.seats[0], 'execution', characters)).toBe(false);
		});

		it('Example 2: survives a night kill, so a later execution kills them', () => {
			const { session, seats } = castGame(CAST);
			expect(foolSurvives(session.game, seats[0], 'demon', characters)).toBe(true);
			const after = castGame(CAST, spent);
			expect(foolSurvives(after.session.game, after.seats[0], 'execution', characters)).toBe(false);
		});
		it.todo('Example 3: Protected twice; ability saves once');
	});

	// https://wiki.bloodontheclocktower.com/Assassin: the Assassin's kill works even if the
	// player could not die (Trevor, 2026-10-22: "the Assassin overrides everything"). A
	// poisoned Fool has no ability (https://wiki.bloodontheclocktower.com/Poisoner).
	it('dies to the Assassin, and when poisoned; only the Fool survives this way', () => {
		const { session, seats } = castGame(CAST);
		expect(foolSurvives(session.game, seats[0], 'assassin', characters)).toBe(false);
		expect(foolSurvives(session.game, seats[1], 'demon', characters)).toBe(false);
		const poisoned = castGame(CAST, (s) => ({
			type: 'AddReminder',
			seatId: s[0],
			reminder: { characterId: 'poisoner', label: 'Poisoned' }
		}));
		expect(foolSurvives(poisoned.session.game, poisoned.seats[0], 'demon', characters)).toBe(false);
	});
});
