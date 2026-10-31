/**
 * Storm Catcher: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Storm_Catcher
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Storm Catcher.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { evilLearns } from '#lib/core/rules/index.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Storm Catcher', () => {
	const character = committedCharacter('stormcatcher');

	describe('data (roles.json)', () => {
		it('is a Loric from edition loric', () => {
			expect(character.name).toBe('Storm Catcher');
			expect(character.type).toBe('loric');
			expect(character.edition).toBe('loric');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Stormcaught']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('stormcatcher')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Storm_Catcher#Examples)', () => {
		it.todo('Example 1: General survives night attacks until executed');

		it('Example 1: the evil players learn who the favoured General is', () => {
			// The General is marked Stormcaught: the Imp and Godfather are shown "This player is"
			// with the General, pointing at its player.
			const s = scenario(['general', 'imp', 'godfather', 'chef']).reminder(
				'general',
				'stormcatcher',
				'Stormcaught'
			);
			expect(evilLearns(s.game, 'stormcatcher', s.characters)).toEqual({
				evil: [s.seat('imp'), s.seat('godfather')],
				marked: { seatId: s.seat('general'), characterId: 'general' }
			});
		});

		it('Example 2: with the favoured Empath not in play, no one is marked', () => {
			// The evil players are shown the Empath as not in play, so the Poisoner may bluff it.
			const s = scenario(['poisoner', 'imp', 'chef']);
			expect(evilLearns(s.game, 'stormcatcher', s.characters)).toEqual({
				evil: [s.seat('poisoner'), s.seat('imp')]
			});
		});
	});
});
