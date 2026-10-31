/**
 * Widow: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Widow
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Widow.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { shownToSeats } from '#lib/core/rules/index.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Widow', () => {
	const character = committedCharacter('widow');

	describe('data (roles.json)', () => {
		it('is a Minion from edition carousel', () => {
			expect(character.name).toBe('Widow');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Poisoned', 'Know']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('widow')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([{ type: 'signal', name: 'grimoire', time: 'night' }]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Widow#Examples)', () => {
		it.todo('Example 1: Widow poisons the Sailor for the whole game');
		it('Example 2: the good player marked Know is the one shown the Widow token', () => {
			// The Pit-Hag made a Widow; the Storyteller marks the Scapegoat Know, so the Scapegoat
			// is woken and shown the Widow token.
			const s = scenario(['widow', 'scapegoat', 'chef', 'imp']).reminder(
				'scapegoat',
				'widow',
				'Know'
			);
			expect(shownToSeats(s.game, 'widow', s.characters)).toEqual([s.seat('scapegoat')]);
		});

		it('shows the token to no one until a player is marked Know', () => {
			const s = scenario(['widow', 'chef', 'imp']);
			expect(shownToSeats(s.game, 'widow', s.characters)).toEqual([]);
		});
		it.todo("Example 3: Innkeeper briefly suspends Empath's poisoning");
	});
});
