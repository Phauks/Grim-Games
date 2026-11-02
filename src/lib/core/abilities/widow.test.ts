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
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { abilityState, protection } from '#lib/core/rules/ability.ts';
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
		it('Example 1: Widow poisons the Sailor for the whole game', () => {
			// Wiki: "The Widow sees the Grimoire and points to the Sailor. The Sailor is poisoned this
			// game. The Sailor is sober, but dies when executed."
			const s = scenario(['widow', 'sailor', 'chef', 'empath', 'imp']).reminder(
				'sailor',
				'widow',
				'Poisoned'
			);
			expect(abilityState(s.game, s.seat('sailor'), s.characters).works).toBe(false);
			const later = s.newDay().newDay();
			expect(
				protection(later.game, s.seat('sailor'), later.characters, 'execution')
			).toBeUndefined();
			const executed = later.execute('sailor');
			expect(executed.game.seats[s.seat('sailor')].dead).toBe(true);
		});
		it('Example 2: the good player marked Know is the one shown the Widow token', () => {
			// Wiki: "On the third night, the Pit-Hag turns themselves into the Widow. That night, the
			// good Scapegoat learns that a Widow is in play."
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
		it("Example 3: Innkeeper briefly suspends Empath's poisoning", () => {
			// Wiki: "The Empath is poisoned due to the Widow. The Widow becomes drunk due to the
			// Innkeeper. The Empath is no longer poisoned. The Innkeeper dies. The Widow is now sober
			// and the Empath is poisoned again."
			const s = scenario(['widow', 'empath', 'innkeeper', 'chef', 'imp']).reminder(
				'empath',
				'widow',
				'Poisoned'
			);
			const works = (at: typeof s) => abilityState(at.game, at.seat('empath'), at.characters).works;
			expect(works(s)).toBe(false);
			const drunk = s.reminder('widow', 'innkeeper', 'Drunk');
			expect(works(drunk)).toBe(true);
			const sober = drunk.dies('innkeeper');
			expect(works(sober)).toBe(false);
		});
	});
});
