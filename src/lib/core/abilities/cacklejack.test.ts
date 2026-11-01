/**
 * Cacklejack: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Cacklejack
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Cacklejack.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { alignmentOf } from '#lib/core/model/selectors.ts';
import { changeableSeats, characterChanger } from '#lib/core/rules/becomes.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

// The Cacklejack's day choice: its Not Me token on seat `i`.
const notMe =
	(i: number) =>
	(s: string[]): Command => ({
		type: 'AddReminder',
		seatId: s[i],
		reminder: { characterId: 'cacklejack', label: 'Not Me' }
	});

describe('Cacklejack', () => {
	const character = committedCharacter('cacklejack');

	describe('data (roles.json)', () => {
		it('is a Traveller from edition carousel', () => {
			expect(character.name).toBe('Cacklejack');
			expect(character.type).toBe('traveller');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Not Me']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('cacklejack')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	// How to Run: each night but the first, the Storyteller changes one player's character, any
	// player but the one marked Not Me, into any other character.
	describe("tonight's character change", () => {
		it('offers every player but the one marked Not Me', () => {
			const cast = ['cacklejack', 'acrobat', 'chef', 'imp', 'poisoner'];
			const { game, seats } = castGame(cast, notMe(2));
			expect(characterChanger(game, 'cacklejack', characters)).toBe(seats[0]);
			expect(changeableSeats(game, 'cacklejack', characters)).toEqual(
				seats.filter((s) => s !== seats[2])
			);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Cacklejack#Examples)', () => {
		// Another player is marked Not Me; the Acrobat becomes the Clockmaker and stays good.
		it('Example 1: the Acrobat becomes the Clockmaker', () => {
			const s = scenario(['cacklejack', 'acrobat', 'chef', 'imp', 'poisoner'])
				.reminder('chef', 'cacklejack', 'Not Me')
				.becomes('acrobat', 'clockmaker');
			expect(s.game.seats[s.seat('acrobat')].characterId).toBe('clockmaker');
			expect(alignmentOf(s.game, s.seat('acrobat'))).toBe('good');
		});
		it.todo('Example 2: Drunk player becomes Flowergirl unknowingly');
		// The Leviathan becomes the Shabaloth and stays evil.
		it('Example 3: the Leviathan becomes the Shabaloth', () => {
			const marked = scenario(['cacklejack', 'acrobat', 'chef', 'leviathan', 'poisoner']).reminder(
				'acrobat',
				'cacklejack',
				'Not Me'
			);
			expect(changeableSeats(marked.game, 'cacklejack', marked.characters)).toContain(
				marked.seat('leviathan')
			);
			const s = marked.becomes('leviathan', 'shabaloth');
			expect(s.game.seats[s.seat('leviathan')].characterId).toBe('shabaloth');
			expect(alignmentOf(s.game, s.seat('leviathan'))).toBe('evil');
		});
	});
});
