/**
 * Ogre: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Ogre
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Ogre.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { followedAlignmentOffer } from '#lib/core/rules/becomes.ts';

describe('Ogre', () => {
	const character = committedCharacter('ogre');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition carousel', () => {
			expect(character.name).toBe('Ogre');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Friend']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('ogre')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Ogre#Examples)', () => {
		it.todo('Example 1: Ogre picks an evil player and turns evil');
		// The Ogre's friend is good, so the Ogre is good; the friend later turns evil, and the
		// Ogre stays good (without the optional rule).
		it('Example 2: Friend turns evil, but Ogre stays good', () => {
			const s = scenario(['ogre', 'chef', 'empath', 'monk', 'poisoner', 'imp'])
				.reminder('chef', 'ogre', 'Friend')
				.do((s) => ({ type: 'SetAlignment', seatId: s.seat('chef'), alignment: 'evil' }));
			expect(followedAlignmentOffer(s.game, s.seat('chef'), s.characters)).toBeUndefined();
		});
	});
});

// The optional rule on the wiki page (https://wiki.bloodontheclocktower.com/Ogre): the Ogre is
// always the alignment of the player its Friend marks, following later changes.
describe('Ogre optional rule', () => {
	const cast = ['ogre', 'chef', 'empath', 'monk', 'poisoner', 'imp'];
	const on: Command = { type: 'SetOptionalRule', characterId: 'ogre', on: true };
	const friend = (s: string[]): Command => ({
		type: 'AddReminder',
		seatId: s[1],
		reminder: { characterId: 'ogre', label: 'Friend' }
	});
	const turnsEvil = (s: string[]): Command => ({
		type: 'SetAlignment',
		seatId: s[1],
		alignment: 'evil'
	});

	it('on, the Ogre turns evil when its friend does', () => {
		const { game, seats } = castGame(cast, on, friend, turnsEvil);
		expect(followedAlignmentOffer(game, seats[1], characters)).toEqual({
			into: 'alignment',
			seatId: seats[0],
			characterId: 'ogre',
			alignment: 'evil'
		});
	});
});
